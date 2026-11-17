const CONDITION_TYPES = ["Healthy", "Degraded", "NeedsReboot"];

export function conditionOf(conditions, type) {
  return (conditions ?? []).find((condition) => condition?.type === type);
}

export function conditionStatus(conditions, type) {
  return conditionOf(conditions, type)?.status ?? "Unknown";
}

export function conditionMessage(conditions, type) {
  return conditionOf(conditions, type)?.message ?? "";
}

export function nodeHealthTone(conditions) {
  const healthy = conditionStatus(conditions, "Healthy");
  if (healthy === "False") {
    return "red";
  }
  const othersOff = CONDITION_TYPES.filter((type) => type !== "Healthy").every(
    (type) => conditionStatus(conditions, type) !== "True",
  );
  if (healthy === "True" && othersOff) {
    return "green";
  }
  return "orange";
}

export function formatPingLatency(ping) {
  if (!ping) {
    return "n/a";
  }
  if (ping.alive) {
    if (ping.time === null || ping.time === undefined || ping.time === "") {
      return "up";
    }
    const time = Number(ping.time);
    if (Number.isFinite(time)) {
      return `${Math.round(time)} ms`;
    }
    return "up";
  }
  return "down";
}

/** ICMP wins when it gets a reply. Otherwise a scraped node-exporter means the node is up. */
export function resolvePing(icmp, exporterUp) {
  if (icmp?.alive) {
    return { alive: true, time: icmp.time ?? null };
  }
  if (Number(exporterUp) === 1) {
    return { alive: true, time: null };
  }
  if (!icmp && (exporterUp === null || exporterUp === undefined)) {
    return null;
  }
  return { alive: false, time: null };
}

export function formatRunDuration(run, now = Date.now()) {
  const start = Date.parse(run?.startedAt || run?.firedAt || "");
  if (!Number.isFinite(start)) {
    return "n/a";
  }
  const finished = Date.parse(run?.finishedAt || "");
  const end = Number.isFinite(finished) ? finished : now;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function nodeHealthTooltip(conditions, ping) {
  const lines = CONDITION_TYPES.map((type) => {
    const status = conditionStatus(conditions, type);
    const message = conditionMessage(conditions, type);
    return message ? `${type}: ${status} (${message})` : `${type}: ${status}`;
  });
  lines.push(`Ping: ${formatPingLatency(ping)}`);
  return lines.join("\n");
}

export function runPhaseTone(phase) {
  switch (phase) {
    case "Succeeded":
      return "green";
    case "Failed":
      return "red";
    case "Running":
    case "Partial":
    case "DryRun":
      return "orange";
    default:
      return "gray";
  }
}
