import { DiscoveredOnlineTopicPayload } from './onlineAiClient';
import {
  ExtractedConceptItem,
  Quarter,
  ResearchCitation,
  TermPeriod,
  Topic,
} from '../../types/domain';

export function termPeriodToQuarter(term: TermPeriod | Quarter): Quarter {
  if (term === 'Q1' || term === 'Q2' || term === 'Q3' || term === 'Q4') {
    return term;
  }
  if (term === 'Quarter 1' || term === '1st Semester') return 'Q1';
  if (term === 'Quarter 2') return 'Q2';
  if (term === 'Quarter 3' || term === '2nd Semester') return 'Q3';
  return 'Q4';
}

export function mapDiscoveredTopicToTopic(params: {
  item: DiscoveredOnlineTopicPayload;
  subjectId: string;
  quarter: Quarter;
  citations?: ResearchCitation[];
}): Topic {
  const { item, subjectId, quarter, citations } = params;
  const uid = crypto.randomUUID().slice(0, 8);
  const pageRef = 'Online Curriculum (Gemini + Web)';

  const definitions: ExtractedConceptItem[] = item.definitions.map((d, idx) => ({
    id: `def-web-${uid}-${idx}`,
    kind: 'definition',
    term: d.term,
    content: d.content,
    pageRef,
  }));

  const formulas: ExtractedConceptItem[] = item.formulas.map((f, idx) => ({
    id: `frm-web-${uid}-${idx}`,
    kind: 'formula',
    content: f.content,
    pageRef,
  }));

  const examples: ExtractedConceptItem[] = item.examples.map((e, idx) => ({
    id: `ex-web-${uid}-${idx}`,
    kind: 'example',
    content: e.content,
    pageRef,
  }));

  const importantConcepts: ExtractedConceptItem[] = item.importantConcepts.map((c, idx) => ({
    id: `con-web-${uid}-${idx}`,
    kind: 'concept',
    content: c.content,
    pageRef,
  }));

  return {
    id: `topic-web-${uid}`,
    subjectId,
    title: item.title,
    quarter,
    summary: item.summary,
    masteryStatus: 'not-started',
    linkedDocumentIds: [],
    sourceFileName: citations?.[0]?.domain ? `Web (${citations[0].domain})` : 'Online Web Curriculum',
    pageRef,
    chapter: item.chapter,
    lesson: item.lesson,
    subtopics: item.subtopics,
    definitions,
    formulas,
    examples,
    importantConcepts,
    sourceAttribution: 'internet-search-grounded',
    citations: citations && citations.length > 0 ? citations : undefined,
    isDemo: false,
    updatedAt: new Date().toISOString(),
  };
}
