import {
  DocumentExtractionContent,
  ExamAttempt,
  LocalAiConfig,
  LocalDocument,
  LocalStorageConfig,
  MockExam,
  Quarter,
  ResearchNote,
  StudentProfile,
  StudyGuide,
  Subject,
  Topic,
  WorkspaceSnapshot,
} from '../../types/domain';
import { desktopBridge } from '../desktop/desktopBridge';
import { base64ToArrayBuffer, StudyWiseBackupBundle } from './backupService';
import {
  assertValidStorableBinary,
  cloneBinaryToArrayBuffer,
  isArrayBufferDetached,
} from './binaryUtils';
import { fileSystemAdapter } from './fileSystemAdapter';
import { idb, StoreName } from './indexedDb';
import {
  createDemoDocumentContents,
  createDemoDocuments,
  createDemoExamAttempts,
  createDemoMockExams,
  createDemoProfile,
  createDemoStorageConfig,
  createDemoStudyGuides,
  createDemoSubjects,
  createDemoTopics,
  SEED_VERSION,
} from './seedData';
import { sqliteDesktopAdapter } from './sqliteDesktopAdapter';

const SEEDED_FLAG_KEY = 'seed_status';
const STORAGE_CONFIG_KEY = 'storage_config';
const LOCAL_AI_CONFIG_KEY = 'local_ai_config';

interface SeedMetaRecord {
  key: string;
  version: string;
  seededAt: string;
}

interface StorageConfigMetaRecord {
  key: string;
  config: LocalStorageConfig;
}

interface LocalAiConfigMetaRecord {
  key: string;
  config: LocalAiConfig;
}

export function createDefaultLocalAiConfig(): LocalAiConfig {
  return {
    enabled: false,
    provider: 'ollama',
    endpointUrl: 'http://127.0.0.1:11434',
    modelName: '',
  };
}

function getActiveStorageAdapter() {
  return desktopBridge.isTauri() ? sqliteDesktopAdapter : idb;
}

function sanitizeDocumentContentForStorage(
  content: DocumentExtractionContent,
  options: { requireValidBinary: boolean; expectedByteLength?: number }
): DocumentExtractionContent {
  const now = new Date().toISOString();

  if (options.requireValidBinary) {
    const validBuffer = assertValidStorableBinary(content.rawFileBuffer, {
      required: true,
      expectedByteLength: options.expectedByteLength,
      label: content.sourceFileName,
    });
    return {
      ...content,
      hasLocalFileBlob: Boolean(validBuffer && validBuffer.byteLength > 0),
      rawFileBuffer: validBuffer,
      updatedAt: now,
    };
  }

  let safeBuffer: ArrayBuffer | undefined;
  let hasBlob = false;
  if (content.rawFileBuffer && !isArrayBufferDetached(content.rawFileBuffer)) {
    safeBuffer = cloneBinaryToArrayBuffer(content.rawFileBuffer);
    hasBlob = safeBuffer.byteLength > 0;
  }

  return {
    ...content,
    hasLocalFileBlob: hasBlob,
    rawFileBuffer: safeBuffer,
    updatedAt: now,
  };
}

async function seedIfUninitialized(): Promise<void> {
  const db = getActiveStorageAdapter();
  const existingSeed = await db.getByKey<SeedMetaRecord>('appMeta', SEEDED_FLAG_KEY);

  if (existingSeed) {
    // Backfill demo documentContents if upgrading from stage 1
    const existingContents = await db.getAll<DocumentExtractionContent>('documentContents');
    if (existingContents.length === 0 && existingSeed.version !== SEED_VERSION) {
      await db.putMany('documentContents', createDemoDocumentContents());
      await db.put<SeedMetaRecord>('appMeta', {
        key: SEEDED_FLAG_KEY,
        version: SEED_VERSION,
        seededAt: new Date().toISOString(),
      });
    }
    return;
  }

  // When launching Tauri SQLite desktop for the first time, check if prior browser IndexedDB records exist
  if (desktopBridge.isTauri()) {
    try {
      const priorSubjects = await idb.getAll<Subject>('subjects');
      if (priorSubjects.length > 0) {
        const stores: StoreName[] = [
          'profile',
          'subjects',
          'documents',
          'documentContents',
          'topics',
          'studyGuides',
          'researchNotes',
          'mockExams',
          'examAttempts',
        ];
        for (const storeName of stores) {
          const items = await idb.getAll<Record<string, unknown>>(storeName);
          if (items.length > 0) {
            await sqliteDesktopAdapter.putMany(storeName, items);
          }
        }
        await sqliteDesktopAdapter.put<SeedMetaRecord>('appMeta', {
          key: SEEDED_FLAG_KEY,
          version: SEED_VERSION,
          seededAt: new Date().toISOString(),
        });
        return;
      }
    } catch {
      // Proceed with clean SQLite seed if IndexedDB is unavailable
    }
  }

  await Promise.all([
    db.put('profile', createDemoProfile()),
    db.putMany('subjects', createDemoSubjects()),
    db.putMany('documents', createDemoDocuments()),
    db.putMany('documentContents', createDemoDocumentContents()),
    db.putMany('topics', createDemoTopics()),
    db.putMany('studyGuides', createDemoStudyGuides()),
    db.putMany('mockExams', createDemoMockExams()),
    db.putMany('examAttempts', createDemoExamAttempts()),
    db.put<StorageConfigMetaRecord>('appMeta', {
      key: STORAGE_CONFIG_KEY,
      config: createDemoStorageConfig(),
    }),
    db.put<SeedMetaRecord>('appMeta', {
      key: SEEDED_FLAG_KEY,
      version: SEED_VERSION,
      seededAt: new Date().toISOString(),
    }),
  ]);
}

export const studyStore = {
  async loadWorkspace(): Promise<WorkspaceSnapshot> {
    await seedIfUninitialized();
    const db = getActiveStorageAdapter();
    const isTauri = desktopBridge.isTauri();

    const [
      profiles,
      subjects,
      documents,
      documentContents,
      topics,
      studyGuides,
      researchNotes,
      mockExams,
      examAttempts,
      storageConfigMeta,
      localAiConfigMeta,
      dirRecord,
      desktopPaths,
    ] = await Promise.all([
      db.getAll<StudentProfile>('profile'),
      db.getAll<Subject>('subjects'),
      db.getAll<LocalDocument>('documents'),
      db.getAll<DocumentExtractionContent>('documentContents'),
      db.getAll<Topic>('topics'),
      db.getAll<StudyGuide>('studyGuides'),
      db.getAll<ResearchNote>('researchNotes'),
      db.getAll<MockExam>('mockExams'),
      db.getAll<ExamAttempt>('examAttempts'),
      db.getByKey<StorageConfigMetaRecord>('appMeta', STORAGE_CONFIG_KEY),
      db.getByKey<LocalAiConfigMetaRecord>('appMeta', LOCAL_AI_CONFIG_KEY),
      fileSystemAdapter.getSavedDirectoryRecord(),
      desktopBridge.getStoragePaths(),
    ]);

    const profile = profiles[0] ?? createDemoProfile();
    const baseConfig = storageConfigMeta?.config ?? createDemoStorageConfig();
    const localAiConfig = localAiConfigMeta?.config ?? createDefaultLocalAiConfig();

    const storageConfig: LocalStorageConfig = {
      ...baseConfig,
      mode: isTauri
        ? 'tauri-local-vault'
        : dirRecord
          ? 'fs-access-directory'
          : 'indexeddb-only',
      directoryName: isTauri
        ? desktopPaths?.documentsVaultDir ?? 'AppData/StudyWiseAI/documents'
        : dirRecord?.directoryName ?? null,
      runtimeTarget: isTauri ? 'tauri-windows-desktop' : 'web-browser',
      databaseEngine: isTauri ? 'sqlite-tauri' : 'indexeddb',
      documentsVaultPath: desktopPaths?.documentsVaultDir ?? null,
    };

    return {
      profile,
      subjects: [...subjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      documents: [...documents].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
      documentContents,
      topics: [...topics].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      studyGuides: [...studyGuides].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      researchNotes: [...researchNotes].sort((a, b) =>
        b.savedOfflineAt.localeCompare(a.savedOfflineAt)
      ),
      mockExams: [...mockExams].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      examAttempts: [...examAttempts].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
      storageConfig,
      localAiConfig,
    };
  },

  async saveProfile(profile: StudentProfile): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('profile', { ...profile, updatedAt: new Date().toISOString() });
  },

  async saveSubject(subject: Subject): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('subjects', { ...subject, updatedAt: new Date().toISOString() });
  },

  async deleteSubject(subjectId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.delete('subjects', subjectId);
  },

  async saveDocument(doc: LocalDocument): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('documents', doc);
  },

  async saveDocumentContent(content: DocumentExtractionContent): Promise<void> {
    const db = getActiveStorageAdapter();
    const safeContent = sanitizeDocumentContentForStorage(content, {
      requireValidBinary: false,
    });

    if (desktopBridge.isTauri() && safeContent.rawFileBuffer && safeContent.rawFileBuffer.byteLength > 0) {
      const vaultRes = await desktopBridge.saveDocumentToVault(
        safeContent.sourceFileName,
        safeContent.rawFileBuffer
      );
      if (vaultRes.saved && vaultRes.localVaultPath) {
        const existingDoc = await db.getByKey<LocalDocument>('documents', safeContent.documentId);
        if (existingDoc) {
          await db.put('documents', {
            ...existingDoc,
            storageTarget: 'tauri-local-vault',
            folderLabel: vaultRes.documentsVaultDir ?? 'Windows Local Vault',
            localVaultPath: vaultRes.localVaultPath,
          });
        }
      }
    }

    await db.put('documentContents', safeContent);
  },

  /**
   * Atomically saves document metadata + extracted content + structured-clone-safe source binary,
   * then reads back both records to verify persistence before reporting success.
   */
  async saveDocumentAndContent(
    doc: LocalDocument,
    content: DocumentExtractionContent
  ): Promise<{ document: LocalDocument; content: DocumentExtractionContent }> {
    if (!doc.id || content.documentId !== doc.id) {
      throw new Error('Document metadata and extracted content IDs do not match.');
    }

    const expectBinary = content.hasLocalFileBlob && doc.fileSize > 0;
    const safeContent = sanitizeDocumentContentForStorage(content, {
      requireValidBinary: expectBinary,
      expectedByteLength: doc.fileSize > 0 ? doc.fileSize : undefined,
    });

    let docToSave: LocalDocument = {
      ...doc,
      extractionStatus: 'extracted',
      extractionError: undefined,
      pageCount: safeContent.pageCount,
      topicCount: safeContent.topicInventory.length,
      confirmedTopicCount: safeContent.topicInventory.filter((t) => t.confirmed).length,
      ocrUsed: safeContent.ocrApplied,
    };

    const db = getActiveStorageAdapter();

    if (desktopBridge.isTauri()) {
      if (safeContent.rawFileBuffer && safeContent.rawFileBuffer.byteLength > 0) {
        const vaultRes = await desktopBridge.saveDocumentToVault(
          safeContent.sourceFileName,
          safeContent.rawFileBuffer
        );
        if (!vaultRes.saved || !vaultRes.localVaultPath) {
          throw new Error(
            vaultRes.error ?? `Failed saving "${doc.fileName}" to local Windows vault.`
          );
        }
        docToSave = {
          ...docToSave,
          storageTarget: 'tauri-local-vault',
          folderLabel: vaultRes.documentsVaultDir ?? 'Windows Local Vault',
          localVaultPath: vaultRes.localVaultPath,
        };
      }
      await sqliteDesktopAdapter.put('documents', docToSave);
      await sqliteDesktopAdapter.put('documentContents', safeContent);
    } else {
      await idb.putDocumentBundle(docToSave, safeContent);
    }

    // Read-back verification: never report "Extracted (Review Ready)" unless persisted & valid
    const [persistedDoc, persistedContent] = await Promise.all([
      db.getByKey<LocalDocument>('documents', docToSave.id),
      db.getByKey<DocumentExtractionContent>('documentContents', docToSave.id),
    ]);

    if (!persistedDoc || !persistedContent) {
      throw new Error(
        `Local storage verification failed for "${doc.fileName}": saved record could not be read back.`
      );
    }

    if (
      persistedContent.pages.length !== safeContent.pages.length ||
      persistedContent.topicInventory.length !== safeContent.topicInventory.length
    ) {
      throw new Error(
        `Local storage verification failed for "${doc.fileName}": extracted pages or topics were incomplete.`
      );
    }

    if (!desktopBridge.isTauri() && expectBinary) {
      const storedBuf = persistedContent.rawFileBuffer;
      if (!storedBuf || isArrayBufferDetached(storedBuf) || storedBuf.byteLength !== docToSave.fileSize) {
        throw new Error(
          `Local binary verification failed for "${doc.fileName}": stored source file buffer is missing, detached, or truncated.`
        );
      }
    }

    return {
      document: persistedDoc,
      content: persistedContent,
    };
  },

  async getDocumentContent(documentId: string): Promise<DocumentExtractionContent | undefined> {
    const db = getActiveStorageAdapter();
    return db.getByKey<DocumentExtractionContent>('documentContents', documentId);
  },

  async deleteDocument(docId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await Promise.all([
      db.delete('documents', docId),
      db.delete('documentContents', docId),
    ]);
  },

  async saveTopic(topic: Topic): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('topics', { ...topic, updatedAt: new Date().toISOString() });
  },

  async confirmDocumentInventoryToTopics(params: {
    document: LocalDocument;
    content: DocumentExtractionContent;
    targetSubjectId: string;
    quarter: Quarter;
  }): Promise<void> {
    const db = getActiveStorageAdapter();
    const { document, content, targetSubjectId, quarter } = params;
    const now = new Date().toISOString();

    const updatedInventory = [...content.topicInventory];
    const topicsToSave: Topic[] = [];

    for (let i = 0; i < updatedInventory.length; i += 1) {
      const candidate = updatedInventory[i];
      if (!candidate.confirmed) continue;

      const topicId = candidate.syncedTopicId ?? `topic-${crypto.randomUUID().slice(0, 8)}`;
      updatedInventory[i] = {
        ...candidate,
        syncedTopicId: topicId,
      };

      topicsToSave.push({
        id: topicId,
        subjectId: targetSubjectId,
        title: candidate.title,
        quarter,
        summary: candidate.summary,
        masteryStatus: 'not-started',
        linkedDocumentIds: [document.id],
        sourceDocumentId: document.id,
        sourceFileName: document.fileName,
        pageRef: candidate.pageRef,
        chapter: candidate.chapter,
        lesson: candidate.lesson,
        subtopics: candidate.subtopics,
        definitions: candidate.definitions,
        formulas: candidate.formulas,
        examples: candidate.examples,
        importantConcepts: candidate.importantConcepts,
        sourceAttribution: candidate.sourceAttribution ?? 'extracted-from-document',
        isDemo: false,
        updatedAt: now,
      });
    }

    if (topicsToSave.length > 0) {
      await db.putMany('topics', topicsToSave);
    }

    const confirmedCount = updatedInventory.filter((t) => t.confirmed).length;

    const safeContentForConfirm = sanitizeDocumentContentForStorage(
      {
        ...content,
        topicInventory: updatedInventory,
        inventoryStatus: 'confirmed',
      },
      { requireValidBinary: false }
    );

    const updatedDocument: LocalDocument = {
      ...document,
      subjectId: targetSubjectId,
      extractionStatus: 'confirmed',
      topicCount: updatedInventory.length,
      confirmedTopicCount: confirmedCount,
    };

    if (desktopBridge.isTauri()) {
      await sqliteDesktopAdapter.put('documentContents', safeContentForConfirm);
      await sqliteDesktopAdapter.put('documents', updatedDocument);
    } else {
      await idb.putDocumentBundle(updatedDocument, safeContentForConfirm);
    }

    const persistedDoc = await db.getByKey<LocalDocument>('documents', document.id);
    if (!persistedDoc || persistedDoc.extractionStatus !== 'confirmed') {
      throw new Error(
        `Could not verify confirmed topic sync for "${document.fileName}" in local storage.`
      );
    }
  },

  async deleteTopic(topicId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.delete('topics', topicId);
  },

  async saveStudyGuide(guide: StudyGuide): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('studyGuides', { ...guide, updatedAt: new Date().toISOString() });
  },

  async deleteStudyGuide(guideId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.delete('studyGuides', guideId);
  },

  async saveResearchNote(note: ResearchNote): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('researchNotes', note);
  },

  async deleteResearchNote(noteId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.delete('researchNotes', noteId);
  },

  async saveLocalAiConfig(config: LocalAiConfig): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put<LocalAiConfigMetaRecord>('appMeta', {
      key: LOCAL_AI_CONFIG_KEY,
      config,
    });
  },

  async saveMockExam(exam: MockExam): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('mockExams', exam);
  },

  async deleteMockExam(examId: string): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.delete('mockExams', examId);
  },

  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put('examAttempts', attempt);
  },

  async saveStorageConfig(config: LocalStorageConfig): Promise<void> {
    const db = getActiveStorageAdapter();
    await db.put<StorageConfigMetaRecord>('appMeta', {
      key: STORAGE_CONFIG_KEY,
      config,
    });
  },

  async restoreFromBackup(
    bundle: StudyWiseBackupBundle,
    mode: 'replace' | 'merge'
  ): Promise<WorkspaceSnapshot> {
    const db = getActiveStorageAdapter();

    if (mode === 'replace') {
      await Promise.all([
        db.clearStore('subjects'),
        db.clearStore('documents'),
        db.clearStore('documentContents'),
        db.clearStore('topics'),
        db.clearStore('studyGuides'),
        db.clearStore('researchNotes'),
        db.clearStore('mockExams'),
        db.clearStore('examAttempts'),
      ]);
    }

    const restoredContents: DocumentExtractionContent[] = [];
    for (const item of bundle.data.documentContents) {
      const { rawFileBase64, ...rest } = item;
      const rawFileBuffer = rawFileBase64 ? base64ToArrayBuffer(rawFileBase64) : undefined;
      if (desktopBridge.isTauri() && rawFileBuffer) {
        await desktopBridge.saveDocumentToVault(rest.sourceFileName, rawFileBuffer);
      }
      restoredContents.push({
        ...rest,
        rawFileBuffer,
      });
    }

    await Promise.all([
      db.put('profile', bundle.data.profile),
      db.putMany('subjects', bundle.data.subjects),
      db.putMany('documents', bundle.data.documents),
      db.putMany('documentContents', restoredContents),
      db.putMany('topics', bundle.data.topics),
      db.putMany('studyGuides', bundle.data.studyGuides),
      db.putMany('researchNotes', bundle.data.researchNotes),
      db.putMany('mockExams', bundle.data.mockExams),
      db.putMany('examAttempts', bundle.data.examAttempts),
      bundle.data.localAiConfig
        ? db.put<LocalAiConfigMetaRecord>('appMeta', {
            key: LOCAL_AI_CONFIG_KEY,
            config: bundle.data.localAiConfig,
          })
        : Promise.resolve(),
      db.put<SeedMetaRecord>('appMeta', {
        key: SEEDED_FLAG_KEY,
        version: SEED_VERSION,
        seededAt: new Date().toISOString(),
      }),
    ]);

    return this.loadWorkspace();
  },

  async resetToDemoData(): Promise<WorkspaceSnapshot> {
    const db = getActiveStorageAdapter();
    await db.clearAll();
    return this.loadWorkspace();
  },

  async clearAllStudyDataKeepProfile(): Promise<WorkspaceSnapshot> {
    const db = getActiveStorageAdapter();
    const existingProfiles = await db.getAll<StudentProfile>('profile');
    const keptProfile = existingProfiles[0] ?? createDemoProfile();

    await Promise.all([
      db.clearStore('subjects'),
      db.clearStore('documents'),
      db.clearStore('documentContents'),
      db.clearStore('topics'),
      db.clearStore('studyGuides'),
      db.clearStore('researchNotes'),
      db.clearStore('mockExams'),
      db.clearStore('examAttempts'),
    ]);

    await db.put('profile', keptProfile);
    await db.put<SeedMetaRecord>('appMeta', {
      key: SEEDED_FLAG_KEY,
      version: SEED_VERSION,
      seededAt: new Date().toISOString(),
    });

    return this.loadWorkspace();
  },
};
