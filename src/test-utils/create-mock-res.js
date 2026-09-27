import { vi } from "vitest";

export default function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
  };

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

  res.write = vi.fn((chunk) => {
    const next = Buffer.from(chunk);
    res.body = res.body ? Buffer.concat([Buffer.from(res.body), next]) : next;
    return true;
  });

  res.end = vi.fn((body) => {
    if (body !== undefined && body !== null) {
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        res.body = body;
      } else {
        res.write(body);
      }
    }
    if (typeof res._onFinish === "function") {
      res._onFinish();
    }
    return res;
  });

  res.on = vi.fn((event, cb) => {
    if (event === "finish") {
      res._onFinish = cb;
    }
    if (event === "close") {
      res._onClose = cb;
    }
    return res;
  });

  res.once = vi.fn((event, cb) => res.on(event, cb));

  res.setHeader = vi.fn((key, value) => {
    res.headers[key] = value;
    return res;
  });

  return res;
}
