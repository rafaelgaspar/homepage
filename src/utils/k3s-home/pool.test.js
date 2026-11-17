import { describe, expect, it } from "vitest";

import { poolFromTaints, taintKey } from "./pool";

describe("k3s-home pool", () => {
  it("parses the taint key before value and effect", () => {
    expect(taintKey("scheduling.rafaelgaspar.xyz/reserved=true:PreferNoSchedule")).toBe(
      "scheduling.rafaelgaspar.xyz/reserved",
    );
  });

  it("maps older-node and reserved taints, otherwise free-pool", () => {
    expect(poolFromTaints(["scheduling.rafaelgaspar.xyz/older-node=true:PreferNoSchedule"])).toBe("older-node");
    expect(poolFromTaints(["scheduling.rafaelgaspar.xyz/reserved=true:PreferNoSchedule"])).toBe("reserved");
    expect(poolFromTaints([])).toBe("free-pool");
    expect(poolFromTaints(["unrelated=true:NoSchedule"])).toBe("free-pool");
  });
});
