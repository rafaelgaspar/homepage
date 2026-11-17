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
    const time = Number(ping.time);
    if (Number.isFinite(time)) {
      return `${Math.round(time)} ms`;
    }
    return "up";
  }
  return "down";
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
