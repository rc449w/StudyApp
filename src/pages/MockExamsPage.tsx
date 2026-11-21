import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Globe,
  HelpCircle,
  Lightbulb,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import { ExamGeneratorModal } from '../components/exams/ExamGeneratorModal';
import { QuestionVisualReference } from '../components/exams/QuestionVisualReference';
import { scoreMockExam } from '../services/exams/examScorer';
import { validateExamQuestions } from '../services/exams/examValidator';
import {
  ExamAttempt,
  MockExam,
  OperatingMode,
  StudentAnswerValue,
  Topic,
  WorkspaceSnapshot,
} from '../types/domain';
import { formatDuration } from '../utils/formatters';

interface MockExamsPageProps {
  workspace: WorkspaceSnapshot;
  effectiveMode: OperatingMode;
  activeExamId: string | null;
  onSelectExam: (examId: string | null) => void;
  onSaveMockExam: (exam: MockExam) => Promise<void>;
  onDeleteMockExam: (examId: string) => Promise<void>;
  onSaveAttempt: (attempt: ExamAttempt) => Promise<void>;
  onSaveTopics?: (topics: Topic[]) => Promise<void>;
  onNavigateToHistory: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Multiple Choice',
  'true-false': 'True or False',
  identification: 'Identification',
  'fill-in-the-blank': 'Fill in the Blanks',
  matching: 'Matching Type',
  'short-answer': 'Short Answer',
  essay: 'Essay',
  'problem-solving': 'Problem Solving',
  'reading-comprehension': 'Reading Comprehension',
  'situational-analysis': 'Situational Analysis',
};

export const MockExamsPage: React.FC<MockExamsPageProps> = ({
  workspace,
  effectiveMode,
  activeExamId,
  onSelectExam,
  onSaveMockExam,
  onDeleteMockExam,
  onSaveAttempt,
  onSaveTopics,
  onNavigateToHistory,
}) => {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorInitialMode, setGeneratorInitialMode] = useState<'materials' | 'general-practice'>(
    'materials'
  );
  const [answers, setAnswers] = useState<Record<string, StudentAnswerValue>>({});
  const [hintsUsed, setHintsUsed] = useState<Record<string, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submittedAttempt, setSubmittedAttempt] = useState<ExamAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subjectMap = useMemo(
    () => new Map(workspace.subjects.map((s) => [s.id, s])),
    [workspace.subjects]
  );

  const rawActiveExam: MockExam | null = useMemo(
    () => workspace.mockExams.find((e) => e.id === activeExamId) ?? null,
    [workspace.mockExams, activeExamId]
  );

  // Always validate questions, hints, and answers before displaying
  const activeExam: MockExam | null = useMemo(() => {
    if (!rawActiveExam) return null;
    const validated = validateExamQuestions(rawActiveExam.questions);
    return {
      ...rawActiveExam,
      questions: validated.validQuestions,
    };
  }, [rawActiveExam]);

  useEffect(() => {
    if (!activeExam || submittedAttempt) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeExam, submittedAttempt]);

  const startExam = (examId: string) => {
    setAnswers({});
    setHintsUsed({});
    setElapsedSeconds(0);
    setSubmittedAttempt(null);
    onSelectExam(examId);
  };

  const exitExam = () => {
    setAnswers({});
    setHintsUsed({});
    setElapsedSeconds(0);
    setSubmittedAttempt(null);
    onSelectExam(null);
  };

  const revealNextHint = (questionId: string) => {
    setHintsUsed((prev) => {
      const current = prev[questionId] ?? 0;
      if (current >= 3) return prev;
      return { ...prev, [questionId]: current + 1 };
    });
  };

  const handleSubmitExam = async () => {
    if (!activeExam) return;
    setSubmitting(true);
    try {
      const summary = scoreMockExam(activeExam, answers, hintsUsed);
      const subject = subjectMap.get(activeExam.subjectId);

      const attempt: ExamAttempt = {
        id: `attempt-${crypto.randomUUID().slice(0, 8)}`,
        examId: activeExam.id,
        examTitle: activeExam.title,
        subjectId: activeExam.subjectId,
        subjectName: subject?.name ?? 'General',
        score: summary.correctQuestionCount,
        totalQuestions: summary.totalQuestions,
        earnedPoints: summary.earnedPoints,
        maxPoints: summary.maxPoints,
        percentage: summary.percentage,
        durationSeconds: elapsedSeconds,
        answers: { ...answers },
        hintsUsedByQuestion: { ...hintsUsed },
        questionBreakdowns: summary.questionBreakdowns,
        recommendedReviewTopics: summary.recommendedReviewTopics,
        completedAt: new Date().toISOString(),
        isDemo: false,
      };

      await onSaveAttempt(attempt);
      setSubmittedAttempt(attempt);
    } finally {
      setSubmitting(false);
    }
  };

  // Interactive Exam Runner View
  if (activeExam) {
    const answeredCount = Object.keys(answers).filter((k) => {
      const val = answers[k];
      if (val === undefined || val === '') return false;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return true;
    }).length;
    const total = activeExam.questions.length;
    const totalLimitSeconds = activeExam.timeLimitMinutes * 60;
    const remainingSeconds = Math.max(0, totalLimitSeconds - elapsedSeconds);
    const isSubmitted = Boolean(submittedAttempt);

    return (
      <div className="space-y-6 max-w-4xl">
        {/* Exam Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-14 z-10 shadow-xs">
          <div className="space-y-1 min-w-0">
            <button
              type="button"
              onClick={exitExam}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mock Exams</span>
            </button>
            <h2 className="font-display text-lg font-bold text-slate-900 truncate">
              {activeExam.title}
            </h2>
            <p className="text-xs text-slate-500">
              {subjectMap.get(activeExam.subjectId)?.name ?? 'General'} · {activeExam.gradeLevel} ·{' '}
              {activeExam.quarter} · {activeExam.difficulty.toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-5 text-sm font-mono tabular-nums shrink-0">
            <div
              className={`flex items-center gap-1.5 ${
                remainingSeconds <= 60 && !isSubmitted ? 'text-red-700 font-bold' : 'text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>{isSubmitted ? formatDuration(elapsedSeconds) : formatDuration(remainingSeconds)}</span>
            </div>
            <div className="text-xs font-sans font-semibold text-slate-600">
              {answeredCount} / {total} answered
            </div>
          </div>
        </div>

        {/* Grounded Internet Curriculum References when exam used Gemini Web Search */}
        {activeExam.onlineCitations && activeExam.onlineCitations.length > 0 && (
          <section className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-950">
              <Globe className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>
                Online Curriculum References (Gemini + Google Search ·{' '}
                {activeExam.onlineCitations.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeExam.onlineCitations.map((cite) => (
                <a
                  key={cite.id}
                  href={cite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 hover:border-blue-400 rounded-md text-xs text-blue-800 max-w-[260px]"
                >
                  <span className="truncate font-medium">{cite.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Post-Submission Results & Recommended Topics */}
        {submittedAttempt && (
          <section className="bg-white border border-emerald-300 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-800">
                  Submitted & Saved to Local Examination History
                </p>
                <h3 className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  Score: {submittedAttempt.earnedPoints ?? submittedAttempt.score} /{' '}
                  {submittedAttempt.maxPoints ?? submittedAttempt.totalQuestions} pts (
                  {submittedAttempt.percentage}%)
                </h3>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  {submittedAttempt.score} of {submittedAttempt.totalQuestions} questions fully
                  satisfied · Duration {formatDuration(submittedAttempt.durationSeconds)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Open Exam History
                </button>
                <button
                  type="button"
                  onClick={() => startExam(activeExam.id)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Retake Exam
                </button>
              </div>
            </div>

            {submittedAttempt.recommendedReviewTopics &&
              submittedAttempt.recommendedReviewTopics.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Recommended Topics to Review
                  </p>
                  <ul className="text-xs text-amber-900 list-disc pl-5 space-y-0.5">
                    {submittedAttempt.recommendedReviewTopics.map((topicTitle) => (
                      <li key={topicTitle}>{topicTitle}</li>
                    ))}
                  </ul>
                </div>
              )}
          </section>
        )}

        {/* Questions List */}
        <div className="space-y-5">
          {activeExam.questions.map((q, qIndex) => {
            const val = answers[q.id];
            const revealedLevel = hintsUsed[q.id] ?? 0;
            const breakdown = submittedAttempt?.questionBreakdowns?.find(
              (b) => b.questionId === q.id
            );

            return (
              <section
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-blue-700">
                    Question {qIndex + 1} · {TYPE_LABELS[q.type] ?? q.type}
                  </span>
                  <span className="tabular-nums font-mono">{q.points} pt(s)</span>
                </div>

                {/* Passage / Scenario if Reading Comprehension or Situational Analysis */}
                {q.passage && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    <p className="font-semibold text-slate-900 mb-1">
                      {q.type === 'reading-comprehension' ? 'Source Passage' : 'Scenario'}
                    </p>
                    {q.passage}
                  </div>
                )}

                <h3 className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {q.prompt}
                </h3>

                <QuestionVisualReference
                  question={q}
                  documentContents={workspace.documentContents}
                />

                {/* Answer Controls by Question Type */}
                {(q.type === 'multiple-choice' ||
                  q.type === 'true-false' ||
                  (q.type === 'reading-comprehension' && q.choices && q.choices.length > 0)) &&
                  q.choices && (
                    <div className="grid grid-cols-1 gap-2">
                      {q.choices.map((choice, cIndex) => {
                        const isPicked = val === cIndex;
                        const isCorrectChoice = q.correctIndex === cIndex;

                        let choiceClasses =
                          'border-slate-200 bg-white hover:bg-slate-50 text-slate-800';
                        if (!isSubmitted && isPicked) {
                          choiceClasses = 'border-blue-600 bg-blue-50 text-blue-950 font-medium';
                        } else if (isSubmitted && isCorrectChoice) {
                          choiceClasses =
                            'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium';
                        } else if (isSubmitted && isPicked && !isCorrectChoice) {
                          choiceClasses = 'border-red-400 bg-red-50 text-red-900';
                        }

                        return (
                          <button
                            key={cIndex}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [q.id]: cIndex,
                              }))
                            }
                            className={`w-full text-left px-4 py-2.5 border rounded-lg text-sm transition-colors flex items-center gap-3 ${choiceClasses} ${
                              isSubmitted ? 'cursor-default' : 'cursor-pointer'
                            }`}
                          >
                            <span className="font-mono text-xs font-semibold text-slate-500 w-5 shrink-0">
                              {String.fromCharCode(65 + cIndex)}.
                            </span>
                            <span>{choice}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                {(q.type === 'identification' || q.type === 'fill-in-the-blank') && (
                  <input
                    type="text"
                    disabled={isSubmitted}
                    value={typeof val === 'string' ? val : ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Type your exact answer..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
                  />
                )}

                {q.type === 'matching' && q.matchingPairs && (
                  <div className="space-y-2.5">
                    {q.matchingPairs.map((pair, pIdx) => {
                      const currentMap =
                        typeof val === 'object' && val !== null
                          ? (val as Record<string, string>)
                          : {};
                      const options = q.matchingPairs!.map((m) => m.match);

                      return (
                        <div
                          key={pair.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-3"
                        >
                          <div className="md:col-span-7 text-xs text-slate-800">
                            <span className="font-mono font-semibold text-slate-500 mr-1.5">
                              {pIdx + 1}.
                            </span>
                            {pair.prompt}
                          </div>
                          <div className="md:col-span-5">
                            <select
                              disabled={isSubmitted}
                              value={currentMap[pair.id] ?? ''}
                              onChange={(e) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...currentMap,
                                    [pair.id]: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                            >
                              <option value="">Select match...</option>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(q.type === 'short-answer' ||
                  q.type === 'essay' ||
                  q.type === 'problem-solving' ||
                  q.type === 'situational-analysis' ||
                  (q.type === 'reading-comprehension' &&
                    (!q.choices || q.choices.length === 0))) && (
                  <textarea
                    rows={q.type === 'essay' ? 6 : 3}
                    disabled={isSubmitted}
                    value={typeof val === 'string' ? val : ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder={
                      q.type === 'problem-solving'
                        ? 'Show your solution steps and clearly state your final answer...'
                        : 'Write your response here...'
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
                  />
                )}

                {/* Progressive Subtle Hints (Visible During Exam — NEVER reveals answers) */}
                {!isSubmitted && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Subtle Hints (Indirect guidance only · {revealedLevel}/3 used)</span>
                      </span>

                      {revealedLevel < 3 && (
                        <button
                          type="button"
                          onClick={() => revealNextHint(q.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>
                            {revealedLevel === 0
                              ? 'Hint Level 1 (Memory Reminder)'
                              : revealedLevel === 1
                                ? 'Hint Level 2 (Guided Thinking)'
                                : 'Hint Level 3 (Specific Guidance)'}
                          </span>
                        </button>
                      )}
                    </div>

                    {revealedLevel >= 1 && (
                      <div className="space-y-1.5 text-xs">
                        <div className="bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2 text-amber-950">
                          <span className="font-semibold">Level 1: </span>
                          {q.hints.level1}
                        </div>
                        {revealedLevel >= 2 && (
                          <div className="bg-amber-50/85 border border-amber-200 rounded-lg px-3 py-2 text-amber-950">
                            <span className="font-semibold">Level 2: </span>
                            {q.hints.level2}
                          </div>
                        )}
                        {revealedLevel >= 3 && (
                          <div className="bg-amber-100/70 border border-amber-300 rounded-lg px-3 py-2 text-amber-950">
                            <span className="font-semibold">Level 3: </span>
                            {q.hints.level3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Post-Submission Detailed Feedback (ONLY rendered after submission) */}
                {isSubmitted && breakdown && (
                  <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          breakdown.isCorrect ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {breakdown.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        <span>
                          {breakdown.earnedPoints} / {breakdown.maxPoints} pts ·{' '}
                          {breakdown.feedback}
                        </span>
                      </span>
                      <span className="text-slate-500">Hints used: {breakdown.hintsUsedLevel}/3</span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-950">
                      <span className="font-semibold">Correct / Model Answer: </span>
                      {q.expectedAnswer}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 leading-relaxed whitespace-pre-wrap">
                      <span className="font-semibold text-slate-900">Detailed Explanation: </span>
                      {q.explanation}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-950 leading-relaxed">
                      <span className="font-semibold">Common Mistakes to Avoid: </span>
                      {q.commonMistakes}
                    </div>

                    <div className="flex items-center gap-1.5 text-blue-700 font-medium pt-0.5">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>Source Reference: {q.sourceReference}</span>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {!isSubmitted && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={exitExam}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || answeredCount === 0}
              onClick={() => void handleSubmitExam()}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Grading...' : 'Submit Examination'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Mock Exam Catalog & Generator Entry View
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-900">
            <p className="font-semibold">
              Mock Examination Generator (All 10 Question Types + 3-Level Subtle Hints)
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Generate custom mock exams directly from your confirmed topics and uploaded study
              materials. Answers and explanations stay hidden until submission.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setGeneratorInitialMode('general-practice');
              setGeneratorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            <span>General Spelling / Math Quiz</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGeneratorInitialMode('materials');
              setGeneratorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Mock Exam</span>
          </button>
        </div>
      </section>

      {workspace.mockExams.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No mock examinations yet"
          description="Generate a customized mock exam from your uploaded documents or launch a General English Spelling / Math quiz offline."
          actionLabel="Generate Mock Exam"
          onAction={() => {
            setGeneratorInitialMode('materials');
            setGeneratorOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workspace.mockExams.map((exam) => {
            const subj = subjectMap.get(exam.subjectId);
            const pastAttempts = workspace.examAttempts.filter((a) => a.examId === exam.id);

            return (
              <article
                key={exam.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {subj?.name ?? 'General'} · {exam.gradeLevel} · {exam.quarter}
                    </span>
                    <DemoLabel
                      isDemo={exam.isDemo}
                      customLabel={
                        exam.sourceMode === 'online-ai-generated'
                          ? exam.onlineCitations?.length
                            ? 'AI · Web Grounded'
                            : 'AI Generated'
                          : 'Generated Offline'
                      }
                    />
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">{exam.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{exam.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 tabular-nums">
                    {exam.questions.length} items · {exam.timeLimitMinutes} min ·{' '}
                    <span className="capitalize">{exam.difficulty}</span> · {pastAttempts.length}{' '}
                    attempt{pastAttempts.length === 1 ? '' : 's'}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!exam.isDemo && (
                      <button
                        type="button"
                        onClick={() => void onDeleteMockExam(exam.id)}
                        aria-label={`Delete ${exam.title}`}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startExam(exam.id)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Start Exam
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {generatorOpen && (
        <ExamGeneratorModal
          workspace={workspace}
          effectiveMode={effectiveMode}
          initialSourceMode={generatorInitialMode}
          onClose={() => setGeneratorOpen(false)}
          onSaveTopics={onSaveTopics}
          onGeneratedExam={async (exam) => {
            await onSaveMockExam(exam);
            startExam(exam.id);
          }}
        />
      )}
    </div>
  );
};
