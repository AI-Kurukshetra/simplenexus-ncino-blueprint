"use client";

import { startTransition, useEffect, useState } from "react";

import type { OnboardingDraft } from "@/lib/onboarding/schemas";

const stepTitles = [
  "Demographics",
  "Medical History",
  "Insurance",
  "Consent",
  "Review",
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

const emptyDraft: OnboardingDraft = {
  currentStep: 0,
};

export function OnboardingWizard() {
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/patient/onboarding/draft", {
        cache: "no-store",
      });

      if (!response.ok) return;
      const payload = (await response.json()) as { data?: { draft?: OnboardingDraft } };
      if (payload.data?.draft) {
        setDraft(payload.data.draft);
      }
    });
  }, []);

  async function saveDraft(nextDraft: OnboardingDraft) {
    setSaveState("saving");
    const response = await fetch("/api/patient/onboarding/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: nextDraft }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const payload = (await response.json()) as { data?: { draft?: OnboardingDraft } };
    setDraft(payload.data?.draft ?? nextDraft);
    setSaveState("saved");
  }

  async function handleSubmit() {
    const response = await fetch("/api/patient/onboarding/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft }),
    });

    if (!response.ok) {
      setSubmitMessage("Complete all required sections before submitting.");
      return;
    }

    setSubmitMessage("Onboarding submitted. You are now ready for scheduling.");
  }

  const currentStep = draft.currentStep ?? 0;

  return (
    <div className="space-y-5">
      <ol className="grid gap-2 sm:grid-cols-5">
        {stepTitles.map((title, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;
          return (
            <li
              key={title}
              className={`rounded-md border px-3 py-2 text-xs ${
                active
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : complete
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {index + 1}. {title}
            </li>
          );
        })}
      </ol>

      {currentStep === 0 ? (
        <DemographicsStep draft={draft} setDraft={setDraft} />
      ) : null}
      {currentStep === 1 ? <MedicalStep draft={draft} setDraft={setDraft} /> : null}
      {currentStep === 2 ? <InsuranceStep draft={draft} setDraft={setDraft} /> : null}
      {currentStep === 3 ? <ConsentStep draft={draft} setDraft={setDraft} /> : null}
      {currentStep === 4 ? <ReviewStep draft={draft} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={currentStep <= 0}
          onClick={() =>
            setDraft((prev) => ({ ...prev, currentStep: Math.max((prev.currentStep ?? 0) - 1, 0) }))
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentStep >= stepTitles.length - 1}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              currentStep: Math.min((prev.currentStep ?? 0) + 1, stepTitles.length - 1),
            }))
          }
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => saveDraft(draft)}
          className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800"
        >
          Save and Resume Later
        </button>
        <button
          type="button"
          disabled={currentStep !== stepTitles.length - 1}
          onClick={handleSubmit}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit Onboarding
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {saveState === "saving" ? "Saving draft..." : null}
        {saveState === "saved" ? "Draft saved." : null}
        {saveState === "error" ? "Unable to save draft. Please retry." : null}
      </div>

      {submitMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {submitMessage}
        </p>
      ) : null}
    </div>
  );
}

function DemographicsStep({
  draft,
  setDraft,
}: {
  draft: OnboardingDraft;
  setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft>>;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
      <Field
        label="First Name"
        value={draft.demographics?.firstName ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            demographics: {
              ...prev.demographics,
              firstName: value,
              lastName: prev.demographics?.lastName ?? "",
              dateOfBirth: prev.demographics?.dateOfBirth ?? "",
              phone: prev.demographics?.phone ?? "",
            },
          }))
        }
      />
      <Field
        label="Last Name"
        value={draft.demographics?.lastName ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            demographics: {
              ...prev.demographics,
              firstName: prev.demographics?.firstName ?? "",
              lastName: value,
              dateOfBirth: prev.demographics?.dateOfBirth ?? "",
              phone: prev.demographics?.phone ?? "",
            },
          }))
        }
      />
      <Field
        label="Date of Birth"
        value={draft.demographics?.dateOfBirth ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            demographics: {
              ...prev.demographics,
              firstName: prev.demographics?.firstName ?? "",
              lastName: prev.demographics?.lastName ?? "",
              dateOfBirth: value,
              phone: prev.demographics?.phone ?? "",
            },
          }))
        }
      />
      <Field
        label="Phone"
        value={draft.demographics?.phone ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            demographics: {
              ...prev.demographics,
              firstName: prev.demographics?.firstName ?? "",
              lastName: prev.demographics?.lastName ?? "",
              dateOfBirth: prev.demographics?.dateOfBirth ?? "",
              phone: value,
            },
          }))
        }
      />
    </section>
  );
}

function MedicalStep({
  draft,
  setDraft,
}: {
  draft: OnboardingDraft;
  setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft>>;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <Area
        label="Allergies"
        value={draft.medical?.allergies ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            medical: {
              ...prev.medical,
              allergies: value,
              medications: prev.medical?.medications ?? "",
              history: prev.medical?.history ?? "",
            },
          }))
        }
      />
      <Area
        label="Current Medications"
        value={draft.medical?.medications ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            medical: {
              ...prev.medical,
              allergies: prev.medical?.allergies ?? "",
              medications: value,
              history: prev.medical?.history ?? "",
            },
          }))
        }
      />
      <Area
        label="Medical History"
        value={draft.medical?.history ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            medical: {
              ...prev.medical,
              allergies: prev.medical?.allergies ?? "",
              medications: prev.medical?.medications ?? "",
              history: value,
            },
          }))
        }
      />
    </section>
  );
}

function InsuranceStep({
  draft,
  setDraft,
}: {
  draft: OnboardingDraft;
  setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft>>;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
      <Field
        label="Payer Name"
        value={draft.insurance?.payerName ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            insurance: {
              ...prev.insurance,
              payerName: value,
              memberId: prev.insurance?.memberId ?? "",
              groupNumber: prev.insurance?.groupNumber ?? "",
            },
          }))
        }
      />
      <Field
        label="Member ID"
        value={draft.insurance?.memberId ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            insurance: {
              ...prev.insurance,
              payerName: prev.insurance?.payerName ?? "",
              memberId: value,
              groupNumber: prev.insurance?.groupNumber ?? "",
            },
          }))
        }
      />
      <Field
        label="Group Number"
        value={draft.insurance?.groupNumber ?? ""}
        onChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            insurance: {
              ...prev.insurance,
              payerName: prev.insurance?.payerName ?? "",
              memberId: prev.insurance?.memberId ?? "",
              groupNumber: value,
            },
          }))
        }
      />
    </section>
  );
}

function ConsentStep({
  draft,
  setDraft,
}: {
  draft: OnboardingDraft;
  setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft>>;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <ConsentRow
        label="I accept Terms of Service"
        checked={Boolean(draft.consent?.acceptedTerms)}
        onChange={(checked) =>
          setDraft((prev) => ({
            ...prev,
            consent: {
              ...prev.consent,
              acceptedTerms: checked,
              acceptedPrivacy: prev.consent?.acceptedPrivacy ?? false,
              acceptedTelehealth: prev.consent?.acceptedTelehealth ?? false,
            },
          }))
        }
      />
      <ConsentRow
        label="I accept Privacy Policy"
        checked={Boolean(draft.consent?.acceptedPrivacy)}
        onChange={(checked) =>
          setDraft((prev) => ({
            ...prev,
            consent: {
              ...prev.consent,
              acceptedTerms: prev.consent?.acceptedTerms ?? false,
              acceptedPrivacy: checked,
              acceptedTelehealth: prev.consent?.acceptedTelehealth ?? false,
            },
          }))
        }
      />
      <ConsentRow
        label="I consent to Telehealth Services"
        checked={Boolean(draft.consent?.acceptedTelehealth)}
        onChange={(checked) =>
          setDraft((prev) => ({
            ...prev,
            consent: {
              ...prev.consent,
              acceptedTerms: prev.consent?.acceptedTerms ?? false,
              acceptedPrivacy: prev.consent?.acceptedPrivacy ?? false,
              acceptedTelehealth: checked,
            },
          }))
        }
      />
    </section>
  );
}

function ReviewStep({ draft }: { draft: OnboardingDraft }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
      <p className="font-medium text-slate-900">Review your details before submit.</p>
      <p>
        <span className="font-medium">Name:</span> {draft.demographics?.firstName ?? "-"}{" "}
        {draft.demographics?.lastName ?? ""}
      </p>
      <p>
        <span className="font-medium">DOB:</span> {draft.demographics?.dateOfBirth ?? "-"}
      </p>
      <p>
        <span className="font-medium">Payer:</span> {draft.insurance?.payerName ?? "-"}
      </p>
      <p>
        <span className="font-medium">Consent:</span>{" "}
        {draft.consent?.acceptedTerms &&
        draft.consent?.acceptedPrivacy &&
        draft.consent?.acceptedTelehealth
          ? "Complete"
          : "Incomplete"}
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
      />
    </label>
  );
}

function ConsentRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
