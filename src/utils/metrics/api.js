import {
  HTTP_SLOW_REQUEST_THRESHOLD_SECONDS,
  getHttpRequestDurationHistogram,
  getHttpRequestsCounter,
  getHttpRequestsInFlightGauge,
  getHttpResponseBytesHistogram,
  getHttpSlowRequestsCounter,
} from "./registry";
import { trackResponseBytes } from "./response-bytes";
import { isMetricsEnabled } from "./settings";

/**
 * Wrap a Pages API handler to record request duration when metrics.enabled.
 *
 * @param {string} route Stable route template for labels (e.g. /api/kubernetes/stats/[...service])
 * @param {import("next").NextApiHandler} handler
 */
export function withApiMetrics(route, handler) {
  return async function metricsHandler(req, res) {
    if (route === "/api/healthcheck" || route === "/api/readycheck" || !isMetricsEnabled()) {
      return handler(req, res);
    }

    const histogram = getHttpRequestDurationHistogram();
    const counter = getHttpRequestsCounter();
    const inFlight = getHttpRequestsInFlightGauge();
    const responseBytes = getHttpResponseBytesHistogram();
    const slowRequests = getHttpSlowRequestsCounter();

    const method = (req.method || "GET").toUpperCase();
    const start = process.hrtime.bigint();
    let observed = false;
    const getBytesWritten = trackResponseBytes(res);

    inFlight.inc({ route });

    const observe = () => {
      if (observed) {
        return;
      }
      observed = true;
      inFlight.dec({ route });

      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const statusCode = res.statusCode || 200;
      const labels = { method, route, status_code: String(statusCode) };

      counter.inc(labels);
      histogram.observe(labels, durationSec);
      responseBytes.observe(labels, getBytesWritten());

      if (durationSec >= HTTP_SLOW_REQUEST_THRESHOLD_SECONDS) {
        slowRequests.inc(labels);
      }
    };

    res.once("finish", observe);
    res.once("close", observe);

    return handler(req, res);
  };
}
