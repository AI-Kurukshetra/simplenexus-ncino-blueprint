import Link from "next/link";

import { AppointmentsShell } from "@/components/patient/appointments-shell";

export default function PatientScheduleAppointmentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Schedule Appointment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Select provider, choose a slot, and submit a new appointment request.
        </p>
      </header>
      <nav className="flex gap-2 text-sm">
        <Link
          href="/app/patient/appointments/booked"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Booked
        </Link>
        <Link
          href="/app/patient/appointments/schedule"
          className="rounded-md bg-slate-900 px-3 py-2 font-medium text-white"
        >
          Schedule New
        </Link>
      </nav>
      <AppointmentsShell mode="schedule" />
    </div>
  );
}
