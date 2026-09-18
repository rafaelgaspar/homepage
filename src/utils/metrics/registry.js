import client from "prom-client";

let initialized = false;
const register = new client.Registry();

/** @type {import("prom-client").Histogram<string> | null} */
let httpRequestDuration = null;

export function getMetricsRegister() {
  if (!initialized) {
    client.collectDefaultMetrics({ register });
    initialized = true;
  }
  return register;
}

export function getHttpRequestDurationHistogram() {
  getMetricsRegister();
  if (!httpRequestDuration) {
    httpRequestDuration = new client.Histogram({
      name: "homepage_http_request_duration_seconds",
      help: "Duration of Homepage pages/api HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [register],
    });
  }
  return httpRequestDuration;
}

export async function renderMetrics() {
  return getMetricsRegister().metrics();
}

export function metricsContentType() {
  return getMetricsRegister().contentType;
}
