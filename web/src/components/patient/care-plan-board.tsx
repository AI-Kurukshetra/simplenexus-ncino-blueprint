"use client";

import { useEffect, useState } from "react";

type CareTask = {
  id: string;
  patientUserId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done" | "blocked";
  dueAt?: string;
  createdAt: string;
  completedAt?: string;
};

export function CarePlanBoard() {
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  async function load(showLoading = true) {
    if (showLoading) setState("loading");

    const response = await fetch("/api/tasks?view=patient", { cache: "no-store" });
    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setTasks(payload?.data?.tasks ?? []);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/tasks?view=patient", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setTasks(payload?.data?.tasks ?? []);
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function updateStatus(task: CareTask, nextStatus: "in_progress" | "done") {
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientUserId: task.patientUserId,
        taskId: task.id,
        nextStatus,
      }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    await load(false);
  }

  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");

  return (
    <div className="space-y-5">
      {state === "loading" ? <p className="text-sm text-slate-500">Loading care plan...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">Unable to load or update care tasks.</p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Active Care Tasks</h2>
        <ul className="space-y-2">
          {openTasks.map((task) => (
            <li key={task.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{task.title}</p>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
              </div>
              {task.description ? <p className="mt-1 text-sm text-slate-600">{task.description}</p> : null}
              <p className="mt-1 text-xs text-slate-500">
                Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : "Not set"}
              </p>
              <div className="mt-3 flex gap-2">
                {task.status === "todo" ? (
                  <button
                    type="button"
                    onClick={() => updateStatus(task, "in_progress")}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Start
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => updateStatus(task, "done")}
                  className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                >
                  Mark Done
                </button>
              </div>
            </li>
          ))}
          {openTasks.length === 0 && state === "idle" ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              No active care tasks.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Completed</h2>
        <ul className="space-y-2">
          {completedTasks.map((task) => (
            <li key={task.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-medium text-slate-900">{task.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                Completed: {task.completedAt ? new Date(task.completedAt).toLocaleString() : "-"}
              </p>
            </li>
          ))}
          {completedTasks.length === 0 && state === "idle" ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              No completed tasks yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "todo" | "in_progress" | "done" | "blocked";
}) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
        Done
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800">
        In Progress
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800">
        Blocked
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
      To Do
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" }) {
  if (priority === "high") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800">High</span>
    );
  }
  if (priority === "medium") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Medium</span>
    );
  }
  return <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">Low</span>;
}
