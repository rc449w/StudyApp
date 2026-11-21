import {
  DocumentExtractionContent,
  LocalDocument,
  Subject,
  Topic,
} from '../../types/domain';
import { desktopBridge } from '../desktop/desktopBridge';
import { cloneBinaryToArrayBuffer, cloneToFreshUint8Array, isArrayBufferDetached } from '../storage/binaryUtils';
import { fileSystemAdapter } from '../storage/fileSystemAdapter';
import { studyStore } from '../storage/studyStore';
import {
  ExtractionProgressUpdate,
  runLocalDocumentExtraction,
  runLocalDocumentExtractionFromBuffer,
} from './documentParser';
import { analyzeExtractedDocument } from './topicAnalyzer';

export interface DocumentStorageDiagnostic {
  documentId: string;
  fileName: string;
  hasContentRecord: boolean;
  binaryStatus: 'intact' | 'missing' | 'corrupted';
  binarySource: 'indexeddb' | 'tauri-vault' | 'fs-access-folder' | 'none';
  binaryByteLength: number;
  recordedTopicCount: number;
  actualInventoryCount: number;
  linkedTopicsCount: number;
  storedPageCount: number;
  recordedPageCount: number;
  textPreviewLength: number;
  recoverableBuffer?: ArrayBuffer;
  summary: string;
}

export interface ReprocessVerificationReport {
  documentId: string;
  fileName: string;
  totalPagesExamined: number;
  readablePagesCount: number;
  ocrPagesCount: number;
  ocrPageNumbers: number[];
  unreadablePageNumbers: number[];
  reconstructedTopicsCount: number;
  readBackVerified: boolean;
  verifiedAt: string;
}

export interface ReprocessResult {
  updatedDoc: LocalDocument;
  updatedContent: DocumentExtractionContent;
  report: ReprocessVerificationReport;
  backupSnapshot: {
    previousDoc: LocalDocument;
    previousContent?: DocumentExtractionContent;
  };
}

export function verifyPdfMagicSignature(buffer: ArrayBuffer): boolean {
  if (!buffer || isArrayBufferDetached(buffer) || buffer.byteLength < 8) {
    return false;
  }
  const bytes = cloneToFreshUint8Array(buffer);
  const headerScanLimit = Math.min(1024, bytes.length - 5);
  for (let i = 0; i <= headerScanLimit; i += 1) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

function isBinaryValidForDocument(extension: string, buffer: ArrayBuffer): boolean {
  if (!buffer || isArrayBufferDetached(buffer) || buffer.byteLength === 0) {
    return false;
  }
  if (extension.toLowerCase() === 'pdf') {
    return verifyPdfMagicSignature(buffer);
  }
  return true;
}

export async function inspectDocumentRecoveryState(params: {
  document: LocalDocument;
  storedContent?: DocumentExtractionContent;
  linkedTopics: Topic[];
}): Promise<DocumentStorageDiagnostic> {
  const { document, storedContent, linkedTopics } = params;

  const hasContentRecord = Boolean(storedContent);
  const recordedTopicCount = document.topicCount ?? 0;
  const actualInventoryCount = storedContent?.topicInventory.length ?? 0;
  const storedPageCount = storedContent?.pages.length ?? 0;
  const recordedPageCount = document.pageCount ?? 0;
  const textPreviewLength = document.textPreview?.length ?? 0;

  let binaryStatus: 'intact' | 'missing' | 'corrupted' = 'missing';
  let binarySource: 'indexeddb' | 'tauri-vault' | 'fs-access-folder' | 'none' = 'none';
  let binaryByteLength = 0;
  let recoverableBuffer: ArrayBuffer | undefined;

  // 1. Check IndexedDB stored binary first
  const idbBuf = storedContent?.rawFileBuffer;
  if (idbBuf && !isArrayBufferDetached(idbBuf) && idbBuf.byteLength > 0) {
    if (isBinaryValidForDocument(document.extension, idbBuf)) {
      binaryStatus = 'intact';
      binarySource = 'indexeddb';
      binaryByteLength = idbBuf.byteLength;
      recoverableBuffer = cloneBinaryToArrayBuffer(idbBuf);
    } else {
      binaryStatus = 'corrupted';
      binarySource = 'indexeddb';
      binaryByteLength = idbBuf.byteLength;
    }
  }

  // 2. Check Tauri local vault if missing in IndexedDB
  if (binaryStatus !== 'intact' && document.localVaultPath) {
    const vaultBuf = await desktopBridge.readDocumentFromVault(document.localVaultPath);
    if (vaultBuf && vaultBuf.byteLength > 0) {
      if (isBinaryValidForDocument(document.extension, vaultBuf)) {
        binaryStatus = 'intact';
        binarySource = 'tauri-vault';
        binaryByteLength = vaultBuf.byteLength;
        recoverableBuffer = cloneBinaryToArrayBuffer(vaultBuf);
      } else {
        binaryStatus = 'corrupted';
        binarySource = 'tauri-vault';
        binaryByteLength = vaultBuf.byteLength;
      }
    }
  }

  // 3. Check File System Access linked folder if still missing
  if (binaryStatus !== 'intact') {
    const folderBuf = await fileSystemAdapter.readFileFromLinkedDirectoryIfPermitted(
      document.fileName
    );
    if (folderBuf && folderBuf.byteLength > 0) {
      if (isBinaryValidForDocument(document.extension, folderBuf)) {
        binaryStatus = 'intact';
        binarySource = 'fs-access-folder';
        binaryByteLength = folderBuf.byteLength;
        recoverableBuffer = cloneBinaryToArrayBuffer(folderBuf);
      } else if (binaryStatus === 'missing') {
        binaryStatus = 'corrupted';
        binarySource = 'fs-access-folder';
        binaryByteLength = folderBuf.byteLength;
      }
    }
  }

  let summary = '';
  if (binaryStatus === 'intact') {
    const sourceLabel =
      binarySource === 'indexeddb'
        ? 'local IndexedDB storage'
        : binarySource === 'tauri-vault'
          ? 'Windows desktop vault'
          : 'linked local folder';
    summary = `Original ${document.extension.toUpperCase()} binary verified (${binaryByteLength.toLocaleString()} bytes) in ${sourceLabel}. Ready to reprocess all ${recordedPageCount || storedPageCount || '?'} pages.`;
  } else if (binaryStatus === 'corrupted') {
    summary = `A stored file buffer was found for ${document.fileName}, but its binary header failed integrity verification. Locate the original file on disk to reprocess safely.`;
  } else if (!hasContentRecord) {
    summary = `No documentContents record or original binary exists in local browser storage for ID ${document.id} (metadata recorded ${recordedTopicCount} topics across ${recordedPageCount} page(s), preview has ${textPreviewLength.toLocaleString()} chars). Locate the original file to recover full pages and topics.`;
  } else {
    summary = `Extracted pages are stored (${storedPageCount}), but raw binary blob was not stored locally. Locate the original file to re-run OCR or PDF extraction.`;
  }

  return {
    documentId: document.id,
    fileName: document.fileName,
    hasContentRecord,
    binaryStatus,
    binarySource,
    binaryByteLength,
    recordedTopicCount,
    actualInventoryCount,
    linkedTopicsCount: linkedTopics.length,
    storedPageCount,
    recordedPageCount,
    textPreviewLength,
    recoverableBuffer,
    summary,
  };
}

export async function reprocessDocumentInPlace(params: {
  existingDoc: LocalDocument;
  existingContent?: DocumentExtractionContent;
  sourceFile?: File;
  sourceBuffer?: ArrayBuffer;
  existingSubjects: Subject[];
  enableLocalOcr: boolean;
  onProgress?: (update: ExtractionProgressUpdate) => void;
  onSaveDocumentAndContent: (
    doc: LocalDocument,
    content: DocumentExtractionContent
  ) => Promise<void>;
}): Promise<ReprocessResult> {
  const {
    existingDoc,
    existingContent,
    sourceFile,
    sourceBuffer,
    existingSubjects,
    enableLocalOcr,
    onProgress,
    onSaveDocumentAndContent,
  } = params;

  const backupSnapshot = {
    previousDoc: { ...existingDoc },
    previousContent: existingContent
      ? {
          ...existingContent,
          rawFileBuffer:
            existingContent.rawFileBuffer && !isArrayBufferDetached(existingContent.rawFileBuffer)
              ? cloneBinaryToArrayBuffer(existingContent.rawFileBuffer)
              : undefined,
        }
      : undefined,
  };

  const subjectName =
    existingSubjects.find((s) => s.id === existingDoc.subjectId)?.name ?? 'Auto';

  let extractionOutput;
  let finalFileSize = existingDoc.fileSize;
  let finalMimeType = existingDoc.mimeType;

  if (sourceFile) {
    finalFileSize = sourceFile.size;
    finalMimeType = sourceFile.type || existingDoc.mimeType;
    extractionOutput = await runLocalDocumentExtraction({
      documentId: existingDoc.id,
      file: sourceFile,
      existingSubjects,
      selectedSubjectName: subjectName,
      enableLocalOcr,
      onProgress,
    });
  } else if (sourceBuffer) {
    if (!isBinaryValidForDocument(existingDoc.extension, sourceBuffer)) {
      throw new Error(
        `Stored binary for "${existingDoc.fileName}" is empty or corrupted. Please select the original file manually.`
      );
    }
    finalFileSize = sourceBuffer.byteLength;
    extractionOutput = await runLocalDocumentExtractionFromBuffer({
      documentId: existingDoc.id,
      fileName: existingDoc.fileName,
      mimeType: existingDoc.mimeType,
      buffer: sourceBuffer,
      existingSubjects,
      selectedSubjectName: subjectName,
      enableLocalOcr,
      onProgress,
    });
  } else {
    throw new Error('No readable PDF binary or source file provided for reprocessing.');
  }

  const { content, textPreview } = extractionOutput;

  const updatedDoc: LocalDocument = {
    ...existingDoc,
    fileSize: finalFileSize,
    mimeType: finalMimeType,
    extractionStatus: 'extracted',
    extractionMethod: content.extractionMethod,
    extractionError: undefined,
    pageCount: content.pageCount,
    topicCount: content.topicInventory.length,
    confirmedTopicCount: content.topicInventory.filter((t) => t.confirmed).length,
    ocrUsed: content.ocrApplied,
    textPreview,
  };

  await onSaveDocumentAndContent(updatedDoc, content);

  // Explicit read-back verification from active store
  const persisted = await studyStore.getDocumentContent(existingDoc.id);
  const readBackVerified = Boolean(
    persisted &&
      persisted.pages.length === content.pages.length &&
      persisted.topicInventory.length === content.topicInventory.length &&
      persisted.topicInventory.length === updatedDoc.topicCount
  );

  const unreadablePageNumbers = content.pages
    .filter((p) => p.text.replace(/\s+/g, '').length < 20)
    .map((p) => p.pageNumber);

  const report: ReprocessVerificationReport = {
    documentId: existingDoc.id,
    fileName: existingDoc.fileName,
    totalPagesExamined: content.pageCount,
    readablePagesCount: content.pageCount - unreadablePageNumbers.length,
    ocrPagesCount: content.ocrPageNumbers.length,
    ocrPageNumbers: content.ocrPageNumbers,
    unreadablePageNumbers,
    reconstructedTopicsCount: content.topicInventory.length,
    readBackVerified,
    verifiedAt: new Date().toISOString(),
  };

  return {
    updatedDoc,
    updatedContent: persisted ?? content,
    report,
    backupSnapshot,
  };
}

export async function reanalyzeStoredPagesInPlace(params: {
  existingDoc: LocalDocument;
  storedContent: DocumentExtractionContent;
  existingSubjects: Subject[];
  onSaveDocumentAndContent: (
    doc: LocalDocument,
    content: DocumentExtractionContent
  ) => Promise<void>;
}): Promise<ReprocessResult> {
  const { existingDoc, storedContent, existingSubjects, onSaveDocumentAndContent } = params;

  const backupSnapshot = {
    previousDoc: { ...existingDoc },
    previousContent: {
      ...storedContent,
      rawFileBuffer:
        storedContent.rawFileBuffer && !isArrayBufferDetached(storedContent.rawFileBuffer)
          ? cloneBinaryToArrayBuffer(storedContent.rawFileBuffer)
          : undefined,
    },
  };

  const subjectName =
    existingSubjects.find((s) => s.id === existingDoc.subjectId)?.name ?? 'Auto';

  const analysis = analyzeExtractedDocument({
    fileName: existingDoc.fileName,
    pages: storedContent.pages,
    existingSubjects,
    selectedSubjectName: subjectName,
  });

  const updatedContent: DocumentExtractionContent = {
    ...storedContent,
    detectedSubject: analysis.detectedSubject,
    detectedChapters: analysis.detectedChapters,
    detectedLessons: analysis.detectedLessons,
    topicInventory: analysis.topicInventory,
    inventoryStatus: 'pending-review',
    updatedAt: new Date().toISOString(),
  };

  const updatedDoc: LocalDocument = {
    ...existingDoc,
    extractionStatus: 'extracted',
    pageCount: updatedContent.pageCount,
    topicCount: updatedContent.topicInventory.length,
    confirmedTopicCount: updatedContent.topicInventory.filter((t) => t.confirmed).length,
    ocrUsed: updatedContent.ocrApplied,
  };

  await onSaveDocumentAndContent(updatedDoc, updatedContent);

  const persisted = await studyStore.getDocumentContent(existingDoc.id);
  const readBackVerified = Boolean(
    persisted &&
      persisted.pages.length === updatedContent.pages.length &&
      persisted.topicInventory.length === updatedContent.topicInventory.length
  );

  const unreadablePageNumbers = updatedContent.pages
    .filter((p) => p.text.replace(/\s+/g, '').length < 20)
    .map((p) => p.pageNumber);

  const report: ReprocessVerificationReport = {
    documentId: existingDoc.id,
    fileName: existingDoc.fileName,
    totalPagesExamined: updatedContent.pageCount,
    readablePagesCount: updatedContent.pageCount - unreadablePageNumbers.length,
    ocrPagesCount: updatedContent.ocrPageNumbers.length,
    ocrPageNumbers: updatedContent.ocrPageNumbers,
    unreadablePageNumbers,
    reconstructedTopicsCount: updatedContent.topicInventory.length,
    readBackVerified,
    verifiedAt: new Date().toISOString(),
  };

  return {
    updatedDoc,
    updatedContent: persisted ?? updatedContent,
    report,
    backupSnapshot,
  };
}
