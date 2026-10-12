import { z } from "zod";
import { context, csrf, audit } from "@/server/context";
import { db } from "@/server/db";
import { apiError, invariant } from "@/server/errors";
export async function PATCH(request: Request) {
  try {
    await csrf(request);
    const ctx = await context();
    const x = z
      .object({
        name: z.string().min(2).max(120).optional(),
        organisationName: z.string().min(2).max(120).optional(),
        notificationPreferences: z.object({ email: z.boolean() }).optional(),
        deletionRequest: z.boolean().optional(),
      })
      .parse(await request.json());
    if (x.name)
      await db.user.update({
        where: { id: ctx.userId },
        data: { name: x.name },
      });
    if (x.name && ctx.role === "TENANT")
      await db.tenant.updateMany({
        where: { userId: ctx.userId, organisationId: ctx.organisationId },
        data: { name: x.name },
      });
    if (x.organisationName) {
      invariant(ctx.role === "OWNER", 403, "Owner access required.");
      await db.organisation.update({
        where: { id: ctx.organisationId },
        data: { name: x.organisationName },
      });
    }
    if (x.deletionRequest)
      await db.operationRecord.create({
        data: {
          organisationId: ctx.organisationId,
          kind: "deletionRequest",
          userId: ctx.userId,
          title: "Account deletion request",
          data: { requestedAt: new Date().toISOString() },
          status: "draft",
        },
      });
    if (x.notificationPreferences)
      await db.operationRecord.upsert({
        where: { id: `preferences:${ctx.userId}:${ctx.organisationId}` },
        create: {
          id: `preferences:${ctx.userId}:${ctx.organisationId}`,
          organisationId: ctx.organisationId,
          kind: "preferences",
          userId: ctx.userId,
          title: "Notification preferences",
          data: x.notificationPreferences,
        },
        update: { data: x.notificationPreferences },
      });
    await audit(ctx, "settings.updated", "user", ctx.userId);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
