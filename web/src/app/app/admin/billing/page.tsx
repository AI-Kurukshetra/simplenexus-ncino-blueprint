import { BillingOpsPanel } from "@/components/admin/billing-ops-panel";

export default function AdminBillingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing Operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage invoices, monitor balances, and run insurance verification controls.
        </p>
      </header>
      <BillingOpsPanel />
    </div>
  );
}
