"use client";

import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: "draft" | "issued" | "paid" | "void";
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  issuedAt: string;
  dueAt?: string;
};

type InsurancePlan = {
  id: string;
  payerName: string;
  memberId?: string;
  groupNumber?: string;
  planType?: string;
  subscriberName?: string;
  relationshipToSubscriber?: string;
  verificationStatus: string;
  coverageStatus: string;
  updatedAt: string;
};

export function PatientBillingCenter() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insurancePlan, setInsurancePlan] = useState<InsurancePlan | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    const [invoicesResponse, insuranceResponse] = await Promise.all([
      fetch("/api/billing/invoices?view=patient", { cache: "no-store" }),
      fetch("/api/billing/insurance", { cache: "no-store" }),
    ]);

    if (!invoicesResponse.ok || !insuranceResponse.ok) {
      setState("error");
      setMessage("Unable to load billing data.");
      return;
    }

    const invoicesPayload = await invoicesResponse.json();
    const insurancePayload = await insuranceResponse.json();
    setInvoices((invoicesPayload?.data?.invoices ?? []) as Invoice[]);
    const plans = (insurancePayload?.data?.plans ?? []) as InsurancePlan[];
    setInsurancePlan(plans[0] ?? null);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/billing/invoices?view=patient", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/billing/insurance", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([invoicesPayload, insurancePayload]) => {
        if (!active) return;
        setInvoices((invoicesPayload?.data?.invoices ?? []) as Invoice[]);
        const plans = (insurancePayload?.data?.plans ?? []) as InsurancePlan[];
        setInsurancePlan(plans[0] ?? null);
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
        setMessage("Unable to load billing data.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function payInvoice(invoiceId: string) {
    setState("saving");
    setMessage(null);

    const response = await fetch("/api/billing/payments/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        invoiceId,
        paymentMethod: "manual_card",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to process payment.");
      return;
    }

    await loadAll();
    setMessage("Payment recorded successfully.");
  }

  async function saveInsurance(formData: FormData) {
    setState("saving");
    setMessage(null);

    const response = await fetch("/api/billing/insurance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerName: String(formData.get("payerName") ?? ""),
        memberId: String(formData.get("memberId") ?? ""),
        groupNumber: String(formData.get("groupNumber") ?? ""),
        planType: String(formData.get("planType") ?? ""),
        subscriberName: String(formData.get("subscriberName") ?? ""),
        relationshipToSubscriber: String(formData.get("relationshipToSubscriber") ?? ""),
        coverageStatus: "active",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to save insurance plan.");
      return;
    }

    setInsurancePlan((payload?.data?.plan as InsurancePlan | undefined) ?? null);
    setState("idle");
    setMessage("Insurance plan saved.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
        <p className="mt-1 text-xs text-slate-500">
          Dummy/manual payment flow for MVP operations testing.
        </p>

        {state === "loading" ? <p className="mt-3 text-sm text-slate-500">Loading invoices...</p> : null}
        {invoices.length === 0 && state === "idle" ? (
          <p className="mt-3 text-sm text-slate-500">No invoices yet.</p>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Issued</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Total</th>
                <th className="px-2 py-2 font-medium">Outstanding</th>
                <th className="px-2 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {new Date(invoice.issuedAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">
                    <Status status={invoice.status} />
                  </td>
                  <td className="px-2 py-2 text-slate-700">${(invoice.totalCents / 100).toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-700">
                    ${(invoice.outstandingCents / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    {invoice.outstandingCents > 0 && invoice.status !== "void" ? (
                      <button
                        type="button"
                        onClick={() => void payInvoice(invoice.id)}
                        disabled={state === "saving"}
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Pay Now
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Insurance Plan</h2>
        <p className="mt-1 text-xs text-slate-500">
          Eligibility verification is placeholder-only in MVP.
        </p>

        <form action={saveInsurance} className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Payer Name" name="payerName" defaultValue={insurancePlan?.payerName ?? ""} />
          <Field label="Member ID" name="memberId" defaultValue={insurancePlan?.memberId ?? ""} />
          <Field label="Group Number" name="groupNumber" defaultValue={insurancePlan?.groupNumber ?? ""} />
          <Field label="Plan Type" name="planType" defaultValue={insurancePlan?.planType ?? ""} />
          <Field
            label="Subscriber Name"
            name="subscriberName"
            defaultValue={insurancePlan?.subscriberName ?? ""}
          />
          <Field
            label="Relationship"
            name="relationshipToSubscriber"
            defaultValue={insurancePlan?.relationshipToSubscriber ?? ""}
          />
          <button
            type="submit"
            disabled={state === "saving"}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Insurance
          </button>
        </form>

        {insurancePlan ? (
          <p className="mt-3 text-xs text-slate-500">
            Verification status: <span className="font-medium">{insurancePlan.verificationStatus}</span>
          </p>
        ) : null}
      </section>

      {state === "error" && message ? <p className="text-sm text-rose-600">{message}</p> : null}
      {state === "idle" && message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {state === "saving" ? <p className="text-sm text-slate-500">Saving...</p> : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
      />
    </label>
  );
}

function Status({ status }: { status: "draft" | "issued" | "paid" | "void" }) {
  if (status === "paid") {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Paid</span>;
  }
  if (status === "issued") {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Issued</span>;
  }
  if (status === "void") {
    return <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">Void</span>;
  }
  return <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800">Draft</span>;
}
