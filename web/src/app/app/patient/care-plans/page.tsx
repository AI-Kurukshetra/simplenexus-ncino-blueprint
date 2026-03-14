import { CarePlanBoard } from "@/components/patient/care-plan-board";

export default function PatientCarePlansPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Care Plans</h1>
        <p className="mt-1 text-sm text-slate-600">
          Follow your assigned tasks and track progress between visits.
        </p>
      </header>
      <CarePlanBoard />
    </div>
  );
}
