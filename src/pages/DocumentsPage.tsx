import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import { AiPermissionModal } from '../components/documents/AiPermissionModal';
import { DocumentInventoryModal } from '../components/documents/DocumentInventoryModal';
import { onlineAiClient } from '../services/ai/onlineAiClient';
import {
  isSupportedDocumentFile,
  prepareFilePayloadForAuthorizedAi,
  runLocalDocumentExtraction,
} from '../services/extraction/documentParser';
import {
  reanalyzeStoredPagesInPlace,
  reprocessDocumentInPlace,
} from '../services/extraction/documentRecovery';
import { resolveDocumentReviewContent } from '../services/extraction/reviewInventoryResolver';
import { cloneBinaryToArrayBuffer, isArrayBufferDetached } from '../services/storage/binaryUtils';
import { fileSystemAdapter } from '../services/storage/fileSystemAdapter';
import {
  DocumentExtractionContent,
  ExtractedTopicCandidate,
  LocalDocument,
  Quarter,
  WorkspaceSnapshot,
} from '../types/domain';
import { formatBytes, formatShortDate } from '../utils/formatters';

interface DocumentsPageProps {
  workspace: WorkspaceSnapshot;
  onSaveDocumentAndContent: (
    doc: LocalDocument,
    content: DocumentExtractionContent
  ) => Promise<void>;
  onUpdateDocumentContent: (
    doc: LocalDocument,
    content: DocumentExtractionContent
  ) => Promise<void>;
  onConfirmInventoryToTopics: (params: {
    document: LocalDocument;
    content: DocumentExtractionContent;
    targetSubjectId: string;
    quarter: Quarter;
  }) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onGoToSettings: () => void;
}

type QueueStage = 'uploading' | 'extracting' | 'saving' | 'extracted' | 'failed';

interface UploadQueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  stage: QueueStage;
  percent: number;
  message: string;
  error?: string;
  failurePhase?: 'extraction' | 'storage';
  pendingSave?: {
    doc: LocalDocument;
    content: DocumentExtractionContent;
  };
}

function getQueueStageLabel(stage: QueueStage): string {
  switch (stage) {
    case 'uploading':
      return 'Uploading';
    case 'extracting':
      return 'Extracting';
    case 'saving':
      return 'Saving locally';
    case 'extracted':
      return 'Extracted (Review Ready)';
    case 'failed':
      return 'Failed';
  }
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({
  workspace,
  onSaveDocumentAndContent,
  onUpdateDocumentContent,
  onConfirmInventoryToTopics,
  onDeleteDocument,
  onGoToSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    workspace.subjects[0]?.id ?? ''
  );
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');
  const [notesInput, setNotesInput] = useState('');
  const [enableLocalOcr, setEnableLocalOcr] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [activeReviewDocId, setActiveReviewDocId] = useState<string | null>(null);

  // Permission-gated Online AI modal state
  const [aiModalDocId, setAiModalDocId] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map(workspace.subjects.map((s) => [s.id, s])),
    [workspace.subjects]
  );

  const contentMap = useMemo(
    () => new Map(workspace.documentContents.map((c) => [c.documentId, c])),
    [workspace.documentContents]
  );

  const filteredDocuments = useMemo(() => {
    if (filterSubjectId === 'ALL') return workspace.documents;
    return workspace.documents.filter((d) => d.subjectId === filterSubjectId);
  }, [workspace.documents, filterSubjectId]);

  const activeReviewDoc = activeReviewDocId
    ? workspace.documents.find((d) => d.id === activeReviewDocId) ?? null
    : null;
  const activeReviewResolved = useMemo(() => {
    if (!activeReviewDoc) return null;
    return resolveDocumentReviewContent({
      document: activeReviewDoc,
      contentMap,
      topics: workspace.topics,
      subjects: workspace.subjects,
    });
  }, [activeReviewDoc, contentMap, workspace.topics, workspace.subjects]);
  const activeReviewContent = activeReviewResolved?.content ?? null;

  const aiModalDoc = aiModalDocId
    ? workspace.documents.find((d) => d.id === aiModalDocId) ?? null
    : null;
  const aiModalResolved = useMemo(() => {
    if (!aiModalDoc) return null;
    return resolveDocumentReviewContent({
      document: aiModalDoc,
      contentMap,
      topics: workspace.topics,
      subjects: workspace.subjects,
    });
  }, [aiModalDoc, contentMap, workspace.topics, workspace.subjects]);
  const aiModalContent = aiModalResolved?.content ?? null;

  const updateQueueItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueueItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const newQueueEntries: UploadQueueItem[] = files.map((file) => ({
      id: `q-${crypto.randomUUID().slice(0, 8)}`,
      fileName: file.name,
      fileSize: file.size,
      stage: 'uploading',
      percent: 5,
      message: 'Queued for local upload & extraction...',
    }));

    setQueueItems((prev) => [...newQueueEntries, ...prev]);

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const qItem = newQueueEntries[i];
      const docId = `doc-${crypto.randomUUID().slice(0, 8)}`;

      let extractedBundle: { doc: LocalDocument; content: DocumentExtractionContent } | null = null;

      try {
        if (!isSupportedDocumentFile(file.name)) {
          throw new Error(
            `Unsupported format for "${file.name}". Supported: PDF, DOCX, PPTX, TXT, XLSX, JPG, PNG, WebP.`
          );
        }

        updateQueueItem(qItem.id, {
          stage: 'uploading',
          percent: 8,
          message: `Reading "${file.name}" from disk...`,
        });

        const chosenSubject = subjectMap.get(selectedSubjectId);
        const { content, textPreview } = await runLocalDocumentExtraction({
          documentId: docId,
          file,
          existingSubjects: workspace.subjects,
          selectedSubjectName: chosenSubject?.name ?? 'Auto',
          enableLocalOcr,
          onProgress: (upd) => {
            if (upd.stage === 'reading') {
              updateQueueItem(qItem.id, {
                stage: 'uploading',
                percent: Math.max(8, upd.percent),
                message: upd.message,
              });
              return;
            }
            if (upd.stage === 'done') {
              updateQueueItem(qItem.id, {
                stage: 'saving',
                percent: 90,
                message: 'Saving locally to IndexedDB...',
              });
              return;
            }
            updateQueueItem(qItem.id, {
              stage: 'extracting',
              percent: upd.percent,
              message: upd.message,
            });
          },
        });

        // Match detected subject if student didn't pick one or if subjects exist
        let resolvedSubjectId = selectedSubjectId || workspace.subjects[0]?.id || 'unassigned';
        if (!selectedSubjectId && content.detectedSubject) {
          const matchedSubj = workspace.subjects.find((s) =>
            s.name.toLowerCase().includes(content.detectedSubject.toLowerCase())
          );
          if (matchedSubj) resolvedSubjectId = matchedSubj.id;
        }

        updateQueueItem(qItem.id, {
          stage: 'saving',
          percent: 92,
          message: 'Saving locally & verifying IndexedDB persistence...',
        });

        const dirSave = await fileSystemAdapter.saveFileToLinkedDirectoryIfPermitted(file);
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'file';

        const docRecord: LocalDocument = {
          id: docId,
          subjectId: resolvedSubjectId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          extension: ext,
          storageTarget: dirSave.savedToDirectory ? 'fs-access-folder' : 'indexeddb-local',
          folderLabel: dirSave.savedToDirectory
            ? dirSave.folderLabel
            : 'IndexedDB Local Content + Metadata',
          extractionStatus: 'extracted',
          extractionMethod: content.extractionMethod,
          pageCount: content.pageCount,
          topicCount: content.topicInventory.length,
          confirmedTopicCount: content.topicInventory.filter((t) => t.confirmed).length,
          ocrUsed: content.ocrApplied,
          textPreview,
          notes: notesInput.trim(),
          isDemo: false,
          addedAt: new Date().toISOString(),
        };

        // Keep an intact pending bundle in case storage fails (allows Retry Save without repeating OCR)
        extractedBundle = {
          doc: docRecord,
          content: {
            ...content,
            rawFileBuffer:
              content.rawFileBuffer && !isArrayBufferDetached(content.rawFileBuffer)
                ? cloneBinaryToArrayBuffer(content.rawFileBuffer)
                : content.rawFileBuffer,
          },
        };

        await onSaveDocumentAndContent(docRecord, content);

        updateQueueItem(qItem.id, {
          stage: 'extracted',
          percent: 100,
          message: `Saved & verified ${content.pageCount} page/section(s) and ${content.topicInventory.length} topic(s). Ready for review.`,
          pendingSave: undefined,
          failurePhase: undefined,
          error: undefined,
        });

        if (files.length === 1) {
          setActiveReviewDocId(docId);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Document processing failed.';
        const isStorageFailure = extractedBundle !== null;
        updateQueueItem(qItem.id, {
          stage: 'failed',
          percent: isStorageFailure ? 92 : 0,
          message: isStorageFailure
            ? 'Extraction finished, but local saving failed.'
            : 'Extraction failed.',
          error: message,
          failurePhase: isStorageFailure ? 'storage' : 'extraction',
          pendingSave: extractedBundle ?? undefined,
        });
      }
    }

    setNotesInput('');
  };

  const handleRetrySave = async (queueItemId: string) => {
    const target = queueItems.find((item) => item.id === queueItemId);
    if (!target?.pendingSave) return;

    const { doc, content } = target.pendingSave;
    updateQueueItem(queueItemId, {
      stage: 'saving',
      percent: 94,
      message: 'Retrying local storage save without repeating OCR...',
      error: undefined,
    });

    try {
      const safeRetryContent: DocumentExtractionContent = {
        ...content,
        rawFileBuffer:
          content.rawFileBuffer && !isArrayBufferDetached(content.rawFileBuffer)
            ? cloneBinaryToArrayBuffer(content.rawFileBuffer)
            : content.rawFileBuffer,
      };
      await onSaveDocumentAndContent(doc, safeRetryContent);

      updateQueueItem(queueItemId, {
        stage: 'extracted',
        percent: 100,
        message: `Saved & verified ${content.pageCount} page/section(s) and ${content.topicInventory.length} topic(s). Ready for review.`,
        error: undefined,
        failurePhase: undefined,
        pendingSave: undefined,
      });
      setActiveReviewDocId(doc.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Retry save failed.';
      updateQueueItem(queueItemId, {
        stage: 'failed',
        percent: 92,
        message: 'Local saving failed.',
        error: message,
        failurePhase: 'storage',
      });
    }
  };

  const handleExportDocumentJson = (doc: LocalDocument) => {
    const resolved = resolveDocumentReviewContent({
      document: doc,
      contentMap,
      topics: workspace.topics,
      subjects: workspace.subjects,
    });
    const { rawFileBuffer: _omitBuffer, ...serializable } = resolved.content;
    const payload = JSON.stringify({ document: doc, extraction: serializable }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^.]+$/, '')}-${doc.id}-topics.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmOnlineAiExtraction = async () => {
    if (!aiModalDoc || !aiModalContent) return;
    setAiProcessing(true);
    setAiError(null);

    try {
      const payload = await prepareFilePayloadForAuthorizedAi(aiModalContent);
      const response = await onlineAiClient.extractDocumentWithPermission({
        userConfirmedPermission: true,
        fileName: aiModalDoc.fileName,
        gradeLevel: workspace.profile.gradeLevel,
        extractedText: payload.extractedText,
        imageAttachments: payload.imageAttachments,
      });

      if (!response.success || !response.result) {
        setAiError(response.error ?? 'Online AI extraction failed.');
        return;
      }

      const aiData = response.result;
      const mappedInventory: ExtractedTopicCandidate[] = (aiData.topics ?? []).map((t, idx) => ({
        id: `inv-ai-${idx}-${crypto.randomUUID().slice(0, 6)}`,
        subjectHint: aiData.detectedSubject || aiModalContent.detectedSubject,
        chapter: t.chapter || aiData.detectedChapters?.[0] || 'Module 1',
        lesson: t.lesson || aiData.detectedLessons?.[0] || 'Lesson 1',
        title: t.title || `Topic ${idx + 1}`,
        subtopics: t.subtopics ?? [],
        summary: t.summary ?? '',
        pageRef: t.pageRef || 'Page 1',
        definitions: (t.definitions ?? []).map((d, i) => ({
          id: `ai-def-${idx}-${i}`,
          kind: 'definition',
          term: d.term,
          content: d.term ? `${d.term} — ${d.content}` : d.content,
          pageRef: d.pageRef || t.pageRef || 'Page 1',
        })),
        formulas: (t.formulas ?? []).map((f, i) => ({
          id: `ai-frm-${idx}-${i}`,
          kind: 'formula',
          content: f.content,
          pageRef: f.pageRef || t.pageRef || 'Page 1',
        })),
        examples: (t.examples ?? []).map((ex, i) => ({
          id: `ai-ex-${idx}-${i}`,
          kind: 'example',
          content: ex.content,
          pageRef: ex.pageRef || t.pageRef || 'Page 1',
        })),
        importantConcepts: (t.importantConcepts ?? []).map((c, i) => ({
          id: `ai-con-${idx}-${i}`,
          kind: 'concept',
          content: c.content,
          pageRef: c.pageRef || t.pageRef || 'Page 1',
        })),
        confirmed: true,
        sourceAttribution: 'ai-supplemented',
      }));

      const updatedPages = [...aiModalContent.pages];
      if (aiData.ocrTranscribedText && updatedPages[0]) {
        updatedPages[0] = {
          ...updatedPages[0],
          text: aiData.ocrTranscribedText,
          ocrUsed: true,
        };
      }

      const updatedContent: DocumentExtractionContent = {
        ...aiModalContent,
        detectedSubject: aiData.detectedSubject || aiModalContent.detectedSubject,
        detectedChapters:
          aiData.detectedChapters && aiData.detectedChapters.length > 0
            ? aiData.detectedChapters
            : aiModalContent.detectedChapters,
        detectedLessons:
          aiData.detectedLessons && aiData.detectedLessons.length > 0
            ? aiData.detectedLessons
            : aiModalContent.detectedLessons,
        extractionMethod: 'online-ai-ocr-and-structure',
        ocrApplied: Boolean(aiData.ocrTranscribedText) || aiModalContent.ocrApplied,
        pages: updatedPages,
        fullExtractedText: aiData.ocrTranscribedText || aiModalContent.fullExtractedText,
        topicInventory:
          mappedInventory.length > 0 ? mappedInventory : aiModalContent.topicInventory,
        inventoryStatus: 'pending-review',
        updatedAt: new Date().toISOString(),
      };

      const updatedDoc: LocalDocument = {
        ...aiModalDoc,
        extractionMethod: 'online-ai-ocr-and-structure',
        extractionStatus: 'extracted',
        topicCount: updatedContent.topicInventory.length,
        confirmedTopicCount: updatedContent.topicInventory.filter((t) => t.confirmed).length,
        ocrUsed: updatedContent.ocrApplied,
      };

      await onUpdateDocumentContent(updatedDoc, updatedContent);
      setAiModalDocId(null);
      setActiveReviewDocId(updatedDoc.id);
    } finally {
      setAiProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Local-First Privacy & Folder Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-900">
            <p className="font-semibold">
              Local-First Extraction & OCR (PDF, DOCX, PPTX, TXT, XLSX, JPG, PNG, WebP)
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Documents are parsed and stored locally in IndexedDB by default. No file is sent to
              external AI servers unless you explicitly click &ldquo;Enhance with Online AI&rdquo;
              and confirm permission.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToSettings}
          className="px-3 py-1.5 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          {workspace.storageConfig.directoryName
            ? `Folder: ${workspace.storageConfig.directoryName}`
            : 'Select Local Folder'}
        </button>
      </section>

      {/* Multi-Document Upload Dropzone */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {workspace.subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.code} — {subj.name} ({subj.gradeLevel})
                </option>
              ))}
              {workspace.subjects.length === 0 && (
                <option value="">Auto-detect subject</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Optional File Note
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="e.g. DepEd Quarter 1 SLM or Quiz Notes"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <label className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableLocalOcr}
              onChange={(e) => setEnableLocalOcr(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-xs font-medium text-slate-800">
              Enable local OCR for images & scanned PDFs
            </span>
          </label>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void processFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.txt,.md,.xlsx,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              void processFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 mx-auto mb-3 flex items-center justify-center text-blue-700">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-900">
            Drop multiple study documents here, or select files from your computer
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Supports PDF, DOCX, PPTX, TXT, XLSX, JPG, PNG, and WebP. Preserves page numbers,
            headings, tables, and formulas.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Upload & Extract Documents
          </button>
        </div>

        {/* Live Extraction Progress Queue */}
        {queueItems.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Extraction Progress ({queueItems.length})
              </span>
              <button
                type="button"
                onClick={() => setQueueItems([])}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Clear Queue
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {queueItems.map((item) => (
                <div key={item.id} className="p-3.5 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.stage === 'extracted' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : item.stage === 'failed' ? (
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.fileName}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums shrink-0">
                        {formatBytes(item.fileSize)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-semibold ${
                          item.stage === 'failed'
                            ? 'text-red-700'
                            : item.stage === 'extracted'
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                        }`}
                      >
                        {getQueueStageLabel(item.stage)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {item.stage === 'failed' ? '' : `${item.percent}%`}
                      </span>
                    </div>
                  </div>

                  {item.stage !== 'failed' && (
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          item.stage === 'extracted' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p
                      className={`text-xs ${
                        item.stage === 'failed' ? 'text-red-700' : 'text-slate-600'
                      }`}
                    >
                      {item.error ?? item.message}
                    </p>
                    {item.stage === 'failed' && item.pendingSave && (
                      <button
                        type="button"
                        onClick={() => void handleRetrySave(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Save</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Document Library Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Document & Topic Inventory Library ({filteredDocuments.length})
            </h3>
            <p className="text-xs text-slate-500">
              Click &ldquo;Review Inventory&rdquo; on any document to edit topics, view tables &
              formulas, and sync to your Topic Library.
            </p>
          </div>

          <select
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            aria-label="Filter documents by subject"
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Subjects</option>
            {workspace.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FolderOpen}
              title="No documents in this view"
              description="Upload PDF, DOCX, PPTX, TXT, XLSX, or scanned images above to extract text and build a topic inventory."
            />
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Card Layout (guarantees Review Inventory is visible without horizontal scroll) */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredDocuments.map((doc) => {
                const subj = subjectMap.get(doc.subjectId);
                const content = contentMap.get(doc.id);
                const topicTotal = content?.topicInventory.length ?? doc.topicCount ?? 0;
                const isReviewable =
                  doc.extractionStatus !== 'error' && doc.extractionStatus !== 'saving';

                return (
                  <div key={doc.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-900 break-words">
                            {doc.fileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            <DemoLabel isDemo={doc.isDemo} />
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {content?.pageCount ?? doc.pageCount ?? 1} pg
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatShortDate(doc.addedAt)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {doc.id}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <div>
                        <span className="text-slate-500 block">Subject</span>
                        <span className="font-medium text-slate-800">
                          {subj?.name ?? content?.detectedSubject ?? 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Topic Inventory</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {topicTotal} topic{topicTotal === 1 ? '' : 's'} · {formatBytes(doc.fileSize)}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200 flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">Status:</span>
                        {doc.extractionStatus === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Confirmed & Synced
                          </span>
                        ) : doc.extractionStatus === 'extracted' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            Extracted (Review Ready)
                          </span>
                        ) : doc.extractionStatus === 'error' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-800 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Failed
                          </span>
                        ) : doc.extractionStatus === 'demo-seed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 font-medium">
                            Demo Inventory
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium">{doc.extractionStatus}</span>
                        )}
                        <span className="text-[11px] text-slate-500">Saved Locally</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {isReviewable ? (
                        <button
                          type="button"
                          data-doc-id={doc.id}
                          aria-label={`Review inventory for ${doc.fileName} (${doc.id})`}
                          onClick={() => setActiveReviewDocId(doc.id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Review Inventory</span>
                        </button>
                      ) : (
                        <span className="text-xs text-red-700 font-medium">
                          Unavailable until saved
                        </span>
                      )}

                      <div className="inline-flex items-center gap-1">
                        {isReviewable && (
                          <button
                            type="button"
                            onClick={() => handleExportDocumentJson(doc)}
                            aria-label={`Export ${doc.fileName} JSON (${doc.id})`}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {content && !doc.isDemo && (
                          <button
                            type="button"
                            onClick={() => {
                              setAiError(null);
                              setAiModalDocId(doc.id);
                            }}
                            title="Enhance extraction with Online AI (requires permission)"
                            aria-label={`Enhance ${doc.fileName} with Online AI (${doc.id})`}
                            className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc.id)}
                          aria-label={`Remove ${doc.fileName} (${doc.id})`}
                          className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout with Sticky Right Actions Column */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Source Document</th>
                    <th className="py-3 px-3">Subject</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Topics</th>
                    <th className="py-3 px-3 text-right">Size</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 z-10 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.12)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredDocuments.map((doc) => {
                    const subj = subjectMap.get(doc.subjectId);
                    const content = contentMap.get(doc.id);
                    const topicTotal = content?.topicInventory.length ?? doc.topicCount ?? 0;
                    const isReviewable =
                      doc.extractionStatus !== 'error' && doc.extractionStatus !== 'saving';

                    return (
                      <tr key={doc.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 max-w-[240px]">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate" title={doc.fileName}>
                                {doc.fileName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <DemoLabel isDemo={doc.isDemo} />
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {content?.pageCount ?? doc.pageCount ?? 1} pg
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{formatShortDate(doc.addedAt)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {doc.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                          {subj?.name ?? content?.detectedSubject ?? 'Unassigned'}
                        </td>

                        <td className="py-3.5 px-3 text-xs whitespace-nowrap">
                          {doc.extractionStatus === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Confirmed & Synced
                            </span>
                          ) : doc.extractionStatus === 'extracted' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              Extracted (Review Ready)
                            </span>
                          ) : doc.extractionStatus === 'saving' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 font-medium">
                              Saving locally
                            </span>
                          ) : doc.extractionStatus === 'error' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-800 font-medium">
                              Failed
                            </span>
                          ) : doc.extractionStatus === 'demo-seed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 font-medium">
                              Demo Inventory
                            </span>
                          ) : (
                            <span className="text-slate-600">{doc.extractionStatus}</span>
                          )}
                          <span className="block text-[11px] text-slate-500 mt-1">
                            Saved Locally{doc.ocrUsed ? ' · OCR used' : ''}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-xs font-medium text-slate-800 text-right tabular-nums whitespace-nowrap">
                          {topicTotal} topic{topicTotal === 1 ? '' : 's'}
                        </td>

                        <td className="py-3.5 px-3 text-xs text-slate-600 text-right tabular-nums whitespace-nowrap">
                          {formatBytes(doc.fileSize)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 z-10 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.12)]">
                          <div className="inline-flex items-center gap-1.5">
                            {isReviewable && (
                              <button
                                type="button"
                                data-doc-id={doc.id}
                                aria-label={`Review inventory for ${doc.fileName} (${doc.id})`}
                                onClick={() => setActiveReviewDocId(doc.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Review Inventory</span>
                              </button>
                            )}

                            {isReviewable && (
                              <button
                                type="button"
                                onClick={() => handleExportDocumentJson(doc)}
                                aria-label={`Export ${doc.fileName} JSON (${doc.id})`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}

                            {content && !doc.isDemo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAiError(null);
                                  setAiModalDocId(doc.id);
                                }}
                                title="Enhance extraction with Online AI (requires permission)"
                                aria-label={`Enhance ${doc.fileName} with Online AI (${doc.id})`}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onDeleteDocument(doc.id)}
                              aria-label={`Remove ${doc.fileName} (${doc.id})`}
                              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Topic Inventory Review & Editor Modal (keyed strictly by doc.id so separate uploads never share state) */}
      {activeReviewDoc && activeReviewContent && (
        <DocumentInventoryModal
          key={activeReviewDoc.id}
          document={activeReviewDoc}
          content={activeReviewContent}
          storedContent={contentMap.get(activeReviewDoc.id)}
          linkedTopics={workspace.topics.filter(
            (t) =>
              t.sourceDocumentId === activeReviewDoc.id ||
              t.linkedDocumentIds.includes(activeReviewDoc.id)
          )}
          subjects={workspace.subjects}
          isFallbackPreview={activeReviewResolved?.isFallbackReconstruction}
          fallbackNotice={activeReviewResolved?.fallbackNotice}
          onClose={() => setActiveReviewDocId(null)}
          onUpdateContent={async (updatedContent) => {
            const updatedDoc: LocalDocument = {
              ...activeReviewDoc,
              topicCount: updatedContent.topicInventory.length,
              confirmedTopicCount: updatedContent.topicInventory.filter((t) => t.confirmed)
                .length,
            };
            await onUpdateDocumentContent(updatedDoc, updatedContent);
          }}
          onConfirmAndSyncTopics={onConfirmInventoryToTopics}
          onReprocessFromSource={async ({
            document,
            existingContent,
            sourceFile,
            sourceBuffer,
            onProgress,
          }) =>
            reprocessDocumentInPlace({
              existingDoc: document,
              existingContent,
              sourceFile,
              sourceBuffer,
              existingSubjects: workspace.subjects,
              enableLocalOcr,
              onProgress,
              onSaveDocumentAndContent,
            })
          }
          onReanalyzeStoredPages={async ({ document, storedContent }) =>
            reanalyzeStoredPagesInPlace({
              existingDoc: document,
              storedContent,
              existingSubjects: workspace.subjects,
              onSaveDocumentAndContent,
            })
          }
          onRestoreBackupSnapshot={async ({ previousDoc, previousContent }) => {
            if (previousContent) {
              await onSaveDocumentAndContent(previousDoc, previousContent);
            } else {
              await onUpdateDocumentContent(previousDoc, {
                ...activeReviewContent,
                pages: [],
                topicInventory: [],
                hasLocalFileBlob: false,
                rawFileBuffer: undefined,
              });
            }
          }}
          onRequestOnlineAiEnhance={() => {
            setAiError(null);
            setAiModalDocId(activeReviewDoc.id);
          }}
          onExportDocumentJson={() => handleExportDocumentJson(activeReviewDoc)}
        />
      )}

      {/* Explicit Permission Gate Before Sending Document Content to Online AI */}
      {aiModalDoc && aiModalContent && (
        <AiPermissionModal
          content={aiModalContent}
          isProcessing={aiProcessing}
          error={aiError}
          onCancel={() => {
            setAiModalDocId(null);
            setAiError(null);
          }}
          onConfirm={() => void handleConfirmOnlineAiExtraction()}
        />
      )}
    </div>
  );
};
