import { DashboardCard } from "@/components/layout/dashboard-card";
import { AppointmentApprovalBoard } from "@/components/provider/appointment-approval-board";
import Link from "next/link";

export default function ProviderDashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Provider Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Today&apos;s queue, charting tasks, and follow-ups.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard title="Visits Today" value="7" hint="3 telehealth, 4 follow-up" />
        <DashboardCard title="Pending Notes" value="3" hint="Need final sign-off" />
        <DashboardCard title="Urgent Follow-ups" value="1" hint="Medication review" />
      </section>
      <section className="flex flex-wrap gap-2">
        <Link
          href="/app/provider/appointments"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open Appointments
        </Link>
        <Link
          href="/app/provider/schedule"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Manage Schedule
        </Link>
        <Link
          href="/app/provider/messages"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open Messages
        </Link>
        <Link
          href="/app/provider/tasks"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open Tasks
        </Link>
      </section>
      <AppointmentApprovalBoard />
    </div>
  );
}
