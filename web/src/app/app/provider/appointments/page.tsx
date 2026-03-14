import { ProviderVisitManagementBoard } from "@/components/provider/visit-management-board";

export default function ProviderAppointmentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Provider Appointments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View approved visits, document appointment notes, and complete consultations.
        </p>
      </header>
      <ProviderVisitManagementBoard />
    </div>
  );
}
