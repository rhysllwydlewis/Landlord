import { z } from "zod";
import { context, csrf, audit } from "@/server/context";
import { db } from "@/server/db";
import { apiError, invariant } from "@/server/errors";
import { permissions } from "@/lib/config";
export async function PATCH(request: Request) {
  try {
    await csrf(request);
    const ctx = await context();
    invariant(ctx.role === "OWNER", 403, "Owner access required.");
    const x = z
      .object({
        membershipId: z.string(),
        active: z.boolean(),
        permissions: z.array(
          z.enum(
            permissions.flatMap((p) => [`${p}:read`, `${p}:write`]) as [
              string,
              ...string[],
            ],
          ),
        ),
        propertyIds: z.array(z.string()),
      })
      .parse(await request.json());
    const m = await db.membership.findFirst({
      where: {
        id: x.membershipId,
        organisationId: ctx.organisationId,
        role: { in: ["STAFF", "STAKEHOLDER"] },
      },
    });
    invariant(m, 404, "Staff member not found.");
    invariant(
      (await db.property.count({
        where: {
          organisationId: ctx.organisationId,
          id: { in: x.propertyIds },
        },
      })) === new Set(x.propertyIds).size,
      422,
      "Invalid property access.",
    );
    await db.membership.update({
      where: { id: m.id },
      data: {
        active: x.active,
        permissions: x.permissions,
        propertyIds: x.propertyIds,
      },
    });
    await audit(ctx, "membership.updated", "membership", m.id);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
