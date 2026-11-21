import React from 'react';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  Cpu,
  FolderOpen,
  Globe,
  HardDrive,
} from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import {
  LocalAiRuntimeState,
  NavRoute,
  OnlineAiStatus,
  OperatingMode,
  WorkspaceSnapshot,
} from '../types/domain';
import { formatBytes, formatShortDate, SUBJECT_ACCENT_STYLES } from '../utils/formatters';

interface DashboardPageProps {
  workspace: WorkspaceSnapshot;
  aiStatus: OnlineAiStatus | null;
  effectiveMode: OperatingMode;
  localAiState: LocalAiRuntimeState;
  onNavigate: (route: NavRoute) => void;
  onOpenExam: (examId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  workspace,
  aiStatus,
  effectiveMode,
  localAiState,
  onNavigate,
  onOpenExam,
}) => {
  const {
    profile,
    subjects,
    documents,
    topics,
    studyGuides,
    researchNotes,
    mockExams,
    examAttempts,
    storageConfig,
  } = workspace;

  const masteredCount = topics.filter((t) => t.masteryStatus === 'mastered').length;
  const averageScore =
    examAttempts.length > 0
      ? Math.round(
          examAttempts.reduce((sum, item) => sum + item.percentage, 0) / examAttempts.length
        )
      : null;

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      {/* Welcome Banner + Study Engine Context */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-700">
            Local-First Study Workspace · Philippines Grade 7–12 ·{' '}
            {effectiveMode === 'online' ? 'Online Research Ready' : 'Offline Study Mode'}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-balance">
            Magandang araw, {profile.fullName}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your subjects, uploaded documents, confirmed topics, saved research explanations, study
            guides, and mock exam attempts stay stored locally in IndexedDB for offline study.
            Items marked <span className="font-medium text-amber-700">Demo Data</span> can be
            edited or cleared anytime in Settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Add Local Document</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('mock-exams')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-blue-700" />
            <span>Practice Mock Exam</span>
          </button>
        </div>
      </section>

      {/* 4-column KPI strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('subjects')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Enrolled Subjects</span>
            <BookOpen className="w-4 h-4 text-blue-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {subjects.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {profile.gradeLevel}
            {profile.strand !== 'None' ? ` · ${profile.strand}` : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Local Documents</span>
            <FolderOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {documents.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {storageConfig.directoryName
              ? `Folder: ${storageConfig.directoryName}`
              : 'IndexedDB Metadata Store'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('topics')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Topics Mastered</span>
            <BookMarked className="w-4 h-4 text-amber-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {masteredCount} / {topics.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {studyGuides.length} offline study guide{studyGuides.length === 1 ? '' : 's'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('exam-history')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Average Mock Score</span>
            <ClipboardCheck className="w-4 h-4 text-violet-700" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {averageScore !== null ? `${averageScore}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {examAttempts.length} completed attempt{examAttempts.length === 1 ? '' : 's'}
          </p>
        </button>
      </section>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Subjects & Recent Local Documents (2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Active Subjects List */}
          <section className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Your Subjects
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organized by DepEd grade level and quarter
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('subjects')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
              >
                <span>Manage Subjects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {subjects.slice(0, 4).map((subject) => {
                const style = SUBJECT_ACCENT_STYLES[subject.accent];
                const docCount = documents.filter((d) => d.subjectId === subject.id).length;
                const topicCount = topics.filter((t) => t.subjectId === subject.id).length;
                return (
                  <div
                    key={subject.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                        <span className={`font-mono font-semibold ${style.text}`}>
                          {subject.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{subject.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{subject.quarter}</span>
                        <span aria-hidden="true">·</span>
                        <DemoLabel isDemo={subject.isDemo} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {subject.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums shrink-0">
                      <span>{topicCount} topics</span>
                      <span aria-hidden="true" className="text-slate-300">
                        |
                      </span>
                      <span>{docCount} files</span>
                    </div>
                  </div>
                );
              })}
              {subjects.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  No subjects saved locally yet. Add your first subject to begin organizing modules.
                </div>
              )}
            </div>
          </section>

          {/* Recent Local Documents */}
          <section className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Recent Study Documents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Local text extraction, OCR, and topic inventories persisted in IndexedDB
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('documents')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
              >
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {documents.slice(0, 4).map((doc) => {
                const subj = subjectById.get(doc.subjectId);
                return (
                  <div
                    key={doc.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-semibold text-slate-700 shrink-0 uppercase">
                        {doc.extension || 'doc'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {subj?.name ?? 'Unassigned Subject'} ·{' '}
                          <span className="tabular-nums">{formatBytes(doc.fileSize)}</span> ·{' '}
                          {formatShortDate(doc.addedAt)} · <DemoLabel isDemo={doc.isDemo} />
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {documents.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  No documents added yet. Upload a module or study handout in Documents.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: Quick Practice & Architecture Status */}
        <div className="space-y-6">
          {/* Quick Practice Mock Exams */}
          <section className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Offline Practice Quizzes
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('mock-exams')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {mockExams.map((exam) => {
                const subj = subjectById.get(exam.subjectId);
                return (
                  <div key={exam.id} className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{subj?.name ?? 'General'}</span>
                      <DemoLabel isDemo={exam.isDemo} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {exam.title}
                    </p>
                    <p className="text-xs text-slate-600 tabular-nums">
                      {exam.questions.length} questions · {exam.timeLimitMinutes} min limit
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenExam(exam.id)}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Start Offline Quiz
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Online Research & Offline Study Engine Summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Online Research & Offline Study Engine
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <HardDrive className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Offline Study Engine Active</p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    Documents, confirmed topics, {studyGuides.length} study guides,{' '}
                    {researchNotes.length} saved research notes, mock exams, and local scoring
                    operate offline in IndexedDB.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                <Globe className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Online Research & Verification</p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {effectiveMode === 'online' && aiStatus
                      ? 'Search-grounded academic research active with clickable .edu/.gov citations and explicit permission checks.'
                      : 'Currently in Offline Mode. Switch online to verify answers and save external academic references.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                <Cpu className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Local AI Model Status</p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {localAiState.connected && localAiState.activeModel
                      ? `Connected offline runtime: ${localAiState.activeModel}.`
                      : 'No local AI model connected. Configure Ollama/LM Studio in Settings to enable offline AI explanations.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
