import { widgetsResponse } from "utils/config/api-response";
import { withApiMetrics } from "utils/metrics/api";

async function handler(req, res) {
  res.send(await widgetsResponse());
}

export default withApiMetrics('/api/widgets', handler);
