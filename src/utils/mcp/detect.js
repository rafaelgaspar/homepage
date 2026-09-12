export function probeId(serviceName) {
  return serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isMcpEndpoint(urlString) {
  if (typeof urlString !== "string" || !urlString) return false;
  try {
    const pathname = new URL(urlString).pathname;
    return pathname.endsWith("/mcp") || pathname.endsWith("/api/mcp");
  } catch {
    return urlString.includes("/api/mcp") || urlString.endsWith("/mcp");
  }
}

export function probeUrl(service) {
  const cfg = service.mcpProbe && typeof service.mcpProbe === "object" ? service.mcpProbe : null;
  if (!cfg) return null;
  if (cfg.url || cfg.href) return cfg.url || cfg.href;
  const type = cfg.type || "gateway";
  if (type === "gateway" || type === "gateway-filtered") {
    return service.href || null;
  }
  return service.href || null;
}

export function shouldProbe(service) {
  if (!service.mcpProbe || typeof service.mcpProbe !== "object") {
    return false;
  }
  const url = probeUrl(service);
  return Boolean(url && isMcpEndpoint(url));
}

export function isMcpService(service) {
  return shouldProbe(service);
}

export function buildProbe(service) {
  const cfg = service.mcpProbe && typeof service.mcpProbe === "object" ? service.mcpProbe : {};
  const type = cfg.type || "gateway";
  let url = cfg.url || cfg.href;
  if (!url) {
    url = service.href;
  }
  if (!url) {
    throw new Error(`services.yaml ${service.name}: mcpProbe.url or href required for MCP probe`);
  }
  return {
    id: probeId(service.name),
    serviceName: service.name,
    type,
    url,
    tokenEnv: cfg.tokenEnv,
    toolPrefix: cfg.toolPrefix,
  };
}
