const READY_PHASES = new Set(["Succeeded", "Running"]);

export function statusFromPods(pods) {
  if (!Array.isArray(pods) || pods.length === 0) {
    return "not found";
  }
  const ready = (pod) => READY_PHASES.has(pod?.status?.phase);
  if (pods.every(ready)) {
    return "running";
  }
  if (pods.some(ready)) {
    return "partial";
  }
  return "down";
}
