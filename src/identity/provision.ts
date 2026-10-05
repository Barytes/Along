import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { readConfig } from './config.js';
import { openIdentityStore } from './store.js';
import { Accounts } from './accounts.js';

try {
  const { values } = parseArgs({ options: { config: { type: 'string' }, accounts: { type: 'string' } } });
  if (!values.config || !values.accounts) throw new Error('usage: --config <config.json> --accounts <accounts.json>');
  const config = await readConfig(values.config);
  const database = openIdentityStore(config.databasePath);
  try {
    const accounts = await new Accounts(database).provision(JSON.parse(await readFile(values.accounts, 'utf8')));
    process.stdout.write(`${JSON.stringify(accounts)}\n`);
  } finally { database.close(); }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'account initialization failed'}\n`);
  process.exitCode = 1;
}
