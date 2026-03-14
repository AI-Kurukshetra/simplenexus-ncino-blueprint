import type { User } from "@supabase/supabase-js";

import { getRoleFromUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingPayment = {
  id: string;
  invoiceId?: string;
  patientUserId: string;
  amountCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
  paymentMethod:
    | "manual_card"
    | "manual_cash"
    | "manual_bank_transfer"
    | "placeholder_gateway";
  collectedAt: string;
  note?: string;
  idempotencyKey?: string;
};

export type InvoiceLineItem = {
  id: string;
  code?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type BillingInvoice = {
  id: string;
  organizationId: string;
  patientUserId: string;
  patientEmail: string;
  invoiceNumber: string;
  currency: string;
  status: "draft" | "issued" | "paid" | "void";
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  notes?: string;
  lineItems: InvoiceLineItem[];
  payments: BillingPayment[];
};

export type InsurancePlan = {
  id: string;
  organizationId: string;
  patientUserId: string;
  payerName: string;
  memberId?: string;
  groupNumber?: string;
  planType?: string;
  subscriberName?: string;
  relationshipToSubscriber?: string;
  coverageStatus: string;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type ClaimRecord = {
  id: string;
  organizationId: string;
  patientUserId: string;
  invoiceId?: string;
  claimNumber: string;
  status: string;
  payerName?: string;
  totalCents: number;
  submittedAt?: string;
  adjudicatedAt?: string;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  invoice_number: string;
  currency: string;
  status: "draft" | "issued" | "paid" | "void";
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  code: string | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

type PaymentRow = {
  id: string;
  invoice_id: string | null;
  patient_user_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
  payment_method:
    | "manual_card"
    | "manual_cash"
    | "manual_bank_transfer"
    | "placeholder_gateway";
  collected_at: string;
  note: string | null;
  idempotency_key: string | null;
};

type InsurancePlanRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  payer_name: string;
  member_id: string | null;
  group_number: string | null;
  plan_type: string | null;
  subscriber_name: string | null;
  relationship_to_subscriber: string | null;
  coverage_status: string;
  verification_status: string;
  created_at: string;
  updated_at: string;
};

type ClaimRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  invoice_id: string | null;
  claim_number: string;
  status: string;
  payer_name: string | null;
  total_cents: number;
  submitted_at: string | null;
  adjudicated_at: string | null;
  created_at: string;
};

async function authUserMap() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return { error, map: new Map<string, User>() };
  return { error: null, map: new Map<string, User>(data.users.map((user) => [user.id, user])) };
}

async function getUserById(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return { error, user: null as User | null };
  if (!data.user) return { error: new Error("User not found"), user: null as User | null };
  return { error: null, user: data.user };
}

function mapLineItem(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    code: row.code ?? undefined,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    lineTotalCents: row.line_total_cents,
  };
}

function mapPayment(row: PaymentRow): BillingPayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? undefined,
    patientUserId: row.patient_user_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    collectedAt: row.collected_at,
    note: row.note ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

function mapInsurancePlan(row: InsurancePlanRow): InsurancePlan {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientUserId: row.patient_user_id,
    payerName: row.payer_name,
    memberId: row.member_id ?? undefined,
    groupNumber: row.group_number ?? undefined,
    planType: row.plan_type ?? undefined,
    subscriberName: row.subscriber_name ?? undefined,
    relationshipToSubscriber: row.relationship_to_subscriber ?? undefined,
    coverageStatus: row.coverage_status,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClaim(row: ClaimRow): ClaimRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientUserId: row.patient_user_id,
    invoiceId: row.invoice_id ?? undefined,
    claimNumber: row.claim_number,
    status: row.status,
    payerName: row.payer_name ?? undefined,
    totalCents: row.total_cents,
    submittedAt: row.submitted_at ?? undefined,
    adjudicatedAt: row.adjudicated_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function assembleInvoices(invoiceRows: InvoiceRow[]) {
  if (invoiceRows.length === 0) return { error: null, invoices: [] as BillingInvoice[] };
  const invoiceIds = invoiceRows.map((row) => row.id);

  const admin = createSupabaseAdminClient();
  const [lineItemsResult, paymentsResult, usersResult] = await Promise.all([
    admin
      .from("invoice_line_items")
      .select("id, invoice_id, code, description, quantity, unit_price_cents, line_total_cents")
      .in("invoice_id", invoiceIds),
    admin
      .from("payments")
      .select(
        "id, invoice_id, patient_user_id, amount_cents, currency, status, payment_method, collected_at, note, idempotency_key",
      )
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false }),
    authUserMap(),
  ]);

  if (lineItemsResult.error) return { error: lineItemsResult.error, invoices: [] as BillingInvoice[] };
  if (paymentsResult.error) return { error: paymentsResult.error, invoices: [] as BillingInvoice[] };
  if (usersResult.error) return { error: usersResult.error, invoices: [] as BillingInvoice[] };

  const lineItemsByInvoice = new Map<string, InvoiceLineItem[]>();
  for (const raw of (lineItemsResult.data ?? []) as InvoiceLineItemRow[]) {
    const next = lineItemsByInvoice.get(raw.invoice_id) ?? [];
    next.push(mapLineItem(raw));
    lineItemsByInvoice.set(raw.invoice_id, next);
  }

  const paymentsByInvoice = new Map<string, BillingPayment[]>();
  for (const raw of (paymentsResult.data ?? []) as PaymentRow[]) {
    if (!raw.invoice_id) continue;
    const next = paymentsByInvoice.get(raw.invoice_id) ?? [];
    next.push(mapPayment(raw));
    paymentsByInvoice.set(raw.invoice_id, next);
  }

  const invoices = invoiceRows.map((row) => {
    const payments = paymentsByInvoice.get(row.id) ?? [];
    const paidCents = payments
      .filter((payment) => payment.status === "succeeded")
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const outstandingCents = Math.max(row.total_cents - paidCents, 0);
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientUserId: row.patient_user_id,
      patientEmail: usersResult.map.get(row.patient_user_id)?.email ?? "",
      invoiceNumber: row.invoice_number,
      currency: row.currency,
      status: row.status,
      subtotalCents: row.subtotal_cents,
      taxCents: row.tax_cents,
      discountCents: row.discount_cents,
      totalCents: row.total_cents,
      paidCents,
      outstandingCents,
      issuedAt: row.issued_at,
      dueAt: row.due_at ?? undefined,
      paidAt: row.paid_at ?? undefined,
      notes: row.notes ?? undefined,
      lineItems: lineItemsByInvoice.get(row.id) ?? [],
      payments,
    } satisfies BillingInvoice;
  });

  return { error: null, invoices };
}

export async function listInvoicesForPatient(patientUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, organization_id, patient_user_id, invoice_number, currency, status, subtotal_cents, tax_cents, discount_cents, total_cents, issued_at, due_at, paid_at, notes",
    )
    .eq("patient_user_id", patientUserId)
    .order("issued_at", { ascending: false });
  if (error) return { error, invoices: [] as BillingInvoice[] };
  return assembleInvoices((data ?? []) as InvoiceRow[]);
}

export async function listInvoicesForOrganization(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, organization_id, patient_user_id, invoice_number, currency, status, subtotal_cents, tax_cents, discount_cents, total_cents, issued_at, due_at, paid_at, notes",
    )
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false });
  if (error) return { error, invoices: [] as BillingInvoice[] };
  return assembleInvoices((data ?? []) as InvoiceRow[]);
}

export async function getBillingSummaryForOrganization(organizationId: string) {
  const invoices = await listInvoicesForOrganization(organizationId);
  if (invoices.error) {
    return {
      error: invoices.error,
      summary: {
        totalInvoices: 0,
        issuedCount: 0,
        paidCount: 0,
        outstandingCents: 0,
        collectedCents: 0,
      },
    };
  }

  const summary = invoices.invoices.reduce(
    (acc, invoice) => {
      acc.totalInvoices += 1;
      if (invoice.status === "issued" || invoice.status === "draft") acc.issuedCount += 1;
      if (invoice.status === "paid") acc.paidCount += 1;
      acc.outstandingCents += invoice.outstandingCents;
      acc.collectedCents += invoice.paidCents;
      return acc;
    },
    {
      totalInvoices: 0,
      issuedCount: 0,
      paidCount: 0,
      outstandingCents: 0,
      collectedCents: 0,
    },
  );

  return { error: null, summary };
}

async function nextInvoiceNumber(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const prefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  const { data, error } = await admin
    .from("invoices")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .like("invoice_number", `${prefix}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) return { error, invoiceNumber: null as string | null };

  const current = data?.[0]?.invoice_number;
  const currentSequence = current ? Number(current.split("-").at(-1)) : 0;
  const nextSequence = Number.isFinite(currentSequence) ? currentSequence + 1 : 1;
  const invoiceNumber = `${prefix}-${String(nextSequence).padStart(4, "0")}`;

  return { error: null, invoiceNumber };
}

async function nextClaimNumber(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const prefix = `CLM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  const { data, error } = await admin
    .from("claims")
    .select("claim_number")
    .eq("organization_id", organizationId)
    .like("claim_number", `${prefix}-%`)
    .order("claim_number", { ascending: false })
    .limit(1);

  if (error) return { error, claimNumber: null as string | null };

  const current = data?.[0]?.claim_number;
  const currentSequence = current ? Number(current.split("-").at(-1)) : 0;
  const nextSequence = Number.isFinite(currentSequence) ? currentSequence + 1 : 1;
  const claimNumber = `${prefix}-${String(nextSequence).padStart(4, "0")}`;

  return { error: null, claimNumber };
}

export async function createInvoiceForOrganization(params: {
  organizationId: string;
  patientUserId: string;
  createdByUserId: string;
  dueAt?: string;
  notes?: string;
  taxCents: number;
  discountCents: number;
  items: Array<{
    code?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}) {
  const patient = await getUserById(params.patientUserId);
  if (patient.error || !patient.user) {
    return { error: patient.error ?? new Error("Patient not found"), invoice: null as BillingInvoice | null };
  }
  if (getRoleFromUser(patient.user) !== "patient") {
    return { error: new Error("Target user is not a patient"), invoice: null as BillingInvoice | null };
  }

  const number = await nextInvoiceNumber(params.organizationId);
  if (number.error || !number.invoiceNumber) {
    return { error: number.error ?? new Error("Unable to generate invoice number"), invoice: null as BillingInvoice | null };
  }

  const lineItems = params.items.map((item) => ({
    code: item.code ?? null,
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    line_total_cents: Math.round(item.quantity * item.unitPriceCents),
  }));

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.line_total_cents, 0);
  const totalCents = Math.max(subtotalCents + params.taxCents - params.discountCents, 0);

  const admin = createSupabaseAdminClient();
  const { data: invoiceRow, error: invoiceError } = await admin
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      patient_user_id: params.patientUserId,
      invoice_number: number.invoiceNumber,
      status: "issued",
      subtotal_cents: subtotalCents,
      tax_cents: params.taxCents,
      discount_cents: params.discountCents,
      total_cents: totalCents,
      due_at: params.dueAt ?? null,
      notes: params.notes ?? null,
      created_by_user_id: params.createdByUserId,
    })
    .select("id")
    .single();

  if (invoiceError || !invoiceRow) {
    return { error: invoiceError ?? new Error("Unable to create invoice"), invoice: null as BillingInvoice | null };
  }

  const { error: lineError } = await admin.from("invoice_line_items").insert(
    lineItems.map((item) => ({
      ...item,
      invoice_id: invoiceRow.id as string,
      organization_id: params.organizationId,
    })),
  );
  if (lineError) {
    return { error: lineError, invoice: null as BillingInvoice | null };
  }

  const listed = await listInvoicesForOrganization(params.organizationId);
  if (listed.error) return { error: listed.error, invoice: null as BillingInvoice | null };
  const invoice = listed.invoices.find((item) => item.id === (invoiceRow.id as string)) ?? null;
  if (!invoice) return { error: new Error("Invoice not found after create"), invoice: null as BillingInvoice | null };
  return { error: null, invoice };
}

export async function collectManualPayment(params: {
  actorUserId: string;
  actorRole: "patient" | "admin" | "super_admin";
  invoiceId: string;
  amountCents?: number;
  paymentMethod:
    | "manual_card"
    | "manual_cash"
    | "manual_bank_transfer"
    | "placeholder_gateway";
  note?: string;
  idempotencyKey?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: invoiceRow, error: invoiceError } = await admin
    .from("invoices")
    .select("id, organization_id, patient_user_id, total_cents, status")
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return {
      error: invoiceError,
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: true,
      invalidState: false,
    };
  }
  if (!invoiceRow) {
    return {
      error: new Error("Invoice not found"),
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: true,
      invalidState: false,
    };
  }

  if (params.actorRole === "patient" && invoiceRow.patient_user_id !== params.actorUserId) {
    return {
      error: new Error("Cannot pay another patient's invoice"),
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: true,
      notFound: false,
      invalidState: false,
    };
  }

  const { data: paymentRows, error: paymentRowsError } = await admin
    .from("payments")
    .select("amount_cents, status")
    .eq("invoice_id", params.invoiceId);
  if (paymentRowsError) {
    return {
      error: paymentRowsError,
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: false,
      invalidState: false,
    };
  }

  const paidCents = (paymentRows ?? [])
    .filter((row) => row.status === "succeeded")
    .reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const outstanding = Math.max(Number(invoiceRow.total_cents) - paidCents, 0);
  if (outstanding <= 0) {
    return {
      error: new Error("Invoice is already fully paid"),
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: false,
      invalidState: true,
    };
  }

  const amountToCollect = params.amountCents ?? outstanding;
  if (amountToCollect <= 0 || amountToCollect > outstanding) {
    return {
      error: new Error("Invalid payment amount"),
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: false,
      invalidState: true,
    };
  }

  const { data: createdPayment, error: paymentInsertError } = await admin
    .from("payments")
    .insert({
      organization_id: invoiceRow.organization_id as string,
      invoice_id: params.invoiceId,
      patient_user_id: invoiceRow.patient_user_id as string,
      amount_cents: amountToCollect,
      status: "succeeded",
      payment_method: params.paymentMethod,
      note: params.note ?? null,
      collected_by_user_id: params.actorUserId,
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select(
      "id, invoice_id, patient_user_id, amount_cents, currency, status, payment_method, collected_at, note, idempotency_key",
    )
    .single();

  if (paymentInsertError || !createdPayment) {
    return {
      error: paymentInsertError ?? new Error("Unable to record payment"),
      payment: null as BillingPayment | null,
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: false,
      invalidState: false,
    };
  }

  const totalAfter = paidCents + amountToCollect;
  if (totalAfter >= Number(invoiceRow.total_cents)) {
    await admin
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", params.invoiceId)
      .neq("status", "paid");
  }

  const listed = await listInvoicesForOrganization(invoiceRow.organization_id as string);
  if (listed.error) {
    return {
      error: listed.error,
      payment: mapPayment(createdPayment as PaymentRow),
      invoice: null as BillingInvoice | null,
      forbidden: false,
      notFound: false,
      invalidState: false,
    };
  }

  return {
    error: null,
    payment: mapPayment(createdPayment as PaymentRow),
    invoice: listed.invoices.find((item) => item.id === params.invoiceId) ?? null,
    forbidden: false,
    notFound: false,
    invalidState: false,
  };
}

export async function listInsurancePlansForPatient(patientUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("insurance_plans")
    .select(
      "id, organization_id, patient_user_id, payer_name, member_id, group_number, plan_type, subscriber_name, relationship_to_subscriber, coverage_status, verification_status, created_at, updated_at",
    )
    .eq("patient_user_id", patientUserId)
    .order("updated_at", { ascending: false });
  if (error) return { error, plans: [] as InsurancePlan[] };
  return { error: null, plans: ((data ?? []) as InsurancePlanRow[]).map(mapInsurancePlan) };
}

export async function listInsurancePlansForOrganization(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("insurance_plans")
    .select(
      "id, organization_id, patient_user_id, payer_name, member_id, group_number, plan_type, subscriber_name, relationship_to_subscriber, coverage_status, verification_status, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) return { error, plans: [] as InsurancePlan[] };
  return { error: null, plans: ((data ?? []) as InsurancePlanRow[]).map(mapInsurancePlan) };
}

export async function upsertInsurancePlan(params: {
  organizationId: string;
  patientUserId: string;
  payerName: string;
  memberId?: string;
  groupNumber?: string;
  planType?: string;
  subscriberName?: string;
  relationshipToSubscriber?: string;
  coverageStatus?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("insurance_plans")
    .upsert(
      {
        organization_id: params.organizationId,
        patient_user_id: params.patientUserId,
        payer_name: params.payerName,
        member_id: params.memberId ?? null,
        group_number: params.groupNumber ?? null,
        plan_type: params.planType ?? null,
        subscriber_name: params.subscriberName ?? null,
        relationship_to_subscriber: params.relationshipToSubscriber ?? null,
        coverage_status: params.coverageStatus ?? "active",
      },
      {
        onConflict: "organization_id,patient_user_id",
        ignoreDuplicates: false,
      },
    )
    .select(
      "id, organization_id, patient_user_id, payer_name, member_id, group_number, plan_type, subscriber_name, relationship_to_subscriber, coverage_status, verification_status, created_at, updated_at",
    )
    .single();
  if (error || !data) return { error: error ?? new Error("Unable to save insurance plan"), plan: null as InsurancePlan | null };
  return { error: null, plan: mapInsurancePlan(data as InsurancePlanRow) };
}

export async function addInsuranceVerificationEvent(params: {
  actorUserId: string;
  organizationId: string;
  insurancePlanId: string;
  status: "pending" | "verified" | "failed";
  responseSummary: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();

  const { data: plan, error: planError } = await admin
    .from("insurance_plans")
    .select("id, organization_id, patient_user_id")
    .eq("id", params.insurancePlanId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (planError) return { error: planError, notFound: false };
  if (!plan) return { error: new Error("Insurance plan not found"), notFound: true };

  const { error: eventError } = await admin.from("insurance_verification_events").insert({
    organization_id: params.organizationId,
    insurance_plan_id: params.insurancePlanId,
    verification_source: "manual_placeholder",
    requested_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: params.status,
    response_summary: params.responseSummary,
    created_by_user_id: params.actorUserId,
  });
  if (eventError) return { error: eventError, notFound: false };

  const { error: planUpdateError } = await admin
    .from("insurance_plans")
    .update({
      verification_status: params.status,
    })
    .eq("id", params.insurancePlanId)
    .eq("organization_id", params.organizationId);

  return { error: planUpdateError, notFound: false };
}

export async function listClaimsForOrganization(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("claims")
    .select(
      "id, organization_id, patient_user_id, invoice_id, claim_number, status, payer_name, total_cents, submitted_at, adjudicated_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) return { error, claims: [] as ClaimRecord[] };
  return { error: null, claims: ((data ?? []) as ClaimRow[]).map(mapClaim) };
}

export async function createClaimForInvoice(params: {
  organizationId: string;
  invoiceId: string;
  actorUserId: string;
  payerName?: string;
}) {
  const admin = createSupabaseAdminClient();

  const { data: invoiceRow, error: invoiceError } = await admin
    .from("invoices")
    .select("id, organization_id, patient_user_id, total_cents")
    .eq("id", params.invoiceId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (invoiceError) {
    return {
      error: invoiceError,
      notFound: false,
      conflict: false,
      claim: null as ClaimRecord | null,
    };
  }
  if (!invoiceRow) {
    return {
      error: new Error("Invoice not found"),
      notFound: true,
      conflict: false,
      claim: null as ClaimRecord | null,
    };
  }

  const { data: existingClaim, error: existingError } = await admin
    .from("claims")
    .select(
      "id, organization_id, patient_user_id, invoice_id, claim_number, status, payer_name, total_cents, submitted_at, adjudicated_at, created_at",
    )
    .eq("organization_id", params.organizationId)
    .eq("invoice_id", params.invoiceId)
    .maybeSingle();

  if (existingError) {
    return {
      error: existingError,
      notFound: false,
      conflict: false,
      claim: null as ClaimRecord | null,
    };
  }
  if (existingClaim) {
    return {
      error: new Error("Claim already exists for this invoice"),
      notFound: false,
      conflict: true,
      claim: mapClaim(existingClaim as ClaimRow),
    };
  }

  const number = await nextClaimNumber(params.organizationId);
  if (number.error || !number.claimNumber) {
    return {
      error: number.error ?? new Error("Unable to generate claim number"),
      notFound: false,
      conflict: false,
      claim: null as ClaimRecord | null,
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("claims")
    .insert({
      organization_id: params.organizationId,
      patient_user_id: invoiceRow.patient_user_id as string,
      invoice_id: params.invoiceId,
      claim_number: number.claimNumber,
      status: "draft",
      payer_name: params.payerName ?? null,
      total_cents: Number(invoiceRow.total_cents),
    })
    .select(
      "id, organization_id, patient_user_id, invoice_id, claim_number, status, payer_name, total_cents, submitted_at, adjudicated_at, created_at",
    )
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError ?? new Error("Unable to create claim"),
      notFound: false,
      conflict: false,
      claim: null as ClaimRecord | null,
    };
  }

  await admin.from("claim_events").insert({
    organization_id: params.organizationId,
    claim_id: (inserted as ClaimRow).id,
    event_type: "claim_created",
    note: "Claim created from invoice in admin billing operations.",
    actor_user_id: params.actorUserId,
    metadata: {
      invoiceId: params.invoiceId,
      payerName: params.payerName ?? null,
    },
  });

  return {
    error: null,
    notFound: false,
    conflict: false,
    claim: mapClaim(inserted as ClaimRow),
  };
}
