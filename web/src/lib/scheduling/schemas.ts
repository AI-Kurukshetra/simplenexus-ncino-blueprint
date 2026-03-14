import { z } from "zod";

export const appointmentViewSchema = z.object({
  view: z.enum(["patient", "provider", "admin"]).default("patient"),
});

export const appointmentCreateSchema = z.object({
  providerId: z.string().min(1),
  slotId: z.string().min(1).optional(),
  startsAt: z.iso.datetime(),
  reason: z.string().min(3),
  appointmentType: z.enum(["consult", "follow-up", "intake"]),
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const providerSlotCreateSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .refine(
    (value) => new Date(value.endsAt).valueOf() > new Date(value.startsAt).valueOf(),
    {
      error: "Slot end must be after start",
      path: ["endsAt"],
    },
  )
  .refine((value) => {
    const minutes =
      (new Date(value.endsAt).valueOf() - new Date(value.startsAt).valueOf()) / 60000;
    return minutes >= 15 && minutes <= 240;
  }, {
    error: "Slot duration must be between 15 and 240 minutes",
    path: ["endsAt"],
  });

export const providerSlotDeleteSchema = z.object({
  slotId: z.string().min(1),
});

export const providerWeeklyScheduleWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    enabled: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start and end time are required when day is enabled",
      });
      return;
    }

    const [startHour, startMinute] = value.startTime.split(":").map(Number);
    const [endHour, endMinute] = value.endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
      });
    }
  });

export const providerWeeklyScheduleUpsertSchema = z.object({
  timezone: z.string().min(1).max(80),
  slotDurationMinutes: z.enum(["15", "30", "45", "60"]).transform(Number),
  horizonDays: z.number().int().min(7).max(120).default(56),
  windows: z.array(providerWeeklyScheduleWindowSchema).length(7),
});
