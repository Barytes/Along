import { parseArgs } from 'node:util';
import { readConfig } from './config.js';
import { startIdentityService } from './server.js';

try {
  const { values } = parseArgs({ options: { config: { type: 'string' } } });
  if (!values.config) throw new Error('usage: --config <config.json>');
  const config = await readConfig(values.config);
  const service = await startIdentityService(config);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try { await service.close(); }
    catch { process.stderr.write('identity service shutdown failed\n'); process.exitCode = 1; }
  };
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  process.stdout.write(`${JSON.stringify({ status: 'ready', issuer: config.issuer })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'identity service startup failed'}\n`);
  process.exitCode = 1;
}
