import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Eye, History, X, XCircle } from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import { ExamAttempt, StudentAnswerValue, WorkspaceSnapshot } from '../types/domain';
import { formatDuration, formatShortDate } from '../utils/formatters';

interface ExamHistoryPageProps {
  workspace: WorkspaceSnapshot;
  onGoToMockExams: () => void;
}

function formatStudentAnswer(
  answer: StudentAnswerValue | undefined,
  choices?: string[]
): string {
  if (answer === undefined || answer === '') return 'No answer submitted';
  if (typeof answer === 'number') {
    return choices?.[answer] ?? `Option ${answer + 1}`;
  }
  if (typeof answer === 'object') {
    return Object.entries(answer)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  }
  return String(answer);
}

export const ExamHistoryPage: React.FC<ExamHistoryPageProps> = ({
  workspace,
  onGoToMockExams,
}) => {
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);

  const examMap = useMemo(
    () => new Map(workspace.mockExams.map((e) => [e.id, e])),
    [workspace.mockExams]
  );

  const filteredAttempts = useMemo(() => {
    if (subjectFilter === 'ALL') return workspace.examAttempts;
    return workspace.examAttempts.filter((a) => a.subjectId === subjectFilter);
  }, [workspace.examAttempts, subjectFilter]);

  const reviewExam = reviewAttempt ? examMap.get(reviewAttempt.examId) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Completed Mock Examinations ({filteredAttempts.length})
          </h2>
          <p className="text-xs text-slate-500">
            Persisted in IndexedDB · Includes demo records and your submitted mock examinations
          </p>
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filter exam history by subject"
          className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="ALL">All Subjects</option>
          {workspace.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {filteredAttempts.length === 0 ? (
        <EmptyState
          icon={History}
          title="No examination history yet"
          description="Complete a mock examination to record your score, time spent, common mistakes, and topic review recommendations."
          actionLabel="Open Mock Exams"
          onAction={onGoToMockExams}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Examination</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right">Percentage</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredAttempts.map((attempt) => {
                  const passed = attempt.percentage >= 75;
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <p className="font-medium text-slate-900">{attempt.examTitle}</p>
                        <DemoLabel isDemo={attempt.isDemo} customLabel="Student Attempt" />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {attempt.subjectName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {attempt.earnedPoints ?? attempt.score} /{' '}
                        {attempt.maxPoints ?? attempt.totalQuestions}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          passed ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {attempt.percentage}% {passed ? '· Passed' : '· Review'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDuration(attempt.durationSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatShortDate(attempt.completedAt)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setReviewAttempt(attempt)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attempt Review Modal */}
      {reviewAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-slate-900 truncate">
                  {reviewAttempt.examTitle}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  Score: {reviewAttempt.earnedPoints ?? reviewAttempt.score}/
                  {reviewAttempt.maxPoints ?? reviewAttempt.totalQuestions} (
                  {reviewAttempt.percentage}%) · {formatShortDate(reviewAttempt.completedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewAttempt(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto bg-slate-50">
              {reviewAttempt.recommendedReviewTopics &&
                reviewAttempt.recommendedReviewTopics.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950">
                    <p className="font-semibold mb-1">Recommended Topics to Review</p>
                    <p>{reviewAttempt.recommendedReviewTopics.join(' · ')}</p>
                  </div>
                )}

              {reviewExam ? (
                reviewExam.questions.map((q, idx) => {
                  const chosen = reviewAttempt.answers[q.id];
                  const breakdown = reviewAttempt.questionBreakdowns?.find(
                    (b) => b.questionId === q.id
                  );
                  const isCorrect =
                    breakdown?.isCorrect ??
                    (typeof chosen === 'number' && chosen === q.correctIndex);

                  return (
                    <div
                      key={q.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {q.prompt}
                        </p>
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Your answer:</span>{' '}
                        {formatStudentAnswer(chosen, q.choices)}
                      </p>
                      <p className="text-xs text-emerald-700">
                        <span className="font-semibold">Correct / Model answer:</span>{' '}
                        {q.expectedAnswer}
                      </p>
                      <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-800">Explanation: </span>
                        {q.explanation}
                      </p>
                      <p className="text-xs text-amber-900">
                        <span className="font-semibold">Common Mistakes: </span>
                        {q.commonMistakes}
                      </p>
                      <p className="text-xs text-blue-700 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{q.sourceReference}</span>
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-600">
                  Original question definitions are unavailable for this archived attempt.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
