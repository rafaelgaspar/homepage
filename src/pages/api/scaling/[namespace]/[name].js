import createLogger from "utils/logger";
import { getToggleable, setToggleState } from "utils/scaling/service";

const logger = createLogger("scaling");

export default async function handler(req, res) {
  const { namespace, name } = req.query;
  if (!namespace || !name || Array.isArray(namespace) || Array.isArray(name)) {
    return res.status(400).json({ error: "namespace and name required" });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json(await getToggleable(namespace, name));
    }

    if (req.method === "POST") {
      const minReplicaCount = req.query.minReplicaCount;
      const scaleDown = req.query.scaleDown === "1";
      const result = await setToggleState(namespace, name, {
        ...(minReplicaCount !== undefined ? { minReplicaCount: Number(minReplicaCount) } : {}),
        scaleDown,
      });
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    logger.error("scaling %s/%s failed: %s", namespace, name, err);
    const message = String(err.message || err);
    if (message.includes("homepage-toggleable")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("minReplicaCount must be")) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}
