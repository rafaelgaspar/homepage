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

export function primaryNodeAddress(ips = [], fallback = "") {
  const list = (ips ?? []).filter(Boolean);
  const ipv4 = list.find((ip) => !String(ip).includes(":"));
  return ipv4 || list[0] || fallback || "";
}

export function mapNode(node, ping = null, usage = null) {
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
    usage: usage ?? { cpu: null, memory: null },
  };
}

export function mapRun(run) {
  const spec = run?.spec ?? {};
  const status = run?.status ?? {};
  return {
    name: run?.metadata?.name ?? "",
    schedule: spec.schedule ?? "",
    kind: spec.kind ?? "",
    phase: status.phase ?? "Unknown",
    outcome: status.outcome ?? "",
    firedAt: spec.firedAt ?? "",
    startedAt: status.startedAt ?? "",
    finishedAt: status.finishedAt ?? "",
    windowEnd: spec.windowEnd ?? "",
    dryRun: Boolean(spec.dryRun),
    trigger: spec.trigger ?? "",
    steps: spec.steps ?? [],
    plan: status.plan ?? [],
    skipped: status.skipped ?? [],
    nodes: status.nodes ?? {},
    tasks: (status.tasks ?? []).map(mapTaskSummary),
  };
}

export function mapTaskSummary(task) {
  return {
    name: task?.task ?? "",
    node: task?.node ?? "",
    step: task?.step ?? "",
    stage: task?.stage ?? "",
    phase: task?.phase ?? "Unknown",
    exitCode: task?.exitCode ?? null,
    startedAt: task?.startedAt ?? "",
    finishedAt: task?.finishedAt ?? "",
    message: task?.message ?? "",
    result: task?.result ?? "",
  };
}

export function mapRunDetail(run, taskObjects = []) {
  const byName = new Map(taskObjects.filter(Boolean).map((task) => [task?.metadata?.name ?? "", task]));
  const summary = mapRun(run);
  return {
    ...summary,
    report: run?.status?.report ?? "",
    discordSummary: run?.status?.discordSummary ?? "",
    tasks: summary.tasks.map((task) => {
      const object = byName.get(task.name);
      const execution = object?.status?.run ?? {};
      return {
        ...task,
        phase: task.phase || execution.phase || "Unknown",
        exitCode: task.exitCode ?? execution.exitCode ?? null,
        startedAt: task.startedAt || execution.startedAt || "",
        finishedAt: task.finishedAt || execution.finishedAt || "",
        message: task.message || execution.message || "",
        result: task.result || execution.result || "",
        log: execution.log ?? "",
      };
    }),
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
