import "utils/kubernetes/watch-manager";

import { startAllSources, stopAllSources } from "utils/live-status/sources";
import createLogger from "utils/logger";

const logger = createLogger("liveStatus");

export async function startLiveStatus() {
  try {
    await startAllSources();
  } catch (err) {
    logger.error("live-status start failed: %s", err);
  }
}

export async function stopLiveStatus() {
  await stopAllSources();
}
