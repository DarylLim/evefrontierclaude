import Database from 'better-sqlite3';
import path from 'path';
import { KnowledgeChunk } from '../types';

const DB_PATH = path.join(__dirname, '../../data/knowledge.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    ensureSchema(db);
  }
  return db;
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      source   TEXT NOT NULL,
      category TEXT NOT NULL,
      keywords TEXT NOT NULL,
      text     TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      text,
      keywords,
      content='chunks',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, text, keywords) VALUES (new.id, new.text, new.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, text, keywords) VALUES('delete', old.id, old.text, old.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, text, keywords) VALUES('delete', old.id, old.text, old.keywords);
      INSERT INTO chunks_fts(rowid, text, keywords) VALUES (new.id, new.text, new.keywords);
    END;
  `);
}

export class KnowledgeBase {
  static search(query: string, limit = 5): KnowledgeChunk[] {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT c.id, c.source, c.category, c.keywords, c.text
      FROM chunks_fts
      JOIN chunks c ON chunks_fts.rowid = c.id
      WHERE chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as {
      id: number;
      source: string;
      category: string;
      keywords: string;
      text: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      category: r.category,
      keywords: r.keywords.split(','),
      text: r.text,
    }));
  }

  static insert(chunk: Omit<KnowledgeChunk, 'id'>): void {
    const database = getDb();
    const stmt = database.prepare(
      `INSERT INTO chunks (source, category, keywords, text) VALUES (?, ?, ?, ?)`
    );
    stmt.run(chunk.source, chunk.category, chunk.keywords.join(','), chunk.text);
  }

  static count(): number {
    const database = getDb();
    const row = database.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number };
    return row.n;
  }
}
