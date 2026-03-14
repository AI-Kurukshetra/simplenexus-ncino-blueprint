import { DashboardCard } from "@/components/layout/dashboard-card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getPatientOnboardingSnapshotForUser } from "@/lib/patients/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function onboardingLabel(status: "not_started" | "in_progress" | "submitted") {
  if (status === "submitted") return "Submitted";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export default async function PatientDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/app/patient/dashboard");
  }

  const onboarding = await getPatientOnboardingSnapshotForUser(user);
  const onboardingStatus = onboarding.snapshot.onboardingStatus;
  const readyForScheduling = onboarding.snapshot.readyForScheduling;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Patient Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upcoming care, tasks, and messages in one place.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          title="Next Appointment"
          value={readyForScheduling ? "Request one now" : "Onboarding needed"}
          hint={
            readyForScheduling
              ? "Provider approval required after request"
              : "Complete onboarding to unlock booking"
          }
        />
        <DashboardCard
          title="Onboarding"
          value={onboardingLabel(onboardingStatus)}
          hint={readyForScheduling ? "Ready for care scheduling" : "Finish intake steps"}
        />
        <DashboardCard title="Unread Messages" value="1 thread" hint="Provider team" />
      </section>
      <section className="flex flex-wrap gap-3">
        <Link
          href="/app/patient/onboarding"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Continue onboarding
        </Link>
        <Link
          href="/app/patient/appointments"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Manage appointments
        </Link>
        <Link
          href="/app/patient/messages"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open messages
        </Link>
        <Link
          href="/app/patient/care-plans"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          View care plans
        </Link>
      </section>
    </div>
  );
}
