import type Provider from 'oidc-provider';
import type { Accounts } from './accounts.js';
import type { IdentityConfig } from './config.js';

export class AuthenticationError extends Error {
  constructor(readonly status: 401 | 403, readonly code: 'invalid_token' | 'insufficient_scope') {
    super(code);
  }
}

export interface AuthenticatedIdentity {
  accountId: string;
  username: string;
  clientId: string;
  resource: string;
  scopes: readonly string[];
}

export function bearerAuthentication(provider: Provider, accounts: Accounts, config: IdentityConfig) {
  return async function authenticateBearer(authorization: string | undefined, resource: string,
    requiredScopes: readonly string[]): Promise<AuthenticatedIdentity> {
    const match = authorization?.match(/^Bearer (\S+)$/i);
    const token = match ? await provider.AccessToken.find(match[1]!) : undefined;
    const account = token?.accountId ? accounts.find(token.accountId) : undefined;
    const client = config.clients.find((entry) => entry.clientId === token?.clientId);
    const allowedResource = config.resources.find((entry) => entry.resource === resource);
    if (!token || !token.clientId || !token.isValid || token.tokenType !== 'Bearer' || !account || token.aud !== resource
      || !allowedResource || !client?.resources.includes(resource)
      || !await provider.Grant.find(token.grantId)) {
      throw new AuthenticationError(401, 'invalid_token');
    }
    const scopes = (token.scope ?? '').split(' ').filter(Boolean);
    if (requiredScopes.some((scope) => !scopes.includes(scope) || !client.scopes.includes(scope)
      || !allowedResource.scopes.includes(scope))) throw new AuthenticationError(403, 'insufficient_scope');
    return { accountId: account.account_id, username: account.username, clientId: token.clientId,
      resource, scopes };
  };
}
