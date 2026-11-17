import { poolFromTaints } from "utils/k3s-home/pool";

export function formatVersions(versions = {}) {
  const parts = [];
  if (versions.k3s) {
    parts.push(`k3s ${versions.k3s}`);
  }
  if (versions.etcd) {
    parts.push(`etcd ${versions.etcd}`);
  }
  const nvidiaRunning = versions.nvidiaRunning;
  const nvidiaInstalled = versions.nvidiaInstalled;
  if (nvidiaRunning || nvidiaInstalled) {
    if (nvidiaRunning && nvidiaInstalled && nvidiaRunning !== nvidiaInstalled) {
      parts.push(`nvidia ${nvidiaInstalled} / ${nvidiaRunning}`);
    } else {
      parts.push(`nvidia ${nvidiaRunning || nvidiaInstalled}`);
    }
  }
  return parts.join(" · ");
}

export function formatInternalIPs(ips = []) {
  const list = (ips ?? []).filter(Boolean);
  const ipv4 = list.filter((ip) => !String(ip).includes(":"));
  const ipv6 = list.filter((ip) => String(ip).includes(":"));
  return [...ipv4, ...ipv6].join(", ");
}

export function mapNode(node, ping = null) {
  const spec = node?.spec ?? {};
  const status = node?.status ?? {};
  const core = status.core ?? {};
  const host = status.host ?? {};
  return {
    name: node?.metadata?.name ?? "",
    pool: poolFromTaints(spec.taints),
    ip: spec.ip ?? "",
    conditions: status.conditions ?? [],
    internalIPs: core.internalIPs ?? [],
    kernelVersion: core.kernelVersion ?? "",
    kubeletVersion: core.kubeletVersion ?? "",
    versions: host.versions ?? {},
    ping,
  };
}

export function mapRun(run) {
  return {
    name: run?.metadata?.name ?? "",
    phase: run?.status?.phase ?? "Unknown",
    firedAt: run?.spec?.firedAt ?? "",
    finishedAt: run?.status?.finishedAt ?? "",
    dryRun: Boolean(run?.spec?.dryRun),
    trigger: run?.spec?.trigger ?? "",
  };
}

export function mapSchedule(schedule, runs = []) {
  const name = schedule?.metadata?.name ?? "";
  const spec = schedule?.spec ?? {};
  const status = schedule?.status ?? {};
  const owned = runs.filter((run) => (run?.spec?.schedule ?? "") === name).map(mapRun);
  owned.sort((left, right) => String(right.firedAt).localeCompare(String(left.firedAt)));
  return {
    name,
    paused: Boolean(spec.paused),
    dryRun: Boolean(spec.dryRun),
    schedule: spec.schedule ?? "",
    lastRun: status.lastRun ?? "",
    nextFiringAt: status.nextFiringAt ?? "",
    runs: owned,
  };
}
