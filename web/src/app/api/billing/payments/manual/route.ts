import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { manualPaymentCreateSchema } from "@/lib/billing/schemas";
import { collectManualPayment } from "@/lib/billing/store";

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "patient" && session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Insufficient permissions"), { status: 403 });
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Missing Idempotency-Key header"),
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = manualPaymentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid manual payment payload"),
      { status: 400 },
    );
  }

  const paid = await collectManualPayment({
    actorUserId: session.user.id,
    actorRole: session.role,
    invoiceId: parsed.data.invoiceId,
    amountCents: parsed.data.amountCents,
    paymentMethod: parsed.data.paymentMethod,
    note: parsed.data.note,
    idempotencyKey,
  });

  if (paid.notFound) {
    return NextResponse.json(failure("NOT_FOUND", paid.error?.message ?? "Invoice not found"), {
      status: 404,
    });
  }
  if (paid.forbidden) {
    return NextResponse.json(failure("FORBIDDEN", paid.error?.message ?? "Forbidden"), {
      status: 403,
    });
  }
  if (paid.invalidState) {
    return NextResponse.json(
      failure("INVALID_STATE", paid.error?.message ?? "Payment cannot be processed"),
      { status: 409 },
    );
  }
  if (paid.error || !paid.payment || !paid.invoice) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to process payment"), {
      status: 500,
    });
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: paid.invoice.organizationId,
    action: "billing.payment_recorded_manual",
    entityType: "payment",
    entityId: paid.payment.id,
    details: {
      invoiceId: paid.invoice.id,
      amountCents: paid.payment.amountCents,
      paymentMethod: paid.payment.paymentMethod,
      actorRole: session.role,
      invoiceStatusAfter: paid.invoice.status,
      outstandingAfter: paid.invoice.outstandingCents,
    },
  });

  return NextResponse.json(
    success({
      payment: paid.payment,
      invoice: paid.invoice,
      idempotencyKey,
    }),
    { status: 201 },
  );
}
