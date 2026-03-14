import { z } from "zod";

export const onboardingDemographicsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  phone: z.string().min(7),
});

export const onboardingMedicalSchema = z.object({
  allergies: z.string().default(""),
  medications: z.string().default(""),
  history: z.string().default(""),
});

export const onboardingInsuranceSchema = z.object({
  payerName: z.string().min(1),
  memberId: z.string().min(1),
  groupNumber: z.string().optional().default(""),
});

export const onboardingConsentSchema = z.object({
  acceptedTerms: z.boolean(),
  acceptedPrivacy: z.boolean(),
  acceptedTelehealth: z.boolean(),
});

export const onboardingDraftSchema = z.object({
  demographics: onboardingDemographicsSchema.optional(),
  medical: onboardingMedicalSchema.optional(),
  insurance: onboardingInsuranceSchema.optional(),
  consent: onboardingConsentSchema.optional(),
  currentStep: z.number().int().min(0).max(4).default(0),
  updatedAt: z.string().optional(),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export const onboardingDraftUpdateSchema = z.object({
  draft: onboardingDraftSchema,
});

export const onboardingSubmitSchema = z.object({
  draft: onboardingDraftSchema.refine(
    (value) =>
      Boolean(value.demographics) &&
      Boolean(value.medical) &&
      Boolean(value.insurance) &&
      Boolean(value.consent?.acceptedTerms) &&
      Boolean(value.consent?.acceptedPrivacy) &&
      Boolean(value.consent?.acceptedTelehealth),
    "All required onboarding sections must be completed before submit",
  ),
});
