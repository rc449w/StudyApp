import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Image as ImageIcon, Loader2, Table2, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cloneToFreshUint8Array, isArrayBufferDetached } from '../../services/storage/binaryUtils';
import { DocumentExtractionContent, ExtractedTable, MockQuestion } from '../../types/domain';

if (typeof window !== 'undefined' && typeof pdfWorkerUrl === 'string' && pdfWorkerUrl.length > 0) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const renderedPageImageCache = new Map<string, string>();

interface QuestionVisualReferenceProps {
  question: MockQuestion;
  documentContents: DocumentExtractionContent[];
}

function parseReferencedPageNumber(question: MockQuestion): number | undefined {
  if (typeof question.sourcePageNumber === 'number' && question.sourcePageNumber > 0) {
    return question.sourcePageNumber;
  }
  const combined = `${question.sourceReference ?? ''} ${question.prompt ?? ''}`;
  const match = combined.match(/\b(?:page|slide|sheet|p\.?)\s*(\d+)/i);
  if (!match) return undefined;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export const QuestionVisualReference: React.FC<QuestionVisualReferenceProps> = ({
  question,
  documentContents,
}) => {
  const matchedDoc = useMemo(() => {
    if (question.sourceDocumentId) {
      const exact = documentContents.find((d) => d.documentId === question.sourceDocumentId);
      if (exact) return exact;
    }
    const refLower = (question.sourceReference ?? '').toLowerCase();
    return documentContents.find(
      (d) => d.sourceFileName && refLower.includes(d.sourceFileName.toLowerCase())
    );
  }, [question.sourceDocumentId, question.sourceReference, documentContents]);

  const pageNumber = useMemo(() => parseReferencedPageNumber(question), [question]);

  const matchedPage = useMemo(() => {
    if (!matchedDoc) return undefined;
    if (pageNumber) {
      return matchedDoc.pages.find((p) => p.pageNumber === pageNumber) ?? matchedDoc.pages[0];
    }
    return matchedDoc.pages[0];
  }, [matchedDoc, pageNumber]);

  const tables: ExtractedTable[] = useMemo(() => {
    if (question.referenceTables && question.referenceTables.length > 0) {
      return question.referenceTables;
    }
    return matchedPage?.tables ?? [];
  }, [question.referenceTables, matchedPage]);

  const hasRenderableBinary = Boolean(
    matchedDoc?.rawFileBuffer &&
      !isArrayBufferDetached(matchedDoc.rawFileBuffer) &&
      matchedDoc.rawFileBuffer.byteLength > 0
  );

  const isVisualOrTableQuestion = useMemo(() => {
    if (tables.length > 0) return true;
    if (matchedDoc?.rawMimeType?.startsWith('image/')) return true;
    if (matchedPage?.ocrUsed) return true;
    return /\b(table|graph|chart|histogram|ogive|pie chart|frequency polygon|diagram|figure|image|visual|plot|class mark|boundary|boundaries)\b/i.test(
      `${question.prompt} ${question.topicTitle ?? ''}`
    );
  }, [tables.length, matchedDoc, matchedPage, question.prompt, question.topicTitle]);

  const [expanded, setExpanded] = useState<boolean>(isVisualOrTableQuestion);
  const [zoomed, setZoomed] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const effectivePageNum = matchedPage?.pageNumber ?? pageNumber ?? 1;
  const cacheKey = matchedDoc ? `${matchedDoc.documentId}:${effectivePageNum}` : '';

  useEffect(() => {
    if (!expanded || !matchedDoc || !hasRenderableBinary || !matchedDoc.rawFileBuffer) {
      return;
    }

    if (cacheKey && renderedPageImageCache.has(cacheKey)) {
      setImageUrl(renderedPageImageCache.get(cacheKey) ?? null);
      return;
    }

    let cancelled = false;
    setLoadingImage(true);
    setImageError(null);

    const renderSource = async () => {
      try {
        const mime = matchedDoc.rawMimeType ?? '';
        const safeBytes = cloneToFreshUint8Array(matchedDoc.rawFileBuffer!);

        if (mime.startsWith('image/')) {
          const blob = new Blob([safeBytes.slice().buffer], { type: mime });
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed loading reference image.'));
            reader.readAsDataURL(blob);
          });
          if (!cancelled) {
            if (cacheKey) renderedPageImageCache.set(cacheKey, dataUrl);
            setImageUrl(dataUrl);
          }
          return;
        }

        if (
          mime === 'application/pdf' ||
          matchedDoc.sourceFileName.toLowerCase().endsWith('.pdf')
        ) {
          const loadingTask = pdfjsLib.getDocument({ data: safeBytes });
          let pdf: pdfjsLib.PDFDocumentProxy | null = null;
          try {
            pdf = await loadingTask.promise;
            const boundedPage = Math.min(Math.max(1, effectivePageNum), pdf.numPages);
            const page = await pdf.getPage(boundedPage);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            try {
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport, canvas }).promise;
                const dataUrl = canvas.toDataURL('image/png');
                if (!cancelled) {
                  if (cacheKey) renderedPageImageCache.set(cacheKey, dataUrl);
                  setImageUrl(dataUrl);
                }
              }
            } finally {
              canvas.width = 0;
              canvas.height = 0;
              page.cleanup();
            }
          } finally {
            if (pdf) await pdf.cleanup().catch(() => undefined);
            await loadingTask.destroy().catch(() => undefined);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setImageError(
            err instanceof Error ? err.message : 'Unable to render source reference page image.'
          );
        }
      } finally {
        if (!cancelled) setLoadingImage(false);
      }
    };

    void renderSource();

    return () => {
      cancelled = true;
    };
  }, [expanded, matchedDoc, hasRenderableBinary, effectivePageNum, cacheKey]);

  if (!matchedDoc && tables.length === 0) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          {tables.length > 0 ? (
            <Table2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-blue-700 shrink-0" />
          )}
          <span className="truncate">
            Reference Figure &amp; Table · {matchedDoc?.sourceFileName ?? question.sourceReference}{' '}
            (Page {effectivePageNum})
          </span>
          {tables.length > 0 && (
            <span className="text-[11px] font-medium text-blue-700 shrink-0">
              {tables.length} table{tables.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 text-blue-700 shrink-0">
          <Eye className="w-3.5 h-3.5" />
          <span>{expanded ? 'Hide Reference' : 'View Reference'}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="p-3.5 border-t border-slate-200 bg-white space-y-3">
          {/* Structured Tables extracted from that page */}
          {tables.length > 0 && (
            <div className="space-y-2.5">
              {tables.map((tbl, tIdx) => (
                <div
                  key={`${tbl.pageRef}-${tIdx}`}
                  className="border border-slate-200 rounded-lg overflow-x-auto"
                >
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <tr>
                        {tbl.headers.map((h, hIdx) => (
                          <th key={hIdx} className="px-3 py-1.5 font-semibold whitespace-nowrap">
                            {h || `Col ${hIdx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tbl.rows.slice(0, 12).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Rendered Source PDF Page / Uploaded Image */}
          {loadingImage && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
              <span>Rendering Page {effectivePageNum} reference image...</span>
            </div>
          )}

          {imageError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {imageError}
            </p>
          )}

          {imageUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Source Slide / Page {effectivePageNum} from {matchedDoc?.sourceFileName}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold cursor-pointer"
                >
                  {zoomed ? (
                    <>
                      <ZoomOut className="w-3.5 h-3.5" />
                      <span>Compact View</span>
                    </>
                  ) : (
                    <>
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Enlarge Page</span>
                    </>
                  )}
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg bg-slate-100 p-2 overflow-auto">
                <img
                  src={imageUrl}
                  alt={`Reference page ${effectivePageNum} from ${matchedDoc?.sourceFileName ?? 'document'}`}
                  className={`mx-auto rounded shadow-xs object-contain bg-white ${
                    zoomed ? 'max-h-[720px] w-full' : 'max-h-[340px] w-auto'
                  }`}
                />
              </div>
            </div>
          )}

          {!hasRenderableBinary && matchedPage?.text && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-800">
                Extracted Reference Excerpt ({matchedPage.pageLabel})
              </p>
              <p className="whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {matchedPage.text.slice(0, 600)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
