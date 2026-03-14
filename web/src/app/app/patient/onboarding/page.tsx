import { OnboardingWizard } from "@/components/patient/onboarding-wizard";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getPatientOnboardingSnapshotForUser } from "@/lib/patients/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PatientOnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/app/patient/onboarding");
  }

  const onboarding = await getPatientOnboardingSnapshotForUser(user);
  const submittedAt = onboarding.snapshot.submittedAt;
  const isComplete = onboarding.snapshot.onboardingStatus === "submitted";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Patient Onboarding
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete your intake details. Progress is saved so you can resume.
        </p>
      </header>
      {isComplete ? (
        <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-900">Onboarding Completed</h2>
          <p className="text-sm text-emerald-800">
            Your onboarding has been completed and you are ready to request appointments.
          </p>
          {submittedAt ? (
            <p className="text-xs text-emerald-700">
              Submitted on {new Date(submittedAt).toLocaleString()}.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/patient/appointments/schedule"
              className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Book appointment
            </Link>
            <Link
              href="/app/patient/dashboard"
              className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      ) : (
        <OnboardingWizard />
      )}
    </div>
  );
}
