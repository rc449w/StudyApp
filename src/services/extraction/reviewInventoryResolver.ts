import {
  DocumentExtractionContent,
  ExtractedPageSection,
  ExtractedTopicCandidate,
  LocalDocument,
  Subject,
  Topic,
} from '../../types/domain';
import {
  analyzeExtractedDocument,
  isLikelyFormula,
  isLikelyHeading,
  isNoiseOrMetadataLine,
  isUrlOrReferenceLine,
} from './topicAnalyzer';

export interface ResolvedReviewInventory {
  content: DocumentExtractionContent;
  isFallbackReconstruction: boolean;
  fallbackNotice?: string;
}

function extractHeadingsAndFormulasFromText(text: string): {
  headings: string[];
  formulas: string[];
} {
  const headings: string[] = [];
  const formulas: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const clean = rawLine.trim();
    if (!clean || isNoiseOrMetadataLine(clean)) continue;
    if (isLikelyHeading(clean)) {
      headings.push(clean.replace(/^#+\s*/, '').trim());
    }
    if (isLikelyFormula(clean) && !isUrlOrReferenceLine(clean)) {
      formulas.push(clean);
    }
  }
  return {
    headings: Array.from(new Set(headings)),
    formulas: Array.from(new Set(formulas)),
  };
}

function parsePagesFromTextPreview(doc: LocalDocument): ExtractedPageSection[] {
  const preview = doc.textPreview?.trim() ?? '';
  if (!preview) {
    return [
      {
        pageNumber: 1,
        pageLabel: 'Page 1',
        headings: [],
        text: '',
        tables: [],
        formulas: [],
        ocrUsed: Boolean(doc.ocrUsed),
      },
    ];
  }

  const pageMarkerRegex = /^\[([^\]]+)\]\s*$/gm;
  const matches = Array.from(preview.matchAll(pageMarkerRegex));

  if (matches.length === 0) {
    const { headings, formulas } = extractHeadingsAndFormulasFromText(preview);
    return [
      {
        pageNumber: 1,
        pageLabel: 'Page 1',
        headings,
        text: preview,
        tables: [],
        formulas,
        ocrUsed: Boolean(doc.ocrUsed),
      },
    ];
  }

  const sections: ExtractedPageSection[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = match[1]?.replace(/\s*·\s*OCR/i, '').trim() || `Page ${i + 1}`;
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? preview.length) : preview.length;
    const bodyText = preview.slice(startIdx, endIdx).trim();
    const pageNumMatch = label.match(/(\d+)/);
    const pageNumber = pageNumMatch ? Number(pageNumMatch[1]) : i + 1;
    const { headings, formulas } = extractHeadingsAndFormulasFromText(bodyText);

    sections.push({
      pageNumber,
      pageLabel: label,
      headings,
      text: bodyText,
      tables: [],
      formulas,
      ocrUsed: Boolean(doc.ocrUsed),
    });
  }

  if (sections.length > 0) {
    return sections;
  }

  const { headings, formulas } = extractHeadingsAndFormulasFromText(preview);
  return [
    {
      pageNumber: 1,
      pageLabel: 'Page 1',
      headings,
      text: preview,
      tables: [],
      formulas,
      ocrUsed: Boolean(doc.ocrUsed),
    },
  ];
}

function mapSyncedTopicsToCandidates(
  linkedTopics: Topic[],
  subjectName: string
): ExtractedTopicCandidate[] {
  return linkedTopics.map((t) => ({
    id: `inv-${t.id}`,
    subjectHint: subjectName,
    chapter: t.chapter || 'Saved Chapter',
    lesson: t.lesson || 'Saved Lesson',
    title: t.title,
    subtopics: t.subtopics ?? [],
    summary: t.summary,
    pageRef: t.pageRef || 'Page 1',
    definitions: t.definitions ?? [],
    formulas: t.formulas ?? [],
    examples: t.examples ?? [],
    importantConcepts: t.importantConcepts ?? [],
    confirmed: true,
    syncedTopicId: t.id,
    sourceAttribution: t.sourceAttribution ?? 'extracted-from-document',
  }));
}

/**
 * Resolves the reviewable Extraction Content strictly by `document.id` (never by fileName).
 * If `documentContents` is missing for a legacy pre-fix upload, safely reconstructs an
 * in-memory review view from synced topics (matched by document ID) and/or `doc.textPreview`
 * without altering or deleting existing IndexedDB records.
 */
export function resolveDocumentReviewContent(params: {
  document: LocalDocument;
  contentMap: Map<string, DocumentExtractionContent>;
  topics: Topic[];
  subjects: Subject[];
}): ResolvedReviewInventory {
  const { document, contentMap, topics, subjects } = params;

  const exactStored = contentMap.get(document.id);
  if (exactStored) {
    return {
      content: exactStored,
      isFallbackReconstruction: false,
    };
  }

  const subjectName =
    subjects.find((s) => s.id === document.subjectId)?.name ?? 'General Study';

  const linkedTopics = topics.filter(
    (t) => t.sourceDocumentId === document.id || t.linkedDocumentIds.includes(document.id)
  );

  const previewPages = parsePagesFromTextPreview(document);
  const hasPreviewText = Boolean(document.textPreview?.trim());
  const analyzedFromPreview = hasPreviewText
    ? analyzeExtractedDocument({
        fileName: document.fileName,
        pages: previewPages,
        existingSubjects: subjects,
        selectedSubjectName: subjectName,
      })
    : null;

  const topicInventory: ExtractedTopicCandidate[] =
    linkedTopics.length > 0
      ? mapSyncedTopicsToCandidates(linkedTopics, subjectName)
      : analyzedFromPreview?.topicInventory ?? [];

  const recordedTotal = document.topicCount ?? 0;
  const pageTotal = document.pageCount ?? previewPages.length;
  const previewLength = document.textPreview?.length ?? 0;

  const fallbackNotice =
    linkedTopics.length > 0
      ? `Loaded ${linkedTopics.length} saved topic(s) linked to document ID ${document.id}. Detailed full-page content record is not in IndexedDB; locate the original file below to reprocess all ${pageTotal} page(s).`
      : hasPreviewText
        ? `No full documentContents record was stored for ID ${document.id} (saved text preview: ${previewLength.toLocaleString()} chars covering ${previewPages.length} of ${pageTotal} recorded page(s); metadata previously recorded ${recordedTotal} topics). Use "Locate Original File & Reprocess" below to recover all ${pageTotal} pages cleanly.`
        : `No documentContents record or text preview was stored for ID ${document.id} (metadata recorded ${pageTotal} page(s) and ${recordedTotal} topics). Locate the original file below to extract all pages.`;

  return {
    isFallbackReconstruction: true,
    fallbackNotice,
    content: {
      documentId: document.id,
      sourceFileName: document.fileName,
      detectedSubject: analyzedFromPreview?.detectedSubject ?? subjectName,
      detectedChapters:
        analyzedFromPreview?.detectedChapters ??
        Array.from(new Set(topicInventory.map((t) => t.chapter).filter(Boolean))),
      detectedLessons:
        analyzedFromPreview?.detectedLessons ??
        Array.from(new Set(topicInventory.map((t) => t.lesson).filter(Boolean))),
      pageCount: pageTotal,
      ocrApplied: Boolean(document.ocrUsed),
      ocrPageNumbers: [],
      extractionMethod: document.extractionMethod ?? 'local-pdf',
      pages: previewPages,
      fullExtractedText: document.textPreview ?? '',
      topicInventory,
      inventoryStatus: document.extractionStatus === 'confirmed' ? 'confirmed' : 'pending-review',
      hasLocalFileBlob: false,
      rawMimeType: document.mimeType,
      updatedAt: document.addedAt,
    },
  };
}
