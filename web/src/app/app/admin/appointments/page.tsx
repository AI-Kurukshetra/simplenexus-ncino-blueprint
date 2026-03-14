import { AppointmentReviewTable } from "@/components/admin/appointment-review-table";

export default function AdminAppointmentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Appointment Governance
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitor and manage appointment approvals across providers.
        </p>
      </header>
      <AppointmentReviewTable />
    </div>
  );
}
