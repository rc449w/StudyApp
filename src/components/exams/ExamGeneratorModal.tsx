import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Cpu,
  ExternalLink,
  Globe,
  Loader2,
  ShieldAlert,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { DiscoveredOnlineTopicPayload, onlineAiClient } from '../../services/ai/onlineAiClient';
import { mapDiscoveredTopicToTopic, termPeriodToQuarter } from '../../services/ai/onlineTopicMapper';
import { validateExamQuestions } from '../../services/exams/examValidator';
import {
  GENERAL_PRACTICE_PRESETS,
  GeneralPracticePreset,
  generateGeneralPracticeExam,
  inferPresetForSubject,
} from '../../services/exams/generalPracticeGenerator';
import { generateLocalMockExam } from '../../services/exams/localExamGenerator';
import {
  ExamDifficulty,
  GradeLevel,
  MockExam,
  MockQuestion,
  OperatingMode,
  QuestionType,
  ResearchCitation,
  TermPeriod,
  Topic,
  WorkspaceSnapshot,
} from '../../types/domain';

interface ExamGeneratorModalProps {
  workspace: WorkspaceSnapshot;
  effectiveMode: OperatingMode;
  initialSourceMode?: 'materials' | 'general-practice';
  onClose: () => void;
  onGeneratedExam: (exam: MockExam) => Promise<void>;
  onSaveTopics?: (topics: Topic[]) => Promise<void>;
}

const GRADE_LEVELS: GradeLevel[] = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

const TERM_PERIODS: TermPeriod[] = [
  'Quarter 1',
  'Quarter 2',
  'Quarter 3',
  'Quarter 4',
  '1st Semester',
  '2nd Semester',
];

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True or False' },
  { value: 'identification', label: 'Identification' },
  { value: 'fill-in-the-blank', label: 'Fill in the Blanks' },
  { value: 'matching', label: 'Matching Type' },
  { value: 'short-answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'problem-solving', label: 'Problem Solving' },
  { value: 'reading-comprehension', label: 'Reading Comprehension' },
  { value: 'situational-analysis', label: 'Situational Analysis' },
];

export const ExamGeneratorModal: React.FC<ExamGeneratorModalProps> = ({
  workspace,
  effectiveMode,
  initialSourceMode = 'materials',
  onClose,
  onGeneratedExam,
  onSaveTopics,
}) => {
  const defaultSubject = workspace.subjects[0];
  const [quizSourceMode, setQuizSourceMode] = useState<'materials' | 'general-practice'>(
    initialSourceMode
  );
  const [generalPreset, setGeneralPreset] = useState<GeneralPracticePreset>(() =>
    inferPresetForSubject(defaultSubject?.name ?? '')
  );
  const [subjectId, setSubjectId] = useState<string>(defaultSubject?.id ?? '');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(
    defaultSubject?.gradeLevel ?? workspace.profile.gradeLevel
  );
  const [quarter, setQuarter] = useState<TermPeriod>('Quarter 1');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [difficulty, setDifficulty] = useState<ExamDifficulty>('medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(() => {
    if (initialSourceMode === 'general-practice') {
      const presetId = inferPresetForSubject(defaultSubject?.name ?? '');
      const preset = GENERAL_PRACTICE_PRESETS.find((p) => p.id === presetId);
      if (preset) return preset.recommendedTypes;
    }
    return ['multiple-choice', 'true-false', 'identification', 'problem-solving'];
  });

  const subjectTopics = useMemo(
    () => workspace.topics.filter((t) => t.subjectId === subjectId),
    [workspace.topics, subjectId]
  );

  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(() =>
    workspace.topics.filter((t) => t.subjectId === (defaultSubject?.id ?? '')).map((t) => t.id)
  );

  const [onlineTopicFocus, setOnlineTopicFocus] = useState('');
  const [discoveringOnline, setDiscoveringOnline] = useState(false);
  const [discoveringOpenWeb, setDiscoveringOpenWeb] = useState(false);
  const [discoveryProviderLabel, setDiscoveryProviderLabel] = useState<string | null>(null);
  const [discoveredTopics, setDiscoveredTopics] = useState<DiscoveredOnlineTopicPayload[]>([]);
  const [selectedDiscoveredIndices, setSelectedDiscoveredIndices] = useState<number[]>([]);
  const [discoveredCitations, setDiscoveredCitations] = useState<ResearchCitation[]>([]);
  const [savingOnlineTopics, setSavingOnlineTopics] = useState(false);
  const [savedOnlineNotice, setSavedOnlineNotice] = useState<string | null>(null);
  const [useInternetCurriculum, setUseInternetCurriculum] = useState(true);

  const [aiPermissionStep, setAiPermissionStep] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = workspace.subjects.find((s) => s.id === subjectId) ?? defaultSubject;

  const chosenTopics = useMemo(
    () => subjectTopics.filter((t) => selectedTopicIds.includes(t.id)),
    [subjectTopics, selectedTopicIds]
  );

  const chosenDiscoveredTopics = useMemo(
    () => discoveredTopics.filter((_, idx) => selectedDiscoveredIndices.includes(idx)),
    [discoveredTopics, selectedDiscoveredIndices]
  );

  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const subj = workspace.subjects.find((s) => s.id === newSubjectId);
    if (subj) {
      setGradeLevel(subj.gradeLevel);
      setGeneralPreset(inferPresetForSubject(subj.name));
    }
    const matchingTopics = workspace.topics.filter((t) => t.subjectId === newSubjectId);
    setSelectedTopicIds(matchingTopics.map((t) => t.id));
    setDiscoveredTopics([]);
    setSelectedDiscoveredIndices([]);
    setDiscoveredCitations([]);
    setSavedOnlineNotice(null);
    setError(null);
  };

  const toggleTopic = (id: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDiscoveredTopic = (idx: number) => {
    setSelectedDiscoveredIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleQuestionType = (qType: QuestionType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(qType)) {
        return prev.length > 1 ? prev.filter((t) => t !== qType) : prev;
      }
      return [...prev, qType];
    });
  };

  const handleDiscoverOnlineTopics = async () => {
    if (!selectedSubject) return;
    if (effectiveMode !== 'online') {
      setError('Switch to Online Mode in the top bar to fetch topics from the internet.');
      return;
    }
    setError(null);
    setSavedOnlineNotice(null);
    setDiscoveringOnline(true);

    try {
      const res = await onlineAiClient.discoverOnlineTopics({
        subjectName: selectedSubject.name,
        gradeLevel,
        quarter,
        topicFocus: onlineTopicFocus.trim() || undefined,
        count: 5,
      });

      if (!res.success || !res.topics || res.topics.length === 0) {
        setError(res.error ?? 'Unable to retrieve curriculum topics from the internet.');
        return;
      }

      setDiscoveredTopics(res.topics);
      setSelectedDiscoveredIndices(res.topics.map((_, idx) => idx));
      setDiscoveredCitations(res.citations ?? []);
      setDiscoveryProviderLabel(res.model ? `Gemini (${res.model})` : 'Gemini + Google Search');
      setUseInternetCurriculum(true);
    } finally {
      setDiscoveringOnline(false);
    }
  };

  const handleDiscoverOpenWebTopics = async () => {
    if (!selectedSubject) return;
    if (effectiveMode !== 'online') {
      setError('Switch to Online Mode in the top bar to search the open web.');
      return;
    }
    setError(null);
    setSavedOnlineNotice(null);
    setDiscoveringOpenWeb(true);

    try {
      const res = await onlineAiClient.discoverOpenWebTopics({
        subjectName: selectedSubject.name,
        gradeLevel,
        quarter,
        topicFocus: onlineTopicFocus.trim() || undefined,
        count: 4,
      });

      if (!res.success || !res.topics || res.topics.length === 0) {
        setError(res.error ?? 'No open encyclopedia topics matched your query.');
        return;
      }

      setDiscoveredTopics(res.topics);
      setSelectedDiscoveredIndices(res.topics.map((_, idx) => idx));
      setDiscoveredCitations(res.citations ?? []);
      setDiscoveryProviderLabel('Open Web (Wikipedia · No Quota)');
    } finally {
      setDiscoveringOpenWeb(false);
    }
  };

  const handleSaveDiscoveredTopicsToLibrary = async () => {
    if (!selectedSubject || !onSaveTopics || chosenDiscoveredTopics.length === 0) return;
    setSavingOnlineTopics(true);
    setError(null);
    try {
      const quarterShort = termPeriodToQuarter(quarter);
      const mapped = chosenDiscoveredTopics.map((item) =>
        mapDiscoveredTopicToTopic({
          item,
          subjectId: selectedSubject.id,
          quarter: quarterShort,
          citations: discoveredCitations,
        })
      );
      await onSaveTopics(mapped);
      setSelectedTopicIds((prev) => Array.from(new Set([...prev, ...mapped.map((t) => t.id)])));
      setDiscoveredTopics([]);
      setSelectedDiscoveredIndices([]);
      setSavedOnlineNotice(
        `Saved ${mapped.length} online topic(s) to ${selectedSubject.name}'s Topic Library (available offline too).`
      );
    } finally {
      setSavingOnlineTopics(false);
    }
  };

  const buildSourceSummaryText = (): string => {
    const docMap = new Map(workspace.documentContents.map((c) => [c.documentId, c]));
    const localParts = chosenTopics.map((topic) => {
      const linked = topic.sourceDocumentId ? docMap.get(topic.sourceDocumentId) : undefined;
      const sourceRef = topic.sourceFileName
        ? `${topic.sourceFileName}${topic.pageRef ? ` (${topic.pageRef})` : ''}`
        : `${selectedSubject?.name ?? 'Subject'} Notes`;
      return [
        `TOPIC: ${topic.title} | Source: ${sourceRef}`,
        `Summary: ${topic.summary}`,
        topic.definitions?.length
          ? `Definitions: ${topic.definitions.map((d) => d.content).join('; ')}`
          : '',
        topic.formulas?.length
          ? `Formulas: ${topic.formulas.map((f) => f.content).join('; ')}`
          : '',
        topic.examples?.length
          ? `Examples: ${topic.examples.map((e) => e.content).join('; ')}`
          : '',
        topic.importantConcepts?.length
          ? `Key Concepts: ${topic.importantConcepts.map((c) => c.content).join('; ')}`
          : '',
        linked?.fullExtractedText ? `Document Excerpt:\n${linked.fullExtractedText.slice(0, 2200)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });

    const onlineParts = chosenDiscoveredTopics.map((topic) =>
      [
        `ONLINE TOPIC: ${topic.title} (${topic.chapter} · ${topic.lesson}) | Source: Online Curriculum (${selectedSubject?.name ?? 'Subject'} ${gradeLevel} ${quarter})`,
        `Summary: ${topic.summary}`,
        topic.subtopics.length ? `Subtopics: ${topic.subtopics.join(', ')}` : '',
        topic.definitions.length
          ? `Definitions: ${topic.definitions.map((d) => d.content).join('; ')}`
          : '',
        topic.formulas.length ? `Rules/Formulas: ${topic.formulas.map((f) => f.content).join('; ')}` : '',
        topic.examples.length ? `Examples: ${topic.examples.map((e) => e.content).join('; ')}` : '',
        topic.importantConcepts.length
          ? `Key Concepts: ${topic.importantConcepts.map((c) => c.content).join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    );

    return [...localParts, ...onlineParts].join('\n\n---\n\n');
  };

  const handleGenerateOffline = async () => {
    if (!selectedSubject) {
      setError('Please create a subject first.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Select at least one question type.');
      return;
    }
    setError(null);
    setGenerating(true);

    try {
      if (quizSourceMode === 'general-practice') {
        const exam = generateGeneralPracticeExam({
          preset: generalPreset,
          subject: selectedSubject,
          gradeLevel,
          quarter,
          questionCount,
          difficulty,
          durationMinutes,
          questionTypes: selectedTypes,
        });

        if (exam.questions.length === 0) {
          setError('Unable to validate generated general practice questions.');
          return;
        }

        await onGeneratedExam(exam);
        onClose();
        return;
      }

      const quarterShort = termPeriodToQuarter(quarter);
      const mappedDiscoveredTopics: Topic[] = chosenDiscoveredTopics.map((item) =>
        mapDiscoveredTopicToTopic({
          item,
          subjectId: selectedSubject.id,
          quarter: quarterShort,
          citations: discoveredCitations,
        })
      );

      const topicsToUse =
        chosenTopics.length > 0 || mappedDiscoveredTopics.length > 0
          ? [...chosenTopics, ...mappedDiscoveredTopics]
          : subjectTopics;

      const exam = generateLocalMockExam({
        subject: selectedSubject,
        gradeLevel,
        quarter,
        selectedTopics: topicsToUse,
        questionCount,
        difficulty,
        durationMinutes,
        questionTypes: selectedTypes,
        documentContents: workspace.documentContents,
        studyGuides: workspace.studyGuides,
      });

      if (exam.questions.length === 0) {
        setError('Unable to validate generated questions. Add topic notes or documents first.');
        return;
      }

      if (mappedDiscoveredTopics.length > 0 && discoveredCitations.length > 0) {
        exam.onlineCitations = discoveredCitations;
      }

      await onGeneratedExam(exam);
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateOnlineAi = async () => {
    if (!selectedSubject) return;
    if (effectiveMode !== 'online') {
      setError('Online AI generation requires Online Mode in the top bar.');
      return;
    }
    setError(null);
    setGenerating(true);

    try {
      const activePresetMeta = GENERAL_PRACTICE_PRESETS.find((p) => p.id === generalPreset);
      const isGeneralMode = quizSourceMode === 'general-practice';
      const sourceText = isGeneralMode ? '' : buildSourceSummaryText();
      const shouldUseInternet = isGeneralMode || Boolean(useInternetCurriculum || !sourceText);
      const res = await onlineAiClient.generateMockExamWithPermission({
        userConfirmedPermission: true,
        subjectName: isGeneralMode && activePresetMeta ? activePresetMeta.label : selectedSubject.name,
        gradeLevel,
        quarter,
        difficulty,
        questionCount,
        questionTypes: selectedTypes,
        sourceMaterialsText: sourceText,
        useInternetCurriculum: shouldUseInternet,
        onlineTopicFocus: isGeneralMode
          ? activePresetMeta?.onlinePromptFocus
          : onlineTopicFocus.trim() || undefined,
      });

      if (!res.success || !res.questions || res.questions.length === 0) {
        setError(res.error ?? 'Online AI did not return valid questions. Try fetching topics online first or retry.');
        return;
      }

      const combinedCitations: ResearchCitation[] = [];
      const seenCiteUrls = new Set<string>();
      for (const cite of [...(res.citations ?? []), ...discoveredCitations]) {
        if (!seenCiteUrls.has(cite.url)) {
          seenCiteUrls.add(cite.url);
          combinedCitations.push(cite);
        }
      }

      const rawMapped: MockQuestion[] = res.questions.map((raw, idx) => {
        const sourceRef = String(
          raw.sourceReference ??
            (shouldUseInternet
              ? `Online Curriculum · ${selectedSubject.name} (${gradeLevel} · ${quarter})`
              : `${selectedSubject.name} · Confirmed Study Materials`)
        );
        const matchingTopic =
          chosenTopics.find(
            (t) =>
              raw.topicTitle &&
              t.title.toLowerCase() === String(raw.topicTitle).toLowerCase()
          ) ?? chosenTopics[0];
        const refPageMatch = sourceRef.match(/\b(?:page|slide|sheet|p\.?)\s*(\d+)/i);
        const parsedPage = refPageMatch ? Number(refPageMatch[1]) : undefined;
        const matchedDocContent = matchingTopic?.sourceDocumentId
          ? workspace.documentContents.find((d) => d.documentId === matchingTopic.sourceDocumentId)
          : workspace.documentContents.find((d) =>
              sourceRef.toLowerCase().includes(d.sourceFileName.toLowerCase())
            );
        const matchedTables =
          matchedDocContent && parsedPage
            ? matchedDocContent.pages.find((p) => p.pageNumber === parsedPage)?.tables
            : undefined;

        return {
          id: `q-ai-${idx + 1}-${crypto.randomUUID().slice(0, 6)}`,
          type: (raw.type as QuestionType) || selectedTypes[idx % selectedTypes.length],
          prompt: String(raw.prompt ?? ''),
          passage: raw.passage ? String(raw.passage) : undefined,
          choices: Array.isArray(raw.choices) ? raw.choices.map(String) : undefined,
          correctIndex: typeof raw.correctIndex === 'number' ? raw.correctIndex : undefined,
          matchingPairs: Array.isArray(raw.matchingPairs)
            ? (raw.matchingPairs as { id?: string; prompt: string; match: string }[]).map(
                (p, pIdx) => ({
                  id: p.id || `pair-${idx}-${pIdx}`,
                  prompt: String(p.prompt),
                  match: String(p.match),
                })
              )
            : undefined,
          expectedAnswer: String(raw.expectedAnswer ?? ''),
          acceptableKeywords: Array.isArray(raw.acceptableKeywords)
            ? raw.acceptableKeywords.map(String)
            : [],
          points: typeof raw.points === 'number' && raw.points > 0 ? raw.points : 1,
          hints: {
            level1: String((raw.hints as Record<string, unknown> | undefined)?.level1 ?? ''),
            level2: String((raw.hints as Record<string, unknown> | undefined)?.level2 ?? ''),
            level3: String((raw.hints as Record<string, unknown> | undefined)?.level3 ?? ''),
          },
          explanation: String(raw.explanation ?? ''),
          commonMistakes: String(raw.commonMistakes ?? ''),
          sourceReference: sourceRef,
          sourceDocumentId: matchedDocContent?.documentId ?? matchingTopic?.sourceDocumentId,
          sourcePageNumber: parsedPage,
          referenceTables: matchedTables && matchedTables.length > 0 ? matchedTables : undefined,
          topicTitle: raw.topicTitle ? String(raw.topicTitle) : matchingTopic?.title,
        };
      });

      const validated = validateExamQuestions(rawMapped);
      if (validated.validQuestions.length === 0) {
        setError(
          `Generated questions could not pass structural validation (${validated.rejectedCount} rejected). Try clicking "Fetch Topics Online (Gemini)" first or retrying.`
        );
        return;
      }

      const topicCountUsed = chosenTopics.length + chosenDiscoveredTopics.length;
      const exam: MockExam = {
        id: `exam-ai-${crypto.randomUUID().slice(0, 8)}`,
        subjectId: selectedSubject.id,
        title: `${selectedSubject.name} — ${quarter} Mock Exam`,
        gradeLevel,
        quarter,
        difficulty,
        timeLimitMinutes: durationMinutes,
        description: shouldUseInternet
          ? `Generated with Online AI (${res.model ?? 'Gemini'} + Google Search) covering ${selectedSubject.name} ${gradeLevel} ${quarter} curriculum${
              topicCountUsed > 0 ? ` and ${topicCountUsed} selected topic(s)` : ''
            }.`
          : `Generated with Online AI (${res.model ?? 'Gemini'}) from ${topicCountUsed} confirmed topic(s).`,
        topicIds: chosenTopics.map((t) => t.id),
        sourceMode: 'online-ai-generated',
        isDemo: false,
        questions: validated.validQuestions,
        onlineCitations: combinedCitations.length > 0 ? combinedCitations : undefined,
        validationWarnings: validated.warnings,
        createdAt: new Date().toISOString(),
      };

      await onGeneratedExam(exam);
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Mock Examination Generator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Builds validated questions with 3-level progressive hints from your confirmed materials
            </p>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Primary Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quarter / Semester
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value as TermPeriod)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {TERM_PERIODS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Number of Questions
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Math.min(50, Math.max(1, Number(e.target.value || 1))))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ExamDifficulty)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="easy">Easy (Foundational Recall)</option>
                <option value="medium">Medium (Standard DepEd Assessment)</option>
                <option value="hard">Hard (Mastery & Analysis)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Math.min(120, Math.max(3, Number(e.target.value || 5))))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Quiz Source Mode Switch */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Quiz Content Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setQuizSourceMode('materials');
                  setError(null);
                }}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  quizSourceMode === 'materials'
                    ? 'bg-blue-50 border-blue-600 text-blue-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold">From Study Materials (PDFs &amp; Topics)</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Build questions from uploaded reviewers, confirmed topics, or web search.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuizSourceMode('general-practice');
                  const preset = GENERAL_PRACTICE_PRESETS.find((p) => p.id === generalPreset);
                  if (preset) {
                    setSelectedTypes(preset.recommendedTypes);
                  }
                  setError(null);
                }}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  quizSourceMode === 'general-practice'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold">General Practice Quiz (No PDF Needed)</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  English Spelling, Grammar, General Math Drills &amp; Science — works 100% offline.
                </p>
              </button>
            </div>
          </div>

          {quizSourceMode === 'general-practice' ? (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Choose General Practice Topic (Offline &amp; Randomized)
                </p>
                <p className="text-[11px] text-slate-600">
                  No document uploads required. Select a preset to generate Spelling, Grammar, or
                  Math drills right away.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {GENERAL_PRACTICE_PRESETS.map((preset) => {
                  const selected = generalPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setGeneralPreset(preset.id);
                        setSelectedTypes(preset.recommendedTypes);
                        setError(null);
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-white border-emerald-600 ring-1 ring-emerald-600'
                          : 'bg-white/70 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{preset.label}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                          {preset.shortTag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>

          {/* Source Topics Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                <span>
                  Confirmed Topics & Source Materials ({chosenTopics.length} selected of{' '}
                  {subjectTopics.length})
                </span>
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedTopicIds(subjectTopics.map((t) => t.id))}
                  className="text-blue-700 font-semibold hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTopicIds([])}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {subjectTopics.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                No local topics found for {selectedSubject?.name ?? 'this subject'} yet. Fetch
                curriculum topics directly from the internet with Gemini below, or use{' '}
                <strong>Generate with Online AI</strong> with Google Search grounding.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-200 bg-slate-50/40">
                {subjectTopics.map((topic) => {
                  const checked = selectedTopicIds.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTopic(topic.id)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {topic.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {topic.sourceFileName
                            ? `Source: ${topic.sourceFileName}${
                                topic.pageRef ? ` · ${topic.pageRef}` : ''
                              }`
                            : `${topic.quarter} Study Topic`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {savedOnlineNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>{savedOnlineNotice}</span>
              </div>
            )}
          </div>

          {/* Internet Curriculum Topics (Gemini + Google Search Grounding) */}
          <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-700 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Access Topics from the Internet (Gemini + Google Search)
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Pulls {selectedSubject?.name ?? 'subject'} ({gradeLevel} · {quarter})
                    curriculum topics from DepEd, .edu, and academic sources when online.
                  </p>
                </div>
              </div>
              {effectiveMode !== 'online' && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Offline Mode
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={onlineTopicFocus}
                onChange={(e) => setOnlineTopicFocus(e.target.value)}
                disabled={effectiveMode !== 'online' || discoveringOnline || discoveringOpenWeb || generating}
                placeholder={`Optional topic focus (e.g. How to fight fake news, Context Clues) — or leave blank for ${quarter}`}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
              />
              <button
                type="button"
                disabled={effectiveMode !== 'online' || discoveringOnline || discoveringOpenWeb || generating}
                onClick={() => void handleDiscoverOnlineTopics()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {discoveringOnline ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span>{discoveringOnline ? 'Searching Gemini...' : 'Fetch Topics Online'}</span>
              </button>
              <button
                type="button"
                disabled={effectiveMode !== 'online' || discoveringOnline || discoveringOpenWeb || generating}
                onClick={() => void handleDiscoverOpenWebTopics()}
                title="Search Wikipedia directly without using Gemini API quota"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {discoveringOpenWeb ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-blue-700" />
                )}
                <span>
                  {discoveringOpenWeb ? 'Searching Web...' : 'Search Open Web (Wikipedia)'}
                </span>
              </button>
            </div>

            {discoveredTopics.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-blue-950">
                    Retrieved {discoveredTopics.length} Online Topic(s)
                    {discoveryProviderLabel ? ` via ${discoveryProviderLabel}` : ''} (
                    {chosenDiscoveredTopics.length} selected for exam)
                  </span>
                  {onSaveTopics && chosenDiscoveredTopics.length > 0 && (
                    <button
                      type="button"
                      disabled={savingOnlineTopics}
                      onClick={() => void handleSaveDiscoveredTopicsToLibrary()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-300 text-blue-800 hover:bg-blue-50 font-semibold rounded-md text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      {savingOnlineTopics
                        ? 'Saving to Library...'
                        : 'Save Selected to Topic Library (Offline Ready)'}
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto bg-white border border-blue-200 rounded-lg divide-y divide-slate-200">
                  {discoveredTopics.map((item, idx) => {
                    const checked = selectedDiscoveredIndices.includes(idx);
                    return (
                      <label
                        key={`${item.title}-${idx}`}
                        className="flex items-start gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDiscoveredTopic(idx)}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-600 line-clamp-2">{item.summary}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {discoveredCitations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="font-semibold">Web Sources:</span>
                    {discoveredCitations.slice(0, 4).map((cite) => (
                      <a
                        key={cite.id}
                        href={cite.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-blue-700 hover:underline max-w-[200px] truncate"
                      >
                        <span className="truncate">{cite.domain}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </>
          )}

          {/* All 10 Supported Question Types */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Question Types ({selectedTypes.length} selected)
              </label>
              <button
                type="button"
                onClick={() => setSelectedTypes(QUESTION_TYPE_OPTIONS.map((q) => q.value))}
                className="text-xs text-blue-700 font-semibold hover:underline cursor-pointer"
              >
                Select All 10 Types
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {QUESTION_TYPE_OPTIONS.map((opt) => {
                const active = selectedTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleQuestionType(opt.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {active ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permission Confirmation Box for Online AI */}
          {aiPermissionStep && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1.5 flex-1">
                  <p className="font-semibold">
                    Confirm Permission for Online Gemini + Internet Exam Generation
                  </p>
                  <p className="leading-relaxed">
                    {chosenTopics.length > 0 ? (
                      <>
                        Selected confirmed topics for <strong>{selectedSubject?.name}</strong> (
                        {chosenTopics.length} local topic(s)) will be sent to StudyWise AI&apos;s
                        Node.js server and Gemini API to create questions with 3-level progressive
                        hints.
                      </>
                    ) : (
                      <>
                        No local school documents are being sent. Gemini will search the internet
                        via Google Search grounding for{' '}
                        <strong>
                          {selectedSubject?.name} ({gradeLevel} · {quarter})
                        </strong>{' '}
                        curriculum topics to generate grounded exam questions.
                      </>
                    )}
                  </p>
                  <label className="flex items-center gap-2 pt-1 text-amber-950 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useInternetCurriculum || chosenTopics.length === 0}
                      disabled={chosenTopics.length === 0}
                      onChange={(e) => setUseInternetCurriculum(e.target.checked)}
                      className="rounded border-amber-400 text-blue-700 focus:ring-blue-600"
                    />
                    <span>
                      Use Google Search grounding to retrieve/verify internet topics for{' '}
                      {selectedSubject?.name} ({gradeLevel} · {quarter})
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setAiPermissionStep(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel — Stay Offline
                </button>
                <button
                  type="button"
                  disabled={generating || effectiveMode !== 'online'}
                  onClick={() => void handleGenerateOnlineAi()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{generating ? 'Generating with AI & Web...' : 'Allow & Generate Online'}</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <div className="space-y-1">
                  <p className="font-medium">{error}</p>
                  {(error.includes('429') || error.toLowerCase().includes('quota')) && (
                    <p className="text-[11px] text-red-800 leading-relaxed">
                      <strong>Quick fix:</strong> Your Google AI Studio Gemini API free-tier limit was
                      reached. You can wait ~1–2 minutes or attach a billing-enabled key in{' '}
                      <strong>Google AI Studio → Settings &gt; Secrets</strong> — or use the
                      quota-free options below right now:
                    </p>
                  )}
                </div>
              </div>
              {(error.includes('429') || error.toLowerCase().includes('quota')) && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <button
                    type="button"
                    disabled={discoveringOpenWeb || effectiveMode !== 'online'}
                    onClick={() => void handleDiscoverOpenWebTopics()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-900 bg-white border border-blue-300 hover:bg-blue-50 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-700" />
                    <span>
                      {discoveringOpenWeb
                        ? 'Searching Open Web...'
                        : 'Search Open Web (Wikipedia · No Quota)'}
                    </span>
                  </button>
                  {subjectTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopicIds(subjectTopics.map((t) => t.id));
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                      <Cpu className="w-3.5 h-3.5 text-slate-700" />
                      <span>Select All {subjectTopics.length} Local Topic(s) &amp; Use Offline</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            All generated questions pass hint & answer validation before display.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={generating || effectiveMode !== 'online'}
              title={
                effectiveMode !== 'online'
                  ? 'Switch to Online Mode in the top bar to use Gemini & Internet Search'
                  : undefined
              }
              onClick={() => {
                setError(null);
                setAiPermissionStep(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate with Online AI</span>
            </button>

            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateOffline()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{generating ? 'Generating...' : 'Generate Offline Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
