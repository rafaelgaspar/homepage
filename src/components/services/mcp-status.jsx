import useSWR from "swr";

import { MCP_MONITOR_REFRESH_MS } from "utils/mcp/timing";

function fetchMcpMonitor(url) {
  return fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`mcpMonitor ${response.status}`);
    }
    return response.json();
  });
}

function formatToolCount(count) {
  if (count === null || count === undefined) {
    return "";
  }
  const n = Number(count);
  if (!Number.isFinite(n)) {
    return "";
  }
  return `${n} ${n === 1 ? "tool" : "tools"}`;
}

function formatLatencyTitle(latencyMs) {
  if (latencyMs === null || latencyMs === undefined || !Number.isFinite(Number(latencyMs))) {
    return "tools/list latency unknown";
  }
  return `${Number(latencyMs)} ms tools/list`;
}

export default function McpStatus({ service, style }) {
  const { data } = useSWR("/api/mcpMonitor", fetchMcpMonitor, {
    refreshInterval: MCP_MONITOR_REFRESH_MS,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const result = Array.isArray(data) ? data.find((item) => item.serviceName === service.name) : null;

  let dotTitle = "MCP status pending";
  let countHoverTitle = "";
  let countText = "";
  let backgroundClass = "px-1.5 py-0.5 bg-theme-500/10 dark:bg-theme-900/50";
  let colorClass = "text-black/20 dark:text-white/40 opacity-20";

  if (result?.ok) {
    countHoverTitle = formatLatencyTitle(result.latencyMs);
    dotTitle = "MCP tools/list OK";
    countText = formatToolCount(result.toolCount);
    colorClass = "text-emerald-500/80";
  } else if (result && !result.ok) {
    dotTitle = result.error || "MCP tools/list failed";
    countHoverTitle = dotTitle;
    colorClass = "text-rose-500/80";
  }

  let dotClass = colorClass;
  if (style === "dot") {
    backgroundClass = "p-4 hover:bg-theme-500/10 dark:hover:bg-theme-900/20";
    dotClass = colorClass.replace(/text-/g, "bg-").replace(/\/\d\d/g, "");
  }

  return (
    <div className={`w-auto text-center overflow-hidden ${backgroundClass} rounded-b-[3px] mcp-status`}>
      {style === "dot" ? (
        <div className="flex items-center gap-1">
          {countText ? (
            <span
              className="text-[8px] leading-none tabular-nums text-theme-700 dark:text-theme-200/90 whitespace-nowrap"
              title={countHoverTitle || undefined}
            >
              {countText}
            </span>
          ) : null}
          <div className={`rounded-full h-3 w-3 shrink-0 ${dotClass}`} title={dotTitle} />
        </div>
      ) : (
        <div className={`text-[8px] font-bold uppercase ${colorClass}`} title={countHoverTitle || dotTitle}>
          {countText}
        </div>
      )}
    </div>
  );
}
