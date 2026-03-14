import { AppointmentsShell } from "@/components/patient/appointments-shell";

export default function PatientAppointmentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Appointments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View upcoming visits and book new appointments.
        </p>
      </header>
      <AppointmentsShell />
    </div>
  );
}
