export const DEFAULT_LIVE_STATUS_TTL_MS = 60_000;

function defaultTtlMs() {
  const parsed = Number(process.env.HOMEPAGE_LIVE_STATUS_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIVE_STATUS_TTL_MS;
}

function valuesEqual(left, right) {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function createLiveStatusCache({ defaultTtlMs: ttlMs, now = Date.now } = {}) {
  const entries = new Map();
  const listeners = new Set();
  const resolvedDefaultTtlMs = ttlMs ?? defaultTtlMs();

  function emit(event) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function expireKey(key, entry) {
    entries.delete(key);
    emit({ type: "expire", key, value: entry.value, previous: entry.value });
  }

  function isFresh(entry, at) {
    return entry.expiresAt > at;
  }

  return {
    get defaultTtlMs() {
      return resolvedDefaultTtlMs;
    },

    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (!isFresh(entry, now())) {
        expireKey(key, entry);
        return undefined;
      }
      return entry.value;
    },

    peek(key) {
      return entries.get(key)?.value;
    },

    has(key) {
      return this.get(key) !== undefined;
    },

    set(key, value, { ttlMs: entryTtlMs } = {}) {
      const at = now();
      const ttl = entryTtlMs ?? resolvedDefaultTtlMs;
      const previous = entries.get(key)?.value;
      const changed = !valuesEqual(previous, value);
      entries.set(key, {
        value,
        updatedAt: at,
        expiresAt: at + ttl,
      });
      if (changed) {
        emit({ type: "set", key, value, previous });
      }
      return changed;
    },

    touch(key, { ttlMs: entryTtlMs } = {}) {
      const entry = entries.get(key);
      if (!entry) {
        return false;
      }
      const at = now();
      if (!isFresh(entry, at)) {
        expireKey(key, entry);
        return false;
      }
      entry.expiresAt = at + (entryTtlMs ?? resolvedDefaultTtlMs);
      return true;
    },

    delete(key) {
      const entry = entries.get(key);
      if (!entry) {
        return false;
      }
      entries.delete(key);
      emit({ type: "delete", key, value: undefined, previous: entry.value });
      return true;
    },

    sweep() {
      const at = now();
      for (const [key, entry] of entries) {
        if (!isFresh(entry, at)) {
          expireKey(key, entry);
        }
      }
    },

    snapshot({ prefix } = {}) {
      const at = now();
      const out = {};
      for (const [key, entry] of entries) {
        if (prefix && !key.startsWith(prefix)) {
          continue;
        }
        if (!isFresh(entry, at)) {
          expireKey(key, entry);
          continue;
        }
        out[key] = entry.value;
      }
      return out;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}

export const liveStatusCache = createLiveStatusCache();
