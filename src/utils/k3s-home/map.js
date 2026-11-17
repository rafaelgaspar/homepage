import { poolFromTaints } from "utils/k3s-home/pool";

export function versionFields(versions = {}) {
  const fields = [];
  if (versions?.k3s) {
    fields.push({ key: "k3s", label: "k3shome.k3s", value: String(versions.k3s) });
  }
  if (versions?.etcd) {
    fields.push({ key: "etcd", label: "k3shome.etcd", value: String(versions.etcd) });
  }
  const nvidiaRunning = versions?.nvidiaRunning;
  const nvidiaInstalled = versions?.nvidiaInstalled;
  if (nvidiaRunning || nvidiaInstalled) {
    const value =
      nvidiaRunning && nvidiaInstalled && nvidiaRunning !== nvidiaInstalled
        ? `${nvidiaInstalled} / ${nvidiaRunning}`
        : String(nvidiaRunning || nvidiaInstalled);
    fields.push({ key: "nvidia", label: "k3shome.nvidia", value });
  }
  return fields;
}

export function versionParts(versions = {}) {
  return versionFields(versions).map((field) => `${field.key} ${field.value}`);
}

export function formatVersions(versions = {}) {
  return versionParts(versions).join(" · ");
}

export function internalIPFamilies(ips = [], fallback = "") {
  const list = (ips ?? []).filter(Boolean).map(String);
  const ipv4 = list.filter((ip) => !ip.includes(":"));
  const ipv6 = list.filter((ip) => ip.includes(":"));
  const extra = fallback ? String(fallback) : "";
  if (extra && !list.includes(extra)) {
    if (extra.includes(":")) ipv6.push(extra);
    else ipv4.push(extra);
  }
  return { ipv4: ipv4.join(", "), ipv6: ipv6.join(", ") };
}

export function formatInternalIPs(ips = []) {
  const { ipv4, ipv6 } = internalIPFamilies(ips);
  return [ipv4, ipv6].filter(Boolean).join(", ");
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

export function formatLogText(value) {
  if (Array.isArray(value)) {
    return value.map((line) => String(line ?? "")).filter((line) => line !== "").join("\n");
  }
  return typeof value === "string" ? value : "";
}

function addTaskName(names, name) {
  if (typeof name === "string" && name && !names.includes(name)) {
    names.push(name);
  }
}

/** MaintenanceTask names referenced by a run: provision steps, per-node tasks, and bounce. */
export function taskObjectNames(run) {
  const names = [];
  for (const task of run?.status?.tasks ?? []) {
    addTaskName(names, task?.task);
  }
  for (const info of Object.values(run?.status?.nodes ?? {})) {
    addTaskName(names, info?.task);
  }
  addTaskName(names, run?.status?.bounce?.task);
  return names;
}

function logFromTaskObject(object) {
  return formatLogText(object?.status?.run?.log);
}

function withExecution(task, object) {
  const execution = object?.status?.run ?? {};
  return {
    ...task,
    phase: task.phase || execution.phase || "Unknown",
    exitCode: task.exitCode ?? execution.exitCode ?? null,
    startedAt: task.startedAt || execution.startedAt || "",
    finishedAt: task.finishedAt || execution.finishedAt || "",
    message: task.message || execution.message || "",
    result: task.result || execution.result || "",
    log: logFromTaskObject(object),
  };
}

function entryFromStatus(name, info, object) {
  const inline = formatLogText(info?.log);
  const task = withExecution(
    {
      name,
      node: info?.node ?? "",
      step: info?.step ?? "",
      stage: info?.stage ?? "",
      phase: info?.phase ?? "Unknown",
      exitCode: info?.exitCode ?? null,
      startedAt: info?.startedAt ?? "",
      finishedAt: info?.finishedAt ?? "",
      message: info?.message ?? "",
      result: info?.result ?? "",
    },
    object,
  );
  if (!task.log && inline) {
    task.log = inline;
  }
  return task;
}

function bounceEntry(bounce, byName) {
  const name = bounce?.task || "bounce";
  return entryFromStatus(name, { ...bounce, step: bounce?.step || "bounce" }, byName.get(bounce?.task));
}

export function mapRunDetail(run, taskObjects = []) {
  const byName = new Map(taskObjects.filter(Boolean).map((task) => [task?.metadata?.name ?? "", task]));
  const summary = mapRun(run);
  const status = run?.status ?? {};
  let tasks = summary.tasks.length
    ? summary.tasks.map((task) => withExecution(task, byName.get(task.name)))
    : Object.entries(status.nodes ?? {}).map(([node, info]) =>
        entryFromStatus(info?.task || `${node}-${info?.step || "node"}`, { ...info, node }, byName.get(info?.task)),
      );
  const bounce = status.bounce;
  if (bounce && typeof bounce === "object") {
    const name = bounce.task || "bounce";
    if (!tasks.some((task) => task.name === name)) {
      tasks = [...tasks, bounceEntry(bounce, byName)];
    }
  }
  return {
    ...summary,
    report: status.report ?? "",
    discordSummary: status.discordSummary ?? "",
    tasks,
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
