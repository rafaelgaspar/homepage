import createLogger from "utils/logger";
import { refreshAll, refreshOne } from "utils/mcp/cache";

const logger = createLogger("mcpMonitor");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const force = req.query.refresh === "1";

    if (req.query.id) {
      const result = await refreshOne(req.query.id, force);
      if (!result) {
        return res.status(404).json({ error: "unknown probe" });
      }
      return res.status(200).json(result);
    }

    return res.status(200).json(await refreshAll(force));
  } catch (err) {
    logger.error("MCP monitor refresh failed: %s", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
