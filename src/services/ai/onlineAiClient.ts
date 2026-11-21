import { OnlineAiStatus, ResearchCitation } from '../../types/domain';

export interface BackendHealthResult {
  reachable: boolean;
  status: string;
  publicAppUrl?: string;
  timestamp?: string;
  error?: string;
}

export interface InternetConnectivityResult {
  internetReachable: boolean;
  backendReachable: boolean;
  mode: 'full-backend' | 'direct-open-web' | 'offline';
  serverUrl: string;
  message: string;
  checkedAt: string;
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

const ONLINE_SERVER_URL_KEY = 'studywise_online_server_url';

const OFFLINE_UNAVAILABLE_MSG =
  'Online AI server is currently unreachable. Open Web (Wikipedia) remains available when connected to the internet, and offline studying works completely locally.';

export function isDesktopCustomProtocol(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  return proto === 'tauri:' || proto === 'file:' || host === 'tauri.localhost';
}

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Server URL must start with https:// or http://');
  }
  const parsed = new URL(trimmed);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`.replace(
    /\/+$/,
    ''
  );
}

export function getOnlineServerUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ONLINE_SERVER_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setOnlineServerUrl(url: string): string {
  const normalized = url.trim() ? normalizeServerUrl(url) : '';
  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        window.localStorage.setItem(ONLINE_SERVER_URL_KEY, normalized);
      } else {
        window.localStorage.removeItem(ONLINE_SERVER_URL_KEY);
      }
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }
  return normalized;
}

function resolveApiUrl(path: string): string | null {
  const configured = getOnlineServerUrl();
  if (configured) {
    return `${configured}${path}`;
  }
  if (isDesktopCustomProtocol()) {
    return null;
  }
  return path;
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
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

async function pingDirectInternet(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    const res = await fetchWithTimeout(
      'https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json&origin=*',
      { cache: 'no-store' },
      4500
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function discoverOpenWebTopicsDirect(params: {
  subjectName: string;
  gradeLevel: string;
  quarter: string;
  topicFocus?: string;
  count?: number;
}): Promise<DiscoverOnlineTopicsResponse> {
  const subjectName = params.subjectName.trim() || 'General Studies';
  const gradeLevel = params.gradeLevel.trim() || 'Grade 8';
  const quarter = params.quarter.trim() || 'Quarter 1';
  const topicFocus = params.topicFocus?.trim() || '';
  const count = Math.min(6, Math.max(2, Number(params.count || 4)));
  const searchQuery = topicFocus || `${subjectName} ${gradeLevel} curriculum`;

  try {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', searchQuery);
    url.searchParams.set('gsrlimit', String(count));
    url.searchParams.set('prop', 'extracts|info');
    url.searchParams.set('exintro', '1');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res = await fetchWithTimeout(url.toString(), { cache: 'no-store' }, 8000);
    if (!res.ok) {
      return {
        success: false,
        error: `Direct Open Web search returned HTTP ${res.status}. Check your device internet connection.`,
      };
    }

    const payload = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            index?: number;
            extract?: string;
            fullurl?: string;
          }
        >;
      };
    };

    const rawPages = Object.values(payload.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 99) - (b.index ?? 99)
    );

    if (rawPages.length === 0) {
      return {
        success: false,
        error: `No Open Web topics matched "${searchQuery}". Try simpler keywords (for example: "Algebra" or "Fake news").`,
      };
    }

    const topics: DiscoveredOnlineTopicPayload[] = rawPages
      .filter((p) => p.title && p.extract && p.extract.trim().length > 20)
      .map((page) => {
        const title = String(page.title).trim();
        const cleanExtract = String(page.extract).replace(/\s+/g, ' ').trim();
        const sentences = cleanExtract
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 20);

        const summary = sentences.slice(0, 3).join(' ') || cleanExtract.slice(0, 420);
        const firstSentence = sentences[0] || summary;
        const concepts = sentences.slice(1, 4).map((s) => ({ content: s }));

        return {
          title,
          chapter: `${quarter} · Open Web Reference`,
          lesson: `${subjectName} (${gradeLevel})`,
          summary,
          subtopics: [topicFocus || subjectName, 'Web Encyclopedia Overview'].filter(Boolean),
          definitions: [{ term: title, content: firstSentence }],
          formulas: [],
          examples: [],
          importantConcepts: concepts,
        };
      });

    const citations: ResearchCitation[] = rawPages
      .filter((p) => p.fullurl && p.title)
      .map((p, idx) => ({
        id: `wiki-${p.pageid ?? idx}-${Date.now().toString(36)}`,
        title: String(p.title).trim(),
        url: String(p.fullurl),
        domain: 'en.wikipedia.org',
        sourceTier: 'academic-reference',
      }));

    return {
      success: true,
      model: 'Open Web Direct (Wikipedia HTTPS)',
      topics,
      citations,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Unable to reach the internet for Open Web search (${err.message}).`
          : 'Unable to reach the internet for Open Web search.',
    };
  }
}

async function researchOpenWebDirect(params: {
  query: string;
  subjectName: string;
  gradeLevel: string;
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
  const discovered = await discoverOpenWebTopicsDirect({
    subjectName: params.subjectName,
    gradeLevel: params.gradeLevel,
    quarter: 'Online Research',
    topicFocus: params.query,
    count: 3,
  });

  if (!discovered.success || !discovered.topics || discovered.topics.length === 0) {
    return {
      success: false,
      error:
        discovered.error ??
        'No live Open Web results matched your query. Connect a StudyWise AI Server URL in Settings for Gemini + Google Search.',
    };
  }

  const primary = discovered.topics[0];
  const secondaryNotes = discovered.topics
    .slice(1)
    .map((t) => `${t.title}: ${t.summary}`)
    .join('\n\n');

  const takeaways = [
    ...primary.importantConcepts.map((c) => c.content),
    ...discovered.topics.slice(1).map((t) => `${t.title} — ${t.definitions[0]?.content ?? t.summary}`),
  ]
    .filter(Boolean)
    .slice(0, 5);

  return {
    success: true,
    model: 'Open Web Direct (Wikipedia HTTPS)',
    verificationVerdict: 'supplementary-only',
    verificationSummary:
      'Retrieved directly from live Wikipedia HTTPS on your device internet connection. Connect a StudyWise AI Server URL in Settings for Gemini + Google Search verification.',
    externalExplanation: [
      `${primary.title}\n${primary.summary}`,
      secondaryNotes ? `Related Open Web References:\n${secondaryNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    keyTakeaways: takeaways,
    citations: (discovered.citations ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      domain: c.domain,
      sourceTier: c.sourceTier,
    })),
  };
}

/**
 * Client-side boundary for Online Internet & AI Services.
 * Supports:
 * 1) Same-origin / configured remote StudyWise AI Node.js server (with CORS for Tauri desktop & Android PWA)
 * 2) Direct client-side HTTPS Open Web (Wikipedia) search when installed standalone on desktop or Android
 */
export const onlineAiClient = {
  getOnlineServerUrl,
  setOnlineServerUrl,

  async checkHealth(): Promise<BackendHealthResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { reachable: false, status: 'offline', error: 'Device is currently offline.' };
    }
    const url = resolveApiUrl('/api/health');
    if (!url) {
      return {
        reachable: false,
        status: 'standalone-local',
        error:
          'No StudyWise AI server URL configured. Direct Open Web (Wikipedia) works over your device internet; add a Server URL in Settings to enable Gemini AI.',
      };
    }
    try {
      const res = await fetchWithTimeout(url, { cache: 'no-store' }, 4500);
      const data = await safeJson<{ status?: string; publicAppUrl?: string; timestamp?: string }>(
        res
      );
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
        publicAppUrl: data.publicAppUrl,
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

  async checkInternetConnectivity(): Promise<InternetConnectivityResult> {
    const checkedAt = new Date().toISOString();
    const serverUrl = getOnlineServerUrl();

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        internetReachable: false,
        backendReachable: false,
        mode: 'offline',
        serverUrl,
        message: 'Your computer or Android device reports no network connection.',
        checkedAt,
      };
    }

    const health = await this.checkHealth();
    if (health.reachable) {
      return {
        internetReachable: true,
        backendReachable: true,
        mode: 'full-backend',
        serverUrl: serverUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
        message: serverUrl
          ? `Connected to internet & remote StudyWise AI server (${serverUrl}).`
          : 'Connected to live internet and StudyWise AI online backend.',
        checkedAt,
      };
    }

    const directOk = await pingDirectInternet();
    if (directOk) {
      return {
        internetReachable: true,
        backendReachable: false,
        mode: 'direct-open-web',
        serverUrl,
        message:
          'Connected to the internet via direct HTTPS (Open Web topic search & research active). Add a StudyWise AI Server URL below if you also want remote Gemini AI.',
        checkedAt,
      };
    }

    return {
      internetReachable: false,
      backendReachable: false,
      mode: 'offline',
      serverUrl,
      message: 'Could not reach external internet endpoints. Offline Study Mode stays active.',
      checkedAt,
    };
  },

  async getAiServiceStatus(): Promise<OnlineAiStatus | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return null;
    }
    const url = resolveApiUrl('/api/ai/status');
    if (!url) {
      return null;
    }
    try {
      const res = await fetchWithTimeout(url, { cache: 'no-store' }, 4500);
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
    const url = resolveApiUrl('/api/ai/verify-connection');
    if (!url) {
      return {
        connected: false,
        reason: 'no_server_url',
        message:
          'No StudyWise AI Server URL is configured for this desktop/installed app. Enter your hosted StudyWise AI server URL above to verify Gemini AI, or use Open Web direct search.',
      };
    }
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        12000
      );
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
    const url = resolveApiUrl('/api/ai/extract-document');
    if (!url) {
      return {
        success: false,
        error:
          'No Online AI Server URL configured. Configure a hosted StudyWise AI Server URL in Settings, or use local offline extraction.',
      };
    }

    try {
      const res = await fetch(url, {
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

    const url = resolveApiUrl('/api/web/discover-topics');
    if (url) {
      try {
        const res = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          },
          8000
        );
        const data = await safeJson<DiscoverOnlineTopicsResponse>(res);
        if (res.ok && data?.success) {
          return data;
        }
      } catch {
        // Fall through to direct client-side HTTPS Wikipedia search
      }
    }

    return discoverOpenWebTopicsDirect(params);
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
        error:
          'Device is offline. Discovering curriculum topics from the internet requires a connection.',
      };
    }
    const url = resolveApiUrl('/api/ai/discover-online-topics');
    if (!url) {
      return {
        success: false,
        error:
          'No StudyWise AI Server URL configured for Gemini Search. Use "Search Open Web (Wikipedia)" right beside it (works directly over your internet), or add your hosted Server URL in Settings.',
      };
    }

    try {
      const res = await fetch(url, {
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
    const url = resolveApiUrl('/api/ai/generate-mock-exam');
    if (!url) {
      return {
        success: false,
        error:
          'No StudyWise AI Server URL configured for Online Gemini Exam Generation. Configure your Server URL in Settings, or use Search Open Web (Wikipedia) + Generate Offline Now.',
      };
    }

    try {
      const res = await fetch(url, {
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

    const url = resolveApiUrl('/api/ai/research-topic');
    if (!url) {
      return researchOpenWebDirect(params);
    }

    try {
      const res = await fetch(url, {
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
        if (res.status === 404 || res.status >= 502) {
          // If backend proxy is unavailable on standalone host, try direct Open Web research
          const fallback = await researchOpenWebDirect(params);
          if (fallback.success) return fallback;
        }
        return {
          success: false,
          error: data?.error ?? OFFLINE_UNAVAILABLE_MSG,
        };
      }
      return data;
    } catch {
      const fallback = await researchOpenWebDirect(params);
      if (fallback.success) return fallback;
      return {
        success: false,
        error: OFFLINE_UNAVAILABLE_MSG,
      };
    }
  },
};
