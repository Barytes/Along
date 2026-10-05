import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { z } from 'zod';
import { authorized, authorizationCode, authorizationRequest, BrowserClient, exchangeCode, fixture, formValue, identity } from './test-client.js';

test('成员通过浏览器登录、确认授权和 PKCE 取得对应的稳定账户身份', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const discovery = await fetch(`${app.config.issuer}/.well-known/oauth-authorization-server`);
  assert.equal(discovery.status, 200);
  const metadata = z.object({ issuer: z.string(), code_challenge_methods_supported: z.array(z.string()) }).parse(await discovery.json());
  assert.equal(metadata.issuer, app.config.issuer);
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
  const token = await authorized(app.config);
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), {
    account_id: app.accounts.find((account) => account.username === 'alice')!.account_id,
    username: 'alice',
  });
});

test('为 MCP 服务签发的凭证不能用于身份服务', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config, undefined, {
    resource: `${app.config.issuer}/mcp`, scope: 'openid materials:read',
  });
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'invalid_token' });
  await app.restart();
  assert.equal((await identity(app.config, token.access_token)).status, 401);
});

test('授权请求包含配置以外的权限时明确拒绝', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const request = authorizationRequest(app.config, { scope: 'openid identity:read admin:write' });
  const browser = new BrowserClient();
  const response = await browser.follow(await browser.request(request.url));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_scope' });
});

test('身份接口拒绝缺失或错误凭证，账户参数不能代替登录身份', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const bob = app.accounts.find((account) => account.username === 'bob')!;
  for (const token of [undefined, 'not-a-real-token']) {
    const response = await identity(app.config, token, `?account_id=${bob.account_id}`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid_token' });
    assert.match(response.headers.get('www-authenticate')!, /Bearer/);
  }
  const token = await authorized(app.config);
  const response = await identity(app.config, token.access_token, `?account_id=${bob.account_id}&username=bob`);
  assert.deepEqual(await response.json(), {
    account_id: app.accounts.find((account) => account.username === 'alice')!.account_id, username: 'alice',
  });
});

test('错误密码返回可识别结果且不建立登录会话', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const browser = new BrowserClient();
  const request = authorizationRequest(app.config);
  const login = await browser.follow(await browser.request(request.url));
  const html = await login.text();
  const response = await browser.request(`${login.url}/login`, new URLSearchParams({
    username: 'alice', password: 'wrong-password', csrf: formValue(html, 'csrf'),
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'invalid_credentials' });
  const silent = authorizationRequest(app.config, { prompt: 'none' });
  const result = await browser.follow(await browser.request(silent.url));
  const target = new URL(result.headers.get('location')!, result.url);
  assert.equal(target.searchParams.get('error'), 'login_required');
});

test('访问令牌过期后不能查询身份', async (t) => {
  const app = await fixture({ accessTokenTtl: 1 });
  t.after(() => app.close());
  const token = await authorized(app.config);
  assert.equal(token.expires_in, 1);
  assert.equal((await identity(app.config, token.access_token)).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'invalid_token' });
  await app.restart();
  assert.equal((await identity(app.config, token.access_token)).status, 401);
});

test('撤销客户端授权后同一授权的所有令牌都失效', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const first = await authorized(app.config);
  const second = await authorized(app.config, first.browser);
  const revoke = await fetch(`${app.config.issuer}/token/revocation`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'acceptance-client', token: first.access_token, token_type_hint: 'access_token' }),
  });
  assert.equal(revoke.status, 200, await revoke.text());
  assert.equal((await identity(app.config, first.access_token)).status, 401);
  assert.equal((await identity(app.config, second.access_token)).status, 401);
  const request = authorizationRequest(app.config);
  const consent = await first.browser.follow(await first.browser.request(request.url));
  assert.match(await consent.text(), /确认客户端授权/);
});

test('账户、浏览器会话与有效凭证在服务重启后保持一致', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config);
  const before = await (await identity(app.config, token.access_token)).json();
  const repeated = app.provision();
  assert.deepEqual(repeated.map(({ account_id, username }) => ({ account_id, username })),
    app.accounts.map(({ account_id, username }) => ({ account_id, username })));
  assert.ok(repeated.every((account) => !account.created));
  await app.restart();
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), before);
  const silent = authorizationRequest(app.config, { prompt: 'none' });
  const result = await token.browser.follow(await token.browser.request(silent.url));
  const target = new URL(result.headers.get('location')!, result.url);
  assert.ok(target.searchParams.get('code'));
});

test('浏览器退出结束登录并撤销该会话的授权，重启不会恢复访问', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config);
  const logout = await token.browser.request(`${app.config.issuer}/session/end`);
  const html = await logout.text();
  assert.match(html, /退出登录/);
  const target = html.match(/<form[^>]+action="([^"]+)"/)![1]!;
  const response = await token.browser.follow(await token.browser.request(target, new URLSearchParams({
    xsrf: formValue(html, 'xsrf'), logout: 'yes',
  })));
  assert.match(await response.text(), /已退出登录/);
  await app.restart();
  assert.equal((await identity(app.config, token.access_token)).status, 401);
  const request = authorizationRequest(app.config, { prompt: 'none' });
  const silent = await token.browser.follow(await token.browser.request(request.url));
  assert.equal(new URL(silent.headers.get('location')!, silent.url).searchParams.get('error'), 'login_required');
});

test('成员可以在浏览器拒绝客户端授权', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const browser = new BrowserClient();
  const request = authorizationRequest(app.config);
  const login = await browser.follow(await browser.request(request.url));
  const consent = await browser.follow(await browser.request(`${login.url}/login`, new URLSearchParams({
    username: 'alice', password: 'Alice-test-password-2026', csrf: formValue(await login.text(), 'csrf'),
  })));
  const html = await consent.text();
  assert.match(html, /拒绝授权/);
  const response = await browser.follow(await browser.request(`${consent.url}/deny`, new URLSearchParams({
    csrf: formValue(html, 'csrf'),
  })));
  const target = new URL(response.headers.get('location')!, response.url);
  assert.equal(target.searchParams.get('error'), 'access_denied');
  assert.equal(target.searchParams.get('code'), null);
});

test('浏览器提交必须属于当前交互并携带防跨站请求凭证', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const browser = new BrowserClient();
  const request = authorizationRequest(app.config);
  const login = await browser.follow(await browser.request(request.url));
  const html = await login.text();
  const missingCsrf = await browser.request(`${login.url}/login`, new URLSearchParams({
    username: 'alice', password: 'Alice-test-password-2026',
  }));
  assert.equal(missingCsrf.status, 403);
  assert.deepEqual(await missingCsrf.json(), { error: 'invalid_csrf' });
  const wrongInteraction = await browser.request(`${app.config.issuer}/interaction/wrong-interaction/login`,
    new URLSearchParams({ username: 'alice', password: 'Alice-test-password-2026', csrf: formValue(html, 'csrf') }));
  assert.equal(wrongInteraction.status, 400);
  assert.deepEqual(await wrongInteraction.json(), { error: 'invalid_interaction' });
});

test('OAuth 拒绝错误服务、无效客户端、未登记回调与缺失 PKCE', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const cases: { name: string; changes: Record<string, string>; remove: string; error: string }[] = [
    { name: '错误服务', changes: { resource: 'https://another-service.example/api' }, remove: '', error: 'invalid_target' },
    { name: '缺失服务', changes: {}, remove: 'resource', error: 'invalid_target' },
    { name: '无效客户端', changes: { client_id: 'unknown-client' }, remove: '', error: 'invalid_client' },
    { name: '未登记回调', changes: { redirect_uri: 'http://127.0.0.1:19999/unregistered' }, remove: '', error: 'invalid_redirect_uri' },
    { name: '缺失 PKCE', changes: {}, remove: 'code_challenge', error: 'invalid_request' },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const request = authorizationRequest(app.config, entry.changes);
      const url = new URL(request.url);
      if (entry.remove) url.searchParams.delete(entry.remove);
      const browser = new BrowserClient();
      const response = await browser.follow(await browser.request(url.href));
      if (response.headers.has('location')) {
        const target = new URL(response.headers.get('location')!, response.url);
        assert.equal(target.origin + target.pathname, 'http://127.0.0.1:19999/callback');
        assert.equal(target.searchParams.get('error'), entry.error);
      } else {
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: entry.error });
      }
    });
  }
});

test('授权码要求正确 PKCE 且使用后在重启期间仍不能重放', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const badProof = await authorizationCode(app.config);
  const rejected = await exchangeCode(app.config, badProof.code, 'x'.repeat(43));
  assert.equal(rejected.status, 400);
  assert.equal(z.object({ error: z.string() }).parse(await rejected.json()).error, 'invalid_grant');
  const request = await authorizationCode(app.config);
  const accepted = await exchangeCode(app.config, request.code, request.verifier);
  assert.equal(accepted.status, 200);
  await app.restart();
  const replay = await exchangeCode(app.config, request.code, request.verifier);
  assert.equal(replay.status, 400);
  assert.equal(z.object({ error: z.string() }).parse(await replay.json()).error, 'invalid_grant');
});

test('身份服务可以通过独立入口启动并正常关闭', { timeout: 10000 }, async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  await app.stop();
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/identity/main.ts', '--config', app.configFile]);
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  let stderr = '';
  child.stderr.on('data', (value: Buffer) => { stderr += value.toString(); });
  const exited = once(child, 'exit');
  await new Promise<void>((resolve, reject) => {
    let output = '';
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`startup exited ${code}: ${stderr}`)));
    child.stdout.on('data', (value: Buffer) => {
      output += value.toString();
      if (output.includes('"status":"ready"')) resolve();
    });
  });
  const response = await fetch(`${app.config.issuer}/.well-known/oauth-authorization-server`, { headers: { connection: 'close' } });
  assert.equal(response.status, 200);
  child.kill('SIGTERM');
  assert.deepEqual(await exited, [0, null]);
});

test('目标服务正确但缺少身份读取权限的凭证不能查询身份', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config, undefined, { scope: 'openid' });
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'insufficient_scope' });
});

test('同一账户使用不同客户端保持身份，不同账户返回各自身份', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const first = await authorized(app.config);
  const another = await authorized(app.config, undefined, { client_id: 'another-client' });
  assert.deepEqual(await (await identity(app.config, first.access_token)).json(),
    await (await identity(app.config, another.access_token)).json());
  const bob = await authorizationCode(app.config, undefined, {}, 'bob', 'Bob-test-password-2026');
  const response = await exchangeCode(app.config, bob.code, bob.verifier);
  assert.equal(response.status, 200);
  const token = z.object({ access_token: z.string() }).parse(await response.json());
  assert.deepEqual(await (await identity(app.config, token.access_token)).json(), {
    account_id: app.accounts.find((account) => account.username === 'bob')!.account_id, username: 'bob',
  });
});

test('客户端不能撤销另一个客户端的授权', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config);
  const response = await fetch(`${app.config.issuer}/token/revocation`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: new URLSearchParams({ client_id: 'another-client', token: token.access_token }),
  });
  assert.equal(response.status, 200);
  assert.equal((await identity(app.config, token.access_token)).status, 200);
});

test('仅启用当前 OAuth 公开入口，PAR 不能绕过权限范围检查', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const request = authorizationRequest(app.config, { scope: 'openid identity:read admin:write' });
  const params = new URL(request.url).searchParams;
  const pushed = await fetch(`${app.config.issuer}/request`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: params,
  });
  assert.equal(pushed.status, 404);
  const discovery = z.record(z.string(), z.unknown()).parse(await
    (await fetch(`${app.config.issuer}/.well-known/oauth-authorization-server`)).json());
  assert.equal(discovery.pushed_authorization_request_endpoint, undefined);
});

test('令牌交换必须指定资源且不提供额外 UserInfo 读取入口', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const request = await authorizationCode(app.config);
  const response = await fetch(`${app.config.issuer}/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'acceptance-client',
      redirect_uri: 'http://127.0.0.1:19999/callback', code: request.code, code_verifier: request.verifier }),
  });
  assert.equal(response.status, 400);
  assert.equal(z.object({ error: z.string() }).parse(await response.json()).error, 'invalid_target');
  assert.equal((await fetch(`${app.config.issuer}/me`)).status, 404);
});

test('配置收回客户端的服务范围后已有凭证不能继续访问该服务', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const token = await authorized(app.config);
  assert.equal((await identity(app.config, token.access_token)).status, 200);
  await app.restart({ clients: app.config.clients.map((client) => client.clientId === 'acceptance-client'
    ? { ...client, resources: [`${app.config.issuer}/mcp`], scopes: ['openid', 'materials:read'] } : client) });
  const response = await identity(app.config, token.access_token);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'invalid_token' });
});
