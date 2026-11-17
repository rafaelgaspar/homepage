import { getKubeConfig } from "utils/config/kubernetes";
import { getK3sHomeConfig } from "utils/k3s-home/config";
import { NODE_PLURAL, SCHEDULE_PLURAL } from "utils/k3s-home/constants";
import { listClusterObjects } from "utils/k3s-home/list";
import { mapNode } from "utils/k3s-home/map";

function compareNames(left, right) {
  return String(left.name).localeCompare(String(right.name));
}

export function nodeServiceFromCR(node, { nodesIcon } = {}) {
  const mapped = mapNode(node);
  return {
    name: mapped.name,
    description: mapped.pool,
    icon: nodesIcon,
    type: "service",
    k3sHome: { kind: "node", name: mapped.name },
  };
}

export function scheduleGroupFromCR(schedule, { maintenanceIcon } = {}) {
  const name = schedule?.metadata?.name ?? "";
  return {
    name,
    services: [],
    k3sHome: { kind: "schedule", name, icon: maintenanceIcon },
  };
}

function withWeights(services) {
  return services.map((service, index) => ({
    ...service,
    weight: (index + 1) * 100,
  }));
}

export async function servicesFromK3sHome() {
  const options = getK3sHomeConfig();
  if (!options.enabled || !getKubeConfig()) {
    return [];
  }

  const [nodes, schedules] = await Promise.all([listClusterObjects(NODE_PLURAL), listClusterObjects(SCHEDULE_PLURAL)]);

  const groups = [];
  const nodeServices = withWeights(
    nodes.items
      .map((node) => nodeServiceFromCR(node, options))
      .filter((service) => service.name)
      .sort(compareNames),
  );
  if (nodeServices.length) {
    groups.push({ name: options.nodesGroup, services: nodeServices });
  }

  const scheduleGroups = schedules.items
    .map((schedule) => scheduleGroupFromCR(schedule, options))
    .filter((group) => group.name)
    .sort(compareNames);
  if (scheduleGroups.length) {
    groups.push({ name: options.maintenanceGroup, services: [], groups: scheduleGroups });
  }

  return groups;
}
