import type { User } from "@supabase/supabase-js";

import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_HORIZON_DAYS = 56;
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ProviderAvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
  generatedFrom: "manual" | "weekly_template";
  weeklyDayOfWeek?: number;
  createdAt: string;
};

export type WeeklyScheduleWindow = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  startTime?: string;
  endTime?: string;
};

export type ProviderWeeklySchedule = {
  timezone: string;
  slotDurationMinutes: 15 | 30 | 45 | 60;
  horizonDays: number;
  windows: WeeklyScheduleWindow[];
};

type SlotRow = {
  id: string;
  organization_id: string;
  provider_user_id: string;
  starts_at: string;
  ends_at: string;
  status: "available" | "booked" | "blocked";
  generated_from: "manual" | "weekly_template";
  weekly_day_of_week: number | null;
  created_at: string;
};

type WeeklyScheduleRow = {
  organization_id: string;
  provider_user_id: string;
  day_of_week: number;
  is_enabled: boolean;
  start_time: string | null;
  end_time: string | null;
  slot_duration_minutes: 15 | 30 | 45 | 60;
  timezone: string;
};

type ProviderStatusRow = {
  user_id: string;
  approval_status: "pending" | "approved" | "rejected";
  account_status: "pending_provider_approval" | "active" | "rejected";
};

type SlotOverlapRow = {
  id: string;
  starts_at: string;
  ends_at: string;
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
    generatedFrom: row.generated_from ?? "manual",
    weeklyDayOfWeek: row.weekly_day_of_week ?? undefined,
    createdAt: row.created_at,
  };
}

function defaultWeeklyWindows(): WeeklyScheduleWindow[] {
  return WEEKDAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    enabled: false,
  }));
}

function mapWeeklySchedule(rows: WeeklyScheduleRow[]): ProviderWeeklySchedule {
  if (rows.length === 0) {
    return {
      timezone: "UTC",
      slotDurationMinutes: 30,
      horizonDays: DEFAULT_HORIZON_DAYS,
      windows: defaultWeeklyWindows(),
    };
  }

  const timezone = rows[0].timezone || "UTC";
  const slotDurationMinutes = rows[0].slot_duration_minutes;
  const byDay = new Map<number, WeeklyScheduleRow>(rows.map((row) => [row.day_of_week, row]));

  const windows = WEEKDAY_LABELS.map((label, dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      label,
      enabled: row?.is_enabled ?? false,
      startTime: row?.start_time ? row.start_time.slice(0, 5) : undefined,
      endTime: row?.end_time ? row.end_time.slice(0, 5) : undefined,
    } satisfies WeeklyScheduleWindow;
  });

  return {
    timezone,
    slotDurationMinutes,
    horizonDays: DEFAULT_HORIZON_DAYS,
    windows,
  };
}

function toIsoDateKey(parts: { year: number; month: number; day: number }) {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const weekdayShort = partMap.get("weekday") ?? "Sun";
  const dayOfWeek = WEEKDAY_SHORT_TO_INDEX[weekdayShort] ?? 0;

  return {
    year: Number(partMap.get("year") ?? "1970"),
    month: Number(partMap.get("month") ?? "01"),
    day: Number(partMap.get("day") ?? "01"),
    dayOfWeek,
  };
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.get("year") ?? "1970"),
    Number(map.get("month") ?? "1") - 1,
    Number(map.get("day") ?? "1"),
    Number(map.get("hour") ?? "0"),
    Number(map.get("minute") ?? "0"),
    Number(map.get("second") ?? "0"),
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateKey: string, timeValue: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const firstOffset = getTimeZoneOffsetMilliseconds(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMilliseconds(firstPass, timeZone);
  if (secondOffset !== firstOffset) {
    return new Date(utcGuess.getTime() - secondOffset);
  }

  return firstPass;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function splitBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
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
    .select(
      "id, organization_id, provider_user_id, starts_at, ends_at, status, generated_from, weekly_day_of_week, created_at",
    )
    .eq("provider_user_id", user.id)
    .order("starts_at", { ascending: true });

  if (error) return { error, slots: [] as ProviderAvailabilitySlot[] };
  return { error: null, slots: ((data ?? []) as SlotRow[]).map(mapSlot) };
}

export async function listProviderWeeklySchedule(user: User) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_weekly_schedules")
    .select(
      "organization_id, provider_user_id, day_of_week, is_enabled, start_time, end_time, slot_duration_minutes, timezone",
    )
    .eq("provider_user_id", user.id)
    .order("day_of_week", { ascending: true });

  if (error) {
    return {
      error,
      schedule: {
        timezone: "UTC",
        slotDurationMinutes: 30 as const,
        horizonDays: DEFAULT_HORIZON_DAYS,
        windows: defaultWeeklyWindows(),
      },
    };
  }

  return { error: null, schedule: mapWeeklySchedule((data ?? []) as WeeklyScheduleRow[]) };
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
    .select(
      "id, organization_id, provider_user_id, starts_at, ends_at, status, generated_from, weekly_day_of_week, created_at",
    )
    .eq("provider_user_id", providerUserId)
    .eq("status", "available")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) return { error, slots: [] as ProviderAvailabilitySlot[] };
  return { error: null, slots: ((data ?? []) as SlotRow[]).map(mapSlot) };
}

export async function upsertProviderWeeklySchedule(params: {
  provider: User;
  timezone: string;
  slotDurationMinutes: 15 | 30 | 45 | 60;
  horizonDays: number;
  windows: Array<{
    dayOfWeek: number;
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  }>;
}) {
  const context = await ensureOrganizationContextForUser({
    user: params.provider,
    roleOverride: "provider",
  });
  if (context.error || !context.organizationId) {
    return {
      error: context.error ?? new Error("Unable to resolve organization context"),
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: null as ProviderWeeklySchedule | null,
    };
  }

  const admin = createSupabaseAdminClient();
  const windowsByDay = new Map(params.windows.map((window) => [window.dayOfWeek, window]));
  const weeklyRows = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const window = windowsByDay.get(dayOfWeek);
    const enabled = window?.enabled ?? false;
    return {
      organization_id: context.organizationId,
      provider_user_id: params.provider.id,
      day_of_week: dayOfWeek,
      is_enabled: enabled,
      start_time: enabled ? (window?.startTime ?? null) : null,
      end_time: enabled ? (window?.endTime ?? null) : null,
      slot_duration_minutes: params.slotDurationMinutes,
      timezone: params.timezone,
    };
  });

  const { error: weeklyError } = await admin.from("provider_weekly_schedules").upsert(weeklyRows, {
    onConflict: "provider_user_id,day_of_week",
    ignoreDuplicates: false,
  });
  if (weeklyError) {
    return {
      error: weeklyError,
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: null as ProviderWeeklySchedule | null,
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const { error: clearError } = await admin
    .from("provider_availability_slots")
    .delete()
    .eq("provider_user_id", params.provider.id)
    .eq("status", "available")
    .eq("generated_from", "weekly_template")
    .gt("starts_at", nowIso);
  if (clearError) {
    return {
      error: clearError,
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: null as ProviderWeeklySchedule | null,
    };
  }

  const enabledWindows = params.windows.filter(
    (window) => window.enabled && window.startTime && window.endTime,
  );
  if (enabledWindows.length === 0) {
    const listedSchedule = await listProviderWeeklySchedule(params.provider);
    return {
      error: listedSchedule.error,
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: listedSchedule.schedule,
    };
  }

  const durationMs = params.slotDurationMinutes * 60_000;
  const candidates: Array<{
    startsAt: string;
    endsAt: string;
    dayOfWeek: number;
  }> = [];

  for (let dayOffset = 0; dayOffset < params.horizonDays; dayOffset += 1) {
    const probe = new Date(now.getTime() + dayOffset * 86_400_000);
    const parts = getDatePartsInTimeZone(probe, params.timezone);
    const dateKey = toIsoDateKey(parts);
    const window = enabledWindows.find((value) => value.dayOfWeek === parts.dayOfWeek);
    if (!window || !window.startTime || !window.endTime) continue;

    const windowStart = zonedDateTimeToUtc(dateKey, window.startTime, params.timezone);
    const windowEnd = zonedDateTimeToUtc(dateKey, window.endTime, params.timezone);
    if (windowEnd.valueOf() <= windowStart.valueOf()) continue;

    for (
      let cursor = windowStart.valueOf();
      cursor + durationMs <= windowEnd.valueOf();
      cursor += durationMs
    ) {
      const startValue = cursor;
      const endValue = cursor + durationMs;
      if (endValue <= now.valueOf()) continue;
      candidates.push({
        startsAt: new Date(startValue).toISOString(),
        endsAt: new Date(endValue).toISOString(),
        dayOfWeek: window.dayOfWeek,
      });
    }
  }

  if (candidates.length === 0) {
    const listedSchedule = await listProviderWeeklySchedule(params.provider);
    return {
      error: listedSchedule.error,
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: listedSchedule.schedule,
    };
  }

  const minStart = candidates[0]?.startsAt;
  const maxEnd = candidates[candidates.length - 1]?.endsAt;
  const { data: overlapRows, error: overlapError } = await admin
    .from("provider_availability_slots")
    .select("id, starts_at, ends_at")
    .eq("provider_user_id", params.provider.id)
    .lt("starts_at", maxEnd)
    .gt("ends_at", minStart);
  if (overlapError) {
    return {
      error: overlapError,
      generatedCount: 0,
      skippedConflicts: 0,
      schedule: null as ProviderWeeklySchedule | null,
    };
  }

  const existing = ((overlapRows ?? []) as SlotOverlapRow[]).map((row) => ({
    startsAt: new Date(row.starts_at).valueOf(),
    endsAt: new Date(row.ends_at).valueOf(),
  }));

  const accepted = candidates.filter((candidate) => {
    const startsAt = new Date(candidate.startsAt).valueOf();
    const endsAt = new Date(candidate.endsAt).valueOf();
    return !existing.some((slot) => overlaps(startsAt, endsAt, slot.startsAt, slot.endsAt));
  });

  if (accepted.length > 0) {
    const insertRows = accepted.map((candidate) => ({
      organization_id: context.organizationId,
      provider_user_id: params.provider.id,
      starts_at: candidate.startsAt,
      ends_at: candidate.endsAt,
      status: "available",
      generated_from: "weekly_template",
      weekly_day_of_week: candidate.dayOfWeek,
    }));

    for (const batch of splitBatches(insertRows, 500)) {
      const { error: insertError } = await admin.from("provider_availability_slots").insert(batch);
      if (insertError) {
        return {
          error: insertError,
          generatedCount: 0,
          skippedConflicts: 0,
          schedule: null as ProviderWeeklySchedule | null,
        };
      }
    }
  }

  const listedSchedule = await listProviderWeeklySchedule(params.provider);
  return {
    error: listedSchedule.error,
    generatedCount: accepted.length,
    skippedConflicts: candidates.length - accepted.length,
    schedule: listedSchedule.schedule,
  };
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
      generated_from: "manual",
      weekly_day_of_week: null,
    })
    .select(
      "id, organization_id, provider_user_id, starts_at, ends_at, status, generated_from, weekly_day_of_week, created_at",
    )
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
    .select(
      "id, organization_id, provider_user_id, starts_at, ends_at, status, generated_from, weekly_day_of_week, created_at",
    )
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
    .select(
      "id, organization_id, provider_user_id, starts_at, ends_at, status, generated_from, weekly_day_of_week, created_at",
    )
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
