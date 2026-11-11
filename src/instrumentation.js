import { applyNextAuthEnv } from "utils/env";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  applyNextAuthEnv();
  return Promise.all([import("utils/mcp/cache"), import("utils/live-status/boot")]).then(([, { startLiveStatus }]) =>
    startLiveStatus(),
  );
}
