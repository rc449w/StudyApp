export type NavRoute =
  | 'dashboard'
  | 'subjects'
  | 'documents'
  | 'topics'
  | 'study-guides'
  | 'research'
  | 'mock-exams'
  | 'exam-history'
  | 'progress'
  | 'settings';

export type GradeLevel =
  | 'Grade 7'
  | 'Grade 8'
  | 'Grade 9'
  | 'Grade 10'
  | 'Grade 11'
  | 'Grade 12';

export type ShsStrand = 'None' | 'STEM' | 'ABM' | 'HUMSS' | 'GAS' | 'TVL';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type TermPeriod =
  | 'Quarter 1'
  | 'Quarter 2'
  | 'Quarter 3'
  | 'Quarter 4'
  | '1st Semester'
  | '2nd Semester';

export type SubjectAccent = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'teal';

export interface StudentProfile {
  id: string;
  fullName: string;
  gradeLevel: GradeLevel;
  strand: ShsStrand;
  schoolName: string;
  preferredLanguage: 'English' | 'Filipino' | 'Bilingual';
  avatarUrl: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  gradeLevel: GradeLevel;
  strand: ShsStrand;
  quarter: Quarter;
  teacher: string;
  accent: SubjectAccent;
  description: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExtractionStatus =
  | 'queued'
  | 'uploading'
  | 'extracting'
  | 'ocr-running'
  | 'analyzing'
  | 'saving'
  | 'extracted'
  | 'confirmed'
  | 'error'
  | 'demo-seed';

export type ExtractionMethod =
  | 'local-text'
  | 'local-xml'
  | 'local-pdf'
  | 'local-spreadsheet'
  | 'local-ocr'
  | 'online-ai-ocr-and-structure'
  | 'demo-seed';

export interface ExtractedTable {
  pageRef: string;
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface ExtractedPageSection {
  pageNumber: number;
  pageLabel: string;
  headings: string[];
  text: string;
  tables: ExtractedTable[];
  formulas: string[];
  ocrUsed: boolean;
  ocrConfidence?: number;
  lowConfidenceOcr?: boolean;
  extractionWarnings?: string[];
}

export interface ExtractedConceptItem {
  id: string;
  kind: 'definition' | 'formula' | 'example' | 'concept';
  term?: string;
  content: string;
  pageRef: string;
}

export type ContentSourceAttribution =
  | 'extracted-from-document'
  | 'ai-supplemented'
  | 'internet-search-grounded'
  | 'manual';

export interface ExtractedTopicCandidate {
  id: string;
  subjectHint: string;
  chapter: string;
  lesson: string;
  title: string;
  subtopics: string[];
  summary: string;
  pageRef: string;
  definitions: ExtractedConceptItem[];
  formulas: ExtractedConceptItem[];
  examples: ExtractedConceptItem[];
  importantConcepts: ExtractedConceptItem[];
  confirmed: boolean;
  syncedTopicId?: string;
  uncertainTitle?: boolean;
  titleReviewReason?: string;
  sourceAttribution?: ContentSourceAttribution;
}

export interface DocumentExtractionContent {
  documentId: string;
  sourceFileName: string;
  detectedSubject: string;
  detectedChapters: string[];
  detectedLessons: string[];
  pageCount: number;
  ocrApplied: boolean;
  ocrPageNumbers: number[];
  extractionMethod: ExtractionMethod;
  pages: ExtractedPageSection[];
  fullExtractedText: string;
  topicInventory: ExtractedTopicCandidate[];
  inventoryStatus: 'pending-review' | 'confirmed';
  hasLocalFileBlob: boolean;
  rawFileBuffer?: ArrayBuffer;
  rawMimeType?: string;
  updatedAt: string;
}

export interface LocalDocument {
  id: string;
  subjectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  storageTarget: 'indexeddb-local' | 'fs-access-folder' | 'tauri-local-vault';
  folderLabel: string;
  localVaultPath?: string;
  extractionStatus: ExtractionStatus;
  extractionMethod?: ExtractionMethod;
  extractionError?: string;
  pageCount?: number;
  topicCount?: number;
  confirmedTopicCount?: number;
  ocrUsed?: boolean;
  textPreview?: string;
  notes: string;
  isDemo: boolean;
  addedAt: string;
}

export type TopicMastery = 'not-started' | 'in-progress' | 'mastered';

export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  quarter: Quarter;
  summary: string;
  masteryStatus: TopicMastery;
  linkedDocumentIds: string[];
  sourceDocumentId?: string;
  sourceFileName?: string;
  pageRef?: string;
  chapter?: string;
  lesson?: string;
  subtopics?: string[];
  definitions?: ExtractedConceptItem[];
  formulas?: ExtractedConceptItem[];
  examples?: ExtractedConceptItem[];
  importantConcepts?: ExtractedConceptItem[];
  sourceAttribution?: ContentSourceAttribution;
  citations?: ResearchCitation[];
  isDemo: boolean;
  updatedAt: string;
}

export interface StudyGuide {
  id: string;
  subjectId: string;
  topicId?: string;
  title: string;
  summary: string;
  keyConcepts: string[];
  bodyMarkdown: string;
  sourceMode: 'manual-offline' | 'offline-saved-research' | 'local-ai' | 'demo-seed';
  isDemo: boolean;
  updatedAt: string;
}

export type OperatingMode = 'online' | 'offline';

export type LocalAiProvider = 'ollama' | 'openai-compatible';

export interface LocalAiConfig {
  enabled: boolean;
  provider: LocalAiProvider;
  endpointUrl: string;
  modelName: string;
}

export interface LocalAiRuntimeState {
  status: 'disabled' | 'checking' | 'connected' | 'unreachable';
  connected: boolean;
  activeModel: string | null;
  availableModels: string[];
  lastCheckedAt: string | null;
  message: string;
}

export type CitationAuthorityTier =
  | 'official-edu-gov'
  | 'academic-reference'
  | 'educational-web';

export interface ResearchCitation {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceTier: CitationAuthorityTier;
  snippet?: string;
}

export type VerificationVerdict =
  | 'verified'
  | 'partially-supported'
  | 'needs-clarification'
  | 'supplementary-only'
  | 'unverified-local-ai';

export interface ResearchNote {
  id: string;
  subjectId: string;
  topicId?: string;
  topicTitle?: string;
  query: string;
  claimToVerify?: string;
  gradeLevel: GradeLevel;
  uploadedMaterialSummary: string | null;
  uploadedSourceRefs: string[];
  externalExplanation: string;
  verificationVerdict: VerificationVerdict;
  verificationSummary: string;
  keyTakeaways: string[];
  citations: ResearchCitation[];
  sourceEngine: 'online-search-grounded' | 'local-ai';
  modelUsed: string;
  sharedUploadedContextWithOnlineAi: boolean;
  savedOfflineAt: string;
  isDemo: boolean;
}

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'identification'
  | 'fill-in-the-blank'
  | 'matching'
  | 'short-answer'
  | 'essay'
  | 'problem-solving'
  | 'reading-comprehension'
  | 'situational-analysis';

export type ExamDifficulty = 'easy' | 'medium' | 'hard';

export interface ProgressiveHints {
  level1: string; // Gentle memory reminder
  level2: string; // Guided thinking
  level3: string; // More specific guidance without revealing the answer
}

export interface MatchingPair {
  id: string;
  prompt: string;
  match: string;
}

export interface MockQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  passage?: string; // For reading-comprehension or situational-analysis context
  choices?: string[]; // For multiple-choice or true-false or reading-comprehension MCQ
  correctIndex?: number; // For index-based choices
  matchingPairs?: MatchingPair[]; // For matching type
  expectedAnswer: string; // Canonical text answer / rubric model answer
  acceptableKeywords?: string[]; // Used for local scoring of open-ended/identification questions
  points: number;
  hints: ProgressiveHints;
  explanation: string;
  commonMistakes: string;
  sourceReference: string; // e.g., "Q1_Module_1.pdf · Pages 1–2"
  sourceDocumentId?: string;
  sourcePageNumber?: number;
  referenceTables?: ExtractedTable[];
  referenceLabel?: string;
  citations?: ResearchCitation[];
  topicId?: string;
  topicTitle?: string;
}

export interface MockExam {
  id: string;
  subjectId: string;
  title: string;
  gradeLevel: GradeLevel;
  quarter: TermPeriod;
  difficulty: ExamDifficulty;
  timeLimitMinutes: number;
  description: string;
  topicIds: string[];
  sourceMode: 'demo-seed' | 'local-generated' | 'online-ai-generated';
  isDemo: boolean;
  questions: MockQuestion[];
  onlineCitations?: ResearchCitation[];
  validationWarnings?: string[];
  createdAt: string;
}

export type StudentAnswerValue = string | number | Record<string, string>;

export interface QuestionResultBreakdown {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  hintsUsedLevel: number; // 0, 1, 2, or 3
  feedback: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  subjectId: string;
  subjectName: string;
  score: number;
  totalQuestions: number; // total points or question count
  earnedPoints?: number;
  maxPoints?: number;
  percentage: number;
  durationSeconds: number;
  answers: Record<string, StudentAnswerValue>;
  hintsUsedByQuestion?: Record<string, number>;
  questionBreakdowns?: QuestionResultBreakdown[];
  recommendedReviewTopics?: string[];
  completedAt: string;
  isDemo: boolean;
}

export interface LocalStorageConfig {
  mode: 'indexeddb-only' | 'fs-access-directory' | 'tauri-local-vault';
  directoryName: string | null;
  lastVerifiedAt: string | null;
  runtimeTarget: 'web-browser' | 'tauri-windows-planned' | 'tauri-windows-desktop';
  databaseEngine?: 'indexeddb' | 'sqlite-tauri';
  documentsVaultPath?: string | null;
}

export interface WorkspaceSnapshot {
  profile: StudentProfile;
  subjects: Subject[];
  documents: LocalDocument[];
  documentContents: DocumentExtractionContent[];
  topics: Topic[];
  studyGuides: StudyGuide[];
  researchNotes: ResearchNote[];
  mockExams: MockExam[];
  examAttempts: ExamAttempt[];
  storageConfig: LocalStorageConfig;
  localAiConfig: LocalAiConfig;
}

export interface OnlineAiStatus {
  onlineServiceAvailable: boolean;
  serverCredentialConfigured: boolean;
  sdk: string;
  stage: string;
  plannedModel: string;
  implementedCapabilities: string[];
  plannedCapabilities: string[];
  note: string;
}
