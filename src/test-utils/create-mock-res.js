import { Writable } from "node:stream";

import { vi } from "vitest";

export default function createMockRes() {
  const state = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  const res = new Writable({
    write(chunk, _enc, cb) {
      const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      state.body = state.body ? Buffer.concat([Buffer.from(state.body), next]) : next;
      cb();
    },
  });

  Object.defineProperties(res, {
    statusCode: {
      get: () => state.statusCode,
      set: (value) => {
        state.statusCode = value;
      },
      enumerable: true,
    },
    body: {
      get: () => state.body,
      set: (value) => {
        state.body = value;
      },
      enumerable: true,
    },
    headers: {
      get: () => state.headers,
      enumerable: true,
    },
  });

  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });

  res.send = vi.fn((body) => {
    res.body = body;
    return res;
  });

  const originalEnd = res.end.bind(res);
  res.end = vi.fn((body) => {
    if (body !== undefined && body !== null) {
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        res.body = body;
      } else {
        res.write(body);
      }
    }
    return originalEnd();
  });

  res.setHeader = vi.fn((key, value) => {
    state.headers[key] = value;
    return res;
  });

  return res;
}
