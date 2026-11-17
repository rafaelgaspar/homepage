import { formatRunDuration, runPhaseTone } from "utils/k3s-home/health";
import { k3sHomeCacheKey, k3sHomeStatusUrl } from "utils/k3s-home/keys";
import { useLiveStatus } from "utils/live-status/client";

const TONE_TEXT = {
  green: "text-emerald-500/80",
  red: "text-rose-500/80",
  orange: "text-orange-400/50 dark:text-orange-400/80",
  gray: "text-black/20 dark:text-white/40 opacity-20",
};

export default function K3sHomeRunStatus({ service, style }) {
  const name = service?.k3sHome?.name;
  const { data } = useLiveStatus(k3sHomeCacheKey("run", name), {
    fallbackUrl: k3sHomeStatusUrl("run", name),
  });
  const run = data ?? service?.k3sHome;
  const tone = runPhaseTone(run?.phase);
  let colorClass = TONE_TEXT[tone] ?? TONE_TEXT.gray;
  let backgroundClass = "px-1.5 py-0.5 bg-theme-500/10 dark:bg-theme-900/50";
  const title = `Duration: ${formatRunDuration(run)}`;

  if (style === "dot") {
    colorClass = colorClass.replace(/text-/g, "bg-").replace(/\/\d\d/g, "");
    backgroundClass = "p-4 hover:bg-theme-500/10 dark:hover:bg-theme-900/20";
  }

  return (
    <div
      className={`w-auto text-center overflow-hidden ${backgroundClass} rounded-b-[3px] k3s-home-run-status`}
      title={title}
      data-testid="k3s-home-run-status"
    >
      {style !== "dot" ? (
        <div className={`text-[8px] font-bold ${colorClass} uppercase`}>{run?.phase || tone}</div>
      ) : (
        <div className={`rounded-full h-3 w-3 ${colorClass}`} />
      )}
    </div>
  );
}
