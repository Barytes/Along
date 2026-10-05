import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import type { IdentityConfig } from './config.js';
import { startIdentityService } from './server.js';

export const alicePassword = 'Alice-test-password-2026';
export const bobPassword = 'Bob-test-password-2026';
export const clientId = 'acceptance-client';
export const callback = 'http://127.0.0.1:19999/callback';

export class BrowserClient {
  private readonly cookies = new Map<string, string>();

  async request(url: string, body?: URLSearchParams): Promise<Response> {
    const headers = new Headers({ cookie: [...this.cookies.values()].join('; '), connection: 'close' });
    if (body) {
      headers.set('content-type', 'application/x-www-form-urlencoded');
      headers.set('origin', new URL(url).origin);
    }
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', headers, redirect: 'manual',
      ...(body ? { body } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const value = cookie.split(';')[0]!;
      const name = value.slice(0, value.indexOf('='));
      if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }

  async follow(response: Response): Promise<Response> {
    for (let redirects = 0; redirects < 12 && response.status >= 300 && response.status < 400; redirects++) {
      const target = new URL(response.headers.get('location')!, response.url).href;
      if (target.startsWith(callback)) return response;
      response = await this.request(target);
    }
    return response;
  }
}

export function formValue(html: string, name: string): string {
  const result = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
  assert.ok(result, `form contains ${name}`);
  return result[1]!;
}

export async function fixture(overrides: Partial<IdentityConfig> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'oh-share-it-identity-'));
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const issuer = `http://127.0.0.1:${port}`;
  const config: IdentityConfig = {
    issuer, port, host: '127.0.0.1', databasePath: join(directory, 'identity.sqlite'),
    allowLoopbackHttp: true, trustProxy: false,
    identityResource: `${issuer}/api`,
    resources: [
      { resource: `${issuer}/api`, scopes: ['identity:read'] },
      { resource: `${issuer}/mcp`, scopes: ['materials:read'] },
    ],
    clients: [
      { clientId, name: '认证验收客户端', redirectUris: [callback],
        resources: [`${issuer}/api`, `${issuer}/mcp`], scopes: ['openid', 'identity:read', 'materials:read'] },
      { clientId: 'another-client', name: '另一个工作客户端', redirectUris: [callback],
        resources: [`${issuer}/api`], scopes: ['openid', 'identity:read'] },
    ],
    accessTokenTtl: 300, sessionTtl: 3600, grantTtl: 3600,
    ...overrides,
  };
  const configFile = join(directory, 'config.json');
  const accountsFile = join(directory, 'accounts.json');
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  await writeFile(accountsFile, JSON.stringify([
    { username: 'admin', password: 'Admin-test-password-2026' },
    { username: 'alice', password: alicePassword },
    { username: 'bob', password: bobPassword },
  ]), { mode: 0o600 });
  const provision = () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/identity/provision.ts',
      '--config', configFile, '--accounts', accountsFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const accounts: { username: string; account_id: string; created: boolean }[] = JSON.parse(result.stdout);
    return accounts;
  };
  const accounts = provision();
  let service: Awaited<ReturnType<typeof startIdentityService>> | undefined = await startIdentityService(config);
  const stop = async () => { if (service) { await service.close(); service = undefined; } };
  return {
    config, configFile, accounts, provision, stop,
    async restart(changes: Partial<IdentityConfig> = {}) { await stop(); service = await startIdentityService({ ...config, ...changes }); },
    async close() { await stop(); await rm(directory, { recursive: true, force: true }); },
  };
}

export function authorizationRequest(config: IdentityConfig, changes: Record<string, string> = {}) {
  const verifier = randomBytes(32).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: callback, response_type: 'code',
    scope: 'openid identity:read', resource: config.identityResource,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256', state: 'acceptance-state', ...changes,
  });
  return { url: `${config.issuer}/auth?${params}`, verifier };
}

export async function authorizationCode(config: IdentityConfig, browser = new BrowserClient(),
  changes: Record<string, string> = {}, username = 'alice', password = alicePassword) {
  const request = authorizationRequest(config, changes);
  let response = await browser.follow(await browser.request(request.url));
  let html = await response.text();
  if (html.includes('name="password"')) {
    response = await browser.follow(await browser.request(`${response.url}/login`, new URLSearchParams({
      username, password, csrf: formValue(html, 'csrf'),
    })));
    html = await response.text();
  }
  if (html.includes('value="confirm"')) {
    response = await browser.follow(await browser.request(`${response.url}/confirm`, new URLSearchParams({
      csrf: formValue(html, 'csrf'),
    })));
  }
  const target = new URL(response.headers.get('location')!, response.url);
  assert.equal(target.origin + target.pathname, callback, `authorization result: ${target} ${html}`);
  assert.equal(target.searchParams.get('state'), 'acceptance-state');
  assert.ok(target.searchParams.get('code'), `authorization succeeded: ${target}`);
  return { code: target.searchParams.get('code')!, verifier: request.verifier, browser };
}

export async function exchangeCode(config: IdentityConfig, code: string, verifier: string,
  changes: Record<string, string> = {}) {
  return fetch(`${config.issuer}/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId,
      redirect_uri: callback, code, code_verifier: verifier, resource: config.identityResource, ...changes }),
  });
}

export async function authorized(config: IdentityConfig, browser = new BrowserClient(),
  changes: Record<string, string> = {}) {
  const result = await authorizationCode(config, browser, changes);
  const response = await exchangeCode(config, result.code, result.verifier,
    { ...(changes.resource ? { resource: changes.resource } : {}),
      ...(changes.client_id ? { client_id: changes.client_id } : {}) });
  assert.equal(response.status, 200, await response.clone().text());
  const token = z.object({ access_token: z.string(), token_type: z.string(), expires_in: z.number(),
    scope: z.string(), id_token: z.string() }).parse(await response.json());
  return { ...token, browser: result.browser };
}

export function identity(config: IdentityConfig, token?: string, query = '') {
  return fetch(`${config.issuer}/api/identity${query}`, {
    headers: { connection: 'close', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}
