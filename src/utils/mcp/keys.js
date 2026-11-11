export function mcpCacheKey(id) {
  return `mcp:${id}`;
}

export function mcpIdFromCacheKey(key) {
  if (typeof key !== "string" || !key.startsWith("mcp:")) {
    return null;
  }
  return key.slice("mcp:".length);
}
