import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  Globe,
  HardDrive,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { localAiClient } from '../services/ai/localAiClient';
import { onlineAiClient } from '../services/ai/onlineAiClient';
import { matchLocalStudyMaterials } from '../services/research/localMaterialMatcher';
import {
  CitationAuthorityTier,
  LocalAiRuntimeState,
  OperatingMode,
  ResearchCitation,
  ResearchNote,
  StudyGuide,
  VerificationVerdict,
  WorkspaceSnapshot,
} from '../types/domain';
import { formatShortDate } from '../utils/formatters';

interface ResearchPageProps {
  workspace: WorkspaceSnapshot;
  effectiveMode: OperatingMode;
  localAiState: LocalAiRuntimeState;
  onSaveResearchNote: (note: ResearchNote) => Promise<void>;
  onDeleteResearchNote: (noteId: string) => Promise<void>;
  onSaveStudyGuide: (guide: StudyGuide) => Promise<void>;
  onOpenSettings: () => void;
  onOpenStudyGuides: () => void;
}

const VERDICT_META: Record<
  VerificationVerdict,
  { label: string; style: string }
> = {
  verified: {
    label: 'Verified by Academic Sources',
    style: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  'partially-supported': {
    label: 'Partially Supported · Check Notes',
    style: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  'needs-clarification': {
    label: 'Needs Clarification',
    style: 'text-red-800 bg-red-50 border-red-200',
  },
  'supplementary-only': {
    label: 'Supplementary Reference',
    style: 'text-blue-800 bg-blue-50 border-blue-200',
  },
  'unverified-local-ai': {
    label: 'Local AI Draft · Not Web-Verified',
    style: 'text-slate-800 bg-slate-100 border-slate-300',
  },
};

const TIER_LABEL: Record<CitationAuthorityTier, { label: string; textClass: string }> = {
  'official-edu-gov': {
    label: 'Official Institution (.edu / .gov)',
    textClass: 'text-emerald-700',
  },
  'academic-reference': {
    label: 'Academic Reference',
    textClass: 'text-blue-700',
  },
  'educational-web': {
    label: 'Educational Resource',
    textClass: 'text-slate-600',
  },
};

export const ResearchPage: React.FC<ResearchPageProps> = ({
  workspace,
  effectiveMode,
  localAiState,
  onSaveResearchNote,
  onDeleteResearchNote,
  onSaveStudyGuide,
  onOpenSettings,
  onOpenStudyGuides,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    workspace.subjects[0]?.id ?? ''
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [claimToVerify, setClaimToVerify] = useState('');
  const [attachUploadedContext, setAttachUploadedContext] = useState(false);
  const [userConfirmedPermission, setUserConfirmedPermission] = useState(false);

  const [isResearching, setIsResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [activeDraftResult, setActiveDraftResult] = useState<ResearchNote | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const [historyFilterSubject, setHistoryFilterSubject] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedSavedId, setSelectedSavedId] = useState<string>(
    workspace.researchNotes[0]?.id ?? ''
  );

  const subjectMap = useMemo(
    () => new Map(workspace.subjects.map((s) => [s.id, s])),
    [workspace.subjects]
  );

  const subjectTopics = useMemo(
    () =>
      workspace.topics.filter((t) =>
        selectedSubjectId ? t.subjectId === selectedSubjectId : true
      ),
    [workspace.topics, selectedSubjectId]
  );

  const localMatchPreview = useMemo(() => {
    const topicTitle = subjectTopics.find((t) => t.id === selectedTopicId)?.title ?? '';
    const effectiveQuery = query.trim() || topicTitle;
    if (!effectiveQuery && !selectedTopicId) {
      return { hasMatches: false, summaryText: null, sourceRefs: [], matchedTopics: [] };
    }
    return matchLocalStudyMaterials({
      query: effectiveQuery,
      subjectId: selectedSubjectId || undefined,
      selectedTopicId: selectedTopicId || undefined,
      topics: workspace.topics,
      documentContents: workspace.documentContents,
      studyGuides: workspace.studyGuides,
    });
  }, [
    query,
    selectedSubjectId,
    selectedTopicId,
    subjectTopics,
    workspace.topics,
    workspace.documentContents,
    workspace.studyGuides,
  ]);

  const filteredSavedNotes = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return workspace.researchNotes.filter((note) => {
      if (historyFilterSubject !== 'ALL' && note.subjectId !== historyFilterSubject) {
        return false;
      }
      if (!q) return true;
      return (
        note.query.toLowerCase().includes(q) ||
        note.externalExplanation.toLowerCase().includes(q) ||
        (note.topicTitle ?? '').toLowerCase().includes(q)
      );
    });
  }, [workspace.researchNotes, historyFilterSubject, historySearch]);

  const activeSavedNote =
    filteredSavedNotes.find((n) => n.id === selectedSavedId) ?? filteredSavedNotes[0] ?? null;

  const canRunOnlineResearch = effectiveMode === 'online';
  const canRunLocalAi = localAiState.connected && Boolean(localAiState.activeModel);

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId);
    const topic = subjectTopics.find((t) => t.id === topicId);
    if (topic && !query.trim()) {
      setQuery(`Verify and expand on ${topic.title}`);
    }
  };

  const handleRunResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setResearchError(null);
    setSavedFeedback(null);

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResearchError('Please enter a topic, question, or concept to research or verify.');
      return;
    }

    const subj = subjectMap.get(selectedSubjectId);
    const selectedTopic = subjectTopics.find((t) => t.id === selectedTopicId);

    // Offline Mode path: strictly use connected Local AI if available; never spoof AI offline
    if (!canRunOnlineResearch) {
      if (!canRunLocalAi) {
        setResearchError(
          'Online web research is unavailable in Offline Mode and no local AI model is connected. Browse your saved research notes, uploaded documents, topics, and offline study guides below.'
        );
        return;
      }

      setIsResearching(true);
      try {
        const localReply = await localAiClient.askLocalStudyAssistant(
          workspace.localAiConfig,
          localAiState,
          {
            query: trimmedQuery,
            subjectName: subj?.name ?? 'General Academics',
            gradeLevel: workspace.profile.gradeLevel,
            claimToVerify: claimToVerify.trim() || undefined,
            uploadedMaterialSummary: localMatchPreview.summaryText,
          }
        );

        if (!localReply.success) {
          setResearchError(
            localReply.error ?? 'Connected local AI runtime failed to respond.'
          );
          return;
        }

        setActiveDraftResult({
          id: `res-${crypto.randomUUID().slice(0, 8)}`,
          subjectId: selectedSubjectId || workspace.subjects[0]?.id || '',
          topicId: selectedTopic?.id,
          topicTitle: selectedTopic?.title,
          query: trimmedQuery,
          claimToVerify: claimToVerify.trim() || undefined,
          gradeLevel: workspace.profile.gradeLevel,
          uploadedMaterialSummary: localMatchPreview.summaryText,
          uploadedSourceRefs: localMatchPreview.sourceRefs,
          externalExplanation: localReply.explanation,
          verificationVerdict: 'unverified-local-ai',
          verificationSummary: localReply.verificationSummary,
          keyTakeaways: localReply.keyTakeaways,
          citations: [],
          sourceEngine: 'local-ai',
          modelUsed: localReply.modelUsed,
          sharedUploadedContextWithOnlineAi: false,
          savedOfflineAt: new Date().toISOString(),
          isDemo: false,
        });
      } finally {
        setIsResearching(false);
      }
      return;
    }

    // Online Mode path: enforce explicit student permission before transmitting document excerpts
    if (attachUploadedContext && !userConfirmedPermission) {
      setResearchError(
        'Please check the explicit permission box before sharing uploaded school material excerpts with Online AI, or uncheck "Include uploaded document excerpt".'
      );
      return;
    }

    setIsResearching(true);
    try {
      const response = await onlineAiClient.researchTopicOnline({
        query: trimmedQuery,
        subjectName: subj?.name ?? 'General Academics',
        gradeLevel: workspace.profile.gradeLevel,
        claimToVerify: claimToVerify.trim() || undefined,
        attachUploadedContext,
        userConfirmedPermission,
        uploadedContextExcerpt:
          attachUploadedContext && userConfirmedPermission
            ? localMatchPreview.summaryText ?? undefined
            : undefined,
      });

      if (!response.success) {
        setResearchError(response.error ?? 'Online research request failed.');
        return;
      }

      const citations: ResearchCitation[] = (response.citations ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        url: c.url,
        domain: c.domain,
        sourceTier: c.sourceTier,
      }));

      setActiveDraftResult({
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        subjectId: selectedSubjectId || workspace.subjects[0]?.id || '',
        topicId: selectedTopic?.id,
        topicTitle: selectedTopic?.title,
        query: trimmedQuery,
        claimToVerify: claimToVerify.trim() || undefined,
        gradeLevel: workspace.profile.gradeLevel,
        uploadedMaterialSummary: localMatchPreview.summaryText,
        uploadedSourceRefs: localMatchPreview.sourceRefs,
        externalExplanation: response.externalExplanation ?? '',
        verificationVerdict: response.verificationVerdict ?? 'supplementary-only',
        verificationSummary: response.verificationSummary ?? 'Online academic research completed.',
        keyTakeaways: response.keyTakeaways ?? [],
        citations,
        sourceEngine: 'online-search-grounded',
        modelUsed: response.model ?? 'gemini-4-hydrogen',
        sharedUploadedContextWithOnlineAi: attachUploadedContext && userConfirmedPermission,
        savedOfflineAt: new Date().toISOString(),
        isDemo: false,
      });
    } finally {
      setIsResearching(false);
    }
  };

  const handleSaveDraftOffline = async () => {
    if (!activeDraftResult) return;
    const noteToSave: ResearchNote = {
      ...activeDraftResult,
      savedOfflineAt: new Date().toISOString(),
    };
    await onSaveResearchNote(noteToSave);
    setSelectedSavedId(noteToSave.id);
    setSavedFeedback('Saved to local IndexedDB for offline access.');
  };

  const handleConvertToStudyGuide = async (note: ResearchNote) => {
    const citationLines =
      note.citations.length > 0
        ? note.citations.map((c) => `- ${c.title} (${c.domain}): ${c.url}`).join('\n')
        : '- No external URLs attached (generated via connected offline local AI).';

    const bodySections = [
      '## 1. Uploaded Learning Materials (Local School Files)',
      note.uploadedMaterialSummary
        ? `${note.uploadedMaterialSummary}\n\nSources: ${note.uploadedSourceRefs.join(', ')}`
        : 'No uploaded document excerpt matched this query.',
      '',
      note.sourceEngine === 'online-search-grounded'
        ? '## 2. External Academic Research & Verification'
        : `## 2. Offline Local AI Notes (${note.modelUsed})`,
      `Verification Status: ${VERDICT_META[note.verificationVerdict].label}`,
      note.verificationSummary,
      '',
      note.externalExplanation,
      '',
      '## 3. Referenced Citations',
      citationLines,
    ];

    const guide: StudyGuide = {
      id: `guide-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: note.subjectId || workspace.subjects[0]?.id || '',
      topicId: note.topicId,
      title: `Research Reviewer: ${note.query.slice(0, 64)}`,
      summary: note.verificationSummary,
      keyConcepts:
        note.keyTakeaways.length > 0 ? note.keyTakeaways : [note.verificationSummary],
      bodyMarkdown: bodySections.join('\n'),
      sourceMode: note.sourceEngine === 'local-ai' ? 'local-ai' : 'offline-saved-research',
      isDemo: false,
      updatedAt: new Date().toISOString(),
    };

    await onSaveStudyGuide(guide);
    setSavedFeedback('Converted into an offline Study Guide in your Study Guides library.');
  };

  const renderResearchDetailCard = (
    note: ResearchNote,
    isDraft: boolean
  ) => {
    const verdictMeta = VERDICT_META[note.verificationVerdict];
    const subj = subjectMap.get(note.subjectId);

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{subj?.name ?? 'General'}</span>
              <span aria-hidden="true">·</span>
              <span>{note.gradeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {note.sourceEngine === 'online-search-grounded'
                  ? 'External Search Grounded'
                  : `Local AI (${note.modelUsed})`}
              </span>
              {!isDraft && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Saved Offline {formatShortDate(note.savedOfflineAt)}</span>
                </>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900">{note.query}</h3>
            {note.claimToVerify && (
              <p className="text-xs text-slate-600">
                Checked Answer/Claim:{' '}
                <span className="font-medium text-slate-800">“{note.claimToVerify}”</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${verdictMeta.style}`}
            >
              {verdictMeta.label}
            </span>
          </div>
        </div>

        {/* Strict Separation: Uploaded School Materials vs. External Research */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card A: Local Uploaded Materials */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <HardDrive className="w-3.5 h-3.5 text-blue-700" />
                <span>From Your Uploaded Materials (Local)</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {note.sharedUploadedContextWithOnlineAi
                  ? 'Shared w/ Permission'
                  : 'Kept Private Locally'}
              </span>
            </div>

            {note.uploadedMaterialSummary ? (
              <>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {note.uploadedMaterialSummary}
                </div>
                {note.uploadedSourceRefs.length > 0 && (
                  <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    Local References: {note.uploadedSourceRefs.join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                No matching excerpt was found in your local uploaded documents or confirmed topics
                for this query.
              </p>
            )}
          </div>

          {/* Card B: External Research or Connected Local AI */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                {note.sourceEngine === 'online-search-grounded' ? (
                  <Globe className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Cpu className="w-3.5 h-3.5 text-blue-700" />
                )}
                <span>
                  {note.sourceEngine === 'online-search-grounded'
                    ? 'External Academic Research & Verification'
                    : `Offline Local AI Explanation (${note.modelUsed})`}
                </span>
              </span>
            </div>

            <p className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {note.verificationSummary}
            </p>

            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {note.externalExplanation}
            </div>

            {note.keyTakeaways.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <p className="text-xs font-semibold text-slate-700">Key Academic Takeaways</p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                  {note.keyTakeaways.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Clickable Institutional & Academic Source Citations */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              Clickable Source Citations ({note.citations.length}) — Institutional & Academic
              Sources Prioritized
            </span>
          </h4>

          {note.citations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {note.citations.map((cite) => {
                const tier = TIER_LABEL[cite.sourceTier];
                return (
                  <a
                    key={cite.id}
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {cite.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        <span className={`font-medium ${tier.textClass}`}>{tier.label}</span>
                        {' · '}
                        <span>{cite.domain}</span>
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              {note.sourceEngine === 'local-ai'
                ? 'Generated offline using your connected local AI model. Connect to Online Mode to attach live verifiable web URLs.'
                : 'No external web citation links were returned for this query.'}
            </p>
          )}
        </div>

        {/* Save / Study Guide / Delete Controls */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {isDraft && (
              <button
                type="button"
                onClick={() => void handleSaveDraftOffline()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Save Locally for Offline Study</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleConvertToStudyGuide(note)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>Save as Offline Study Guide</span>
            </button>
          </div>

          {!isDraft && (
            <button
              type="button"
              onClick={async () => {
                await onDeleteResearchNote(note.id);
                setSelectedSavedId('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-slate-300 hover:bg-red-50 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Saved Note</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Operating Mode & Local AI Status Banner */}
      <section
        className={`border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          canRunOnlineResearch
            ? 'bg-emerald-50/60 border-emerald-200'
            : canRunLocalAi
              ? 'bg-blue-50/60 border-blue-200'
              : 'bg-amber-50/70 border-amber-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {canRunOnlineResearch ? (
            <Globe className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          ) : canRunLocalAi ? (
            <Cpu className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          ) : (
            <WifiOff className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          )}

          <div className="text-sm">
            <p className="font-semibold text-slate-900">
              {canRunOnlineResearch
                ? 'Online Research Mode Active · Search-Grounded Verification'
                : canRunLocalAi
                  ? `Offline Mode Active · Connected to Local AI (${localAiState.activeModel})`
                  : 'Offline Study Mode Active · No Local AI Model Connected'}
            </p>
            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
              {canRunOnlineResearch
                ? 'Supplementary academic research prioritizes .edu, .gov, DepEd/CHED, and academic references with clickable citations. School documents are never transmitted externally without explicit permission.'
                : canRunLocalAi
                  ? 'Web research is paused offline, but you can generate offline study explanations using your connected local AI model and access all saved documents, topics, guides, research notes, and mock exams.'
                  : 'Web research requires an internet connection, and AI generation is disabled offline because no local AI model is connected. All saved documents, topics, research notes, study guides, mock exams, and exam scoring remain fully accessible.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
          >
            {canRunLocalAi ? 'Configure Local AI' : 'Connect Local AI'}
          </button>
          <button
            type="button"
            onClick={onOpenStudyGuides}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
          >
            Open Study Guides
          </button>
        </div>
      </section>

      {/* Research & Verification Composer */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Academic Research & Answer Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare your uploaded lesson notes against trustworthy external academic references and
            save verified explanations for offline study.
          </p>
        </div>

        <form onSubmit={handleRunResearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopicId('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {workspace.subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name} ({subj.gradeLevel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmed Topic Context (Optional)
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => handleTopicSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">General topic in this subject</option>
                {subjectTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Research Question or Concept
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Explain how the discriminant classifies quadratic roots, or verify the stages of cellular respiration"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Answer or Claim to Verify (Optional)
            </label>
            <input
              type="text"
              value={claimToVerify}
              onChange={(e) => setClaimToVerify(e.target.value)}
              placeholder="e.g. La Solidaridad was founded by Graciano Lopez Jaena in 1889 in Barcelona"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Local Material Match Preview + Explicit Permission Gate */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                <span>Local Material Match (Stays Offline by Default)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                {localMatchPreview.hasMatches
                  ? `${localMatchPreview.sourceRefs.length} local reference(s) found`
                  : 'No local excerpts matched yet'}
              </span>
            </div>

            {localMatchPreview.hasMatches && (
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {localMatchPreview.summaryText}
              </p>
            )}

            {canRunOnlineResearch && localMatchPreview.hasMatches && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachUploadedContext}
                    onChange={(e) => {
                      setAttachUploadedContext(e.target.checked);
                      if (!e.target.checked) setUserConfirmedPermission(false);
                    }}
                    className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>
                    Compare uploaded school material excerpt against external sources (optional)
                  </span>
                </label>

                {attachUploadedContext && (
                  <label className="flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userConfirmedPermission}
                      onChange={(e) => setUserConfirmedPermission(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
                    />
                    <span className="flex items-start gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
                      <span>
                        I grant explicit permission to send this selected excerpt to the server-side
                        Online AI & Search Verification endpoint.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {researchError && (
            <div className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{researchError}</span>
            </div>
          )}

          {savedFeedback && (
            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{savedFeedback}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">
              {canRunOnlineResearch
                ? 'Prioritizes .edu, .gov, DepEd/CHED, and peer-reviewed academic references.'
                : canRunLocalAi
                  ? `Offline Mode: queries will run strictly on local model "${localAiState.activeModel}".`
                  : 'Offline Mode active: connect a local AI model or switch to Online Mode to research new queries.'}
            </p>

            <button
              type="submit"
              disabled={isResearching || (!canRunOnlineResearch && !canRunLocalAi)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Search className="w-3.5 h-3.5" />
              <span>
                {isResearching
                  ? canRunOnlineResearch
                    ? 'Researching & Verifying...'
                    : 'Querying Local AI...'
                  : canRunOnlineResearch
                    ? 'Research & Verify Online'
                    : canRunLocalAi
                      ? 'Ask Connected Local AI'
                      : 'Online Research Unavailable Offline'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Active Draft Result */}
      {activeDraftResult && renderResearchDetailCard(activeDraftResult, true)}

      {/* Saved Offline Research Notes Library */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Saved Offline Research Library ({workspace.researchNotes.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stored locally in IndexedDB — readable anytime with zero network access
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search saved research..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <select
              value={historyFilterSubject}
              onChange={(e) => setHistoryFilterSubject(e.target.value)}
              aria-label="Filter saved research by subject"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Subjects</option>
              {workspace.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSavedNotes.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No saved research explanations yet"
            description="Run an Online Research query above and click Save Locally for Offline Study to store verified explanations and citations in IndexedDB."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {filteredSavedNotes.map((note) => {
                const isSelected = activeSavedNote?.id === note.id;
                const subj = subjectMap.get(note.subjectId);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedSavedId(note.id)}
                    className={`w-full p-4 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-1">
                      <span className="truncate font-medium">{subj?.name ?? 'General'}</span>
                      <span className="tabular-nums shrink-0">
                        {note.citations.length} source{note.citations.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        isSelected ? 'text-blue-800' : 'text-slate-900'
                      }`}
                    >
                      {note.query}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Saved {formatShortDate(note.savedOfflineAt)} ·{' '}
                      {note.sourceEngine === 'online-search-grounded'
                        ? 'Online Research'
                        : 'Local AI'}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8">
              {activeSavedNote && renderResearchDetailCard(activeSavedNote, false)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
