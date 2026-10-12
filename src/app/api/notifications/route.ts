import { context, csrf } from "@/server/context";
import { db } from "@/server/db";
import { apiError } from "@/server/errors";
export async function PATCH(request: Request) {
  try {
    await csrf(request);
    const ctx = await context();
    await db.notification.updateMany({
      where: { organisationId: ctx.organisationId, userId: ctx.userId },
      data: { readAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
