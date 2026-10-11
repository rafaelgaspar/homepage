import { evaluateDashboardConfigReadiness } from "utils/config/reload-state";

function handler(req, res) {
  const { ready, reason } = evaluateDashboardConfigReadiness();
  if (!ready) {
    res.status(503).send(reason ?? "config reloading");
    return;
  }
  res.send("ready");
}

export default handler;
