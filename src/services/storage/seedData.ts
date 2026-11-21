import {
  DocumentExtractionContent,
  ExamAttempt,
  LocalDocument,
  LocalStorageConfig,
  MockExam,
  StudentProfile,
  StudyGuide,
  Subject,
  Topic,
} from '../../types/domain';

export const SEED_VERSION = 'stage2-doc-extraction-v1';

export const DEFAULT_STUDENT_AVATAR =
  '/src/assets/images/avatar_student_ph_1794915500737.jpg';

export function createDemoProfile(): StudentProfile {
  return {
    id: 'student-primary',
    fullName: 'Miguel Dela Cruz',
    gradeLevel: 'Grade 11',
    strand: 'STEM',
    schoolName: 'Manila Science High School (Demo)',
    preferredLanguage: 'Bilingual',
    avatarUrl: DEFAULT_STUDENT_AVATAR,
    updatedAt: '2026-11-15T08:00:00.000Z',
  };
}

export function createDemoStorageConfig(): LocalStorageConfig {
  return {
    mode: 'indexeddb-only',
    directoryName: null,
    lastVerifiedAt: null,
    runtimeTarget: 'web-browser',
  };
}

export function createDemoSubjects(): Subject[] {
  return [
    {
      id: 'subj-genmath-11',
      code: 'CORE-MATH11',
      name: 'General Mathematics',
      gradeLevel: 'Grade 11',
      strand: 'STEM',
      quarter: 'Q1',
      teacher: 'Ms. Clarissa Reyes',
      accent: 'blue',
      description:
        'DepEd Core Subject covering functions, rational equations, inverse & exponential functions, and basic business mathematics.',
      isDemo: true,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-14T10:30:00.000Z',
    },
    {
      id: 'subj-earthsci-11',
      code: 'CORE-ELS11',
      name: 'Earth and Life Science',
      gradeLevel: 'Grade 11',
      strand: 'STEM',
      quarter: 'Q1',
      teacher: 'Mr. Ramon Bautista',
      accent: 'emerald',
      description:
        'Origin and structure of the Earth, plate tectonics, rock-forming minerals, geologic hazards, and cellular bioenergetics.',
      isDemo: true,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-13T14:15:00.000Z',
    },
    {
      id: 'subj-oralcomm-11',
      code: 'CORE-ENG11',
      name: 'Oral Communication in Context',
      gradeLevel: 'Grade 11',
      strand: 'STEM',
      quarter: 'Q1',
      teacher: 'Mrs. Teresita Aquino',
      accent: 'amber',
      description:
        'Models of communication, intercultural sensitivity, speech contexts, communicative strategies, and speech delivery.',
      isDemo: true,
      createdAt: '2026-11-02T09:00:00.000Z',
      updatedAt: '2026-11-12T16:00:00.000Z',
    },
    {
      id: 'subj-komunikasyon-11',
      code: 'CORE-FIL11',
      name: 'Komunikasyon at Pananaliksik',
      gradeLevel: 'Grade 11',
      strand: 'STEM',
      quarter: 'Q1',
      teacher: 'G. Eduardo Santos',
      accent: 'violet',
      description:
        'Konseptong pangwika, barayti ng wika, gamit ng wika sa lipunan, at kasaysayan ng wikang pambansa sa Pilipinas.',
      isDemo: true,
      createdAt: '2026-11-03T09:30:00.000Z',
      updatedAt: '2026-11-11T11:20:00.000Z',
    },
    {
      id: 'subj-science-10',
      code: 'JHS-SCI10',
      name: 'Science 10 (NCAE Review)',
      gradeLevel: 'Grade 10',
      strand: 'None',
      quarter: 'Q2',
      teacher: 'Ms. Marisol Villanueva',
      accent: 'teal',
      description:
        'Junior High School review module on electromagnetism, heredity, chemical reactions, and gas laws.',
      isDemo: true,
      createdAt: '2026-11-04T10:00:00.000Z',
      updatedAt: '2026-11-10T09:45:00.000Z',
    },
  ];
}

export function createDemoDocuments(): LocalDocument[] {
  return [
    {
      id: 'doc-demo-1',
      subjectId: 'subj-genmath-11',
      fileName: 'Q1_Module_1_Functions_and_Graphs.pdf',
      fileSize: 1482900,
      mimeType: 'application/pdf',
      extension: 'pdf',
      storageTarget: 'indexeddb-local',
      folderLabel: 'Demo Seed Metadata',
      extractionStatus: 'demo-seed',
      extractionMethod: 'demo-seed',
      pageCount: 4,
      topicCount: 2,
      confirmedTopicCount: 2,
      ocrUsed: false,
      notes: 'DepEd SLM Quarter 1 Week 1 — Evaluating functions and piecewise graphs.',
      isDemo: true,
      addedAt: '2026-11-10T07:30:00.000Z',
    },
    {
      id: 'doc-demo-2',
      subjectId: 'subj-earthsci-11',
      fileName: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt',
      fileSize: 3420,
      mimeType: 'text/plain',
      extension: 'txt',
      storageTarget: 'indexeddb-local',
      folderLabel: 'Demo Seed Metadata',
      extractionStatus: 'demo-seed',
      extractionMethod: 'demo-seed',
      pageCount: 1,
      topicCount: 1,
      confirmedTopicCount: 1,
      ocrUsed: false,
      textPreview:
        'Philippine Mobile Belt & Major Fault Systems\n\n1. The Philippine Fault Zone (PFZ) is a 1,200-km left-lateral strike-slip fault extending from Luzon to Mindanao.\n2. The West Valley Fault traverses Metro Manila, Bulacan, Rizal, Cavite, and Laguna.\n3. Subduction zones include the Manila Trench (west) and Philippine Trench (east).',
      notes: 'Quick summary notes for Earth and Life Science Week 3.',
      isDemo: true,
      addedAt: '2026-11-11T15:10:00.000Z',
    },
  ];
}

export function createDemoDocumentContents(): DocumentExtractionContent[] {
  return [
    {
      documentId: 'doc-demo-1',
      sourceFileName: 'Q1_Module_1_Functions_and_Graphs.pdf',
      detectedSubject: 'General Mathematics',
      detectedChapters: ['Quarter 1: Functions and Their Graphs'],
      detectedLessons: ['Lesson 1: Piecewise Functions', 'Lesson 2: Rational Functions'],
      pageCount: 4,
      ocrApplied: false,
      ocrPageNumbers: [],
      extractionMethod: 'demo-seed',
      pages: [
        {
          pageNumber: 1,
          pageLabel: 'Page 1',
          headings: ['Quarter 1: Functions and Their Graphs', 'Lesson 1: Piecewise Functions'],
          text: 'A function is a relation where each element in the domain corresponds to exactly one element in the range. Piecewise functions use multiple sub-functions across intervals.',
          tables: [],
          formulas: ['f(x) = { 13 if d <= 4; 13 + 1.8(d - 4) if d > 4 }'],
          ocrUsed: false,
        },
        {
          pageNumber: 3,
          pageLabel: 'Page 3',
          headings: ['Lesson 2: Rational Functions & Asymptotes'],
          text: 'A rational function takes the form f(x) = P(x) / Q(x), where P(x) and Q(x) are polynomials and Q(x) != 0.',
          tables: [],
          formulas: ['f(x) = P(x) / Q(x), Q(x) ≠ 0'],
          ocrUsed: false,
        },
      ],
      fullExtractedText:
        '[Page 1]\nQuarter 1: Functions and Their Graphs\nLesson 1: Piecewise Functions\nA function is a relation where each element in the domain corresponds to exactly one element in the range.\n\n[Page 3]\nLesson 2: Rational Functions & Asymptotes\nA rational function takes the form f(x) = P(x) / Q(x).',
      topicInventory: [
        {
          id: 'inv-demo-1',
          subjectHint: 'General Mathematics',
          chapter: 'Quarter 1: Functions and Their Graphs',
          lesson: 'Lesson 1: Piecewise Functions',
          title: 'Piecewise Functions & Real-Life Modeling',
          subtopics: ['Domain & Range', 'Jeepney Fare Piecewise Model'],
          summary:
            'Representing jeepney fare brackets, electricity tiers, and mobile plans as piecewise functions.',
          pageRef: 'Pages 1–2',
          definitions: [
            {
              id: 'def-demo-1',
              kind: 'definition',
              term: 'Function',
              content:
                'A relation where each element in the domain corresponds to exactly one element in the range.',
              pageRef: 'Page 1',
            },
          ],
          formulas: [
            {
              id: 'form-demo-1',
              kind: 'formula',
              content: 'F(d) = 13 + 1.80(d - 4) for d > 4',
              pageRef: 'Page 1',
            },
          ],
          examples: [
            {
              id: 'ex-demo-1',
              kind: 'example',
              content: 'Compute jeepney fare for 9 km: F(9) = 13 + 1.80(5) = ₱22.00.',
              pageRef: 'Page 2',
            },
          ],
          importantConcepts: [
            {
              id: 'con-demo-1',
              kind: 'concept',
              content: 'Vertical Line Test verifies if a graph represents a function.',
              pageRef: 'Page 1',
            },
          ],
          confirmed: true,
          syncedTopicId: 'topic-demo-1',
        },
        {
          id: 'inv-demo-2',
          subjectHint: 'General Mathematics',
          chapter: 'Quarter 1: Functions and Their Graphs',
          lesson: 'Lesson 2: Rational Functions',
          title: 'Rational Functions, Asymptotes & Intercepts',
          subtopics: ['Domain Restrictions', 'Vertical & Horizontal Asymptotes'],
          summary:
            'Finding domain restrictions, vertical/horizontal asymptotes, and solving rational inequalities.',
          pageRef: 'Pages 3–4',
          definitions: [
            {
              id: 'def-demo-2',
              kind: 'definition',
              term: 'Rational Function',
              content: 'A function of the form f(x) = P(x) / Q(x) where Q(x) ≠ 0.',
              pageRef: 'Page 3',
            },
          ],
          formulas: [
            {
              id: 'form-demo-2',
              kind: 'formula',
              content: 'f(x) = P(x) / Q(x), Q(x) ≠ 0',
              pageRef: 'Page 3',
            },
          ],
          examples: [],
          importantConcepts: [],
          confirmed: true,
          syncedTopicId: 'topic-demo-2',
        },
      ],
      inventoryStatus: 'confirmed',
      hasLocalFileBlob: false,
      updatedAt: '2026-11-10T07:35:00.000Z',
    },
    {
      documentId: 'doc-demo-2',
      sourceFileName: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt',
      detectedSubject: 'Earth and Life Science',
      detectedChapters: ['Unit 1: Earth Materials and Processes'],
      detectedLessons: ['Philippine Mobile Belt & Major Fault Systems'],
      pageCount: 1,
      ocrApplied: false,
      ocrPageNumbers: [],
      extractionMethod: 'demo-seed',
      pages: [
        {
          pageNumber: 1,
          pageLabel: 'Section 1',
          headings: ['Philippine Mobile Belt & Major Fault Systems'],
          text: '1. The Philippine Fault Zone (PFZ) is a 1,200-km left-lateral strike-slip fault extending from Luzon to Mindanao.\n2. The West Valley Fault traverses Metro Manila, Bulacan, Rizal, Cavite, and Laguna.\n3. Subduction zones include the Manila Trench (west) and Philippine Trench (east).',
          tables: [],
          formulas: [],
          ocrUsed: false,
        },
      ],
      fullExtractedText:
        'Philippine Mobile Belt & Major Fault Systems\n\n1. The Philippine Fault Zone (PFZ) is a 1,200-km left-lateral strike-slip fault extending from Luzon to Mindanao.',
      topicInventory: [
        {
          id: 'inv-demo-3',
          subjectHint: 'Earth and Life Science',
          chapter: 'Unit 1: Earth Materials and Processes',
          lesson: 'Philippine Mobile Belt & Major Fault Systems',
          title: 'Endogenic Processes & Philippine Volcanism',
          subtopics: ['Philippine Fault Zone', 'West Valley Fault', 'Manila & Philippine Trenches'],
          summary:
            'Magma formation, subduction along the Pacific Ring of Fire, and PHIVOLCS hazard classifications.',
          pageRef: 'Section 1',
          definitions: [],
          formulas: [],
          examples: [],
          importantConcepts: [
            {
              id: 'con-demo-2',
              kind: 'concept',
              content:
                'The West Valley Fault is a dextral strike-slip fault traversing Metro Manila and nearby provinces.',
              pageRef: 'Section 1',
            },
          ],
          confirmed: true,
          syncedTopicId: 'topic-demo-3',
        },
      ],
      inventoryStatus: 'confirmed',
      hasLocalFileBlob: false,
      updatedAt: '2026-11-11T15:15:00.000Z',
    },
  ];
}

export function createDemoTopics(): Topic[] {
  return [
    {
      id: 'topic-demo-1',
      subjectId: 'subj-genmath-11',
      title: 'Piecewise Functions & Real-Life Modeling',
      quarter: 'Q1',
      summary: 'Representing jeepney fare brackets, electricity tiers, and mobile plans as piecewise functions.',
      masteryStatus: 'mastered',
      linkedDocumentIds: ['doc-demo-1'],
      sourceDocumentId: 'doc-demo-1',
      sourceFileName: 'Q1_Module_1_Functions_and_Graphs.pdf',
      pageRef: 'Pages 1–2',
      chapter: 'Quarter 1: Functions and Their Graphs',
      lesson: 'Lesson 1: Piecewise Functions',
      subtopics: ['Domain & Range', 'Jeepney Fare Piecewise Model'],
      isDemo: true,
      updatedAt: '2026-11-12T08:00:00.000Z',
    },
    {
      id: 'topic-demo-2',
      subjectId: 'subj-genmath-11',
      title: 'Rational Functions, Asymptotes & Intercepts',
      quarter: 'Q1',
      summary: 'Finding domain restrictions, vertical/horizontal asymptotes, and solving rational inequalities.',
      masteryStatus: 'in-progress',
      linkedDocumentIds: ['doc-demo-1'],
      sourceDocumentId: 'doc-demo-1',
      sourceFileName: 'Q1_Module_1_Functions_and_Graphs.pdf',
      pageRef: 'Pages 3–4',
      chapter: 'Quarter 1: Functions and Their Graphs',
      lesson: 'Lesson 2: Rational Functions',
      subtopics: ['Domain Restrictions', 'Vertical & Horizontal Asymptotes'],
      isDemo: true,
      updatedAt: '2026-11-14T18:20:00.000Z',
    },
    {
      id: 'topic-demo-3',
      subjectId: 'subj-earthsci-11',
      title: 'Endogenic Processes & Philippine Volcanism',
      quarter: 'Q1',
      summary: 'Magma formation, subduction along the Pacific Ring of Fire, and PHIVOLCS hazard classifications.',
      masteryStatus: 'in-progress',
      linkedDocumentIds: ['doc-demo-2'],
      sourceDocumentId: 'doc-demo-2',
      sourceFileName: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt',
      pageRef: 'Section 1',
      chapter: 'Unit 1: Earth Materials and Processes',
      lesson: 'Philippine Mobile Belt & Major Fault Systems',
      isDemo: true,
      updatedAt: '2026-11-13T16:40:00.000Z',
    },
    {
      id: 'topic-demo-4',
      subjectId: 'subj-oralcomm-11',
      title: 'Shannon-Weaver vs. Schramm Communication Models',
      quarter: 'Q1',
      summary: 'Comparing linear transmission models with interactive feedback-driven communication.',
      masteryStatus: 'mastered',
      linkedDocumentIds: [],
      isDemo: true,
      updatedAt: '2026-11-11T10:15:00.000Z',
    },
    {
      id: 'topic-demo-5',
      subjectId: 'subj-komunikasyon-11',
      title: 'Antas at Barayti ng Wika (Dayalek, Sosyolek, Idyolek)',
      quarter: 'Q1',
      summary: 'Pag-unawa sa heterogenous at homogenous na katangian ng wikang Filipino sa iba’t ibang rehiyon.',
      masteryStatus: 'not-started',
      linkedDocumentIds: [],
      isDemo: true,
      updatedAt: '2026-11-10T14:00:00.000Z',
    },
  ];
}

export function createDemoStudyGuides(): StudyGuide[] {
  return [
    {
      id: 'guide-demo-1',
      subjectId: 'subj-genmath-11',
      topicId: 'topic-demo-2',
      title: 'Rational Functions & Asymptotes Quick Reviewer',
      summary:
        'Step-by-step rules for determining domain restrictions, vertical asymptotes, horizontal asymptotes, and zeroes of rational functions.',
      keyConcepts: [
        'Domain: Set denominator Q(x) ≠ 0 and solve for excluded values.',
        'Vertical Asymptote: Zeros of Q(x) that do not cancel with P(x).',
        'Horizontal Asymptote: Compare degree n of numerator vs. degree m of denominator.',
        'If n < m, y = 0; if n = m, y = leading coefficient ratio a/b; if n > m, no horizontal asymptote.',
      ],
      bodyMarkdown:
        '### 1. Definition\nA rational function has the form f(x) = P(x) / Q(x), where P(x) and Q(x) are polynomials and Q(x) ≠ 0.\n\n### 2. Three-Step Graphing Checklist\n1. Factor both numerator and denominator completely.\n2. Identify holes (common factors) versus vertical asymptotes (remaining denominator roots).\n3. Find x-intercepts (remaining numerator roots) and y-intercept (evaluate f(0)).\n\n### 3. Practice Tip for Philippine SHS Exams\nAlways check whether a test question asks for the range or horizontal asymptote—sketching a quick sign table prevents sign errors on rational inequalities.',
      sourceMode: 'demo-seed',
      isDemo: true,
      updatedAt: '2026-11-14T18:30:00.000Z',
    },
    {
      id: 'guide-demo-2',
      subjectId: 'subj-earthsci-11',
      topicId: 'topic-demo-3',
      title: 'Philippine Plate Tectonics & Geologic Hazards',
      summary:
        'Offline study guide summarizing major trenches, active fault systems, and DRRR preparedness concepts.',
      keyConcepts: [
        'Philippine Sea Plate subducts westward under the Philippine Mobile Belt at the Philippine Trench.',
        'Eurasian Plate subducts eastward along the Manila, Negros, and Cotabato Trenches.',
        'PHIVOLCS monitors active faults, lahar zones, and volcanic alert levels (Alert Level 0 to 5).',
      ],
      bodyMarkdown:
        '### Tectonic Setting of the Philippines\nThe Philippine archipelago sits between two converging plates: the Eurasian Plate to the west and the Philippine Sea Plate to the east.\n\n### Key Structures to Remember\n- **Manila Trench**: Causes seismic activity along western Luzon.\n- **Philippine Fault Zone (PFZ)**: Runs roughly north-to-south from Ilocos to Davao.\n- **Taal & Mayon**: Active arc volcanoes linked to subduction-zone melting.',
      sourceMode: 'demo-seed',
      isDemo: true,
      updatedAt: '2026-11-13T17:00:00.000Z',
    },
  ];
}

export function createDemoMockExams(): MockExam[] {
  return [
    {
      id: 'exam-demo-genmath',
      subjectId: 'subj-genmath-11',
      title: 'Grade 11 General Mathematics — Quarter 1 Practice Quiz',
      gradeLevel: 'Grade 11',
      quarter: 'Quarter 1',
      difficulty: 'medium',
      timeLimitMinutes: 10,
      description:
        'Offline demonstration mock quiz covering function evaluation, composition, and rational asymptotes.',
      topicIds: ['topic-demo-1', 'topic-demo-2'],
      sourceMode: 'demo-seed',
      isDemo: true,
      createdAt: '2026-11-10T08:00:00.000Z',
      questions: [
        {
          id: 'q-gm-1',
          type: 'multiple-choice',
          prompt: 'If f(x) = 3x² - 2x + 5, what is the value of f(-2)?',
          choices: ['13', '21', '9', '17'],
          correctIndex: 1,
          expectedAnswer: '21',
          points: 1,
          hints: {
            level1: 'Recall how function evaluation substitutes the input value for every occurrence of x.',
            level2: 'Be careful when squaring a negative number: (-2)² is positive before multiplying by 3.',
            level3: 'Compute 3(-2)², then subtract 2(-2) (note the double negative), and finally add 5.',
          },
          explanation: 'f(-2) = 3(-2)² - 2(-2) + 5 = 3(4) + 4 + 5 = 12 + 4 + 5 = 21.',
          commonMistakes: 'Forgetting that -2(-2) becomes +4, or squaring -2 as -4.',
          sourceReference: 'Q1_Module_1_Functions_and_Graphs.pdf · Page 1',
          topicId: 'topic-demo-1',
          topicTitle: 'Piecewise Functions & Real-Life Modeling',
        },
        {
          id: 'q-gm-2',
          type: 'multiple-choice',
          prompt:
            'A local jeepney ride in Metro Manila costs ₱13.00 for the first 4 km and ₱1.80 for each succeeding kilometer. Which piecewise expression represents the fare F(d) for d > 4 km?',
          choices: [
            'F(d) = 13 + 1.80d',
            'F(d) = 13 + 1.80(d - 4)',
            'F(d) = 13(d - 4) + 1.80',
            'F(d) = 13 + 1.80(d + 4)',
          ],
          correctIndex: 1,
          expectedAnswer: 'F(d) = 13 + 1.80(d - 4)',
          points: 1,
          hints: {
            level1: 'Think about how many kilometers are already covered by the flat ₱13.00 base fare.',
            level2: 'Do not charge ₱1.80 on the initial 4 kilometers—subtract that covered distance from d first.',
            level3: 'Combine the constant base fare ₱13.00 with ₱1.80 multiplied by the excess distance beyond 4 km.',
          },
          explanation:
            'Only the kilometers beyond the initial 4 km are charged ₱1.80 each, giving 13 + 1.80(d - 4).',
          commonMistakes: 'Multiplying 1.80 by d directly, which double-charges the first 4 km.',
          sourceReference: 'Q1_Module_1_Functions_and_Graphs.pdf · Page 2',
          topicId: 'topic-demo-1',
          topicTitle: 'Piecewise Functions & Real-Life Modeling',
        },
        {
          id: 'q-gm-3',
          type: 'multiple-choice',
          prompt: 'What is the horizontal asymptote of f(x) = (4x² - 1) / (2x² + 5x - 3)?',
          choices: ['y = 0', 'y = 2', 'y = 4', 'No horizontal asymptote'],
          correctIndex: 1,
          expectedAnswer: 'y = 2',
          points: 1,
          hints: {
            level1: 'Recall the degree-comparison rules for horizontal asymptotes of rational functions.',
            level2: 'Compare the highest exponent of x in the numerator with the highest exponent of x in the denominator.',
            level3: 'When both polynomials share the same degree, divide the leading coefficient of the numerator by that of the denominator.',
          },
          explanation:
            'Since the numerator and denominator have the same degree (2), the horizontal asymptote is the ratio of leading coefficients: 4 / 2 = 2.',
          commonMistakes: 'Dividing constant terms (-1 / -3) instead of leading coefficients.',
          sourceReference: 'Q1_Module_1_Functions_and_Graphs.pdf · Page 3',
          topicId: 'topic-demo-2',
          topicTitle: 'Rational Functions, Asymptotes & Intercepts',
        },
        {
          id: 'q-gm-4',
          type: 'multiple-choice',
          prompt: 'Which value of x is excluded from the domain of g(x) = (x + 3) / (x² - 9)?',
          choices: ['x = 0 only', 'x = -3 only', 'x = 3 and x = -3', 'x = 9 only'],
          correctIndex: 2,
          expectedAnswer: 'x = 3 and x = -3',
          points: 1,
          hints: {
            level1: 'Recall which part of a rational expression cannot equal zero.',
            level2: 'Factor the denominator as a difference of two squares before canceling any factors.',
            level3: 'Check domain restrictions on the original unsimplified denominator—even removable holes remain excluded.',
          },
          explanation:
            'Even though (x + 3) cancels to create a hole at x = -3, both x = 3 and x = -3 make x² - 9 = 0 and are excluded from the domain.',
          commonMistakes: 'Canceling (x + 3) first and forgetting that the hole value is still excluded from the domain.',
          sourceReference: 'Q1_Module_1_Functions_and_Graphs.pdf · Page 4',
          topicId: 'topic-demo-2',
          topicTitle: 'Rational Functions, Asymptotes & Intercepts',
        },
        {
          id: 'q-gm-5',
          type: 'multiple-choice',
          prompt: 'Given f(x) = 2x + 1 and g(x) = x - 4, find (f ∘ g)(3).',
          choices: ['-1', '3', '-2', '7'],
          correctIndex: 0,
          expectedAnswer: '-1',
          points: 1,
          hints: {
            level1: 'Remember which function is evaluated first in the composition (f ∘ g)(3).',
            level2: 'Evaluate the inner expression g(3) before substituting that output into f.',
            level3: 'Take the result of 3 - 4, then double it and add 1.',
          },
          explanation: 'First compute g(3) = 3 - 4 = -1. Then f(-1) = 2(-1) + 1 = -1.',
          commonMistakes: 'Computing (g ∘ f)(3) instead of (f ∘ g)(3), or multiplying f(3) and g(3).',
          sourceReference: 'Q1_Module_1_Functions_and_Graphs.pdf · Page 1',
          topicId: 'topic-demo-1',
          topicTitle: 'Piecewise Functions & Real-Life Modeling',
        },
      ],
    },
    {
      id: 'exam-demo-earthsci',
      subjectId: 'subj-earthsci-11',
      title: 'Earth & Life Science — Plate Tectonics & Hazards Drill',
      gradeLevel: 'Grade 11',
      quarter: 'Quarter 1',
      difficulty: 'easy',
      timeLimitMinutes: 8,
      description:
        'Offline demonstration drill covering Philippine tectonic trenches, mineral properties, and rock cycle concepts.',
      topicIds: ['topic-demo-3'],
      sourceMode: 'demo-seed',
      isDemo: true,
      createdAt: '2026-11-11T09:00:00.000Z',
      questions: [
        {
          id: 'q-es-1',
          type: 'multiple-choice',
          prompt: 'Which mineral property describes the color of a mineral in its powdered form?',
          choices: ['Luster', 'Cleavage', 'Streak', 'Specific gravity'],
          correctIndex: 2,
          expectedAnswer: 'Streak',
          points: 1,
          hints: {
            level1: 'Think about the physical mineral identification tests performed in lab.',
            level2: 'Recall what happens when a mineral specimen is rubbed across an unglazed porcelain plate.',
            level3: 'Focus on the property that reveals powder color rather than surface reflection or breakage planes.',
          },
          explanation:
            'Streak is tested on an unglazed porcelain plate and is often more reliable than surface color.',
          commonMistakes: 'Confusing luster (light reflection) with powdered color.',
          sourceReference: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt · Section 1',
          topicId: 'topic-demo-3',
          topicTitle: 'Endogenic Processes & Philippine Volcanism',
        },
        {
          id: 'q-es-2',
          type: 'multiple-choice',
          prompt:
            'The West Valley Fault, which poses a major earthquake hazard to Metro Manila and nearby provinces, is primarily what type of fault?',
          choices: [
            'Dextral strike-slip fault',
            'Normal divergent fault',
            'Blind thrust fault',
            'Transform oceanic ridge',
          ],
          correctIndex: 0,
          expectedAnswer: 'Dextral strike-slip fault',
          points: 1,
          hints: {
            level1: 'Recall the major fault systems traversing Luzon in PHIVOLCS maps.',
            level2: 'Consider whether blocks along the Valley Fault System slide predominantly horizontally past each other.',
            level3: 'When standing on one side of this horizontal fault, the opposite block moves to the right.',
          },
          explanation:
            'The West Valley Fault is predominantly a right-lateral (dextral) strike-slip fault system.',
          commonMistakes: 'Assuming inland Philippine faults are oceanic ridges or purely vertical normal faults.',
          sourceReference: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt · Section 1',
          topicId: 'topic-demo-3',
          topicTitle: 'Endogenic Processes & Philippine Volcanism',
        },
        {
          id: 'q-es-3',
          type: 'multiple-choice',
          prompt: 'Which type of rock forms directly from the cooling and solidification of magma or lava?',
          choices: ['Sedimentary rock', 'Metamorphic rock', 'Igneous rock', 'Evaporite'],
          correctIndex: 2,
          expectedAnswer: 'Igneous rock',
          points: 1,
          hints: {
            level1: 'Think of the three main classes in the rock cycle.',
            level2: 'Focus on rocks originating from molten material rather than compacted sediments or heat-altered pre-existing rock.',
            level3: 'The name of this rock group comes from the Latin root for "fire".',
          },
          explanation:
            'Igneous rocks form through crystallization of molten rock either underground (intrusive) or at the surface (extrusive).',
          commonMistakes: 'Mixing up metamorphic (transformed without full melting) and molten-cooled rock.',
          sourceReference: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt · Section 1',
          topicId: 'topic-demo-3',
          topicTitle: 'Endogenic Processes & Philippine Volcanism',
        },
        {
          id: 'q-es-4',
          type: 'multiple-choice',
          prompt:
            'Which Philippine government agency is mandated to monitor earthquakes, tsunamis, and volcanic activity?',
          choices: ['PAGASA', 'PHIVOLCS', 'DENR-MGB', 'NDRRMC'],
          correctIndex: 1,
          expectedAnswer: 'PHIVOLCS',
          points: 1,
          hints: {
            level1: 'Recall the Philippine science agencies under the Department of Science and Technology (DOST).',
            level2: 'Distinguish between the agency for typhoons/weather and the agency for geologic seismic/volcanic hazards.',
            level3: 'Look at the acronym whose letters stand for Philippine Institute of Volcanology and Seismology.',
          },
          explanation:
            'PHIVOLCS (Philippine Institute of Volcanology and Seismology) monitors volcanic and seismic hazards.',
          commonMistakes: 'Selecting PAGASA (meteorological/weather) or NDRRMC (disaster coordination council).',
          sourceReference: 'Plate_Tectonics_and_Philippine_Fault_Lines.txt · Section 1',
          topicId: 'topic-demo-3',
          topicTitle: 'Endogenic Processes & Philippine Volcanism',
        },
      ],
    },
  ];
}

export function createDemoExamAttempts(): ExamAttempt[] {
  return [
    {
      id: 'attempt-demo-1',
      examId: 'exam-demo-genmath',
      examTitle: 'Grade 11 General Mathematics — Quarter 1 Practice Quiz',
      subjectId: 'subj-genmath-11',
      subjectName: 'General Mathematics',
      score: 4,
      totalQuestions: 5,
      percentage: 80,
      durationSeconds: 245,
      answers: {
        'q-gm-1': 1,
        'q-gm-2': 1,
        'q-gm-3': 1,
        'q-gm-4': 0,
        'q-gm-5': 0,
      },
      completedAt: '2026-11-14T15:30:00.000Z',
      isDemo: true,
    },
    {
      id: 'attempt-demo-2',
      examId: 'exam-demo-earthsci',
      examTitle: 'Earth & Life Science — Plate Tectonics & Hazards Drill',
      subjectId: 'subj-earthsci-11',
      subjectName: 'Earth and Life Science',
      score: 3,
      totalQuestions: 4,
      percentage: 75,
      durationSeconds: 180,
      answers: {
        'q-es-1': 2,
        'q-es-2': 1,
        'q-es-3': 2,
        'q-es-4': 1,
      },
      completedAt: '2026-11-12T19:10:00.000Z',
      isDemo: true,
    },
  ];
}
