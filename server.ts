import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getServerAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown, fallbackMsg: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : fallbackMsg;
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API quota is currently exhausted (HTTP 429). Open Google AI Studio → Settings > Secrets to attach a billing-enabled Gemini API key (or wait for your free-tier limit to reset), or use "Search Open Web (Wikipedia)" / "Generate Offline Now".',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message:
        'Online AI permission denied (HTTP 403). Please verify your Gemini API key in Google AI Studio → Settings > Secrets.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('400')) {
    return {
      status: 400,
      message:
        'Invalid Gemini API request or key (HTTP 400). Please check your API key in Google AI Studio → Settings > Secrets.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message:
        'Gemini Online AI is temporarily busy (HTTP 503). Please retry in a few seconds or use Open Web / Local Offline generation.',
    };
  }
  return { status: 502, message: raw || fallbackMsg };
}

async function callGeminiWithRetry(
  fn: () => Promise<GenerateContentResponse>,
  attempts = 2
): Promise<GenerateContentResponse> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('ECONNRESET');
      if (!isTransient || i === attempts - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function callGeminiWithModelFallback(
  runner: (model: string) => Promise<GenerateContentResponse>
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  try {
    const response = await callGeminiWithRetry(() => runner('gemini-4-hydrogen'));
    return { response, modelUsed: 'gemini-4-hydrogen' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      const response = await callGeminiWithRetry(() => runner('gemini-3.1-flash-lite'), 1);
      return { response, modelUsed: 'gemini-3.1-flash-lite' };
    }
    throw err;
  }
}

function extractJsonObjectFromText<T>(rawText: string): T | null {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

interface RankedCitation {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceTier: 'official-edu-gov' | 'academic-reference' | 'educational-web';
}

function extractRankedCitations(response: GenerateContentResponse): RankedCitation[] {
  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seenUrls = new Set<string>();

  const classifyDomain = (
    url: string,
    title: string
  ): { domain: string; tier: 'official-edu-gov' | 'academic-reference' | 'educational-web' } => {
    let domain = 'web-source';
    try {
      domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      domain = title.toLowerCase();
    }
    const combined = `${domain} ${title.toLowerCase()}`;
    if (
      /\.(edu|gov)(\.[a-z]{2})?$/i.test(domain) ||
      /\.(edu|gov)\./i.test(domain) ||
      /\b(deped|ched|unesco|nasa|nih|noaa|nsf|mit|stanford|harvard|upd|dlsu|admu)\b/i.test(
        combined
      )
    ) {
      return { domain, tier: 'official-edu-gov' };
    }
    if (
      /\b(openstax|libretexts|khanacademy|britannica|cambridge|oxford|springer|sciencedirect|nature|jstor|ncbi|pubmed|arxiv|wikipedia|merriam-webster|nationalgeographic|depedtambayan)\b/i.test(
        combined
      )
    ) {
      return { domain, tier: 'academic-reference' };
    }
    return { domain, tier: 'educational-web' };
  };

  const tierRank: Record<'official-edu-gov' | 'academic-reference' | 'educational-web', number> = {
    'official-edu-gov': 0,
    'academic-reference': 1,
    'educational-web': 2,
  };

  return rawChunks
    .map((chunk, idx) => {
      const web = (chunk as { web?: { uri?: string; title?: string } }).web;
      if (!web?.uri || seenUrls.has(web.uri)) return null;
      seenUrls.add(web.uri);
      const { domain, tier } = classifyDomain(web.uri, web.title ?? '');
      return {
        id: `cite-${idx}-${Date.now().toString(36)}`,
        title: web.title?.trim() || domain,
        url: web.uri,
        domain,
        sourceTier: tier,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => tierRank[a.sourceTier] - tierRank[b.sourceTier])
    .slice(0, 8);
}

interface ExtractDocumentRequestBody {
  userConfirmedPermission?: boolean;
  fileName?: string;
  gradeLevel?: string;
  extractedText?: string;
  imageAttachments?: { mimeType: string; dataBase64: string; label: string }[];
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Core service health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'studywise-ai-backend',
      stage: 'stage-4-online-research-offline-engine',
      timestamp: new Date().toISOString(),
    });
  });

  // Online AI service status boundary (never exposes API credentials to client)
  app.get('/api/ai/status', (_req: Request, res: Response) => {
    const apiKeyPresent = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    res.json({
      onlineServiceAvailable: true,
      serverCredentialConfigured: apiKeyPresent,
      sdk: '@google/genai',
      stage: 'stage-4-online-research-offline-engine',
      plannedModel: 'gemini-4-hydrogen',
      implementedCapabilities: [
        'server-health-check',
        'server-side-credential-isolation',
        'permission-gated-ocr-and-topic-extraction',
        'internet-topic-discovery',
        'open-web-wikipedia-topics',
        'permission-gated-mock-exam-generation',
        'search-grounded-educational-research',
      ],
      plannedCapabilities: [],
      note: 'Offline study runs locally. Online Mode connects Gemini with Google Search grounding to access web curriculum topics, verify notes, and generate grounded mock exams.',
    });
  });

  // Optional live server-to-Gemini verification endpoint
  app.post('/api/ai/verify-connection', async (_req: Request, res: Response) => {
    const ai = getServerAiClient();
    if (!ai) {
      res.status(503).json({
        connected: false,
        reason: 'missing_server_credential',
        message:
          'Server GEMINI_API_KEY is not configured in environment secrets. Offline study and local extraction features remain fully operational.',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: 'Reply with a single short sentence confirming StudyWise AI online backend connectivity.',
      });

      res.json({
        connected: true,
        model: 'gemini-4-hydrogen',
        reply: response.text ?? 'Online AI backend responded.',
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to reach Gemini API from server.';
      res.status(502).json({
        connected: false,
        reason: 'upstream_error',
        message,
      });
    }
  });

  // Permission-gated Online AI Vision OCR + Curriculum Topic Structuring
  app.post('/api/ai/extract-document', async (req: Request, res: Response) => {
    const body = req.body as ExtractDocumentRequestBody;

    if (body.userConfirmedPermission !== true) {
      res.status(403).json({
        error: 'Explicit student permission is required before transmitting document content to Online AI.',
      });
      return;
    }

    const ai = getServerAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server GEMINI_API_KEY is not configured. Use local offline extraction and OCR instead.',
      });
      return;
    }

    const fileName = body.fileName ?? 'study-document';
    const gradeLevel = body.gradeLevel ?? 'Grade 7 to 12';
    const extractedText = body.extractedText?.trim() ?? '';
    const imageAttachments = Array.isArray(body.imageAttachments) ? body.imageAttachments : [];

    if (!extractedText && imageAttachments.length === 0) {
      res.status(400).json({
        error: 'No document text or scanned page images were provided for extraction.',
      });
      return;
    }

    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      for (const att of imageAttachments.slice(0, 4)) {
        if (att.dataBase64 && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
      }

      parts.push({
        text: [
          `Analyze the educational document "${fileName}" for a Philippine ${gradeLevel} student.`,
          'Perform OCR on any attached scanned images if present, preserve page references (e.g. "Page 1", "Slide 2"), headings, tables, and math/science formulas.',
          'Identify the subject, chapters/modules, lessons, topics, subtopics, definitions, formulas, examples, and important concepts.',
          extractedText
            ? `Locally extracted text:\n\n${extractedText.slice(0, 30000)}`
            : 'Extract all text from the attached scanned document images first, then structure the topics.',
        ].join('\n\n'),
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are a Philippine K-12 DepEd curriculum parser. Extract accurate academic structure strictly from the provided document content. Never invent facts not grounded in the document.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedSubject: { type: Type.STRING },
              detectedChapters: { type: Type.ARRAY, items: { type: Type.STRING } },
              detectedLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
              ocrTranscribedText: {
                type: Type.STRING,
                description: 'Full OCR transcription if scanned images were supplied, else empty string.',
              },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chapter: { type: Type.STRING },
                    lesson: { type: Type.STRING },
                    title: { type: Type.STRING },
                    subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                    summary: { type: Type.STRING },
                    pageRef: { type: Type.STRING },
                    definitions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          term: { type: Type.STRING },
                          content: { type: Type.STRING },
                          pageRef: { type: Type.STRING },
                        },
                      },
                    },
                    formulas: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          content: { type: Type.STRING },
                          pageRef: { type: Type.STRING },
                        },
                      },
                    },
                    examples: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          content: { type: Type.STRING },
                          pageRef: { type: Type.STRING },
                        },
                      },
                    },
                    importantConcepts: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          content: { type: Type.STRING },
                          pageRef: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        success: true,
        model: 'gemini-4-hydrogen',
        result: parsed,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Online AI document extraction failed.';
      res.status(502).json({ error: message });
    }
  });

  // Explicit later-stage placeholder for Study Guide AI synthesis
  app.post('/api/ai/generate-study-guide', (_req: Request, res: Response) => {
    res.status(501).json({
      implemented: false,
      stage: 'stage-4-planned',
      message:
        'Online AI Study Guide generation is scheduled for the next stage. Use offline manual study guides in the meantime.',
    });
  });

  // Quota-free Open Web educational topic search via Wikipedia public API
  app.post('/api/web/discover-topics', async (req: Request, res: Response) => {
    const body = req.body as {
      subjectName?: string;
      gradeLevel?: string;
      quarter?: string;
      topicFocus?: string;
      count?: number;
    };

    const subjectName = body.subjectName?.trim() || 'General Studies';
    const gradeLevel = body.gradeLevel?.trim() || 'Grade 8';
    const quarter = body.quarter?.trim() || 'Quarter 1';
    const topicFocus = body.topicFocus?.trim() || '';
    const count = Math.min(6, Math.max(2, Number(body.count || 4)));

    const searchQuery = topicFocus || `${subjectName} ${gradeLevel} curriculum`;

    try {
      const apiUrl = new URL('https://en.wikipedia.org/w/api.php');
      apiUrl.searchParams.set('action', 'query');
      apiUrl.searchParams.set('generator', 'search');
      apiUrl.searchParams.set('gsrsearch', searchQuery);
      apiUrl.searchParams.set('gsrlimit', String(count));
      apiUrl.searchParams.set('prop', 'extracts|info');
      apiUrl.searchParams.set('exintro', '1');
      apiUrl.searchParams.set('explaintext', '1');
      apiUrl.searchParams.set('inprop', 'url');
      apiUrl.searchParams.set('format', 'json');

      const wikiRes = await fetch(apiUrl.toString(), {
        headers: {
          'User-Agent': 'StudyWiseAI/1.0 (Philippine High School Study Assistant)',
          Accept: 'application/json',
        },
      });

      if (!wikiRes.ok) {
        res.status(502).json({
          error: `Open Web search returned HTTP ${wikiRes.status}. Check your internet connection or try again.`,
        });
        return;
      }

      const payload = (await wikiRes.json()) as {
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
        res.status(404).json({
          error: `No open encyclopedia topics matched "${searchQuery}". Try simpler keywords (for example: "Fake news" or "Media literacy").`,
        });
        return;
      }

      const topics = rawPages
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
            formulas: [] as { content: string }[],
            examples: [] as { content: string }[],
            importantConcepts: concepts,
          };
        });

      const citations: RankedCitation[] = rawPages
        .filter((p) => p.fullurl && p.title)
        .map((p, idx) => ({
          id: `wiki-${p.pageid ?? idx}-${Date.now().toString(36)}`,
          title: String(p.title).trim(),
          url: String(p.fullurl),
          domain: 'en.wikipedia.org',
          sourceTier: 'academic-reference' as const,
        }));

      res.json({
        success: true,
        sourceProvider: 'wikipedia-open-web',
        model: 'Open Web (Wikipedia)',
        topics,
        citations,
      });
    } catch (err: unknown) {
      res.status(502).json({
        error:
          err instanceof Error
            ? `Open Web search error: ${err.message}`
            : 'Unable to reach Wikipedia open web search.',
      });
    }
  });

  // Online Mode: Search-grounded curriculum topic discovery from the internet (DepEd / Web)
  app.post('/api/ai/discover-online-topics', async (req: Request, res: Response) => {
    const body = req.body as {
      subjectName?: string;
      gradeLevel?: string;
      quarter?: string;
      topicFocus?: string;
      count?: number;
    };

    const subjectName = body.subjectName?.trim();
    if (!subjectName) {
      res.status(400).json({ error: 'Subject name is required to discover curriculum topics.' });
      return;
    }

    const ai = getServerAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server GEMINI_API_KEY is not configured. Add local topics manually, use Open Web (Wikipedia), or upload documents for offline study.',
      });
      return;
    }

    const gradeLevel = body.gradeLevel?.trim() || 'Grade 8';
    const quarter = body.quarter?.trim() || 'Quarter 1';
    const topicFocus = body.topicFocus?.trim() || '';
    const count = Math.min(8, Math.max(2, Number(body.count || 5)));

    try {
      const prompt = [
        `Search authoritative educational websites (Philippine DepEd K-12 / MATATAG Curriculum Guides, DepEd Tambayan, .edu, .gov, OpenStax, Khan Academy, Britannica) for ${count} key academic topics for:`,
        `Subject: ${subjectName}`,
        `Grade Level: ${gradeLevel}`,
        `Grading Period: ${quarter}`,
        topicFocus ? `Specific Topic Focus / Keywords: ${topicFocus}` : '',
        'Return ONLY a raw JSON object (no markdown fences or commentary outside JSON) with shape:',
        '{',
        '  "topics": [',
        '    {',
        '      "title": "Exact Curriculum Topic Title",',
        '      "chapter": "Module or Unit Name",',
        '      "lesson": "Lesson Name or Competency Code",',
        '      "summary": "Clear 2-3 sentence academic explanation of the topic.",',
        '      "subtopics": ["Subtopic 1", "Subtopic 2"],',
        '      "definitions": [{"term": "Key Term", "content": "Key Term: Clear definition"}],',
        '      "formulas": [{"content": "Formula or grammatical/scientific rule if applicable"}],',
        '      "examples": [{"content": "Concrete worked example or sample sentence/problem"}],',
        '      "importantConcepts": [{"content": "Key takeaway or exam rule to remember"}]',
        '    }',
        '  ]',
        '}',
      ]
        .filter(Boolean)
        .join('\n');

      const { response, modelUsed } = await callGeminiWithModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You are a Philippine K-12 DepEd and academic curriculum researcher. Use Google Search grounding to retrieve real, accurate curriculum topics, definitions, rules/formulas, and examples. Return strictly valid JSON with a "topics" array.',
            tools: [{ googleSearch: {} }],
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      const parsed = extractJsonObjectFromText<{
        topics?: Array<{
          title?: string;
          chapter?: string;
          lesson?: string;
          summary?: string;
          subtopics?: unknown[];
          definitions?: Array<{ term?: string; content?: string }>;
          formulas?: Array<{ content?: string }>;
          examples?: Array<{ content?: string }>;
          importantConcepts?: Array<{ content?: string }>;
        }>;
      }>(rawText);

      const topics = (parsed?.topics ?? [])
        .filter((t) => t && typeof t.title === 'string' && t.title.trim().length > 0)
        .map((t) => ({
          title: String(t.title).trim(),
          chapter: String(t.chapter ?? `${quarter} Curriculum`).trim(),
          lesson: String(t.lesson ?? subjectName).trim(),
          summary:
            String(t.summary ?? '').trim() ||
            `${subjectName} (${gradeLevel} · ${quarter}) curriculum topic grounded from online educational sources.`,
          subtopics: Array.isArray(t.subtopics)
            ? t.subtopics.map((s) => String(s).trim()).filter(Boolean)
            : [],
          definitions: Array.isArray(t.definitions)
            ? t.definitions
                .map((d) => ({
                  term: d.term ? String(d.term).trim() : undefined,
                  content: String(d.content ?? '').trim(),
                }))
                .filter((d) => d.content.length > 0)
            : [],
          formulas: Array.isArray(t.formulas)
            ? t.formulas
                .map((f) => ({ content: String(f.content ?? '').trim() }))
                .filter((f) => f.content.length > 0)
            : [],
          examples: Array.isArray(t.examples)
            ? t.examples
                .map((e) => ({ content: String(e.content ?? '').trim() }))
                .filter((e) => e.content.length > 0)
            : [],
          importantConcepts: Array.isArray(t.importantConcepts)
            ? t.importantConcepts
                .map((c) => ({ content: String(c.content ?? '').trim() }))
                .filter((c) => c.content.length > 0)
            : [],
        }));

      if (topics.length === 0) {
        res.status(502).json({
          error:
            'Gemini searched the web but did not return structured curriculum topics. Try adding specific keywords in Topic Focus and retry.',
        });
        return;
      }

      const citations = extractRankedCitations(response);

      res.json({
        success: true,
        model: modelUsed,
        topics,
        citations,
      });
    } catch (err: unknown) {
      const mapped = formatGeminiError(err, 'Online topic discovery failed.');
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Permission-gated Online AI Mock Examination Generator (with Google Search grounding option/fallback)
  app.post('/api/ai/generate-mock-exam', async (req: Request, res: Response) => {
    const body = req.body as {
      userConfirmedPermission?: boolean;
      subjectName?: string;
      gradeLevel?: string;
      quarter?: string;
      difficulty?: string;
      questionCount?: number;
      questionTypes?: string[];
      sourceMaterialsText?: string;
      useInternetCurriculum?: boolean;
      onlineTopicFocus?: string;
    };

    if (body.userConfirmedPermission !== true) {
      res.status(403).json({
        error:
          'Explicit student permission is required before transmitting study materials to Online AI.',
      });
      return;
    }

    const ai = getServerAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server GEMINI_API_KEY is not configured. Use the Local Offline Exam Generator instead.',
      });
      return;
    }

    const sourceMaterialsText = body.sourceMaterialsText?.trim() ?? '';
    const useGoogleSearch = Boolean(body.useInternetCurriculum || !sourceMaterialsText);
    const subjectName = body.subjectName?.trim() || 'General';
    const gradeLevel = body.gradeLevel?.trim() || 'Grade 8';
    const quarter = body.quarter?.trim() || 'Quarter 1';
    const onlineTopicFocus = body.onlineTopicFocus?.trim() || '';

    const questionCount = Math.min(30, Math.max(1, Number(body.questionCount || 5)));
    const requestedTypes =
      Array.isArray(body.questionTypes) && body.questionTypes.length > 0
        ? body.questionTypes
        : ['multiple-choice'];

    try {
      const commonRules = [
        `Generate a ${body.difficulty ?? 'medium'} difficulty mock examination with exactly ${questionCount} questions.`,
        `Subject: ${subjectName} | Grade Level: ${gradeLevel} | Period: ${quarter}.`,
        onlineTopicFocus ? `Topic Focus / Keywords: ${onlineTopicFocus}.` : '',
        `Distribute questions across ONLY these requested question types: ${requestedTypes.join(', ')}.`,
        'STRICT RULES:',
        useGoogleSearch && !sourceMaterialsText
          ? `1. Search the internet (DepEd K-12 / MATATAG Curriculum, .edu, .gov, OpenStax, Khan Academy) for authentic ${subjectName} ${gradeLevel} ${quarter} curriculum topics and build questions grounded in those verified web resources. Set sourceReference to the curriculum topic & source site name (e.g., "DepEd ${gradeLevel} ${subjectName} · ${quarter}").`
          : useGoogleSearch
            ? `1. Prioritize the Confirmed Student Source Materials below AND supplement with Google Search-verified ${subjectName} ${gradeLevel} ${quarter} curriculum concepts where helpful. Set sourceReference accurately.`
            : '1. Ground every question strictly in the student source materials below and set sourceReference to the exact file/page reference from the materials.',
        '2. Every question MUST include non-empty "expectedAnswer" (even for multiple-choice, where expectedAnswer equals the exact text of choices[correctIndex]) AND 3 progressive indirect hints: "hints": {"level1": "...", "level2": "...", "level3": "..."}.',
        '3. NEVER reveal the correct answer in any hint. For math, hints may suggest the formula/operation but MUST NOT solve or give the final result. For multiple-choice, hints MUST NOT identify the option letter or quote the correct choice.',
        '4. For multiple-choice, ALWAYS include 4 distinct choices in "choices", zero-based "correctIndex" (0-3), and matching "expectedAnswer". For true-false, "choices" MUST be ["True", "False"], "expectedAnswer" MUST be "True" or "False", and "correctIndex" MUST be 0 or 1. For matching, include 3 objects in "matchingPairs" with {"id", "prompt", "match"}. For reading-comprehension or situational-analysis, include a short "passage".',
        '5. Always include clear "explanation", "commonMistakes", and "topicTitle".',
        sourceMaterialsText
          ? `\nConfirmed Student Source Materials:\n${sourceMaterialsText.slice(0, 26000)}`
          : '',
      ].filter(Boolean);

      let response: GenerateContentResponse;
      let modelUsed = 'gemini-4-hydrogen';

      if (useGoogleSearch) {
        const prompt = [
          ...commonRules,
          '\nReturn ONLY a raw JSON object (no markdown outside JSON) with shape: { "questions": [ { "type", "prompt", "passage", "choices", "correctIndex", "matchingPairs", "expectedAnswer", "acceptableKeywords", "points", "hints": {"level1", "level2", "level3"}, "explanation", "commonMistakes", "sourceReference", "topicTitle" } ] }.',
        ].join('\n');

        const result = await callGeminiWithModelFallback((model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are a Philippine K-12 DepEd assessment designer. Use Google Search grounding to retrieve accurate curriculum topics when requested, and output strictly valid JSON containing well-formed questions with non-leaking 3-level progressive hints.',
              tools: [{ googleSearch: {} }],
            },
          })
        );
        response = result.response;
        modelUsed = result.modelUsed;
      } else {
        const result = await callGeminiWithModelFallback((model) =>
          ai.models.generateContent({
            model,
            contents: commonRules.join('\n'),
            config: {
              systemInstruction:
                'You are a Philippine K-12 DepEd assessment designer. Create accurate questions strictly grounded in the student source materials with non-leaking 3-level progressive hints.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                        passage: { type: Type.STRING },
                        choices: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.INTEGER },
                        matchingPairs: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              prompt: { type: Type.STRING },
                              match: { type: Type.STRING },
                            },
                          },
                        },
                        expectedAnswer: { type: Type.STRING },
                        acceptableKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        points: { type: Type.INTEGER },
                        hints: {
                          type: Type.OBJECT,
                          properties: {
                            level1: { type: Type.STRING },
                            level2: { type: Type.STRING },
                            level3: { type: Type.STRING },
                          },
                        },
                        explanation: { type: Type.STRING },
                        commonMistakes: { type: Type.STRING },
                        sourceReference: { type: Type.STRING },
                        topicTitle: { type: Type.STRING },
                      },
                    },
                  },
                },
              },
            },
          })
        );
        response = result.response;
        modelUsed = result.modelUsed;
      }

      const rawText = (response.text ?? '').trim();
      const parsed =
        extractJsonObjectFromText<{ questions?: Array<Record<string, unknown>> }>(rawText) ?? {};
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

      // Normalize server-side so choice-based / TF / open-ended fields are always aligned
      const normalizedQuestions = rawQuestions.map((q, idx) => {
        const qType = String(q.type || requestedTypes[idx % requestedTypes.length]).trim();
        const rawChoices = Array.isArray(q.choices)
          ? q.choices.map((c) => String(c).trim()).filter(Boolean)
          : undefined;
        let expectedAnswer = String(q.expectedAnswer ?? '').trim();
        let correctIndex =
          typeof q.correctIndex === 'number' && Number.isFinite(q.correctIndex)
            ? Math.trunc(q.correctIndex)
            : undefined;

        if (qType === 'true-false') {
          const isFalse =
            expectedAnswer.toLowerCase() === 'false' ||
            expectedAnswer.toLowerCase() === 'f' ||
            (expectedAnswer === '' && correctIndex === 1);
          expectedAnswer = isFalse ? 'False' : 'True';
          correctIndex = isFalse ? 1 : 0;
        } else if (
          (qType === 'multiple-choice' || qType === 'reading-comprehension') &&
          rawChoices &&
          rawChoices.length >= 2
        ) {
          if (
            (correctIndex === undefined || correctIndex < 0 || correctIndex >= rawChoices.length) &&
            expectedAnswer
          ) {
            const matchIdx = rawChoices.findIndex(
              (c) => c.toLowerCase() === expectedAnswer.toLowerCase()
            );
            if (matchIdx >= 0) {
              correctIndex = matchIdx;
            } else if (/^[A-D]$/i.test(expectedAnswer)) {
              const letterIdx = expectedAnswer.toUpperCase().charCodeAt(0) - 65;
              if (letterIdx >= 0 && letterIdx < rawChoices.length) {
                correctIndex = letterIdx;
              }
            }
          }
          if (correctIndex === undefined || correctIndex < 0 || correctIndex >= rawChoices.length) {
            correctIndex = 0;
          }
          if (!expectedAnswer) {
            expectedAnswer = rawChoices[correctIndex] ?? '';
          }
        }

        const rawHints =
          typeof q.hints === 'object' && q.hints !== null
            ? (q.hints as Record<string, unknown>)
            : {};

        return {
          ...q,
          type: qType,
          choices: qType === 'true-false' ? ['True', 'False'] : rawChoices,
          correctIndex,
          expectedAnswer,
          hints: {
            level1: String(rawHints.level1 ?? '').trim(),
            level2: String(rawHints.level2 ?? '').trim(),
            level3: String(rawHints.level3 ?? '').trim(),
          },
          sourceReference:
            String(q.sourceReference ?? '').trim() ||
            (useGoogleSearch
              ? `Online Curriculum · ${subjectName} (${gradeLevel} · ${quarter})`
              : `${subjectName} Study Materials`),
        };
      });

      const citations = useGoogleSearch ? extractRankedCitations(response) : [];

      res.json({
        success: true,
        model: modelUsed,
        questions: normalizedQuestions,
        citations,
      });
    } catch (err: unknown) {
      const mapped = formatGeminiError(err, 'Online AI mock examination generation failed.');
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Online Mode: Search-grounded educational research & answer verification
  app.post('/api/ai/research-topic', async (req: Request, res: Response) => {
    const body = req.body as {
      query?: string;
      subjectName?: string;
      gradeLevel?: string;
      claimToVerify?: string;
      attachUploadedContext?: boolean;
      userConfirmedPermission?: boolean;
      uploadedContextExcerpt?: string;
    };

    const query = body.query?.trim() ?? '';
    if (!query) {
      res.status(400).json({ error: 'Please enter a topic, concept, or question to research.' });
      return;
    }

    const hasUploadedExcerpt = Boolean(
      body.attachUploadedContext || (body.uploadedContextExcerpt && body.uploadedContextExcerpt.trim())
    );
    if (hasUploadedExcerpt && body.userConfirmedPermission !== true) {
      res.status(403).json({
        error:
          'Explicit student permission is required before sending uploaded school material excerpts to external AI services.',
      });
      return;
    }

    const ai = getServerAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server GEMINI_API_KEY is not configured. Switch to Offline Study Mode or connect a local AI model.',
      });
      return;
    }

    try {
      const promptParts = [
        `Research and verify supplementary academic information for a Philippine ${body.gradeLevel ?? 'Grade 7-12'} student studying ${body.subjectName ?? 'General Academics'}.`,
        `Research Question / Topic: ${query}`,
        body.claimToVerify?.trim()
          ? `Student Answer or Claim to Verify: ${body.claimToVerify.trim()}`
          : '',
        hasUploadedExcerpt && body.uploadedContextExcerpt
          ? `Student-Permitted Uploaded Material Excerpt (for comparison only — keep clearly separated from external findings):\n${body.uploadedContextExcerpt.slice(0, 6000)}`
          : 'No school document content was attached. Provide pure external academic verification.',
        'Instructions:',
        '1. Prioritize official educational institutions (.edu, .edu.ph, .gov, .gov.ph, DepEd, CHED, NASA, NIH, UNESCO) and established academic references (OpenStax, LibreTexts, Britannica, Stanford Encyclopedia, Khan Academy, university presses).',
        '2. Verify accuracy carefully. Never fabricate facts or citations.',
        '3. Return ONLY a raw JSON object (no markdown outside JSON) with keys:',
        '   - "verificationVerdict": one of "verified" | "partially-supported" | "needs-clarification" | "supplementary-only"',
        '   - "verificationSummary": concise 1-2 sentence verification assessment',
        '   - "externalExplanation": clear, thorough student-friendly explanation grounded in external authoritative sources',
        '   - "keyTakeaways": array of 3-5 concise academic bullet points',
      ].filter(Boolean);

      const { response, modelUsed } = await callGeminiWithModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: promptParts.join('\n\n'),
          config: {
            systemInstruction:
              'You are an academic verification assistant for Philippine Junior and Senior High School students. Ground answers in Google Search results prioritizing .edu, .gov, DepEd/CHED, and peer-reviewed or university sources. Return strictly valid JSON with keys verificationVerdict, verificationSummary, externalExplanation, and keyTakeaways.',
            tools: [{ googleSearch: {} }],
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      const parsed =
        extractJsonObjectFromText<{
          verificationVerdict?: string;
          verificationSummary?: string;
          externalExplanation?: string;
          keyTakeaways?: string[];
        }>(rawText) ?? { externalExplanation: rawText };

      const allowedVerdicts = new Set([
        'verified',
        'partially-supported',
        'needs-clarification',
        'supplementary-only',
      ]);
      const verdict = allowedVerdicts.has(parsed.verificationVerdict ?? '')
        ? parsed.verificationVerdict
        : body.claimToVerify?.trim()
          ? 'partially-supported'
          : 'supplementary-only';

      const citations = extractRankedCitations(response);

      res.json({
        success: true,
        model: modelUsed,
        verificationVerdict: verdict,
        verificationSummary:
          parsed.verificationSummary?.trim() ||
          (citations.length > 0
            ? `Grounded with ${citations.length} external reference${citations.length === 1 ? '' : 's'}.`
            : 'Completed online academic research.'),
        externalExplanation: parsed.externalExplanation?.trim() || rawText,
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
          : [],
        citations,
      });
    } catch (err: unknown) {
      const mapped = formatGeminiError(err, 'Online academic research request failed.');
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyWise AI server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start StudyWise AI server:', err);
  process.exit(1);
});
