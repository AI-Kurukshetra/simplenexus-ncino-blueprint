import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { invoiceCreateSchema, invoiceViewSchema } from "@/lib/billing/schemas";
import {
  createInvoiceForOrganization,
  getBillingSummaryForOrganization,
  listInvoicesForOrganization,
  listInvoicesForPatient,
} from "@/lib/billing/store";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = invoiceViewSchema.safeParse({
    view: request.nextUrl.searchParams.get("view") ?? "patient",
  });
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid invoice view"), { status: 400 });
  }

  if (parsed.data.view === "patient") {
    if (session.role !== "patient") {
      return NextResponse.json(failure("FORBIDDEN", "Patient access required"), { status: 403 });
    }

    const listed = await listInvoicesForPatient(session.user.id);
    if (listed.error) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load invoices"), {
        status: 500,
      });
    }
    return NextResponse.json(success({ view: "patient", invoices: listed.invoices }));
  }

  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Admin access required"), { status: 403 });
  }

  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: session.role,
  });
  if (context.error || !context.organizationId) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization context"),
      { status: 500 },
    );
  }

  const [listed, summary] = await Promise.all([
    listInvoicesForOrganization(context.organizationId),
    getBillingSummaryForOrganization(context.organizationId),
  ]);
  if (listed.error || summary.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load billing dashboard"), {
      status: 500,
    });
  }

  return NextResponse.json(
    success({
      view: "admin",
      invoices: listed.invoices,
      summary: summary.summary,
    }),
  );
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Admin access required"), { status: 403 });
  }

  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: session.role,
  });
  if (context.error || !context.organizationId) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization context"),
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid invoice create payload"),
      { status: 400 },
    );
  }

  const created = await createInvoiceForOrganization({
    organizationId: context.organizationId,
    patientUserId: parsed.data.patientUserId,
    createdByUserId: session.user.id,
    dueAt: parsed.data.dueAt,
    notes: parsed.data.notes,
    taxCents: parsed.data.taxCents,
    discountCents: parsed.data.discountCents,
    items: parsed.data.items,
  });
  if (created.error || !created.invoice) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to create invoice"), {
      status: 500,
    });
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "billing.invoice_created",
    entityType: "invoice",
    entityId: created.invoice.id,
    details: {
      patientUserId: created.invoice.patientUserId,
      invoiceNumber: created.invoice.invoiceNumber,
      totalCents: created.invoice.totalCents,
      lineItemCount: created.invoice.lineItems.length,
    },
  });

  return NextResponse.json(success({ invoice: created.invoice }), { status: 201 });
}
