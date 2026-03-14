import { z } from "zod";

export const invoiceViewSchema = z.object({
  view: z.enum(["patient", "admin"]).default("patient"),
});

export const invoiceLineItemCreateSchema = z.object({
  code: z.string().max(64).optional(),
  description: z.string().min(2).max(240),
  quantity: z.number().positive().max(100).default(1),
  unitPriceCents: z.number().int().positive().max(10_000_000),
});

export const invoiceCreateSchema = z.object({
  patientUserId: z.string().min(1),
  dueAt: z.iso.datetime().optional(),
  notes: z.string().max(2000).optional(),
  taxCents: z.number().int().min(0).max(10_000_000).default(0),
  discountCents: z.number().int().min(0).max(10_000_000).default(0),
  items: z.array(invoiceLineItemCreateSchema).min(1).max(50),
});

export const manualPaymentCreateSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive().max(10_000_000).optional(),
  paymentMethod: z
    .enum(["manual_card", "manual_cash", "manual_bank_transfer", "placeholder_gateway"])
    .default("manual_card"),
  note: z.string().max(1000).optional(),
});

export const insurancePlanViewSchema = z.object({
  patientUserId: z.string().min(1).optional(),
});

export const insurancePlanUpsertSchema = z.object({
  patientUserId: z.string().min(1).optional(),
  payerName: z.string().min(2).max(160),
  memberId: z.string().max(120).optional().default(""),
  groupNumber: z.string().max(120).optional().default(""),
  planType: z.string().max(80).optional().default(""),
  subscriberName: z.string().max(160).optional().default(""),
  relationshipToSubscriber: z.string().max(80).optional().default(""),
  coverageStatus: z.string().max(40).optional().default("active"),
});

export const insuranceVerificationSchema = z.object({
  insurancePlanId: z.string().min(1),
  status: z.enum(["pending", "verified", "failed"]).default("verified"),
  responseSummary: z.record(z.string(), z.unknown()).optional().default({}),
});

export const claimCreateSchema = z.object({
  invoiceId: z.string().min(1),
  payerName: z.string().max(160).optional(),
});
