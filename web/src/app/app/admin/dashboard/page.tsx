import { DashboardCard } from "@/components/layout/dashboard-card";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Organization health, queue monitoring, and operations.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard title="Active Patients" value="248" hint="Across all providers" />
        <DashboardCard
          title="Provider Verifications"
          value="Queue live"
          hint="Approve or reject requests"
        />
        <DashboardCard title="Integration Alerts" value="0" hint="All services healthy" />
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Admin has full operational control across patient readiness, provider verification, and
          appointment governance.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/app/admin/patients"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Patient Ops
          </Link>
          <Link
            href="/app/admin/scheduling"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Scheduling Policy
          </Link>
          <Link
            href="/app/admin/messages"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Messages
          </Link>
          <Link
            href="/app/admin/workflows"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Workflows
          </Link>
          <Link
            href="/app/admin/providers"
            className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            Open Provider Queue
          </Link>
          <Link
            href="/app/admin/appointments"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Appointment Queue
          </Link>
          <Link
            href="/app/admin/billing"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Billing Ops
          </Link>
          <Link
            href="/app/admin/claims"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Claims
          </Link>
          <Link
            href="/app/admin/audit"
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Audit Ops
          </Link>
        </div>
      </section>
    </div>
  );
}
