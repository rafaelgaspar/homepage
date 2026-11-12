import { useEffect, useState, useSyncExternalStore } from "react";

const STREAM_URL = "/api/live/stream";

export const FALLBACK_BACKOFF_INITIAL_MS = 1_000;
export const FALLBACK_BACKOFF_MAX_MS = 64_000;

function emptySnapshot() {
  return { entries: {}, error: null, revision: 0 };
}

let snapshot = emptySnapshot();
const listeners = new Set();
let eventSource = null;
const inFlight = new Map();
const fallbackState = new Map();

function nextBackoffMs(attempt) {
  return Math.min(FALLBACK_BACKOFF_MAX_MS, FALLBACK_BACKOFF_INITIAL_MS * 2 ** attempt);
}

function emit() {
  snapshot = { ...snapshot, revision: snapshot.revision + 1 };
  for (const listener of listeners) {
    listener();
  }
}

function applySnapshot(entries) {
  snapshot = {
    entries: entries && typeof entries === "object" ? { ...entries } : {},
    error: null,
    revision: snapshot.revision + 1,
  };
  for (const listener of listeners) {
    listener();
  }
}

function applyEvent(type, payload) {
  const key = payload?.key;
  if (!key) {
    return;
  }
  const entries = { ...snapshot.entries };
  if (type === "delete" || type === "expire") {
    delete entries[key];
  } else {
    entries[key] = payload.value;
  }
  snapshot = { entries, error: null, revision: snapshot.revision + 1 };
  for (const listener of listeners) {
    listener();
  }
}

function teardown() {
  eventSource?.close();
  eventSource = null;
}

function ensureStream() {
  if (eventSource || typeof EventSource === "undefined") {
    return;
  }
  const source = new EventSource(STREAM_URL, { withCredentials: true });
  eventSource = source;
  source.addEventListener("snapshot", (event) => {
    try {
      applySnapshot(JSON.parse(event.data).entries);
    } catch {
      snapshot = { ...snapshot, error: new Error("live status snapshot failed") };
      emit();
    }
  });
  for (const type of ["set", "delete", "expire"]) {
    source.addEventListener(type, (event) => {
      try {
        applyEvent(type, JSON.parse(event.data));
      } catch {
        snapshot = { ...snapshot, error: new Error("live status event failed") };
        emit();
      }
    });
  }
  source.onerror = () => {
    snapshot = { ...snapshot, error: new Error("live status stream failed") };
    emit();
  };
}

function subscribe(listener) {
  listeners.add(listener);
  ensureStream();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardown();
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function fetchFallback(url) {
  const existing = inFlight.get(url);
  if (existing) {
    return existing;
  }

  const promise = fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`live status ${response.status}`);
      }
      fallbackState.set(url, { succeeded: true, attempt: 0 });
      return body;
    })
    .catch((error) => {
      const prev = fallbackState.get(url);
      const attempt = prev?.succeeded ? 0 : (prev?.attempt ?? 0);
      fallbackState.set(url, { succeeded: false, attempt: attempt + 1 });
      throw error;
    })
    .finally(() => {
      if (inFlight.get(url) === promise) {
        inFlight.delete(url);
      }
    });

  inFlight.set(url, promise);
  return promise;
}

export function resetLiveStatusClientForTests() {
  teardown();
  listeners.clear();
  snapshot = emptySnapshot();
  inFlight.clear();
  fallbackState.clear();
}

export function useLiveStatus(key, { fallbackUrl } = {}) {
  const live = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const liveValue = key ? live.entries[key] : undefined;
  const [fallback, setFallback] = useState();
  const [fallbackError, setFallbackError] = useState();

  useEffect(() => {
    if (!fallbackUrl || !key || liveValue || fallbackState.get(fallbackUrl)?.succeeded) {
      return undefined;
    }

    let cancelled = false;
    let timer;

    const run = () => {
      fetchFallback(fallbackUrl)
        .then((body) => {
          if (!cancelled) {
            setFallback(body);
            setFallbackError(undefined);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setFallbackError(error);
          const attempt = fallbackState.get(fallbackUrl)?.attempt ?? 1;
          timer = setTimeout(run, nextBackoffMs(attempt - 1));
        });
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fallbackUrl, key, liveValue]);

  return {
    data: key ? (liveValue ?? fallback) : undefined,
    error: live.error ?? fallbackError,
  };
}
