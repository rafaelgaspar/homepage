import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listLiveStatusSources,
  registerLiveStatusSource,
  resetLiveStatusSourcesForTests,
  sourceForKey,
  startAllSources,
} from "./sources";

describe("live-status sources", () => {
  afterEach(() => {
    resetLiveStatusSourcesForTests();
  });

  it("registers sources by prefix and starts them", async () => {
    const start = vi.fn(async () => {});
    registerLiveStatusSource({ prefix: "k8s:", start });
    registerLiveStatusSource({ prefix: "mcp:" });

    expect(sourceForKey("k8s:ns/app")?.prefix).toBe("k8s:");
    expect(listLiveStatusSources()).toHaveLength(2);

    await startAllSources();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("replaces a source that reuses a prefix", () => {
    registerLiveStatusSource({ prefix: "k8s:", id: 1 });
    registerLiveStatusSource({ prefix: "k8s:", id: 2 });
    expect(listLiveStatusSources()).toEqual([{ prefix: "k8s:", id: 2 }]);
  });
});
