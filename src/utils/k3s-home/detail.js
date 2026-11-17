import { RUN_PLURAL, TASK_PLURAL } from "utils/k3s-home/constants";
import { getClusterObject } from "utils/k3s-home/list";
import { mapRunDetail, taskObjectNames } from "utils/k3s-home/map";

/** Full run plus task logs. This is not published on the dashboard live-status stream. */
export async function getMaintenanceRunDetail(name) {
  const run = await getClusterObject(RUN_PLURAL, name);
  if (!run) {
    return null;
  }
  const names = taskObjectNames(run);
  const tasks = await Promise.all(names.map((taskName) => getClusterObject(TASK_PLURAL, taskName)));
  return mapRunDetail(run, tasks);
}
