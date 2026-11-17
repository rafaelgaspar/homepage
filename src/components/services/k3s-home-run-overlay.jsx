import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POLL_MS = 5_000;

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined || item === "") {
          return "";
        }
        if (typeof item === "string" || typeof item === "number") {
          return String(item);
        }
        if (typeof item === "object") {
          return item.name || item.node || item.step || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => (item === null || item === undefined || item === "" ? key : `${key}: ${item}`))
      .join(", ");
  }
  return String(value);
}

function rows(entries) {
  return entries.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function FieldList({ entries }) {
  const visible = rows(entries);
  if (!visible.length) {
    return null;
  }
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
      {visible.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-theme-500 dark:text-theme-400">{label}</dt>
          <dd className="break-words text-theme-800 dark:text-theme-100">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TaskDetails({ task }) {
  const detailsRef = useRef(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || task.phase !== "Running" || !detailsRef.current) {
      return;
    }
    detailsRef.current.open = true;
    seeded.current = true;
  }, [task.phase]);

  return (
    <details ref={detailsRef}>
      <summary className="cursor-pointer text-sm">
        {task.name || task.step || "task"} · {task.phase}
        {task.node ? ` · ${task.node}` : ""}
      </summary>
      <div className="mt-1 pl-3">
        <FieldList
          entries={[
            ["Step", task.step],
            ["Stage", task.stage],
            ["Exit", task.exitCode],
            ["Started", task.startedAt],
            ["Finished", task.finishedAt],
            ["Message", task.message],
            ["Result", task.result],
          ]}
        />
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 text-xs dark:bg-white/5">
          {task.log || "No log"}
        </pre>
      </div>
    </details>
  );
}

function taskRunning(detail) {
  if (detail?.phase === "Running") {
    return true;
  }
  return (detail?.tasks ?? []).some((task) => task.phase === "Running");
}

export default function K3sHomeRunOverlay({ name, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let stopped = false;
    let timer = null;

    async function load() {
      try {
        const response = await fetch(`/api/k3s-home/run/${encodeURIComponent(name)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const body = await response.json();
        if (stopped) {
          return;
        }
        setDetail(body);
        setError("");
        if (taskRunning(body)) {
          timer = setTimeout(load, POLL_MS);
        }
      } catch (err) {
        if (!stopped) {
          setError(err?.message || "failed to load run");
          timer = setTimeout(load, POLL_MS);
        }
      }
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    load();

    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
      document.removeEventListener("keydown", onKey);
    };
  }, [name]);

  const nodes = detail?.nodes ?? {};

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 k3s-home-run-overlay">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close run" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        className="relative z-10 my-6 w-full max-w-3xl rounded-md bg-theme-50 p-4 text-theme-800 shadow-xl dark:bg-theme-800 dark:text-theme-100"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-medium">{name}</h2>
          <button type="button" className="text-sm text-theme-500" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="mb-2 text-sm text-rose-500">{error}</p> : null}
        {!detail && !error ? <p className="text-sm text-theme-500">Loading</p> : null}
        {detail ? (
          <div className="flex flex-col gap-4">
            <FieldList
              entries={[
                ["Schedule", detail.schedule],
                ["Kind", detail.kind],
                ["Phase", detail.phase],
                ["Outcome", detail.outcome],
                ["Trigger", detail.trigger],
                ["Dry run", detail.dryRun ? "true" : "false"],
                ["Fired", detail.firedAt],
                ["Started", detail.startedAt],
                ["Finished", detail.finishedAt],
                ["Window end", detail.windowEnd],
                ["Steps", formatValue(detail.steps)],
                ["Plan", formatValue(detail.plan)],
                ["Skipped", formatValue(detail.skipped)],
              ]}
            />
            {Object.keys(nodes).length > 0 ? (
              <section>
                <h3 className="mb-1 text-sm font-medium">Nodes</h3>
                <ul className="flex flex-col gap-1 text-xs">
                  {Object.entries(nodes).map(([node, info]) => (
                    <li key={node}>
                      {node}: {info?.phase || "-"}
                      {info?.step ? ` · ${info.step}` : ""}
                      {info?.message ? ` · ${info.message}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {detail.report ? (
              <section>
                <h3 className="mb-1 text-sm font-medium">Report</h3>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{detail.report}</pre>
              </section>
            ) : null}
            {detail.discordSummary ? (
              <section>
                <h3 className="mb-1 text-sm font-medium">Discord summary</h3>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{detail.discordSummary}</pre>
              </section>
            ) : null}
            <section>
              <h3 className="mb-1 text-sm font-medium">Tasks</h3>
              {(detail.tasks ?? []).length === 0 ? (
                <p className="text-xs text-theme-500">No tasks</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.tasks.map((task) => (
                    <TaskDetails key={task.name || `${task.node}-${task.step}`} task={task} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
