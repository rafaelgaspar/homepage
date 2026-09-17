import { applyNextAuthEnv } from "utils/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  applyNextAuthEnv();
  const { startMetricsServer } = await import("utils/metrics/server");
  startMetricsServer();
}
