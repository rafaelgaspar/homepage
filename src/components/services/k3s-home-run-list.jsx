import { useTranslation } from "next-i18next/pages";

import List from "components/services/list";
import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { useLiveStatus } from "utils/live-status/client";

function runService(run, icon, index) {
  return {
    name: run.name,
    description: [run.kind, run.trigger].filter(Boolean).join(" · "),
    icon,
    type: "service",
    weight: (index + 1) * 100,
    widgets: [],
    k3sHome: {
      kind: "run",
      name: run.name,
      phase: run.phase,
      firedAt: run.firedAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
  };
}

export default function K3sHomeRunList({ groupName, schedule, layout, useEqualHeights, header }) {
  const { t } = useTranslation();
  const { data } = useLiveStatus(k3sHomeCacheKey("schedule", schedule?.name), {
    fallbackUrl: k3sHomeStatusUrl("schedule", schedule?.name),
  });
  const runs = data?.runs ?? [];

  if (!runs.length) {
    return <p className="mt-2 px-1 text-xs text-theme-500 dark:text-theme-400">{t("k3shome.no_runs")}</p>;
  }

  return (
    <List
      groupName={groupName}
      services={runs.map((run, index) => runService(run, schedule?.icon, index))}
      layout={layout}
      useEqualHeights={useEqualHeights}
      header={header}
    />
  );
}
