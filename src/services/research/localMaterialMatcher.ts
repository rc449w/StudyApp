import {
  DocumentExtractionContent,
  StudyGuide,
  Topic,
} from '../../types/domain';

export interface LocalMaterialMatchResult {
  hasMatches: boolean;
  summaryText: string | null;
  sourceRefs: string[];
  matchedTopics: Topic[];
}

function tokenizeQuery(query: string): string[] {
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'about', 'explain', 'define', 'does',
    'verify', 'check', 'between', 'under', 'from', 'with', 'that', 'this',
  ]);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function scoreTextMatch(text: string, tokens: string[]): number {
  if (!text || tokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (lower.includes(token)) hits += 1;
  }
  return hits;
}

/**
 * Searches student's local IndexedDB topics, extracted document pages, and study guides.
 * Runs 100% locally so uploaded-material facts are always distinct from external research.
 */
export function matchLocalStudyMaterials(params: {
  query: string;
  subjectId?: string;
  selectedTopicId?: string;
  topics: Topic[];
  documentContents: DocumentExtractionContent[];
  studyGuides: StudyGuide[];
}): LocalMaterialMatchResult {
  const tokens = tokenizeQuery(params.query);
  const candidateTopics = params.topics.filter((t) =>
    params.subjectId ? t.subjectId === params.subjectId : true
  );

  let matchedTopics: Topic[] = [];
  if (params.selectedTopicId) {
    const exact = candidateTopics.find((t) => t.id === params.selectedTopicId);
    if (exact) matchedTopics.push(exact);
  }

  const scoredTopics = candidateTopics
    .filter((t) => t.id !== params.selectedTopicId)
    .map((topic) => {
      const corpus = [
        topic.title,
        topic.summary,
        topic.chapter ?? '',
        topic.lesson ?? '',
        ...(topic.subtopics ?? []),
        ...(topic.definitions ?? []).map((d) => `${d.term ?? ''} ${d.content}`),
        ...(topic.formulas ?? []).map((f) => f.content),
        ...(topic.importantConcepts ?? []).map((c) => c.content),
      ].join(' ');
      return { topic, score: scoreTextMatch(corpus, tokens) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.topic);

  matchedTopics = [...matchedTopics, ...scoredTopics];

  const blocks: string[] = [];
  const sourceRefs = new Set<string>();

  for (const topic of matchedTopics) {
    const ref = topic.sourceFileName
      ? `${topic.sourceFileName}${topic.pageRef ? ` · ${topic.pageRef}` : ''}`
      : `Confirmed Topic: ${topic.title}`;
    sourceRefs.add(ref);

    const lines: string[] = [`Topic: ${topic.title} (${ref})`, `Summary: ${topic.summary}`];
    if (topic.definitions && topic.definitions.length > 0) {
      lines.push(
        `Definitions: ${topic.definitions
          .slice(0, 2)
          .map((d) => (d.term ? `${d.term}: ${d.content}` : d.content))
          .join(' | ')}`
      );
    }
    if (topic.formulas && topic.formulas.length > 0) {
      lines.push(
        `Formulas: ${topic.formulas
          .slice(0, 2)
          .map((f) => f.content)
          .join(' | ')}`
      );
    }
    if (topic.examples && topic.examples.length > 0) {
      lines.push(`Example: ${topic.examples[0].content}`);
    }
    blocks.push(lines.join('\n'));
  }

  // Also search raw extracted document pages if tokens match directly
  for (const docContent of params.documentContents) {
    for (const page of docContent.pages) {
      const score = scoreTextMatch(page.text, tokens);
      if (score >= 2) {
        const ref = `${docContent.sourceFileName} · ${page.pageLabel}`;
        if (!sourceRefs.has(ref)) {
          sourceRefs.add(ref);
          const snippet = page.text.replace(/\s+/g, ' ').trim().slice(0, 340);
          blocks.push(`Document Excerpt (${ref}):\n${snippet}${page.text.length > 340 ? '…' : ''}`);
        }
        break;
      }
    }
    if (blocks.length >= 4) break;
  }

  // Check offline study guides matching the subject/query
  const matchingGuides = params.studyGuides.filter((g) => {
    if (params.subjectId && g.subjectId !== params.subjectId) return false;
    return scoreTextMatch(`${g.title} ${g.summary} ${g.bodyMarkdown}`, tokens) >= 2;
  });

  for (const guide of matchingGuides.slice(0, 1)) {
    const ref = `Saved Study Guide: ${guide.title}`;
    sourceRefs.add(ref);
    blocks.push(`${ref}\n${guide.summary}`);
  }

  if (blocks.length === 0) {
    return {
      hasMatches: false,
      summaryText: null,
      sourceRefs: [],
      matchedTopics: [],
    };
  }

  return {
    hasMatches: true,
    summaryText: blocks.join('\n\n'),
    sourceRefs: Array.from(sourceRefs),
    matchedTopics,
  };
}
