import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Adapter, AdapterPayload } from 'oidc-provider';

export function openIdentityStore(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new Database(path);
  chmodSync(path, 0o600);
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_state (
      model TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
      expires_at INTEGER, grant_id TEXT, uid TEXT, user_code TEXT,
      PRIMARY KEY (model, id)
    );
    CREATE INDEX IF NOT EXISTS oauth_grant ON oauth_state(grant_id);
    CREATE INDEX IF NOT EXISTS oauth_uid ON oauth_state(model, uid);
  `);
  return database;
}

export function sqliteAdapter(database: Database.Database) {
  return class SqliteAdapter implements Adapter {
    constructor(private readonly model: string) {}

    async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
      database.prepare(`INSERT INTO oauth_state (model,id,payload,expires_at,grant_id,uid,user_code)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(model,id) DO UPDATE SET
        payload=excluded.payload, expires_at=excluded.expires_at, grant_id=excluded.grant_id,
        uid=excluded.uid, user_code=excluded.user_code`).run(
        this.model, id, JSON.stringify(payload),
        expiresIn === undefined ? null : Math.floor(Date.now() / 1000) + expiresIn,
        payload.grantId ?? null, payload.uid ?? null, payload.userCode ?? null,
      );
    }

    private findRow(column: 'id' | 'uid' | 'user_code', value: string): AdapterPayload | undefined {
      const row = database.prepare<[string, string, number], { payload: string }>(
        `SELECT payload FROM oauth_state WHERE model=? AND ${column}=? AND (expires_at IS NULL OR expires_at>?)`,
      ).get(this.model, value, Math.floor(Date.now() / 1000));
      return row ? JSON.parse(row.payload) : undefined;
    }

    async find(id: string) { return this.findRow('id', id); }
    async findByUid(uid: string) { return this.findRow('uid', uid); }
    async findByUserCode(code: string) { return this.findRow('user_code', code); }
    async destroy(id: string) {
      database.prepare('DELETE FROM oauth_state WHERE model=? AND id=?').run(this.model, id);
    }
    async consume(id: string) {
      database.prepare("UPDATE oauth_state SET payload=json_set(payload,'$.consumed',?) WHERE model=? AND id=?")
        .run(Math.floor(Date.now() / 1000), this.model, id);
    }
    async revokeByGrantId(grantId: string) {
      database.prepare('DELETE FROM oauth_state WHERE grant_id=?').run(grantId);
    }
  };
}
