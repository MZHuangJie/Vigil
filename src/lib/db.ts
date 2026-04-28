import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { TaskConfig, TaskRecord, TaskStatus, EventRecord, StatRecord } from "./types";

let db: Database.Database;

function getDbPath(): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath) return envPath;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "vigil.db");
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = db!;
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      config TEXT NOT NULL,
      status TEXT DEFAULT 'stopped',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stats_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      value REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id);
    CREATE INDEX IF NOT EXISTS idx_stats_task_id ON stats_history(task_id);
  `);
}

export function createTask(config: TaskConfig): void {
  const database = getDb();
  const stmt = database.prepare(
    "INSERT INTO tasks (id, name, enabled, config, status) VALUES (?, ?, ?, ?, 'stopped')"
  );
  stmt.run(config.id, config.name, config.enabled ? 1 : 0, JSON.stringify(config));
}

export function updateTask(id: string, config: TaskConfig): void {
  const database = getDb();
  const stmt = database.prepare(
    "UPDATE tasks SET name = ?, enabled = ?, config = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  );
  stmt.run(config.name, config.enabled ? 1 : 0, JSON.stringify(config), id);
}

export function deleteTask(id: string): void {
  const database = getDb();
  database.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  database.prepare("DELETE FROM events WHERE task_id = ?").run(id);
  database.prepare("DELETE FROM stats_history WHERE task_id = ?").run(id);
}

export function getTask(id: string): TaskConfig | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRecord | undefined;
  if (!row) return null;
  return { ...JSON.parse(row.config), id: row.id, enabled: row.enabled === 1 };
}

export function getAllTasks(): TaskConfig[] {
  const database = getDb();
  const rows = database.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as TaskRecord[];
  return rows.map((row) => ({ ...JSON.parse(row.config), id: row.id, enabled: row.enabled === 1 }));
}

export function setTaskStatus(id: string, status: TaskStatus, errorMessage?: string): void {
  const database = getDb();
  database
    .prepare(
      "UPDATE tasks SET status = ?, error_message = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    )
    .run(status, errorMessage || null, id);
}

export function getTaskStatus(id: string): TaskStatus | null {
  const database = getDb();
  const row = database.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as
    | { status: TaskStatus }
    | undefined;
  return row?.status ?? null;
}

export function addEvent(taskId: string, type: "log" | "alert" | "stat", data: unknown): void {
  const database = getDb();
  database
    .prepare("INSERT INTO events (task_id, type, data) VALUES (?, ?, ?)")
    .run(taskId, type, JSON.stringify(data));
}

export function getEvents(taskId?: string, limit = 100): EventRecord[] {
  const database = getDb();
  if (taskId) {
    return database
      .prepare("SELECT * FROM events WHERE task_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(taskId, limit) as EventRecord[];
  }
  return database
    .prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?")
    .all(limit) as EventRecord[];
}

export function addStatRecord(taskId: string, fieldName: string, value: number): void {
  const database = getDb();
  database
    .prepare("INSERT INTO stats_history (task_id, field_name, value) VALUES (?, ?, ?)")
    .run(taskId, fieldName, value);
}

export function getStatRecords(taskId: string, windowSeconds: number): StatRecord[] {
  const database = getDb();
  return database
    .prepare(
      `SELECT * FROM stats_history 
       WHERE task_id = ? AND created_at >= datetime('now', 'localtime', ?) 
       ORDER BY created_at DESC`
    )
    .all(taskId, `-${windowSeconds} seconds`) as StatRecord[];
}

export function getStatSummary(taskId: string): Array<{ field_name: string; count: number; sum: number; avg: number; min: number; max: number }> {
  const database = getDb();
  return database
    .prepare(
      `SELECT field_name, COUNT(*) as count, SUM(value) as sum, AVG(value) as avg, MIN(value) as min, MAX(value) as max 
       FROM stats_history WHERE task_id = ? GROUP BY field_name`
    )
    .all(taskId) as Array<{ field_name: string; count: number; sum: number; avg: number; min: number; max: number }>;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
