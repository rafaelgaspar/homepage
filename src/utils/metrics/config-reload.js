import { isMetricsEnabled } from "./settings";

/**
 * @param {"success" | "failure"} result
 */
export function emitConfigReloadMetric(result) {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getConfigReloadCounter }) => {
    getConfigReloadCounter().inc({ result });
  });
}
