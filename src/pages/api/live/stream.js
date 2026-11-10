import { withAuth } from "utils/auth";
import { startLiveStatus } from "utils/live-status/boot";
import { liveStatusCache } from "utils/live-status/cache";
import { attachSse } from "utils/live-status/sse";
import { withApiMetrics } from "utils/metrics/api";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  await startLiveStatus();
  const prefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
  attachSse(req, res, liveStatusCache, { prefix });
}

export default withAuth(withApiMetrics("/api/live/stream", handler));
