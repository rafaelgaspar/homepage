import { createTokenClient } from "oidc-remote";

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
