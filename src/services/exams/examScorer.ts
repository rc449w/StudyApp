import {
  MockExam,
  MockQuestion,
  QuestionResultBreakdown,
  StudentAnswerValue,
} from '../../types/domain';

export interface ExamScoringSummary {
  earnedPoints: number;
  maxPoints: number;
  correctQuestionCount: number;
  totalQuestions: number;
  percentage: number;
  questionBreakdowns: QuestionResultBreakdown[];
  recommendedReviewTopics: string[];
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[₱$,]/g, '')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSingleQuestion(
  question: MockQuestion,
  studentAnswer: StudentAnswerValue | undefined,
  hintsUsedLevel: number
): QuestionResultBreakdown {
  const maxPoints = question.points || 1;

  if (
    studentAnswer === undefined ||
    studentAnswer === '' ||
    (typeof studentAnswer === 'object' && Object.keys(studentAnswer).length === 0)
  ) {
    return {
      questionId: question.id,
      earnedPoints: 0,
      maxPoints,
      isCorrect: false,
      hintsUsedLevel,
      feedback: 'No answer was submitted.',
    };
  }

  // Choice-based questions (Multiple Choice, True/False, Reading Comprehension MCQ)
  if (
    question.type === 'multiple-choice' ||
    question.type === 'true-false' ||
    (question.type === 'reading-comprehension' && question.choices && question.choices.length > 0)
  ) {
    const pickedIdx = typeof studentAnswer === 'number' ? studentAnswer : Number(studentAnswer);
    const isCorrect = pickedIdx === question.correctIndex;
    return {
      questionId: question.id,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isCorrect,
      hintsUsedLevel,
      feedback: isCorrect ? 'Correct choice selected.' : 'Selected option does not match the source key.',
    };
  }

  // Matching Type
  if (question.type === 'matching' && question.matchingPairs) {
    const mapping =
      typeof studentAnswer === 'object' && studentAnswer !== null
        ? (studentAnswer as Record<string, string>)
        : {};
    let matches = 0;
    for (const pair of question.matchingPairs) {
      if (mapping[pair.id] === pair.match) {
        matches += 1;
      }
    }
    const totalPairs = question.matchingPairs.length;
    const earned = totalPairs > 0 ? Math.round((matches / totalPairs) * maxPoints * 10) / 10 : 0;
    const isCorrect = matches === totalPairs;
    return {
      questionId: question.id,
      earnedPoints: earned,
      maxPoints,
      isCorrect,
      hintsUsedLevel,
      feedback: `Matched ${matches} of ${totalPairs} pairs correctly.`,
    };
  }

  // Text & numeric questions
  const rawText = String(studentAnswer).trim();
  const normStudent = normalizeText(rawText);
  const normExpected = normalizeText(question.expectedAnswer);

  if (question.type === 'identification' || question.type === 'fill-in-the-blank') {
    const isSpellingQuestion =
      question.topicTitle?.toLowerCase().includes('spelling') ||
      question.sourceReference.toLowerCase().includes('spelling');
    const keywords = question.acceptableKeywords ?? [];
    const exactMatch = isSpellingQuestion
      ? normStudent === normExpected
      : normStudent === normExpected ||
        (normExpected.includes(normStudent) &&
          normStudent.length >= Math.max(4, normExpected.length * 0.6));
    const keywordHit = isSpellingQuestion
      ? false
      : keywords.some((kw) => normStudent.includes(normalizeText(kw)));
    const isCorrect = Boolean(normStudent && (exactMatch || keywordHit));

    return {
      questionId: question.id,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isCorrect,
      hintsUsedLevel,
      feedback: isCorrect
        ? isSpellingQuestion
          ? 'Exact spelling is correct.'
          : 'Matches expected term.'
        : isSpellingQuestion
          ? `Incorrect spelling. Correct spelling is "${question.expectedAnswer}".`
          : `Expected "${question.expectedAnswer}".`,
    };
  }

  if (question.type === 'problem-solving') {
    const studentNumbers = normStudent.match(/-?\d+(?:\.\d+)?/g) ?? [];
    const expectedNumbers = normExpected.match(/-?\d+(?:\.\d+)?/g) ?? [];
    const lastExpectedNum = expectedNumbers[expectedNumbers.length - 1];

    const numericMatch =
      Boolean(lastExpectedNum) && studentNumbers.some((n) => Number(n) === Number(lastExpectedNum));
    const exactMatch = normStudent === normExpected;
    const keywordMatches = (question.acceptableKeywords ?? []).filter((kw) =>
      normStudent.includes(normalizeText(kw))
    ).length;

    if (exactMatch || numericMatch) {
      return {
        questionId: question.id,
        earnedPoints: maxPoints,
        maxPoints,
        isCorrect: true,
        hintsUsedLevel,
        feedback: 'Final computed value matches the solution.',
      };
    }

    if (keywordMatches >= 1 && normStudent.length >= 12) {
      const partial = Math.round(maxPoints * 0.5 * 10) / 10;
      return {
        questionId: question.id,
        earnedPoints: partial,
        maxPoints,
        isCorrect: false,
        hintsUsedLevel,
        feedback: 'Partial credit: relevant formula/steps shown, but final result differs.',
      };
    }

    return {
      questionId: question.id,
      earnedPoints: 0,
      maxPoints,
      isCorrect: false,
      hintsUsedLevel,
      feedback: 'Computed solution does not match the expected answer.',
    };
  }

  // Open-ended: Short Answer, Essay, Situational Analysis, Reading Comprehension (open)
  const keywords = (question.acceptableKeywords ?? []).map(normalizeText).filter(Boolean);
  const matchedKeywords = keywords.filter((kw) => normStudent.includes(kw));
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  let ratio = 0;
  if (keywords.length > 0) {
    ratio = matchedKeywords.length / Math.min(keywords.length, 3);
    if (wordCount >= 12 && ratio < 0.35) ratio = 0.35;
  } else {
    ratio = wordCount >= 15 ? 0.85 : wordCount >= 6 ? 0.5 : 0.25;
  }

  ratio = Math.min(1, ratio);
  const earnedPoints = Math.round(maxPoints * ratio * 10) / 10;
  const isCorrect = ratio >= 0.7;

  return {
    questionId: question.id,
    earnedPoints,
    maxPoints,
    isCorrect,
    hintsUsedLevel,
    feedback:
      keywords.length > 0
        ? `Key concepts addressed: ${matchedKeywords.length}/${Math.min(
            keywords.length,
            3
          )} (${wordCount} words). Compare your response with the model answer below.`
        : `Evaluated locally (${wordCount} words). Compare your response with the model answer below.`,
  };
}

export function scoreMockExam(
  exam: MockExam,
  answers: Record<string, StudentAnswerValue>,
  hintsUsedByQuestion: Record<string, number>
): ExamScoringSummary {
  const breakdowns: QuestionResultBreakdown[] = [];
  const reviewTopicsSet = new Set<string>();

  let earnedPoints = 0;
  let maxPoints = 0;
  let correctQuestionCount = 0;

  for (const question of exam.questions) {
    const hintsUsed = hintsUsedByQuestion[question.id] ?? 0;
    const result = scoreSingleQuestion(question, answers[question.id], hintsUsed);
    breakdowns.push(result);

    earnedPoints += result.earnedPoints;
    maxPoints += result.maxPoints;
    if (result.isCorrect) {
      correctQuestionCount += 1;
    } else if (question.topicTitle) {
      reviewTopicsSet.add(question.topicTitle);
    }

    if (hintsUsed >= 3 && question.topicTitle) {
      reviewTopicsSet.add(question.topicTitle);
    }
  }

  const percentage = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

  return {
    earnedPoints: Math.round(earnedPoints * 10) / 10,
    maxPoints,
    correctQuestionCount,
    totalQuestions: exam.questions.length,
    percentage,
    questionBreakdowns: breakdowns,
    recommendedReviewTopics: Array.from(reviewTopicsSet),
  };
}
