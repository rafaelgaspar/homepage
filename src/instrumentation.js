import { applyNextAuthEnv } from "utils/env";
import { startMetricsServer } from "utils/metrics/server";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  applyNextAuthEnv();
  startMetricsServer();
}
