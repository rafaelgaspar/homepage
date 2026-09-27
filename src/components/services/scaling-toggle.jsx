import { useState } from "react";
import { mutate } from "swr";

import { SCALING_LIST_KEY, scalingItemKey, useServiceScaling } from "utils/scaling/client";

function k8sStatusUrl(service) {
  const podSelector = service.podSelector;
  const qs =
    podSelector !== undefined && podSelector !== null && podSelector !== ""
      ? `podSelector=${encodeURIComponent(podSelector)}`
      : "";
  return `/api/kubernetes/status/${service.namespace}/${service.app}?${qs}`;
}

function pollK8sStatus(service) {
  const url = k8sStatusUrl(service);
  let attempts = 0;
  const tick = () => {
    mutate(url).catch(() => {});
    attempts += 1;
    if (attempts >= 15) {
      clearInterval(timer);
    }
  };
  tick();
  const timer = setInterval(tick, 2000);
}

export default function ScalingToggle({ service }) {
  const listKey = SCALING_LIST_KEY;
  const itemKey = scalingItemKey(service.namespace, service.app);
  const { toggleItem, item } = useServiceScaling(service);
  const mutateItem = (...args) => mutate(itemKey, ...args);
  const [busy, setBusy] = useState(false);

  if (!toggleItem || !item) {
    return null;
  }

  const alwaysOn = item.minReplicaCount !== 0;
  const title = alwaysOn
    ? "Always on — click to allow idle scale-down; Shift+click to scale down now"
    : "Always on off — click to pin up; Shift+click to scale down now";

  async function activate(shiftKey) {
    if (busy) return;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (shiftKey) {
        params.set("minReplicaCount", "0");
        params.set("scaleDown", "1");
      }
      const query = params.toString();
      const response = await fetch(`${itemKey}${query ? `?${query}` : ""}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`scaling API ${response.status}`);
      }
      const updated = await response.json();
      await mutateItem(updated, false);
      await mutate(listKey);
      pollK8sStatus(service);
    } catch (error) {
      console.error(error);
      await mutate(listKey);
      await mutateItem();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`homepage-scaling-toggle absolute top-[0.45rem] right-[2.15rem] z-50 inline-flex items-center justify-center shrink-0 m-0 p-2 min-w-[2.75rem] min-h-[2rem] border-0 bg-transparent cursor-pointer leading-none touch-manipulation pointer-events-auto ${
        busy ? "opacity-55 pointer-events-none" : ""
      } ${alwaysOn ? "is-on" : ""}`}
      role="switch"
      aria-checked={alwaysOn ? "true" : "false"}
      aria-label={alwaysOn ? "Always on toggle, on" : "Always on toggle, off"}
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        activate(event.shiftKey);
      }}
    >
      <span
        className={`homepage-scaling-toggle-track block w-7 h-4 rounded-full relative transition-colors ${
          alwaysOn ? "bg-emerald-500/90 hover:bg-emerald-400/95" : "bg-slate-500/55 hover:bg-slate-400/75"
        }`}
        aria-hidden="true"
      >
        <span
          className={`homepage-scaling-toggle-thumb absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-slate-50 shadow transition-transform ${
            alwaysOn ? "translate-x-3" : ""
          }`}
        />
      </span>
    </button>
  );
}
