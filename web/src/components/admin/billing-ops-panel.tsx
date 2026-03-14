"use client";

import { useEffect, useState } from "react";

type BillingSummary = {
  totalInvoices: number;
  issuedCount: number;
  paidCount: number;
  outstandingCents: number;
  collectedCents: number;
};

type AdminInvoice = {
  id: string;
  patientUserId: string;
  patientEmail: string;
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
  patientUserId: string;
  payerName: string;
  memberId?: string;
  planType?: string;
  verificationStatus: string;
  coverageStatus: string;
  updatedAt: string;
};

type PatientOption = {
  id: string;
  email: string;
  fullName: string;
};

export function BillingOpsPanel() {
  const [summary, setSummary] = useState<BillingSummary>({
    totalInvoices: 0,
    issuedCount: 0,
    paidCount: 0,
    outstandingCents: 0,
    collectedCents: 0,
  });
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    const [invoiceResponse, insuranceResponse, patientResponse] = await Promise.all([
      fetch("/api/billing/invoices?view=admin", { cache: "no-store" }),
      fetch("/api/billing/insurance", { cache: "no-store" }),
      fetch("/api/admin/patients?status=all", { cache: "no-store" }),
    ]);

    if (!invoiceResponse.ok || !insuranceResponse.ok || !patientResponse.ok) {
      setState("error");
      setMessage("Unable to load billing operations.");
      return;
    }

    const invoicePayload = await invoiceResponse.json();
    const insurancePayload = await insuranceResponse.json();
    const patientPayload = await patientResponse.json();
    setInvoices((invoicePayload?.data?.invoices ?? []) as AdminInvoice[]);
    setSummary(
      (invoicePayload?.data?.summary ?? {
        totalInvoices: 0,
        issuedCount: 0,
        paidCount: 0,
        outstandingCents: 0,
        collectedCents: 0,
      }) as BillingSummary,
    );
    setPlans((insurancePayload?.data?.plans ?? []) as InsurancePlan[]);
    setPatients((patientPayload?.data?.patients ?? []) as PatientOption[]);
    if (!selectedPatientId && (patientPayload?.data?.patients?.length ?? 0) > 0) {
      setSelectedPatientId(String(patientPayload.data.patients[0].id));
    }
    setState("idle");
  }

  useEffect(() => {
    void loadAll().catch(() => {
      setState("error");
      setMessage("Unable to load billing operations.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvoice(formData: FormData) {
    const patientUserId = selectedPatientId;
    const description = String(formData.get("description") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPriceCents = Number(formData.get("unitPriceCents") ?? 0);
    const taxCents = Number(formData.get("taxCents") ?? 0);
    const discountCents = Number(formData.get("discountCents") ?? 0);
    const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!patientUserId || !description || !Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
      setState("error");
      setMessage("Patient user ID, description, and a valid unit price are required.");
      return;
    }

    setState("saving");
    setMessage(null);

    const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : undefined;
    const response = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientUserId,
        dueAt,
        notes: notes || undefined,
        taxCents: Number.isFinite(taxCents) && taxCents > 0 ? Math.round(taxCents) : 0,
        discountCents:
          Number.isFinite(discountCents) && discountCents > 0 ? Math.round(discountCents) : 0,
        items: [
          {
            description,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unitPriceCents: Math.round(unitPriceCents),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to create invoice.");
      return;
    }

    await loadAll();
    setMessage("Invoice created.");
  }

  async function verifyInsurancePlan(insurancePlanId: string, status: "verified" | "failed") {
    setState("saving");
    setMessage(null);

    const response = await fetch("/api/billing/insurance/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurancePlanId,
        status,
        responseSummary: {
          source: "admin_console",
          checkedAt: new Date().toISOString(),
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to update verification status.");
      return;
    }

    await loadAll();
    setMessage(`Insurance marked as ${status}.`);
  }

  async function createClaim(invoiceId: string) {
    setState("saving");
    setMessage(null);

    const response = await fetch("/api/billing/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to create claim.");
      return;
    }

    setState("idle");
    setMessage("Claim created.");
  }

  const filteredPatients = patients.filter((patient) => {
    const query = patientQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      patient.fullName.toLowerCase().includes(query) ||
      patient.email.toLowerCase().includes(query) ||
      patient.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total Invoices" value={String(summary.totalInvoices)} />
        <Metric label="Issued or Draft" value={String(summary.issuedCount)} />
        <Metric label="Paid Invoices" value={String(summary.paidCount)} />
        <Metric label="Outstanding Balance" value={formatCents(summary.outstandingCents)} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Issue Invoice</h2>
        <p className="mt-1 text-xs text-slate-500">
          Select a patient from directory. MVP invoice creation supports one line item at creation.
        </p>
        <form action={createInvoice} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Find Patient</span>
            <input
              value={patientQuery}
              onChange={(event) => setPatientQuery(event.target.value)}
              placeholder="Search by name, email, or user ID"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Patient</span>
            <select
              name="patientUserId"
              required
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
            >
              {filteredPatients.length === 0 ? (
                <option value="">No patient matches search</option>
              ) : null}
              {filteredPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} ({patient.email || patient.id})
                </option>
              ))}
            </select>
          </label>
          <Field label="Description" name="description" placeholder="Consultation fee" required />
          <Field label="Quantity" name="quantity" type="number" min={1} defaultValue="1" />
          <Field
            label="Unit Price (cents)"
            name="unitPriceCents"
            type="number"
            min={1}
            defaultValue="10000"
            required
          />
          <Field label="Tax (cents)" name="taxCents" type="number" min={0} defaultValue="0" />
          <Field
            label="Discount (cents)"
            name="discountCents"
            type="number"
            min={0}
            defaultValue="0"
          />
          <Field label="Due Date" name="dueAt" type="datetime-local" />
          <Field label="Notes" name="notes" placeholder="Optional internal note" />
          <button
            type="submit"
            disabled={state === "saving"}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create Invoice
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Invoice Ledger</h2>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {state === "loading" ? <p className="mt-3 text-sm text-slate-500">Loading invoices...</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Patient</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Total</th>
                <th className="px-2 py-2 font-medium">Collected</th>
                <th className="px-2 py-2 font-medium">Outstanding</th>
                <th className="px-2 py-2 font-medium">Issued</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {invoice.patientEmail || invoice.patientUserId}
                  </td>
                  <td className="px-2 py-2">
                    <Status status={invoice.status} />
                  </td>
                  <td className="px-2 py-2 text-slate-700">{formatCents(invoice.totalCents)}</td>
                  <td className="px-2 py-2 text-slate-700">{formatCents(invoice.paidCents)}</td>
                  <td className="px-2 py-2 text-slate-700">{formatCents(invoice.outstandingCents)}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {new Date(invoice.issuedAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">
                    {invoice.status === "void" ? (
                      <span className="text-xs text-slate-400">No action</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createClaim(invoice.id)}
                        disabled={state === "saving"}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Create Claim
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && state !== "loading" ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Insurance Verification Queue</h2>
        <p className="mt-1 text-xs text-slate-500">
          Placeholder verification workflow until payer integrations are enabled.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Payer</th>
                <th className="px-2 py-2 font-medium">Patient</th>
                <th className="px-2 py-2 font-medium">Member ID</th>
                <th className="px-2 py-2 font-medium">Plan Type</th>
                <th className="px-2 py-2 font-medium">Coverage</th>
                <th className="px-2 py-2 font-medium">Verification</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{plan.payerName}</td>
                  <td className="px-2 py-2 text-slate-600">{plan.patientUserId}</td>
                  <td className="px-2 py-2 text-slate-700">{plan.memberId || "-"}</td>
                  <td className="px-2 py-2 text-slate-700">{plan.planType || "-"}</td>
                  <td className="px-2 py-2 text-slate-700">{plan.coverageStatus}</td>
                  <td className="px-2 py-2 text-slate-700">{plan.verificationStatus}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void verifyInsurancePlan(plan.id, "verified")}
                        disabled={state === "saving"}
                        className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark Verified
                      </button>
                      <button
                        type="button"
                        onClick={() => void verifyInsurancePlan(plan.id, "failed")}
                        disabled={state === "saving"}
                        className="rounded-md bg-rose-700 px-2 py-1 text-xs text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark Failed
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                    No insurance plans available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {state === "error" && message ? <p className="text-sm text-rose-600">{message}</p> : null}
      {state === "idle" && message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {state === "saving" ? <p className="text-sm text-slate-500">Saving...</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
  type = "text",
  min,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        min={min}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
      />
    </label>
  );
}

function Status({ status }: { status: "draft" | "issued" | "paid" | "void" }) {
  if (status === "paid") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Paid</span>
    );
  }
  if (status === "issued") {
    return (
      <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-800">Issued</span>
    );
  }
  if (status === "void") {
    return <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800">Void</span>;
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Draft</span>
  );
}

function formatCents(value: number) {
  return `$${(value / 100).toFixed(2)}`;
}
