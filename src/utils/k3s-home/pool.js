import { TAINT_OLDER_NODE, TAINT_RESERVED } from "./constants";

export function taintKey(taint) {
  return String(taint ?? "")
    .split(":")[0]
    .split("=")[0];
}

export function poolFromTaints(taints = []) {
  for (const taint of taints) {
    const key = taintKey(taint);
    const slug = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
    if (slug === TAINT_OLDER_NODE) {
      return "older-node";
    }
    if (slug === TAINT_RESERVED) {
      return "reserved";
    }
  }
  return "free-pool";
}
