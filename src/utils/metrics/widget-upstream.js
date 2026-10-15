import { isMetricsEnabled } from "./settings";

/**
 * @param {string} widgetType
 * @param {number} statusCode
 * @param {number} durationSec
 */
export function recordWidgetUpstreamCall(widgetType, statusCode, durationSec) {
  if (!isMetricsEnabled() || !widgetType) {
    return;
  }

  void import("./registry").then(({ getWidgetUpstreamDurationHistogram, getWidgetUpstreamErrorsCounter }) => {
    getWidgetUpstreamDurationHistogram().observe({ widget_type: widgetType }, durationSec);
    if (statusCode >= 400) {
      getWidgetUpstreamErrorsCounter().inc({
        widget_type: widgetType,
        status_code: String(statusCode),
      });
    }
  });
}
