import { ScheduleManager } from "@/components/provider/schedule-manager";

export default function ProviderSchedulePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Schedule Management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure recurring weekly clinic hours, slot duration, and conflict-safe booking windows.
        </p>
      </header>
      <ScheduleManager />
    </div>
  );
}
