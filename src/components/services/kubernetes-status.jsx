import { t } from "i18next";

import { kubernetesStatusKey, kubernetesStatusUrl } from "utils/kubernetes/status-keys";
import { useLiveStatus } from "utils/live-status/client";
import { useServiceScaling } from "utils/scaling/client";

export default function KubernetesStatus({ service, style }) {
  const { scaledIdle } = useServiceScaling(service);
  const key = kubernetesStatusKey(service);
  const { data, error } = useLiveStatus(scaledIdle ? null : key, {
    fallbackUrl: scaledIdle ? undefined : kubernetesStatusUrl(service),
  });

  let statusLabel = t("docker.unknown");
  let statusTitle = "";
  let backgroundClass = "px-1.5 py-0.5 bg-theme-500/10 dark:bg-theme-900/50";
  let colorClass = "text-black/20 dark:text-white/40 opacity-20";

  if (scaledIdle) {
    statusTitle = "scaled down";
    statusLabel = statusTitle;
  } else if (error) {
    statusTitle = t("docker.error");
    statusLabel = statusTitle;
    colorClass = "text-rose-500/80";
  } else if (data) {
    if (data.status === "idle") {
      statusTitle = "scaled down";
      statusLabel = statusTitle;
    } else if (data.status === "running") {
      statusTitle = data.health ?? data.status;
      statusLabel = statusTitle;
      colorClass = "text-emerald-500/80";
    } else if (data.status === "not found" || data.status === "down" || data.status === "partial") {
      statusTitle = data.status;
      statusLabel = statusTitle;
      colorClass = "text-orange-400/50 dark:text-orange-400/80";
    }
  }

  if (style === "dot") {
    colorClass = colorClass.replace(/text-/g, "bg-").replace(/\/\d\d/g, "");
    backgroundClass = "p-4 hover:bg-theme-500/10 dark:hover:bg-theme-900/20";
  }

  return (
    <div
      className={`w-auto text-center overflow-hidden ${backgroundClass} rounded-b-[3px] k8s-status`}
      title={statusTitle}
    >
      {style !== "dot" ? (
        <div className={`text-[8px] font-bold ${colorClass} uppercase`}>{statusLabel}</div>
      ) : (
        <div className={`rounded-full h-3 w-3 ${colorClass}`} />
      )}
    </div>
  );
}
