import { WorkspaceSnapshot } from '../../types/domain';

/**
 * Authoritative SQLite schema for StudyWise AI Desktop (matches src-tauri/src/lib.rs).
 * Every student record, extracted topic inventory, study guide, research note,
 * mock examination, and exam attempt persists in SQLite (`sqlite:studywise_ai.db`).
 */
export const SQLITE_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    strand TEXT NOT NULL,
    school_name TEXT NOT NULL,
    preferred_language TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    quarter TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    extraction_status TEXT NOT NULL,
    local_vault_path TEXT,
    added_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS document_contents (
    document_id TEXT PRIMARY KEY,
    source_file_name TEXT NOT NULL,
    inventory_status TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    quarter TEXT NOT NULL,
    mastery_status TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS study_guides (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source_mode TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS research_notes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    query TEXT NOT NULL,
    source_engine TEXT NOT NULL,
    saved_offline_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS mock_exams (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS exam_attempts (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    percentage INTEGER NOT NULL,
    completed_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL
  );`,
];

function sqlEscape(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Generates a portable SQLite .sql script containing schema DDL and all student records.
 */
export function buildSqliteSqlDump(workspace: WorkspaceSnapshot): string {
  const lines: string[] = [
    '-- StudyWise AI Local SQLite Export',
    `-- Generated at: ${new Date().toISOString()}`,
    'BEGIN TRANSACTION;',
    '',
    ...SQLITE_SCHEMA_STATEMENTS,
    '',
  ];

  const p = workspace.profile;
  lines.push(
    `INSERT OR REPLACE INTO profile (id, full_name, grade_level, strand, school_name, preferred_language, updated_at, payload_json) VALUES (${sqlEscape(p.id)}, ${sqlEscape(p.fullName)}, ${sqlEscape(p.gradeLevel)}, ${sqlEscape(p.strand)}, ${sqlEscape(p.schoolName)}, ${sqlEscape(p.preferredLanguage)}, ${sqlEscape(p.updatedAt)}, ${sqlEscape(JSON.stringify(p))});`
  );

  for (const s of workspace.subjects) {
    lines.push(
      `INSERT OR REPLACE INTO subjects (id, code, name, grade_level, quarter, updated_at, payload_json) VALUES (${sqlEscape(s.id)}, ${sqlEscape(s.code)}, ${sqlEscape(s.name)}, ${sqlEscape(s.gradeLevel)}, ${sqlEscape(s.quarter)}, ${sqlEscape(s.updatedAt)}, ${sqlEscape(JSON.stringify(s))});`
    );
  }

  for (const d of workspace.documents) {
    lines.push(
      `INSERT OR REPLACE INTO documents (id, subject_id, file_name, extraction_status, local_vault_path, added_at, payload_json) VALUES (${sqlEscape(d.id)}, ${sqlEscape(d.subjectId)}, ${sqlEscape(d.fileName)}, ${sqlEscape(d.extractionStatus)}, ${d.localVaultPath ? sqlEscape(d.localVaultPath) : 'NULL'}, ${sqlEscape(d.addedAt)}, ${sqlEscape(JSON.stringify(d))});`
    );
  }

  for (const dc of workspace.documentContents) {
    const { rawFileBuffer: _omit, ...serializable } = dc;
    lines.push(
      `INSERT OR REPLACE INTO document_contents (document_id, source_file_name, inventory_status, updated_at, payload_json) VALUES (${sqlEscape(dc.documentId)}, ${sqlEscape(dc.sourceFileName)}, ${sqlEscape(dc.inventoryStatus)}, ${sqlEscape(dc.updatedAt)}, ${sqlEscape(JSON.stringify(serializable))});`
    );
  }

  for (const t of workspace.topics) {
    lines.push(
      `INSERT OR REPLACE INTO topics (id, subject_id, title, quarter, mastery_status, updated_at, payload_json) VALUES (${sqlEscape(t.id)}, ${sqlEscape(t.subjectId)}, ${sqlEscape(t.title)}, ${sqlEscape(t.quarter)}, ${sqlEscape(t.masteryStatus)}, ${sqlEscape(t.updatedAt)}, ${sqlEscape(JSON.stringify(t))});`
    );
  }

  for (const g of workspace.studyGuides) {
    lines.push(
      `INSERT OR REPLACE INTO study_guides (id, subject_id, title, source_mode, updated_at, payload_json) VALUES (${sqlEscape(g.id)}, ${sqlEscape(g.subjectId)}, ${sqlEscape(g.title)}, ${sqlEscape(g.sourceMode)}, ${sqlEscape(g.updatedAt)}, ${sqlEscape(JSON.stringify(g))});`
    );
  }

  for (const rn of workspace.researchNotes) {
    lines.push(
      `INSERT OR REPLACE INTO research_notes (id, subject_id, query, source_engine, saved_offline_at, payload_json) VALUES (${sqlEscape(rn.id)}, ${sqlEscape(rn.subjectId)}, ${sqlEscape(rn.query)}, ${sqlEscape(rn.sourceEngine)}, ${sqlEscape(rn.savedOfflineAt)}, ${sqlEscape(JSON.stringify(rn))});`
    );
  }

  for (const ex of workspace.mockExams) {
    lines.push(
      `INSERT OR REPLACE INTO mock_exams (id, subject_id, title, grade_level, created_at, payload_json) VALUES (${sqlEscape(ex.id)}, ${sqlEscape(ex.subjectId)}, ${sqlEscape(ex.title)}, ${sqlEscape(ex.gradeLevel)}, ${sqlEscape(ex.createdAt)}, ${sqlEscape(JSON.stringify(ex))});`
    );
  }

  for (const att of workspace.examAttempts) {
    lines.push(
      `INSERT OR REPLACE INTO exam_attempts (id, exam_id, subject_id, percentage, completed_at, payload_json) VALUES (${sqlEscape(att.id)}, ${sqlEscape(att.examId)}, ${sqlEscape(att.subjectId)}, ${Number(att.percentage || 0)}, ${sqlEscape(att.completedAt)}, ${sqlEscape(JSON.stringify(att))});`
    );
  }

  lines.push('', 'COMMIT;');
  return lines.join('\n');
}
