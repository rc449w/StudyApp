import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  FileSearch,
  FileText,
  FolderSearch,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DocumentStorageDiagnostic,
  inspectDocumentRecoveryState,
  ReprocessResult,
  ReprocessVerificationReport,
} from '../../services/extraction/documentRecovery';
import { ExtractionProgressUpdate } from '../../services/extraction/documentParser';
import {
  DocumentExtractionContent,
  ExtractedTopicCandidate,
  LocalDocument,
  Quarter,
  Subject,
  Topic,
} from '../../types/domain';

interface DocumentInventoryModalProps {
  document: LocalDocument;
  content: DocumentExtractionContent;
  storedContent?: DocumentExtractionContent;
  linkedTopics: Topic[];
  subjects: Subject[];
  isFallbackPreview?: boolean;
  fallbackNotice?: string;
  onClose: () => void;
  onUpdateContent: (updated: DocumentExtractionContent) => Promise<void>;
  onConfirmAndSyncTopics: (params: {
    document: LocalDocument;
    content: DocumentExtractionContent;
    targetSubjectId: string;
    quarter: Quarter;
  }) => Promise<void>;
  onReprocessFromSource: (params: {
    document: LocalDocument;
    existingContent?: DocumentExtractionContent;
    sourceFile?: File;
    sourceBuffer?: ArrayBuffer;
    onProgress: (update: ExtractionProgressUpdate) => void;
  }) => Promise<ReprocessResult>;
  onReanalyzeStoredPages?: (params: {
    document: LocalDocument;
    storedContent: DocumentExtractionContent;
  }) => Promise<ReprocessResult>;
  onRestoreBackupSnapshot?: (snapshot: {
    previousDoc: LocalDocument;
    previousContent?: DocumentExtractionContent;
  }) => Promise<void>;
  onRequestOnlineAiEnhance: () => void;
  onExportDocumentJson: () => void;
}

export const DocumentInventoryModal: React.FC<DocumentInventoryModalProps> = ({
  document,
  content,
  storedContent,
  linkedTopics,
  subjects,
  isFallbackPreview = false,
  fallbackNotice,
  onClose,
  onUpdateContent,
  onConfirmAndSyncTopics,
  onReprocessFromSource,
  onReanalyzeStoredPages,
  onRestoreBackupSnapshot,
  onRequestOnlineAiEnhance,
  onExportDocumentJson,
}) => {
  const locateFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'pages'>('inventory');
  const [targetSubjectId, setTargetSubjectId] = useState<string>(
    subjects.some((s) => s.id === document.subjectId)
      ? document.subjectId
      : subjects[0]?.id ?? ''
  );
  const [quarter, setQuarter] = useState<Quarter>('Q1');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(
    content.topicInventory[0]?.id ?? null
  );
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [diagnostic, setDiagnostic] = useState<DocumentStorageDiagnostic | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<ExtractionProgressUpdate | null>(null);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [verificationReport, setVerificationReport] = useState<ReprocessVerificationReport | null>(
    null
  );
  const [lastBackupSnapshot, setLastBackupSnapshot] = useState<
    ReprocessResult['backupSnapshot'] | null
  >(null);

  useEffect(() => {
    let active = true;
    void inspectDocumentRecoveryState({
      document,
      storedContent,
      linkedTopics,
    }).then((diag) => {
      if (active) setDiagnostic(diag);
    });
    return () => {
      active = false;
    };
  }, [document, storedContent, linkedTopics]);

  const selectedCount = content.topicInventory.filter((t) => t.confirmed).length;

  const runInPlaceReprocess = async (opts: { sourceFile?: File; sourceBuffer?: ArrayBuffer }) => {
    setReprocessing(true);
    setReprocessError(null);
    setStatusBanner(null);
    setReprocessProgress({
      stage: 'reading',
      percent: 5,
      message: 'Starting full local PDF examination & topic reconstruction...',
    });

    try {
      const result = await onReprocessFromSource({
        document,
        existingContent: storedContent,
        sourceFile: opts.sourceFile,
        sourceBuffer: opts.sourceBuffer,
        onProgress: (upd) => setReprocessProgress(upd),
      });
      setVerificationReport(result.report);
      setLastBackupSnapshot(result.backupSnapshot);
      if (result.updatedContent.topicInventory[0]) {
        setEditingTopicId(result.updatedContent.topicInventory[0].id);
      }
      setStatusBanner(
        `Reprocessed ${result.report.totalPagesExamined} page(s), reconstructed ${result.report.reconstructedTopicsCount} topic(s), and verified storage read-back under ID ${document.id}.`
      );
    } catch (err: unknown) {
      setReprocessError(
        err instanceof Error ? err.message : 'Unable to reprocess document locally.'
      );
    } finally {
      setReprocessing(false);
      setReprocessProgress(null);
    }
  };

  const runStoredPageReanalysis = async () => {
    if (!storedContent || !onReanalyzeStoredPages) return;
    setReprocessing(true);
    setReprocessError(null);
    setStatusBanner(null);
    try {
      const result = await onReanalyzeStoredPages({
        document,
        storedContent,
      });
      setVerificationReport(result.report);
      setLastBackupSnapshot(result.backupSnapshot);
      if (result.updatedContent.topicInventory[0]) {
        setEditingTopicId(result.updatedContent.topicInventory[0].id);
      }
      setStatusBanner(
        `Re-analyzed ${result.report.totalPagesExamined} stored page(s) and reconstructed ${result.report.reconstructedTopicsCount} topic(s) without modifying or inventing content.`
      );
    } catch (err: unknown) {
      setReprocessError(
        err instanceof Error ? err.message : 'Unable to re-analyze stored pages.'
      );
    } finally {
      setReprocessing(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!lastBackupSnapshot || !onRestoreBackupSnapshot) return;
    await onRestoreBackupSnapshot(lastBackupSnapshot);
    setVerificationReport(null);
    setLastBackupSnapshot(null);
    setStatusBanner('Restored previous recovery snapshot for this document.');
  };

  const updateCandidate = async (
    candidateId: string,
    patch: Partial<ExtractedTopicCandidate>
  ) => {
    const nextInventory = content.topicInventory.map((item) =>
      item.id === candidateId ? { ...item, ...patch } : item
    );
    await onUpdateContent({
      ...content,
      topicInventory: nextInventory,
      inventoryStatus: 'pending-review',
    });
  };

  const handleAddBlankCandidate = async () => {
    const newId = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const newCandidate: ExtractedTopicCandidate = {
      id: newId,
      subjectHint: content.detectedSubject,
      chapter: content.detectedChapters[0] ?? 'Chapter 1',
      lesson: content.detectedLessons[0] ?? 'Lesson 1',
      title: 'New Custom Topic',
      subtopics: [],
      summary: '',
      pageRef: 'Page 1',
      definitions: [],
      formulas: [],
      examples: [],
      importantConcepts: [],
      confirmed: true,
      sourceAttribution: 'manual',
    };

    await onUpdateContent({
      ...content,
      topicInventory: [...content.topicInventory, newCandidate],
      inventoryStatus: 'pending-review',
    });
    setEditingTopicId(newId);
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    const nextInventory = content.topicInventory.filter((t) => t.id !== candidateId);
    await onUpdateContent({
      ...content,
      topicInventory: nextInventory,
    });
    if (editingTopicId === candidateId) {
      setEditingTopicId(nextInventory[0]?.id ?? null);
    }
  };

  const allSelected =
    content.topicInventory.length > 0 &&
    content.topicInventory.every((topic) => topic.confirmed);

  const handleToggleSelectAll = async () => {
    if (content.topicInventory.length === 0) return;
    const nextConfirmed = !allSelected;
    await onUpdateContent({
      ...content,
      topicInventory: content.topicInventory.map((topic) => ({
        ...topic,
        confirmed: nextConfirmed,
      })),
      inventoryStatus: 'pending-review',
    });
  };

  const handleConfirmAll = async () => {
    const resolvedSubjectId = subjects.some((s) => s.id === targetSubjectId)
      ? targetSubjectId
      : subjects[0]?.id ?? '';
    if (!resolvedSubjectId) {
      setSyncError('Please create or select a target Subject before syncing topics.');
      return;
    }
    if (selectedCount === 0) {
      setSyncError('Select at least one checked topic before clicking Confirm & Sync.');
      return;
    }
    const targetSubjectName =
      subjects.find((s) => s.id === resolvedSubjectId)?.name ?? 'Selected Subject';
    setSyncing(true);
    setSyncError(null);
    setSyncSuccessMessage(null);
    setStatusBanner(null);
    try {
      await onConfirmAndSyncTopics({
        document,
        content,
        targetSubjectId: resolvedSubjectId,
        quarter,
      });
      const msg = `Synced ${selectedCount} topic${selectedCount === 1 ? '' : 's'} to ${targetSubjectName} (${quarter}) in Topic Library — ready for Study Guides and Mock Exams.`;
      setSyncSuccessMessage(msg);
      setStatusBanner(msg);
    } catch (err: unknown) {
      setSyncError(
        err instanceof Error
          ? `Confirm & Sync failed: ${err.message}`
          : 'Confirm & Sync failed while writing to local storage.'
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-slate-200 rounded-xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-mono uppercase font-semibold text-blue-700">
                {document.extension}
              </span>
              <span aria-hidden="true">·</span>
              <span>{content.pageCount} page/section(s)</span>
              <span aria-hidden="true">·</span>
              <span>Method: {content.extractionMethod}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-400">ID: {document.id}</span>
              {content.ocrApplied && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">
                    OCR Applied ({content.ocrPageNumbers.length} page
                    {content.ocrPageNumbers.length === 1 ? '' : 's'})
                  </span>
                </>
              )}
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 truncate">
              {document.fileName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRequestOnlineAiEnhance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enhance with Online AI</span>
            </button>
            <button
              type="button"
              onClick={onExportDocumentJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document inventory"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar: Tabs + Subject Sync Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Topic Inventory ({content.topicInventory.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pages')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'pages'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Extracted Pages, Tables & Formulas ({content.pages.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Sync target:</span>
            <select
              value={targetSubjectId}
              onChange={(e) => setTargetSubjectId(e.target.value)}
              aria-label="Target subject for confirmed topics"
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[200px]"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as Quarter)}
              aria-label="Target quarter"
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>

            <button
              type="button"
              disabled={syncing || selectedCount === 0}
              onClick={() => void handleConfirmAll()}
              title={
                selectedCount === 0
                  ? 'Check at least 1 topic below before syncing'
                  : 'Confirm selected topics and save them to Topic Library'
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>
                {syncing
                  ? 'Syncing...'
                  : syncSuccessMessage
                    ? `Synced ✓ (${selectedCount})`
                    : `Confirm & Sync (${selectedCount})`}
              </span>
            </button>
          </div>
        </div>

        {syncError && (
          <div
            role="alert"
            className="px-6 py-3 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-900 flex items-center justify-between gap-3"
          >
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-red-700 hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {syncSuccessMessage && (
          <div className="px-6 py-3 bg-emerald-600 text-white text-xs font-semibold flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-white text-emerald-800 hover:bg-emerald-50 rounded-md font-semibold cursor-pointer"
            >
              Done &amp; Close
            </button>
          </div>
        )}

        {/* Storage & Recovery Inspection Panel */}
        {diagnostic && (
          <div
            className={`px-6 py-3 border-b text-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
              diagnostic.binaryStatus === 'intact'
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {diagnostic.binaryStatus === 'intact' ? (
                  <FileSearch className="w-4 h-4 text-blue-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                )}
                <span>
                  Original File Check:{' '}
                  {diagnostic.binaryStatus === 'intact'
                    ? `Intact (${diagnostic.binaryByteLength.toLocaleString()} bytes · ${diagnostic.binarySource})`
                    : diagnostic.binaryStatus === 'corrupted'
                      ? 'Corrupted Binary Header'
                      : 'Not Stored in Local Browser Storage'}
                </span>
                <span className="text-slate-400">|</span>
                <span className="tabular-nums">
                  Stored Pages: {diagnostic.storedPageCount}/{diagnostic.recordedPageCount || content.pageCount}
                </span>
                <span className="text-slate-400">|</span>
                <span className="tabular-nums">
                  Inventory Topics: {content.topicInventory.length} (Previously recorded:{' '}
                  {diagnostic.recordedTopicCount})
                </span>
              </div>
              <p className="leading-relaxed opacity-90">{fallbackNotice ?? diagnostic.summary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={locateFileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) {
                    void runInPlaceReprocess({ sourceFile: chosen });
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />

              {diagnostic.binaryStatus === 'intact' && diagnostic.recoverableBuffer && (
                <button
                  type="button"
                  disabled={reprocessing}
                  onClick={() =>
                    void runInPlaceReprocess({ sourceBuffer: diagnostic.recoverableBuffer })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {reprocessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Reprocess Stored {document.extension.toUpperCase()}</span>
                </button>
              )}

              {diagnostic.binaryStatus !== 'intact' &&
                storedContent &&
                storedContent.pages.some((p) => p.text.trim().length > 0) &&
                onReanalyzeStoredPages && (
                  <button
                    type="button"
                    disabled={reprocessing}
                    onClick={() => void runStoredPageReanalysis()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {reprocessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Re-analyze Extracted Pages</span>
                  </button>
                )}

              <button
                type="button"
                disabled={reprocessing}
                onClick={() => locateFileInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg border disabled:opacity-50 cursor-pointer ${
                  diagnostic.binaryStatus === 'intact'
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-amber-800 hover:bg-amber-900 text-white border-amber-900'
                }`}
              >
                <FolderSearch className="w-3.5 h-3.5" />
                <span>
                  {diagnostic.binaryStatus === 'intact'
                    ? 'Replace / Reprocess File'
                    : 'Locate Original PDF & Reprocess'}
                </span>
              </button>

              {lastBackupSnapshot && onRestoreBackupSnapshot && (
                <button
                  type="button"
                  disabled={reprocessing}
                  onClick={() => void handleRestoreSnapshot()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Prior Backup</span>
                </button>
              )}
            </div>
          </div>
        )}

        {reprocessing && reprocessProgress && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center justify-between gap-3 font-medium">
              <span>{reprocessProgress.message}</span>
              <span className="font-mono tabular-nums">{reprocessProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-150"
                style={{ width: `${reprocessProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {reprocessError && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-xs font-medium text-red-900">
            {reprocessError}
          </div>
        )}

        {verificationReport && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold">
              Verification Report ({verificationReport.fileName}):
            </span>
            <span>Pages examined: {verificationReport.totalPagesExamined}</span>
            <span>Readable pages: {verificationReport.readablePagesCount}</span>
            <span>OCR pages: {verificationReport.ocrPagesCount}</span>
            <span>
              Unreadable/empty pages:{' '}
              {verificationReport.unreadablePageNumbers.length === 0
                ? 'None'
                : verificationReport.unreadablePageNumbers.join(', ')}
            </span>
            <span>Reconstructed topics: {verificationReport.reconstructedTopicsCount}</span>
            <span className="font-semibold">
              Storage Read-Back: {verificationReport.readBackVerified ? 'Verified' : 'Mismatch'}
            </span>
          </div>
        )}

        {!diagnostic && isFallbackPreview && fallbackNotice && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
            {fallbackNotice}
          </div>
        )}

        {statusBanner && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-900">
            {statusBanner}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === 'inventory' ? (
            <div className="space-y-6">
              {/* Detected Document Curriculum Metadata */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 font-medium">Detected Subject</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {content.detectedSubject}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Chapters / Units</p>
                  <p className="text-slate-800 mt-0.5">
                    {content.detectedChapters.join(' · ') || 'None detected'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Lessons</p>
                  <p className="text-slate-800 mt-0.5">
                    {content.detectedLessons.join(' · ') || 'None detected'}
                  </p>
                </div>
              </div>

              {/* Readiness Guardrail for Empty (0/6 fields) Inventories */}
              {content.topicInventory.some((t) => t.confirmed) &&
                content.topicInventory
                  .filter((t) => t.confirmed)
                  .every(
                    (t) =>
                      t.summary.trim().length === 0 &&
                      t.subtopics.length === 0 &&
                      t.definitions.length === 0 &&
                      t.formulas.length === 0 &&
                      t.examples.length === 0 &&
                      t.importantConcepts.length === 0
                  ) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Not ready for Mock Exam generation yet (0/6 content fields extracted)
                      </p>
                      <p className="leading-relaxed">
                        The confirmed topic(s) currently have no extracted summary, definitions,
                        formulas, examples, or concepts. First click{' '}
                        <span className="font-semibold">Re-analyze Extracted Pages</span> above (to
                        extract from the stored pages), or click{' '}
                        <span className="font-semibold">Locate Original PDF &amp; Reprocess</span>{' '}
                        if your PDF contains slide/chart images that need local OCR.
                      </p>
                    </div>
                  </div>
                )}

              {/* Topic Inventory Split View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Topic List */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Extracted Topics (Edit & Confirm)
                    </span>
                    <div className="flex items-center gap-3">
                      {content.topicInventory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleToggleSelectAll()}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleAddBlankCandidate()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Topic</span>
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 max-h-[58vh] overflow-y-auto">
                    {content.topicInventory.map((topic) => {
                      const isActive = editingTopicId === topic.id;
                      const populatedSections = [
                        Boolean(topic.summary.trim()),
                        topic.subtopics.length > 0,
                        topic.definitions.length > 0,
                        topic.formulas.length > 0,
                        topic.examples.length > 0,
                        topic.importantConcepts.length > 0,
                      ].filter(Boolean).length;

                      return (
                        <div
                          key={topic.id}
                          className={`p-4 flex items-start gap-3 transition-colors ${
                            isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            aria-label={`Confirm topic ${topic.title}`}
                            onClick={() =>
                              void updateCandidate(topic.id, { confirmed: !topic.confirmed })
                            }
                            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                              topic.confirmed
                                ? 'bg-emerald-700 border-emerald-700 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTopicId(topic.id)}
                            className="flex-1 text-left min-w-0 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="truncate">
                                {topic.chapter} · {topic.pageRef}
                              </span>
                              {topic.sourceAttribution === 'ai-supplemented' ? (
                                <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-semibold">
                                  AI-Supplemented
                                </span>
                              ) : topic.sourceAttribution === 'manual' ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  Manual
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                                  Extracted
                                </span>
                              )}
                              {topic.uncertainTitle && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                  Verify Heading
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-sm font-semibold mt-0.5 truncate ${
                                isActive ? 'text-blue-900' : 'text-slate-900'
                              }`}
                            >
                              {topic.title}
                            </p>
                            {topic.subtopics.length > 0 && (
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                Subtopics: {topic.subtopics.join(', ')}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-1 tabular-nums flex flex-wrap items-center gap-x-2">
                              <span>
                                {topic.definitions.length} defs · {topic.formulas.length} formulas ·{' '}
                                {topic.examples.length} examples · {topic.importantConcepts.length}{' '}
                                concepts
                              </span>
                              <span
                                className={
                                  populatedSections <= 1
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-emerald-700 font-medium'
                                }
                              >
                                ({populatedSections}/6 fields)
                              </span>
                            </p>
                          </button>
                        </div>
                      );
                    })}
                    {content.topicInventory.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No topics in inventory yet. Click &ldquo;Add Topic&rdquo; or run Online AI
                        extraction.
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Topic Editor */}
                <div className="lg:col-span-7">
                  {(() => {
                    const activeTopic =
                      content.topicInventory.find((t) => t.id === editingTopicId) ??
                      content.topicInventory[0];

                    if (!activeTopic) {
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                          Select a topic from the inventory list to review or edit its details.
                        </div>
                      );
                    }

                    const sectionIndicators = [
                      { label: 'Summary', hasData: activeTopic.summary.trim().length > 0 },
                      { label: `Subtopics (${activeTopic.subtopics.length})`, hasData: activeTopic.subtopics.length > 0 },
                      { label: `Definitions (${activeTopic.definitions.length})`, hasData: activeTopic.definitions.length > 0 },
                      { label: `Formulas (${activeTopic.formulas.length})`, hasData: activeTopic.formulas.length > 0 },
                      { label: `Examples (${activeTopic.examples.length})`, hasData: activeTopic.examples.length > 0 },
                      { label: `Concepts (${activeTopic.importantConcepts.length})`, hasData: activeTopic.importantConcepts.length > 0 },
                    ];

                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <BookOpen className="w-4 h-4 text-blue-700" />
                            <span>
                              Source: <strong>{document.fileName}</strong> ({activeTopic.pageRef})
                            </span>
                            {activeTopic.sourceAttribution === 'ai-supplemented' ? (
                              <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 font-semibold">
                                AI-Supplemented Content
                              </span>
                            ) : activeTopic.sourceAttribution === 'manual' ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                Manual Entry
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">
                                Directly Extracted from PDF
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCandidate(activeTopic.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Topic</span>
                          </button>
                        </div>

                        {/* Visual Section Completeness Bar */}
                        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                          <span className="font-semibold text-slate-600 mr-1">Field Status:</span>
                          {sectionIndicators.map((sec) => (
                            <span
                              key={sec.label}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-medium ${
                                sec.hasData
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  sec.hasData ? 'bg-emerald-600' : 'bg-amber-500'
                                }`}
                              />
                              {sec.label}
                            </span>
                          ))}
                        </div>

                        {activeTopic.uncertainTitle && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Uncertain Heading — Verify Title: </span>
                              <span>
                                {activeTopic.titleReviewReason ??
                                  'This heading may come from low-confidence OCR or a table fragment. Check the source page and edit if needed.'}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Topic Title
                            </label>
                            <input
                              type="text"
                              value={activeTopic.title}
                              onChange={(e) =>
                                void updateCandidate(activeTopic.id, { title: e.target.value })
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Chapter / Module
                              </label>
                              <input
                                type="text"
                                value={activeTopic.chapter}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    chapter: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Lesson
                              </label>
                              <input
                                type="text"
                                value={activeTopic.lesson}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    lesson: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Page / Slide Reference
                              </label>
                              <input
                                type="text"
                                value={activeTopic.pageRef}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    pageRef: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Subtopics (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={activeTopic.subtopics.join(', ')}
                              onChange={(e) =>
                                void updateCandidate(activeTopic.id, {
                                  subtopics: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="e.g. Domain Restrictions, Asymptotes, Intercepts"
                              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Topic Summary
                            </label>
                            <textarea
                              rows={3}
                              value={activeTopic.summary}
                              onChange={(e) =>
                                void updateCandidate(activeTopic.id, { summary: e.target.value })
                              }
                              placeholder="No explanatory summary paragraph was extracted from these pages — verify source page or write your own summary."
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          {/* Extracted Definitions, Formulas, Examples, Concepts */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Definitions ({activeTopic.definitions.length})
                              </label>
                              <textarea
                                rows={3}
                                value={activeTopic.definitions
                                  .map((d) =>
                                    d.term && !d.content.startsWith(d.term)
                                      ? `${d.term}: ${d.content}`
                                      : d.content
                                  )
                                  .join('\n')}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    definitions: e.target.value
                                      .split('\n')
                                      .filter((l) => l.trim())
                                      .map((line, i) => ({
                                        id: `def-ed-${i}`,
                                        kind: 'definition',
                                        content: line,
                                        pageRef: activeTopic.pageRef,
                                      })),
                                  })
                                }
                                placeholder="One definition per line"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Formulas ({activeTopic.formulas.length})
                              </label>
                              <textarea
                                rows={3}
                                value={activeTopic.formulas.map((f) => f.content).join('\n')}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    formulas: e.target.value
                                      .split('\n')
                                      .filter((l) => l.trim())
                                      .map((line, i) => ({
                                        id: `frm-ed-${i}`,
                                        kind: 'formula',
                                        content: line,
                                        pageRef: activeTopic.pageRef,
                                      })),
                                  })
                                }
                                placeholder="One formula per line"
                                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Worked Examples ({activeTopic.examples.length})
                              </label>
                              <textarea
                                rows={5}
                                value={activeTopic.examples.map((ex) => ex.content).join('\n')}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    examples: e.target.value
                                      .split('\n')
                                      .filter((l) => l.trim())
                                      .map((line, i) => ({
                                        id: `ex-ed-${i}`,
                                        kind: 'example',
                                        content: line,
                                        pageRef: activeTopic.pageRef,
                                      })),
                                  })
                                }
                                placeholder="One example (with steps) per line"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Important Concepts ({activeTopic.importantConcepts.length})
                              </label>
                              <textarea
                                rows={3}
                                value={activeTopic.importantConcepts
                                  .map((c) => c.content)
                                  .join('\n')}
                                onChange={(e) =>
                                  void updateCandidate(activeTopic.id, {
                                    importantConcepts: e.target.value
                                      .split('\n')
                                      .filter((l) => l.trim())
                                      .map((line, i) => ({
                                        id: `con-ed-${i}`,
                                        kind: 'concept',
                                        content: line,
                                        pageRef: activeTopic.pageRef,
                                      })),
                                  })
                                }
                                placeholder="One important concept per line"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            /* Page-by-Page Extracted Content, Tables & Formulas */
            <div className="space-y-5">
              {content.pages.map((page) => (
                <section
                  key={page.pageNumber}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-700" />
                      <h3 className="font-display text-sm font-bold text-slate-900">
                        {page.pageLabel}
                      </h3>
                      {page.lowConfidenceOcr && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold">
                          Low OCR Confidence ({page.ocrConfidence ?? 0}%) — Review Needed
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {page.ocrUsed
                        ? `Extracted via OCR${typeof page.ocrConfidence === 'number' ? ` (${page.ocrConfidence}% conf)` : ''}`
                        : 'Extracted Locally'}{' '}
                      · {page.headings.length} heading(s) · {page.tables.length} table(s) ·{' '}
                      {page.formulas.length} formula(s)
                    </span>
                  </div>

                  {page.extractionWarnings && page.extractionWarnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-0.5">
                      {page.extractionWarnings.map((w, wIdx) => (
                        <p key={wIdx}>{w}</p>
                      ))}
                    </div>
                  )}

                  {page.headings.length > 0 && (
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Headings: </span>
                      {page.headings.join(' · ')}
                    </div>
                  )}

                  {page.formulas.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-slate-700">Preserved Formulas</p>
                      <ul className="font-mono text-xs text-slate-800 space-y-0.5">
                        {page.formulas.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {page.tables.map((tbl, tIdx) => (
                    <div key={tIdx} className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            {tbl.headers.map((h, hIdx) => (
                              <th key={hIdx} className="py-2 px-3 border-b border-slate-200 font-semibold">
                                {h || `Column ${hIdx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {tbl.rows.slice(0, 20).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {tbl.headers.map((_, cIdx) => (
                                <td key={cIdx} className="py-1.5 px-3 text-slate-700">
                                  {row[cIdx] ?? ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-72 overflow-y-auto">
                    {page.text || '(No text extracted on this page)'}
                  </pre>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
