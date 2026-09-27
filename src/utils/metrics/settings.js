import { getSettings } from "utils/config/config";

const DEFAULT_METRICS_PORT = 9090;
const DEFAULT_METRICS_PATH = "/metrics";

export function getMetricsSettings() {
  const { metrics } = getSettings() ?? {};
  const port = Number(metrics?.port ?? DEFAULT_METRICS_PORT);
  const path = metrics?.path ?? DEFAULT_METRICS_PATH;
  return {
    enabled: metrics?.enabled === true,
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? port : DEFAULT_METRICS_PORT,
    path: path.startsWith("/") ? path : `/${path}`,
  };
}

export function isMetricsEnabled() {
  return getMetricsSettings().enabled;
}
