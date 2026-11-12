import { recordLiveStatusSseConnect, recordLiveStatusSseDisconnect } from "utils/metrics/live-status";

export const LIVE_STATUS_HEARTBEAT_MS = 20_000;

export function initSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeSseComment(res, comment) {
  res.write(`: ${comment}\n\n`);
  res.flush?.();
}

export function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.flush?.();
}

export function attachSse(req, res, cache, { prefix, heartbeatMs = LIVE_STATUS_HEARTBEAT_MS } = {}) {
  initSse(res);
  writeSseComment(res, "connected");
  writeSseEvent(res, "snapshot", { entries: cache.snapshot({ prefix }) });

  const unsubscribe = cache.subscribe((event) => {
    if (prefix && !event.key.startsWith(prefix)) {
      return;
    }
    writeSseEvent(res, event.type, { key: event.key, value: event.value ?? null });
  });

  const timer = setInterval(() => {
    cache.sweep();
    writeSseComment(res, "ping");
  }, heartbeatMs);

  recordLiveStatusSseConnect();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    clearInterval(timer);
    unsubscribe();
    recordLiveStatusSseDisconnect();
  };

  req.on("close", cleanup);
  req.on("end", cleanup);
  return cleanup;
}
