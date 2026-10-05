import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const scope = z.string().regex(/^[A-Za-z0-9:_-]+$/);
const configSchema = z.object({
  issuer: z.url(),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535),
  databasePath: z.string().min(1),
  allowLoopbackHttp: z.boolean().default(false),
  trustProxy: z.boolean().default(false),
  identityResource: z.url(),
  resources: z.array(z.object({ resource: z.url(), scopes: z.array(scope).min(1) })).min(1),
  clients: z.array(z.object({
    clientId: z.string().regex(/^[A-Za-z0-9._-]+$/),
    name: z.string().min(1),
    redirectUris: z.array(z.url()).min(1),
    resources: z.array(z.url()).min(1),
    scopes: z.array(scope).min(1),
  })).min(1),
  accessTokenTtl: z.number().int().positive().default(900),
  sessionTtl: z.number().int().positive().default(28800),
  grantTtl: z.number().int().positive().default(28800),
}).strict();

export type IdentityConfig = z.infer<typeof configSchema>;

export function validateConfig(input: unknown): IdentityConfig {
  const config = configSchema.parse(input);
  const issuer = new URL(config.issuer);
  const loopback = (url: URL) => ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (issuer.username || issuer.password || issuer.search || issuer.hash || issuer.pathname !== '/') {
    throw new Error('issuer must be an origin without credentials, path, query, or fragment');
  }
  config.issuer = issuer.origin;
  if (issuer.protocol !== 'https:' && !(config.allowLoopbackHttp && issuer.protocol === 'http:' && loopback(issuer))) {
    throw new Error('issuer requires HTTPS; explicit local testing may use loopback HTTP');
  }
  if (issuer.protocol === 'http:' && !['127.0.0.1', '::1', 'localhost'].includes(config.host)) {
    throw new Error('local HTTP must bind to loopback');
  }
  if (new Set(config.resources.map((value) => value.resource)).size !== config.resources.length
    || new Set(config.clients.map((value) => value.clientId)).size !== config.clients.length) {
    throw new Error('resource and client identifiers must be unique');
  }
  if (!config.resources.some((value) => value.resource === config.identityResource && value.scopes.includes('identity:read'))) {
    throw new Error('identityResource must allow identity:read');
  }
  for (const resource of config.resources) {
    const url = new URL(resource.resource);
    if (url.origin !== config.issuer || url.hash || url.search || url.username || url.password) {
      throw new Error('resources must be in this deployment and have no credentials, query, or fragment');
    }
  }
  for (const client of config.clients) {
    if (client.resources.some((resource) => !config.resources.some((entry) => entry.resource === resource))) {
      throw new Error(`unknown resource for client ${client.clientId}`);
    }
    const allowed = new Set(['openid', ...config.resources.filter((entry) => client.resources.includes(entry.resource)).flatMap((entry) => entry.scopes)]);
    if (client.scopes.some((value) => !allowed.has(value))) throw new Error(`unknown scope for client ${client.clientId}`);
    for (const redirect of client.redirectUris) {
      const url = new URL(redirect);
      if (url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback(url)))) {
        throw new Error(`invalid redirect URI for client ${client.clientId}`);
      }
    }
  }
  config.databasePath = resolve(config.databasePath);
  return config;
}

export async function readConfig(path: string): Promise<IdentityConfig> {
  return validateConfig(JSON.parse(await readFile(path, 'utf8')));
}
