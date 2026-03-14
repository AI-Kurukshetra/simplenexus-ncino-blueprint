import { NotificationCenter } from "@/components/shared/notification-center";

export default function AdminMessagesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Notifications and Reminder Ops
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitor in-app notification flow and manually run reminder dispatch.
        </p>
      </header>
      <NotificationCenter allowReminderRun appointmentBasePath={null} />
    </div>
  );
}
