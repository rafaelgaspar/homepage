import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

import cache from "memory-cache";

import { loadYaml } from "utils/config/yaml";

const envCacheKey = "homepageEnvironmentVariables";

export const CONF_DIR = process.env.HOMEPAGE_CONFIG_DIR
  ? process.env.HOMEPAGE_CONFIG_DIR
  : join(process.cwd(), "config");

/** Dashboard YAML mounted in k3s-home ConfigMap (and typical cluster installs). */
export const DASHBOARD_CONFIG_FILES = [
  "settings.yaml",
  "services.yaml",
  "widgets.yaml",
  "bookmarks.yaml",
  "kubernetes.yaml",
];

let configReady = false;
/** @type {Map<string, number>} */
let lastGoodMtimesMs = new Map();
let reloadMetricPending = false;

function existingDashboardConfigFiles() {
  return DASHBOARD_CONFIG_FILES.filter((name) => existsSync(join(CONF_DIR, name)));
}

function invalidateRuntimeCaches() {
  cache.del(envCacheKey);
}

function configMtimeMs(configFile) {
  return statSync(join(CONF_DIR, configFile)).mtimeMs;
}

function parseConfigFile(configFile) {
  const configPath = join(CONF_DIR, configFile);
  const raw = readFileSync(configPath, "utf8");
  loadYaml(raw);
}

function detectMtimeDrift() {
  for (const configFile of existingDashboardConfigFiles()) {
    const mtimeMs = configMtimeMs(configFile);
    const lastGood = lastGoodMtimesMs.get(configFile);
    if (lastGood === undefined || lastGood !== mtimeMs) {
      return true;
    }
  }
  return false;
}

function recordReloadMetric(result) {
  void import("utils/metrics/config-reload").then(({ emitConfigReloadMetric }) => {
    emitConfigReloadMetric(result);
  });
}

/**
 * Called when any config file is read via checkAndCopyConfig.
 *
 * @param {string} configFile
 * @param {number} mtimeMs
 * @param {boolean} parseOk
 */
export function onConfigFileTouched(configFile, mtimeMs, parseOk) {
  if (!DASHBOARD_CONFIG_FILES.includes(configFile)) {
    return;
  }

  if (!parseOk) {
    configReady = false;
    reloadMetricPending = true;
    invalidateRuntimeCaches();
    return;
  }

  const lastGood = lastGoodMtimesMs.get(configFile);
  if (lastGood !== undefined && lastGood !== mtimeMs) {
    configReady = false;
    reloadMetricPending = true;
    invalidateRuntimeCaches();
  }
}

/**
 * Validate all dashboard config files and update readiness.
 *
 * @returns {{ ready: boolean, reason?: string }}
 */
export function evaluateDashboardConfigReadiness() {
  const files = existingDashboardConfigFiles();
  if (!files.length) {
    configReady = false;
    return { ready: false, reason: "no dashboard config files" };
  }

  if (configReady && !detectMtimeDrift()) {
    return { ready: true };
  }

  const nextGoodMtimes = new Map();
  for (const configFile of files) {
    try {
      parseConfigFile(configFile);
      nextGoodMtimes.set(configFile, configMtimeMs(configFile));
    } catch (err) {
      configReady = false;
      if (reloadMetricPending) {
        recordReloadMetric("failure");
        reloadMetricPending = false;
      }
      return { ready: false, reason: `${configFile}: ${err.message || err}` };
    }
  }

  const wasReload = reloadMetricPending || lastGoodMtimesMs.size > 0;
  lastGoodMtimesMs = nextGoodMtimes;
  configReady = true;
  if (wasReload) {
    recordReloadMetric("success");
  }
  reloadMetricPending = false;
  return { ready: true };
}

export function isDashboardConfigReady() {
  return configReady && !detectMtimeDrift();
}

/** @internal */
export function resetDashboardConfigReadinessForTests() {
  configReady = false;
  lastGoodMtimesMs = new Map();
  reloadMetricPending = false;
  invalidateRuntimeCaches();
}
