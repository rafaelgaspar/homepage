import useSWR from "swr";

export default function McpStatus({ service, style }) {
  const { data, error } = useSWR("/api/mcpMonitor", {
    refreshInterval: 30000,
  });

  const result = Array.isArray(data) ? data.find((item) => item.serviceName === service.name) : null;

  let title = "MCP status unavailable";
  let countText = "—";
  let backgroundClass = "px-1.5 py-0.5 bg-theme-500/10 dark:bg-theme-900/50";
  let colorClass = "text-black/20 dark:text-white/40 opacity-20";

  if (error || (result && !result.ok)) {
    title = result?.error || "MCP tools/list failed";
    colorClass = "text-rose-500/80";
  } else if (result?.ok) {
    const latency = result.latencyMs === null || result.latencyMs === undefined ? "?" : String(result.latencyMs);
    title = `${result.toolCount} tools · ${latency} ms`;
    countText = String(result.toolCount);
    colorClass = "text-emerald-500/80";
  }

  let dotClass = colorClass;
  if (style === "dot") {
    backgroundClass = "p-4 hover:bg-theme-500/10 dark:hover:bg-theme-900/20";
    dotClass = colorClass.replace(/text-/g, "bg-").replace(/\/\d\d/g, "");
  }

  return (
    <div className={`w-auto text-center overflow-hidden ${backgroundClass} rounded-b-[3px] mcp-status`} title={title}>
      {style === "dot" ? (
        <div className="flex items-center gap-1">
          <span className="text-[9px] leading-none tabular-nums text-theme-700 dark:text-theme-200/90">
            {countText}
          </span>
          <div className={`rounded-full h-3 w-3 shrink-0 ${dotClass}`} />
        </div>
      ) : (
        <div className={`text-[8px] font-bold uppercase ${colorClass}`}>{countText}</div>
      )}
    </div>
  );
}
