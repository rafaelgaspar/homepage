import fs from "node:fs";
import https from "node:https";

const TOGGLE_LABEL = "scaling.rafaelgaspar.xyz/homepage-toggle=true";
const KEDA_GROUP = "keda.sh";
const KEDA_VERSION = "v1alpha1";
const KEDA_PLURAL = "scaledobjects";

let kubeToken;
let kubeCa;

function loadKubeCreds() {
  if (kubeToken) return;
  kubeToken = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8");
  kubeCa = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");
}

function kubeRequest(method, apiPath, body) {
  loadKubeCreds();
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT || "443";
  const payload = body ? JSON.stringify(body) : null;
  const isIPv6 = host?.includes(":");

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        port,
        path: apiPath,
        method,
        ca: kubeCa,
        servername: isIPv6 ? "kubernetes.default.svc" : undefined,
        headers: {
          Authorization: `Bearer ${kubeToken}`,
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/merge-patch+json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(chunks ? JSON.parse(chunks) : null);
          } else {
            reject(new Error(`kube ${method} ${apiPath}: ${res.statusCode} ${chunks}`));
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const ALWAYS_ON_ANNOTATIONS = {
  "autoscaling.keda.sh/force-activation": "true",
  "autoscaling.keda.sh/paused-scale-in": "true",
};

const CLEAR_ALWAYS_ON_ANNOTATIONS = {
  "autoscaling.keda.sh/force-activation": null,
  "autoscaling.keda.sh/paused-scale-in": null,
  "autoscaling.keda.sh/paused": null,
  "autoscaling.keda.sh/paused-replicas": null,
};

function mapScaledObject(item) {
  return {
    namespace: item.metadata.namespace,
    name: item.metadata.name,
    minReplicaCount: item.spec?.minReplicaCount ?? 0,
    scaleTargetRef: item.spec?.scaleTargetRef?.name ?? item.metadata.name,
  };
}

export async function listToggleable() {
  const query = `labelSelector=${encodeURIComponent(TOGGLE_LABEL)}`;
  const data = await kubeRequest("GET", `/apis/${KEDA_GROUP}/${KEDA_VERSION}/${KEDA_PLURAL}?${query}`);
  return (data.items || []).map(mapScaledObject);
}

export async function getToggleable(namespace, name) {
  const item = await kubeRequest(
    "GET",
    `/apis/${KEDA_GROUP}/${KEDA_VERSION}/namespaces/${namespace}/${KEDA_PLURAL}/${name}`,
  );
  if (item.metadata?.labels?.["scaling.rafaelgaspar.xyz/homepage-toggle"] !== "true") {
    throw new Error("ScaledObject is not homepage-toggleable");
  }
  return mapScaledObject(item);
}

async function scaleDeployment(namespace, name, replicas) {
  return kubeRequest("PATCH", `/apis/apps/v1/namespaces/${namespace}/deployments/${name}/scale`, {
    spec: { replicas },
  });
}

async function applyToggleState(namespace, name, item, minReplicaCount, options) {
  const deployment = item.scaleTargetRef ?? name;
  const soPath = `/apis/${KEDA_GROUP}/${KEDA_VERSION}/namespaces/${namespace}/${KEDA_PLURAL}/${name}`;

  if (minReplicaCount === 1) {
    await kubeRequest("PATCH", soPath, {
      spec: { minReplicaCount: 1 },
      metadata: { annotations: ALWAYS_ON_ANNOTATIONS },
    });
    await scaleDeployment(namespace, deployment, 1);
    return;
  }

  await kubeRequest("PATCH", soPath, {
    metadata: { annotations: CLEAR_ALWAYS_ON_ANNOTATIONS },
  });
  await kubeRequest("PATCH", soPath, {
    spec: { minReplicaCount: 0 },
  });
  if (options?.scaleDown) {
    await scaleDeployment(namespace, deployment, 0);
  }
}

export async function setToggleState(namespace, name, { minReplicaCount, scaleDown = false } = {}) {
  const item = await getToggleable(namespace, name);
  let next = item.minReplicaCount === 0 ? 1 : 0;
  if (minReplicaCount !== undefined && minReplicaCount !== null) {
    next = Number(minReplicaCount);
    if (!Number.isInteger(next) || next < 0 || next > 1) {
      throw new Error("minReplicaCount must be 0 or 1");
    }
  }
  await applyToggleState(namespace, name, item, next, { scaleDown });
  return {
    namespace,
    name,
    minReplicaCount: next,
  };
}
