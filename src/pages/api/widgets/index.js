import { withAuth } from "utils/auth";
import { widgetsResponse } from "utils/config/api-response";
import { withApiMetrics } from "utils/metrics/api";

async function handler(req, res) {
  res.send(await widgetsResponse());
}

export default withAuth(withApiMetrics("/api/widgets", handler));
