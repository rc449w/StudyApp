import { OnlineAiStatus, ResearchCitation } from '../../types/domain';

export interface BackendHealthResult {
  reachable: boolean;
  status: string;
  timestamp?: string;
  error?: string;
}

export interface AiConnectionTestResult {
  connected: boolean;
  model?: string;
  reply?: string;
  reason?: string;
  message?: string;
  verifiedAt?: string;
}

export interface AiStructuredExtractionPayload {
  detectedSubject?: string;
  detectedChapters?: string[];
  detectedLessons?: string[];
  ocrTranscribedText?: string;
  topics?: {
    chapter?: string;
    lesson?: string;
    title?: string;
    subtopics?: string[];
    summary?: string;
    pageRef?: string;
    definitions?: { term?: string; content: string; pageRef?: string }[];
    formulas?: { content: string; pageRef?: string }[];
    examples?: { content: string; pageRef?: string }[];
    importantConcepts?: { content: string; pageRef?: string }[];
  }[];
}

export interface DiscoveredOnlineTopicPayload {
  title: string;
  chapter: string;
  lesson: string;
  summary: string;
  subtopics: string[];
  definitions: { term?: string; content: string }[];
  formulas: { content: string }[];
  examples: { content: string }[];
  importantConcepts: { content: string }[];
}

export interface DiscoverOnlineTopicsResponse {
  success: boolean;
  model?: string;
  topics?: DiscoveredOnlineTopicPayload[];
  citations?: ResearchCitation[];
  error?: string;
}

export interface AiDocumentExtractionResponse {
  success: boolean;
  model?: string;
  result?: AiStructuredExtractionPayload;
  error?: string;
}

const OFFLINE_UNAVAILABLE_MSG =
  'Online AI service is currently unavailable. Local offline studying, document extraction, mock exam generation, and scoring continue working normally.';

function isDesktopCustomProtocol(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  return (
    proto === 'tauri:' ||
    proto === 'file:' ||
    host === 'tauri.localhost'
  );
}

function apiUrl(path: string): string {
  // In standard web/full-stack mode, always use same-origin Node.js /api/* routes.
  return path;
}

async function safeJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Client-side boundary for optional Online AI Services.
 * Uses same-origin Node.js /api/* routes when served by the StudyWise AI backend,
 * never requires VITE_ environment variables, and fails gracefully so offline features
 * always continue working without a backend.
 */
export const onlineAiClient = {
  async checkHealth(): Promise<BackendHealthResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { reachable: false, status: 'offline', error: 'Device is currently offline.' };
    }
    if (isDesktopCustomProtocol()) {
      return {
        reachable: false,
        status: 'standalone-local',
        error: 'Running standalone desktop mode without an attached online server.',
      };
    }
    try {
      const res = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
      const data = await safeJson<{ status?: string; timestamp?: string }>(res);
      if (!res.ok || !data) {
        return {
          reachable: false,
          status: 'standalone-local',
          error: OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return {
        reachable: true,
        status: data.status ?? 'ok',
        timestamp: data.timestamp,
      };
    } catch {
      return {
        reachable: false,
        status: 'unreachable',
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async getAiServiceStatus(): Promise<OnlineAiStatus | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return null;
    }
    if (isDesktopCustomProtocol()) {
      return null;
    }
    try {
      const res = await fetch(apiUrl('/api/ai/status'), { cache: 'no-store' });
      if (!res.ok) return null;
      return await safeJson<OnlineAiStatus>(res);
    } catch {
      return null;
    }
  },

  async verifyAiConnection(): Promise<AiConnectionTestResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        connected: false,
        reason: 'browser_offline',
        message: 'Your device is offline. Online AI verification requires an internet connection.',
      };
    }
    if (isDesktopCustomProtocol()) {
      return {
        connected: false,
        reason: 'standalone_desktop',
        message: OFFLINE_UNAVAILABLE_MSG,
      };
    }
    try {
      const res = await fetch(apiUrl('/api/ai/verify-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await safeJson<AiConnectionTestResult>(res);
      if (!data) {
        return {
          connected: false,
          reason: 'backend_unavailable',
          message: OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        connected: false,
        reason: 'network_error',
        message: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async extractDocumentWithPermission(params: {
    userConfirmedPermission: boolean;
    fileName: string;
    gradeLevel: string;
    extractedText: string;
    imageAttachments: { mimeType: string; dataBase64: string; label: string }[];
  }): Promise<AiDocumentExtractionResponse> {
    if (!params.userConfirmedPermission) {
      return {
        success: false,
        error: 'Permission not granted. Document remains strictly local.',
      };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error: 'Device is currently offline. Local document extraction & OCR remain available.',
      };
    }
    if (isDesktopCustomProtocol()) {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/ai/extract-document'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeJson<AiDocumentExtractionResponse & { error?: string }>(res);
      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async discoverOpenWebTopics(params: {
    subjectName: string;
    gradeLevel: string;
    quarter: string;
    topicFocus?: string;
    count?: number;
  }): Promise<DiscoverOnlineTopicsResponse> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error: 'Device is offline. Open Web search requires an internet connection.',
      };
    }
    if (isDesktopCustomProtocol()) {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/web/discover-topics'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeJson<DiscoverOnlineTopicsResponse>(res);
      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async discoverOnlineTopics(params: {
    subjectName: string;
    gradeLevel: string;
    quarter: string;
    topicFocus?: string;
    count?: number;
  }): Promise<DiscoverOnlineTopicsResponse> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error: 'Device is offline. Discovering curriculum topics from the internet requires a connection.',
      };
    }
    if (isDesktopCustomProtocol()) {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/ai/discover-online-topics'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeJson<DiscoverOnlineTopicsResponse>(res);
      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async generateMockExamWithPermission(params: {
    userConfirmedPermission: boolean;
    subjectName: string;
    gradeLevel: string;
    quarter: string;
    difficulty: string;
    questionCount: number;
    questionTypes: string[];
    sourceMaterialsText: string;
    useInternetCurriculum?: boolean;
    onlineTopicFocus?: string;
  }): Promise<{
    success: boolean;
    model?: string;
    questions?: Record<string, unknown>[];
    citations?: ResearchCitation[];
    error?: string;
  }> {
    if (!params.userConfirmedPermission) {
      return {
        success: false,
        error: 'Permission not granted. Use local offline mock exam generation.',
      };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error: 'Device is offline. Use local offline mock exam generation.',
      };
    }
    if (isDesktopCustomProtocol()) {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/ai/generate-mock-exam'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeJson<{
        success: boolean;
        model?: string;
        questions?: Record<string, unknown>[];
        citations?: ResearchCitation[];
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },

  async researchTopicOnline(params: {
    query: string;
    subjectName: string;
    gradeLevel: string;
    claimToVerify?: string;
    attachUploadedContext: boolean;
    userConfirmedPermission: boolean;
    uploadedContextExcerpt?: string;
  }): Promise<{
    success: boolean;
    model?: string;
    verificationVerdict?:
      | 'verified'
      | 'partially-supported'
      | 'needs-clarification'
      | 'supplementary-only';
    verificationSummary?: string;
    externalExplanation?: string;
    keyTakeaways?: string[];
    citations?: Array<{
      id: string;
      title: string;
      url: string;
      domain: string;
      sourceTier: 'official-edu-gov' | 'academic-reference' | 'educational-web';
    }>;
    error?: string;
  }> {
    if (params.attachUploadedContext && !params.userConfirmedPermission) {
      return {
        success: false,
        error:
          'Permission required before sending uploaded school document excerpts to external search/AI.',
      };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        error: 'Device is offline. Online web research requires an internet connection.',
      };
    }

    if (isDesktopCustomProtocol()) {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/ai/research-topic'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await safeJson<{
        success: boolean;
        model?: string;
        verificationVerdict?:
          | 'verified'
          | 'partially-supported'
          | 'needs-clarification'
          | 'supplementary-only';
        verificationSummary?: string;
        externalExplanation?: string;
        keyTakeaways?: string[];
        citations?: Array<{
          id: string;
          title: string;
          url: string;
          domain: string;
          sourceTier: 'official-edu-gov' | 'academic-reference' | 'educational-web';
        }>;
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },
};
