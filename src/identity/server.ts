import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import Provider, { errors } from 'oidc-provider';
import type { Configuration } from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { z } from 'zod';
import { validateConfig } from './config.js';
import type { IdentityConfig } from './config.js';
import { openIdentityStore, sqliteAdapter } from './store.js';
import { Accounts } from './accounts.js';
import { bearerAuthentication, AuthenticationError } from './authentication.js';

function html(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${title}</title><body><h1>${title}</h1>${body}</body></html>`;
}

class InvalidInteraction extends Error {}

export async function startIdentityService(input: IdentityConfig) {
  const config = validateConfig(input);
  const database = openIdentityStore(config.databasePath);
  const accounts = new Accounts(database);
  const previousIssuer = database.prepare<[], { value: string }>("SELECT value FROM settings WHERE key='issuer'").get();
  if (previousIssuer && previousIssuer.value !== config.issuer) {
    database.close();
    throw new Error('identity storage belongs to a different issuer');
  }
  database.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('issuer',?)").run(config.issuer);
  let keys = database.prepare<[], { value: string }>("SELECT value FROM settings WHERE key='keys'").get()?.value;
  if (!keys) {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    keys = JSON.stringify({ cookieKey: randomBytes(32).toString('hex'),
      jwks: { keys: [{ ...await exportJWK(privateKey), kid: randomUUID(), use: 'sig', alg: 'RS256' }] } });
    database.prepare("INSERT INTO settings (key,value) VALUES ('keys',?)").run(keys);
  }
  const keyMaterial = JSON.parse(keys);
  const configuration: Configuration = {
    adapter: sqliteAdapter(database), jwks: keyMaterial.jwks,
    scopes: [...new Set(['openid', ...config.resources.flatMap((resource) => resource.scopes)])],
    cookies: { keys: [keyMaterial.cookieKey], long: { sameSite: 'lax' }, short: { sameSite: 'lax' } },
    clients: config.clients.map((client) => ({ client_id: client.clientId, client_name: client.name,
      redirect_uris: client.redirectUris, response_types: ['code'], grant_types: ['authorization_code'],
      token_endpoint_auth_method: 'none', scope: client.scopes.join(' ') })),
    pkce: { required: () => true },
    revokeGrantPolicy: () => true,
    ttl: { AccessToken: config.accessTokenTtl, IdToken: config.accessTokenTtl, Session: config.sessionTtl, Grant: config.grantTtl,
      Interaction: 600, AuthorizationCode: 60 },
    features: {
      pushedAuthorizationRequests: { enabled: false },
      userinfo: { enabled: false },
      devInteractions: { enabled: false }, revocation: { enabled: true,
        allowedPolicy: (_ctx, client, token) => client.clientId === token.clientId },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => { throw new errors.InvalidTarget('resource is required'); },
        getResourceServerInfo: (ctx, indicator, client) => {
          if (ctx.oidc.route === 'token' && !ctx.oidc.params?.resource) {
            throw new errors.InvalidTarget('resource is required');
          }
          const resource = config.resources.find((entry) => entry.resource === indicator);
          const allowedClient = config.clients.find((entry) => entry.clientId === client.clientId);
          if (!resource || !allowedClient?.resources.includes(indicator)) throw new errors.InvalidTarget();
          return { scope: resource.scopes.filter((scope) => allowedClient.scopes.includes(scope)).join(' '),
            audience: indicator, accessTokenFormat: 'opaque', accessTokenTTL: config.accessTokenTtl };
        },
      },
      rpInitiatedLogout: { enabled: true,
        logoutSource: (ctx, form) => { ctx.body = page('退出登录', `${form}<button type="submit" form="op.logoutForm" name="logout" value="yes">退出登录</button>`); },
        postLogoutSuccessSource: (ctx) => { ctx.body = page('已退出登录', '<p>浏览器登录会话已结束。</p>'); },
      },
    },
    interactions: { url: (_ctx, interaction) => `/interaction/${interaction.uid}` },
    findAccount: (_ctx, id) => {
      const account = accounts.find(id);
      return account ? { accountId: account.account_id, claims: () => ({ sub: account.account_id }) } : undefined;
    },
    renderError: (ctx, output) => { ctx.type = 'application/json'; ctx.body = { error: output.error }; },
  };
  const provider = new Provider(config.issuer, configuration);
  provider.proxy = config.trustProxy;
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set('cache-control', 'no-store'); next(); });
  const csrf = (uid: string) => createHmac('sha256', keyMaterial.cookieKey).update(uid).digest('hex');
  const validCsrf = (uid: string, input: unknown) => {
    const expected = Buffer.from(csrf(uid));
    const received = Buffer.from(typeof input === 'string' ? input : '');
    return received.length === expected.length && timingSafeEqual(received, expected);
  };
  const body = express.urlencoded({ extended: false, limit: '8kb' });
  const interactionDetails = async (req: Request, res: Response) => {
    const interaction = await provider.interactionDetails(req, res);
    if (interaction.uid !== req.params.uid) throw new InvalidInteraction();
    return interaction;
  };

  app.get('/auth', (req, res, next) => {
    const client = config.clients.find((entry) => entry.clientId === req.query.client_id);
    const resource = config.resources.find((entry) => entry.resource === req.query.resource);
    if (client && typeof req.query.scope === 'string') {
      const allowed = new Set(resource ? ['openid', ...resource.scopes] : client.scopes);
      const scopes = req.query.scope.split(' ').filter(Boolean);
      if (scopes.some((scope) => !client.scopes.includes(scope) || !allowed.has(scope))) {
        res.status(400).json({ error: 'invalid_scope' }); return;
      }
    }
    next();
  });

  app.get('/interaction/:uid', async (req, res) => {
    const interaction = await interactionDetails(req, res);
    const hidden = `<input type="hidden" name="csrf" value="${csrf(interaction.uid)}">`;
    if (interaction.prompt.name === 'login') {
      res.send(page('成员登录', `<form method="post" action="${html(req.path)}/login">${hidden}<label>登录名<input name="username" required autocomplete="username"></label><label>密码<input name="password" type="password" required autocomplete="current-password"></label><button>登录</button></form>`));
    } else if (interaction.prompt.name === 'consent') {
      const client = config.clients.find((entry) => entry.clientId === interaction.params.client_id)!;
      res.send(page('确认客户端授权', `<p>允许 ${html(client.name)} 使用你的账户访问 ${html(String(interaction.params.resource))}，权限：${html(String(interaction.params.scope))}。</p><form method="post" action="${html(req.path)}/confirm">${hidden}<button name="action" value="confirm">确认授权</button></form><form method="post" action="${html(req.path)}/deny">${hidden}<button>拒绝授权</button></form>`));
    } else { res.status(400).json({ error: 'unsupported_interaction' }); }
  });
  app.post('/interaction/:uid/login', body, async (req, res) => {
    const interaction = await interactionDetails(req, res);
    if (!validCsrf(interaction.uid, req.body.csrf)) {
      res.status(403).json({ error: 'invalid_csrf' }); return;
    }
    if (interaction.prompt.name !== 'login') throw new InvalidInteraction();
    const account = await accounts.authenticate(req.body.username, req.body.password);
    if (!account) { res.status(401).json({ error: 'invalid_credentials' }); return; }
    await provider.interactionFinished(req, res, { login: { accountId: account.account_id } }, { mergeWithLastSubmission: false });
  });
  app.post('/interaction/:uid/confirm', body, async (req, res) => {
    const interaction = await interactionDetails(req, res);
    if (!validCsrf(interaction.uid, req.body.csrf)) {
      res.status(403).json({ error: 'invalid_csrf' }); return;
    }
    if (interaction.prompt.name !== 'consent' || !interaction.session) {
      res.status(400).json({ error: 'invalid_interaction' }); return;
    }
    const grant = interaction.grantId ? await provider.Grant.find(interaction.grantId) :
      new provider.Grant({ accountId: interaction.session.accountId, clientId: String(interaction.params.client_id) });
    if (!grant) { res.status(400).json({ error: 'invalid_grant' }); return; }
    const details = interaction.prompt.details;
    if (details.missingOIDCScope) grant.addOIDCScope(z.array(z.string()).parse(details.missingOIDCScope).join(' '));
    if (details.missingResourceScopes) {
      for (const [resource, scopes] of Object.entries(z.record(z.string(), z.array(z.string())).parse(details.missingResourceScopes))) grant.addResourceScope(resource, scopes.join(' '));
    }
    await provider.interactionFinished(req, res, { consent: { grantId: await grant.save() } }, { mergeWithLastSubmission: true });
  });
  app.post('/interaction/:uid/deny', body, async (req, res) => {
    const interaction = await interactionDetails(req, res);
    if (!validCsrf(interaction.uid, req.body.csrf)) {
      res.status(403).json({ error: 'invalid_csrf' }); return;
    }
    await provider.interactionFinished(req, res, { error: 'access_denied' }, { mergeWithLastSubmission: false });
  });
  const authenticateBearer = bearerAuthentication(provider, accounts, config);
  app.get('/api/identity', async (req, res) => {
    const identity = await authenticateBearer(req.headers.authorization, config.identityResource, ['identity:read']);
    res.json({ account_id: identity.accountId, username: identity.username });
  });
  app.use(provider.callback());
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (res.headersSent) return;
    if (error instanceof AuthenticationError) {
      res.set('WWW-Authenticate', `Bearer error="${error.code}"`).status(error.status).json({ error: error.code });
      return;
    }
    if (error instanceof InvalidInteraction) { res.status(400).json({ error: 'invalid_interaction' }); return; }
    res.status(error instanceof errors.SessionNotFound ? 400 : 500).json({
      error: error instanceof errors.SessionNotFound ? 'interaction_expired' : 'server_error',
    });
  };
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, resolve);
    });
  } catch (error) { database.close(); throw error; }
  return { authenticateBearer, async close() {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  } };
}
