import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";

import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { internalIPFamilies, versionFields } from "utils/k3s-home/map";
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

function Field({ label, value, title, children, fit = false, half = false }) {
  const { t } = useTranslation();
  const text = value === undefined || value === null || value === "" ? "-" : value;
  return (
    <div
      className={classNames(
        "service-block m-0 rounded-sm bg-theme-200/50 px-1 py-0.5 text-center dark:bg-theme-900/20",
        fit && "k3s-home-fit w-fit max-w-full flex-none",
        half && "k3s-home-version w-[calc(50%-0.125rem)] min-w-0 flex-none",
        !fit && !half && "k3s-home-equal min-w-0 flex-1 basis-0",
      )}
      title={title || (children || text === "-" ? undefined : String(text))}
    >
      <div className="service-block-value text-[11px] tabular-nums leading-tight">
        {children ?? <span className={fit ? "block whitespace-nowrap" : "block truncate"}>{text}</span>}
      </div>
      <div className="service-block-label truncate text-[9px] font-bold uppercase leading-tight opacity-70">
        {t(label)}
      </div>
    </div>
  );
}

function Row({ children, wrap = false }) {
  return (
    <div
      className={classNames(
        "flex w-full items-stretch gap-1 k3s-home-node-row",
        wrap ? "flex-wrap" : "flex-nowrap",
      )}
    >
      {children}
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

  const families = data ? internalIPFamilies(data.internalIPs, data.ip) : { ipv4: undefined, ipv6: undefined };
  const versions = data ? versionFields(data.versions) : [];
  const versionLines = [];
  for (let index = 0; index < versions.length; index += 2) {
    versionLines.push(versions.slice(index, index + 2));
  }

  return (
    <div
      className={classNames("flex w-full flex-col gap-1 px-1 pb-1 k3s-home-node", !data && "animate-pulse")}
      data-testid="k3s-home-node"
    >
      <Row>
        <Field label="k3shome.cpu" value={data ? usageNumber(t, data.usage?.cpu) : undefined} />
        <Field label="k3shome.memory" value={data ? usageBytes(t, data.usage?.memory) : undefined} />
      </Row>
      <Row wrap>
        {data ? (
          <>
            {families.ipv4 ? <Field fit label="k3shome.ipv4" value={families.ipv4} /> : null}
            {families.ipv6 ? <Field fit label="k3shome.ipv6" value={families.ipv6} /> : null}
          </>
        ) : (
          <>
            <Field fit label="k3shome.ipv4" />
            <Field fit label="k3shome.ipv6" />
          </>
        )}
      </Row>
      <Row>
        <Field label="k3shome.kernel" value={data?.kernelVersion} />
        <Field label="k3shome.kubelet" value={data?.kubeletVersion} />
      </Row>
      {versionLines.length ? (
        versionLines.map((line) => (
          <Row key={line.map((field) => field.key).join("-")}>
            {line.map((field) => (
              <Field half key={field.key} label={field.label} value={field.value} />
            ))}
          </Row>
        ))
      ) : (
        <Row>
          <Field label="k3shome.versions" />
        </Row>
      )}
    </div>
  );
}
