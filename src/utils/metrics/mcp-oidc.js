import { isMetricsEnabled } from "./settings";

export function recordMcpOidcToken(result, durationSeconds) {
  if (!isMetricsEnabled() || !result) {
    return;
  }
  void import("./registry").then(({ getMcpOidcTokenCounter, getMcpOidcTokenDurationHistogram }) => {
    getMcpOidcTokenCounter().inc({ result });
    if (Number.isFinite(durationSeconds)) {
      getMcpOidcTokenDurationHistogram().observe(durationSeconds);
    }
  });
}
