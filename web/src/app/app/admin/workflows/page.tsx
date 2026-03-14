import { WorkflowTaskTable } from "@/components/admin/workflow-task-table";

export default function AdminWorkflowsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Workflow Operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage cross-role care tasks and operational workflow states.
        </p>
      </header>
      <WorkflowTaskTable />
    </div>
  );
}
