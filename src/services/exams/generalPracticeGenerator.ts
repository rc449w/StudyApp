import {
  ExamDifficulty,
  GradeLevel,
  MockExam,
  MockQuestion,
  QuestionType,
  Subject,
  TermPeriod,
} from '../../types/domain';
import { validateExamQuestions } from './examValidator';

export type GeneralPracticePreset =
  | 'english-spelling'
  | 'english-grammar'
  | 'math-general'
  | 'science-general';

export interface GeneralPresetOption {
  id: GeneralPracticePreset;
  label: string;
  shortTag: string;
  description: string;
  onlinePromptFocus: string;
  recommendedTypes: QuestionType[];
}

export const GENERAL_PRACTICE_PRESETS: GeneralPresetOption[] = [
  {
    id: 'english-spelling',
    label: 'English Spelling & Vocabulary',
    shortTag: 'Spelling',
    description:
      'Practice commonly misspelled English words, double-consonant patterns, silent letters, and context spelling.',
    onlinePromptFocus:
      'English Spelling Quiz: commonly misspelled words, double letters, silent letters, homophones, and vocabulary in context',
    recommendedTypes: ['multiple-choice', 'identification', 'fill-in-the-blank', 'true-false'],
  },
  {
    id: 'english-grammar',
    label: 'English Grammar & Usage',
    shortTag: 'Grammar',
    description:
      'Subject-verb agreement, modals, active/passive voice, conditionals, cohesive devices, and commonly confused words.',
    onlinePromptFocus:
      'English Grammar and Usage: subject-verb agreement, conditionals, modals, active and passive voice, pronouns, and punctuation',
    recommendedTypes: ['multiple-choice', 'true-false', 'fill-in-the-blank', 'identification'],
  },
  {
    id: 'math-general',
    label: 'General Mathematics Drills',
    shortTag: 'Math',
    description:
      'Dynamic arithmetic, PEMDAS, percentages, ratios, linear equations, slope, Pythagorean theorem, and quadratics.',
    onlinePromptFocus:
      'General Mathematics Practice Quiz: order of operations, percentages, ratios, linear equations, slope, geometry, and algebra problem solving',
    recommendedTypes: ['multiple-choice', 'problem-solving', 'true-false', 'identification'],
  },
  {
    id: 'science-general',
    label: 'General Science Essentials',
    shortTag: 'Science',
    description:
      'Core Physics, Chemistry, Biology, and Earth Science concepts including force, Ohm’s law, cells, matter, and energy.',
    onlinePromptFocus:
      'General Science Practice Quiz: physics laws, chemistry matter and pH, cell biology, photosynthesis, and earth science',
    recommendedTypes: ['multiple-choice', 'true-false', 'identification', 'problem-solving'],
  },
];

export interface GeneralPracticeConfig {
  preset: GeneralPracticePreset;
  subject: Subject;
  gradeLevel: GradeLevel;
  quarter: TermPeriod;
  questionCount: number;
  difficulty: ExamDifficulty;
  durationMinutes: number;
  questionTypes: QuestionType[];
}

interface SpellingEntry {
  word: string;
  misspellings: [string, string, string];
  meaning: string;
  sentence: string; // Uses ___ where word goes
  ruleTip: string;
  level: ExamDifficulty;
}

const SPELLING_BANK: SpellingEntry[] = [
  {
    word: 'separate',
    misspellings: ['seperate', 'separete', 'seprate'],
    meaning: 'to divide or keep apart from others',
    sentence: 'Please ___ the recyclable plastics from the biodegradable waste.',
    ruleTip: 'Think of "a rat" inside the middle letters (sep-a-rat-e), not "er".',
    level: 'easy',
  },
  {
    word: 'necessary',
    misspellings: ['neccessary', 'necesary', 'neccesary'],
    meaning: 'essential or required to achieve a result',
    sentence: 'Bringing a valid school ID is ___ before entering the computer lab.',
    ruleTip: 'One "c" and two "s" letters: like a shirt with 1 collar and 2 sleeves.',
    level: 'easy',
  },
  {
    word: 'definitely',
    misspellings: ['definately', 'definetly', 'definatly'],
    meaning: 'without doubt; clearly true or certain',
    sentence: 'Our study group will ___ meet at the library tomorrow afternoon.',
    ruleTip: 'Comes from the root "finite"—keep the "i" before "-tely".',
    level: 'easy',
  },
  {
    word: 'calendar',
    misspellings: ['calender', 'calandar', 'calander'],
    meaning: 'a chart showing days, weeks, and months of a year',
    sentence: 'Mark the final examination dates clearly on your monthly ___.',
    ruleTip: 'Ends with "-ar", matching "solar" and "lunar", not "-er".',
    level: 'easy',
  },
  {
    word: 'grammar',
    misspellings: ['grammer', 'gramar', 'grammr'],
    meaning: 'the system and structure of rules in a language',
    sentence: 'Proofreading helps catch ___ and punctuation slips before submission.',
    ruleTip: 'It is symmetrical around the double "m" and ends with "-ar", not "-er".',
    level: 'easy',
  },
  {
    word: 'library',
    misspellings: ['libary', 'liberry', 'librery'],
    meaning: 'a room or building containing collections of books and study resources',
    sentence: 'Students checked out reference atlases from the school ___.',
    ruleTip: 'Do not drop the first "r" after "lib-"—pronounce both "r" sounds cleanly.',
    level: 'easy',
  },
  {
    word: 'Wednesday',
    misspellings: ['Wensday', 'Wedensday', 'Wednsday'],
    meaning: 'the day of the week between Tuesday and Thursday',
    sentence: 'The science laboratory quiz is scheduled for next ___.',
    ruleTip: 'Keep the silent "d" after "We-" and spell "nes" before "-day".',
    level: 'easy',
  },
  {
    word: 'February',
    misspellings: ['Febuary', 'Febrary', 'Feburary'],
    meaning: 'the second month of the year',
    sentence: 'National Arts Month is celebrated throughout ___.',
    ruleTip: 'Keep both "r" letters ("Feb-ru-ary") even when speaking casually.',
    level: 'easy',
  },
  {
    word: 'receive',
    misspellings: ['recieve', 'receve', 'receeve'],
    meaning: 'to be given, presented with, or paid something',
    sentence: 'Top scorers will ___ certificates during Friday’s assembly.',
    ruleTip: 'Follows the classic rule: "i before e except after c".',
    level: 'easy',
  },
  {
    word: 'believe',
    misspellings: ['beleive', 'belive', 'beleeve'],
    meaning: 'to accept something as true or feel sure of its truth',
    sentence: 'Scientists ___ evidence must be verified by repeated trials.',
    ruleTip: 'After "l" (not "c"), use "ie" rather than "ei".',
    level: 'easy',
  },
  {
    word: 'truly',
    misspellings: ['truely', 'trully', 'trooly'],
    meaning: 'genuinely, accurately, or without exaggeration',
    sentence: 'She was ___ grateful to her classmates for sharing their reviewer notes.',
    ruleTip: 'Drop the silent "e" from the base word "true" before adding "-ly".',
    level: 'easy',
  },
  {
    word: 'argument',
    misspellings: ['arguement', 'argumant', 'arguemant'],
    meaning: 'a reasoned claim supported by evidence in a discussion or essay',
    sentence: 'Every persuasive essay needs a clear central ___ backed by facts.',
    ruleTip: 'Drop the final "e" from "argue" before attaching "-ment".',
    level: 'easy',
  },
  {
    word: 'accommodate',
    misspellings: ['accomodate', 'acommodate', 'acomodate'],
    meaning: 'to provide room or adapt cleanly to someone’s needs',
    sentence: 'The auditorium can ___ up to four hundred students comfortably.',
    ruleTip: 'Remember two "c" letters AND two "m" letters.',
    level: 'medium',
  },
  {
    word: 'embarrass',
    misspellings: ['embarass', 'embaress', 'embbarrass'],
    meaning: 'to cause someone to feel awkward or self-conscious',
    sentence: 'Making a tiny slip on stage does not need to ___ a speaker.',
    ruleTip: 'Double "r" AND double "s"—two sets of twin consonants.',
    level: 'medium',
  },
  {
    word: 'environment',
    misspellings: ['enviroment', 'enviornment', 'envirornment'],
    meaning: 'the natural surroundings or conditions in which a living thing exists',
    sentence: 'Planting mangroves protects the coastal ___ from storm surges.',
    ruleTip: 'Keep the "n" before the "m": "environ" + "-ment".',
    level: 'medium',
  },
  {
    word: 'occurrence',
    misspellings: ['occurence', 'occurrance', 'ocurence'],
    meaning: 'an incident, event, or instance of something happening',
    sentence: 'A total solar eclipse is a rare astronomical ___ in any one city.',
    ruleTip: 'Double "c", double "r", and ends in "-ence" (not "-ance").',
    level: 'medium',
  },
  {
    word: 'privilege',
    misspellings: ['privilage', 'priviledge', 'privelege'],
    meaning: 'a special right, advantage, or honor granted to a person or group',
    sentence: 'Representing the school at the regional debate is a great ___.',
    ruleTip: 'No letter "d" inside! Both vowels in the middle are "i" ("privi-lege").',
    level: 'medium',
  },
  {
    word: 'conscience',
    misspellings: ['consience', 'conscence', 'consceince'],
    meaning: 'an inner moral sense of right and wrong guiding behavior',
    sentence: 'Academic integrity begins with listening to your own ___.',
    ruleTip: 'Combine "con-" + the exact spelling of "science".',
    level: 'medium',
  },
  {
    word: 'rhythm',
    misspellings: ['rythm', 'rhythym', 'rhythem'],
    meaning: 'a strong, regular repeated pattern of movement or sound',
    sentence: 'Traditional poetry often relies on meter and natural ___.',
    ruleTip: 'No standard vowels (a/e/i/o/u) at all—only "y", with "h" after both "r" and "t".',
    level: 'medium',
  },
  {
    word: 'pronunciation',
    misspellings: ['pronounciation', 'pronunciaton', 'pronunsiation'],
    meaning: 'the way in which a word or language sound is spoken',
    sentence: 'Checking audio dictionaries helps improve accurate ___ of new terms.',
    ruleTip: 'Drop the "o" from "pronounce"—the noun uses "-nun-" not "-noun-".',
    level: 'medium',
  },
  {
    word: 'maintenance',
    misspellings: ['maintainance', 'maintenence', 'maintanance'],
    meaning: 'the process of keeping equipment or buildings in good working condition',
    sentence: 'Regular ___ keeps the school laboratory microscopes calibrated.',
    ruleTip: 'Even though the verb is "maintain", the noun uses "-ten-" and ends in "-ance".',
    level: 'medium',
  },
  {
    word: 'committee',
    misspellings: ['commitee', 'comittee', 'committe'],
    meaning: 'a group of people appointed for a specific function or event',
    sentence: 'The student ___ organized the annual book fair.',
    ruleTip: 'Three pairs of double letters: double "m", double "t", double "e".',
    level: 'medium',
  },
  {
    word: 'government',
    misspellings: ['goverment', 'governmant', 'guvernment'],
    meaning: 'the governing body of a nation, province, or community',
    sentence: 'Civic education explains how local ___ serves barangay communities.',
    ruleTip: 'Keep the "n" after "r" ("govern" + "-ment").',
    level: 'medium',
  },
  {
    word: 'recommend',
    misspellings: ['reccomend', 'recomend', 'recommmend'],
    meaning: 'to put forward someone or something as suitable and good',
    sentence: 'Teachers ___ reviewing summary notes for twenty minutes each evening.',
    ruleTip: 'Starts with "re-" + "commend": single "c", double "m".',
    level: 'medium',
  },
  {
    word: 'exaggerate',
    misspellings: ['exagerate', 'exagerrate', 'exadgerate'],
    meaning: 'to represent something as larger or more dramatic than it really is',
    sentence: 'Objective news reports avoid language meant to ___ minor statistics.',
    ruleTip: 'Double "g" in the middle, single "r" after "-a-".',
    level: 'hard',
  },
  {
    word: 'entrepreneur',
    misspellings: ['entrepeneur', 'entreperneur', 'entreprenuer'],
    meaning: 'a person who sets up a business, taking on financial risks in hope of profit',
    sentence: 'A young ___ launched an eco-friendly bamboo stationery brand.',
    ruleTip: 'French origin: keep "r" in "entre-", "pre-", and end with "-neur" ("eu" before "r").',
    level: 'hard',
  },
  {
    word: 'questionnaire',
    misspellings: ['questionaire', 'questionnare', 'questtionaire'],
    meaning: 'a set of written questions used to collect survey data',
    sentence: 'Grade 10 researchers tested their survey ___ before gathering responses.',
    ruleTip: 'Keep "question" + double "n" + "-aire".',
    level: 'hard',
  },
  {
    word: 'bureaucracy',
    misspellings: ['beaurocracy', 'bureacracy', 'bureucracy'],
    meaning: 'a system of administration managed by structured departments and officials',
    sentence: 'Streamlining permits can reduce unnecessary delays inside large ___.',
    ruleTip: 'Starts with the French root "bureau" (e-a-u) followed by "-cracy".',
    level: 'hard',
  },
  {
    word: 'conscientious',
    misspellings: ['consciencious', 'concientious', 'conscientous'],
    meaning: 'wishing to do one’s work or duty thoroughly and carefully',
    sentence: 'A ___ lab partner double-checks every measurement before recording it.',
    ruleTip: 'Built from "conscience", swapping "-ce" for "-tious".',
    level: 'hard',
  },
  {
    word: 'miscellaneous',
    misspellings: ['miscellanous', 'miscelaneous', 'miscelleneous'],
    meaning: 'consisting of a variety of different items or topics',
    sentence: 'Store loose paper clips and sticky tabs in the ___ desk tray.',
    ruleTip: 'Double "l", single "s", "-ane-", and ends in "-eous".',
    level: 'hard',
  },
  {
    word: 'surveillance',
    misspellings: ['surveilance', 'survellance', 'survaillance'],
    meaning: 'close observation or monitoring, especially for security or public health',
    sentence: 'Health agencies use disease ___ to detect seasonal outbreaks early.',
    ruleTip: 'Double "l" after "-ei-" and ends in "-ance".',
    level: 'hard',
  },
  {
    word: 'fluorescent',
    misspellings: ['flourescent', 'fluorecent', 'florescent'],
    meaning: 'emitting bright light when exposed to radiation or electrical discharge',
    sentence: 'Energy-efficient LED tubes have replaced older ___ classroom bulbs.',
    ruleTip: 'Starts with "fluo-" (like fluorine), followed by "-res-" and silent "c" in "-scent".',
    level: 'hard',
  },
  {
    word: 'phenomenon',
    misspellings: ['phenomonon', 'phenomenum', 'phenominon'],
    meaning: 'an observable fact, event, or remarkable occurrence in nature or society',
    sentence: 'El Niño is a climate ___ that affects rainfall patterns across the Philippines.',
    ruleTip: 'Ends with "-men-on" (singular; plural is "-mena").',
    level: 'hard',
  },
  {
    word: 'perseverance',
    misspellings: ['perseverence', 'perserverance', 'perseveranse'],
    meaning: 'steady persistence in doing something despite difficulty or delay',
    sentence: 'Consistent practice and ___ helped the team master calculus problems.',
    ruleTip: 'Related to "persevere"—only one "r" after "per-", and ends in "-ance".',
    level: 'hard',
  },
  {
    word: 'acquaintance',
    misspellings: ['aquaintance', 'acquaintence', 'acquintance'],
    meaning: 'a person one knows slightly, though not yet a close friend',
    sentence: 'She greeted a friendly ___ from the regional quiz bee.',
    ruleTip: 'Includes silent "c" before "q" ("acq-"), "ai" in the middle, and "-ance" at the end.',
    level: 'hard',
  },
  {
    word: 'camouflage',
    misspellings: ['camoflage', 'camouflauge', 'commouflage'],
    meaning: 'blending in with surroundings so an animal or object stays hidden',
    sentence: 'Stick insects rely on natural ___ to hide among forest branches.',
    ruleTip: 'Keep the "u" inside "-mou-" and end with "-flage".',
    level: 'hard',
  },
];

interface ConceptualEntry {
  topicTitle: string;
  term: string;
  fact: string;
  distractors: [string, string, string];
  falseStatement: string;
  passage: string;
  keyword: string;
  hint1: string;
  hint2: string;
  hint3: string;
  explanation: string;
  commonMistakes: string;
}

const GRAMMAR_BANK: ConceptualEntry[] = [
  {
    topicTitle: 'Subject-Verb Agreement (Collective & Indefinite Pronouns)',
    term: 'Singular verb ("is" / "has")',
    fact: 'Indefinite pronouns like "each", "everyone", "everybody", "neither", and "anyone" take a singular verb.',
    distractors: ['Plural verb ("are" / "have")', 'Past participle alone', 'Gerund phrase'],
    falseStatement: 'In formal English grammar, indefinite pronouns such as "everyone" and "each" always require a plural verb like "are".',
    passage: 'When proofreading formal essays, identify the true grammatical subject before choosing the verb. Phrases introduced by "of the students" do not change a singular indefinite pronoun subject like "each" or "neither" into a plural subject.',
    keyword: 'singular',
    hint1: 'Ignore prepositional phrases between the subject and the verb (e.g., "of the students").',
    hint2: 'Check whether the head pronoun refers to individuals considered one at a time.',
    hint3: 'Words ending in "-one" or "-body" follow single-subject verb endings (-s / is / has).',
    explanation: '"Each", "everyone", and "neither" refer to one individual at a time and always take a singular verb.',
    commonMistakes: 'Matching the verb to a plural noun inside a prepositional phrase ("Each of the players *are*") instead of the head subject ("Each").',
  },
  {
    topicTitle: 'Active vs. Passive Voice',
    term: 'Passive Voice',
    fact: 'In passive voice sentences, the grammatical subject receives the action of the verb (often using "be + past participle").',
    distractors: ['Active Voice', 'Imperative Mood', 'Subjunctive Clause'],
    falseStatement: 'In a passive voice sentence, the subject performs the action directly without any auxiliary verb.',
    passage: 'Active voice highlights who performs an action ("The scientist measured the sample"), whereas passive voice highlights the receiver or result ("The sample was measured by the scientist"), making it useful in formal lab reports.',
    keyword: 'passive',
    hint1: 'Ask whether the subject at the start of the sentence is doing the action or receiving it.',
    hint2: 'Look for a form of "to be" paired with a past participle verb.',
    hint3: 'Scientific reports use this voice when the process or object matters more than the person doing it.',
    explanation: 'Passive voice places the receiver of the action in the subject position with a "be + past participle" verb structure.',
    commonMistakes: 'Confusing simple past tense ("She wrote the report") with passive voice ("The report was written by her").',
  },
  {
    topicTitle: 'Modals of Obligation & Advice',
    term: 'Must / Have to',
    fact: 'Modal auxiliaries such as "must" express strong obligation or logical certainty, while "should" expresses recommendation or advice.',
    distractors: ['Might / Could', 'Would rather', 'Used to'],
    falseStatement: 'The modal verb "might" expresses the strongest mandatory legal requirement in English.',
    passage: 'Modal verbs modify the main verb to show necessity, ability, permission, or possibility. Choosing between "must" (mandatory), "should" (advisable), and "may" (permissive/possible) controls tone in persuasive writing.',
    keyword: 'obligation',
    hint1: 'Distinguish between a polite suggestion, a possibility, and a strict requirement.',
    hint2: 'Recall which modal leaves no option when stating a rule.',
    hint3: 'Compare strong duty versus optional possibility.',
    explanation: '"Must" signals strict necessity or strong obligation, whereas "should" gives advice and "may/might" expresses possibility.',
    commonMistakes: 'Adding "-s" or "to" directly after pure modals (writing "*musts*" or "*can to go*").',
  },
  {
    topicTitle: 'Cohesive Devices & Transitions',
    term: 'Contrastive Transition ("However" / "Nevertheless")',
    fact: 'Cohesive devices such as "however", "on the other hand", and "nevertheless" link ideas by signaling a contrast or counterargument.',
    distractors: ['Additive Transition ("Furthermore")', 'Causal Transition ("Therefore")', 'Temporal Marker ("Meanwhile")'],
    falseStatement: 'The transition word "therefore" signals a contrast between two opposing viewpoints.',
    passage: 'Clear paragraphs use transitional markers to guide the reader cleanly. "Furthermore" and "moreover" add supporting evidence; "consequently" and "therefore" indicate cause and effect; "however" introduces an opposing condition.',
    keyword: 'contrast',
    hint1: 'Identify the logical relationship between two connected sentences: addition, cause, time, or opposition.',
    hint2: 'Look for a connector that introduces an unexpected twist or opposing idea.',
    hint3: 'Think of transitions that act similarly to "but" at the start of a new sentence.',
    explanation: 'Contrastive transitions like "however" and "nevertheless" show opposition or exception relative to the previous claim.',
    commonMistakes: 'Using "therefore" (cause-and-effect) when the second clause actually contradicts the first.',
  },
  {
    topicTitle: 'Commonly Confused Words (Affect vs. Effect)',
    term: 'Affect (verb) vs. Effect (noun)',
    fact: 'In standard usage, "affect" functions primarily as a verb meaning "to influence", whereas "effect" usually functions as a noun meaning "a result or outcome".',
    distractors: ['Both are strictly adjectives', '"Effect" is only a verb', '"Affect" always means a finished product'],
    falseStatement: 'In standard grammar, "effect" is always a verb meaning to feel emotion, and "affect" is only a plural noun.',
    passage: 'Remember the mnemonic RAVEN: Remember, Affect is a Verb, Effect is a Noun. "Heavy rainfall can affect road visibility" versus "The effect of heavy rainfall was reduced visibility."',
    keyword: 'influence',
    hint1: 'Check whether the sentence needs an action word (verb) or a naming word (noun).',
    hint2: 'Try substituting "influence" (verb) or "result" (noun) into the blank.',
    hint3: 'Use the RAVEN tip: A = Verb, E = Noun.',
    explanation: '"Affect" (with an "a") acts as the verb meaning to influence; "effect" (with an "e") acts as the noun meaning the resulting outcome.',
    commonMistakes: 'Writing "*affect* on the climate" instead of "*effect* on the climate" after "the".',
  },
  {
    topicTitle: 'Parallel Sentence Structure',
    term: 'Parallelism',
    fact: 'Parallelism requires items in a list or comparison to follow the exact same grammatical form (e.g., all gerunds or all infinitives).',
    distractors: ['Comma Splice', 'Dangling Modifier', 'Double Negative'],
    falseStatement: 'Good English style mixes gerunds, infinitives, and full clauses freely inside the same three-item list.',
    passage: 'Compare "She likes reading, writing, and to paint" (faulty) with "She likes reading, writing, and painting" (parallel). Matching verb forms improves clarity and rhythm.',
    keyword: 'parallel',
    hint1: 'Inspect how every item joined by "and" or "or" is formatted grammatically.',
    hint2: 'Make sure verbs in a series share the same ending or structure.',
    hint3: 'Named after lines that run evenly side by side.',
    explanation: 'Parallelism balances paired or listed words and phrases in identical grammatical patterns.',
    commonMistakes: 'Shifting from "-ing" forms to "to + verb" halfway through a series.',
  },
  {
    topicTitle: 'Conditional Sentences (Second Conditional)',
    term: 'Second Conditional ("If + past simple, ... would + base verb")',
    fact: 'The second conditional expresses hypothetical or unlikely present/future situations using "If + past simple" in the condition clause and "would + base verb" in the result clause.',
    distractors: ['Zero Conditional (universal facts)', 'First Conditional ("will" real future)', 'Present Perfect Continuous'],
    falseStatement: 'To express an imaginary present situation ("If I had wings..."), English pairs "If + past simple" with "will + past participle".',
    passage: 'Conditionals divide into four core levels: Zero (always true: "If water reaches 100°C, it boils"), First (likely future: "If it rains, we will stay inside"), Second (imaginary now: "If I knew the code, I would unlock it"), and Third (unreal past).',
    keyword: 'hypothetical',
    hint1: 'Determine whether the scenario is real/likely or imaginary/contrary to present fact.',
    hint2: 'Pair a past-form "if" verb with "would" + base verb.',
    hint3: 'In formal writing, "If I were..." belongs to this conditional pattern.',
    explanation: 'Second conditional pairs an unreal present condition ("If + past simple") with "would + base verb".',
    commonMistakes: 'Putting "would" inside the "if" clause itself ("*If I would know*").',
  },
  {
    topicTitle: 'Pronoun-Antecedent & Relative Pronouns (Who vs. Whom)',
    term: 'Whom (object pronoun)',
    fact: 'Use "who" when the pronoun acts as the grammatical subject performing the verb, and "whom" when it acts as the object of a verb or preposition.',
    distractors: ['"Whom" is only plural', '"Who" is only used after prepositions', '"Whose" replaces verbs'],
    falseStatement: '"Who" should always be used immediately after prepositions such as "to" or "for" in formal prose.',
    passage: 'A fast check is substitution: if you can replace the word with "he/she/they", use "who"; if "him/her/them" fits naturally, use "whom".',
    keyword: 'object',
    hint1: 'Test the sentence mentally by replacing the blank with "he" versus "him".',
    hint2: 'Prepositions like "to", "for", or "with" take the object form.',
    hint3: 'Both "him" and the right choice end with the letter "m".',
    explanation: '"Whom" serves as the objective case pronoun (matching "him/her/them"), while "who" serves as the subjective case (matching "he/she/they").',
    commonMistakes: 'Using "whom" just to sound formal even when it is the subject performing the verb.',
  },
];

const SCIENCE_BANK: ConceptualEntry[] = [
  {
    topicTitle: 'Newton’s Second Law of Motion',
    term: 'Acceleration = Net Force ÷ Mass (F = m·a)',
    fact: 'Newton’s Second Law states that an object’s acceleration is directly proportional to net force and inversely proportional to its mass (F = ma).',
    distractors: ['Law of Conservation of Charge', 'Boyle’s Gas Law', 'Law of Superposition'],
    falseStatement: 'Doubling the mass of an object while keeping net force constant causes its acceleration to double as well.',
    passage: 'Force is measured in newtons (N = kg·m/s²). Because F = ma, a heavier object requires proportionally more force to achieve the same acceleration as a lighter object.',
    keyword: 'acceleration',
    hint1: 'Relate force (F), mass (m), and acceleration (a).',
    hint2: 'Ask what happens to motion when the same push acts on a heavier cart.',
    hint3: 'Think of the core dynamics equation linking mass and acceleration.',
    explanation: 'By F = ma, acceleration increases with net force and decreases as mass increases.',
    commonMistakes: 'Dividing mass by force instead of dividing force by mass when solving for acceleration.',
  },
  {
    topicTitle: 'Cell Organelles & Energy Production',
    term: 'Mitochondrion',
    fact: 'Mitochondria carry out aerobic cellular respiration to generate ATP, supplying usable chemical energy to eukaryotic cells.',
    distractors: ['Golgi Apparatus', 'Smooth Endoplasmic Reticulum', 'Centriole'],
    falseStatement: 'Ribosomes are responsible for photosynthesis inside animal muscle cells.',
    passage: 'Eukaryotic cells divide labor across membrane-bound organelles: the nucleus houses DNA, ribosomes assemble proteins, chloroplasts capture light energy in plants, and mitochondria produce ATP.',
    keyword: 'respiration',
    hint1: 'Recall which organelle converts glucose and oxygen into cellular ATP.',
    hint2: 'Distinguish energy generation (ATP) from protein packaging (Golgi) or DNA storage (nucleus).',
    hint3: 'Often called the powerhouse of eukaryotic cells.',
    explanation: 'Mitochondria convert biochemical energy from nutrients into ATP through cellular respiration.',
    commonMistakes: 'Mixing up chloroplasts (solar sugar production in plants) with mitochondria (ATP release in both plant and animal cells).',
  },
  {
    topicTitle: 'Photosynthesis Overview',
    term: 'Chlorophyll & Light-Driven Glucose Synthesis',
    fact: 'During photosynthesis, plants use sunlight, carbon dioxide (CO₂), and water (H₂O) to produce glucose (C₆H₁₂O₆) and release oxygen (O₂).',
    distractors: ['Fermentation without light', 'Nitrogen fixation in roots', 'Osmotic lysis'],
    falseStatement: 'Photosynthesis consumes oxygen gas and releases carbon dioxide as its primary gas output.',
    passage: 'Inside chloroplasts, chlorophyll absorbs light energy so plant leaves can convert inorganic carbon dioxide and water into energy-rich glucose molecules and breathable oxygen.',
    keyword: 'photosynthesis',
    hint1: 'Check the inputs (carbon dioxide + water + light) versus outputs (sugar + oxygen).',
    hint2: 'Identify the green pigment that captures photons.',
    hint3: 'Process unique to autotrophs such as green plants and algae.',
    explanation: 'Photosynthesis converts light energy, CO₂, and H₂O into glucose and O₂ inside chloroplasts.',
    commonMistakes: 'Reversing the reactants and products of cellular respiration and photosynthesis.',
  },
  {
    topicTitle: 'Ohm’s Law & Electric Circuits',
    term: 'V = I · R (Voltage = Current × Resistance)',
    fact: 'Ohm’s Law relates electric potential difference (Voltage, V), electric current (I in amperes), and resistance (R in ohms) by V = I·R.',
    distractors: ['Hooke’s Spring Law', 'Snell’s Refraction Law', 'Charles’ Law'],
    falseStatement: 'When circuit resistance increases under a constant battery voltage, electric current increases proportionally.',
    passage: 'If resistance rises while voltage stays fixed, less current flows through the conductor because I = V / R.',
    keyword: 'voltage',
    hint1: 'Connect volts (V), amperes (I), and ohms (R).',
    hint2: 'Higher resistance opposes current flow when voltage stays constant.',
    hint3: 'Solve using current = voltage divided by resistance.',
    explanation: 'Ohm’s Law (V = IR) shows voltage equals the product of current and resistance.',
    commonMistakes: 'Confusing electrical power (P = IV) with Ohm’s Law (V = IR).',
  },
  {
    topicTitle: 'Acids, Bases, and the pH Scale',
    term: 'pH below 7 indicates an acid; above 7 indicates a base',
    fact: 'On the standard 0–14 aqueous pH scale, values below 7 are acidic, 7 is neutral pure water, and values above 7 are basic (alkaline).',
    distractors: ['pH 0 is strongly basic', 'pH 7 means strong acid', 'Acids always exceed pH 10'],
    falseStatement: 'A solution with pH 2 is strongly basic (alkaline), whereas a solution with pH 12 is strongly acidic.',
    passage: 'Each whole-unit step on the pH scale represents a tenfold change in hydrogen ion concentration: vinegar and lemon juice sit below 7, while baking soda and soap sit above 7.',
    keyword: 'neutral',
    hint1: 'Anchor your scale around pure water at 7.',
    hint2: 'Remember citrus acids sit at the low end of the numeric scale.',
    hint3: 'Lower numeric values mean higher acidity; higher values mean greater alkalinity.',
    explanation: 'Acids measure pH < 7, neutral solutions measure pH = 7, and bases measure pH > 7.',
    commonMistakes: 'Assuming a higher pH number means stronger acidity.',
  },
  {
    topicTitle: 'States of Matter & Phase Changes',
    term: 'Sublimation (Solid directly to Gas)',
    fact: 'Sublimation is the endothermic phase transition in which a substance changes directly from solid to gas without passing through a liquid phase.',
    distractors: ['Condensation (gas to liquid)', 'Freezing (liquid to solid)', 'Deposition (gas directly to solid)'],
    falseStatement: 'Dry ice melting into a liquid puddle at room pressure is the textbook definition of sublimation.',
    passage: 'Phase transitions depend on temperature and pressure. Dry ice (solid CO₂) at normal atmospheric pressure absorbs heat and turns directly into carbon dioxide gas—bypassing the liquid state.',
    keyword: 'sublimation',
    hint1: 'Look for a transition that skips the middle liquid state completely.',
    hint2: 'Think of dry ice releasing white vapor directly from solid blocks.',
    hint3: 'Distinguish solid-to-gas from gas-to-solid (deposition).',
    explanation: 'Sublimation turns a solid directly into gas (e.g., dry ice), skipping the liquid phase.',
    commonMistakes: 'Confusing evaporation (liquid to gas) or deposition (gas to solid) with sublimation (solid to gas).',
  },
];

interface DynamicMathProblem {
  topicTitle: string;
  prompt: string;
  expectedNumeric: string;
  distractors: [string, string, string];
  statementText: string;
  isStatementTrue: boolean;
  hint1: string;
  hint2: string;
  hint3: string;
  explanation: string;
  commonMistakes: string;
}

function buildDynamicMathProblem(
  index: number,
  seed: number,
  difficulty: ExamDifficulty
): DynamicMathProblem {
  const variant = (index + seed) % 5;

  if (difficulty === 'easy') {
    if (variant === 0) {
      // PEMDAS arithmetic
      const a = 3 + ((index + seed) % 6);
      const b = 2 + ((index * 2 + seed) % 5);
      const c = 4 + ((index + seed * 3) % 7);
      const ans = a + b * c;
      return {
        topicTitle: 'Order of Operations (PEMDAS)',
        prompt: `Evaluate the expression using proper order of operations: ${a} + ${b} × ${c}`,
        expectedNumeric: String(ans),
        distractors: [String((a + b) * c), String(a * b + c), String(ans + 2)],
        statementText: `Following PEMDAS, ${a} + ${b} × ${c} equals ${(index % 2 === 0) ? ans : (a + b) * c}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Identify which operation has higher priority: addition or multiplication.',
        hint2: 'Compute the multiplication pair first before combining with the remaining addend.',
        hint3: 'Keep the leftmost term untouched until after you multiply the middle and rightmost numbers.',
        explanation: `Multiply first: ${b} × ${c} = ${b * c}. Then add ${a}: ${a} + ${b * c} = ${ans}.`,
        commonMistakes: 'Adding left-to-right before multiplying.',
      };
    }
    if (variant === 1) {
      // Percentage of a whole
      const pct = [10, 20, 25, 30, 40][((index + seed) % 5)];
      const base = 40 + ((index + seed) % 5) * 20;
      const ans = (pct / 100) * base;
      return {
        topicTitle: 'Percentages & Proportions',
        prompt: `What is ${pct}% of ${base}?`,
        expectedNumeric: String(ans),
        distractors: [String(ans + 10), String(Math.round(base / pct)), String(ans * 2)],
        statementText: `${pct}% of ${base} is ${(index % 2 === 0) ? ans : ans + 15}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Convert the percent into a decimal or fraction over 100.',
        hint2: 'Multiply that decimal rate by the given whole quantity.',
        hint3: 'Remember that 10% moves the decimal point one place left.',
        explanation: `${pct}% of ${base} = (${pct} / 100) × ${base} = ${ans}.`,
        commonMistakes: 'Dividing by the percentage instead of multiplying by percent/100.',
      };
    }
    if (variant === 2) {
      // One-step / simple linear equation
      const m = 2 + ((index + seed) % 5);
      const x = 3 + ((index * 3 + seed) % 7);
      const rhs = m * x + 5;
      return {
        topicTitle: 'Solving Linear Equations',
        prompt: `Solve for x in the linear equation: ${m}x + 5 = ${rhs}`,
        expectedNumeric: String(x),
        distractors: [String(x + 2), String(m), String(rhs - 5)],
        statementText: `In the equation ${m}x + 5 = ${rhs}, the solution is x = ${(index % 2 === 0) ? x : x + 3}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Isolate the term containing x on the left side first.',
        hint2: 'Subtract the constant term from both sides of the equation.',
        hint3: 'Divide the remaining difference evenly by the coefficient in front of x.',
        explanation: `Subtract 5: ${m}x = ${rhs - 5}. Divide by ${m}: x = ${(rhs - 5) / m}.`,
        commonMistakes: 'Adding 5 instead of subtracting 5 when moving the constant across the equals sign.',
      };
    }
    if (variant === 3) {
      // Rectangle Area & Perimeter
      const length = 6 + ((index + seed) % 7);
      const width = 3 + ((index + seed * 2) % 4);
      const perimeter = 2 * (length + width);
      return {
        topicTitle: 'Geometry: Perimeter of Polygons',
        prompt: `A rectangular study desk is ${length} meters long and ${width} meters wide. What is its perimeter in meters?`,
        expectedNumeric: String(perimeter),
        distractors: [String(length * width), String(length + width), String(perimeter + 4)],
        statementText: `A rectangle of dimensions ${length} by ${width} has a perimeter of ${(index % 2 === 0) ? perimeter : length * width}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Distinguish between perimeter (outer boundary length) and area (interior surface).',
        hint2: 'Add all four sides: two lengths plus two widths.',
        hint3: 'Use Perimeter = 2 × (Length + Width).',
        explanation: `Perimeter = 2 × (${length} + ${width}) = 2 × ${length + width} = ${perimeter} meters.`,
        commonMistakes: 'Multiplying length × width (which computes area) instead of summing all four sides.',
      };
    }
    // Unit ratio
    const unitCost = 15 + ((index + seed) % 4) * 5;
    const qty = 3 + ((index + seed) % 5);
    const total = unitCost * qty;
    return {
      topicTitle: 'Ratios & Unit Rates',
      prompt: `If 2 notebooks cost ₱${unitCost * 2}, how much do ${qty} identical notebooks cost (in pesos)?`,
      expectedNumeric: String(total),
      distractors: [String(total + unitCost), String(unitCost * 2 * qty), String(total - unitCost)],
      statementText: `At ₱${unitCost * 2} for 2 notebooks, ${qty} notebooks cost ₱${(index % 2 === 0) ? total : total + unitCost}.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Find the cost of 1 single notebook first.',
      hint2: 'Divide the given pair price by 2 to obtain the unit rate.',
      hint3: 'Multiply the unit price by the requested quantity.',
      explanation: `Unit price = ₱${unitCost * 2} ÷ 2 = ₱${unitCost}. Total for ${qty} = ₱${unitCost} × ${qty} = ₱${total}.`,
      commonMistakes: 'Multiplying the 2-notebook price directly by the new quantity without finding the unit cost.',
    };
  }

  if (difficulty === 'medium') {
    if (variant === 0) {
      // Slope between two points
      const x1 = 1 + ((index + seed) % 4);
      const y1 = 2 + ((index + seed) % 5);
      const dx = 2 + ((index + seed) % 3);
      const slope = 2 + ((index * 2 + seed) % 4);
      const x2 = x1 + dx;
      const y2 = y1 + slope * dx;
      return {
        topicTitle: 'Coordinate Geometry: Slope of a Line',
        prompt: `Find the slope (m) of the line passing through the points (${x1}, ${y1}) and (${x2}, ${y2}).`,
        expectedNumeric: String(slope),
        distractors: [String(slope + 1), String(dx), String(y2 - y1)],
        statementText: `The line passing through (${x1}, ${y1}) and (${x2}, ${y2}) has slope ${(index % 2 === 0) ? slope : slope + 2}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Recall slope measures vertical rise divided by horizontal run.',
        hint2: 'Apply the slope formula m = (y₂ - y₁) ÷ (x₂ - x₁).',
        hint3: 'Subtract the y-coordinates first, subtract the x-coordinates in the same order, then divide.',
        explanation: `m = (${y2} - ${y1}) / (${x2} - ${x1}) = ${y2 - y1} / ${dx} = ${slope}.`,
        commonMistakes: 'Inverting the formula into run ÷ rise: (x₂ - x₁) ÷ (y₂ - y₁).',
      };
    }
    if (variant === 1) {
      // Pythagorean triple
      const triples: [number, number, number][] = [
        [3, 4, 5],
        [5, 12, 13],
        [6, 8, 10],
        [8, 15, 17],
        [9, 12, 15],
      ];
      const [a, b, c] = triples[(index + seed) % triples.length];
      return {
        topicTitle: 'Pythagorean Theorem',
        prompt: `A right triangle has legs of length ${a} cm and ${b} cm. Calculate the length of its hypotenuse (in cm).`,
        expectedNumeric: String(c),
        distractors: [String(a + b), String(c + 2), String(Math.abs(b - a))],
        statementText: `A right triangle with legs ${a} and ${b} has hypotenuse ${(index % 2 === 0) ? c : a + b}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Use the relationship between the legs and the longest side of a right triangle.',
        hint2: 'Square both leg lengths and add them together (a² + b² = c²).',
        hint3: 'Take the positive square root of the sum to obtain the hypotenuse.',
        explanation: `c = √(${a}² + ${b}²) = √(${a * a} + ${b * b}) = √${c * c} = ${c} cm.`,
        commonMistakes: 'Adding a + b directly without squaring or forgetting to take the final square root.',
      };
    }
    if (variant === 2) {
      // Simple Interest I = Prt
      const P = 1000 * (2 + ((index + seed) % 5));
      const ratePct = 4 + ((index + seed) % 4);
      const t = 2 + ((index * 2 + seed) % 3);
      const interest = (P * ratePct * t) / 100;
      return {
        topicTitle: 'Consumer Math: Simple Interest',
        prompt: `Calculate the simple interest earned on ₱${P} invested at ${ratePct}% annual interest for ${t} years.`,
        expectedNumeric: String(interest),
        distractors: [String(interest + 100), String(Math.round(interest / t)), String(P + interest)],
        statementText: `₱${P} at ${ratePct}% simple interest for ${t} years earns ₱${(index % 2 === 0) ? interest : interest / 2}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Recall the simple interest formula linking principal, annual rate, and time.',
        hint2: 'Express the interest rate percentage as a decimal before multiplying in I = P · r · t.',
        hint3: 'Multiply principal × decimal rate × number of years.',
        explanation: `I = P × r × t = ${P} × ${ratePct / 100} × ${t} = ₱${interest}.`,
        commonMistakes: 'Forgetting to convert the percentage to a decimal or leaving out the time factor t.',
      };
    }
    if (variant === 3) {
      // Linear equation with x on both sides
      const x = 3 + ((index + seed) % 6);
      const a = 5;
      const b = 2;
      const diff = (a - b) * x;
      const c = 4;
      const d = diff + c;
      return {
        topicTitle: 'Multi-Step Linear Equations',
        prompt: `Solve for x: ${a}x + ${c} = ${b}x + ${d}`,
        expectedNumeric: String(x),
        distractors: [String(x + 2), String(Math.max(1, x - 1)), String(d - c)],
        statementText: `The value x = ${(index % 2 === 0) ? x : x + 4} satisfies ${a}x + ${c} = ${b}x + ${d}.`,
        isStatementTrue: index % 2 === 0,
        hint1: 'Gather all variable terms (x) on one side and constant numbers on the other.',
        hint2: 'Subtract the smaller x term from both sides first.',
        hint3: 'Isolate x by subtracting the constant, then dividing by the remaining coefficient.',
        explanation: `Subtract ${b}x: ${a - b}x + ${c} = ${d}. Subtract ${c}: ${a - b}x = ${d - c}. Divide by ${a - b}: x = ${x}.`,
        commonMistakes: 'Adding coefficients from opposite sides of the equals sign without reversing signs.',
      };
    }
    // Arithmetic sequence nth term
    const a1 = 4 + ((index + seed) % 5);
    const d = 3 + ((index + seed * 2) % 4);
    const n = 8 + ((index + seed) % 5);
    const an = a1 + (n - 1) * d;
    return {
      topicTitle: 'Arithmetic Sequences',
      prompt: `Find the ${n}th term of the arithmetic sequence starting with ${a1}, ${a1 + d}, ${a1 + 2 * d}, ...`,
      expectedNumeric: String(an),
      distractors: [String(a1 + n * d), String(an - d), String(an + d)],
      statementText: `In the arithmetic sequence ${a1}, ${a1 + d}, ${a1 + 2 * d}, ..., the ${n}th term is ${(index % 2 === 0) ? an : a1 + n * d}.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Determine the constant common difference d added between consecutive terms.',
      hint2: 'Use aₙ = a₁ + (n − 1)d.',
      hint3: 'Notice you multiply the common difference by (n − 1), not n.',
      explanation: `Common difference d = ${d}. a_${n} = ${a1} + (${n} − 1)(${d}) = ${a1} + ${(n - 1) * d} = ${an}.`,
      commonMistakes: 'Multiplying d by n instead of (n − 1).',
    };
  }

  // Hard difficulty
  if (variant === 0) {
    // Evaluate quadratic function f(x) = ax^2 - bx + c
    const a = 2 + ((index + seed) % 3);
    const b = 3 + ((index + seed) % 4);
    const c = 5 + ((index + seed) % 5);
    const x = 3 + ((index * 2 + seed) % 3);
    const ans = a * x * x - b * x + c;
    return {
      topicTitle: 'Quadratic Function Evaluation',
      prompt: `Given the function f(x) = ${a}x² − ${b}x + ${c}, calculate f(${x}).`,
      expectedNumeric: String(ans),
      distractors: [String((a * x) * (a * x) - b * x + c), String(ans + 2 * b), String(a * x * x + b * x + c)],
      statementText: `For f(x) = ${a}x² − ${b}x + ${c}, evaluating f(${x}) yields ${(index % 2 === 0) ? ans : ans + 6}.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Substitute the input value carefully everywhere x appears.',
      hint2: 'Evaluate the exponent x² BEFORE multiplying by the leading coefficient a.',
      hint3: 'Remember to subtract the middle bx term before adding the constant.',
      explanation: `f(${x}) = ${a}(${x})² − ${b}(${x}) + ${c} = ${a}(${x * x}) − ${b * x} + ${c} = ${a * x * x} − ${b * x} + ${c} = ${ans}.`,
      commonMistakes: 'Computing (ax)² instead of a(x²), or adding bx instead of subtracting it.',
    };
  }
  if (variant === 1) {
    // Discriminant b^2 - 4ac
    const a = 1 + ((index + seed) % 3);
    const b = 5 + ((index + seed) % 5);
    const c = 2 + ((index + seed) % 3);
    const disc = b * b - 4 * a * c;
    return {
      topicTitle: 'Quadratic Discriminant (b² − 4ac)',
      prompt: `Compute the discriminant of the quadratic equation ${a}x² + ${b}x + ${c} = 0.`,
      expectedNumeric: String(disc),
      distractors: [String(b * b + 4 * a * c), String(b - 4 * a * c), String(disc + 4)],
      statementText: `The discriminant of ${a}x² + ${b}x + ${c} = 0 is ${(index % 2 === 0) ? disc : b * b + 4 * a * c}.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Identify coefficients a, b, and c from ax² + bx + c = 0.',
      hint2: 'Apply Δ = b² − 4ac.',
      hint3: 'Square b first, then subtract the product 4·a·c.',
      explanation: `Δ = (${b})² − 4(${a})(${c}) = ${b * b} − ${4 * a * c} = ${disc}.`,
      commonMistakes: 'Adding 4ac instead of subtracting 4ac when all coefficients are positive.',
    };
  }
  if (variant === 2) {
    // Probability with combinations / marbles
    const red = 4 + ((index + seed) % 4);
    const blue = 6 + ((index + seed * 2) % 4);
    const green = 10 - ((index + seed) % 3);
    const total = red + blue + green;
    const pct = Math.round((red / total) * 100);
    return {
      topicTitle: 'Probability Calculations',
      prompt: `A bag contains ${red} red, ${blue} blue, and ${green} green marbles (${total} total). To the nearest whole percent, what is the probability of drawing a red marble?`,
      expectedNumeric: String(pct),
      distractors: [String(Math.round((blue / total) * 100)), String(Math.round((red / (blue + green)) * 100)), String(pct + 8)],
      statementText: `With ${red} red marbles out of ${total} total marbles, the rounded probability is ${(index % 2 === 0) ? pct : pct + 11}%.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Divide the favorable outcomes by the total sample space.',
      hint2: 'Include ALL marbles (red + blue + green) in the denominator.',
      hint3: 'Multiply the fraction (red ÷ total) by 100 and round to the nearest integer.',
      explanation: `P(red) = ${red} / ${total} ≈ ${((red / total) * 100).toFixed(1)}% ≈ ${pct}%.`,
      commonMistakes: 'Using only non-red marbles in the denominator instead of the full total.',
    };
  }
  if (variant === 3) {
    // Exponent law / compound evaluation
    const base = 2 + ((index + seed) % 2);
    const p1 = 3 + ((index + seed) % 2);
    const p2 = 2;
    const ans = Math.pow(base, p1 + p2 - 1);
    return {
      topicTitle: 'Laws of Exponents',
      prompt: `Simplify and evaluate the exact numeric value: (${base}^${p1} × ${base}^${p2}) ÷ ${base}`,
      expectedNumeric: String(ans),
      distractors: [String(Math.pow(base, p1 * p2)), String(ans * base), String(Math.pow(base, p1 + p2))],
      statementText: `Using exponent rules, (${base}^${p1} × ${base}^${p2}) ÷ ${base} simplifies to ${(index % 2 === 0) ? ans : Math.pow(base, p1 * p2)}.`,
      isStatementTrue: index % 2 === 0,
      hint1: 'Use the product rule and quotient rule for powers with the same base.',
      hint2: 'Add exponents when multiplying like bases; subtract 1 when dividing by the base once.',
      hint3: 'Find the resulting net exponent first before raising the base to that power.',
      explanation: `Net exponent = ${p1} + ${p2} − 1 = ${p1 + p2 - 1}. Thus ${base}^${p1 + p2 - 1} = ${ans}.`,
      commonMistakes: 'Multiplying exponents instead of adding them when multiplying like bases.',
    };
  }
  // Successive percentage discount
  const orig = 1000;
  const d1 = 20;
  const d2 = 10;
  const finalPrice = orig * (1 - d1 / 100) * (1 - d2 / 100);
  return {
    topicTitle: 'Successive Percentage Change',
    prompt: `A ₱${orig} jacket receives a ${d1}% discount, followed by an additional ${d2}% off the discounted price. What is the final price in pesos?`,
    expectedNumeric: String(finalPrice),
    distractors: ['700', '750', '680'],
    statementText: `Applying 20% off then 10% off ₱1000 yields ₱${(index % 2 === 0) ? finalPrice : 700}.`,
    isStatementTrue: index % 2 === 0,
    hint1: 'Successive discounts apply one after the other—do NOT simply add the two discount rates.',
    hint2: 'Compute the price after the first discount first.',
    hint3: 'Take 10% off the reduced price, not off the original ₱1,000.',
    explanation: `After ${d1}% off: ₱1000 × 0.80 = ₱800. After extra ${d2}% off: ₱800 × 0.90 = ₱${finalPrice}.`,
    commonMistakes: 'Adding 20% + 10% = 30% directly to get ₱700 instead of compounding sequentially.',
  };
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function deterministicRotate<T>(items: T[], shift: number): T[] {
  const len = items.length;
  if (len <= 1) return [...items];
  const s = ((shift % len) + len) % len;
  return [...items.slice(s), ...items.slice(0, s)];
}

function buildSpellingQuestion(
  index: number,
  seed: number,
  type: QuestionType,
  entry: SpellingEntry,
  pool: SpellingEntry[],
  gradeLevel: GradeLevel
): MockQuestion {
  const sourceReference = `General English · Spelling Practice (${gradeLevel})`;
  const topicTitle = 'English Spelling & Vocabulary';
  const blankedSentence = entry.sentence.replace('___', '________');
  const maskedWord = `${entry.word[0]}___${entry.word[entry.word.length - 1]} (${entry.word.length} letters)`;

  if (type === 'multiple-choice') {
    const rawChoices = [entry.word, ...entry.misspellings];
    const correctIndex = (index + seed) % rawChoices.length;
    const rotated = [...rawChoices];
    [rotated[0], rotated[correctIndex]] = [rotated[correctIndex], rotated[0]];

    return {
      id: uid(`q${index + 1}`),
      type: 'multiple-choice',
      prompt: `Choose the CORRECTLY spelled English word meaning "${entry.meaning}":\n"${blankedSentence}"`,
      choices: rotated,
      correctIndex,
      expectedAnswer: entry.word,
      points: 1,
      hints: {
        level1: `Look closely at vowels and doubled consonants inside each option for a word meaning "${entry.meaning}".`,
        level2: entry.ruleTip,
        level3: `Check the letter pattern: it has ${entry.word.length} total letters and begins with "${entry.word[0]}".`,
      },
      explanation: `"${entry.word}" is the correct spelling (${entry.ruleTip}) Sentence: "${entry.sentence.replace('___', entry.word)}"`,
      commonMistakes: `Misspelling the middle syllables or missing doubled letters (such as "${entry.misspellings[0]}").`,
      sourceReference,
      topicTitle,
    };
  }

  if (type === 'true-false') {
    const showCorrect = index % 2 === 0;
    const shownWord = showCorrect ? entry.word : entry.misspellings[0];
    return {
      id: uid(`q${index + 1}`),
      type: 'true-false',
      prompt: `True or False: The bold/quoted word "${shownWord}" is spelled correctly in this sentence:\n"${entry.sentence.replace('___', shownWord)}"`,
      choices: ['True', 'False'],
      correctIndex: showCorrect ? 0 : 1,
      expectedAnswer: showCorrect ? 'True' : 'False',
      points: 1,
      hints: {
        level1: `Sound out each syllable of the word meaning "${entry.meaning}".`,
        level2: entry.ruleTip,
        level3: 'Inspect the vowels and whether consonants should be single or doubled.',
      },
      explanation: showCorrect
        ? `"${entry.word}" is indeed spelled accurately. (${entry.ruleTip})`
        : `"${shownWord}" is misspelled. The correct spelling is "${entry.word}". (${entry.ruleTip})`,
      commonMistakes: `Overlooking common sound-alike errors such as "${entry.misspellings[0]}".`,
      sourceReference,
      topicTitle,
    };
  }

  if (type === 'matching') {
    const picked = [entry, ...pool.filter((p) => p.word !== entry.word)].slice(0, 3);
    const pairs = picked.map((item, pIdx) => ({
      id: `pair-${index}-${pIdx}`,
      prompt: item.meaning,
      match: item.word,
    }));
    return {
      id: uid(`q${index + 1}`),
      type: 'matching',
      prompt: 'Match each definition in Column A with the correctly spelled English vocabulary word in Column B.',
      matchingPairs: pairs,
      expectedAnswer: pairs.map((p) => `${p.prompt} -> ${p.match}`).join('; '),
      points: pairs.length,
      hints: {
        level1: 'Match the definition you recognize most quickly first.',
        level2: 'Use prefixes and root words to narrow down the remaining pairs.',
        level3: 'Verify word parts (nouns vs. verbs vs. adjectives) before finalizing.',
      },
      explanation: pairs.map((p) => `• ${p.match}: ${p.prompt}`).join('\n'),
      commonMistakes: 'Confusing words that share similar prefixes.',
      sourceReference,
      topicTitle,
    };
  }

  if (type === 'identification' || type === 'fill-in-the-blank') {
    return {
      id: uid(`q${index + 1}`),
      type,
      prompt:
        type === 'identification'
          ? `Spelling Quiz — Type the EXACT correct spelling of the word meaning "${entry.meaning}":\nContext: "${blankedSentence}"`
          : `Fill in the blank with the CORRECTLY spelled word meaning "${entry.meaning}":\n"${blankedSentence}"`,
      expectedAnswer: entry.word,
      acceptableKeywords: [entry.word],
      points: 1,
      hints: {
        level1: `The word means "${entry.meaning}" and fits cleanly into the sentence context.`,
        level2: entry.ruleTip,
        level3: `Letter guide: starts and ends as ${maskedWord}.`,
      },
      explanation: `Correct spelling: "${entry.word}". ${entry.ruleTip}`,
      commonMistakes: `Watch out for common misspellings like "${entry.misspellings[0]}" or "${entry.misspellings[1]}".`,
      sourceReference,
      topicTitle,
    };
  }

  if (type === 'reading-comprehension' || type === 'situational-analysis' || type === 'short-answer' || type === 'essay') {
    const shownWrong = entry.misspellings[0];
    return {
      id: uid(`q${index + 1}`),
      type,
      passage:
        type === 'reading-comprehension' || type === 'situational-analysis'
          ? `Draft sentence to proofread: "${entry.sentence.replace('___', shownWrong)}"`
          : undefined,
      prompt:
        type === 'essay'
          ? `Proofreading & Vocabulary Practice: Correct the misspelled word "${shownWrong}" (meaning: ${entry.meaning}), explain its spelling pattern, and write two original sentences using it properly.`
          : `Identify and correct the misspelled word in "${entry.sentence.replace('___', shownWrong)}" (meaning: ${entry.meaning}), then explain how to remember its spelling.`,
      expectedAnswer: entry.word,
      acceptableKeywords: [entry.word],
      points: type === 'essay' ? 3 : 2,
      hints: {
        level1: `Find the word meaning "${entry.meaning}" inside the draft sentence.`,
        level2: entry.ruleTip,
        level3: `Target pattern: ${maskedWord}.`,
      },
      explanation: `Replace "${shownWrong}" with "${entry.word}". Tip: ${entry.ruleTip}`,
      commonMistakes: `Leaving "${shownWrong}" unchanged during quick proofreading.`,
      sourceReference,
      topicTitle,
    };
  }

  // problem-solving fallback -> choose spelling via clue
  return {
    id: uid(`q${index + 1}`),
    type: 'identification',
    prompt: `Spelling Challenge — Type the exact word meaning "${entry.meaning}":\n"${blankedSentence}"`,
    expectedAnswer: entry.word,
    acceptableKeywords: [entry.word],
    points: 1,
    hints: {
      level1: `Word meaning: "${entry.meaning}".`,
      level2: entry.ruleTip,
      level3: `Clue pattern: ${maskedWord}.`,
    },
    explanation: `Correct spelling: "${entry.word}". ${entry.ruleTip}`,
    commonMistakes: `Common slip: "${entry.misspellings[0]}".`,
    sourceReference,
    topicTitle,
  };
}

function buildConceptualQuestion(
  index: number,
  seed: number,
  type: QuestionType,
  entry: ConceptualEntry,
  pool: ConceptualEntry[],
  presetLabel: string,
  gradeLevel: GradeLevel
): MockQuestion {
  const sourceReference = `${presetLabel} (${gradeLevel})`;

  if (type === 'multiple-choice') {
    const rawChoices = [entry.term, ...entry.distractors];
    const correctIndex = (index + seed) % rawChoices.length;
    const rotated = [...rawChoices];
    [rotated[0], rotated[correctIndex]] = [rotated[correctIndex], rotated[0]];

    return {
      id: uid(`q${index + 1}`),
      type: 'multiple-choice',
      prompt: `In ${entry.topicTitle}, which concept or rule correctly matches this statement?\n"${entry.fact}"`,
      choices: rotated,
      correctIndex,
      expectedAnswer: entry.term,
      points: 1,
      hints: {
        level1: entry.hint1,
        level2: entry.hint2,
        level3: entry.hint3,
      },
      explanation: entry.explanation,
      commonMistakes: entry.commonMistakes,
      sourceReference,
      topicTitle: entry.topicTitle,
    };
  }

  if (type === 'true-false') {
    const makeTrue = index % 2 === 0;
    return {
      id: uid(`q${index + 1}`),
      type: 'true-false',
      prompt: `True or False (${entry.topicTitle}): ${makeTrue ? entry.fact : entry.falseStatement}`,
      choices: ['True', 'False'],
      correctIndex: makeTrue ? 0 : 1,
      expectedAnswer: makeTrue ? 'True' : 'False',
      points: 1,
      hints: {
        level1: entry.hint1,
        level2: entry.hint2,
        level3: entry.hint3,
      },
      explanation: entry.explanation,
      commonMistakes: entry.commonMistakes,
      sourceReference,
      topicTitle: entry.topicTitle,
    };
  }

  if (type === 'matching') {
    const picked = [entry, ...pool.filter((p) => p.term !== entry.term)].slice(0, 3);
    const pairs = picked.map((item, pIdx) => ({
      id: `pair-${index}-${pIdx}`,
      prompt: item.fact.slice(0, 120),
      match: item.term,
    }));
    return {
      id: uid(`q${index + 1}`),
      type: 'matching',
      prompt: `Match each rule or description in Column A with the corresponding concept in Column B.`,
      matchingPairs: pairs,
      expectedAnswer: pairs.map((p) => `${p.prompt} -> ${p.match}`).join('; '),
      points: pairs.length,
      hints: {
        level1: 'Match the rule you recognize most confidently first.',
        level2: 'Group items by topic area before pairing the rest.',
        level3: 'Double-check verb or structural cues in each Column A definition.',
      },
      explanation: pairs.map((p) => `• ${p.match}: ${p.prompt}`).join('\n'),
      commonMistakes: 'Swapping two closely related concepts.',
      sourceReference,
      topicTitle: entry.topicTitle,
    };
  }

  if (type === 'identification' || type === 'fill-in-the-blank') {
    return {
      id: uid(`q${index + 1}`),
      type,
      prompt:
        type === 'identification'
          ? `Identify the concept in ${entry.topicTitle} described below:\n"${entry.fact}"`
          : `Complete the rule from ${entry.topicTitle}:\n"${entry.fact.replace(new RegExp(`\\b${entry.keyword}\\b`, 'i'), '________')}"`,
      expectedAnswer: type === 'fill-in-the-blank' ? entry.keyword : entry.term,
      acceptableKeywords: [entry.keyword, entry.term],
      points: 1,
      hints: {
        level1: entry.hint1,
        level2: entry.hint2,
        level3: entry.hint3,
      },
      explanation: entry.explanation,
      commonMistakes: entry.commonMistakes,
      sourceReference,
      topicTitle: entry.topicTitle,
    };
  }

  if (type === 'reading-comprehension' || type === 'situational-analysis') {
    return {
      id: uid(`q${index + 1}`),
      type,
      passage: entry.passage,
      prompt: `Based on the ${entry.topicTitle} note above, state the guiding principle and explain how to apply it accurately.`,
      expectedAnswer: `${entry.term}: ${entry.fact}`,
      acceptableKeywords: [entry.keyword, ...entry.term.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)].slice(0, 3),
      points: 2,
      hints: {
        level1: entry.hint1,
        level2: entry.hint2,
        level3: entry.hint3,
      },
      explanation: entry.explanation,
      commonMistakes: entry.commonMistakes,
      sourceReference,
      topicTitle: entry.topicTitle,
    };
  }

  return {
    id: uid(`q${index + 1}`),
    type: type === 'essay' ? 'essay' : 'short-answer',
    prompt: `${type === 'essay' ? 'Essay' : 'Short Answer'} (${entry.topicTitle}): Explain the core rule ("${entry.term}") and give one clear example illustrating it.`,
    expectedAnswer: entry.fact,
    acceptableKeywords: [entry.keyword],
    points: type === 'essay' ? 4 : 2,
    hints: {
      level1: entry.hint1,
      level2: entry.hint2,
      level3: entry.hint3,
    },
    explanation: entry.explanation,
    commonMistakes: entry.commonMistakes,
    sourceReference,
    topicTitle: entry.topicTitle,
  };
}

function buildMathQuestion(
  index: number,
  seed: number,
  type: QuestionType,
  difficulty: ExamDifficulty,
  gradeLevel: GradeLevel
): MockQuestion {
  const math = buildDynamicMathProblem(index, seed, difficulty);
  const sourceReference = `General Mathematics Practice (${gradeLevel} · ${difficulty.toUpperCase()})`;

  if (type === 'multiple-choice') {
    const rawChoices = [math.expectedNumeric, ...math.distractors];
    const uniqueChoices = Array.from(new Set(rawChoices));
    while (uniqueChoices.length < 4) {
      uniqueChoices.push(String(Number(math.expectedNumeric) + uniqueChoices.length + 3));
    }
    const four = uniqueChoices.slice(0, 4);
    const correctIndex = (index + seed) % 4;
    const rotated = [...four];
    [rotated[0], rotated[correctIndex]] = [rotated[correctIndex], rotated[0]];

    return {
      id: uid(`q${index + 1}`),
      type: 'multiple-choice',
      prompt: math.prompt,
      choices: rotated,
      correctIndex,
      expectedAnswer: math.expectedNumeric,
      points: 1,
      hints: {
        level1: math.hint1,
        level2: math.hint2,
        level3: math.hint3,
      },
      explanation: math.explanation,
      commonMistakes: math.commonMistakes,
      sourceReference,
      topicTitle: math.topicTitle,
    };
  }

  if (type === 'true-false') {
    return {
      id: uid(`q${index + 1}`),
      type: 'true-false',
      prompt: `True or False (${math.topicTitle}): ${math.statementText}`,
      choices: ['True', 'False'],
      correctIndex: math.isStatementTrue ? 0 : 1,
      expectedAnswer: math.isStatementTrue ? 'True' : 'False',
      points: 1,
      hints: {
        level1: math.hint1,
        level2: math.hint2,
        level3: math.hint3,
      },
      explanation: math.explanation,
      commonMistakes: math.commonMistakes,
      sourceReference,
      topicTitle: math.topicTitle,
    };
  }

  if (type === 'matching') {
    const p1 = buildDynamicMathProblem(index, seed, difficulty);
    const p2 = buildDynamicMathProblem(index + 1, seed + 1, difficulty);
    const p3 = buildDynamicMathProblem(index + 2, seed + 2, difficulty);
    const pairs = [p1, p2, p3].map((item, idx) => ({
      id: `pair-${index}-${idx}`,
      prompt: item.prompt.slice(0, 110),
      match: item.expectedNumeric,
    }));
    // Ensure distinct matches for clean dropdown selection
    const distinctMatches = new Set(pairs.map((p) => p.match));
    if (distinctMatches.size < 3) {
      return {
        id: uid(`q${index + 1}`),
        type: 'problem-solving',
        prompt: math.prompt,
        expectedAnswer: math.expectedNumeric,
        acceptableKeywords: [math.expectedNumeric],
        points: 2,
        hints: { level1: math.hint1, level2: math.hint2, level3: math.hint3 },
        explanation: math.explanation,
        commonMistakes: math.commonMistakes,
        sourceReference,
        topicTitle: math.topicTitle,
      };
    }

    return {
      id: uid(`q${index + 1}`),
      type: 'matching',
      prompt: 'Match each math problem in Column A with its correct numeric result in Column B.',
      matchingPairs: pairs,
      expectedAnswer: pairs.map((p) => `${p.prompt} -> ${p.match}`).join('; '),
      points: pairs.length,
      hints: {
        level1: 'Solve the simplest expression first to narrow down the choices.',
        level2: 'Check signs and order of operations carefully for each problem.',
        level3: 'Verify each pair by substituting or estimating magnitude.',
      },
      explanation: [p1, p2, p3].map((p) => `• ${p.expectedNumeric}: ${p.explanation}`).join('\n'),
      commonMistakes: math.commonMistakes,
      sourceReference,
      topicTitle: math.topicTitle,
    };
  }

  return {
    id: uid(`q${index + 1}`),
    type: type === 'identification' || type === 'fill-in-the-blank' ? type : 'problem-solving',
    prompt: math.prompt,
    expectedAnswer: math.expectedNumeric,
    acceptableKeywords: [math.expectedNumeric],
    points: type === 'problem-solving' ? 2 : 1,
    hints: {
      level1: math.hint1,
      level2: math.hint2,
      level3: math.hint3,
    },
    explanation: math.explanation,
    commonMistakes: math.commonMistakes,
    sourceReference,
    topicTitle: math.topicTitle,
  };
}

export function inferPresetForSubject(subjectName: string): GeneralPracticePreset {
  const lower = subjectName.toLowerCase();
  if (/math|calc|stat|alg|geom|trig/.test(lower)) return 'math-general';
  if (/sci|bio|chem|phys|earth/.test(lower)) return 'science-general';
  return 'english-spelling';
}

export function generateGeneralPracticeExam(config: GeneralPracticeConfig): MockExam {
  const presetMeta =
    GENERAL_PRACTICE_PRESETS.find((p) => p.id === config.preset) ?? GENERAL_PRACTICE_PRESETS[0];
  const seed = Math.floor(Math.random() * 1000);
  const types =
    config.questionTypes.length > 0 ? config.questionTypes : presetMeta.recommendedTypes;

  const rawQuestions: MockQuestion[] = [];

  if (config.preset === 'english-spelling') {
    const levelFiltered = SPELLING_BANK.filter((item) => item.level === config.difficulty);
    const remaining = SPELLING_BANK.filter((item) => item.level !== config.difficulty);
    const orderedPool = [
      ...deterministicRotate(levelFiltered, seed),
      ...deterministicRotate(remaining, seed),
    ];

    for (let i = 0; i < config.questionCount; i += 1) {
      const entry = orderedPool[i % orderedPool.length];
      const qType = types[i % types.length];
      rawQuestions.push(
        buildSpellingQuestion(i, seed, qType, entry, orderedPool, config.gradeLevel)
      );
    }
  } else if (config.preset === 'math-general') {
    for (let i = 0; i < config.questionCount; i += 1) {
      const qType = types[i % types.length];
      rawQuestions.push(buildMathQuestion(i, seed, qType, config.difficulty, config.gradeLevel));
    }
  } else {
    const bank = config.preset === 'english-grammar' ? GRAMMAR_BANK : SCIENCE_BANK;
    const rotatedBank = deterministicRotate(bank, seed);
    for (let i = 0; i < config.questionCount; i += 1) {
      const entry = rotatedBank[i % rotatedBank.length];
      const qType = types[i % types.length];
      rawQuestions.push(
        buildConceptualQuestion(
          i,
          seed,
          qType,
          entry,
          rotatedBank,
          presetMeta.label,
          config.gradeLevel
        )
      );
    }
  }

  const validation = validateExamQuestions(rawQuestions);

  return {
    id: `exam-gen-${crypto.randomUUID().slice(0, 8)}`,
    subjectId: config.subject.id,
    title: `${presetMeta.label} — ${config.gradeLevel} Quiz`,
    gradeLevel: config.gradeLevel,
    quarter: config.quarter,
    difficulty: config.difficulty,
    timeLimitMinutes: config.durationMinutes,
    description: `Offline General Practice Quiz (${presetMeta.label} · ${config.difficulty}) generated without requiring uploaded documents.`,
    topicIds: [],
    sourceMode: 'local-generated',
    isDemo: false,
    questions: validation.validQuestions,
    validationWarnings: validation.warnings,
    createdAt: new Date().toISOString(),
  };
}
