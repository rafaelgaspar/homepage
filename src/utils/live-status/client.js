import { useEffect, useState, useSyncExternalStore } from "react";

const STREAM_URL = "/api/live/stream";

function emptySnapshot() {
  return { entries: {}, error: null, revision: 0 };
}

let snapshot = emptySnapshot();
const listeners = new Set();
let eventSource = null;

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

export function resetLiveStatusClientForTests() {
  teardown();
  listeners.clear();
  snapshot = emptySnapshot();
}

export function useLiveStatus(key, { fallbackUrl } = {}) {
  const live = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [fallback, setFallback] = useState();
  const [fallbackError, setFallbackError] = useState();

  useEffect(() => {
    if (!fallbackUrl || !key || live.entries[key]) {
      return undefined;
    }
    let cancelled = false;
    fetch(fallbackUrl, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }
        if (!response.ok && response.status !== 404) {
          throw new Error(`live status ${response.status}`);
        }
        setFallback(body);
        setFallbackError(undefined);
      })
      .catch((error) => {
        if (!cancelled) {
          setFallbackError(error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackUrl, key, live.entries, live.revision]);

  return {
    data: key ? (live.entries[key] ?? fallback) : undefined,
    error: live.error ?? fallbackError,
  };
}
