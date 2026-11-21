import { MockQuestion, ProgressiveHints } from '../../types/domain';

export interface QuestionValidationResult {
  question: MockQuestion;
  passedOriginalHints: boolean;
  warnings: string[];
}

export interface ExamValidationSummary {
  validQuestions: MockQuestion[];
  warnings: string[];
  rejectedCount: number;
}

const FORBIDDEN_HINT_PHRASES = [
  /\bthe\s+(?:correct\s+)?answer\s+is\b/i,
  /\bcorrect\s+(?:option|choice|letter)\b/i,
  /\b(?:option|choice|letter)\s+[a-d]\b/i,
  /\bpick\s+[a-d]\b/i,
  /\bselect\s+[a-d]\b/i,
  /\banswer:\s*/i,
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hintLeaksAnswer(hint: string, question: MockQuestion): boolean {
  const normalizedHint = hint.trim();
  if (!normalizedHint) return true;

  for (const pattern of FORBIDDEN_HINT_PHRASES) {
    if (pattern.test(normalizedHint)) return true;
  }

  const cleanExpected = question.expectedAnswer.trim();
  if (cleanExpected.length >= 3) {
    // Check direct word/phrase inclusion for non-trivial expected answers
    const expectedRegex = new RegExp(`\\b${escapeRegex(cleanExpected)}\\b`, 'i');
    if (expectedRegex.test(normalizedHint)) {
      return true;
    }
  }

  // For multiple-choice / choice-based questions, prevent verbatim correct choice inclusion
  if (
    question.choices &&
    question.correctIndex !== undefined &&
    question.choices[question.correctIndex]
  ) {
    const correctChoice = question.choices[question.correctIndex].trim();
    if (correctChoice.length >= 4) {
      const choiceRegex = new RegExp(`\\b${escapeRegex(correctChoice)}\\b`, 'i');
      if (choiceRegex.test(normalizedHint)) {
        return true;
      }
    }
  }

  // For True/False, prevent explicit "true" or "false" verdict leakage in hints
  if (question.type === 'true-false') {
    if (/\b(?:statement\s+is\s+(?:true|false)|it\s+is\s+(?:true|false))\b/i.test(normalizedHint)) {
      return true;
    }
  }

  // For problem solving / math, prevent "= <final numeric answer>"
  if (question.type === 'problem-solving') {
    const numericMatches = cleanExpected.match(/-?\d+(?:\.\d+)?/g);
    if (numericMatches) {
      for (const num of numericMatches) {
        if (new RegExp(`=\\s*${escapeRegex(num)}\\b`).test(normalizedHint)) {
          return true;
        }
      }
    }
  }

  return false;
}

function buildSafeFallbackHint(level: 1 | 2 | 3, question: MockQuestion): string {
  const topicPhrase = question.topicTitle ? `"${question.topicTitle}"` : 'this topic';
  const sourceLabel = question.sourceReference || 'your study module';

  if (level === 1) {
    return `Recall the core principles covered under ${topicPhrase} in ${sourceLabel}.`;
  }
  if (level === 2) {
    if (question.type === 'problem-solving') {
      return 'Identify the given quantities first, select the governing formula from your notes, and check the required units before computing.';
    }
    if (question.type === 'multiple-choice') {
      return 'Eliminate choices that contradict the definition or scope discussed in your lesson before comparing the remaining options.';
    }
    return `Break down the key terms in the prompt and connect them to how ${topicPhrase} works in practice.`;
  }
  if (question.type === 'problem-solving') {
    return 'Substitute the known values step by step into the formula and verify whether your intermediate sign and order of operations are consistent.';
  }
  return `Focus on the primary cause, relationship, or defining condition highlighted in ${sourceLabel} without jumping to unrelated details.`;
}

export function validateAndSanitizeQuestion(
  question: MockQuestion
): QuestionValidationResult | null {
  const warnings: string[] = [];

  if (!question.prompt || question.prompt.trim().length < 6) {
    return null;
  }

  // Synchronize expectedAnswer and correctIndex for choice-based & true-false questions
  if (
    question.type === 'multiple-choice' ||
    (question.type === 'reading-comprehension' && question.choices && question.choices.length > 0)
  ) {
    const cleanChoices = (question.choices ?? []).map((c) => String(c).trim()).filter(Boolean);
    if (cleanChoices.length < 2) {
      return null;
    }

    let resolvedIndex =
      typeof question.correctIndex === 'number' && Number.isFinite(question.correctIndex)
        ? Math.trunc(question.correctIndex)
        : -1;
    let resolvedExpected = (question.expectedAnswer ?? '').trim();

    if (resolvedIndex >= 0 && resolvedIndex < cleanChoices.length && !resolvedExpected) {
      resolvedExpected = cleanChoices[resolvedIndex];
    } else if ((resolvedIndex < 0 || resolvedIndex >= cleanChoices.length) && resolvedExpected) {
      const matchedIdx = cleanChoices.findIndex(
        (c) => c.toLowerCase() === resolvedExpected.toLowerCase()
      );
      if (matchedIdx >= 0) {
        resolvedIndex = matchedIdx;
      } else if (/^[A-D]$/i.test(resolvedExpected)) {
        const letterIdx = resolvedExpected.toUpperCase().charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx < cleanChoices.length) {
          resolvedIndex = letterIdx;
          resolvedExpected = cleanChoices[letterIdx];
        }
      }
    }

    if (resolvedIndex < 0 || resolvedIndex >= cleanChoices.length || !resolvedExpected) {
      return null;
    }

    question = {
      ...question,
      choices: cleanChoices,
      correctIndex: resolvedIndex,
      expectedAnswer: resolvedExpected,
    };
  } else if (question.type === 'true-false') {
    const rawAns = String(question.expectedAnswer ?? '').trim().toLowerCase();
    const isTrue =
      rawAns === 'true' ||
      rawAns === 't' ||
      (rawAns === '' && question.correctIndex === 0);
    const isFalse =
      rawAns === 'false' ||
      rawAns === 'f' ||
      (rawAns === '' && question.correctIndex === 1);
    if (!isTrue && !isFalse) {
      return null;
    }
    question = {
      ...question,
      choices: ['True', 'False'],
      correctIndex: isTrue ? 0 : 1,
      expectedAnswer: isTrue ? 'True' : 'False',
    };
  } else if (!question.expectedAnswer || !question.expectedAnswer.trim()) {
    return null;
  }

  if (question.type === 'matching') {
    if (!question.matchingPairs || question.matchingPairs.length < 2) {
      return null;
    }
  }

  let passedOriginalHints = true;
  const rawHints: Partial<ProgressiveHints> = question.hints ?? {};

  const safeLevel1 =
    rawHints.level1 && !hintLeaksAnswer(rawHints.level1, question)
      ? rawHints.level1.trim()
      : (() => {
          passedOriginalHints = false;
          warnings.push(`Question "${question.id}": Level 1 hint sanitized to avoid answer leakage.`);
          return buildSafeFallbackHint(1, question);
        })();

  const safeLevel2 =
    rawHints.level2 && !hintLeaksAnswer(rawHints.level2, question)
      ? rawHints.level2.trim()
      : (() => {
          passedOriginalHints = false;
          warnings.push(`Question "${question.id}": Level 2 hint sanitized to avoid answer leakage.`);
          return buildSafeFallbackHint(2, question);
        })();

  const safeLevel3 =
    rawHints.level3 && !hintLeaksAnswer(rawHints.level3, question)
      ? rawHints.level3.trim()
      : (() => {
          passedOriginalHints = false;
          warnings.push(`Question "${question.id}": Level 3 hint sanitized to avoid answer leakage.`);
          return buildSafeFallbackHint(3, question);
        })();

  const validated: MockQuestion = {
    ...question,
    points: question.points > 0 ? question.points : 1,
    hints: {
      level1: safeLevel1,
      level2: safeLevel2,
      level3: safeLevel3,
    },
    explanation:
      question.explanation?.trim() ||
      `Review ${question.sourceReference || 'your confirmed topic notes'} for the full explanation.`,
    commonMistakes:
      question.commonMistakes?.trim() ||
      'Watch out for mixing up similar terms or skipping a careful reading of the conditions.',
    sourceReference: question.sourceReference?.trim() || 'Student Local Study Materials',
  };

  return {
    question: validated,
    passedOriginalHints,
    warnings,
  };
}

export function validateExamQuestions(questions: MockQuestion[]): ExamValidationSummary {
  const validQuestions: MockQuestion[] = [];
  const warnings: string[] = [];
  let rejectedCount = 0;

  for (const q of questions) {
    const result = validateAndSanitizeQuestion(q);
    if (!result) {
      rejectedCount += 1;
      warnings.push(`Rejected malformed question "${q.id || 'unknown'}".`);
      continue;
    }
    validQuestions.push(result.question);
    warnings.push(...result.warnings);
  }

  return {
    validQuestions,
    warnings,
    rejectedCount,
  };
}
