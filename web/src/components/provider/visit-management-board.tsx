"use client";

import { useEffect, useState } from "react";

type VisitStatus = "not_started" | "in_progress" | "completed";

type ProviderVisit = {
  appointmentId: string;
  patientUserId: string;
  patientEmail: string;
  startsAt: string;
  reason: string;
  appointmentType: "consult" | "follow-up" | "intake";
  appointmentStatus: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
  visitStatus: VisitStatus;
  startedAt?: string;
  completedAt?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updatedAt?: string;
};

type VisitDraft = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export function ProviderVisitManagementBoard() {
  const [visits, setVisits] = useState<ProviderVisit[]>([]);
  const [drafts, setDrafts] = useState<Record<string, VisitDraft>>({});
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [busyVisitId, setBusyVisitId] = useState<string | null>(null);
  const [messageByVisit, setMessageByVisit] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    fetch("/api/provider/visits", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Unable to load provider appointments.");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        const fetched = (payload?.data?.visits ?? []) as ProviderVisit[];
        setVisits(fetched);
        setErrorMessage(null);
        setDrafts(
          fetched.reduce<Record<string, VisitDraft>>((acc, visit) => {
            acc[visit.appointmentId] = {
              subjective: visit.subjective ?? "",
              objective: visit.objective ?? "",
              assessment: visit.assessment ?? "",
              plan: visit.plan ?? "",
            };
            return acc;
          }, {}),
        );
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setErrorMessage("Unable to load provider appointments. Ensure latest DB migrations are applied.");
        setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function manageVisit(
    appointmentId: string,
    action: "start" | "complete" | "save_notes",
  ) {
    setBusyVisitId(appointmentId);
    setMessageByVisit((previous) => ({ ...previous, [appointmentId]: "" }));

    const draft = drafts[appointmentId] ?? {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    };

    const body =
      action === "save_notes"
        ? {
            appointmentId,
            action,
            subjective: draft.subjective,
            objective: draft.objective,
            assessment: draft.assessment,
            plan: draft.plan,
          }
        : {
            appointmentId,
            action,
          };

    const response = await fetch("/api/provider/visits/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessageByVisit((previous) => ({
        ...previous,
        [appointmentId]: payload?.error?.message ?? "Unable to update visit.",
      }));
      setBusyVisitId(null);
      return;
    }

    const updated = payload?.data?.visit as
      | {
          appointmentId: string;
          visitStatus: VisitStatus;
          startedAt?: string;
          completedAt?: string;
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
          updatedAt?: string;
        }
      | undefined;

    if (updated) {
      setVisits((previous) =>
        previous.map((visit) =>
          visit.appointmentId === appointmentId
            ? {
                ...visit,
                visitStatus: updated.visitStatus,
                startedAt: updated.startedAt,
                completedAt: updated.completedAt,
                subjective: updated.subjective,
                objective: updated.objective,
                assessment: updated.assessment,
                plan: updated.plan,
                updatedAt: updated.updatedAt,
              }
            : visit,
        ),
      );
      setDrafts((previous) => ({
        ...previous,
        [appointmentId]: {
          subjective: updated.subjective ?? "",
          objective: updated.objective ?? "",
          assessment: updated.assessment ?? "",
          plan: updated.plan ?? "",
        },
      }));
    }

    setMessageByVisit((previous) => ({
      ...previous,
      [appointmentId]:
        action === "start"
          ? "Visit started."
          : action === "complete"
            ? "Visit completed."
            : "Notes saved.",
    }));
    setBusyVisitId(null);
  }

  function setDraftField(appointmentId: string, field: keyof VisitDraft, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [appointmentId]: {
        subjective: previous[appointmentId]?.subjective ?? "",
        objective: previous[appointmentId]?.objective ?? "",
        assessment: previous[appointmentId]?.assessment ?? "",
        plan: previous[appointmentId]?.plan ?? "",
        [field]: value,
      },
    }));
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Booked Appointments & Visit Notes</h2>
        <p className="mt-1 text-xs text-slate-500">
          Start visit, document clinical notes, and complete the appointment.
        </p>
      </header>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading booked appointments...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">
          {errorMessage ?? "Unable to load provider appointments."}
        </p>
      ) : null}

      {state === "idle" && visits.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
          No approved appointments available yet.
        </p>
      ) : null}

      <ul className="space-y-3">
        {visits.map((visit) => {
          const expanded = activeVisitId === visit.appointmentId;
          const draft = drafts[visit.appointmentId] ?? {
            subjective: "",
            objective: "",
            assessment: "",
            plan: "",
          };
          const busy = busyVisitId === visit.appointmentId;
          const isCompleted = visit.visitStatus === "completed";

          return (
            <li key={visit.appointmentId} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{visit.patientEmail}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(visit.startsAt).toLocaleString()} • {visit.appointmentType} • {visit.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <VisitStatusBadge status={visit.visitStatus} />
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVisitId((previous) =>
                        previous === visit.appointmentId ? null : visit.appointmentId,
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {expanded ? "Hide details" : "Open details"}
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <NoteField
                      label="Subjective"
                      value={draft.subjective}
                      onChange={(value) => setDraftField(visit.appointmentId, "subjective", value)}
                    />
                    <NoteField
                      label="Objective"
                      value={draft.objective}
                      onChange={(value) => setDraftField(visit.appointmentId, "objective", value)}
                    />
                    <NoteField
                      label="Assessment"
                      value={draft.assessment}
                      onChange={(value) => setDraftField(visit.appointmentId, "assessment", value)}
                    />
                    <NoteField
                      label="Plan"
                      value={draft.plan}
                      onChange={(value) => setDraftField(visit.appointmentId, "plan", value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || isCompleted || visit.visitStatus === "in_progress"}
                      onClick={() => void manageVisit(visit.appointmentId, "start")}
                      className="rounded-md bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Start Appointment
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void manageVisit(visit.appointmentId, "save_notes")}
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save Notes
                    </button>
                    <button
                      type="button"
                      disabled={busy || isCompleted}
                      onClick={() => void manageVisit(visit.appointmentId, "complete")}
                      className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Complete Appointment
                    </button>
                  </div>

                  {visit.startedAt ? (
                    <p className="text-xs text-slate-600">
                      Started: {new Date(visit.startedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {visit.completedAt ? (
                    <p className="text-xs text-slate-600">
                      Completed: {new Date(visit.completedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {messageByVisit[visit.appointmentId] ? (
                    <p className="text-xs text-slate-700">{messageByVisit[visit.appointmentId]}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NoteField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
      />
    </label>
  );
}

function VisitStatusBadge({ status }: { status: VisitStatus }) {
  if (status === "completed") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
        Completed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
        In progress
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
      Not started
    </span>
  );
}
