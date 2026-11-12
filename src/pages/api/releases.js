import { withAuth } from "utils/auth";
import createLogger from "utils/logger";
import { cachedRequest } from "utils/proxy/http";
import { withApiMetrics } from "utils/metrics/api";

const logger = createLogger("releases");

async function handler(req, res) {
  const releasesURL = "https://api.github.com/repos/gethomepage/homepage/releases";
  try {
    return res.send(await cachedRequest(releasesURL, 5));
  } catch (e) {
    logger.error(`Error checking GitHub releases: ${e}`);
    return res.send([]);
  }
}

export default withAuth(withApiMetrics("/api/releases", handler));
