import { OnboardingWizard } from "@/components/patient/onboarding-wizard";

export default function PatientOnboardingPage() {
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
      <OnboardingWizard />
    </div>
  );
}
