import { ClaimsTable } from "@/components/admin/claims-table";

export default function AdminClaimsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Claims</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review claim lifecycle status and reimbursement readiness.
        </p>
      </header>
      <ClaimsTable />
    </div>
  );
}
