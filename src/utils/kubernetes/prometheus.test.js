import { describe, expect, it } from "vitest";

import { buildPodNameRegex, escapePromRegexLiteral, escapePrometheusLabelValue } from "./prometheus";

describe("utils/kubernetes/prometheus", () => {
  it("escapes regex metacharacters in pod names", () => {
    expect(escapePromRegexLiteral("pod.name+1")).toBe("pod\\.name\\+1");
  });

  it("escapes double quotes in prometheus label values", () => {
    expect(escapePrometheusLabelValue('ns"test')).toBe('ns\\"test');
  });

  it("builds alternation regex for multiple pods", () => {
    expect(buildPodNameRegex(["a", "b"])).toBe("a|b");
    expect(buildPodNameRegex(["a", "a", ""])).toBe("a");
    expect(buildPodNameRegex([])).toBeNull();
  });
});
