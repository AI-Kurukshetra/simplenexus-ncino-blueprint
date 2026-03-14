import { PatientBillingCenter } from "@/components/patient/billing-center";

export default function PatientBillingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review invoices, submit payments, and keep insurance information updated.
        </p>
      </header>
      <PatientBillingCenter />
    </div>
  );
}
