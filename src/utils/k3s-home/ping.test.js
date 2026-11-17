import { describe, expect, it, vi } from "vitest";

import { probeHost } from "./ping";

describe("k3s-home ping", () => {
  it("returns null when no host is given", async () => {
    await expect(probeHost("")).resolves.toBeNull();
  });

  it("returns alive/time from the probe", async () => {
    const probe = vi.fn(async () => ({ alive: true, time: 1.4 }));
    await expect(probeHost("192.168.2.41", probe)).resolves.toEqual({ alive: true, time: 1.4 });
  });

  it("returns down when the probe throws", async () => {
    const probe = vi.fn(async () => {
      throw new Error("nope");
    });
    await expect(probeHost("192.168.2.41", probe)).resolves.toEqual({ alive: false, time: null });
  });
});
