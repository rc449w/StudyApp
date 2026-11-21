import {
  DocumentExtractionContent,
  ExamDifficulty,
  ExtractedTable,
  GradeLevel,
  MockExam,
  MockQuestion,
  QuestionType,
  StudyGuide,
  Subject,
  TermPeriod,
  Topic,
} from '../../types/domain';
import { validateExamQuestions } from './examValidator';

export interface ExamGenerationConfig {
  subject: Subject;
  gradeLevel: GradeLevel;
  quarter: TermPeriod;
  selectedTopics: Topic[];
  questionCount: number;
  difficulty: ExamDifficulty;
  durationMinutes: number;
  questionTypes: QuestionType[];
  documentContents: DocumentExtractionContent[];
  studyGuides: StudyGuide[];
}

interface GroundedMaterialUnit {
  topicId?: string;
  topicTitle: string;
  sourceReference: string;
  sourceDocumentId?: string;
  sourcePageNumber?: number;
  referenceTables?: ExtractedTable[];
  term?: string;
  definitionOrFact: string;
  formula?: string;
  example?: string;
  passageText: string;
  keywords: string[];
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'between', 'could', 'defined', 'every',
    'first', 'found', 'other', 'refers', 'should', 'their', 'there', 'these',
    'those', 'through', 'under', 'using', 'where', 'which', 'while', 'would',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !stopWords.has(w));

  return Array.from(new Set(words)).slice(0, 6);
}

function parsePageNumber(ref?: string): number | undefined {
  if (!ref) return undefined;
  const match = ref.match(/\b(?:page|slide|sheet|p\.?)\s*(\d+)/i) ?? ref.match(/(\d+)/);
  if (!match) return undefined;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function isUsableExamFact(text?: string): boolean {
  const clean = text?.trim() ?? '';
  if (clean.length < 10) return false;
  if (/^table\s*\([^)]*\)\s*:\s*\d+\s*data row/i.test(clean)) return false;
  if (/^(example|solution|answer|note|table|figure|objectives?)\s*:?$/i.test(clean)) return false;
  if (
    /\bthings?\s+i\s+(learned|need\s+to\s+clarify)\b|\bat\s+the\s+end\s+of\s+the\s+(session|lesson)\b|\bexit\s+ticket\b/i.test(
      clean
    )
  ) {
    return false;
  }
  return true;
}

function isUsableExamTerm(term?: string): boolean {
  const clean = term?.trim() ?? '';
  if (clean.length < 3) return false;
  if (/^(example|examples|solution|answer|note|notes|table|figure|objective|objectives)\s*:?$/i.test(clean)) {
    return false;
  }
  if (/[:]$/.test(clean) && clean.split(/\s+/).length <= 2) return false;
  return true;
}

function resolveTablesForPage(
  linkedContent: DocumentExtractionContent | undefined,
  pageNumber?: number
): ExtractedTable[] | undefined {
  if (!linkedContent) return undefined;
  if (pageNumber) {
    const exactPage = linkedContent.pages.find((p) => p.pageNumber === pageNumber);
    if (exactPage && exactPage.tables.length > 0) {
      return exactPage.tables;
    }
  }
  return undefined;
}

function collectGroundedMaterials(config: ExamGenerationConfig): GroundedMaterialUnit[] {
  const units: GroundedMaterialUnit[] = [];
  const docContentMap = new Map(
    config.documentContents.map((c) => [c.documentId, c])
  );

  for (const topic of config.selectedTopics) {
    const baseRef = topic.sourceFileName
      ? `${topic.sourceFileName}${topic.pageRef ? ` · ${topic.pageRef}` : ''}`
      : `${config.subject.name} · ${topic.quarter} Notes`;

    const linkedContent = topic.sourceDocumentId
      ? docContentMap.get(topic.sourceDocumentId)
      : undefined;
    const topicPageNum = parsePageNumber(topic.pageRef);
    const matchingPage =
      linkedContent && topicPageNum
        ? linkedContent.pages.find((p) => p.pageNumber === topicPageNum)
        : undefined;
    const passageText =
      matchingPage?.text ||
      linkedContent?.pages?.[0]?.text ||
      topic.summary ||
      `${topic.title}: ${topic.chapter ?? ''}`;

    // 1. Definitions
    for (const def of topic.definitions ?? []) {
      const parts = def.content.split(/\s+—\s+|\s+-\s+/);
      const rawTerm = def.term || (parts.length > 1 ? parts[0].trim() : topic.title);
      const term = isUsableExamTerm(rawTerm) ? rawTerm : topic.title;
      const desc = parts.length > 1 ? parts.slice(1).join(' — ').trim() : def.content;
      if (!isUsableExamFact(desc)) continue;
      const pageNum = parsePageNumber(def.pageRef) ?? topicPageNum;
      units.push({
        topicId: topic.id,
        topicTitle: topic.title,
        sourceReference: topic.sourceFileName
          ? `${topic.sourceFileName} · ${def.pageRef}`
          : baseRef,
        sourceDocumentId: topic.sourceDocumentId,
        sourcePageNumber: pageNum,
        referenceTables: resolveTablesForPage(linkedContent, pageNum),
        term,
        definitionOrFact: desc,
        passageText,
        keywords: extractKeywords(`${term} ${desc}`),
      });
    }

    // 2. Formulas
    for (const frm of topic.formulas ?? []) {
      if (!isUsableExamFact(frm.content)) continue;
      const pageNum = parsePageNumber(frm.pageRef) ?? topicPageNum;
      units.push({
        topicId: topic.id,
        topicTitle: topic.title,
        sourceReference: topic.sourceFileName
          ? `${topic.sourceFileName} · ${frm.pageRef}`
          : baseRef,
        sourceDocumentId: topic.sourceDocumentId,
        sourcePageNumber: pageNum,
        referenceTables: resolveTablesForPage(linkedContent, pageNum),
        term: topic.title,
        definitionOrFact: isUsableExamFact(topic.summary) ? topic.summary : frm.content,
        formula: frm.content,
        passageText,
        keywords: extractKeywords(`${topic.title} ${frm.content} ${topic.summary}`),
      });
    }

    // 3. Examples
    for (const ex of topic.examples ?? []) {
      if (!isUsableExamFact(ex.content)) continue;
      const pageNum = parsePageNumber(ex.pageRef) ?? topicPageNum;
      units.push({
        topicId: topic.id,
        topicTitle: topic.title,
        sourceReference: topic.sourceFileName
          ? `${topic.sourceFileName} · ${ex.pageRef}`
          : baseRef,
        sourceDocumentId: topic.sourceDocumentId,
        sourcePageNumber: pageNum,
        referenceTables: resolveTablesForPage(linkedContent, pageNum),
        term: topic.title,
        definitionOrFact: isUsableExamFact(topic.summary) ? topic.summary : ex.content,
        example: ex.content,
        passageText,
        keywords: extractKeywords(`${topic.title} ${ex.content}`),
      });
    }

    // 4. Important Concepts (skip raw "Table (...): N data row(s) recorded." metadata lines!)
    for (const con of topic.importantConcepts ?? []) {
      if (!isUsableExamFact(con.content)) continue;
      const pageNum = parsePageNumber(con.pageRef) ?? topicPageNum;
      units.push({
        topicId: topic.id,
        topicTitle: topic.title,
        sourceReference: topic.sourceFileName
          ? `${topic.sourceFileName} · ${con.pageRef}`
          : baseRef,
        sourceDocumentId: topic.sourceDocumentId,
        sourcePageNumber: pageNum,
        referenceTables: resolveTablesForPage(linkedContent, pageNum),
        term: topic.title,
        definitionOrFact: con.content,
        passageText,
        keywords: extractKeywords(`${topic.title} ${con.content}`),
      });
    }

    // 5. Fallback to topic summary & subtopics (never emit empty-string facts)
    const cleanSubtopics = (topic.subtopics ?? []).filter(isUsableExamTerm);
    const hasUsableSummary = isUsableExamFact(topic.summary);
    if (
      (topic.definitions?.length ?? 0) === 0 &&
      (topic.formulas?.length ?? 0) === 0 &&
      (topic.importantConcepts?.filter((c) => isUsableExamFact(c.content)).length ?? 0) === 0 &&
      (hasUsableSummary || cleanSubtopics.length > 0 || Boolean(matchingPage?.tables?.length))
    ) {
      const fallbackFact = hasUsableSummary
        ? topic.summary.trim()
        : cleanSubtopics.length > 0
          ? `Key subtopics covered under ${topic.title}: ${cleanSubtopics.join(', ')}`
          : `Analyze the data table or visual diagram shown for ${topic.title}.`;
      units.push({
        topicId: topic.id,
        topicTitle: topic.title,
        sourceReference: baseRef,
        sourceDocumentId: topic.sourceDocumentId,
        sourcePageNumber: topicPageNum,
        referenceTables: resolveTablesForPage(linkedContent, topicPageNum),
        term: topic.title,
        definitionOrFact: fallbackFact,
        passageText: `${topic.title}\n${fallbackFact}`,
        keywords: extractKeywords(`${topic.title} ${fallbackFact}`),
      });
    }
  }

  // Pull additional confirmed study guide concepts for the subject if needed
  for (const guide of config.studyGuides) {
    if (guide.subjectId !== config.subject.id) continue;
    for (const concept of guide.keyConcepts) {
      if (!isUsableExamFact(concept)) continue;
      units.push({
        topicId: guide.topicId,
        topicTitle: guide.title,
        sourceReference: `Study Guide: ${guide.title}`,
        term: guide.title,
        definitionOrFact: concept,
        passageText: guide.bodyMarkdown.slice(0, 600),
        keywords: extractKeywords(`${guide.title} ${concept}`),
      });
    }
  }

  // Pull raw document pages across up to 20 pages if still thin
  for (const docContent of config.documentContents) {
    const hasTopicLink = config.selectedTopics.some(
      (t) => t.sourceDocumentId === docContent.documentId
    );
    if (!hasTopicLink) continue;
    for (const page of docContent.pages.slice(0, 20)) {
      const cleanSnippet = page.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => isUsableExamFact(l))
        .join(' ')
        .trim();
      if (cleanSnippet.length > 40 || page.tables.length > 0) {
        const headingTerm = page.headings.find(isUsableExamTerm) ?? docContent.detectedSubject;
        const fact =
          cleanSnippet.length > 40
            ? cleanSnippet.slice(0, 220)
            : `Review the data table or visual display for ${headingTerm}.`;
        units.push({
          topicTitle: headingTerm,
          sourceReference: `${docContent.sourceFileName} · ${page.pageLabel}`,
          sourceDocumentId: docContent.documentId,
          sourcePageNumber: page.pageNumber,
          referenceTables: page.tables.length > 0 ? page.tables : undefined,
          term: headingTerm,
          definitionOrFact: fact,
          formula: page.formulas[0],
          passageText: cleanSnippet.slice(0, 600) || fact,
          keywords: extractKeywords(cleanSnippet.slice(0, 400)),
        });
      }
    }
  }

  return units;
}

function buildQuestionByType(params: {
  index: number;
  type: QuestionType;
  unit: GroundedMaterialUnit;
  allUnits: GroundedMaterialUnit[];
  difficulty: ExamDifficulty;
  subjectName: string;
  gradeLevel: GradeLevel;
}): MockQuestion {
  const { index, type, unit, allUnits, difficulty, subjectName, gradeLevel } = params;
  const targetTermRaw = unit.term || unit.topicTitle;
  const safeTargetTerm = isUsableExamTerm(targetTermRaw) ? targetTermRaw : unit.topicTitle;

  const distractorTerms = allUnits
    .map((u) => u.term || u.topicTitle)
    .filter(
      (t) =>
        isUsableExamTerm(t) &&
        t.toLowerCase() !== safeTargetTerm.toLowerCase()
    );

  const fallbackDistractors = [
    'Cumulative Frequency Polygon',
    'Relative Frequency Distribution',
    'Central Tendency Measure',
    'Interval Width Boundary',
  ];

  const getDistractors = (count: number): string[] => {
    const pool = Array.from(new Set([...distractorTerms, ...fallbackDistractors]));
    return pool.slice(0, count);
  };

  const visualMeta = {
    sourceReference: unit.sourceReference,
    sourceDocumentId: unit.sourceDocumentId,
    sourcePageNumber: unit.sourcePageNumber,
    referenceTables: unit.referenceTables,
    referenceLabel: unit.sourceReference,
    topicId: unit.topicId,
    topicTitle: unit.topicTitle,
  };

  if (type === 'multiple-choice') {
    const targetTerm = safeTargetTerm;
    const distractors = getDistractors(3);
    const choices = [targetTerm, ...distractors];
    // Deterministic rotation based on index so A isn't always correct
    const correctIndex = index % choices.length;
    const rotated = [...choices];
    [rotated[0], rotated[correctIndex]] = [rotated[correctIndex], rotated[0]];

    return {
      id: uid(`q${index + 1}`),
      type: 'multiple-choice',
      prompt: `According to ${unit.sourceReference}, which concept is described as: "${unit.definitionOrFact}"?`,
      choices: rotated,
      correctIndex,
      expectedAnswer: targetTerm,
      points: 1,
      hints: {
        level1: `Recall the central terminology introduced in "${unit.topicTitle}".`,
        level2: `Compare how each choice relates to ${subjectName} (${gradeLevel}) rather than unrelated modules.`,
        level3: `Focus on the specific mechanism or role mentioned in the prompt—eliminate choices that describe opposite processes.`,
      },
      explanation: `${targetTerm} matches the description in ${unit.sourceReference}: ${unit.definitionOrFact}`,
      commonMistakes: `Students often confuse "${targetTerm}" with adjacent concepts from the same unit when skimming definitions quickly.`,
      ...visualMeta,
    };
  }

  if (type === 'true-false') {
    const makeTrue = index % 2 === 0;
    const distractorTerm = getDistractors(1)[0] ?? 'an unrelated principle';
    const statement = makeTrue
      ? unit.definitionOrFact
      : `In ${subjectName}, "${safeTargetTerm}" has no connection to ${
          unit.keywords[0] ?? 'this lesson'
        } and is instead identical to ${distractorTerm}.`;

    return {
      id: uid(`q${index + 1}`),
      type: 'true-false',
      prompt: `True or False: ${statement}`,
      choices: ['True', 'False'],
      correctIndex: makeTrue ? 0 : 1,
      expectedAnswer: makeTrue ? 'True' : 'False',
      points: 1,
      hints: {
        level1: `Think back to the core rule taught under "${unit.topicTitle}".`,
        level2: 'Check whether every clause in the statement aligns with your confirmed notes.',
        level3: 'Test if there is any contradiction or absoluteness ("no connection", "identical") that violates the lesson definition.',
      },
      explanation: makeTrue
        ? `This statement accurately reflects ${unit.sourceReference}: ${unit.definitionOrFact}`
        : `This statement is inaccurate. Based on ${unit.sourceReference}, ${safeTargetTerm} is characterized by: ${unit.definitionOrFact}`,
      commonMistakes: 'Accepting a familiar keyword in the sentence without verifying whether the qualifying clause is accurate.',
      ...visualMeta,
    };
  }

  if (type === 'identification') {
    const answer = safeTargetTerm;
    return {
      id: uid(`q${index + 1}`),
      type: 'identification',
      prompt: `Identify the term or concept in ${subjectName} described below:\n"${unit.definitionOrFact}"`,
      expectedAnswer: answer,
      acceptableKeywords: [answer, ...unit.keywords.slice(0, 2)],
      points: 1,
      hints: {
        level1: `Review the vocabulary list from "${unit.topicTitle}".`,
        level2: `Think about the exact noun or phrase that performs the role described in the clue.`,
        level3: `The term has ${answer.split(/\s+/).length} word(s) and begins with "${answer[0]?.toUpperCase() ?? ''}".`,
      },
      explanation: `The correct identification is "${answer}", as documented in ${unit.sourceReference}.`,
      commonMistakes: 'Writing a related example instead of the formal curriculum term.',
      ...visualMeta,
    };
  }

  if (type === 'fill-in-the-blank') {
    const targetWord =
      unit.keywords.find((w) => unit.definitionOrFact.toLowerCase().includes(w)) ??
      safeTargetTerm.split(/\s+/)[0] ??
      'concept';

    const blankedSentence = unit.definitionOrFact.replace(
      new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
      '________'
    );

    const finalPrompt =
      blankedSentence !== unit.definitionOrFact
        ? `Complete the statement from ${unit.topicTitle}:\n"${blankedSentence}"`
        : `Complete the key idea from ${unit.topicTitle}: ________ is essential because ${unit.definitionOrFact}`;

    return {
      id: uid(`q${index + 1}`),
      type: 'fill-in-the-blank',
      prompt: finalPrompt,
      expectedAnswer: targetWord,
      acceptableKeywords: [targetWord],
      points: 1,
      hints: {
        level1: `Recall the exact phrasing used in ${unit.sourceReference}.`,
        level2: 'Look at the grammar of the sentence to determine whether the missing word is a process, quantity, or object.',
        level3: `The missing word is ${targetWord.length} letters long and starts with "${targetWord[0]?.toUpperCase() ?? ''}".`,
      },
      explanation: `The missing term is "${targetWord}". Full context from ${unit.sourceReference}: ${unit.definitionOrFact}`,
      commonMistakes: 'Using a vague everyday synonym instead of the precise academic term.',
      ...visualMeta,
    };
  }

  if (type === 'matching') {
    const pool = [
      unit,
      ...allUnits.filter(
        (u) => u.topicTitle !== unit.topicTitle && isUsableExamTerm(u.term || u.topicTitle)
      ),
    ].slice(0, 3);
    while (pool.length < 3) {
      pool.push({
        ...unit,
        topicTitle: `${unit.topicTitle} — Aspect ${pool.length + 1}`,
        definitionOrFact:
          pool.length === 1
            ? `Application context in ${subjectName} (${gradeLevel})`
            : `Core principle referenced in ${unit.sourceReference}`,
      });
    }

    const pairs = pool.map((item, idx) => ({
      id: `pair-${index}-${idx}`,
      prompt: item.definitionOrFact.slice(0, 120),
      match: isUsableExamTerm(item.term) ? item.term! : item.topicTitle,
    }));

    return {
      id: uid(`q${index + 1}`),
      type: 'matching',
      prompt: `Match each description from your ${subjectName} materials in Column A with the corresponding concept in Column B.`,
      matchingPairs: pairs,
      expectedAnswer: pairs.map((p) => `${p.prompt} -> ${p.match}`).join('; '),
      points: pairs.length,
      hints: {
        level1: 'Start by matching the description you recognize with highest confidence first.',
        level2: 'Group terms by chapter or subtopic before assigning the remaining pairs.',
        level3: 'Double-check verb clues in each Column A statement (e.g., process vs. structure vs. rule).',
      },
      explanation: pairs.map((p) => `• ${p.match}: ${p.prompt}`).join('\n'),
      commonMistakes: 'Leaving two similar concepts swapped after matching the first pair too quickly.',
      ...visualMeta,
    };
  }

  if (type === 'problem-solving') {
    const combinedContext = `${unit.topicTitle} ${unit.formula ?? ''} ${unit.definitionOrFact}`.toLowerCase();
    const formulaHint = unit.formula
      ? `Apply the relationship from your notes: ${unit.formula.replace(/=.*$/, '= ?')}`
      : 'Set up the relationship between the given quantities before substituting values.';

    // Domain-tailored statistics problem solving when topics cover Class Mark, Boundaries, Pie Chart, or Ogive
    if (/class mark|midpoint/.test(combinedContext)) {
      const lowerLimit = 10 + (index % 4) * 10;
      const upperLimit = lowerLimit + 9;
      const classMark = (lowerLimit + upperLimit) / 2;
      return {
        id: uid(`q${index + 1}`),
        type: 'problem-solving',
        prompt: `Problem Solving (${unit.topicTitle}): Based on ${unit.sourceReference}, find the class mark (midpoint) for the class interval ${lowerLimit} – ${upperLimit}. Show your solution steps.`,
        expectedAnswer: String(classMark),
        acceptableKeywords: [String(classMark), 'midpoint', 'class mark'],
        points: 2,
        hints: {
          level1: 'Identify the Lower Limit and Upper Limit of the given class interval.',
          level2: 'Use the midpoint formula: Class Mark = (Lower Limit + Upper Limit) ÷ 2.',
          level3: 'Add the two interval endpoints first, then divide the sum evenly by 2.',
        },
        explanation: `Class Mark = (${lowerLimit} + ${upperLimit}) / 2 = ${lowerLimit + upperLimit} / 2 = ${classMark}.`,
        commonMistakes: 'Subtracting the limits (which gives the range) instead of averaging them.',
        ...visualMeta,
      };
    }

    if (/class boundar/.test(combinedContext)) {
      const lowerLimit = 20 + (index % 4) * 10;
      const upperLimit = lowerLimit + 9;
      const lb = lowerLimit - 0.5;
      const ub = upperLimit + 0.5;
      return {
        id: uid(`q${index + 1}`),
        type: 'problem-solving',
        prompt: `Problem Solving (${unit.topicTitle}): Using ${unit.sourceReference}, determine the Lower Boundary and Upper Boundary of the integer class interval ${lowerLimit} – ${upperLimit}.`,
        expectedAnswer: `${lb} and ${ub}`,
        acceptableKeywords: [String(lb), String(ub)],
        points: 2,
        hints: {
          level1: 'Recall how continuous class boundaries eliminate gaps between consecutive integer intervals.',
          level2: 'Subtract 0.5 from the lower limit and add 0.5 to the upper limit.',
          level3: 'Check that the upper boundary is 0.5 units above the upper limit and the lower boundary is 0.5 units below.',
        },
        explanation: `Lower Boundary = ${lowerLimit} - 0.5 = ${lb}; Upper Boundary = ${upperLimit} + 0.5 = ${ub}.`,
        commonMistakes: 'Adding 0.5 to both endpoints or forgetting to adjust the lower limit downward.',
        ...visualMeta,
      };
    }

    if (/pie chart|central angle|sector|percentage/.test(combinedContext)) {
      const totalN = 40;
      const freq = 10 + (index % 3) * 5;
      const angle = (freq / totalN) * 360;
      return {
        id: uid(`q${index + 1}`),
        type: 'problem-solving',
        prompt: `Problem Solving (${unit.topicTitle}): Referencing ${unit.sourceReference}, in a survey of ${totalN} students, ${freq} students chose the top category. Calculate the central angle (in degrees) of its sector in a Pie Chart.`,
        expectedAnswer: String(angle),
        acceptableKeywords: [String(angle), 'degrees', '360'],
        points: 2,
        hints: {
          level1: 'Express the category frequency as a fraction of the total sample size N.',
          level2: 'Multiply the relative frequency (f ÷ N) by the total degrees in a full circle (360°).',
          level3: 'Simplify the fraction first before multiplying by 360°.',
        },
        explanation: `Central Angle = (${freq} / ${totalN}) × 360° = ${angle}°.`,
        commonMistakes: 'Multiplying by 100% (which gives percentage) instead of 360° (which gives central angle).',
        ...visualMeta,
      };
    }

    // General Math / Science / Application fallback
    const sampleA = 4 + (index % 5);
    const sampleB = 3 + (index % 4);
    const computedProduct = sampleA * sampleB;

    const isMathOrScience = /math|calc|stat|phys|chem|science/i.test(subjectName);
    const prompt = isMathOrScience
      ? `Problem Solving (${unit.topicTitle}): Using the principles from ${unit.sourceReference}${
          unit.formula ? ` (reference expression in notes)` : ''
        }, suppose a linear rate model gives y = ${sampleA}x + ${sampleB} where x = ${sampleB}. Calculate the resulting value of y and show your steps.`
      : `Problem Solving (${unit.topicTitle}): A study group organizes ${sampleA} review modules with ${sampleB} practice items per module based on ${unit.sourceReference}. Compute the total number of practice items and explain how "${unit.topicTitle}" structures the review.`;

    const expectedNumeric = isMathOrScience
      ? String(sampleA * sampleB + sampleB)
      : String(computedProduct);

    return {
      id: uid(`q${index + 1}`),
      type: 'problem-solving',
      prompt,
      expectedAnswer: expectedNumeric,
      acceptableKeywords: [expectedNumeric, ...unit.keywords.slice(0, 2)],
      points: 2,
      hints: {
        level1: `Write down the given values clearly and identify what quantity is being asked.`,
        level2: formulaHint,
        level3: isMathOrScience
          ? 'Perform multiplication before addition following standard order of operations (PEMDAS).'
          : 'Combine the number of groups and items per group using multiplication.',
      },
      explanation: isMathOrScience
        ? `Substitute x = ${sampleB} into y = ${sampleA}x + ${sampleB}: y = ${sampleA}(${sampleB}) + ${sampleB} = ${
            sampleA * sampleB
          } + ${sampleB} = ${expectedNumeric}.`
        : `Multiply ${sampleA} modules × ${sampleB} items = ${computedProduct} total practice items.`,
      commonMistakes: 'Adding coefficients before multiplying, or substituting into the wrong variable.',
      ...visualMeta,
    };
  }

  if (type === 'reading-comprehension') {
    const passage = unit.passageText.slice(0, 480);
    return {
      id: uid(`q${index + 1}`),
      type: 'reading-comprehension',
      passage,
      prompt: `Based on the excerpt above from ${unit.sourceReference}, explain the main idea of "${unit.topicTitle}" and cite one supporting detail from the passage.`,
      expectedAnswer: `${unit.topicTitle}: ${unit.definitionOrFact}`,
      acceptableKeywords: unit.keywords.length > 0 ? unit.keywords : [unit.topicTitle.toLowerCase()],
      points: 2,
      hints: {
        level1: 'Re-read the opening sentence of the passage to locate the central topic.',
        level2: 'Underline or note the key action, cause, or relationship stated directly in the text.',
        level3: 'Summarize the main point in your own words and pair it with one concrete detail from the excerpt.',
      },
      explanation: `A strong comprehension response identifies the core claim (${unit.definitionOrFact}) and supports it directly from the excerpt in ${unit.sourceReference}.`,
      commonMistakes: 'Bringing in outside opinions instead of grounding the answer in evidence from the excerpt.',
      ...visualMeta,
    };
  }

  if (type === 'situational-analysis') {
    const scenario = `A Grade ${gradeLevel.replace('Grade ', '')} student in ${subjectName} encounters a real-world situation involving "${unit.topicTitle}": ${unit.definitionOrFact}`;
    return {
      id: uid(`q${index + 1}`),
      type: 'situational-analysis',
      passage: scenario,
      prompt: `Analyze how the principles from "${unit.topicTitle}" (${difficulty} level) apply to this scenario. What decision or conclusion should the student reach, and why?`,
      expectedAnswer: `Apply ${unit.topicTitle} (${unit.definitionOrFact}) to evaluate constraints and justify the conclusion.`,
      acceptableKeywords: unit.keywords.length > 0 ? unit.keywords : ['analyze', 'apply'],
      points: 3,
      hints: {
        level1: `Identify which rule or concept from "${unit.topicTitle}" governs the situation.`,
        level2: 'Ask what happens if a key condition in the scenario changes—how does the outcome shift?',
        level3: 'Structure your analysis into: (1) relevant principle, (2) effect on the scenario, and (3) justified conclusion.',
      },
      explanation: `An effective situational analysis connects ${unit.sourceReference} directly to the scenario constraints and explains why alternative actions would fail.`,
      commonMistakes: 'Describing the scenario again without applying the underlying curriculum concept.',
      ...visualMeta,
    };
  }

  if (type === 'essay') {
    return {
      id: uid(`q${index + 1}`),
      type: 'essay',
      prompt: `Essay (${difficulty.toUpperCase()}): Discuss the significance of "${unit.topicTitle}" in ${subjectName}. Explain its key principles, provide an illustrative example, and cite how it connects to real-world Philippine contexts.`,
      expectedAnswer: `Essay covering ${unit.topicTitle}: ${unit.definitionOrFact}`,
      acceptableKeywords: unit.keywords,
      points: 5,
      hints: {
        level1: 'Outline three parts before writing: definition/claim, supporting explanation, and real-world example.',
        level2: `Connect the core facts from ${unit.sourceReference} to why this topic matters beyond memorization.`,
        level3: 'Include at least one concrete example and address a possible misconception to strengthen your argument.',
      },
      explanation: `A complete essay clearly defines ${unit.topicTitle} (${unit.definitionOrFact}), explains its mechanism accurately using concepts from ${unit.sourceReference}, and illustrates it with a relevant example.`,
      commonMistakes: 'Writing overly general statements without using specific terminology or examples from the lesson.',
      ...visualMeta,
    };
  }

  // Short Answer default
  return {
    id: uid(`q${index + 1}`),
    type: 'short-answer',
    prompt: `In 2–3 concise sentences, explain "${unit.topicTitle}" based on ${unit.sourceReference}.`,
    expectedAnswer: unit.definitionOrFact,
    acceptableKeywords: unit.keywords,
    points: 2,
    hints: {
      level1: `Think of the key definition or main takeaway from "${unit.topicTitle}".`,
      level2: 'Focus on answering both "what it is" and "how/why it works".',
      level3: `Include key terms related to ${unit.topicTitle} without adding unrelated topics.`,
    },
    explanation: `Expected explanation from ${unit.sourceReference}: ${unit.definitionOrFact}`,
    commonMistakes: 'Giving a one-word label instead of explaining the concept in complete sentences.',
    ...visualMeta,
  };
}

export function generateLocalMockExam(config: ExamGenerationConfig): MockExam {
  const materialUnits = collectGroundedMaterials(config);
  const safeUnits: GroundedMaterialUnit[] =
    materialUnits.length > 0
      ? materialUnits
      : [
          {
            topicTitle: config.subject.name,
            sourceReference: `${config.subject.name} · ${config.quarter}`,
            term: config.subject.name,
            definitionOrFact: config.subject.description,
            passageText: config.subject.description,
            keywords: extractKeywords(config.subject.description),
          },
        ];

  const types =
    config.questionTypes.length > 0 ? config.questionTypes : (['multiple-choice'] as QuestionType[]);

  const rawQuestions: MockQuestion[] = [];
  for (let i = 0; i < config.questionCount; i += 1) {
    const qType = types[i % types.length];
    const unit = safeUnits[i % safeUnits.length];
    rawQuestions.push(
      buildQuestionByType({
        index: i,
        type: qType,
        unit,
        allUnits: safeUnits,
        difficulty: config.difficulty,
        subjectName: config.subject.name,
        gradeLevel: config.gradeLevel,
      })
    );
  }

  const validation = validateExamQuestions(rawQuestions);

  return {
    id: `exam-gen-${crypto.randomUUID().slice(0, 8)}`,
    subjectId: config.subject.id,
    title: `${config.subject.name} — ${config.quarter} Mock Exam`,
    gradeLevel: config.gradeLevel,
    quarter: config.quarter,
    difficulty: config.difficulty,
    timeLimitMinutes: config.durationMinutes,
    description: `Generated offline from ${config.selectedTopics.length} confirmed topic(s) and linked local study materials.`,
    topicIds: config.selectedTopics.map((t) => t.id),
    sourceMode: 'local-generated',
    isDemo: false,
    questions: validation.validQuestions,
    validationWarnings: validation.warnings,
    createdAt: new Date().toISOString(),
  };
}
