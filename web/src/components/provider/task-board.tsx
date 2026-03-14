"use client";

import { useEffect, useState } from "react";

type ProviderTask = {
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
};

type ProviderAppointment = {
  patientUserId: string;
  patientEmail: string;
};

type ProviderPatientOption = {
  patientUserId: string;
  patientEmail: string;
};

export function ProviderTaskBoard() {
  const [tasks, setTasks] = useState<ProviderTask[]>([]);
  const [patients, setPatients] = useState<ProviderPatientOption[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "error" | "saved">("loading");

  async function load(showLoading = true) {
    if (showLoading) setState("loading");

    const [tasksResponse, appointmentsResponse] = await Promise.all([
      fetch("/api/tasks?view=provider", { cache: "no-store" }),
      fetch("/api/appointments?view=provider", { cache: "no-store" }),
    ]);

    if (!tasksResponse.ok || !appointmentsResponse.ok) {
      setState("error");
      return;
    }

    const tasksPayload = await tasksResponse.json();
    const appointmentsPayload = await appointmentsResponse.json();

    const taskItems = (tasksPayload?.data?.tasks ?? []) as ProviderTask[];
    const appointments = (appointmentsPayload?.data?.appointments ?? []) as ProviderAppointment[];

    const uniquePatients = new Map<string, ProviderPatientOption>();
    for (const appointment of appointments) {
      if (!appointment.patientUserId) continue;
      uniquePatients.set(appointment.patientUserId, {
        patientUserId: appointment.patientUserId,
        patientEmail: appointment.patientEmail,
      });
    }

    setTasks(taskItems);
    setPatients(Array.from(uniquePatients.values()));
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/tasks?view=provider", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/appointments?view=provider", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
    ])
      .then(([tasksPayload, appointmentsPayload]) => {
        if (!active) return;

        const taskItems = (tasksPayload?.data?.tasks ?? []) as ProviderTask[];
        const appointments = (appointmentsPayload?.data?.appointments ?? []) as ProviderAppointment[];

        const uniquePatients = new Map<string, ProviderPatientOption>();
        for (const appointment of appointments) {
          if (!appointment.patientUserId) continue;
          uniquePatients.set(appointment.patientUserId, {
            patientUserId: appointment.patientUserId,
            patientEmail: appointment.patientEmail,
          });
        }

        setTasks(taskItems);
        setPatients(Array.from(uniquePatients.values()));
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
      }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    setState("saved");
    await load(false);
  }

  async function updateStatus(task: ProviderTask, nextStatus: ProviderTask["status"]) {
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

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create Care Task</h2>
        <p className="mt-1 text-xs text-slate-500">
          Assign structured follow-up tasks to patients in your panel.
        </p>
        <form action={createTask} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Patient</span>
            <select
              name="patientUserId"
              required
              disabled={patients.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {patients.length === 0 ? <option value="">No patient assignment available</option> : null}
              {patients.map((patient) => (
                <option key={patient.patientUserId} value={patient.patientUserId}>
                  {patient.patientEmail}
                </option>
              ))}
            </select>
          </label>
          <Field label="Title" name="title" placeholder="Submit blood pressure log" />
          <Field label="Due Date" name="dueAt" type="datetime-local" required={false} />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
              placeholder="Share home readings before next follow-up."
            />
          </label>
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
          <button
            type="submit"
            disabled={patients.length === 0}
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create Task
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Task Queue</h2>
        {state === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {state === "error" ? (
          <p className="text-sm text-rose-600">Unable to load or update tasks.</p>
        ) : null}
        {state === "saved" ? <p className="text-sm text-emerald-700">Task created.</p> : null}

        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{task.title}</p>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {task.patientName} • {task.patientEmail}
              </p>
              {task.description ? <p className="mt-1 text-sm text-slate-600">{task.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Action
                  label="To Do"
                  onClick={() => updateStatus(task, "todo")}
                  active={task.status === "todo"}
                />
                <Action
                  label="In Progress"
                  onClick={() => updateStatus(task, "in_progress")}
                  active={task.status === "in_progress"}
                />
                <Action
                  label="Done"
                  onClick={() => updateStatus(task, "done")}
                  active={task.status === "done"}
                />
                <Action
                  label="Blocked"
                  onClick={() => updateStatus(task, "blocked")}
                  active={task.status === "blocked"}
                />
              </div>
            </li>
          ))}
          {tasks.length === 0 && state === "idle" ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              No tasks assigned yet.
            </li>
          ) : null}
        </ul>
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

function Action({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
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
