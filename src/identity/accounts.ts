import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z } from 'zod';

const accountsSchema = z.array(z.object({
  username: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  password: z.string().min(12).max(1024),
}).strict()).min(1);

interface AccountRow { id: string; username: string; password_hash: string }
export interface Account { account_id: string; username: string }

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key));
  });
}

export class Accounts {
  constructor(private readonly database: Database.Database) {}

  async provision(input: unknown): Promise<(Account & { created: boolean })[]> {
    const accounts = accountsSchema.parse(input);
    if (new Set(accounts.map((value) => value.username)).size !== accounts.length) {
      throw new Error('duplicate usernames in account configuration');
    }
    const prepared = await Promise.all(accounts.map(async (account) => {
      const salt = randomBytes(16).toString('hex');
      const key = await derivePassword(account.password, salt);
      return { ...account, hash: `scrypt:${salt}:${key.toString('hex')}` };
    }));
    return this.database.transaction(() => prepared.map((account) => {
      const existing = this.database.prepare<[string], AccountRow>('SELECT * FROM accounts WHERE username=?').get(account.username);
      if (existing) return { account_id: existing.id, username: existing.username, created: false };
      const id = randomUUID();
      this.database.prepare('INSERT INTO accounts (id,username,password_hash) VALUES (?,?,?)')
        .run(id, account.username, account.hash);
      return { account_id: id, username: account.username, created: true };
    }))();
  }

  find(id: string): Account | undefined {
    const row = this.database.prepare<[string], AccountRow>('SELECT * FROM accounts WHERE id=?').get(id);
    return row ? { account_id: row.id, username: row.username } : undefined;
  }

  async authenticate(username: unknown, password: unknown): Promise<Account | undefined> {
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) return undefined;
    const row = this.database.prepare<[string], AccountRow>('SELECT * FROM accounts WHERE username=?').get(username);
    const [, salt, digest] = (row?.password_hash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await derivePassword(password, salt!);
    if (!timingSafeEqual(actual, Buffer.from(digest!, 'hex')) || !row) return undefined;
    return { account_id: row.id, username: row.username };
  }
}
