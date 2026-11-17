import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";

import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { formatInternalIPs, formatVersions, primaryNodeAddress } from "utils/k3s-home/map";
import { useLiveStatus } from "utils/live-status/client";

function hasUsage(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function usageNumber(t, value) {
  if (!hasUsage(value)) {
    return undefined;
  }
  return t("common.number", { value, maximumFractionDigits: 4 });
}

function usageBytes(t, value) {
  if (!hasUsage(value)) {
    return undefined;
  }
  return t("common.bytes", { value, maximumFractionDigits: 1, binary: true });
}

function Field({ label, value, title }) {
  const { t } = useTranslation();
  const text = value === undefined || value === null || value === "" ? "-" : value;
  return (
    <div
      className="service-block m-0 min-w-0 flex-1 rounded-sm bg-theme-200/50 px-1 py-0.5 text-center dark:bg-theme-900/20"
      title={title || (text === "-" ? undefined : String(text))}
    >
      <div className="service-block-value truncate text-[11px] tabular-nums leading-tight">{text}</div>
      <div className="service-block-label truncate text-[9px] font-bold uppercase leading-tight opacity-70">
        {t(label)}
      </div>
    </div>
  );
}

export default function K3sHomeNode({ service }) {
  const { t } = useTranslation();
  const name = service?.k3sHome?.name;
  const { data, error } = useLiveStatus(k3sHomeCacheKey("node", name), {
    fallbackUrl: k3sHomeStatusUrl("node", name),
  });

  if (error) {
    return <div className="px-2 pb-1 text-xs text-rose-500 k3s-home-node">{error.message || String(error)}</div>;
  }

  const address = data ? primaryNodeAddress(data.internalIPs, data.ip) : undefined;
  const versions = data ? formatVersions(data.versions) : undefined;

  return (
    <div
      className={classNames(
        "flex w-full flex-nowrap items-stretch gap-1 overflow-hidden px-1 pb-1 k3s-home-node",
        !data && "animate-pulse",
      )}
      data-testid="k3s-home-node"
    >
      <Field label="k3shome.ips" value={address} title={data ? formatInternalIPs(data.internalIPs) : undefined} />
      <Field label="k3shome.kernel" value={data?.kernelVersion} />
      <Field label="k3shome.kubelet" value={data?.kubeletVersion} />
      <Field label="k3shome.versions" value={versions} />
      <Field label="k3shome.cpu" value={data ? usageNumber(t, data.usage?.cpu) : undefined} />
      <Field label="k3shome.memory" value={data ? usageBytes(t, data.usage?.memory) : undefined} />
    </div>
  );
}
