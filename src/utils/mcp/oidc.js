import { createTokenClient } from "oidc-remote";

import { recordMcpOidcToken } from "utils/metrics/mcp-oidc";

const clients = new Map();

export function oidcRemoteEnabled() {
  return Boolean(process.env.OIDC_REMOTE_TOKEN_URL?.trim());
}

export function tokenClientForGateway(hostname) {
  const tokenUrl = process.env.OIDC_REMOTE_TOKEN_URL?.trim();
  if (!tokenUrl) {
    throw new Error("OIDC_REMOTE_TOKEN_URL is not set");
  }
  let client = clients.get(hostname);
  if (!client) {
    client = createTokenClient({
      tokenUrl,
      clientId: hostname,
      assertionFile: process.env.OIDC_REMOTE_ASSERTION_FILE,
    });
    clients.set(hostname, client);
  }
  return client;
}

export async function getGatewayAccessToken(hostname) {
  const startedAt = process.hrtime.bigint();
  try {
    const token = await tokenClientForGateway(hostname).getAccessToken();
    recordMcpOidcToken("ok", Number(process.hrtime.bigint() - startedAt) / 1e9);
    return token;
  } catch (err) {
    recordMcpOidcToken("error", Number(process.hrtime.bigint() - startedAt) / 1e9);
    throw err;
  }
}
