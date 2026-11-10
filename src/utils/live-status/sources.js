const sources = [];

export function registerLiveStatusSource(source) {
  if (!source?.prefix) {
    throw new Error("live-status source prefix is required");
  }
  const index = sources.findIndex((entry) => entry.prefix === source.prefix);
  if (index >= 0) {
    sources[index] = source;
    return;
  }
  sources.push(source);
}

export function listLiveStatusSources() {
  return [...sources];
}

export function sourceForKey(key) {
  return sources.find((source) => key.startsWith(source.prefix));
}

export async function startAllSources() {
  await Promise.all(sources.map((source) => source.start?.()));
}

export async function stopAllSources() {
  await Promise.all(sources.map((source) => source.stop?.()));
}

export function resetLiveStatusSourcesForTests() {
  sources.length = 0;
}
