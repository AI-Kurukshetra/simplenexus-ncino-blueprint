import type { User } from "@supabase/supabase-js";

import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { getRoleFromUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CareTask = {
  id: string;
  organizationId: string;
  patientUserId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done" | "blocked";
  dueAt?: string;
  createdAt: string;
  completedAt?: string;
  assignedByUserId: string;
  assignedByRole: "provider" | "admin" | "super_admin";
  assignedProviderId?: string;
};

export type CareTaskWithPatient = CareTask & {
  patientEmail: string;
  patientName: string;
};

type TaskRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  assigned_provider_user_id: string | null;
  assigned_by_user_id: string;
  assigned_by_role: "provider" | "admin" | "super_admin";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done" | "blocked";
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function mapTask(row: TaskRow): CareTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientUserId: row.patient_user_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    assignedByUserId: row.assigned_by_user_id,
    assignedByRole: row.assigned_by_role,
    assignedProviderId: row.assigned_provider_user_id ?? undefined,
  };
}

async function authUserMap() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return { error, map: new Map<string, User>() };
  return { error: null, map: new Map<string, User>(data.users.map((user) => [user.id, user])) };
}

function patientName(user: User | undefined) {
  if (!user) return "Patient";
  if (typeof user.user_metadata?.fullName === "string") return user.user_metadata.fullName;
  return "Patient";
}

export async function getUserById(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return { error, user: null as User | null };
  if (!data.user) return { error: new Error("User not found"), user: null as User | null };
  return { error: null, user: data.user };
}

async function providerHasPatientRelationship(patientUserId: string, providerUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("appointment_requests")
    .select("id")
    .eq("patient_user_id", patientUserId)
    .eq("provider_user_id", providerUserId)
    .in("status", ["pending_provider_approval", "approved"])
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}

export async function listTasksForPatient(patient: User) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("care_tasks")
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .eq("patient_user_id", patient.id)
    .order("created_at", { ascending: false });

  if (error) return [] as CareTask[];
  return ((data ?? []) as TaskRow[]).map(mapTask);
}

export async function listTasksForProvider(providerUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("care_tasks")
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .eq("assigned_provider_user_id", providerUserId)
    .order("created_at", { ascending: false });

  if (error) return { error, tasks: [] as CareTaskWithPatient[] };

  const users = await authUserMap();
  if (users.error) return { error: users.error, tasks: [] as CareTaskWithPatient[] };

  const tasks = ((data ?? []) as TaskRow[]).map((row) => {
    const task = mapTask(row);
    const patient = users.map.get(task.patientUserId);
    return {
      ...task,
      patientEmail: patient?.email ?? "",
      patientName: patientName(patient),
    };
  });

  return { error: null, tasks };
}

export async function listAllTasks() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("care_tasks")
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) return { error, tasks: [] as CareTaskWithPatient[] };

  const users = await authUserMap();
  if (users.error) return { error: users.error, tasks: [] as CareTaskWithPatient[] };

  const tasks = ((data ?? []) as TaskRow[]).map((row) => {
    const task = mapTask(row);
    const patient = users.map.get(task.patientUserId);
    return {
      ...task,
      patientEmail: patient?.email ?? "",
      patientName: patientName(patient),
    };
  });

  return { error: null, tasks };
}

export async function createCareTask(params: {
  patientUserId: string;
  title: string;
  description: string;
  dueAt?: string;
  priority: "low" | "medium" | "high";
  assignedByUserId: string;
  assignedByRole: "provider" | "admin" | "super_admin";
  assignedProviderId?: string;
}) {
  const patientFound = await getUserById(params.patientUserId);
  if (patientFound.error || !patientFound.user) {
    return { error: patientFound.error ?? new Error("Patient not found"), task: null as CareTask | null };
  }
  if (getRoleFromUser(patientFound.user) !== "patient") {
    return { error: new Error("Target user is not a patient"), task: null as CareTask | null };
  }

  if (params.assignedByRole === "provider") {
    const relationship = await providerHasPatientRelationship(
      params.patientUserId,
      params.assignedByUserId,
    );
    if (!relationship) {
      return { error: new Error("Provider is not assigned to this patient"), task: null as CareTask | null };
    }
  }

  const context = await ensureOrganizationContextForUser({
    user: patientFound.user,
    roleOverride: "patient",
  });
  if (context.error || !context.organizationId) {
    return { error: context.error ?? new Error("Unable to resolve organization"), task: null as CareTask | null };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("care_tasks")
    .insert({
      organization_id: context.organizationId,
      patient_user_id: params.patientUserId,
      assigned_provider_user_id: params.assignedProviderId ?? null,
      assigned_by_user_id: params.assignedByUserId,
      assigned_by_role: params.assignedByRole,
      title: params.title,
      description: params.description,
      priority: params.priority,
      status: "todo",
      due_at: params.dueAt ?? null,
    })
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to create task"), task: null as CareTask | null };
  }

  return { error: null, task: mapTask(data as TaskRow) };
}

export async function updateCareTaskStatus(params: {
  patientUserId: string;
  taskId: string;
  nextStatus: "todo" | "in_progress" | "done" | "blocked";
  actorUserId: string;
  actorRole: "patient" | "provider" | "admin" | "super_admin";
}) {
  const admin = createSupabaseAdminClient();
  const { data: row, error: fetchError } = await admin
    .from("care_tasks")
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .eq("id", params.taskId)
    .eq("patient_user_id", params.patientUserId)
    .maybeSingle();

  if (fetchError) {
    return {
      error: fetchError,
      task: null as CareTask | null,
      forbidden: false,
      notFound: true,
    };
  }

  if (!row) {
    return {
      error: new Error("Task not found"),
      task: null as CareTask | null,
      forbidden: false,
      notFound: true,
    };
  }

  const task = mapTask(row as TaskRow);
  if (params.actorRole === "patient" && params.actorUserId !== params.patientUserId) {
    return {
      error: new Error("Cannot update another patient's task"),
      task: null as CareTask | null,
      forbidden: true,
      notFound: false,
    };
  }

  if (
    params.actorRole === "provider" &&
    task.assignedProviderId &&
    task.assignedProviderId !== params.actorUserId
  ) {
    return {
      error: new Error("Cannot update task assigned to another provider"),
      task: null as CareTask | null,
      forbidden: true,
      notFound: false,
    };
  }

  if (params.actorRole === "provider" && !task.assignedProviderId) {
    return {
      error: new Error("Provider cannot update unassigned task"),
      task: null as CareTask | null,
      forbidden: true,
      notFound: false,
    };
  }

  if (params.actorRole === "patient") {
    if (params.nextStatus === "blocked" || params.nextStatus === "todo") {
      return {
        error: new Error("Patient can only set task to in_progress or done"),
        task: null as CareTask | null,
        forbidden: true,
        notFound: false,
      };
    }
  }

  const completedAt = params.nextStatus === "done" ? new Date().toISOString() : null;
  const { data: updatedRow, error: updateError } = await admin
    .from("care_tasks")
    .update({
      status: params.nextStatus,
      completed_at: completedAt,
    })
    .eq("id", params.taskId)
    .eq("patient_user_id", params.patientUserId)
    .select(
      "id, organization_id, patient_user_id, assigned_provider_user_id, assigned_by_user_id, assigned_by_role, title, description, priority, status, due_at, completed_at, created_at",
    )
    .single();

  if (updateError || !updatedRow) {
    return {
      error: updateError ?? new Error("Unable to update task"),
      task: null as CareTask | null,
      forbidden: false,
      notFound: false,
    };
  }

  return {
    error: null,
    task: mapTask(updatedRow as TaskRow),
    forbidden: false,
    notFound: false,
  };
}
