import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogForActorBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import {
  createCareTask,
  listAllTasks,
  listTasksForPatient,
  listTasksForProvider,
  updateCareTaskStatus,
} from "@/lib/tasks/store";

const taskViewSchema = z.object({
  view: z.enum(["patient", "provider", "admin"]).default("patient"),
});

const createTaskSchema = z.object({
  patientUserId: z.string().min(1),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().default(""),
  dueAt: z.iso.datetime().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedProviderId: z.string().min(1).optional(),
});

const updateTaskStatusSchema = z.object({
  patientUserId: z.string().min(1),
  taskId: z.string().min(1),
  nextStatus: z.enum(["todo", "in_progress", "done", "blocked"]),
});

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const parsed = taskViewSchema.safeParse({
    view: request.nextUrl.searchParams.get("view") ?? "patient",
  });
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid task view"), {
      status: 400,
    });
  }

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  if (parsed.data.view === "patient") {
    if (session.role !== "patient") {
      return NextResponse.json(failure("FORBIDDEN", "Patient access required"), {
        status: 403,
      });
    }

    const tasks = await listTasksForPatient(session.user);
    return NextResponse.json(success({ view: "patient", tasks }));
  }

  if (parsed.data.view === "provider") {
    if (session.role !== "provider" && session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.json(
        failure("FORBIDDEN", "Provider or admin access required"),
        { status: 403 },
      );
    }

    if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
      return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
        status: 403,
      });
    }

    if (session.role === "provider") {
      const result = await listTasksForProvider(session.user.id);
      if (result.error) {
        return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load tasks"), {
          status: 500,
        });
      }
      return NextResponse.json(success({ view: "provider", tasks: result.tasks }));
    }

    const all = await listAllTasks();
    if (all.error) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load tasks"), {
        status: 500,
      });
    }
    return NextResponse.json(success({ view: "provider", tasks: all.tasks }));
  }

  const adminGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (adminGuard) return adminGuard;

  const all = await listAllTasks();
  if (all.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load tasks"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ view: "admin", tasks: all.tasks }));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "provider" && session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Insufficient permissions"), {
      status: 403,
    });
  }

  if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid create task payload"), {
      status: 400,
    });
  }

  const assignedProviderId =
    session.role === "provider" ? session.user.id : parsed.data.assignedProviderId;

  const result = await createCareTask({
    patientUserId: parsed.data.patientUserId,
    title: parsed.data.title,
    description: parsed.data.description,
    dueAt: parsed.data.dueAt,
    priority: parsed.data.priority,
    assignedByUserId: session.user.id,
    assignedByRole: session.role,
    assignedProviderId,
  });

  if (result.error || !result.task) {
    if (result.error?.message === "Provider is not assigned to this patient") {
      return NextResponse.json(failure("FORBIDDEN", result.error.message), { status: 403 });
    }
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to create care task"), {
      status: 500,
    });
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: "care_task.created",
    entityType: "care_task",
    entityId: result.task.id,
    details: {
      patientUserId: result.task.patientUserId,
      assignedProviderId: result.task.assignedProviderId,
      priority: result.task.priority,
      dueAt: result.task.dueAt,
      status: result.task.status,
      assignedByRole: session.role,
    },
  });

  return NextResponse.json(success({ task: result.task }), { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (
    session.role !== "patient" &&
    session.role !== "provider" &&
    session.role !== "admin" &&
    session.role !== "super_admin"
  ) {
    return NextResponse.json(failure("FORBIDDEN", "Insufficient permissions"), {
      status: 403,
    });
  }

  if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTaskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid task status payload"), {
      status: 400,
    });
  }

  const result = await updateCareTaskStatus({
    patientUserId: parsed.data.patientUserId,
    taskId: parsed.data.taskId,
    nextStatus: parsed.data.nextStatus,
    actorUserId: session.user.id,
    actorRole: session.role,
  });

  if (result.notFound) {
    return NextResponse.json(failure("NOT_FOUND", result.error?.message ?? "Task not found"), {
      status: 404,
    });
  }

  if (result.forbidden) {
    return NextResponse.json(failure("FORBIDDEN", result.error?.message ?? "Forbidden"), {
      status: 403,
    });
  }

  if (result.error || !result.task) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to update task status"), {
      status: 500,
    });
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: "care_task.status_updated",
    entityType: "care_task",
    entityId: result.task.id,
    details: {
      patientUserId: result.task.patientUserId,
      nextStatus: result.task.status,
      actorRole: session.role,
    },
  });

  return NextResponse.json(success({ task: result.task, updated: true }));
}
