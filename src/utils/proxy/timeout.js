const PROXY_TIMEOUT_MS = Number(process.env.HOMEPAGE_PROXY_TIMEOUT || 30000);

let configured = false;

export function proxyTimeoutMs() {
  return PROXY_TIMEOUT_MS;
}

export function configureUndiciProxyTimeout() {
  if (configured || PROXY_TIMEOUT_MS <= 0) {
    return;
  }

  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const undici = require("undici");
    if (undici?.setGlobalDispatcher && undici.Agent) {
      undici.setGlobalDispatcher(
        new undici.Agent({
          connections: 64,
          connect: { timeout: Math.min(PROXY_TIMEOUT_MS, 10000) },
          bodyTimeout: PROXY_TIMEOUT_MS,
          headersTimeout: PROXY_TIMEOUT_MS,
          keepAliveTimeout: 30000,
          keepAliveMaxTimeout: 60000,
        }),
      );
      configured = true;
    }
  } catch (_) {
    // undici may be unavailable; http(s) agent timeout is enough for widgets
  }
}

configureUndiciProxyTimeout();
