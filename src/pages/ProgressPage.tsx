import React from 'react';
import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { WorkspaceSnapshot } from '../types/domain';
import { SUBJECT_ACCENT_STYLES } from '../utils/formatters';

interface ProgressPageProps {
  workspace: WorkspaceSnapshot;
  onGoToTopics: () => void;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({ workspace, onGoToTopics }) => {
  const { subjects, topics, documents, studyGuides, examAttempts } = workspace;

  const totalTopics = topics.length;
  const masteredTopics = topics.filter((t) => t.masteryStatus === 'mastered').length;
  const inProgressTopics = topics.filter((t) => t.masteryStatus === 'in-progress').length;
  const overallMasteryPct =
    totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;

  const avgExamPct =
    examAttempts.length > 0
      ? Math.round(examAttempts.reduce((acc, a) => acc + a.percentage, 0) / examAttempts.length)
      : null;

  return (
    <div className="space-y-6">
      {/* Top Metric Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Overall Topic Mastery</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {overallMasteryPct}%
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {masteredTopics} mastered · {inProgressTopics} in progress · {totalTopics} total
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Mock Exam Average</span>
            <ClipboardCheck className="w-4 h-4 text-blue-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {avgExamPct !== null ? `${avgExamPct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Computed from {examAttempts.length} local attempt{examAttempts.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Offline Study Materials</span>
            <BookOpen className="w-4 h-4 text-amber-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {documents.length + studyGuides.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {documents.length} local files · {studyGuides.length} study guides
          </p>
        </div>
      </section>

      {/* Subject-by-Subject Progress */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No subject progress data yet"
          description="Add subjects and curriculum topics to visualize mastery progress across quarters."
          actionLabel="Open Topic Library"
          onAction={onGoToTopics}
        />
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Subject Mastery Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated live from your IndexedDB topics, study guides, and mock exam history
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {subjects.map((subject) => {
              const subjTopics = topics.filter((t) => t.subjectId === subject.id);
              const subjMastered = subjTopics.filter((t) => t.masteryStatus === 'mastered').length;
              const subjPct =
                subjTopics.length > 0 ? Math.round((subjMastered / subjTopics.length) * 100) : 0;
              const subjAttempts = examAttempts.filter((a) => a.subjectId === subject.id);
              const subjAvg =
                subjAttempts.length > 0
                  ? Math.round(
                      subjAttempts.reduce((acc, item) => acc + item.percentage, 0) /
                        subjAttempts.length
                    )
                  : null;
              const style = SUBJECT_ACCENT_STYLES[subject.accent];

              return (
                <div key={subject.id} className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono font-semibold text-slate-500">
                        {subject.code} · {subject.gradeLevel} · {subject.quarter}
                      </p>
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {subject.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-5 text-xs text-slate-600 tabular-nums">
                      <span>
                        Topics: <strong className="text-slate-900">{subjMastered}</strong> /{' '}
                        {subjTopics.length}
                      </span>
                      <span>
                        Exam Avg:{' '}
                        <strong className="text-slate-900">
                          {subjAvg !== null ? `${subjAvg}%` : 'No attempts'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${style.bar} transition-all duration-300`}
                      style={{ width: `${subjPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
