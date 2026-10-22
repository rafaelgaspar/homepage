import { withAuth } from "utils/auth";
import { servicesResponse } from "utils/config/api-response";
import { withApiMetrics } from "utils/metrics/api";

async function handler(req, res) {
  res.send(await servicesResponse());
}

export default withAuth(withApiMetrics("/api/services", handler));
