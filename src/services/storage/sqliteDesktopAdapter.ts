import Database from '@tauri-apps/plugin-sql';
import {
  DocumentExtractionContent,
  ExamAttempt,
  LocalDocument,
  MockExam,
  ResearchNote,
  StudentProfile,
  StudyGuide,
  Subject,
  Topic,
} from '../../types/domain';
import { StoreName } from './indexedDb';
import { SQLITE_SCHEMA_STATEMENTS } from './sqliteMigration';

const SQLITE_DB_URL = 'sqlite:studywise_ai.db';

let cachedDbPromise: Promise<Database> | null = null;

async function getSqliteDb(): Promise<Database> {
  if (!cachedDbPromise) {
    cachedDbPromise = (async () => {
      const db = await Database.load(SQLITE_DB_URL);
      for (const ddl of SQLITE_SCHEMA_STATEMENTS) {
        await db.execute(ddl);
      }
      return db;
    })();
  }
  return cachedDbPromise;
}

function mapTableName(storeName: StoreName): string {
  if (storeName === 'documentContents') return 'document_contents';
  if (storeName === 'studyGuides') return 'study_guides';
  if (storeName === 'researchNotes') return 'research_notes';
  if (storeName === 'mockExams') return 'mock_exams';
  if (storeName === 'examAttempts') return 'exam_attempts';
  if (storeName === 'appMeta') return 'app_meta';
  return storeName;
}

export const sqliteDesktopAdapter = {
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await getSqliteDb();
    const table = mapTableName(storeName);
    const rows = await db.select<Array<{ payload_json: string }>>(
      `SELECT payload_json FROM ${table}`
    );
    return rows.map((row) => JSON.parse(row.payload_json) as T);
  },

  async getByKey<T>(storeName: StoreName, key: string): Promise<T | undefined> {
    const db = await getSqliteDb();
    const table = mapTableName(storeName);
    const keyCol =
      storeName === 'appMeta'
        ? 'key'
        : storeName === 'documentContents'
          ? 'document_id'
          : 'id';

    const rows = await db.select<Array<{ payload_json: string }>>(
      `SELECT payload_json FROM ${table} WHERE ${keyCol} = $1 LIMIT 1`,
      [key]
    );
    if (!rows.length) return undefined;
    return JSON.parse(rows[0].payload_json) as T;
  },

  async put<T>(storeName: StoreName, record: T): Promise<void> {
    const db = await getSqliteDb();
    const payloadJson = JSON.stringify(record);

    switch (storeName) {
      case 'profile': {
        const p = record as StudentProfile;
        await db.execute(
          `INSERT OR REPLACE INTO profile (id, full_name, grade_level, strand, school_name, preferred_language, updated_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [p.id, p.fullName, p.gradeLevel, p.strand, p.schoolName, p.preferredLanguage, p.updatedAt, payloadJson]
        );
        return;
      }
      case 'subjects': {
        const s = record as Subject;
        await db.execute(
          `INSERT OR REPLACE INTO subjects (id, code, name, grade_level, quarter, updated_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [s.id, s.code, s.name, s.gradeLevel, s.quarter, s.updatedAt, payloadJson]
        );
        return;
      }
      case 'documents': {
        const d = record as LocalDocument;
        await db.execute(
          `INSERT OR REPLACE INTO documents (id, subject_id, file_name, extraction_status, local_vault_path, added_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [d.id, d.subjectId, d.fileName, d.extractionStatus, d.localVaultPath ?? null, d.addedAt, payloadJson]
        );
        return;
      }
      case 'documentContents': {
        const dc = record as DocumentExtractionContent;
        const { rawFileBuffer: _omit, ...serializable } = dc;
        await db.execute(
          `INSERT OR REPLACE INTO document_contents (document_id, source_file_name, inventory_status, updated_at, payload_json)
           VALUES ($1, $2, $3, $4, $5)`,
          [dc.documentId, dc.sourceFileName, dc.inventoryStatus, dc.updatedAt, JSON.stringify(serializable)]
        );
        return;
      }
      case 'topics': {
        const t = record as Topic;
        await db.execute(
          `INSERT OR REPLACE INTO topics (id, subject_id, title, quarter, mastery_status, updated_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [t.id, t.subjectId, t.title, t.quarter, t.masteryStatus, t.updatedAt, payloadJson]
        );
        return;
      }
      case 'studyGuides': {
        const g = record as StudyGuide;
        await db.execute(
          `INSERT OR REPLACE INTO study_guides (id, subject_id, title, source_mode, updated_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [g.id, g.subjectId, g.title, g.sourceMode, g.updatedAt, payloadJson]
        );
        return;
      }
      case 'researchNotes': {
        const rn = record as ResearchNote;
        await db.execute(
          `INSERT OR REPLACE INTO research_notes (id, subject_id, query, source_engine, saved_offline_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [rn.id, rn.subjectId, rn.query, rn.sourceEngine, rn.savedOfflineAt, payloadJson]
        );
        return;
      }
      case 'mockExams': {
        const ex = record as MockExam;
        await db.execute(
          `INSERT OR REPLACE INTO mock_exams (id, subject_id, title, grade_level, created_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [ex.id, ex.subjectId, ex.title, ex.gradeLevel, ex.createdAt, payloadJson]
        );
        return;
      }
      case 'examAttempts': {
        const att = record as ExamAttempt;
        await db.execute(
          `INSERT OR REPLACE INTO exam_attempts (id, exam_id, subject_id, percentage, completed_at, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [att.id, att.examId, att.subjectId, att.percentage, att.completedAt, payloadJson]
        );
        return;
      }
      case 'appMeta': {
        const meta = record as { key: string };
        await db.execute(
          `INSERT OR REPLACE INTO app_meta (key, payload_json) VALUES ($1, $2)`,
          [meta.key, payloadJson]
        );
      }
    }
  },

  async putMany<T>(storeName: StoreName, records: T[]): Promise<void> {
    for (const item of records) {
      await this.put(storeName, item);
    }
  },

  async delete(storeName: StoreName, key: string): Promise<void> {
    const db = await getSqliteDb();
    const table = mapTableName(storeName);
    const keyCol =
      storeName === 'appMeta'
        ? 'key'
        : storeName === 'documentContents'
          ? 'document_id'
          : 'id';

    await db.execute(`DELETE FROM ${table} WHERE ${keyCol} = $1`, [key]);
  },

  async clearStore(storeName: StoreName): Promise<void> {
    const db = await getSqliteDb();
    const table = mapTableName(storeName);
    await db.execute(`DELETE FROM ${table}`);
  },

  async clearAll(): Promise<void> {
    const stores: StoreName[] = [
      'profile',
      'subjects',
      'documents',
      'documentContents',
      'topics',
      'studyGuides',
      'researchNotes',
      'mockExams',
      'examAttempts',
      'appMeta',
    ];
    for (const store of stores) {
      await this.clearStore(store);
    }
  },
};
