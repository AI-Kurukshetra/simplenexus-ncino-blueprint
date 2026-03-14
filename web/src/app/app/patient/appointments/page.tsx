import { redirect } from "next/navigation";

export default function PatientAppointmentsPage() {
  redirect("/app/patient/appointments/booked");
}
