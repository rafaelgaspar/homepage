import { withAuth } from "utils/auth";
import { bookmarksResponse } from "utils/config/api-response";
import { withApiMetrics } from "utils/metrics/api";

async function handler(req, res) {
  res.send(await bookmarksResponse());
}

export default withAuth(withApiMetrics("/api/bookmarks", handler));
