import { PatientManagementTable } from "@/components/admin/patient-management-table";

export default function AdminPatientsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Patient Management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review onboarding readiness and patient scheduling eligibility.
        </p>
      </header>
      <PatientManagementTable />
    </div>
  );
}
