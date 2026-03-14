import type { User } from "@supabase/supabase-js";

import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProviderAvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
  createdAt: string;
};

type SlotRow = {
  id: string;
  organization_id: string;
  provider_user_id: string;
  starts_at: string;
  ends_at: string;
  status: "available" | "booked" | "blocked";
  created_at: string;
};

type ProviderStatusRow = {
  user_id: string;
  approval_status: "pending" | "approved" | "rejected";
  account_status: "pending_provider_approval" | "active" | "rejected";
};

export type ProviderState = {
  id: string;
  approvalStatus: "pending" | "approved" | "rejected";
  accountStatus: "pending_provider_approval" | "active" | "rejected";
};

function mapSlot(row: SlotRow): ProviderAvailabilitySlot {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getProviderById(providerUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_profiles")
    .select("user_id, approval_status, account_status")
    .eq("user_id", providerUserId)
    .maybeSingle();

  if (error) return { error, provider: null as ProviderState | null };
  if (!data) return { error: new Error("Provider not found"), provider: null as ProviderState | null };

  const row = data as ProviderStatusRow;
  return {
    error: null,
    provider: {
      id: row.user_id,
      approvalStatus: row.approval_status,
      accountStatus: row.account_status,
    },
  };
}

export async function listProviderSlots(user: User) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_availability_slots")
    .select("id, organization_id, provider_user_id, starts_at, ends_at, status, created_at")
    .eq("provider_user_id", user.id)
    .order("starts_at", { ascending: true });

  if (error) return { error, slots: [] as ProviderAvailabilitySlot[] };
  return { error: null, slots: ((data ?? []) as SlotRow[]).map(mapSlot) };
}

export async function listAvailableSlotsByProviderId(providerUserId: string) {
  const found = await getProviderById(providerUserId);
  if (found.error || !found.provider) return { error: found.error, slots: [] as ProviderAvailabilitySlot[] };

  if (found.provider.approvalStatus !== "approved") {
    return { error: null, slots: [] as ProviderAvailabilitySlot[] };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_availability_slots")
    .select("id, organization_id, provider_user_id, starts_at, ends_at, status, created_at")
    .eq("provider_user_id", providerUserId)
    .eq("status", "available")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) return { error, slots: [] as ProviderAvailabilitySlot[] };
  return { error: null, slots: ((data ?? []) as SlotRow[]).map(mapSlot) };
}

export async function createProviderSlot(params: {
  provider: User;
  startsAt: string;
  endsAt: string;
}) {
  const context = await ensureOrganizationContextForUser({
    user: params.provider,
    roleOverride: "provider",
  });
  if (context.error || !context.organizationId) {
    return {
      error: context.error ?? new Error("Unable to resolve organization context"),
      slot: null as ProviderAvailabilitySlot | null,
      conflict: false,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: overlapRows, error: overlapError } = await admin
    .from("provider_availability_slots")
    .select("id")
    .eq("provider_user_id", params.provider.id)
    .lt("starts_at", params.endsAt)
    .gt("ends_at", params.startsAt)
    .limit(1);

  if (overlapError) {
    return {
      error: overlapError,
      slot: null as ProviderAvailabilitySlot | null,
      conflict: false,
    };
  }
  if (overlapRows && overlapRows.length > 0) {
    return {
      error: new Error("Slot overlaps with existing availability"),
      slot: null as ProviderAvailabilitySlot | null,
      conflict: true,
    };
  }

  const { data, error } = await admin
    .from("provider_availability_slots")
    .insert({
      organization_id: context.organizationId,
      provider_user_id: params.provider.id,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      status: "available",
    })
    .select("id, organization_id, provider_user_id, starts_at, ends_at, status, created_at")
    .single();

  if (error || !data) {
    return {
      error: error ?? new Error("Unable to create slot"),
      slot: null as ProviderAvailabilitySlot | null,
      conflict: false,
    };
  }

  return { error: null, slot: mapSlot(data as SlotRow), conflict: false };
}

export async function deleteProviderSlot(params: {
  provider: User;
  slotId: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_availability_slots")
    .select("id, status")
    .eq("id", params.slotId)
    .eq("provider_user_id", params.provider.id)
    .maybeSingle();

  if (error) {
    return { error, notFound: false, forbidden: false };
  }
  if (!data) {
    return { error: new Error("Slot not found"), notFound: true, forbidden: false };
  }
  if ((data.status as string) === "booked") {
    return { error: new Error("Booked slots cannot be deleted"), notFound: false, forbidden: true };
  }

  const { error: deleteError } = await admin
    .from("provider_availability_slots")
    .delete()
    .eq("id", params.slotId)
    .eq("provider_user_id", params.provider.id);

  return { error: deleteError, notFound: false, forbidden: false };
}

export async function reserveProviderSlot(params: {
  providerUserId: string;
  startsAt: string;
  slotId?: string;
}) {
  const found = await getProviderById(params.providerUserId);
  if (found.error || !found.provider) {
    return {
      error: found.error ?? new Error("Provider unavailable"),
      unavailable: true,
      slot: null as ProviderAvailabilitySlot | null,
    };
  }

  if (found.provider.approvalStatus !== "approved") {
    return {
      error: new Error("Provider not approved"),
      unavailable: true,
      slot: null as ProviderAvailabilitySlot | null,
    };
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("provider_availability_slots")
    .select("id, organization_id, provider_user_id, starts_at, ends_at, status, created_at")
    .eq("provider_user_id", params.providerUserId)
    .eq("status", "available")
    .eq("starts_at", params.startsAt)
    .limit(1);

  if (params.slotId) {
    query = query.eq("id", params.slotId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return {
      error,
      unavailable: true,
      slot: null as ProviderAvailabilitySlot | null,
    };
  }
  if (!data) {
    return {
      error: new Error("Selected availability slot is no longer available"),
      unavailable: true,
      slot: null as ProviderAvailabilitySlot | null,
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("provider_availability_slots")
    .update({ status: "booked" })
    .eq("id", data.id)
    .eq("status", "available")
    .select("id, organization_id, provider_user_id, starts_at, ends_at, status, created_at")
    .maybeSingle();

  if (updateError || !updated) {
    return {
      error: updateError ?? new Error("Slot no longer available"),
      unavailable: true,
      slot: null as ProviderAvailabilitySlot | null,
    };
  }

  return { error: null, unavailable: false, slot: mapSlot(updated as SlotRow) };
}

export async function reopenProviderSlot(params: {
  providerUserId: string;
  slotId: string;
}) {
  const found = await getProviderById(params.providerUserId);
  if (found.error || !found.provider) {
    return { error: found.error ?? new Error("Provider unavailable"), notFound: true };
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: findError } = await admin
    .from("provider_availability_slots")
    .select("id")
    .eq("id", params.slotId)
    .eq("provider_user_id", params.providerUserId)
    .maybeSingle();

  if (findError) return { error: findError, notFound: false };
  if (!row) return { error: new Error("Slot not found"), notFound: true };

  const { error } = await admin
    .from("provider_availability_slots")
    .update({ status: "available" })
    .eq("id", params.slotId)
    .eq("provider_user_id", params.providerUserId);

  return { error, notFound: false };
}
