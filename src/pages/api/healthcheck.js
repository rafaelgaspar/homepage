import { withApiMetrics } from "utils/metrics/api";

function handler(req, res) {
  res.send("up");
}

export default withApiMetrics('/api/healthcheck', handler);
