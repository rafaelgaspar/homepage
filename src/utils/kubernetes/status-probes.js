import { servicesFromConfig } from "utils/config/service-helpers";
import { kubernetesStatusKey, labelSelectorFor } from "utils/kubernetes/status-keys";

export {
  kubernetesProbeFromQuery,
  kubernetesStatusKey,
  kubernetesStatusUrl,
  labelSelectorFor,
  parseKubernetesStatusKey,
} from "utils/kubernetes/status-keys";

function flattenServices(groups, services = []) {
  groups.forEach((group) => {
    (group.services ?? []).forEach((service) => services.push(service));
    flattenServices(group.groups ?? [], services);
  });
  return services;
}

export async function loadKubernetesStatusProbes() {
  const groups = await servicesFromConfig();
  return flattenServices(groups)
    .filter((service) => service.namespace && service.app)
    .map((service) => ({
      namespace: service.namespace,
      app: service.app,
      podSelector: service.podSelector,
      labelSelector: labelSelectorFor(service),
      key: kubernetesStatusKey(service),
    }));
}
