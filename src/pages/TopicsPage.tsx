import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import { DiscoveredOnlineTopicPayload, onlineAiClient } from '../services/ai/onlineAiClient';
import { mapDiscoveredTopicToTopic, termPeriodToQuarter } from '../services/ai/onlineTopicMapper';
import {
  GradeLevel,
  OperatingMode,
  Quarter,
  ResearchCitation,
  TermPeriod,
  Topic,
  TopicMastery,
  WorkspaceSnapshot,
} from '../types/domain';
import { formatShortDate } from '../utils/formatters';

interface TopicsPageProps {
  workspace: WorkspaceSnapshot;
  effectiveMode: OperatingMode;
  onSaveTopic: (topic: Topic) => Promise<void>;
  onSaveTopics?: (topics: Topic[]) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
}

const MASTERY_CONFIG: Record<
  TopicMastery,
  { label: string; textClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  'not-started': {
    label: 'Not Started',
    textClass: 'text-slate-600',
    icon: Circle,
  },
  'in-progress': {
    label: 'In Progress',
    textClass: 'text-amber-700',
    icon: Clock,
  },
  mastered: {
    label: 'Mastered',
    textClass: 'text-emerald-700',
    icon: CheckCircle2,
  },
};

const NEXT_MASTERY: Record<TopicMastery, TopicMastery> = {
  'not-started': 'in-progress',
  'in-progress': 'mastered',
  mastered: 'not-started',
};

export const TopicsPage: React.FC<TopicsPageProps> = ({
  workspace,
  effectiveMode,
  onSaveTopic,
  onSaveTopics,
  onDeleteTopic,
}) => {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [masteryFilter, setMasteryFilter] = useState<string>('ALL');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const [onlineSubjectId, setOnlineSubjectId] = useState(workspace.subjects[0]?.id ?? '');
  const [onlineGradeLevel, setOnlineGradeLevel] = useState<GradeLevel>(
    workspace.subjects[0]?.gradeLevel ?? workspace.profile.gradeLevel
  );
  const [onlineQuarter, setOnlineQuarter] = useState<TermPeriod>('Quarter 1');
  const [onlineFocus, setOnlineFocus] = useState('');
  const [fetchingOnline, setFetchingOnline] = useState(false);
  const [fetchingOpenWeb, setFetchingOpenWeb] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [discoveredTopics, setDiscoveredTopics] = useState<DiscoveredOnlineTopicPayload[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [discoveredCitations, setDiscoveredCitations] = useState<ResearchCitation[]>([]);
  const [savingOnline, setSavingOnline] = useState(false);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(workspace.subjects[0]?.id ?? '');
  const [quarter, setQuarter] = useState<Quarter>('Q1');
  const [summary, setSummary] = useState('');
  const [masteryStatus, setMasteryStatus] = useState<TopicMastery>('not-started');

  const subjectMap = useMemo(
    () => new Map(workspace.subjects.map((s) => [s.id, s])),
    [workspace.subjects]
  );

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.topics.filter((t) => {
      if (subjectFilter !== 'ALL' && t.subjectId !== subjectFilter) return false;
      if (masteryFilter !== 'ALL' && t.masteryStatus !== masteryFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        (t.sourceFileName ?? '').toLowerCase().includes(q)
      );
    });
  }, [workspace.topics, search, subjectFilter, masteryFilter]);

  const handleToggleMastery = async (topic: Topic) => {
    await onSaveTopic({
      ...topic,
      masteryStatus: NEXT_MASTERY[topic.masteryStatus],
      isDemo: topic.isDemo,
    });
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onSaveTopic({
      id: `topic-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: subjectId || workspace.subjects[0]?.id || '',
      title: title.trim(),
      quarter,
      summary: summary.trim() || 'Curriculum topic added locally.',
      masteryStatus,
      linkedDocumentIds: [],
      isDemo: false,
      updatedAt: new Date().toISOString(),
    });

    setTitle('');
    setSummary('');
    setModalOpen(false);
  };

  const handleOpenOnlineModal = () => {
    const initialSubjId =
      subjectFilter !== 'ALL' ? subjectFilter : (workspace.subjects[0]?.id ?? '');
    const subj = workspace.subjects.find((s) => s.id === initialSubjId) ?? workspace.subjects[0];
    setOnlineSubjectId(subj?.id ?? '');
    setOnlineGradeLevel(subj?.gradeLevel ?? workspace.profile.gradeLevel);
    setOnlineError(null);
    setDiscoveredTopics([]);
    setSelectedIndices([]);
    setDiscoveredCitations([]);
    setOnlineModalOpen(true);
  };

  const handleFetchOnlineTopics = async (e: React.FormEvent) => {
    e.preventDefault();
    const subj = subjectMap.get(onlineSubjectId) ?? workspace.subjects[0];
    if (!subj) {
      setOnlineError('Please create a subject first.');
      return;
    }
    if (effectiveMode !== 'online') {
      setOnlineError('Switch to Online Mode in the top bar to fetch topics from the internet.');
      return;
    }

    setOnlineError(null);
    setFetchingOnline(true);
    try {
      const res = await onlineAiClient.discoverOnlineTopics({
        subjectName: subj.name,
        gradeLevel: onlineGradeLevel,
        quarter: onlineQuarter,
        topicFocus: onlineFocus.trim() || undefined,
        count: 5,
      });

      if (!res.success || !res.topics || res.topics.length === 0) {
        setOnlineError(res.error ?? 'No curriculum topics could be retrieved online.');
        return;
      }

      setDiscoveredTopics(res.topics);
      setSelectedIndices(res.topics.map((_, idx) => idx));
      setDiscoveredCitations(res.citations ?? []);
    } finally {
      setFetchingOnline(false);
    }
  };

  const handleFetchOpenWebTopics = async () => {
    const subj = subjectMap.get(onlineSubjectId) ?? workspace.subjects[0];
    if (!subj) {
      setOnlineError('Please create a subject first.');
      return;
    }
    if (effectiveMode !== 'online') {
      setOnlineError('Switch to Online Mode in the top bar to search the open web.');
      return;
    }

    setOnlineError(null);
    setFetchingOpenWeb(true);
    try {
      const res = await onlineAiClient.discoverOpenWebTopics({
        subjectName: subj.name,
        gradeLevel: onlineGradeLevel,
        quarter: onlineQuarter,
        topicFocus: onlineFocus.trim() || undefined,
        count: 4,
      });

      if (!res.success || !res.topics || res.topics.length === 0) {
        setOnlineError(res.error ?? 'No open encyclopedia topics matched your query.');
        return;
      }

      setDiscoveredTopics(res.topics);
      setSelectedIndices(res.topics.map((_, idx) => idx));
      setDiscoveredCitations(res.citations ?? []);
    } finally {
      setFetchingOpenWeb(false);
    }
  };

  const handleImportOnlineTopics = async () => {
    const targetSubjId = onlineSubjectId || workspace.subjects[0]?.id || '';
    if (!targetSubjId || selectedIndices.length === 0) return;

    setSavingOnline(true);
    setOnlineError(null);
    try {
      const quarterCode = termPeriodToQuarter(onlineQuarter);
      const toSave = selectedIndices
        .map((idx) => discoveredTopics[idx])
        .filter(Boolean)
        .map((item) =>
          mapDiscoveredTopicToTopic({
            item,
            subjectId: targetSubjId,
            quarter: quarterCode,
            citations: discoveredCitations,
          })
        );

      if (onSaveTopics) {
        await onSaveTopics(toSave);
      } else {
        for (const t of toSave) {
          await onSaveTopic(t);
        }
      }

      setOnlineModalOpen(false);
    } finally {
      setSavingOnline(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic titles, competencies, or source files..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter topics by subject"
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Subjects</option>
            {workspace.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'not-started', 'in-progress', 'mastered'] as const).map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => setMasteryFilter(state)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  masteryFilter === state
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {state === 'ALL' ? 'All' : MASTERY_CONFIG[state].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={effectiveMode !== 'online'}
            title={
              effectiveMode !== 'online'
                ? 'Switch to Online Mode in the top bar to fetch topics from the internet'
                : 'Fetch curriculum topics from the internet using Gemini + Google Search'
            }
            onClick={handleOpenOnlineModal}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Globe className="w-4 h-4" />
            <span>Fetch Online (Gemini)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubjectId(workspace.subjects[0]?.id ?? '');
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>
        </div>
      </div>

      {/* Topic List */}
      {filteredTopics.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No topics match your filters"
          description="Create curriculum topics, upload documents, or fetch DepEd/academic topics from the internet using Gemini when online."
          actionLabel={effectiveMode === 'online' ? 'Fetch Topics Online (Gemini)' : 'Add Topic'}
          onAction={() => (effectiveMode === 'online' ? handleOpenOnlineModal() : setModalOpen(true))}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {filteredTopics.map((topic) => {
            const subj = subjectMap.get(topic.subjectId);
            const mastery = MASTERY_CONFIG[topic.masteryStatus];
            const MasteryIcon = mastery.icon;
            const hasDetails =
              (topic.subtopics?.length ?? 0) > 0 ||
              (topic.definitions?.length ?? 0) > 0 ||
              (topic.formulas?.length ?? 0) > 0 ||
              (topic.examples?.length ?? 0) > 0 ||
              (topic.importantConcepts?.length ?? 0) > 0 ||
              (topic.citations?.length ?? 0) > 0;
            const isExpanded = expandedTopicId === topic.id;

            return (
              <div key={topic.id} className="p-5 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {subj?.name ?? 'Unassigned Subject'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{topic.quarter}</span>
                      {topic.chapter && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{topic.chapter}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Updated {formatShortDate(topic.updatedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <DemoLabel
                        isDemo={topic.isDemo}
                        customLabel={
                          topic.sourceAttribution === 'internet-search-grounded'
                            ? 'Online Web'
                            : 'Confirmed'
                        }
                      />
                    </div>

                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {topic.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                      {topic.summary}
                    </p>

                    {topic.sourceFileName && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-700 pt-0.5">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Source: {topic.sourceFileName}
                          {topic.pageRef ? ` · ${topic.pageRef}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <span>Concepts</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleToggleMastery(topic)}
                      title="Click to cycle mastery status"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${mastery.textClass}`}
                    >
                      <MasteryIcon className="w-3.5 h-3.5" />
                      <span>{mastery.label}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTopic(topic.id)}
                      aria-label={`Delete ${topic.title}`}
                      className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Extracted Concepts, Definitions, Formulas & Examples */}
                {isExpanded && hasDetails && (
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {topic.subtopics && topic.subtopics.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Subtopics</p>
                        <p className="text-slate-600">{topic.subtopics.join(' · ')}</p>
                      </div>
                    )}

                    {topic.definitions && topic.definitions.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Definitions</p>
                        <ul className="space-y-1 text-slate-600 list-disc pl-4">
                          {topic.definitions.map((d) => (
                            <li key={d.id}>
                              {d.content}{' '}
                              <span className="text-slate-400">({d.pageRef})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {topic.formulas && topic.formulas.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Formulas</p>
                        <ul className="space-y-1 font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                          {topic.formulas.map((f) => (
                            <li key={f.id}>
                              {f.content}{' '}
                              <span className="font-sans text-slate-400">({f.pageRef})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {topic.examples && topic.examples.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Examples</p>
                        <ul className="space-y-1 text-slate-600 list-disc pl-4">
                          {topic.examples.map((ex) => (
                            <li key={ex.id}>
                              {ex.content}{' '}
                              <span className="text-slate-400">({ex.pageRef})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {topic.importantConcepts && topic.importantConcepts.length > 0 && (
                      <div className="md:col-span-2">
                        <p className="font-semibold text-slate-800 mb-1">Important Concepts</p>
                        <ul className="space-y-1 text-slate-600 list-disc pl-4">
                          {topic.importantConcepts.map((c) => (
                            <li key={c.id}>
                              {c.content}{' '}
                              <span className="text-slate-400">({c.pageRef})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {topic.citations && topic.citations.length > 0 && (
                      <div className="md:col-span-2 pt-1">
                        <p className="font-semibold text-slate-800 mb-1.5">
                          Referenced Web Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {topic.citations.map((cite) => (
                            <a
                              key={cite.id}
                              href={cite.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-md text-blue-700 hover:underline max-w-[260px]"
                            >
                              <span className="truncate">{cite.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fetch Online Curriculum Topics Modal (Gemini + Google Search) */}
      {onlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-700" />
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Access Topics from the Internet (Gemini + Web Search)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Discover DepEd &amp; academic curriculum topics online and save them to your
                    offline Topic Library
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={fetchingOnline || savingOnline}
                onClick={() => setOnlineModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <form onSubmit={handleFetchOnlineTopics} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subject
                    </label>
                    <select
                      value={onlineSubjectId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setOnlineSubjectId(id);
                        const s = subjectMap.get(id);
                        if (s) setOnlineGradeLevel(s.gradeLevel);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {workspace.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.gradeLevel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Grade Level
                    </label>
                    <select
                      value={onlineGradeLevel}
                      onChange={(e) => setOnlineGradeLevel(e.target.value as GradeLevel)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'] as GradeLevel[]).map(
                        (g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quarter / Semester
                    </label>
                    <select
                      value={onlineQuarter}
                      onChange={(e) => setOnlineQuarter(e.target.value as TermPeriod)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {(
                        [
                          'Quarter 1',
                          'Quarter 2',
                          'Quarter 3',
                          'Quarter 4',
                          '1st Semester',
                          '2nd Semester',
                        ] as TermPeriod[]
                      ).map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={onlineFocus}
                    onChange={(e) => setOnlineFocus(e.target.value)}
                    placeholder="Optional topic focus (e.g. How to fight fake news, Context Clues) or leave blank for quarter"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={fetchingOnline || fetchingOpenWeb || effectiveMode !== 'online'}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {fetchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>{fetchingOnline ? 'Searching Gemini...' : 'Search Topics Online'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={fetchingOnline || fetchingOpenWeb || effectiveMode !== 'online'}
                    onClick={() => void handleFetchOpenWebTopics()}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {fetchingOpenWeb ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-blue-700" />
                    )}
                    <span>{fetchingOpenWeb ? 'Searching Web...' : 'Search Open Web (Wikipedia)'}</span>
                  </button>
                </div>
              </form>

              {onlineError && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                    <span>{onlineError}</span>
                  </div>
                  {(onlineError.includes('429') || onlineError.toLowerCase().includes('quota')) && (
                    <div className="pl-6">
                      <button
                        type="button"
                        disabled={fetchingOpenWeb || effectiveMode !== 'online'}
                        onClick={() => void handleFetchOpenWebTopics()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-900 bg-white border border-blue-300 hover:bg-blue-50 rounded-md cursor-pointer disabled:opacity-50"
                      >
                        <Globe className="w-3.5 h-3.5 text-blue-700" />
                        <span>
                          {fetchingOpenWeb
                            ? 'Searching Open Web...'
                            : 'Try Open Web (Wikipedia · No Quota)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {discoveredTopics.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Found {discoveredTopics.length} Topic(s) ({selectedIndices.length} selected)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIndices(
                          selectedIndices.length === discoveredTopics.length
                            ? []
                            : discoveredTopics.map((_, i) => i)
                        )
                      }
                      className="text-blue-700 font-semibold hover:underline cursor-pointer"
                    >
                      {selectedIndices.length === discoveredTopics.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-64 overflow-y-auto">
                    {discoveredTopics.map((item, idx) => {
                      const checked = selectedIndices.includes(idx);
                      return (
                        <label
                          key={`${item.title}-${idx}`}
                          className="flex items-start gap-3 p-3.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedIndices((prev) =>
                                prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                              )
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.chapter} · {item.lesson}
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed">{item.summary}</p>
                            {item.subtopics.length > 0 && (
                              <p className="text-[11px] text-slate-500">
                                Subtopics: {item.subtopics.join(', ')}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {discoveredCitations.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-700">
                        Verified Web Sources ({discoveredCitations.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {discoveredCitations.map((cite) => (
                          <a
                            key={cite.id}
                            href={cite.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-blue-700 hover:underline max-w-[230px]"
                          >
                            <span className="truncate">{cite.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingOnline}
                onClick={() => setOnlineModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingOnline || selectedIndices.length === 0}
                onClick={() => void handleImportOnlineTopics()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {savingOnline
                  ? 'Saving Offline...'
                  : `Save ${selectedIndices.length} Topic(s) to Library`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Add Curriculum Topic
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Exponential and Logarithmic Equations"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {workspace.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quarter
                  </label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value as Quarter)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Mastery Status
                </label>
                <select
                  value={masteryStatus}
                  onChange={(e) => setMasteryStatus(e.target.value as TopicMastery)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="not-started">Not Started</option>
                  <option value="in-progress">In Progress</option>
                  <option value="mastered">Mastered</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic Summary / Competency
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Learning objectives or DepEd competency notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
