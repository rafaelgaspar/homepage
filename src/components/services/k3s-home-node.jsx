import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { formatInternalIPs, formatVersions } from "utils/k3s-home/map";
import { useLiveStatus } from "utils/live-status/client";

export default function K3sHomeNode({ service }) {
  const name = service?.k3sHome?.name;
  const { data, error } = useLiveStatus(k3sHomeCacheKey("node", name), {
    fallbackUrl: k3sHomeStatusUrl("node", name),
  });

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return (
      <Container service={service}>
        <Block label="k3shome.ips" />
        <Block label="k3shome.kernel" />
        <Block label="k3shome.kubelet" />
        <Block label="k3shome.versions" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <Block label="k3shome.ips" value={formatInternalIPs(data.internalIPs) || "-"} />
      <Block label="k3shome.kernel" value={data.kernelVersion || "-"} />
      <Block label="k3shome.kubelet" value={data.kubeletVersion || "-"} />
      <Block label="k3shome.versions" value={formatVersions(data.versions) || "-"} />
    </Container>
  );
}
