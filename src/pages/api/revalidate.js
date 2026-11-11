import { withAuth } from "utils/auth";
import { invalidateDashboardData } from "utils/config/dashboard";
import { withApiMetrics } from "utils/metrics/api";

async function handler(req, res) {
  invalidateDashboardData();
  return res.json({ revalidated: true });
}

export default withAuth(withApiMetrics("/api/revalidate", handler));
