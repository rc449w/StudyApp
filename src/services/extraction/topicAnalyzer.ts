import {
  ExtractedConceptItem,
  ExtractedPageSection,
  ExtractedTopicCandidate,
  Subject,
} from '../../types/domain';

const SUBJECT_KEYWORDS: { subject: string; keywords: string[] }[] = [
  {
    subject: 'Mathematics / Statistics & Algebra',
    keywords: [
      'linear equation',
      'system of linear equations',
      'graphical method',
      'bar graph',
      'pie chart',
      'frequency polygon',
      'histogram',
      'ogive',
      'class mark',
      'class interval',
      'class boundaries',
      'frequency distribution',
      'central angle',
      'relative frequency',
      'cumulative frequency',
      'slope-intercept',
      'y-intercept',
      'ordered pair',
      'cartesian plane',
      'consistent',
      'inconsistent',
      'dependent system',
      'quadratic',
      'polynomial',
      'inequality',
      'mathematics',
      'statistics',
      'algebra',
    ],
  },
  {
    subject: 'General Mathematics',
    keywords: [
      'piecewise',
      'rational function',
      'asymptote',
      'inverse function',
      'exponential',
      'logarithm',
      'simple interest',
      'compound interest',
      'annuity',
      'general mathematics',
      'genmath',
    ],
  },
  {
    subject: 'Earth and Life Science',
    keywords: [
      'plate tectonics',
      'phivolcs',
      'fault',
      'subduction',
      'igneous',
      'sedimentary',
      'metamorphic',
      'mineral',
      'bioenergetics',
      'photosynthesis',
      'earth and life',
    ],
  },
  {
    subject: 'Physical Science / Physics',
    keywords: [
      'newton',
      'velocity',
      'acceleration',
      'momentum',
      'thermodynamics',
      'electromagnetic',
      'stoichiometry',
      'molarity',
      'chemical reaction',
    ],
  },
  {
    subject: 'Biology / Science',
    keywords: [
      'mitosis',
      'meiosis',
      'cell',
      'dna',
      'rna',
      'genetics',
      'ecosystem',
      'photosynthesis',
      'respiration',
    ],
  },
  {
    subject: 'Oral Communication / English',
    keywords: [
      'shannon-weaver',
      'schramm',
      'speech context',
      'speech act',
      'illocutionary',
      'communicative strategy',
      'oral communication',
      'grammar',
      'essay',
    ],
  },
  {
    subject: 'Komunikasyon / Filipino',
    keywords: [
      'wika',
      'dayalek',
      'sosyolek',
      'idyolek',
      'pananaliksik',
      'aralin',
      'kabanata',
      'talasalitaan',
      'pangungusap',
      'filipino',
    ],
  },
  {
    subject: 'Araling Panlipunan',
    keywords: [
      'kasaysayan',
      'ekonomiks',
      'demand',
      'supply',
      'implasyon',
      'gdp',
      'heograpiya',
      'kabihasnan',
      'konstitusyon',
      'araling panlipunan',
    ],
  },
];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeForRepeatCheck(line: string): string {
  return line
    .toLowerCase()
    .replace(/\bpage\s*\d+(\s*of\s*\d+)?\b/gi, '')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUrlOrReferenceLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/https?:\/\/\S+/i.test(trimmed)) return true;
  if (/\bwww\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return true;
  if (/\b[a-z0-9.-]+\.(edu|gov|org|com|net|ph|io)\/\S*/i.test(trimmed)) return true;
  if (/\bdoi:\s*10\.\d+/i.test(trimmed)) return true;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return true;
  if (
    /^(retrieved from|available at|downloaded from|source\s*:|sources\s*:|url\s*:|link\s*:|reference\s*:|accessed\s+on)/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/^\[\d+\]\s+[A-Z]/.test(trimmed) && /\(\d{4}\)/.test(trimmed)) {
    return true;
  }
  return false;
}

export function isGarbledOcrNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const symbolClutterCount = (trimmed.match(/[\[\]{}|£™¢©®~_@]/g) ?? []).length;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (symbolClutterCount >= 3 && tokens.length >= 4) return true;
  if (symbolClutterCount >= 1 && tokens.length >= 6) {
    const tinyTokens = tokens.filter((t) => t.replace(/[^A-Za-z0-9]/g, '').length <= 2).length;
    if (tinyTokens / tokens.length >= 0.48) return true;
  }
  return false;
}

export function isNoiseOrMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (isUrlOrReferenceLine(trimmed)) return true;
  if (isGarbledOcrNoiseLine(trimmed)) return true;
  if (/^(page|p\.)\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(trimmed)) return true;
  if (/^[-–—]?\s*\d{1,3}\s*[-–—]?$/.test(trimmed)) return true;
  if (/^\d{1,3}\s*\/\s*\d{1,3}$/.test(trimmed)) return true;
  if (/^(©|copyright|all rights reserved|republic act\s*8293|isbn\b|issn\b)/i.test(trimmed)) {
    return true;
  }
  if (
    /^(for inquiries or feedback|printed in the philippines|department of education\s*[–-]|deped\s*[–-]|development team of the module|author\s*:|editor\s*:|illustrator\s*:|layout artist\s*:|management team\s*:)/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/^(co_q\d+|adm\b|slm\b|melc\b)/i.test(trimmed) && trimmed.length < 48) {
    return true;
  }
  if (/^(example|examples|solution|solutions|answer|answers|note|notes|table|figure|objective|objectives)\s*:?$/i.test(trimmed)) {
    return true;
  }
  if (
    /^(\d+\s+things?\s+i\s+(learned|need|want|found)|at\s+the\s+end\s+of\s+the\s+(session|lesson)|what\s+i\s+(learned|need\s+to\s+clarify)|exit\s+ticket)/i.test(
      trimmed
    ) ||
    /\bthings?\s+i\s+learned\s+today\b/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function stripUrlsFromText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectRepeatedBoilerplateLines(pages: ExtractedPageSection[]): Set<string> {
  const repeated = new Set<string>();
  if (pages.length < 4) return repeated;

  const pageFrequency = new Map<string, number>();
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));

  for (const page of pages) {
    const uniqueOnPage = new Set<string>();
    for (const rawLine of page.text.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (trimmed.length < 4 || trimmed.length > 130) continue;
      const normalized = normalizeForRepeatCheck(trimmed);
      if (normalized.length >= 4) {
        uniqueOnPage.add(normalized);
      }
    }
    for (const norm of uniqueOnPage) {
      pageFrequency.set(norm, (pageFrequency.get(norm) ?? 0) + 1);
    }
  }

  for (const [norm, count] of pageFrequency.entries()) {
    if (count >= threshold) {
      repeated.add(norm);
    }
  }
  return repeated;
}

export function isLikelyFormula(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 135) return false;
  if (isUrlOrReferenceLine(trimmed)) return false;
  if (
    /^(example|halimbawa|sample problem|illustrative example|solution|step\s*\d+|check|key concept|important|remember|tandaan|note|summary|takeaway|source|http)/i.test(
      trimmed
    ) ||
    /\b(is defined as|refers to|means writing|means a system|is called|determines? whether|classify)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 16) return false;

  if (/^=\s*[A-Z]{2,}\(/i.test(trimmed)) return true; // Excel formula
  if (/[=≈≠≤≥∑∫√∆π±×÷→⇌°%]|!=/.test(trimmed)) {
    if (
      /[A-Za-z0-9)\]\s]+\s*(=|≈|≠|!=|≤|≥|→|⇌)\s*[A-Za-z0-9(\[{√∑∫-]/.test(trimmed)
    ) {
      // Allow labeled math/stat formulas like "Class Mark = (Lower Limit + Upper Limit) / 2"
      const lhs = trimmed.split(/=|≈|≠|!=|≤|≥/)[0] ?? '';
      if (lhs.trim().split(/\s+/).length <= 6) {
        return true;
      }
    }
    if (/[∑∫√∆±]/.test(trimmed)) return true;
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*\([a-zA-Z0-9,\s]+\)\s*=/.test(trimmed)) return true;
  if (/^\(?[xy]\s*,\s*[xy]\)?\s*=/.test(trimmed)) return true;
  return false;
}

export function isSubtopicHeading(line: string): boolean {
  const trimmed = line.replace(/^#+\s*/, '').trim();
  if (!trimmed || trimmed.length > 100 || isNoiseOrMetadataLine(trimmed)) return false;
  if (/^###{1,2}\s+/.test(line.trim())) return true;
  if (/^\d+\.\d+(\.\d+)?\.?\s+\S/.test(trimmed)) return true;
  if (/^[A-Z]\.\s+[A-Z]/.test(trimmed)) return true;
  if (/^\([a-z0-9]+\)\s+[A-Z]/i.test(trimmed)) return true;
  if (
    /^(case\s+\d+|method\s+\d+|type\s+\d+|types\s+of|kinds\s+of|properties\s+of|parts\s+of|steps\s+(to|in|for)|how\s+to|table\s+\d+|figure\s+\d+)\b/i.test(
      trimmed
    ) &&
    !/[.!?]$/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function isTableNumberedFragment(line: string): boolean {
  const trimmed = line.trim();
  // Matches fragments like "6 Class Marks", "12 Frequency", "45 Total" that lack punctuation and start with a plain number without a period
  if (/^\d{1,3}\s+[A-Za-z]+(\s+[A-Za-z]+){0,2}$/.test(trimmed) && !/^\d+\./.test(trimmed)) {
    return true;
  }
  return false;
}

export function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 105) return false;
  if (trimmed.includes('|')) return false;
  if (isNoiseOrMetadataLine(trimmed) || isLikelyFormula(trimmed) || isTableNumberedFragment(trimmed)) {
    return false;
  }
  if (!/[a-zA-Z]{3,}/.test(trimmed)) return false;

  if (
    /^(chapter|unit|module|quarter|lesson|aralin|kabanata|yunit|topic|section|part)\s+(\d+|[IVX]+)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/^#{1,4}\s+\S/.test(trimmed)) return true;
  if (isSubtopicHeading(trimmed)) return true;
  if (
    /^([IVX]+\.|[0-9]+(\.[0-9]+)*\.)\s+[A-Z][a-zA-Z]/.test(trimmed) &&
    !/[.!?]$/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 14
  ) {
    return true;
  }
  if (
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]{3,}/.test(trimmed) &&
    trimmed.split(/\s+/).length >= 1 &&
    trimmed.split(/\s+/).length <= 10 &&
    !/[.!?]$/.test(trimmed)
  ) {
    return true;
  }

  // Title Case educational section heading (e.g., "Graphical Method", "Class Marks and Histogram")
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (
    words.length >= 2 &&
    words.length <= 7 &&
    trimmed.length <= 72 &&
    !/[.!?,:;]$/.test(trimmed) &&
    !trimmed.includes(':') &&
    !/^(example|illustrative|halimbawa|sample|solution|step|definition|remember|note|important|key|given|find|answer|for)\b/i.test(
      trimmed
    ) &&
    !/\b(is|are|was|were|has|have|had|uses|use|shows|show|represents|represent|means|can|will|may|might|equals|compute|find|solve|add|subtract|multiply|divide|always|never)\b/i.test(
      trimmed
    )
  ) {
    const minorWords = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'for', 'to', 'with', 'by', 'from', 'a', 'an', 'vs']);
    let capCount = 0;
    let validTitleCase = true;
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i];
      const cleanWord = w.replace(/[^A-Za-z-]/g, '');
      if (!cleanWord) continue;
      if (i > 0 && minorWords.has(cleanWord.toLowerCase())) {
        continue;
      }
      if (/^[A-Z]/.test(cleanWord)) {
        capCount += 1;
      } else {
        validTitleCase = false;
        break;
      }
    }
    if (validTitleCase && capCount >= 2) {
      return true;
    }
  }

  return false;
}

export function assessHeadingUncertainty(
  title: string,
  linkedPages: ExtractedPageSection[]
): { uncertain: boolean; reason?: string } {
  const trimmed = title.trim();
  const hasLowConfidencePage = linkedPages.some((p) => p.lowConfidenceOcr);
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (isTableNumberedFragment(trimmed)) {
    return {
      uncertain: true,
      reason: 'Starts with an unpunctuated number (may be a table row/cell fragment rather than a section title).',
    };
  }

  // Flag titles with strange mixed casing mid-title or isolated single letters like "O Jorge target"
  const hasIsolatedSingleLetterStart = /^[A-Za-z]\s+[A-Z][a-z]+/.test(trimmed) && !/^A\s+/i.test(trimmed);
  const hasNonStandardLowercaseEnd =
    words.length >= 2 &&
    words.length <= 4 &&
    /^[A-Z]/.test(words[0]) &&
    /^[a-z]/.test(words[words.length - 1]) &&
    !/^(of|and|for|in|to|with|by|from|the|on|a|an)$/i.test(words[words.length - 1]) &&
    hasLowConfidencePage;

  const hasBadPunctuationOrFragment =
    /^[a-z$]/.test(trimmed) || /[.!?]$/.test(trimmed) || isGarbledOcrNoiseLine(trimmed);

  if (hasIsolatedSingleLetterStart || hasNonStandardLowercaseEnd || hasBadPunctuationOrFragment) {
    return {
      uncertain: true,
      reason: 'Possible OCR misread or fragmented heading. Verify original wording on source PDF page.',
    };
  }

  // Flag titles on low-confidence OCR pages only if they are NOT crisp standard Title/Upper headings
  const isCleanSingleWordTitle = /^[A-Z][a-z]{3,}$/.test(trimmed);
  if (
    hasLowConfidencePage &&
    words.length <= 5 &&
    trimmed !== trimmed.toUpperCase() &&
    !isCleanSingleWordTitle &&
    !isLikelyHeading(trimmed)
  ) {
    return {
      uncertain: true,
      reason: 'Extracted from a page with low local OCR confidence; verify heading accuracy.',
    };
  }

  return { uncertain: false };
}

export function reconstructPageLines(rawText: string): string[] {
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim());
  const merged: string[] = [];

  const isStructuralBreak = (line: string): boolean => {
    if (!line) return true;
    if (/^\|.*\|$/.test(line)) return true; // table row
    if (/^[-•*▪◦‣]\s+/.test(line)) return true; // bullet
    if (isLikelyHeading(line) || isLikelyFormula(line) || isNoiseOrMetadataLine(line)) return true;
    if (
      /^(example|illustrative example|halimbawa|sample problem|problem|illustration|solution|step\s*\d+|given|find|answer|check|definition|key concept|important|remember|tandaan|note|advantage|disadvantage)\b/i.test(
        line
      )
    ) {
      return true;
    }
    return false;
  };

  for (const line of rawLines) {
    if (!line) {
      if (merged.length > 0 && merged[merged.length - 1] !== '') {
        merged.push('');
      }
      continue;
    }

    const prev = merged.length > 0 ? merged[merged.length - 1] : '';
    if (
      prev &&
      prev !== '' &&
      !isStructuralBreak(prev) &&
      !isStructuralBreak(line) &&
      !/[.!?:;]$/.test(prev) &&
      prev.length < 360
    ) {
      // Join wrapped PDF sentence continuation cleanly
      merged[merged.length - 1] = prev.endsWith('-')
        ? `${prev.slice(0, -1)}${line}`
        : `${prev} ${line}`;
    } else {
      merged.push(line);
    }
  }

  return merged;
}

export function isCleanSummaryCandidate(
  line: string,
  boilerplateSet?: Set<string>
): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 24) return false;
  if (/^\|.*\|$/.test(trimmed)) return false;
  if (isNoiseOrMetadataLine(trimmed)) return false;
  if (boilerplateSet?.has(normalizeForRepeatCheck(trimmed))) return false;
  if (isLikelyHeading(trimmed)) return false;
  if (isLikelyFormula(trimmed) && trimmed.length < 65) return false;
  const wordCount = trimmed.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w)).length;
  return wordCount >= 4;
}

function detectSubject(text: string, fileName: string, existingSubjects: Subject[]): string {
  const combined = `${fileName} ${text.slice(0, 8000)}`.toLowerCase();

  for (const subj of existingSubjects) {
    const nameTokens = subj.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matchedTokens = nameTokens.filter((token) => combined.includes(token));
    if (matchedTokens.length >= Math.min(2, nameTokens.length) && matchedTokens.length > 0) {
      return subj.name;
    }
  }

  let bestSubject = 'General Study Material';
  let bestScore = 0;

  for (const entry of SUBJECT_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (combined.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSubject = entry.subject;
    }
  }

  return bestSubject;
}

function extractConceptsFromPage(
  page: ExtractedPageSection,
  boilerplateSet: Set<string>
): {
  definitions: ExtractedConceptItem[];
  formulas: ExtractedConceptItem[];
  examples: ExtractedConceptItem[];
  importantConcepts: ExtractedConceptItem[];
} {
  const definitions: ExtractedConceptItem[] = [];
  const formulas: ExtractedConceptItem[] = [];
  const examples: ExtractedConceptItem[] = [];
  const importantConcepts: ExtractedConceptItem[] = [];

  const seenContent = new Set<string>();
  const rawLines = reconstructPageLines(page.text);

  for (const formula of page.formulas) {
    const clean = formula.trim();
    if (clean && isLikelyFormula(clean) && !isNoiseOrMetadataLine(clean) && !seenContent.has(clean)) {
      seenContent.add(clean);
      formulas.push({
        id: makeId('frm'),
        kind: 'formula',
        content: clean,
        pageRef: page.pageLabel,
      });
    }
  }

  for (let i = 0; i < rawLines.length; i += 1) {
    const rawLine = rawLines[i];
    if (!rawLine) continue;

    const line = rawLine.replace(/^[-•*▪◦‣]\s+/, '').trim();
    if (line.length < 6) continue;
    if (/^\|.*\|$/.test(line)) continue; // handled via structured page.tables
    if (isNoiseOrMetadataLine(line)) continue;
    if (boilerplateSet.has(normalizeForRepeatCheck(line))) continue;

    // 1. Multi-line Worked Examples (capture problem + subsequent Solution / Step / Check / Answer lines)
    if (
      /^(example|halimbawa|sample problem|worked example|illustrative example|illustration|problem\s*\d*|given\s*:|for example|application)\b/i.test(
        line
      )
    ) {
      const collected: string[] = [line];
      let j = i + 1;
      while (j < rawLines.length && collected.join(' ').length < 520) {
        const nextRaw = rawLines[j];
        if (!nextRaw) break;
        const nextLine = nextRaw.replace(/^[-•*▪◦‣]\s+/, '').trim();
        if (!nextLine || isNoiseOrMetadataLine(nextLine)) break;
        if (boilerplateSet.has(normalizeForRepeatCheck(nextLine))) break;
        if (
          /^(example|halimbawa|sample problem|worked example|illustrative example)\b/i.test(
            nextLine
          ) ||
          isLikelyHeading(nextLine)
        ) {
          break;
        }
        collected.push(nextLine);
        j += 1;
      }

      const fullExample = stripUrlsFromText(collected.join(' | '));
      if (fullExample.length >= 14 && !seenContent.has(fullExample)) {
        seenContent.add(fullExample);
        examples.push({
          id: makeId('ex'),
          kind: 'example',
          content: fullExample.slice(0, 560),
          pageRef: page.pageLabel,
        });
      }
      i = j - 1;
      continue;
    }

    // 2. Definition & Explanation patterns (supports leading articles AND pronominal slide definitions like "It is a circle graph showing...")
    const pagePrimaryHeading = page.headings.find(
      (h) => !isNoiseOrMetadataLine(h) && !/[.!?]$/.test(h) && !/^[a-z$]/.test(h)
    );
    const pronominalDefMatch = line.match(
      /^(?:It|This(?:\s+(?:graph|chart|method|diagram|table))?)\s+(?:is\s+(?:a|an|the)|consists\s+of|uses|shows|displays|represents)\s+(.{12,})/i
    );
    if (pronominalDefMatch && pagePrimaryHeading) {
      const term = pagePrimaryHeading.replace(/^#+\s*/, '').trim();
      const body = stripUrlsFromText(line);
      if (body.length >= 16 && !isUrlOrReferenceLine(body)) {
        const content = `${term} — ${body}`;
        if (!seenContent.has(content)) {
          seenContent.add(content);
          definitions.push({
            id: makeId('def'),
            kind: 'definition',
            term,
            content,
            pageRef: page.pageLabel,
          });
          continue;
        }
      }
    }

    const defMatch =
      line.match(
        /^(?:(?:A|An|The)\s+)?([A-Z][A-Za-z0-9\s\-/()]{2,52}?)\s+(?:is defined as|refers to|means|is called|is used to|shows|displays|represents|is a|is an|is the|ay tumutukoy sa|ay isang)\s+(.{10,})/i
      ) ||
      line.match(/^(?:Definition|Depinisyon|Kahulugan)\s*[:\-]\s*(.{10,})/i) ||
      line.match(/^([A-Z][A-Za-z0-9\s\-/()]{2,42})\s*[:—–-]\s+([A-Za-z].{12,})/);

    if (
      defMatch &&
      !/^(module|chapter|unit|quarter|lesson|aralin|kabanata|yunit|topic|section|part|case\s*\d*|step\s*\d*|method\s*\d*|key concept|important|remember|tandaan|principle|rule|theorem|example|illustrative example|halimbawa|note|formula|table|figure|source|sources|reference|url|solution|answer|check|it|this|these|they|there)\b/i.test(
        line
      )
    ) {
      const term = defMatch[2] ? defMatch[1].trim() : undefined;
      const body = stripUrlsFromText(defMatch[2] ? defMatch[2].trim() : defMatch[1].trim());
      if (body.length >= 10 && !isUrlOrReferenceLine(body)) {
        const content = term ? `${term} — ${body}` : body;
        if (!seenContent.has(content)) {
          seenContent.add(content);
          definitions.push({
            id: makeId('def'),
            kind: 'definition',
            term,
            content,
            pageRef: page.pageLabel,
          });
          continue;
        }
      }
    }

    // 3. Formula check (equations, statistical formulas, percentages, central angles)
    if (
      !/^(key concept|important|remember|tandaan|note|summary|takeaway|source|http)/i.test(line) &&
      isLikelyFormula(line) &&
      !seenContent.has(line)
    ) {
      seenContent.add(line);
      formulas.push({
        id: makeId('frm'),
        kind: 'formula',
        content: line,
        pageRef: page.pageLabel,
      });
      continue;
    }

    // 4. Important concepts, properties, rules, advantages, bullet points, statistical observations
    if (
      /^(key concept|important|remember|tandaan|note|summary|takeaway|principle|rule|theorem|law of|advantage|disadvantage|when to use|interpretation|graph behavior|steps? (in|to|for)|if\s+the\s+lines|when\s+two\s+lines)\b/i.test(
        line
      ) ||
      (/^[-•*▪◦‣]/.test(rawLine) && line.length >= 16 && line.length <= 280)
    ) {
      const cleanConcept = stripUrlsFromText(line);
      if (cleanConcept.length >= 15 && !isUrlOrReferenceLine(cleanConcept) && !seenContent.has(cleanConcept)) {
        seenContent.add(cleanConcept);
        importantConcepts.push({
          id: makeId('con'),
          kind: 'concept',
          content: cleanConcept,
          pageRef: page.pageLabel,
        });
      }
    }
  }

  // Preserve numerical tables summary notes explicitly from extracted tables without inventing values
  for (const tbl of page.tables) {
    if (tbl.headers.length > 0 && tbl.rows.length > 0) {
      const tableSummary = `Table (${tbl.headers.slice(0, 5).join(' | ')}): ${tbl.rows.length} data row(s) recorded.`;
      if (!seenContent.has(tableSummary)) {
        seenContent.add(tableSummary);
        importantConcepts.push({
          id: makeId('con'),
          kind: 'concept',
          content: tableSummary,
          pageRef: page.pageLabel,
        });
      }
    }
  }

  return {
    definitions: definitions.slice(0, 12),
    formulas: formulas.slice(0, 12),
    examples: examples.slice(0, 10),
    importantConcepts: importantConcepts.slice(0, 14),
  };
}

function dedupeConceptItems(items: ExtractedConceptItem[], limit: number): ExtractedConceptItem[] {
  const seen = new Set<string>();
  const result: ExtractedConceptItem[] = [];
  for (const item of items) {
    const key = item.content.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

const SKIP_STANDALONE_SECTION_REGEX =
  /^(references?|bibliography|works cited|answer key|preface|acknowledgments?|table of contents)$/i;

export function analyzeExtractedDocument(params: {
  fileName: string;
  pages: ExtractedPageSection[];
  existingSubjects: Subject[];
  selectedSubjectName?: string;
}): {
  detectedSubject: string;
  detectedChapters: string[];
  detectedLessons: string[];
  topicInventory: ExtractedTopicCandidate[];
} {
  const { fileName, pages, existingSubjects, selectedSubjectName } = params;
  const fullText = pages.map((p) => p.text).join('\n');
  const boilerplateSet = detectRepeatedBoilerplateLines(pages);
  const cleanDocBaseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

  const detectedSubject =
    selectedSubjectName && selectedSubjectName !== 'Auto'
      ? selectedSubjectName
      : detectSubject(fullText, fileName, existingSubjects);

  const chaptersSet = new Set<string>();
  const lessonsSet = new Set<string>();

  let currentChapter = 'Module / Chapter 1';
  let currentLesson = 'Core Lesson';

  interface DraftTopic {
    chapter: string;
    lesson: string;
    title: string;
    subtopics: Set<string>;
    pageLabels: string[];
    linkedPages: ExtractedPageSection[];
    textSnippets: string[];
    definitions: ExtractedConceptItem[];
    formulas: ExtractedConceptItem[];
    examples: ExtractedConceptItem[];
    importantConcepts: ExtractedConceptItem[];
  }

  const drafts: DraftTopic[] = [];

  const ensureDraft = (title: string, page: ExtractedPageSection): DraftTopic => {
    const cleanTitle = stripUrlsFromText(title.replace(/^#+\s*/, '').trim()) || cleanDocBaseName;
    const normalizedNew = cleanTitle.toLowerCase();

    const existingIdx = drafts.findIndex((d) => d.title.toLowerCase() === normalizedNew);
    if (existingIdx !== -1) {
      const existing = drafts[existingIdx];
      if (!existing.pageLabels.includes(page.pageLabel)) {
        existing.pageLabels.push(page.pageLabel);
      }
      if (!existing.linkedPages.some((p) => p.pageNumber === page.pageNumber)) {
        existing.linkedPages.push(page);
      }
      return existing;
    }

    const created: DraftTopic = {
      chapter: currentChapter,
      lesson: currentLesson,
      title: cleanTitle,
      subtopics: new Set<string>(),
      pageLabels: [page.pageLabel],
      linkedPages: [page],
      textSnippets: [],
      definitions: [],
      formulas: [],
      examples: [],
      importantConcepts: [],
    };
    drafts.push(created);
    return created;
  };

  for (const page of pages) {
    const pageConcepts = extractConceptsFromPage(page, boilerplateSet);

    const isValidStoredHeading = (h: string): boolean => {
      if (h.length < 3 || h.length > 88) return false;
      if (/[.!?,;]$/.test(h)) return false;
      if (/^[a-z$]/.test(h)) return false;
      if (h.split(/\s+/).length > 10) return false;
      if (isNoiseOrMetadataLine(h) || isLikelyFormula(h) || isTableNumberedFragment(h)) return false;
      if (boilerplateSet.has(normalizeForRepeatCheck(h))) return false;
      return true;
    };

    const candidateHeadings = page.headings
      .map((h) => h.replace(/^#+\s*/, '').trim())
      .filter(isValidStoredHeading);

    if (candidateHeadings.length === 0) {
      for (const rawLine of page.text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (isLikelyHeading(line) && !boilerplateSet.has(normalizeForRepeatCheck(line))) {
          candidateHeadings.push(line.replace(/^#+\s*/, '').trim());
        }
      }
    }

    let skippedPageAsReferenceSection = false;
    let pagePrimaryDraft: DraftTopic | null = null;

    for (const heading of candidateHeadings) {
      if (SKIP_STANDALONE_SECTION_REGEX.test(heading)) {
        skippedPageAsReferenceSection = true;
        continue;
      }

      if (/^(chapter|unit|module|quarter|kabanata|yunit)\b/i.test(heading)) {
        currentChapter = heading;
        chaptersSet.add(heading);
        continue;
      }

      if (/^(lesson|aralin)\b/i.test(heading)) {
        currentLesson = heading;
        lessonsSet.add(heading);
        const lessonDraft = ensureDraft(heading, page);
        if (!pagePrimaryDraft) pagePrimaryDraft = lessonDraft;
        continue;
      }

      const currentTail = drafts[drafts.length - 1];
      if ((isSubtopicHeading(heading) || isTableNumberedFragment(heading)) && currentTail) {
        currentTail.subtopics.add(heading);
        if (!currentTail.pageLabels.includes(page.pageLabel)) {
          currentTail.pageLabels.push(page.pageLabel);
        }
        if (!currentTail.linkedPages.some((p) => p.pageNumber === page.pageNumber)) {
          currentTail.linkedPages.push(page);
        }
        continue;
      }

      // If this page already opened a real topic heading (and the previous heading on this page wasn't just a broad cover banner),
      // treat secondary labels on the same slide/page as subtopics rather than overwriting the slide title.
      if (
        pagePrimaryDraft &&
        !/^(statistics|mathematics|science|quarter|unit|module|english|filipino)/i.test(
          pagePrimaryDraft.title
        )
      ) {
        pagePrimaryDraft.subtopics.add(heading);
        continue;
      }

      const createdOrMerged = ensureDraft(heading, page);
      pagePrimaryDraft = createdOrMerged;
    }

    if (
      skippedPageAsReferenceSection &&
      pageConcepts.definitions.length === 0 &&
      pageConcepts.formulas.length === 0 &&
      pageConcepts.examples.length === 0
    ) {
      continue;
    }

    const cleanNonBoilerplateLines = reconstructPageLines(page.text).filter(
      (l) => l.length > 0 && !isNoiseOrMetadataLine(l) && !boilerplateSet.has(normalizeForRepeatCheck(l))
    );

    if (
      cleanNonBoilerplateLines.length === 0 &&
      candidateHeadings.length === 0 &&
      pageConcepts.definitions.length === 0 &&
      pageConcepts.formulas.length === 0 &&
      pageConcepts.examples.length === 0 &&
      page.tables.length === 0
    ) {
      continue;
    }

    const activeDraft =
      pagePrimaryDraft ??
      drafts[drafts.length - 1] ??
      ensureDraft(candidateHeadings[0] ?? `${cleanDocBaseName} (${page.pageLabel})`, page);

    if (!activeDraft.pageLabels.includes(page.pageLabel)) {
      activeDraft.pageLabels.push(page.pageLabel);
    }
    if (!activeDraft.linkedPages.some((p) => p.pageNumber === page.pageNumber)) {
      activeDraft.linkedPages.push(page);
    }

    const proseCandidates = cleanNonBoilerplateLines.filter((l) =>
      isCleanSummaryCandidate(l, boilerplateSet)
    );

    for (const snippet of proseCandidates) {
      const cleanSnippet = stripUrlsFromText(snippet.replace(/^[-•*▪◦‣]\s+/, ''));
      if (
        cleanSnippet.length >= 24 &&
        !isUrlOrReferenceLine(cleanSnippet) &&
        activeDraft.textSnippets.length < 3 &&
        !activeDraft.textSnippets.includes(cleanSnippet.slice(0, 240))
      ) {
        activeDraft.textSnippets.push(cleanSnippet.slice(0, 240));
      }
    }

    activeDraft.definitions.push(...pageConcepts.definitions);
    activeDraft.formulas.push(...pageConcepts.formulas);
    activeDraft.examples.push(...pageConcepts.examples);
    activeDraft.importantConcepts.push(...pageConcepts.importantConcepts);

    for (const tbl of page.tables) {
      if (tbl.headers.length > 0) {
        activeDraft.subtopics.add(
          tbl.title ? `Table: ${tbl.title}` : `Table (${tbl.headers.slice(0, 3).join(', ')})`
        );
      }
    }
  }

  // Merge empty/boilerplate drafts (0 concepts, 0 snippets, 0 subtopics) into their neighbor
  const consolidatedDrafts: DraftTopic[] = [];
  let pendingChapterBanner: string | null = null;
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    const hasSubstance =
      draft.definitions.length > 0 ||
      draft.formulas.length > 0 ||
      draft.examples.length > 0 ||
      draft.importantConcepts.length > 0 ||
      draft.textSnippets.length > 0 ||
      draft.subtopics.size > 0;

    if (!hasSubstance) {
      if (consolidatedDrafts.length === 0 && i + 1 < drafts.length) {
        // Leading empty super-header (e.g., "STATISTICS AND PROBABILITY") becomes chapter context
        pendingChapterBanner = draft.title;
        chaptersSet.add(draft.title);
        continue;
      }
      if (consolidatedDrafts.length > 0) {
        const prev = consolidatedDrafts[consolidatedDrafts.length - 1];
        prev.subtopics.add(draft.title);
        for (const pl of draft.pageLabels) {
          if (!prev.pageLabels.includes(pl)) prev.pageLabels.push(pl);
        }
        for (const lp of draft.linkedPages) {
          if (!prev.linkedPages.some((p) => p.pageNumber === lp.pageNumber)) {
            prev.linkedPages.push(lp);
          }
        }
        continue;
      }
    }

    if (pendingChapterBanner) {
      if (draft.chapter === 'Module / Chapter 1') {
        draft.chapter = pendingChapterBanner;
      }
      pendingChapterBanner = null;
    }

    consolidatedDrafts.push(draft);
  }

  if (chaptersSet.size === 0) chaptersSet.add(currentChapter);
  if (lessonsSet.size === 0) lessonsSet.add(currentLesson);

  const topicInventory: ExtractedTopicCandidate[] = consolidatedDrafts.map((draft, idx) => {
    const firstPage = draft.pageLabels[0] ?? 'Page 1';
    const lastPage = draft.pageLabels[draft.pageLabels.length - 1];
    const pageRef =
      draft.pageLabels.length > 1 && firstPage !== lastPage
        ? `${firstPage} – ${lastPage}`
        : firstPage;

    const dedupedDefs = dedupeConceptItems(draft.definitions, 12);
    const dedupedFormulas = dedupeConceptItems(draft.formulas, 12);
    const dedupedExamples = dedupeConceptItems(draft.examples, 10);
    const dedupedConcepts = dedupeConceptItems(draft.importantConcepts, 14);

    // Do NOT fabricate a summary if no real explanatory prose was extracted from source pages
    const proseSummary = stripUrlsFromText(draft.textSnippets.join(' '));
    const summary =
      proseSummary.length >= 20
        ? proseSummary.length > 320
          ? `${proseSummary.slice(0, 317)}...`
          : proseSummary
        : dedupedDefs[0]?.content
          ? dedupedDefs[0].content.slice(0, 317)
          : '';

    const uncertainty = assessHeadingUncertainty(draft.title, draft.linkedPages);

    return {
      id: makeId(`inv-${idx + 1}`),
      subjectHint: detectedSubject,
      chapter: draft.chapter,
      lesson: draft.lesson,
      title: draft.title,
      subtopics: Array.from(draft.subtopics).slice(0, 12),
      summary,
      pageRef,
      definitions: dedupedDefs,
      formulas: dedupedFormulas,
      examples: dedupedExamples,
      importantConcepts: dedupedConcepts,
      confirmed: true,
      uncertainTitle: uncertainty.uncertain,
      titleReviewReason: uncertainty.reason,
      sourceAttribution: 'extracted-from-document',
    };
  });

  return {
    detectedSubject,
    detectedChapters: Array.from(chaptersSet),
    detectedLessons: Array.from(lessonsSet),
    topicInventory,
  };
}
