import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  permit,
  checkProperty,
  linkedPropertyScope,
  type Context,
} from "./context";
import { entitlement } from "./entitlements";
import { invariant } from "./errors";
import { notify, managerIds } from "./notifications";
import { repairStatuses, repairCategories } from "@/lib/config";
export const repairInput = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  tenancyId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10000),
  category: z.enum(repairCategories),
  priority: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
  issueStartedAt: z.iso.date().optional(),
  ongoing: z.boolean().default(true),
  targetDate: z.iso.date().optional(),
  internalNotes: z.string().max(10000).default(""),
  estimatedCostPence: z
    .number()
    .int()
    .min(0)
    .max(2000000000)
    .nullable()
    .optional(),
});
export function repairWhere(ctx: Context) {
  return {
    organisationId: ctx.organisationId,
    ...linkedPropertyScope(ctx),
    ...(ctx.role === "TENANT"
      ? {
          OR: [
            { reportedByTenantId: { in: ctx.tenantIds } },
            { grants: { some: { tenantId: { in: ctx.tenantIds } } } },
          ],
        }
      : {}),
  };
}
export async function getRepair(ctx: Context, id: string) {
  if (ctx.role !== "TENANT") permit(ctx, "repairs");
  const r = await db.repair.findFirst({
    where: { ...repairWhere(ctx), id },
    include: {
      property: { select: { id: true, name: true, address: true } },
      unit: { select: { name: true } },
      grants: true,
      updates: {
        where: ctx.role === "TENANT" ? { public: true } : {},
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: ctx.role === "TENANT" ? { public: true } : {},
        orderBy: { createdAt: "asc" },
      },
      documents: {
        where: {
          archivedAt: null,
          ...(ctx.role === "TENANT"
            ? {
                visibility: "shared",
                grants: { some: { tenantId: { in: ctx.tenantIds } } },
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          contentType: true,
          size: true,
          visibility: true,
        },
      },
      expenses:
        ctx.role === "TENANT" ||
        (ctx.role === "STAFF" &&
          !ctx.permissions.some((p) =>
            ["finance:read", "finance:write"].includes(p),
          ))
          ? false
          : { orderBy: { incurredAt: "desc" } },
    },
  });
  invariant(r, 404, "Repair not found.");
  if (ctx.role === "TENANT")
    return {
      id: r.id,
      reference: r.reference,
      title: r.title,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
      property: r.property,
      unit: r.unit,
      createdAt: r.createdAt,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      issueStartedAt: r.issueStartedAt,
      ongoing: r.ongoing,
      completionSummary: r.completionSummary,
      tenantComments: r.tenantComments,
      updates: r.updates.map((u) => ({
        id: u.id,
        status: u.status,
        text: u.text,
        createdAt: u.createdAt,
      })),
      comments: r.comments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        body: c.body,
        createdAt: c.createdAt,
      })),
      documents: r.documents.map((d) => ({
        id: d.id,
        name: d.name,
        contentType: d.contentType,
        size: d.size,
      })),
    };
  return {
    ...r,
    estimatedCostPence:
      ctx.role === "OWNER" ||
      ctx.permissions.some((p) => ["finance:read", "finance:write"].includes(p))
        ? r.estimatedCostPence
        : null,
  };
}
export async function repairRecipients(ctx: Context, id: string) {
  const r = await db.repair.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: { reporter: true, grants: { include: { tenant: true } } },
  });
  return r
    ? [
        ...new Set(
          [r.reporter?.userId, ...r.grants.map((g) => g.tenant.userId)].filter(
            (x): x is string => !!x,
          ),
        ),
      ]
    : [];
}
export async function createRepair(ctx: Context, raw: unknown) {
  await entitlement(ctx, "repairs");
  const input = repairInput.parse(raw);
  let tenantId: string | undefined;
  if (ctx.role === "TENANT") {
    invariant(
      ctx.activePropertyIds.includes(input.propertyId),
      404,
      "Property not found.",
    );
    const participant = await db.tenancyParticipant.findFirst({
      where: {
        organisationId: ctx.organisationId,
        tenantId: { in: ctx.tenantIds },
        tenancy: {
          propertyId: input.propertyId,
          status: { in: ["active", "periodic", "ending"] },
          ...(input.tenancyId ? { id: input.tenancyId } : {}),
          ...(input.unitId
            ? { OR: [{ unitId: input.unitId }, { unitId: null }] }
            : {}),
        },
      },
    });
    invariant(participant, 404, "Active tenancy not found.");
    tenantId = participant.tenantId;
    input.tenancyId = participant.tenancyId;
    input.internalNotes = "";
    input.targetDate = undefined;
    input.estimatedCostPence = undefined;
  } else await checkProperty(ctx, input.propertyId, "repairs");
  if (input.estimatedCostPence !== undefined) {
    permit(ctx, "finance", true);
    await entitlement(ctx, "finance");
  }
  if (input.unitId) {
    const u = await db.unit.findFirst({
      where: {
        id: input.unitId,
        propertyId: input.propertyId,
        organisationId: ctx.organisationId,
        archivedAt: null,
      },
    });
    invariant(u, 422, "Room does not belong to this property.");
    if (ctx.role === "TENANT") {
      const t = await db.tenancy.findFirst({
        where: {
          id: input.tenancyId,
          OR: [{ unitId: input.unitId }, { unitId: null }],
        },
      });
      invariant(t, 403, "Choose your own room or the common property.");
    }
  }
  if (input.tenancyId)
    invariant(
      await db.tenancy.findFirst({
        where: {
          id: input.tenancyId,
          propertyId: input.propertyId,
          organisationId: ctx.organisationId,
        },
      }),
      422,
      "Invalid tenancy.",
    );
  return db.$transaction(async (tx) => {
    const r = await tx.repair.create({
      data: {
        ...input,
        issueStartedAt: input.issueStartedAt
          ? new Date(input.issueStartedAt)
          : undefined,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        organisationId: ctx.organisationId,
        createdByUserId: ctx.userId,
        reportedByTenantId: tenantId,
        source: tenantId ? "tenant" : "landlord",
        reference: `REP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        visibility: "private",
        updates: {
          create: {
            actorUserId: ctx.userId,
            status: "reported",
            text: "Repair reported.",
            public: !!tenantId,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "repair.created",
        resourceType: "repair",
        resourceId: r.id,
        metadata: { source: r.source },
      },
    });
    await notify(
      ctx.organisationId,
      await managerIds(ctx, "repairs", r.propertyId),
      "New repair reported",
      `/app/repairs/${r.id}`,
      `repair:${r.id}:created`,
      "repair",
      r.id,
      tx,
    );
    return { id: r.id, reference: r.reference };
  });
}
const updateInput = z.object({
  status: z.enum(repairStatuses).optional(),
  priority: z.enum(["low", "normal", "high", "emergency"]).optional(),
  targetDate: z.iso.date().nullable().optional(),
  internalNotes: z.string().max(10000).optional(),
  completionSummary: z.string().max(10000).optional(),
  tenantComments: z.boolean().optional(),
  estimatedCostPence: z
    .number()
    .int()
    .min(0)
    .max(2000000000)
    .nullable()
    .optional(),
  completedAt: z.iso.date().optional(),
});
export async function updateRepair(ctx: Context, id: string, raw: unknown) {
  permit(ctx, "repairs", true);
  await entitlement(ctx, "repairs");
  await getRepair(ctx, id);
  const input = updateInput.parse(raw);
  if (input.estimatedCostPence !== undefined) {
    permit(ctx, "finance", true);
    await entitlement(ctx, "finance");
  }
  return db.$transaction(
    async (tx) => {
      const before = await tx.repair.findUniqueOrThrow({ where: { id } });
      const finalStatus = ["resolved", "closed"].includes(
        input.status || before.status,
      );
      if (input.completedAt) {
        invariant(
          finalStatus,
          422,
          "Completion dates require a resolved or closed repair.",
        );
        invariant(
          input.completedAt <= new Date().toISOString().slice(0, 10),
          422,
          "Completion cannot be in the future.",
        );
        invariant(
          !before.issueStartedAt ||
            new Date(input.completedAt) >= before.issueStartedAt,
          422,
          "Completion cannot precede the issue start date.",
        );
      }
      const publicChange =
        (input.status !== undefined && input.status !== before.status) ||
        (input.priority !== undefined && input.priority !== before.priority) ||
        (input.targetDate !== undefined &&
          input.targetDate !== before.targetDate?.toISOString().slice(0, 10) &&
          !(input.targetDate === null && before.targetDate === null)) ||
        (input.completionSummary !== undefined &&
          input.completionSummary !== before.completionSummary) ||
        (input.completedAt !== undefined &&
          input.completedAt !== before.completedAt?.toISOString().slice(0, 10));
      const completionDate = input.completedAt
        ? input.completedAt === before.completedAt?.toISOString().slice(0, 10)
          ? before.completedAt
          : new Date(input.completedAt)
        : input.status
          ? finalStatus
            ? before.completedAt || new Date()
            : null
          : before.completedAt;
      const r = await tx.repair.update({
        where: { id },
        data: {
          ...input,
          completedAt: completionDate,
          targetDate:
            input.targetDate === undefined
              ? undefined
              : input.targetDate
                ? new Date(input.targetDate)
                : null,
          ...(publicChange
            ? {
                updates: {
                  create: {
                    actorUserId: ctx.userId,
                    status: input.status || before.status,
                    text:
                      (input.status && input.status !== before.status
                        ? `Status changed to ${input.status}.`
                        : "Repair details updated.") +
                      (finalStatus && completionDate
                        ? ` Completion recorded for ${completionDate.toISOString().slice(0, 10)}.`
                        : ""),
                    public: true,
                  },
                },
              }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId: ctx.organisationId,
          actorUserId: ctx.userId,
          action: "repair.updated",
          resourceType: "repair",
          resourceId: id,
          metadata: {
            status: r.status,
            completedAt: r.completedAt?.toISOString() || "",
          },
        },
      });
      if (publicChange)
        await notify(
          ctx.organisationId,
          await repairRecipients(ctx, id),
          input.status && input.status !== before.status
            ? "Repair status updated"
            : "Repair details updated",
          `/app/repairs/${id}`,
          `status:${id}:${randomUUID()}`,
          "repair",
          id,
          tx,
        );
      return { id: r.id };
    },
    { isolationLevel: "Serializable" },
  );
}
export async function setRepairVisibility(
  ctx: Context,
  id: string,
  raw: unknown,
) {
  permit(ctx, "repairs", true);
  await entitlement(ctx, "repairs");
  const input = z
    .object({
      visibility: z.enum(["private", "selected", "occupants"]),
      tenantIds: z.array(z.string()).max(100).default([]),
    })
    .parse(raw);
  const r = await db.repair.findFirst({ where: { ...repairWhere(ctx), id } });
  invariant(r, 404, "Repair not found.");
  const occupants = await db.tenant.findMany({
    where: {
      organisationId: ctx.organisationId,
      participants: {
        some: {
          tenancy: {
            propertyId: r.propertyId,
            status: { in: ["active", "periodic", "ending"] },
            ...(r.unitId
              ? { OR: [{ unitId: r.unitId }, { unitId: null }] }
              : {}),
          },
        },
      },
    },
    select: { id: true, userId: true },
  });
  const managers = await managerIds(ctx, "repairs", r.propertyId);
  const ids =
    input.visibility === "private"
      ? []
      : input.visibility === "occupants"
        ? occupants.map((t) => t.id)
        : input.tenantIds;
  invariant(
    ids.every((id) => occupants.some((t) => t.id === id)),
    422,
    "Only affected occupants can be selected.",
  );
  await db.$transaction(async (tx) => {
    await tx.repairAccess.deleteMany({
      where: { repairId: id, organisationId: ctx.organisationId },
    });
    await tx.repair.update({
      where: { id },
      data: {
        visibility: input.visibility,
        grants: { create: ids.map((tenantId) => ({ tenantId })) },
      },
    });
    await tx.notification.deleteMany({
      where: {
        organisationId: ctx.organisationId,
        resourceType: "repair",
        resourceId: id,
        userId: {
          notIn: [
            ...managers,
            ctx.userId,
            ...occupants
              .filter((t) => ids.includes(t.id))
              .map((t) => t.userId)
              .filter((x): x is string => !!x),
            ...(r.reportedByTenantId
              ? (
                  await db.tenant.findMany({
                    where: { id: r.reportedByTenantId },
                    select: { userId: true },
                  })
                )
                  .map((t) => t.userId)
                  .filter((x): x is string => !!x)
              : []),
          ],
        },
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "repair.visibility.changed",
        resourceType: "repair",
        resourceId: id,
        metadata: { from: r.visibility, to: input.visibility, tenantIds: ids },
      },
    });
  });
  if (ids.length)
    await notify(
      ctx.organisationId,
      occupants
        .filter((t) => ids.includes(t.id))
        .map((t) => t.userId)
        .filter((x): x is string => !!x),
      "A repair has been shared with you",
      `/app/repairs/${id}`,
      `share:${id}:${randomUUID()}`,
      "repair",
      id,
    );
  return { id };
}
export async function commentRepair(ctx: Context, id: string, raw: unknown) {
  await entitlement(ctx, "repairs");
  const r = await getRepair(ctx, id);
  if (ctx.role !== "TENANT") permit(ctx, "repairs", true);
  else
    invariant(r.tenantComments, 403, "Comments are disabled for this repair.");
  const input = z
    .object({
      body: z.string().trim().min(1).max(5000),
      public: z.boolean().default(false),
    })
    .parse(raw);
  if (ctx.role === "TENANT") input.public = true;
  await db.repairComment.create({
    data: {
      ...input,
      organisationId: ctx.organisationId,
      repairId: id,
      authorUserId: ctx.userId,
      authorName: ctx.name,
    },
  });
  const recipients = [
    ...(await managerIds(ctx, "repairs", r.property.id)),
    ...(input.public ? await repairRecipients(ctx, id) : []),
  ].filter((x) => x !== ctx.userId);
  await notify(
    ctx.organisationId,
    recipients,
    "New repair message",
    `/app/repairs/${id}`,
    `comment:${id}:${randomUUID()}`,
    "repair",
    id,
  );
  return { id };
}
