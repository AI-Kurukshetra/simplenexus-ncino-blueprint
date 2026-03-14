import { NotificationCenter } from "@/components/shared/notification-center";

export default function ProviderMessagesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review scheduling reminders and patient communication events.
        </p>
      </header>
      <NotificationCenter appointmentBasePath={null} />
    </div>
  );
}
