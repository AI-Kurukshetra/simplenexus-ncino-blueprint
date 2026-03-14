import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listRequestsForPatient } from "@/lib/appointments/store";
import { AppointmentDetailActions } from "@/components/patient/appointment-detail-actions";
import { getRoleFromUser } from "@/lib/auth/roles";
import { listProviders } from "@/lib/providers/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PatientAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/app/patient/appointments");
  }

  if (getRoleFromUser(user) !== "patient") {
    redirect("/app/unauthorized");
  }

  const appointments = await listRequestsForPatient(user);
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) {
    notFound();
  }

  const { providers } = await listProviders();
  const provider = providers.find((item) => item.id === appointment.providerId);
  const providerName = provider?.fullName ?? "Provider";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/app/patient/appointments"
          className="inline-flex text-sm text-sky-700 hover:text-sky-900"
        >
          Back to appointments
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Appointment Detail</h1>
        <p className="text-sm text-slate-600">
          Track request status and timeline for this appointment.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Status" value={statusLabel(appointment.status)} />
        <InfoCard label="Provider" value={providerName} />
        <InfoCard label="Type" value={appointment.appointmentType} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Request Summary</h2>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Reason" value={appointment.reason} />
          <InfoRow label="Requested for" value={new Date(appointment.startsAt).toLocaleString()} />
          <InfoRow label="Requested at" value={new Date(appointment.requestedAt).toLocaleString()} />
          <InfoRow
            label="Decision at"
            value={appointment.decidedAt ? new Date(appointment.decidedAt).toLocaleString() : "-"}
          />
          <InfoRow label="Decision by" value={appointment.decidedBy ?? "-"} />
          <InfoRow label="Patient Email" value={appointment.patientEmail} />
        </dl>
      </section>

      <AppointmentDetailActions
        appointmentId={appointment.id}
        providerId={appointment.providerId}
        status={appointment.status}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
        <ul className="mt-3 space-y-2">
          {[...appointment.events]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((event) => (
              <li key={event.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{eventLabel(event.type)}</p>
                <p className="text-xs text-slate-600">{new Date(event.at).toLocaleString()}</p>
                {event.note ? <p className="mt-1 text-xs text-slate-700">{event.note}</p> : null}
              </li>
            ))}
          {appointment.events.length === 0 ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
              No timeline events yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-800">{value}</dd>
    </div>
  );
}

function statusLabel(
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled",
) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return "Pending Provider Approval";
}

function eventLabel(
  type:
    | "requested"
    | "approved"
    | "rejected"
    | "rescheduled"
    | "cancelled"
    | "reminder_24h_scheduled"
    | "reminder_1h_scheduled"
    | "reminder_24h_sent"
    | "reminder_1h_sent",
) {
  if (type === "requested") return "Request Created";
  if (type === "approved") return "Approved";
  if (type === "rejected") return "Rejected";
  if (type === "rescheduled") return "Rescheduled";
  if (type === "cancelled") return "Cancelled";
  if (type === "reminder_24h_scheduled") return "24h Reminder Scheduled";
  if (type === "reminder_1h_scheduled") return "1h Reminder Scheduled";
  if (type === "reminder_24h_sent") return "24h Reminder Sent";
  return "1h Reminder Sent";
}
