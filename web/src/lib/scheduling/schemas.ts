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
