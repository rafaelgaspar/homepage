import { describe, expect, it } from "vitest";

import {
  kubernetesProbeFromQuery,
  kubernetesStatusKey,
  kubernetesStatusUrl,
  labelSelectorFor,
  parseKubernetesStatusKey,
} from "./status-probes";

describe("kubernetes status probes", () => {
  it("builds cache keys and URLs that include podSelector", () => {
    const service = { namespace: "ns", app: "app", podSelector: "x=y" };
    expect(kubernetesStatusKey(service)).toBe("k8s:ns/app?podSelector=x=y");
    expect(kubernetesStatusUrl(service)).toBe("/api/kubernetes/status/ns/app?podSelector=x=y");
    expect(parseKubernetesStatusKey("k8s:ns/app?podSelector=x=y")).toMatchObject({
      namespace: "ns",
      app: "app",
      podSelector: "x=y",
      labelSelector: "x=y",
    });
  });

  it("defaults the label selector to app.kubernetes.io/name", () => {
    expect(labelSelectorFor({ app: "homepage" })).toBe("app.kubernetes.io/name=homepage");
    expect(kubernetesStatusKey({ namespace: "homepage", app: "homepage" })).toBe("k8s:homepage/homepage");
  });

  it("parses API query parameters into a probe", () => {
    expect(kubernetesProbeFromQuery({ service: [] })).toBeNull();
    expect(kubernetesProbeFromQuery({ service: ["default", "app"], podSelector: "a=b" })).toEqual({
      namespace: "default",
      app: "app",
      podSelector: "a=b",
      labelSelector: "a=b",
      key: "k8s:default/app?podSelector=a=b",
    });
  });
});
