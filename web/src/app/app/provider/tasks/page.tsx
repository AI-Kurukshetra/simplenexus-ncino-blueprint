import { ProviderTaskBoard } from "@/components/provider/task-board";

export default function ProviderTasksPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Provider Tasks</h1>
        <p className="mt-1 text-sm text-slate-600">
          Assign and manage patient follow-up tasks for continuity of care.
        </p>
      </header>
      <ProviderTaskBoard />
    </div>
  );
}
