import fs from "node:fs";
import https from "node:https";

let kubeToken;
let kubeCa;

function loadKubeCreds() {
  if (kubeToken) return;
  kubeToken = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8");
  kubeCa = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");
}

export function kubeRequest(method, apiPath, body) {
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

export function resetScalingKubeForTests() {
  kubeToken = undefined;
  kubeCa = undefined;
}
