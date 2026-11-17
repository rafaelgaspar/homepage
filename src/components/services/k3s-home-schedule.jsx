import { useTranslation } from "next-i18next/pages";

import { runPhaseTone } from "utils/k3s-home/health";
import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { useLiveStatus } from "utils/live-status/client";

const PHASE_CLASS = {
  green: "text-emerald-500/80",
  red: "text-rose-500/80",
  orange: "text-orange-400/50 dark:text-orange-400/80",
  gray: "text-theme-500 dark:text-theme-400",
};

export default function K3sHomeSchedule({ service }) {
  const { t } = useTranslation();
  const name = service?.k3sHome?.name;
  const { data } = useLiveStatus(k3sHomeCacheKey("schedule", name), {
    fallbackUrl: k3sHomeStatusUrl("schedule", name),
  });

  const runs = data?.runs ?? [];

  return (
    <ul className="flex flex-col gap-0.5 px-2 pb-1 k3s-home-runs">
      {runs.length === 0 ? (
        <li className="text-[10px] uppercase tracking-wide text-theme-500 dark:text-theme-400">
          {t("k3shome.no_runs")}
        </li>
      ) : (
        runs.map((run) => (
          <li key={run.name} className="flex items-center justify-between gap-2 text-[11px] leading-tight">
            <span className="truncate text-theme-700 dark:text-theme-200">{run.name}</span>
            <span
              className={`shrink-0 font-semibold uppercase ${PHASE_CLASS[runPhaseTone(run.phase)] ?? PHASE_CLASS.gray}`}
            >
              {run.phase}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
