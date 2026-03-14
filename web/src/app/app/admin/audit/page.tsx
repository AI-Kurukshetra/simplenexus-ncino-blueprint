import { AuditRetryPanel } from "@/components/admin/audit-retry-panel";

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Audit Operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitor and retry failed audit events to keep compliance logs complete.
        </p>
      </header>

      <AuditRetryPanel />
    </div>
  );
}
