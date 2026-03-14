"use client";

import { useEffect, useState } from "react";

type AdminTask = {
  id: string;
  patientUserId: string;
  patientEmail: string;
  patientName: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done" | "blocked";
  dueAt?: string;
  createdAt: string;
  assignedProviderId?: string;
};

type PatientOption = {
  id: string;
  email: string;
  fullName: string;
};

export function WorkflowTaskTable() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [filter, setFilter] = useState<"all" | "todo" | "in_progress" | "done" | "blocked">("all");
  const [state, setState] = useState<"loading" | "idle" | "error" | "saved">("loading");

  async function load(nextFilter = filter, showLoading = true) {
    if (showLoading) setState("loading");

    const [tasksResponse, patientsResponse] = await Promise.all([
      fetch("/api/tasks?view=admin", { cache: "no-store" }),
      fetch("/api/admin/patients?status=all", { cache: "no-store" }),
    ]);

    if (!tasksResponse.ok || !patientsResponse.ok) {
      setState("error");
      return;
    }

    const tasksPayload = await tasksResponse.json();
    const patientsPayload = await patientsResponse.json();

    const allTasks = (tasksPayload?.data?.tasks ?? []) as AdminTask[];
    const patientOptions = (patientsPayload?.data?.patients ?? []) as PatientOption[];

    setPatients(patientOptions);
    setTasks(nextFilter === "all" ? allTasks : allTasks.filter((task) => task.status === nextFilter));
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/tasks?view=admin", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/patients?status=all", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
    ])
      .then(([tasksPayload, patientsPayload]) => {
        if (!active) return;
        const allTasks = (tasksPayload?.data?.tasks ?? []) as AdminTask[];
        const patientOptions = (patientsPayload?.data?.patients ?? []) as PatientOption[];
        setPatients(patientOptions);
        setTasks(allTasks);
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

  async function createTask(formData: FormData) {
    const patientUserId = String(formData.get("patientUserId") ?? "");
    const title = String(formData.get("title") ?? "");
    const description = String(formData.get("description") ?? "");
    const dueAtRaw = String(formData.get("dueAt") ?? "");
    const assignedProviderIdRaw = String(formData.get("assignedProviderId") ?? "");
    const priority = String(formData.get("priority") ?? "medium") as "low" | "medium" | "high";

    const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : undefined;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientUserId,
        title,
        description,
        dueAt,
        priority,
        assignedProviderId: assignedProviderIdRaw || undefined,
      }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    setState("saved");
    await load(filter, false);
  }

  async function updateTask(task: AdminTask, nextStatus: AdminTask["status"]) {
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

    await load(filter, false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create Workflow Task</h2>
        <form action={createTask} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Patient</span>
            <select
              name="patientUserId"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} - {patient.email}
                </option>
              ))}
            </select>
          </label>
          <Field label="Title" name="title" placeholder="Upload insurance card" />
          <Field label="Due Date" name="dueAt" type="datetime-local" required={false} />
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Priority</span>
            <select
              name="priority"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <Field
            label="Assigned Provider ID (optional)"
            name="assignedProviderId"
            required={false}
            placeholder="provider_user_id"
          />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Create Task
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Workflow Queue</h2>
          <select
            value={filter}
            onChange={(event) => {
              const next = event.target.value as "all" | "todo" | "in_progress" | "done" | "blocked";
              setFilter(next);
              void load(next, false);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {state === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {state === "error" ? (
          <p className="text-sm text-rose-600">Unable to load or update workflow tasks.</p>
        ) : null}
        {state === "saved" ? <p className="text-sm text-emerald-700">Task created.</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Patient</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Due</th>
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <p className="font-medium text-slate-900">{task.title}</p>
                    {task.description ? <p className="text-xs text-slate-600">{task.description}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-slate-700">
                    {task.patientName}
                    <br />
                    <span className="text-xs text-slate-500">{task.patientEmail}</span>
                  </td>
                  <td className="px-2 py-2">
                    <Priority priority={task.priority} />
                  </td>
                  <td className="px-2 py-2">
                    <Status status={task.status} />
                  </td>
                  <td className="px-2 py-2 text-slate-700">
                    {task.dueAt ? new Date(task.dueAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-2 py-2 text-slate-700">{task.assignedProviderId ?? "-"}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Action label="Todo" onClick={() => updateTask(task, "todo")} />
                      <Action label="In Progress" onClick={() => updateTask(task, "in_progress")} />
                      <Action label="Done" onClick={() => updateTask(task, "done")} />
                      <Action label="Blocked" onClick={() => updateTask(task, "blocked")} />
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && state === "idle" ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                    No tasks in this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        required={required}
        type={type}
        name={name}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
      />
    </label>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function Priority({ priority }: { priority: "low" | "medium" | "high" }) {
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

function Status({ status }: { status: "todo" | "in_progress" | "done" | "blocked" }) {
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
    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">To Do</span>
  );
}
