import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Thought, ReasoningGraph } from './types.js';

export class SQLitePersistence {
  private db: sqlite3.Database;
  private ready: Promise<void>;

  constructor(dbPath: string = './dre.db') {
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
          )
        `, (err) => {
          if (err) reject(err);
        });

        this.db.run(`
          CREATE TABLE IF NOT EXISTS thoughts (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            thought TEXT NOT NULL,
            thought_type TEXT NOT NULL,
            dependencies TEXT NOT NULL,
            confidence REAL,
            action_request TEXT,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions (session_id)
          )
        `, (err) => {
          if (err) reject(err);
        });

        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_thoughts_session 
          ON thoughts (session_id)
        `, (err) => {
          if (err) reject(err);
        });

        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_thoughts_timestamp 
          ON thoughts (timestamp)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async saveSession(sessionId: string, createdAt: string): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO sessions (session_id, created_at) VALUES (?, ?)',
        [sessionId, createdAt],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async saveThought(thought: Thought, sessionId: string): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO thoughts 
        (id, session_id, thought, thought_type, dependencies, confidence, action_request, timestamp, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        thought.id,
        sessionId,
        thought.thought,
        thought.thought_type,
        JSON.stringify(thought.dependencies),
        thought.confidence,
        thought.action_request ? JSON.stringify(thought.action_request) : null,
        thought.timestamp,
        thought.status
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async loadGraph(sessionId: string): Promise<ReasoningGraph | null> {
    await this.ready;
    
    const session = await new Promise<any>((resolve, reject) => {
      this.db.get(
        'SELECT * FROM sessions WHERE session_id = ?',
        [sessionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) return null;

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db.all(
        'SELECT * FROM thoughts WHERE session_id = ? ORDER BY timestamp',
        [sessionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const thoughts = new Map<string, Thought>();
    
    for (const row of rows) {
      const thought: Thought = {
        id: row.id,
        thought: row.thought,
        thought_type: row.thought_type,
        dependencies: JSON.parse(row.dependencies),
        confidence: row.confidence,
        action_request: row.action_request ? JSON.parse(row.action_request) : undefined,
        timestamp: row.timestamp,
        status: row.status
      };
      thoughts.set(thought.id, thought);
    }

    return {
      thoughts,
      session_id: sessionId,
      created_at: session.created_at
    };
  }

  async getAllSessions(): Promise<{ session_id: string; created_at: string; thought_count: number }[]> {
    await this.ready;
    
    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db.all(`
        SELECT 
          s.session_id,
          s.created_at,
          COUNT(t.id) as thought_count
        FROM sessions s
        LEFT JOIN thoughts t ON s.session_id = t.session_id
        GROUP BY s.session_id, s.created_at
        ORDER BY s.created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return rows.map(row => ({
      session_id: row.session_id,
      created_at: row.created_at,
      thought_count: row.thought_count
    }));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ready;
    
    await new Promise<void>((resolve, reject) => {
      this.db.run('DELETE FROM thoughts WHERE session_id = ?', [sessionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise<void>((resolve, reject) => {
      this.db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getMetrics(): Promise<{
    total_sessions: number;
    total_thoughts: number;
    thoughts_by_type: Record<string, number>;
    avg_thoughts_per_session: number;
  }> {
    await this.ready;
    
    const sessionCount = await new Promise<any>((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM sessions', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const thoughtCount = await new Promise<any>((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM thoughts', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const typeRows = await new Promise<any[]>((resolve, reject) => {
      this.db.all(`
        SELECT thought_type, COUNT(*) as count 
        FROM thoughts 
        GROUP BY thought_type
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const thoughts_by_type: Record<string, number> = {};
    for (const row of typeRows) {
      thoughts_by_type[row.thought_type] = row.count;
    }
    
    return {
      total_sessions: sessionCount.count,
      total_thoughts: thoughtCount.count,
      thoughts_by_type,
      avg_thoughts_per_session: sessionCount.count > 0 ? thoughtCount.count / sessionCount.count : 0
    };
  }

  async close(): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}