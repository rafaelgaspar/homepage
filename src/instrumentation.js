import { applyNextAuthEnv } from "utils/env";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  applyNextAuthEnv();
  void import("utils/live-status/boot").then(({ startLiveStatus }) => startLiveStatus());
}
