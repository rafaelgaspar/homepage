// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLiveStatusClientForTests, useLiveStatus } from "./client";

class FakeEventSource {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = {};
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, cb) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(cb);
  }

  close() {
    this.closed = true;
  }

  emit(type, data) {
    for (const cb of this.listeners[type] ?? []) {
      cb({ data: JSON.stringify(data) });
    }
  }
}

describe("useLiveStatus", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    resetLiveStatusClientForTests();
  });

  afterEach(() => {
    resetLiveStatusClientForTests();
    vi.unstubAllGlobals();
  });

  it("opens one EventSource and updates when a set event arrives", async () => {
    const { result } = renderHook(() => useLiveStatus("k8s:ns/app"));
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe("/api/live/stream");
    source.emit("snapshot", { entries: { "k8s:ns/app": { status: "running" } } });

    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "running" });
    });

    source.emit("set", { key: "k8s:ns/app", value: { status: "down" } });
    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "down" });
    });
  });
});
