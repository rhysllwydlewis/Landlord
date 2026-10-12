import { z } from "zod";
import { db } from "./db";
import { checkProperty, permit, type Context } from "./context";
import { entitlement, checkLimit } from "./entitlements";
import { invariant } from "./errors";
import { propertySchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";
export function availableUnitScope(ctx: Context): Prisma.UnitWhereInput {
  const ownOccupancy = {
    status: { in: ["active", "periodic", "ending"] },
    participants: { some: { tenantId: { in: ctx.tenantIds } } },
  };
  return {
    archivedAt: null,
    ...(ctx.role === "TENANT"
      ? {
          OR: [
            { tenancies: { some: ownOccupancy } },
            {
              property: {
                tenancies: { some: { ...ownOccupancy, unitId: null } },
              },
            },
          ],
        }
      : {}),
  };
}

export const financialPropertyDetails = [
  "purchaseDate",
  "mortgageProvider",
  "mortgageReference",
  "mortgageBalancePence",
  "mortgagePaymentPence",
  "insuranceProvider",
  "insuranceReference",
  "insuranceExpiresAt",
] as const;

export async function validatePropertyChanges(
  ctx: Context,
  data: Partial<z.infer<typeof propertySchema>>,
) {
  if (
    data.purchasePricePence !== undefined ||
    data.valuePence !== undefined ||
    financialPropertyDetails.some((key) => data.details?.[key] !== undefined)
  ) {
    permit(ctx, "finance", true);
    await entitlement(ctx, "finance");
  }
  if (data.portfolioId)
    invariant(
      await db.portfolio.findFirst({
        where: { id: data.portfolioId, organisationId: ctx.organisationId },
      }),
      422,
      "Invalid portfolio.",
    );
  if (data.ownerId)
    invariant(
      await db.ownershipEntity.findFirst({
        where: { id: data.ownerId, organisationId: ctx.organisationId },
      }),
      422,
      "Invalid owner.",
    );
}

export const unitInput = z.object({
  propertyId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  type: z.enum(["room", "flat", "unit"]).default("room"),
});
export async function updateUnit(ctx: Context, id: string, raw: unknown) {
  permit(ctx, "properties", true);
  await entitlement(ctx, "core");
  const input = unitInput
    .omit({ propertyId: true })
    .partial()
    .extend({
      archive: z.boolean().optional(),
    })
    .strict()
    .parse(raw);
  const unit = await db.unit.findFirst({
    where: { id, organisationId: ctx.organisationId },
  });
  invariant(unit, 404, "Room or unit not found.");
  await checkProperty(ctx, unit.propertyId);
  await db.$transaction(async (tx) => {
    // Match the organisation-before-property lock order used for room creation.
    if (input.archive === false)
      await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${unit.propertyId} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
    const property = await tx.property.findUniqueOrThrow({
      where: { id: unit.propertyId },
    });
    invariant(
      !property.archivedAt,
      409,
      "Rooms in an archived property cannot be changed.",
    );
    const current = await tx.unit.findUniqueOrThrow({ where: { id } });
    if (input.archive === false && current.archivedAt)
      await checkLimit(ctx, "unit", 1, tx);
    if (input.archive === true)
      invariant(
        !(await tx.tenancy.count({
          where: {
            organisationId: ctx.organisationId,
            propertyId: unit.propertyId,
            status: { in: ["active", "periodic", "ending"] },
            OR: [{ unitId: id }, { unitId: null }],
          },
        })),
        409,
        "End active tenancies before archiving this room.",
      );
    await tx.unit.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        archivedAt:
          input.archive === undefined
            ? undefined
            : input.archive
              ? new Date()
              : null,
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action:
          input.archive === true
            ? "unit.archived"
            : input.archive === false
              ? "unit.restored"
              : "unit.updated",
        resourceType: "property",
        resourceId: unit.propertyId,
        metadata: { unitId: id },
      },
    });
  });
  return { id };
}

export async function updatePropertyDetails(
  ctx: Context,
  id: string,
  raw: unknown,
) {
  await checkProperty(ctx, id);
  await entitlement(ctx, "core");
  const data = propertySchema
    .pick({ details: true, portfolioId: true, ownerId: true })
    .strict()
    .parse(raw);
  await validatePropertyChanges(ctx, data);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
    const before = await tx.property.findUniqueOrThrow({ where: { id } });
    await tx.property.update({
      where: { id },
      data: {
        ...data,
        details: data.details
          ? { ...(before.details as Prisma.JsonObject), ...data.details }
          : undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "property.details.updated",
        resourceType: "property",
        resourceId: id,
      },
    });
  });
  return { id };
}
