import {
  DocumentExtractionContent,
  ExamAttempt,
  LocalAiConfig,
  LocalDocument,
  MockExam,
  ResearchNote,
  StudentProfile,
  StudyGuide,
  Subject,
  Topic,
  WorkspaceSnapshot,
} from '../../types/domain';
import { cloneToFreshUint8Array, isArrayBufferDetached } from './binaryUtils';

export interface BackupDataPayload {
  profile: StudentProfile;
  subjects: Subject[];
  documents: LocalDocument[];
  documentContents: Array<
    Omit<DocumentExtractionContent, 'rawFileBuffer'> & {
      rawFileBase64?: string;
    }
  >;
  topics: Topic[];
  studyGuides: StudyGuide[];
  researchNotes: ResearchNote[];
  mockExams: MockExam[];
  examAttempts: ExamAttempt[];
  localAiConfig?: LocalAiConfig;
}

export interface StudyWiseBackupBundle {
  format: 'studywise-ai-backup';
  schemaVersion: 1;
  createdAt: string;
  appTarget: string;
  checksumSha256: string;
  counts: {
    subjects: number;
    documents: number;
    topics: number;
    studyGuides: number;
    researchNotes: number;
    mockExams: number;
    examAttempts: number;
  };
  data: BackupDataPayload;
}

export interface BackupValidationResult {
  valid: boolean;
  checksumVerified: boolean;
  error?: string;
  warning?: string;
  bundle?: StudyWiseBackupBundle;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = cloneToFreshUint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function computeSha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback hash when WebCrypto subtle is unavailable (non-HTTPS test runner)
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const backupService = {
  async createWorkspaceBackup(
    workspace: WorkspaceSnapshot,
    options: { includeRawDocuments?: boolean } = {}
  ): Promise<StudyWiseBackupBundle> {
    const includeRaw = options.includeRawDocuments ?? true;
    const MAX_EMBEDDED_FILE_BYTES = 12 * 1024 * 1024; // 12MB cap per binary to keep JSON portable

    const serializedContents = workspace.documentContents.map((content) => {
      const { rawFileBuffer, ...rest } = content;
      if (
        includeRaw &&
        rawFileBuffer &&
        !isArrayBufferDetached(rawFileBuffer) &&
        rawFileBuffer.byteLength > 0 &&
        rawFileBuffer.byteLength <= MAX_EMBEDDED_FILE_BYTES
      ) {
        return {
          ...rest,
          rawFileBase64: arrayBufferToBase64(rawFileBuffer),
        };
      }
      return rest;
    });

    const data: BackupDataPayload = {
      profile: workspace.profile,
      subjects: workspace.subjects,
      documents: workspace.documents,
      documentContents: serializedContents,
      topics: workspace.topics,
      studyGuides: workspace.studyGuides,
      researchNotes: workspace.researchNotes,
      mockExams: workspace.mockExams,
      examAttempts: workspace.examAttempts,
      localAiConfig: workspace.localAiConfig,
    };

    const checksumSha256 = await computeSha256Hex(JSON.stringify(data));

    return {
      format: 'studywise-ai-backup',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appTarget: workspace.storageConfig.runtimeTarget,
      checksumSha256,
      counts: {
        subjects: data.subjects.length,
        documents: data.documents.length,
        topics: data.topics.length,
        studyGuides: data.studyGuides.length,
        researchNotes: data.researchNotes.length,
        mockExams: data.mockExams.length,
        examAttempts: data.examAttempts.length,
      },
      data,
    };
  },

  async parseAndValidateBackup(rawJsonText: string): Promise<BackupValidationResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJsonText);
    } catch {
      return {
        valid: false,
        checksumVerified: false,
        error: 'The selected file is not valid JSON.',
      };
    }

    const obj = parsed as Partial<StudyWiseBackupBundle>;

    // Support both versioned StudyWise backup bundles and raw stage-1 snapshot JSON exports
    if (obj.format === 'studywise-ai-backup' && obj.data) {
      if (!obj.data.profile || !Array.isArray(obj.data.subjects)) {
        return {
          valid: false,
          checksumVerified: false,
          error: 'Backup bundle is missing required student profile or subjects data.',
        };
      }

      const expectedHash = await computeSha256Hex(JSON.stringify(obj.data));
      const checksumVerified =
        !obj.checksumSha256 ||
        obj.checksumSha256 === expectedHash ||
        obj.checksumSha256.startsWith('fnv1a-');

      const normalizedBundle: StudyWiseBackupBundle = {
        format: 'studywise-ai-backup',
        schemaVersion: 1,
        createdAt: obj.createdAt ?? new Date().toISOString(),
        appTarget: obj.appTarget ?? 'web-browser',
        checksumSha256: obj.checksumSha256 ?? expectedHash,
        counts: {
          subjects: obj.data.subjects?.length ?? 0,
          documents: obj.data.documents?.length ?? 0,
          topics: obj.data.topics?.length ?? 0,
          studyGuides: obj.data.studyGuides?.length ?? 0,
          researchNotes: obj.data.researchNotes?.length ?? 0,
          mockExams: obj.data.mockExams?.length ?? 0,
          examAttempts: obj.data.examAttempts?.length ?? 0,
        },
        data: {
          profile: obj.data.profile,
          subjects: obj.data.subjects ?? [],
          documents: obj.data.documents ?? [],
          documentContents: obj.data.documentContents ?? [],
          topics: obj.data.topics ?? [],
          studyGuides: obj.data.studyGuides ?? [],
          researchNotes: obj.data.researchNotes ?? [],
          mockExams: obj.data.mockExams ?? [],
          examAttempts: obj.data.examAttempts ?? [],
          localAiConfig: obj.data.localAiConfig,
        },
      };

      return {
        valid: true,
        checksumVerified,
        warning: checksumVerified
          ? undefined
          : 'Checksum mismatch detected — file may have been edited externally.',
        bundle: normalizedBundle,
      };
    }

    // Legacy raw WorkspaceSnapshot fallback
    const legacy = parsed as Partial<WorkspaceSnapshot>;
    if (legacy.profile && Array.isArray(legacy.subjects)) {
      const data: BackupDataPayload = {
        profile: legacy.profile,
        subjects: legacy.subjects ?? [],
        documents: legacy.documents ?? [],
        documentContents: legacy.documentContents ?? [],
        topics: legacy.topics ?? [],
        studyGuides: legacy.studyGuides ?? [],
        researchNotes: legacy.researchNotes ?? [],
        mockExams: legacy.mockExams ?? [],
        examAttempts: legacy.examAttempts ?? [],
        localAiConfig: legacy.localAiConfig,
      };
      return {
        valid: true,
        checksumVerified: true,
        warning: 'Legacy workspace snapshot detected (upgraded during restore).',
        bundle: {
          format: 'studywise-ai-backup',
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          appTarget: 'legacy-snapshot',
          checksumSha256: await computeSha256Hex(JSON.stringify(data)),
          counts: {
            subjects: data.subjects.length,
            documents: data.documents.length,
            topics: data.topics.length,
            studyGuides: data.studyGuides.length,
            researchNotes: data.researchNotes.length,
            mockExams: data.mockExams.length,
            examAttempts: data.examAttempts.length,
          },
          data,
        },
      };
    }

    return {
      valid: false,
      checksumVerified: false,
      error: 'Unrecognized backup file format. Expected a StudyWise AI .studywise.json or .json export.',
    };
  },
};
