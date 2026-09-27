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
  return service.href || cfg?.url || cfg?.href || null;
}

export function shouldProbe(service) {
  const url = probeUrl(service);
  return Boolean(url && isMcpEndpoint(url));
}

export function isMcpService(service) {
  return shouldProbe(service);
}

export function buildProbe(service) {
  const cfg = service.mcpProbe && typeof service.mcpProbe === "object" ? service.mcpProbe : {};
  const url = service.href || cfg.url || cfg.href;
  if (!url) {
    throw new Error(`services.yaml ${service.name}: href required for MCP probe`);
  }
  return {
    id: probeId(service.name),
    serviceName: service.name,
    url,
    tokenEnv: cfg.tokenEnv,
  };
}
