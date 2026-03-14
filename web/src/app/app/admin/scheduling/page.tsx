import { SchedulingPolicyForm } from "@/components/admin/scheduling-policy-form";

export default function AdminSchedulingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Scheduling Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure cancellation and reschedule policy windows for operations.
        </p>
      </header>
      <SchedulingPolicyForm />
    </div>
  );
}
