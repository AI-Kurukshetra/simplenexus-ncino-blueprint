import { ProviderApprovalTable } from "@/components/admin/provider-approval-table";

export default function AdminProvidersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Provider Management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verify and approve provider accounts before they can serve patients.
        </p>
      </header>
      <ProviderApprovalTable />
    </div>
  );
}
