import { z } from "zod";
import { db } from "./db";
import { invariant } from "./errors";
import type { Context } from "./context";
import type { Prisma } from "@/generated/prisma/client";
import {
  organisationSettingsSchema,
  profilePreferencesSchema,
} from "@/lib/workspace-settings";

export const settingsInput = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    organisationName: z.string().trim().min(2).max(120).optional(),
    profile: profilePreferencesSchema
      .omit({ email: true })
      .partial()
      .strict()
      .optional(),
    notificationPreferences: z.object({ email: z.boolean() }).optional(),
    organisationSettings: organisationSettingsSchema
      .partial()
      .strict()
      .optional(),
    deletionRequest: z.boolean().optional(),
  })
  .strict();
export async function updateSettings(ctx: Context, raw: unknown) {
  const x = settingsInput.parse(raw);
  if (x.organisationName !== undefined || x.organisationSettings !== undefined)
    invariant(ctx.role === "OWNER", 403, "Owner access required.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id=${ctx.userId} FOR UPDATE`;
    if (x.name !== undefined)
      await tx.user.update({
        where: { id: ctx.userId },
        data: { name: x.name },
      });
    if (
      ctx.role === "TENANT" &&
      (x.name !== undefined || x.profile?.phone !== undefined)
    )
      await tx.tenant.updateMany({
        where: { userId: ctx.userId, organisationId: ctx.organisationId },
        data: { name: x.name, phone: x.profile?.phone },
      });
    if (
      x.organisationName !== undefined ||
      x.organisationSettings !== undefined
    ) {
      await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
      const org = await tx.organisation.findUniqueOrThrow({
        where: { id: ctx.organisationId },
      });
      await tx.organisation.update({
        where: { id: ctx.organisationId },
        data: {
          name: x.organisationName,
          settings: x.organisationSettings
            ? {
                ...(org.settings as Prisma.JsonObject),
                ...x.organisationSettings,
              }
            : undefined,
        },
      });
    }
    if (x.profile || x.notificationPreferences) {
      const id = `preferences:${ctx.userId}:${ctx.organisationId}`;
      const before = await tx.operationRecord.findUnique({ where: { id } });
      const data = {
        ...((before?.data || {}) as Prisma.JsonObject),
        ...x.profile,
        ...x.notificationPreferences,
      };
      await tx.operationRecord.upsert({
        where: { id },
        create: {
          id,
          organisationId: ctx.organisationId,
          kind: "preferences",
          userId: ctx.userId,
          title: "Personal preferences",
          data,
        },
        update: { data },
      });
    }
    if (x.deletionRequest) {
      const id = `deletion:${ctx.userId}:${ctx.organisationId}`;
      await tx.operationRecord.upsert({
        where: { id },
        create: {
          id,
          organisationId: ctx.organisationId,
          kind: "deletionRequest",
          userId: ctx.userId,
          title: "Account deletion request",
          data: { requestedAt: new Date().toISOString() },
          status: "draft",
        },
        update: {},
      });
    }
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "settings.updated",
        resourceType: "user",
        resourceId: ctx.userId,
      },
    });
  });
  return { ok: true };
}
