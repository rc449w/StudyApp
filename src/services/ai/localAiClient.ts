import { LocalAiConfig, LocalAiRuntimeState } from '../../types/domain';

function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export interface LocalAiStudyReply {
  success: boolean;
  modelUsed: string;
  explanation: string;
  keyTakeaways: string[];
  verificationSummary: string;
  error?: string;
}

export const localAiClient = {
  /**
   * Probes the user-configured local AI runtime (Ollama or OpenAI-compatible).
   * Strictly checks live connectivity and never claims offline AI is available unless reachable.
   */
  async checkConnection(config: LocalAiConfig): Promise<LocalAiRuntimeState> {
    const checkedAt = new Date().toISOString();

    if (!config.enabled) {
      return {
        status: 'disabled',
        connected: false,
        activeModel: null,
        availableModels: [],
        lastCheckedAt: checkedAt,
        message: 'Local AI runtime is disabled. Offline study uses saved materials and rule-based tools.',
      };
    }

    const endpoint = normalizeEndpoint(config.endpointUrl);
    if (!endpoint) {
      return {
        status: 'unreachable',
        connected: false,
        activeModel: null,
        availableModels: [],
        lastCheckedAt: checkedAt,
        message: 'No local AI endpoint URL configured.',
      };
    }

    try {
      if (config.provider === 'ollama') {
        const res = await fetchWithTimeout(`${endpoint}/api/tags`, { cache: 'no-store' }, 2500);
        if (!res.ok) {
          return {
            status: 'unreachable',
            connected: false,
            activeModel: null,
            availableModels: [],
            lastCheckedAt: checkedAt,
            message: `Local Ollama endpoint responded with HTTP ${res.status}.`,
          };
        }
        const data = (await res.json()) as { models?: Array<{ name?: string }> };
        const models = (data.models ?? [])
          .map((m) => m.name ?? '')
          .filter(Boolean);

        if (models.length === 0) {
          return {
            status: 'unreachable',
            connected: false,
            activeModel: null,
            availableModels: [],
            lastCheckedAt: checkedAt,
            message: 'Ollama server reached, but no local models are pulled/installed.',
          };
        }

        const chosenModel =
          config.modelName && models.includes(config.modelName)
            ? config.modelName
            : models[0];

        return {
          status: 'connected',
          connected: true,
          activeModel: chosenModel,
          availableModels: models,
          lastCheckedAt: checkedAt,
          message: `Connected to local Ollama (${chosenModel}).`,
        };
      }

      // OpenAI-compatible runtime (LM Studio, LocalAI, llama.cpp server)
      const modelsUrl = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;
      const res = await fetchWithTimeout(modelsUrl, { cache: 'no-store' }, 2500);
      if (!res.ok) {
        return {
          status: 'unreachable',
          connected: false,
          activeModel: null,
          availableModels: [],
          lastCheckedAt: checkedAt,
          message: `Local OpenAI-compatible runtime returned HTTP ${res.status}.`,
        };
      }
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const models = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
      const chosenModel =
        config.modelName && (models.length === 0 || models.includes(config.modelName))
          ? config.modelName
          : models[0] ?? '';

      if (!chosenModel) {
        return {
          status: 'unreachable',
          connected: false,
          activeModel: null,
          availableModels: [],
          lastCheckedAt: checkedAt,
          message: 'Local server reached, but no active model ID was reported.',
        };
      }

      return {
        status: 'connected',
        connected: true,
        activeModel: chosenModel,
        availableModels: models,
        lastCheckedAt: checkedAt,
        message: `Connected to local model runtime (${chosenModel}).`,
      };
    } catch {
      return {
        status: 'unreachable',
        connected: false,
        activeModel: null,
        availableModels: [],
        lastCheckedAt: checkedAt,
        message:
          'Local AI runtime is not reachable. Start Ollama/LM Studio locally or continue using offline saved materials without AI.',
      };
    }
  },

  async askLocalStudyAssistant(
    config: LocalAiConfig,
    runtimeState: LocalAiRuntimeState,
    params: {
      query: string;
      subjectName: string;
      gradeLevel: string;
      claimToVerify?: string;
      uploadedMaterialSummary?: string | null;
    }
  ): Promise<LocalAiStudyReply> {
    if (!config.enabled || !runtimeState.connected || !runtimeState.activeModel) {
      return {
        success: false,
        modelUsed: 'none',
        explanation: '',
        keyTakeaways: [],
        verificationSummary: '',
        error: 'No connected local AI model is available.',
      };
    }

    const endpoint = normalizeEndpoint(config.endpointUrl);
    const model = runtimeState.activeModel;

    const systemPrompt = [
      'You are an offline Philippine K-12 study assistant running locally on the student device.',
      'Be accurate, concise, and educational. Clearly separate what comes from the provided student notes vs general background knowledge.',
      'Because you are running offline without live internet access, explicitly note when external source verification requires Online Mode.',
      'Return valid JSON with keys: "explanation" (string), "verificationSummary" (string), "keyTakeaways" (string array of 3-4 bullets).',
    ].join(' ');

    const userPrompt = [
      `Subject: ${params.subjectName} (${params.gradeLevel})`,
      `Question / Topic: ${params.query}`,
      params.claimToVerify ? `Claim/Answer to Review: ${params.claimToVerify}` : '',
      params.uploadedMaterialSummary
        ? `Student Local Notes:\n${params.uploadedMaterialSummary}`
        : 'No local document excerpt attached.',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      let rawText = '';

      if (config.provider === 'ollama') {
        const res = await fetchWithTimeout(
          `${endpoint}/api/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              stream: false,
              format: 'json',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          },
          45000
        );
        if (!res.ok) {
          throw new Error(`Local Ollama responded with HTTP ${res.status}`);
        }
        const data = (await res.json()) as { message?: { content?: string } };
        rawText = data.message?.content ?? '';
      } else {
        const chatUrl = endpoint.endsWith('/v1')
          ? `${endpoint}/chat/completions`
          : `${endpoint}/v1/chat/completions`;
        const res = await fetchWithTimeout(
          chatUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          },
          45000
        );
        if (!res.ok) {
          throw new Error(`Local OpenAI-compatible endpoint returned HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        rawText = data.choices?.[0]?.message?.content ?? '';
      }

      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned) as {
          explanation?: string;
          verificationSummary?: string;
          keyTakeaways?: string[];
        };
        return {
          success: true,
          modelUsed: model,
          explanation: parsed.explanation || rawText,
          verificationSummary:
            parsed.verificationSummary ||
            'Generated offline by connected local AI model without live web citations.',
          keyTakeaways: Array.isArray(parsed.keyTakeaways)
            ? parsed.keyTakeaways.slice(0, 5)
            : [],
        };
      } catch {
        return {
          success: true,
          modelUsed: model,
          explanation: rawText,
          verificationSummary:
            'Generated offline by connected local AI model without live web citations.',
          keyTakeaways: [],
        };
      }
    } catch (err: unknown) {
      return {
        success: false,
        modelUsed: model,
        explanation: '',
        keyTakeaways: [],
        verificationSummary: '',
        error:
          err instanceof Error
            ? err.message
            : 'Unable to complete request on local AI model runtime.',
      };
    }
  },
};
