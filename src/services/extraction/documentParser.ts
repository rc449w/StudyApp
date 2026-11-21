import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import {
  DocumentExtractionContent,
  ExtractionMethod,
  ExtractedPageSection,
  ExtractedTable,
  Subject,
} from '../../types/domain';
import {
  analyzeExtractedDocument,
  detectRepeatedBoilerplateLines,
  isLikelyFormula,
  isLikelyHeading,
  isNoiseOrMetadataLine,
  isTableNumberedFragment,
  isUrlOrReferenceLine,
} from './topicAnalyzer';
import {
  assertValidStorableBinary,
  cloneBinaryToArrayBuffer,
  cloneToFreshUint8Array,
} from '../storage/binaryUtils';

if (typeof window !== 'undefined' && typeof pdfWorkerUrl === 'string' && pdfWorkerUrl.length > 0) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'txt',
  'md',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'webp',
] as const;

export interface ExtractionProgressUpdate {
  stage: 'reading' | 'extracting' | 'ocr' | 'analyzing' | 'done';
  percent: number;
  message: string;
}

export interface LocalExtractionOutput {
  content: DocumentExtractionContent;
  textPreview: string;
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase().trim() ?? '';
}

export function isSupportedDocumentFile(fileName: string): boolean {
  const ext = getExtension(fileName);
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

interface OcrRecognitionResult {
  text: string;
  confidence: number;
}

function normalizePdfString(input: string): string {
  return input
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, ' ');
}

function splitRowIntoSpatialCells(
  rowItems: { x: number; width: number; text: string; height: number }[]
): string[] {
  if (rowItems.length === 0) return [];
  const sorted = [...rowItems].sort((a, b) => a.x - b.x);
  const cells: string[] = [];
  let currentCell = sorted[0].text;
  let prevEndX = sorted[0].x + Math.max(sorted[0].width, sorted[0].text.length * 4.5);

  for (let i = 1; i < sorted.length; i += 1) {
    const item = sorted[i];
    const gap = item.x - prevEndX;
    if (gap > 16) {
      cells.push(normalizePdfString(currentCell).trim());
      currentCell = item.text;
    } else {
      currentCell += gap > 2 ? ` ${item.text}` : item.text;
    }
    prevEndX = Math.max(prevEndX, item.x + Math.max(item.width, item.text.length * 4.5));
  }
  cells.push(normalizePdfString(currentCell).trim());
  return cells.filter((c) => c.length > 0);
}

function detectTablesFromPdfRows(
  rowsAsCells: string[][],
  pageLabel: string
): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  let block: string[][] = [];

  const flushBlock = () => {
    if (block.length >= 2) {
      const colCount = Math.max(...block.map((r) => r.length));
      if (colCount >= 2 && colCount <= 8) {
        const hasNumericalOrStatData = block.some((r) =>
          r.some((c) => /\d/.test(c) || /[%°]/.test(c))
        );
        if (hasNumericalOrStatData) {
          const normalizedRows = block.map((r) =>
            Array.from({ length: colCount }, (_, idx) => r[idx] ?? '')
          );
          tables.push({
            pageRef: pageLabel,
            headers: normalizedRows[0],
            rows: normalizedRows.slice(1),
          });
        }
      }
    }
    block = [];
  };

  for (const cells of rowsAsCells) {
    if (cells.length >= 2 && cells.length <= 8) {
      block.push(cells);
    } else {
      flushBlock();
    }
  }
  flushBlock();

  return tables;
}

async function runTesseractOcrOnImageSource(
  source: string | HTMLCanvasElement,
  onProgress?: (pct: number) => void
): Promise<OcrRecognitionResult> {
  const worker = await createWorker('eng', 1, {
    logger: (msg) => {
      if (msg.status === 'recognizing text' && typeof msg.progress === 'number') {
        onProgress?.(Math.round(msg.progress * 100));
      }
    },
  });

  try {
    const result = await worker.recognize(source);
    return {
      text: result.data.text?.trim() ?? '',
      confidence: typeof result.data.confidence === 'number' ? Math.round(result.data.confidence) : 0,
    };
  } finally {
    await worker.terminate();
  }
}

async function extractTxtFile(file: File): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
}> {
  const raw = await file.text();
  const lines = raw.split(/\r?\n/);
  const headings: string[] = [];
  const formulas: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isLikelyHeading(trimmed)) headings.push(trimmed.replace(/^#+\s*/, ''));
    if (isLikelyFormula(trimmed)) formulas.push(trimmed);
  }

  return {
    method: 'local-text',
    pages: [
      {
        pageNumber: 1,
        pageLabel: 'Section 1',
        headings,
        text: raw.trim(),
        tables: [],
        formulas,
        ocrUsed: false,
      },
    ],
  };
}

async function extractDocxFile(buffer: ArrayBuffer): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
}> {
  const zip = await JSZip.loadAsync(cloneBinaryToArrayBuffer(buffer));
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid DOCX archive: word/document.xml was not found.');
  }

  const xmlText = await docXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];

  if (!body) {
    throw new Error('Could not locate document body in DOCX.');
  }

  const pages: ExtractedPageSection[] = [];
  let pageNumber = 1;
  let currentHeadings: string[] = [];
  let currentLines: string[] = [];
  let currentTables: ExtractedTable[] = [];
  let currentFormulas: string[] = [];

  const flushPage = () => {
    if (
      currentLines.length > 0 ||
      currentTables.length > 0 ||
      currentHeadings.length > 0
    ) {
      pages.push({
        pageNumber,
        pageLabel: `Page ${pageNumber}`,
        headings: currentHeadings,
        text: currentLines.join('\n').trim(),
        tables: currentTables,
        formulas: currentFormulas,
        ocrUsed: false,
      });
      pageNumber += 1;
      currentHeadings = [];
      currentLines = [];
      currentTables = [];
      currentFormulas = [];
    }
  };

  for (const child of Array.from(body.children)) {
    const tag = child.tagName;

    if (tag === 'w:p') {
      // Check for explicit page break inside paragraph
      const hasPageBreak = Array.from(child.getElementsByTagName('w:br')).some(
        (br) => br.getAttribute('w:type') === 'page'
      );

      // Extract math text if OMML exists
      const mathTexts = Array.from(child.getElementsByTagName('m:t'))
        .map((m) => m.textContent ?? '')
        .join('')
        .trim();
      if (mathTexts) {
        currentFormulas.push(mathTexts);
        currentLines.push(mathTexts);
      }

      const styleEl = child.getElementsByTagName('w:pStyle')[0];
      const styleVal = styleEl?.getAttribute('w:val') ?? '';
      const textParts = Array.from(child.getElementsByTagName('w:t')).map(
        (el) => el.textContent ?? ''
      );
      const line = textParts.join('').trim();

      if (line) {
        const isStyleHeading = /heading|title|subtitle/i.test(styleVal);
        if (isStyleHeading || isLikelyHeading(line)) {
          currentHeadings.push(line);
        }
        if (isLikelyFormula(line)) {
          currentFormulas.push(line);
        }
        currentLines.push(line);
      }

      if (hasPageBreak) {
        flushPage();
      }
    } else if (tag === 'w:tbl') {
      const rowEls = Array.from(child.getElementsByTagName('w:tr'));
      const matrix: string[][] = rowEls.map((row) =>
        Array.from(row.getElementsByTagName('w:tc')).map((cell) =>
          Array.from(cell.getElementsByTagName('w:t'))
            .map((t) => t.textContent ?? '')
            .join(' ')
            .trim()
        )
      );

      if (matrix.length > 0) {
        const headers = matrix[0] ?? [];
        const rows = matrix.slice(1);
        const pageRef = `Page ${pageNumber}`;
        currentTables.push({ pageRef, headers, rows });

        const mdRows = matrix.map((r) => `| ${r.join(' | ')} |`);
        currentLines.push(...mdRows);
      }
    }
  }

  flushPage();

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      pageLabel: 'Page 1',
      headings: [],
      text: '',
      tables: [],
      formulas: [],
      ocrUsed: false,
    });
  }

  return { pages, method: 'local-xml' };
}

async function extractPptxFile(buffer: ArrayBuffer): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
}> {
  const zip = await JSZip.loadAsync(cloneBinaryToArrayBuffer(buffer));
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return numA - numB;
    });

  if (slidePaths.length === 0) {
    throw new Error('No slides found inside PPTX presentation.');
  }

  const parser = new DOMParser();
  const pages: ExtractedPageSection[] = [];

  for (let i = 0; i < slidePaths.length; i += 1) {
    const slideXml = await zip.file(slidePaths[i])?.async('text');
    if (!slideXml) continue;

    const xmlDoc = parser.parseFromString(slideXml, 'application/xml');
    const spList = Array.from(xmlDoc.getElementsByTagName('p:sp'));
    const headings: string[] = [];
    const lines: string[] = [];
    const formulas: string[] = [];
    const tables: ExtractedTable[] = [];
    const pageLabel = `Slide ${i + 1}`;

    for (const sp of spList) {
      const phEl = sp.getElementsByTagName('p:ph')[0];
      const phType = phEl?.getAttribute('type') ?? '';
      const isTitleShape = phType === 'title' || phType === 'ctrTitle';

      const paragraphs = Array.from(sp.getElementsByTagName('a:p'));
      for (const p of paragraphs) {
        const text = Array.from(p.getElementsByTagName('a:t'))
          .map((t) => t.textContent ?? '')
          .join('')
          .trim();
        if (!text) continue;
        if (isTitleShape || isLikelyHeading(text)) {
          headings.push(text);
        }
        if (isLikelyFormula(text)) {
          formulas.push(text);
        }
        lines.push(text);
      }
    }

    // Extract tables if present on slide
    const tblEls = Array.from(xmlDoc.getElementsByTagName('a:tbl'));
    for (const tbl of tblEls) {
      const matrix = Array.from(tbl.getElementsByTagName('a:tr')).map((tr) =>
        Array.from(tr.getElementsByTagName('a:tc')).map((tc) =>
          Array.from(tc.getElementsByTagName('a:t'))
            .map((t) => t.textContent ?? '')
            .join(' ')
            .trim()
        )
      );
      if (matrix.length > 0) {
        tables.push({
          pageRef: pageLabel,
          headers: matrix[0] ?? [],
          rows: matrix.slice(1),
        });
        lines.push(...matrix.map((r) => `| ${r.join(' | ')} |`));
      }
    }

    pages.push({
      pageNumber: i + 1,
      pageLabel,
      headings,
      text: lines.join('\n').trim(),
      tables,
      formulas,
      ocrUsed: false,
    });
  }

  return { pages, method: 'local-xml' };
}

async function extractXlsxFile(buffer: ArrayBuffer): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
}> {
  const workbook = XLSX.read(cloneToFreshUint8Array(buffer), {
    type: 'array',
    cellFormula: true,
  });
  const pages: ExtractedPageSection[] = [];

  workbook.SheetNames.forEach((sheetName, idx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const pageLabel = `Sheet ${idx + 1}: ${sheetName}`;
    const formulas: string[] = [];

    for (const [cellAddress, cellObj] of Object.entries(sheet)) {
      if (cellAddress.startsWith('!')) continue;
      const cell = cellObj as XLSX.CellObject | undefined;
      if (cell?.f) {
        formulas.push(`${cellAddress} = =${cell.f}`);
      }
    }

    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    const nonEmptyRows = matrix
      .map((row) => row.map((cell) => String(cell ?? '').trim()))
      .filter((row) => row.some((c) => c.length > 0));

    const headers = nonEmptyRows[0] ?? [];
    const dataRows = nonEmptyRows.slice(1, 60);
    const tables: ExtractedTable[] =
      headers.length > 0
        ? [
            {
              pageRef: pageLabel,
              title: sheetName,
              headers,
              rows: dataRows,
            },
          ]
        : [];

    const textLines = nonEmptyRows.slice(0, 60).map((r) => `| ${r.join(' | ')} |`);
    if (formulas.length > 0) {
      textLines.push('', 'Spreadsheet Formulas:', ...formulas.slice(0, 25));
    }

    pages.push({
      pageNumber: idx + 1,
      pageLabel,
      headings: [sheetName],
      text: textLines.join('\n').trim(),
      tables,
      formulas,
      ocrUsed: false,
    });
  });

  if (pages.length === 0) {
    throw new Error('Spreadsheet workbook contains no readable sheets.');
  }

  return { pages, method: 'local-spreadsheet' };
}

async function extractPdfFile(
  buffer: ArrayBuffer,
  enableLocalOcrForScannedPages: boolean,
  onProgress?: (update: ExtractionProgressUpdate) => void
): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
  ocrPageNumbers: number[];
}> {
  // Always transfer an isolated disposable Uint8Array to PDF.js Web Worker so the
  // caller's storage ArrayBuffer is never detached by Worker postMessage().
  const workerData = cloneToFreshUint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data: workerData });
  let pdf: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const pages: ExtractedPageSection[] = [];
    const ocrPageNumbers: number[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
      onProgress?.({
        stage: 'extracting',
        percent: Math.round((pageNum / numPages) * 70),
        message: `Extracting PDF page ${pageNum} of ${numPages}...`,
      });

      const page = await pdf.getPage(pageNum);
      try {
        const textContent = await page.getTextContent();

        // Group PDF text items into lines by vertical Y position and preserve spatial column boundaries
        interface PdfTextItem {
          str: string;
          transform: number[];
          width?: number;
          height?: number;
        }

        const lineBuckets = new Map<
          number,
          { x: number; width: number; text: string; height: number }[]
        >();
        for (const rawItem of textContent.items) {
          const item = rawItem as PdfTextItem;
          if (!item.str || !item.str.trim()) continue;
          const yBucket = Math.round((item.transform?.[5] ?? 0) / 4) * 4;
          const xPos = item.transform?.[4] ?? 0;
          const width = item.width ?? 0;
          const height = item.height ?? Math.abs(item.transform?.[3] ?? 10);
          const arr = lineBuckets.get(yBucket) ?? [];
          arr.push({ x: xPos, width, text: item.str, height });
          lineBuckets.set(yBucket, arr);
        }

        const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
        const lines: string[] = [];
        const rowsAsCells: string[][] = [];
        const headings: string[] = [];
        const formulas: string[] = [];

        for (const y of sortedYs) {
          const rowItems = (lineBuckets.get(y) ?? []).sort((a, b) => a.x - b.x);
          const cells = splitRowIntoSpatialCells(rowItems);
          rowsAsCells.push(cells);

          const lineStr = normalizePdfString(
            cells.length >= 2 ? `| ${cells.join(' | ')} |` : rowItems.map((i) => i.text).join(' ')
          ).trim();
          const plainLineStr = normalizePdfString(rowItems.map((i) => i.text).join(' ')).trim();
          const maxHeight = Math.max(...rowItems.map((i) => i.height));
          if (!plainLineStr) continue;

          lines.push(cells.length >= 2 ? lineStr : plainLineStr);

          const isCleanVisualHeading =
            cells.length === 1 &&
            maxHeight >= 13.5 &&
            plainLineStr.length >= 4 &&
            plainLineStr.length <= 85 &&
            /^([A-Z#]|[IVX]+\.|\d+\.)/.test(plainLineStr) &&
            !/[.!?,;]$/.test(plainLineStr) &&
            !/^\$\d/.test(plainLineStr) &&
            /[a-zA-Z]{3,}/.test(plainLineStr) &&
            plainLineStr.split(/\s+/).length <= 9 &&
            !isNoiseOrMetadataLine(plainLineStr) &&
            !isUrlOrReferenceLine(plainLineStr) &&
            !isLikelyFormula(plainLineStr) &&
            !isTableNumberedFragment(plainLineStr) &&
            (isLikelyHeading(plainLineStr) ||
              !/\b(is|are|was|were|represents|represent|shows|show|used to|consists|defined as|means|whose|which|that)\b/i.test(
                plainLineStr
              ));

          if (isCleanVisualHeading || (cells.length === 1 && isLikelyHeading(plainLineStr))) {
            headings.push(plainLineStr);
          }
          if (isLikelyFormula(plainLineStr) && !isUrlOrReferenceLine(plainLineStr)) {
            formulas.push(plainLineStr);
          }
        }

        const extractedTables = detectTablesFromPdfRows(rowsAsCells, `Page ${pageNum}`);
        let pageText = lines.join('\n').trim();
        let ocrUsed = false;
        let ocrConfidence: number | undefined;
        let lowConfidenceOcr = false;
        const extractionWarnings: string[] = [];

        // Check if page contains embedded images (e.g., scanned slide, chart graphic, diagram)
        let pageHasImages = false;
        try {
          const opList = await page.getOperatorList();
          const OPS = pdfjsLib.OPS;
          pageHasImages = opList.fnArray.some(
            (fn) =>
              fn === OPS.paintImageXObject ||
              fn === OPS.paintInlineImageXObject ||
              fn === OPS.paintImageMaskXObject
          );
        } catch {
          pageHasImages = false;
        }

        const shouldRunOcr =
          enableLocalOcrForScannedPages &&
          (pageText.length < 40 || (pageHasImages && pageText.length < 150));

        if (shouldRunOcr) {
          onProgress?.({
            stage: 'ocr',
            percent: Math.round((pageNum / numPages) * 80),
            message: `Running local OCR on Page ${pageNum} (${pageText.length < 40 ? 'scanned page' : 'image/chart slide'})...`,
          });

          const viewport = page.getViewport({ scale: 2.2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          try {
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;
              const ocrRes = await runTesseractOcrOnImageSource(canvas);
              if (ocrRes.text) {
                ocrUsed = true;
                ocrConfidence = ocrRes.confidence;
                lowConfidenceOcr = ocrRes.confidence > 0 && ocrRes.confidence < 68;
                ocrPageNumbers.push(pageNum);

                if (lowConfidenceOcr) {
                  extractionWarnings.push(
                    `Low local OCR confidence (${ocrRes.confidence}%) on Page ${pageNum}. Headings, charts, or math notation may require manual verification.`
                  );
                }

                // Merge selectable headings/lines with unique OCR lines cleanly
                const existingLower = new Set(
                  pageText
                    .split(/\r?\n/)
                    .map((l) => l.trim().toLowerCase())
                    .filter(Boolean)
                );
                const mergedOcrLines: string[] = [];
                for (const rawOcrLine of ocrRes.text.split(/\r?\n/)) {
                  const clean = normalizePdfString(rawOcrLine).trim();
                  if (!clean) continue;
                  if (!existingLower.has(clean.toLowerCase())) {
                    mergedOcrLines.push(clean);
                  }
                  if (isLikelyHeading(clean)) headings.push(clean);
                  if (isLikelyFormula(clean) && !isUrlOrReferenceLine(clean)) formulas.push(clean);
                }

                pageText = pageText
                  ? mergedOcrLines.length > 0
                    ? `${pageText}\n${mergedOcrLines.join('\n')}`
                    : pageText
                  : ocrRes.text;
              }
            }
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        }

        if (pageText.replace(/\s+/g, '').length < 20) {
          extractionWarnings.push(
            `Page ${pageNum} yielded very little readable text locally (${pageText.length} chars).`
          );
        }

        pages.push({
          pageNumber: pageNum,
          pageLabel: `Page ${pageNum}`,
          headings: Array.from(new Set(headings)),
          text: pageText,
          tables: extractedTables,
          formulas: Array.from(new Set(formulas)),
          ocrUsed,
          ocrConfidence,
          lowConfidenceOcr,
          extractionWarnings: extractionWarnings.length > 0 ? extractionWarnings : undefined,
        });
      } finally {
        page.cleanup();
      }
    }

    // Remove repeated running headers/footers across pages from headings
    const boilerplate = detectRepeatedBoilerplateLines(pages);
    if (boilerplate.size > 0) {
      for (const p of pages) {
        p.headings = p.headings.filter((h) => {
          const norm = h
            .toLowerCase()
            .replace(/\bpage\s*\d+(\s*of\s*\d+)?\b/gi, '')
            .replace(/\b\d+\b/g, '#')
            .replace(/\s+/g, ' ')
            .trim();
          return !boilerplate.has(norm);
        });
      }
    }

    return {
      pages,
      method: ocrPageNumbers.length > 0 ? 'local-ocr' : 'local-pdf',
      ocrPageNumbers,
    };
  } finally {
    if (pdf) {
      await pdf.cleanup().catch(() => undefined);
    }
    await loadingTask.destroy().catch(() => undefined);
  }
}

async function extractImageOcrFile(
  file: File,
  onProgress?: (update: ExtractionProgressUpdate) => void
): Promise<{
  pages: ExtractedPageSection[];
  method: ExtractionMethod;
  ocrPageNumbers: number[];
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    onProgress?.({
      stage: 'ocr',
      percent: 15,
      message: `Running local OCR on ${file.name}...`,
    });

    const ocrRes = await runTesseractOcrOnImageSource(objectUrl, (pct) => {
      onProgress?.({
        stage: 'ocr',
        percent: Math.min(85, 15 + Math.round(pct * 0.7)),
        message: `Running local OCR on ${file.name} (${pct}%)...`,
      });
    });

    const headings: string[] = [];
    const formulas: string[] = [];
    for (const line of ocrRes.text.split(/\r?\n/)) {
      const clean = normalizePdfString(line).trim();
      if (!clean) continue;
      if (isLikelyHeading(clean)) headings.push(clean);
      if (isLikelyFormula(clean) && !isUrlOrReferenceLine(clean)) formulas.push(clean);
    }

    const lowConfidenceOcr = ocrRes.confidence > 0 && ocrRes.confidence < 68;
    const warnings = lowConfidenceOcr
      ? [
          `Low local OCR confidence (${ocrRes.confidence}%). Verify extracted terms and formulas carefully.`,
        ]
      : undefined;

    return {
      method: 'local-ocr',
      ocrPageNumbers: [1],
      pages: [
        {
          pageNumber: 1,
          pageLabel: 'Scanned Image 1',
          headings,
          text:
            ocrRes.text ||
            '(No readable text detected by local OCR. You may opt into Online AI Vision OCR.)',
          tables: [],
          formulas,
          ocrUsed: true,
          ocrConfidence: ocrRes.confidence,
          lowConfidenceOcr,
          extractionWarnings: warnings,
        },
      ],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function runLocalDocumentExtractionFromBuffer(params: {
  documentId: string;
  fileName: string;
  mimeType?: string;
  buffer: ArrayBuffer;
  existingSubjects: Subject[];
  selectedSubjectName?: string;
  enableLocalOcr?: boolean;
  onProgress?: (update: ExtractionProgressUpdate) => void;
}): Promise<LocalExtractionOutput> {
  const {
    documentId,
    fileName,
    mimeType = 'application/octet-stream',
    buffer,
    existingSubjects,
    selectedSubjectName,
    enableLocalOcr = true,
    onProgress,
  } = params;

  const ext = getExtension(fileName);
  if (!isSupportedDocumentFile(fileName)) {
    throw new Error(
      `Unsupported file format ".${ext}". Supported formats: PDF, DOCX, PPTX, TXT, XLSX, JPG, PNG, WebP.`
    );
  }

  onProgress?.({
    stage: 'reading',
    percent: 10,
    message: `Reading ${fileName} locally...`,
  });

  // Create a dedicated non-transferable storage copy BEFORE any parser or worker touches bytes.
  const storageBuffer = cloneBinaryToArrayBuffer(buffer, buffer.byteLength);

  let pages: ExtractedPageSection[] = [];
  let method: ExtractionMethod = 'local-text';
  let ocrPageNumbers: number[] = [];

  if (ext === 'txt' || ext === 'md') {
    const text = new TextDecoder().decode(cloneToFreshUint8Array(storageBuffer));
    const syntheticFile = new File([text], fileName, { type: mimeType || 'text/plain' });
    const res = await extractTxtFile(syntheticFile);
    pages = res.pages;
    method = res.method;
  } else if (ext === 'docx') {
    onProgress?.({ stage: 'extracting', percent: 40, message: 'Parsing DOCX XML & tables...' });
    const res = await extractDocxFile(cloneBinaryToArrayBuffer(storageBuffer));
    pages = res.pages;
    method = res.method;
  } else if (ext === 'pptx') {
    onProgress?.({ stage: 'extracting', percent: 40, message: 'Parsing PPTX slides & tables...' });
    const res = await extractPptxFile(cloneBinaryToArrayBuffer(storageBuffer));
    pages = res.pages;
    method = res.method;
  } else if (ext === 'xlsx') {
    onProgress?.({
      stage: 'extracting',
      percent: 40,
      message: 'Parsing XLSX worksheets & formulas...',
    });
    const res = await extractXlsxFile(cloneBinaryToArrayBuffer(storageBuffer));
    pages = res.pages;
    method = res.method;
  } else if (ext === 'pdf') {
    const res = await extractPdfFile(
      cloneBinaryToArrayBuffer(storageBuffer),
      enableLocalOcr,
      onProgress
    );
    pages = res.pages;
    method = res.method;
    ocrPageNumbers = res.ocrPageNumbers;
  } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') {
    if (!enableLocalOcr) {
      pages = [
        {
          pageNumber: 1,
          pageLabel: 'Scanned Image 1',
          headings: [],
          text: '(Local OCR skipped by user setting. Run OCR or opt into Online AI Vision OCR.)',
          tables: [],
          formulas: [],
          ocrUsed: false,
        },
      ];
      method = 'local-ocr';
    } else {
      const imageFile = new File([cloneBinaryToArrayBuffer(storageBuffer)], fileName, {
        type: mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      });
      const res = await extractImageOcrFile(imageFile, onProgress);
      pages = res.pages;
      method = res.method;
      ocrPageNumbers = res.ocrPageNumbers;
    }
  }

  onProgress?.({
    stage: 'analyzing',
    percent: 85,
    message: 'Identifying chapters, lessons, topics, definitions & formulas...',
  });

  const analysis = analyzeExtractedDocument({
    fileName,
    pages,
    existingSubjects,
    selectedSubjectName,
  });

  const fullExtractedText = pages
    .map((p) => `[${p.pageLabel}${p.ocrUsed ? ' · OCR' : ''}]\n${p.text}`)
    .join('\n\n')
    .trim();

  const verifiedStorageBuffer = assertValidStorableBinary(storageBuffer, {
    required: storageBuffer.byteLength > 0,
    expectedByteLength: storageBuffer.byteLength > 0 ? storageBuffer.byteLength : undefined,
    label: fileName,
  });

  onProgress?.({
    stage: 'done',
    percent: 88,
    message: 'Extraction complete. Preparing local storage...',
  });

  const content: DocumentExtractionContent = {
    documentId,
    sourceFileName: fileName,
    detectedSubject: analysis.detectedSubject,
    detectedChapters: analysis.detectedChapters,
    detectedLessons: analysis.detectedLessons,
    pageCount: pages.length,
    ocrApplied: ocrPageNumbers.length > 0,
    ocrPageNumbers,
    extractionMethod: method,
    pages,
    fullExtractedText,
    topicInventory: analysis.topicInventory,
    inventoryStatus: 'pending-review',
    hasLocalFileBlob: Boolean(verifiedStorageBuffer && verifiedStorageBuffer.byteLength > 0),
    rawFileBuffer: verifiedStorageBuffer,
    rawMimeType: mimeType,
    updatedAt: new Date().toISOString(),
  };

  return {
    content,
    textPreview: fullExtractedText.slice(0, 6000),
  };
}

export async function runLocalDocumentExtraction(params: {
  documentId: string;
  file: File;
  existingSubjects: Subject[];
  selectedSubjectName?: string;
  enableLocalOcr?: boolean;
  onProgress?: (update: ExtractionProgressUpdate) => void;
}): Promise<LocalExtractionOutput> {
  const { documentId, file, existingSubjects, selectedSubjectName, enableLocalOcr = true, onProgress } =
    params;

  onProgress?.({
    stage: 'reading',
    percent: 8,
    message: `Reading ${file.name} locally...`,
  });

  const rawFileBytes = await file.arrayBuffer();
  return runLocalDocumentExtractionFromBuffer({
    documentId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    buffer: rawFileBytes,
    existingSubjects,
    selectedSubjectName,
    enableLocalOcr,
    onProgress,
  });
}

/**
 * Helper to convert a locally stored image or first scanned PDF pages into base64
 * ONLY when the student explicitly grants permission for Online AI Vision OCR.
 */
export async function prepareFilePayloadForAuthorizedAi(content: DocumentExtractionContent): Promise<{
  extractedText: string;
  imageAttachments: { mimeType: string; dataBase64: string; label: string }[];
}> {
  const attachments: { mimeType: string; dataBase64: string; label: string }[] = [];

  if (content.rawFileBuffer && content.rawMimeType?.startsWith('image/')) {
    const bytes = cloneToFreshUint8Array(content.rawFileBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    attachments.push({
      mimeType: content.rawMimeType,
      dataBase64: btoa(binary),
      label: content.sourceFileName,
    });
  } else if (
    content.rawFileBuffer &&
    content.rawMimeType === 'application/pdf' &&
    content.fullExtractedText.replace(/\[Page \d+[^\]]*\]/g, '').trim().length < 150
  ) {
    // Render up to first 3 scanned PDF pages to JPEG for Vision OCR using an isolated buffer copy
    const loadingTask = pdfjsLib.getDocument({
      data: cloneToFreshUint8Array(content.rawFileBuffer),
    });
    let pdf: pdfjsLib.PDFDocumentProxy | null = null;
    try {
      pdf = await loadingTask.promise;
      const limit = Math.min(3, pdf.numPages);
      for (let pageNum = 1; pageNum <= limit; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        try {
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            attachments.push({
              mimeType: 'image/jpeg',
              dataBase64: dataUrl.split(',')[1] ?? '',
              label: `Page ${pageNum}`,
            });
          }
        } finally {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      }
    } finally {
      if (pdf) {
        await pdf.cleanup().catch(() => undefined);
      }
      await loadingTask.destroy().catch(() => undefined);
    }
  }

  return {
    extractedText: content.fullExtractedText.slice(0, 32000),
    imageAttachments: attachments,
  };
}
