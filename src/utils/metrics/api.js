import { isMetricsEnabled } from "./settings";

/**
 * Wrap a Pages API handler to record request duration when metrics.enabled.
 *
 * @param {string} route Stable route template for labels (e.g. /api/kubernetes/stats/[...service])
 * @param {import("next").NextApiHandler} handler
 */
export function withApiMetrics(route, handler) {
  return async function metricsHandler(req, res) {
    if (!isMetricsEnabled()) {
      return handler(req, res);
    }

    const { getHttpRequestDurationHistogram } = await import("./registry");
    const histogram = getHttpRequestDurationHistogram();
    const method = (req.method || "GET").toUpperCase();
    const start = process.hrtime.bigint();
    let observed = false;

    const observe = () => {
      if (observed) {
        return;
      }
      observed = true;
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const statusCode = res.statusCode || 200;
      histogram.observe({ method, route, status_code: String(statusCode) }, durationSec);
    };

    res.once("finish", observe);
    res.once("close", observe);

    return handler(req, res);
  };
}
