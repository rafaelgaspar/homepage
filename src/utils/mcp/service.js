import { statSync } from "fs";
import path from "path";

import { CONF_DIR } from "utils/config/config";
import { servicesFromConfig } from "utils/config/service-helpers";
import { buildProbe, shouldProbe } from "utils/mcp/detect";

function flattenServiceGroups(groups, services = []) {
  groups.forEach((group) => {
    (group.services ?? []).forEach((service) => services.push(service));
    flattenServiceGroups(group.groups ?? [], services);
  });
  return services;
}

let cachedProbes;
let cachedProbesMtimeMs = 0;

export async function loadMcpProbes() {
  const servicesPath = path.join(CONF_DIR, "services.yaml");
  const mtimeMs = statSync(servicesPath).mtimeMs;
  if (cachedProbes && mtimeMs === cachedProbesMtimeMs) {
    return cachedProbes;
  }

  const groups = await servicesFromConfig();
  cachedProbes = flattenServiceGroups(groups).filter(shouldProbe).map(buildProbe);
  cachedProbesMtimeMs = mtimeMs;
  return cachedProbes;
}
