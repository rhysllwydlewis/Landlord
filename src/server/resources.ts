import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  permit,
  checkProperty,
  checkTenancy,
  propertyScope,
  linkedPropertyScope,
  audit,
  type Context,
} from "./context";
import { checkLimit, entitlement } from "./entitlements";
import { invariant } from "./errors";
import {
  propertySchema,
  tenantSchema,
  tenancySchema,
  expenseSchema,
  complianceSchema,
  taskSchema,
  assetSchema,
  listingSchema,
  operationSchemas,
  type OperationKind,
} from "./schemas";
import { createRepair, repairWhere, getRepair } from "./repairs";
import { recordPayment, generateRent, addCharge } from "./ledger";
import { outstanding, utcDay } from "@/lib/calculations";
import { managerIds, notify } from "./notifications";
import {
  validatePropertyChanges,
  updateUnit,
  unitInput,
  availableUnitScope,
} from "./properties";
import { updateFeedback } from "./feedback";
export function operationKind(value: string): value is OperationKind {
  return Object.hasOwn(operationSchemas, value);
}
function operationPermission(kind: string) {
  return ["forecasts", "bank", "anomalyReviews"].includes(kind)
    ? ("finance" as const)
    : ("operations" as const);
}
export async function listResource(
  ctx: Context,
  resource: string,
  params: URLSearchParams,
) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = (params.get("q") || "").slice(0, 120);
  const status = params.get("status");
  const propertyId = params.get("propertyId");
  const from = params.get("from");
  const to = params.get("to");
  const take = 30;
  const base = { organisationId: ctx.organisationId };
  const scope = {
    ...base,
    ...linkedPropertyScope(ctx),
    ...(propertyId ? { AND: [{ propertyId }] } : {}),
  };
  const paging = { take, skip: (page - 1) * take };
  const range =
    from || to
      ? {
          ...(from ? { gte: new Date(z.iso.date().parse(from)) } : {}),
          ...(to ? { lte: new Date(z.iso.date().parse(to)) } : {}),
        }
      : undefined;
  let rows: unknown[] = [];
  let total = 0;
  switch (resource) {
    case "properties": {
      if (!["TENANT", "STAKEHOLDER"].includes(ctx.role))
        permit(ctx, "properties");
      const where = {
        ...base,
        ...propertyScope(ctx),
        ...(ctx.role === "TENANT" ? { id: { in: ctx.activePropertyIds } } : {}),
        archivedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { postcode: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      [rows, total] = await Promise.all([
        db.property.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            address: true,
            postcode: true,
            type: true,
            bedrooms: true,
            bathrooms: true,
            epcRating: true,
            jurisdiction: true,
            units: {
              where: availableUnitScope(ctx),
              select: { id: true, name: true, type: true },
            },
            tenancies: {
              where: {
                status: { in: ["active", "periodic", "ending"] },
                ...(ctx.role === "TENANT"
                  ? { id: { in: ctx.tenancyIds } }
                  : {}),
              },
              select: { id: true, rentPence: true },
            },
          },
        }),
        db.property.count({ where }),
      ]);
      break;
    }
    case "tenants": {
      permit(ctx, "tenants");
      const where = {
        ...base,
        ...(ctx.role === "STAFF" && ctx.propertyIds.length
          ? {
              participants: {
                some: { tenancy: { propertyId: { in: ctx.propertyIds } } },
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      [rows, total] = await Promise.all([
        db.tenant.findMany({
          where,
          ...paging,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            userId: true,
            participants: {
              where: { tenancy: linkedPropertyScope(ctx) },
              select: {
                tenancy: {
                  select: {
                    reference: true,
                    status: true,
                    property: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
        db.tenant.count({ where }),
      ]);
      break;
    }
    case "tenancies": {
      if (ctx.role !== "TENANT") permit(ctx, "tenancies");
      const where = {
        ...scope,
        ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? { reference: { contains: q, mode: "insensitive" as const } }
          : {}),
      };
      [rows, total] = await Promise.all([
        db.tenancy.findMany({
          where,
          ...paging,
          orderBy: { startDate: "desc" },
          include: {
            rentChanges: true,
            property: { select: { name: true, address: true } },
            unit: { select: { name: true } },
            participants: {
              where:
                ctx.role === "TENANT"
                  ? { tenantId: { in: ctx.tenantIds } }
                  : {},
              select: { tenant: { select: { id: true, name: true } } },
            },
          },
        }),
        db.tenancy.count({ where }),
      ]);
      if (ctx.role === "TENANT")
        rows = rows.map((value) => {
          const t = value as {
            id: string;
            reference: string;
            startDate: Date;
            endDate: Date | null;
            status: string;
            rentPence: number;
            frequency: string;
            dueDay: number;
            depositPence: number;
            property: unknown;
            unit: unknown;
            participants: unknown;
            rentChanges: { rentPence: number; effectiveFrom: Date }[];
          };
          return {
            id: t.id,
            reference: t.reference,
            startDate: t.startDate,
            endDate: t.endDate,
            status: t.status,
            rentPence: t.rentPence,
            frequency: t.frequency,
            dueDay: t.dueDay,
            depositPence: t.depositPence,
            property: t.property,
            unit: t.unit,
            participants: t.participants,
            rentChanges: t.rentChanges.map((c) => ({
              rentPence: c.rentPence,
              effectiveFrom: c.effectiveFrom,
            })),
          };
        });
      break;
    }
    case "repairs": {
      if (ctx.role !== "TENANT") permit(ctx, "repairs");
      const where = {
        ...repairWhere(ctx),
        ...(propertyId ? { AND: [{ propertyId }] } : {}),
        ...(status ? { status } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      };
      [rows, total] = await Promise.all([
        db.repair.findMany({
          where,
          ...paging,
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            reference: true,
            title: true,
            category: true,
            status: true,
            priority: true,
            source: true,
            ...(ctx.role !== "TENANT" ? { visibility: true } : {}),
            createdAt: true,
            targetDate: true,
            property: { select: { id: true, name: true } },
            unit: { select: { name: true } },
          },
        }),
        db.repair.count({ where }),
      ]);
      break;
    }
    case "payments": {
      if (ctx.role !== "TENANT") permit(ctx, "rent");
      const where = {
        ...base,
        tenancy: {
          ...linkedPropertyScope(ctx),
          ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
        },
        ...(range ? { paidAt: range } : {}),
      };
      [rows, total] = await Promise.all([
        db.payment.findMany({
          where,
          ...paging,
          orderBy: { paidAt: "desc" },
          include: {
            tenancy: {
              select: { reference: true, property: { select: { name: true } } },
            },
            allocations: { select: { amountPence: true } },
          },
        }),
        db.payment.count({ where }),
      ]);
      break;
    }
    case "rent": {
      if (ctx.role !== "TENANT") permit(ctx, "rent");
      const where = {
        ...base,
        tenancy: {
          ...linkedPropertyScope(ctx),
          ...(propertyId ? { AND: [{ propertyId }] } : {}),
          ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
        },
        ...(range ? { dueDate: range } : {}),
      };
      const raw = await db.rentObligation.findMany({
        where,
        ...paging,
        orderBy: { dueDate: "desc" },
        include: {
          allocations: { select: { amountPence: true } },
          tenancy: {
            select: {
              id: true,
              reference: true,
              property: { select: { name: true } },
            },
          },
        },
      });
      rows = raw.map((r) => ({
        ...r,
        balancePence: outstanding(r.amountPence, r.allocations),
        status:
          outstanding(r.amountPence, r.allocations) === 0
            ? "paid"
            : r.dueDate < utcDay()
              ? "overdue"
              : r.dueDate.getTime() === utcDay().getTime()
                ? "due"
                : "upcoming",
      }));
      total = await db.rentObligation.count({ where });
      break;
    }
    case "expenses": {
      permit(ctx, "finance");
      const where = {
        ...scope,
        ...(q
          ? { description: { contains: q, mode: "insensitive" as const } }
          : {}),
        ...(range ? { incurredAt: range } : {}),
      };
      [rows, total] = await Promise.all([
        db.expense.findMany({
          where,
          ...paging,
          orderBy: { incurredAt: "desc" },
          include: { property: { select: { name: true } } },
        }),
        db.expense.count({ where }),
      ]);
      break;
    }
    case "compliance": {
      if (ctx.role !== "STAKEHOLDER") permit(ctx, "compliance");
      const where = {
        ...scope,
        ...(q
          ? ctx.role === "STAKEHOLDER"
            ? { category: { contains: q, mode: "insensitive" as const } }
            : { title: { contains: q, mode: "insensitive" as const } }
          : {}),
      };
      [rows, total] = await Promise.all([
        ctx.role === "STAKEHOLDER"
          ? db.complianceRecord.findMany({
              where,
              ...paging,
              orderBy: { expiresAt: "asc" },
              select: {
                id: true,
                category: true,
                issuedAt: true,
                expiresAt: true,
                status: true,
                property: { select: { name: true } },
              },
            })
          : db.complianceRecord.findMany({
              where,
              ...paging,
              orderBy: { expiresAt: "asc" },
              include: { property: { select: { name: true } } },
            }),
        db.complianceRecord.count({ where }),
      ]);
      if (ctx.role === "STAKEHOLDER")
        rows = (rows as { category: string }[]).map((r) => ({
          ...r,
          title: r.category,
        }));
      break;
    }
    case "tasks": {
      permit(ctx, "tasks");
      const where = {
        ...scope,
        ...(status ? { status } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      };
      [rows, total] = await Promise.all([
        db.task.findMany({
          where,
          ...paging,
          orderBy: { dueDate: "asc" },
          include: { property: { select: { name: true } } },
        }),
        db.task.count({ where }),
      ]);
      break;
    }
    case "assets": {
      permit(ctx, "operations");
      const where = { ...scope };
      [rows, total] = await Promise.all([
        db.propertyAsset.findMany({
          where,
          ...paging,
          include: { property: { select: { name: true } } },
        }),
        db.propertyAsset.count({ where }),
      ]);
      break;
    }
    case "documents": {
      if (ctx.role === "STAKEHOLDER")
        invariant(
          ctx.permissions.includes("documents:read"),
          403,
          "Document access was not granted.",
        );
      else if (ctx.role !== "TENANT") permit(ctx, "documents");
      const where = {
        ...base,
        ...(ctx.role === "STAFF" && ctx.propertyIds.length
          ? { propertyId: { in: ctx.propertyIds } }
          : {}),
        archivedAt: null,
        ...(ctx.role === "STAKEHOLDER"
          ? { ownerVisible: true, propertyId: { in: ctx.propertyIds } }
          : {}),
        ...(ctx.role === "TENANT"
          ? {
              visibility: "shared",
              grants: { some: { tenantId: { in: ctx.tenantIds } } },
              OR: [{ repairId: null }, { repair: repairWhere(ctx) }],
            }
          : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      };
      [rows, total] = await Promise.all([
        db.document.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            category: true,
            size: true,
            contentType: true,
            expiresAt: true,
            visibility: true,
            ownerVisible: true,
            ...(ctx.role === "OWNER" || ctx.role === "STAFF"
              ? { grants: { select: { tenantId: true } } }
              : {}),
            createdAt: true,
            property: { select: { name: true } },
          },
        }),
        db.document.count({ where }),
      ]);
      break;
    }
    case "messages": {
      if (ctx.role !== "TENANT") permit(ctx, "messages");
      const where = {
        ...base,
        tenancy: { ...linkedPropertyScope(ctx) },
        ...(ctx.role === "TENANT"
          ? { participantUserIds: { has: ctx.userId } }
          : {}),
      };
      [rows, total] = await Promise.all([
        db.conversation.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          include: {
            tenancy: { select: { reference: true } },
            messages: {
              take: 50,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            },
          },
        }),
        db.conversation.count({ where }),
      ]);
      rows = (rows as { messages: unknown[] }[]).map((r) => ({
        ...r,
        messages: r.messages.reverse(),
      }));
      break;
    }
    case "deposits": {
      if (ctx.role !== "TENANT") permit(ctx, "tenancies");
      const where = {
        ...base,
        ...(q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" as const } },
                {
                  tenancy: {
                    reference: { contains: q, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
        tenancy: {
          ...linkedPropertyScope(ctx),
          ...(propertyId ? { AND: [{ propertyId }] } : {}),
          ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
        },
      };
      [rows, total] = await Promise.all([
        db.deposit.findMany({
          where,
          ...paging,
          include: {
            tenancy: {
              select: { reference: true, property: { select: { name: true } } },
            },
          },
        }),
        db.deposit.count({ where }),
      ]);
      if (ctx.role === "TENANT")
        rows = rows.map((value) => {
          const d = value as {
            id: string;
            amountPence: number;
            receivedAt: Date | null;
            scheme: string;
            reference: string;
            status: string;
            returnedPence: number;
            tenancy: unknown;
            deductions: {
              description: string;
              amountPence: number;
              accepted: boolean;
              tenantResponse: string;
            }[];
          };
          return {
            id: d.id,
            amountPence: d.amountPence,
            receivedAt: d.receivedAt,
            scheme: d.scheme,
            reference: d.reference,
            status: d.status,
            returnedPence: d.returnedPence,
            tenancy: d.tenancy,
            deductions: d.deductions.map((x) => ({
              description: x.description,
              amountPence: x.amountPence,
              accepted: x.accepted,
              tenantResponse: x.tenantResponse,
            })),
          };
        });
      break;
    }
    case "listings": {
      permit(ctx, "lettings");
      const where = { ...scope };
      [rows, total] = await Promise.all([
        db.listing.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          include: {
            property: { select: { name: true } },
            _count: { select: { applications: true } },
          },
        }),
        db.listing.count({ where }),
      ]);
      break;
    }
    case "applications": {
      permit(ctx, "lettings");
      const where = { ...base, listing: { ...linkedPropertyScope(ctx) } };
      [rows, total] = await Promise.all([
        db.application.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          include: { listing: { select: { title: true } } },
        }),
        db.application.count({ where }),
      ]);
      break;
    }
    default: {
      invariant(operationKind(resource), 404, "Module not found.");
      if (ctx.role === "TENANT")
        invariant(
          ["feedback", "passport", "transitions", "inventories"].includes(
            resource,
          ),
          403,
          "This module is restricted.",
        );
      else permit(ctx, operationPermission(resource));
      const where = {
        ...scope,
        kind: resource,
        ...(resource === "passport" ? { userId: ctx.userId } : {}),
        ...(ctx.role === "TENANT"
          ? resource === "passport" || resource === "feedback"
            ? { userId: ctx.userId }
            : { tenancyId: { in: ctx.tenancyIds } }
          : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      };
      [rows, total] = await Promise.all([
        db.operationRecord.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          include: { property: { select: { name: true } } },
        }),
        db.operationRecord.count({ where }),
      ]);
    }
  }
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}
export async function createResource(
  ctx: Context,
  resource: string,
  raw: unknown,
) {
  switch (resource) {
    case "properties": {
      permit(ctx, "properties", true);
      const x = propertySchema.parse(raw);
      await validatePropertyChanges(ctx, x);
      const p = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
        await checkLimit(ctx, "property", 1, tx);
        const created = await tx.property.create({
          data: { ...x, organisationId: ctx.organisationId },
        });
        if (ctx.role === "STAFF" && ctx.propertyIds.length)
          await tx.membership.update({
            where: {
              organisationId_userId: {
                organisationId: ctx.organisationId,
                userId: ctx.userId,
              },
            },
            data: { propertyIds: { push: created.id } },
          });
        return created;
      });
      await audit(ctx, "property.created", "property", p.id);
      await db.organisation.updateMany({
        where: { id: ctx.organisationId, onboardingStep: { lt: 2 } },
        data: { onboardingStep: 2 },
      });
      return { id: p.id };
    }
    case "units": {
      const x = unitInput.parse(raw);
      await checkProperty(ctx, x.propertyId);
      const u = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
        await checkLimit(ctx, "unit", 1, tx);
        await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${x.propertyId} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
        invariant(
          !(
            await tx.property.findUniqueOrThrow({ where: { id: x.propertyId } })
          ).archivedAt,
          409,
          "Archived properties cannot receive new rooms.",
        );
        return tx.unit.create({
          data: { ...x, organisationId: ctx.organisationId },
        });
      });
      await audit(ctx, "unit.created", "property", x.propertyId, {
        unitId: u.id,
      });
      return { id: u.id };
    }
    case "tenants": {
      permit(ctx, "tenants", true);
      await entitlement(ctx, "core");
      const x = tenantSchema.parse(raw);
      const t = await db.tenant.create({
        data: { ...x, organisationId: ctx.organisationId },
      });
      await audit(ctx, "tenant.created", "tenant", t.id);
      return { id: t.id };
    }
    case "tenancies": {
      const { tenantIds, ...x } = tenancySchema.parse(raw);
      await checkProperty(ctx, x.propertyId, "tenancies");
      await entitlement(ctx, "core");
      invariant(
        new Set(tenantIds).size === tenantIds.length &&
          (await db.tenant.count({
            where: {
              id: { in: tenantIds },
              organisationId: ctx.organisationId,
            },
          })) === tenantIds.length,
        422,
        "Invalid tenant selection.",
      );
      if (x.unitId)
        invariant(
          await db.unit.findFirst({
            where: {
              id: x.unitId,
              organisationId: ctx.organisationId,
              propertyId: x.propertyId,
            },
          }),
          422,
          "Invalid room.",
        );
      const t = await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${x.propertyId} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
          invariant(
            !(
              await tx.property.findUniqueOrThrow({
                where: { id: x.propertyId },
              })
            ).archivedAt,
            409,
            "Archived properties cannot receive new tenancies.",
          );
          if (x.unitId)
            invariant(
              await tx.unit.findFirst({
                where: {
                  id: x.unitId,
                  propertyId: x.propertyId,
                  organisationId: ctx.organisationId,
                  archivedAt: null,
                },
              }),
              422,
              "Choose an active room belonging to this property.",
            );
          const overlap = await tx.tenancy.findFirst({
            where: {
              organisationId: ctx.organisationId,
              propertyId: x.propertyId,
              status: { in: ["active", "periodic", "ending"] },
              OR: x.unitId
                ? [{ unitId: x.unitId }, { unitId: null }]
                : undefined,
            },
          });
          invariant(
            !overlap,
            409,
            "An active tenancy already occupies this property or room.",
          );
          return tx.tenancy.create({
            data: {
              ...x,
              initialRentPence: x.rentPence,
              startDate: new Date(x.startDate),
              endDate: x.endDate ? new Date(x.endDate) : undefined,
              organisationId: ctx.organisationId,
              participants: {
                create: tenantIds.map((tenantId) => ({ tenantId })),
              },
              deposit: { create: { amountPence: x.depositPence } },
              tasks: {
                create: [
                  "Agreement completion",
                  "Initial rent",
                  "Deposit information",
                  "Inventory and keys",
                  "Document provision",
                ].map((title) => ({
                  propertyId: x.propertyId,
                  title,
                  category: "move-in",
                  dueDate: new Date(x.startDate),
                  dedupeKey: `move-in:${x.reference}:${title}`,
                })),
              },
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
      await generateRent(ctx.organisationId, t.id);
      await audit(ctx, "tenancy.created", "tenancy", t.id);
      await db.organisation.updateMany({
        where: { id: ctx.organisationId, onboardingStep: { lt: 3 } },
        data: { onboardingStep: 3 },
      });
      return { id: t.id };
    }
    case "repairs":
      return createRepair(ctx, raw);
    case "payments":
      return recordPayment(ctx, raw);
    case "rent":
      return addCharge(ctx, raw);
    case "expenses": {
      const x = expenseSchema.parse(raw);
      await checkProperty(ctx, x.propertyId, "finance");
      await entitlement(ctx, "finance");
      if (x.repairId) {
        await getRepair(ctx, x.repairId);
        invariant(
          await db.repair.findFirst({
            where: { id: x.repairId, propertyId: x.propertyId },
          }),
          422,
          "Repair belongs to a different property.",
        );
      }
      const r = await db.expense.create({
        data: {
          ...x,
          incurredAt: new Date(x.incurredAt),
          organisationId: ctx.organisationId,
        },
      });
      await audit(ctx, "expense.created", "expense", r.id);
      return { id: r.id };
    }
    case "compliance": {
      const x = complianceSchema.parse(raw);
      await checkProperty(ctx, x.propertyId, "compliance");
      await entitlement(ctx, "compliance");
      if (x.documentId) permit(ctx, "documents");
      if (x.documentId)
        invariant(
          await db.document.findFirst({
            where: {
              id: x.documentId,
              organisationId: ctx.organisationId,
              propertyId: x.propertyId,
            },
          }),
          422,
          "Invalid document.",
        );
      if (x.replacesId)
        invariant(
          await db.complianceRecord.findFirst({
            where: {
              id: x.replacesId,
              organisationId: ctx.organisationId,
              propertyId: x.propertyId,
              category: x.category,
            },
          }),
          422,
          "Choose a replacement record for the same property and category.",
        );
      const r = await db.$transaction(async (tx) => {
        const created = await tx.complianceRecord.create({
          data: {
            ...x,
            issuedAt: new Date(x.issuedAt),
            expiresAt: x.expiresAt ? new Date(x.expiresAt) : undefined,
            organisationId: ctx.organisationId,
          },
        });
        if (x.replacesId)
          await tx.complianceRecord.update({
            where: { id: x.replacesId },
            data: { status: "superseded" },
          });
        return created;
      });
      await audit(ctx, "compliance.recorded", "compliance", r.id);
      return { id: r.id };
    }
    case "tasks": {
      const x = taskSchema.parse(raw);
      permit(ctx, "tasks", true);
      await entitlement(ctx, "core");
      if (x.propertyId) await checkProperty(ctx, x.propertyId, "tasks");
      if (x.tenancyId) await checkTenancy(ctx, x.tenancyId, "tasks", true);
      if (x.repairId) await getRepair(ctx, x.repairId);
      if (x.assignedToUserId)
        invariant(
          await db.membership.findFirst({
            where: {
              userId: x.assignedToUserId,
              organisationId: ctx.organisationId,
              active: true,
              role: { in: ["OWNER", "STAFF"] },
            },
          }),
          422,
          "Invalid staff assignment.",
        );
      const t = await db.task.create({
        data: {
          ...x,
          dueDate: new Date(x.dueDate),
          organisationId: ctx.organisationId,
          dedupeKey: randomUUID(),
        },
      });
      return { id: t.id };
    }
    case "assets": {
      const x = assetSchema.parse(raw);
      await checkProperty(ctx, x.propertyId, "operations");
      await entitlement(ctx, "operations");
      const r = await db.propertyAsset.create({
        data: {
          ...x,
          installedAt: x.installedAt ? new Date(x.installedAt) : undefined,
          lastServiceAt: x.lastServiceAt
            ? new Date(x.lastServiceAt)
            : undefined,
          warrantyExpiresAt: x.warrantyExpiresAt
            ? new Date(x.warrantyExpiresAt)
            : undefined,
          replacementAt: x.replacementAt
            ? new Date(x.replacementAt)
            : undefined,
          organisationId: ctx.organisationId,
        },
      });
      return { id: r.id };
    }
    case "listings": {
      const x = listingSchema.parse(raw);
      await checkProperty(ctx, x.propertyId, "lettings");
      await entitlement(ctx, "operations");
      const r = await db.listing.create({
        data: {
          ...x,
          availableAt: new Date(x.availableAt),
          organisationId: ctx.organisationId,
          slug: randomUUID(),
        },
      });
      return { id: r.id };
    }
    case "messages": {
      const x = z
        .object({
          tenancyId: z.string(),
          subject: z.string().min(3).max(150),
          body: z.string().min(1).max(10000),
          tenantIds: z.array(z.string()).default([]),
        })
        .parse(raw);
      const t = await checkTenancy(
        ctx,
        x.tenancyId,
        "messages",
        ctx.role !== "TENANT",
      );
      await entitlement(ctx, "messages");
      invariant(
        x.tenantIds.every((id) =>
          t.participants.some((p) => p.tenantId === id),
        ),
        422,
        "Invalid recipients.",
      );
      const recipients =
        ctx.role === "TENANT"
          ? await managerIds(ctx, "messages", t.propertyId)
          : t.participants
              .filter((p) => x.tenantIds.includes(p.tenantId))
              .map((p) => p.tenant.userId)
              .filter((s): s is string => !!s);
      invariant(
        recipients.length > 0,
        422,
        "Choose at least one tenant with active portal access.",
      );
      const r = await db.conversation.create({
        data: {
          organisationId: ctx.organisationId,
          tenancyId: t.id,
          subject: x.subject,
          participantUserIds: [ctx.userId, ...recipients],
          messages: {
            create: {
              senderUserId: ctx.userId,
              senderName: ctx.name,
              body: x.body,
              readBy: [ctx.userId],
            },
          },
        },
      });
      await notify(
        ctx.organisationId,
        recipients,
        "New message",
        "/app/messages",
        `message:${r.id}`,
      );
      return { id: r.id };
    }
    case "portfolios":
    case "owners": {
      invariant(ctx.role === "OWNER", 403, "Owner access required.");
      const x = z
        .object({
          name: z.string().min(2).max(120),
          type: z.enum(["individual", "limited company"]).default("individual"),
          companyNumber: z.string().max(30).optional(),
        })
        .parse(raw);
      const r =
        resource === "portfolios"
          ? await db.portfolio.create({
              data: { name: x.name, organisationId: ctx.organisationId },
            })
          : await db.ownershipEntity.create({
              data: { ...x, organisationId: ctx.organisationId },
            });
      return { id: r.id };
    }
    default: {
      invariant(operationKind(resource), 404, "Module not found.");
      const x = z
        .object({
          title: z.string().min(3).max(150),
          propertyId: z.string().optional(),
          tenancyId: z.string().optional(),
          data: z.unknown(),
        })
        .parse(raw);
      const data = operationSchemas[resource].parse(x.data);
      if (resource === "passport")
        invariant(
          "source" in data && data.source === "self-reported",
          403,
          "Platform records are generated from the actual ledger during export.",
        );
      await entitlement(
        ctx,
        resource === "forecasts" ? "finance" : "operations",
      );
      if (ctx.role === "TENANT") {
        invariant(
          ["feedback", "passport"].includes(resource),
          403,
          "This action is restricted.",
        );
        if (x.tenancyId) await checkTenancy(ctx, x.tenancyId, "operations");
        if (x.propertyId)
          invariant(
            ctx.activePropertyIds.includes(x.propertyId),
            404,
            "Property not found.",
          );
        if (resource === "passport")
          invariant(
            "source" in data && data.source === "self-reported",
            403,
            "Verified records must come from the platform.",
          );
        if (resource === "feedback" && "response" in data) {
          data.response = "";
          data.responses = [];
        }
        if (resource === "feedback" && "repairId" in data && data.repairId)
          await getRepair(ctx, data.repairId as string);
      } else {
        permit(ctx, operationPermission(resource), true);
        if (x.propertyId)
          await checkProperty(ctx, x.propertyId, operationPermission(resource));
        if (x.tenancyId)
          await checkTenancy(
            ctx,
            x.tenancyId,
            operationPermission(resource),
            true,
          );
      }
      if (x.tenancyId) {
        const linked = await db.tenancy.findFirstOrThrow({
          where: { id: x.tenancyId, organisationId: ctx.organisationId },
        });
        invariant(
          !x.propertyId || x.propertyId === linked.propertyId,
          422,
          "Property and tenancy links must match.",
        );
        x.propertyId = linked.propertyId;
      }
      if (resource === "feedback" && "repairId" in data && data.repairId) {
        const repair = await getRepair(ctx, data.repairId);
        invariant(
          !x.propertyId || x.propertyId === repair.property.id,
          422,
          "Feedback and repair must belong to the same property.",
        );
        x.propertyId = repair.property.id;
      }
      if (resource === "inventories" && "items" in data) {
        const docIds = (data.items as { documentIds: string[] }[]).flatMap(
          (i) => i.documentIds,
        );
        invariant(
          (await db.document.count({
            where: {
              id: { in: [...new Set(docIds)] },
              organisationId: ctx.organisationId,
            },
          })) === new Set(docIds).size,
          422,
          "Invalid inventory evidence.",
        );
      }
      const r = await db.operationRecord.create({
        data: {
          organisationId: ctx.organisationId,
          kind: resource,
          title: x.title,
          propertyId: x.propertyId,
          tenancyId: x.tenancyId,
          userId: ctx.userId,
          data,
        },
      });
      await audit(ctx, `${resource}.created`, resource, r.id);
      if (resource === "feedback")
        await notify(
          ctx.organisationId,
          await managerIds(ctx, "operations", x.propertyId),
          "New tenant feedback",
          "/app/feedback",
          `feedback:${r.id}`,
        );
      return { id: r.id };
    }
  }
}
export async function updateResource(
  ctx: Context,
  resource: string,
  id: string,
  raw: unknown,
) {
  const x = z.record(z.string(), z.unknown()).parse(raw);
  if (resource === "feedback") return updateFeedback(ctx, id, raw);
  if (resource === "units") return updateUnit(ctx, id, raw);
  if (resource === "properties") {
    await checkProperty(ctx, id);
    await entitlement(ctx, "core");
    if (x.archive === true) {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
        invariant(
          !(await tx.tenancy.count({
            where: {
              organisationId: ctx.organisationId,
              propertyId: id,
              status: { in: ["active", "periodic", "ending"] },
            },
          })),
          409,
          "End active tenancies before archiving.",
        );
        await tx.property.update({
          where: { id },
          data: { archivedAt: new Date() },
        });
      });
    } else {
      const data = propertySchema.partial().parse(raw);
      await validatePropertyChanges(ctx, data);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
        const before = await tx.property.findUniqueOrThrow({ where: { id } });
        await tx.property.update({
          where: { id },
          data: {
            ...data,
            details: data.details
              ? {
                  ...(before.details as import("@/generated/prisma/client").Prisma.JsonObject),
                  ...data.details,
                }
              : undefined,
          },
        });
      });
    }
    await audit(ctx, "property.updated", "property", id);
    return { id };
  }
  if (resource === "tenants") {
    permit(ctx, "tenants", true);
    await entitlement(ctx, "core");
    const t = await db.tenant.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        ...(ctx.role === "STAFF" && ctx.propertyIds.length
          ? {
              participants: {
                some: { tenancy: { propertyId: { in: ctx.propertyIds } } },
              },
            }
          : {}),
      },
    });
    invariant(t, 404, "Tenant not found.");
    await db.tenant.update({
      where: { id },
      data: tenantSchema.partial().omit({ email: true }).parse(raw),
    });
    return { id };
  }
  if (resource === "tenancies") {
    const t = await checkTenancy(ctx, id, "tenancies", true);
    await entitlement(ctx, "core");
    if (x.rentPence !== undefined) {
      const change = z
        .object({
          rentPence: z.number().int().positive().max(100000000),
          effectiveFrom: z.iso.date(),
          reason: z.string().min(5).max(2000),
          requirementsReviewed: z.literal(true),
        })
        .parse(raw);
      invariant(
        change.effectiveFrom >= new Date().toISOString().slice(0, 10),
        422,
        "Rent changes cannot rewrite historical obligations.",
      );
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Tenancy" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
          const changes = await tx.rentChange.findMany({
            where: { tenancyId: id },
            orderBy: { effectiveFrom: "asc" },
          });
          const effectiveFrom = new Date(change.effectiveFrom);
          const proposed = [
            ...changes,
            { effectiveFrom, rentPence: change.rentPence },
          ].sort(
            (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
          );
          const allocated = await tx.rentObligation.findMany({
            where: {
              tenancyId: id,
              scheduleKey: { startsWith: "rent:" },
              dueDate: { gte: effectiveFrom },
              allocations: { some: {} },
            },
          });
          invariant(
            !allocated.some(
              (o) =>
                proposed.find((c) => c.effectiveFrom <= o.dueDate)
                  ?.rentPence !== o.amountPence,
            ),
            409,
            "A rent change would alter an allocated obligation. Review the payment allocations first.",
          );
          await tx.rentChange.create({
            data: {
              organisationId: ctx.organisationId,
              tenancyId: id,
              rentPence: change.rentPence,
              effectiveFrom,
              reason: change.reason,
              actorUserId: ctx.userId,
            },
          });
          await tx.auditLog.create({
            data: {
              organisationId: ctx.organisationId,
              actorUserId: ctx.userId,
              action: "tenancy.rent.changed",
              resourceType: "tenancy",
              resourceId: id,
              metadata: {
                effectiveFrom: change.effectiveFrom,
                amountPence: change.rentPence,
              },
            },
          });
          await generateRent(ctx.organisationId, id, new Date(), tx);
        },
        { isolationLevel: "Serializable" },
      );
      return { id };
    }
    const input = z
      .object({
        status: z.enum(["active", "periodic", "ending", "ended"]),
        endDate: z.iso.date().optional(),
      })
      .parse(raw);
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${t.propertyId} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Tenancy" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
        if (input.status !== "ended") {
          invariant(
            !(
              await tx.property.findUniqueOrThrow({
                where: { id: t.propertyId },
              })
            ).archivedAt,
            409,
            "Archived properties cannot be occupied.",
          );
          const overlap = await tx.tenancy.findFirst({
            where: {
              id: { not: id },
              organisationId: ctx.organisationId,
              propertyId: t.propertyId,
              status: { in: ["active", "periodic", "ending"] },
              ...(t.unitId
                ? { OR: [{ unitId: t.unitId }, { unitId: null }] }
                : {}),
            },
          });
          invariant(
            !overlap,
            409,
            "Another active tenancy occupies this property or room.",
          );
        }
        const endDate =
          input.status === "periodic"
            ? null
            : input.endDate
              ? new Date(input.endDate)
              : input.status === "ended"
                ? utcDay()
                : t.endDate;
        invariant(
          !endDate || endDate >= t.startDate,
          422,
          "End date cannot precede the tenancy start date.",
        );
        invariant(
          input.status !== "ended" || (endDate && endDate <= utcDay()),
          422,
          "Use ending status for a future move-out date.",
        );
        if (endDate && ["ending", "ended"].includes(input.status)) {
          const cutoff = new Date(
            Math.max(endDate.getTime(), utcDay().getTime()),
          );
          const future = {
            tenancyId: id,
            organisationId: ctx.organisationId,
            scheduleKey: { startsWith: "rent:" },
            dueDate: { gt: cutoff },
          };
          invariant(
            !(await tx.rentObligation.count({
              where: { ...future, allocations: { some: {} } },
            })),
            409,
            "Rent after the proposed end date has allocated payments. Review those allocations before ending the tenancy.",
          );
          const removed = await tx.rentObligation.deleteMany({
            where: { ...future, allocations: { none: {} } },
          });
          if (removed.count)
            await tx.auditLog.create({
              data: {
                organisationId: ctx.organisationId,
                actorUserId: ctx.userId,
                action: "rent.future.schedule.cancelled",
                resourceType: "tenancy",
                resourceId: id,
                metadata: {
                  count: removed.count,
                  afterDate: cutoff.toISOString().slice(0, 10),
                },
              },
            });
        }
        await tx.tenancy.update({
          where: { id },
          data: {
            ...input,
            endDate,
          },
        });
        if (input.status === "ending") {
          for (const title of [
            "Final inspection",
            "Meter readings and keys",
            "Outstanding rent review",
            "Deposit review and return",
            "Prepare for reletting",
          ])
            await tx.task.upsert({
              where: { dedupeKey: `move-out:${id}:${title}` },
              create: {
                organisationId: ctx.organisationId,
                propertyId: t.propertyId,
                tenancyId: id,
                title,
                category: "move-out",
                dueDate: input.endDate ? new Date(input.endDate) : new Date(),
                dedupeKey: `move-out:${id}:${title}`,
              },
              update: {},
            });
        }
        await generateRent(ctx.organisationId, id, new Date(), tx);
      },
      { isolationLevel: "Serializable" },
    );
    await audit(ctx, "tenancy.status.changed", "tenancy", id, {
      status: input.status,
    });
    return { id };
  }
  if (resource === "tasks") {
    permit(ctx, "tasks", true);
    await entitlement(ctx, "core");
    const t = await db.task.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        ...linkedPropertyScope(ctx),
      },
    });
    invariant(t, 404, "Task not found.");
    const data = z
      .object({
        status: z.enum(["open", "completed", "cancelled"]),
        notes: z.string().max(10000).optional(),
      })
      .parse(raw);
    await db.task.update({ where: { id }, data });
    if (data.status === "completed" && t.recurrenceDays) {
      const dueDate = new Date(t.dueDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + t.recurrenceDays);
      await db.task.upsert({
        where: { dedupeKey: `repeat:${id}` },
        create: {
          organisationId: ctx.organisationId,
          propertyId: t.propertyId,
          tenancyId: t.tenancyId,
          title: t.title,
          notes: t.notes,
          category: t.category,
          priority: t.priority,
          dueDate,
          recurrenceDays: t.recurrenceDays,
          dedupeKey: `repeat:${id}`,
        },
        update: {},
      });
    }
    await audit(ctx, "task.updated", "task", id);
    return { id };
  }
  if (resource === "expenses") {
    permit(ctx, "finance", true);
    await entitlement(ctx, "finance");
    const e = await db.expense.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        ...linkedPropertyScope(ctx),
      },
    });
    invariant(e, 404, "Expense not found.");
    await db.expense.update({
      where: { id },
      data: z.object({ reconciled: z.boolean() }).parse(raw),
    });
    return { id };
  }
  if (resource === "deposits") {
    permit(ctx, "tenancies", true);
    await entitlement(ctx, "operations");
    const d = await db.deposit.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        tenancy: { ...linkedPropertyScope(ctx) },
      },
    });
    invariant(d, 404, "Deposit not found.");
    const data = z
      .object({
        scheme: z.string().max(120),
        reference: z.string().max(120),
        status: z.enum([
          "not recorded",
          "received",
          "scheme recorded",
          "return in progress",
          "returned",
        ]),
        receivedAt: z.iso.date().optional(),
        returnedPence: z.number().int().min(0),
        notes: z.string().max(5000),
        deductions: z
          .array(
            z.object({
              description: z.string().min(3).max(1000),
              amountPence: z.number().int().positive(),
              accepted: z.boolean(),
              tenantResponse: z.string().max(2000).default(""),
              documentIds: z.array(z.string()).default([]),
            }),
          )
          .max(100),
      })
      .parse(raw);
    invariant(
      data.returnedPence +
        data.deductions
          .filter((x) => x.accepted)
          .reduce((s, x) => s + x.amountPence, 0) <=
        d.amountPence,
      422,
      "Returns and accepted deductions exceed the deposit.",
    );
    const docIds = data.deductions.flatMap((d) => d.documentIds);
    invariant(
      (await db.document.count({
        where: {
          id: { in: [...new Set(docIds)] },
          organisationId: ctx.organisationId,
        },
      })) === new Set(docIds).size,
      422,
      "Invalid evidence.",
    );
    await db.deposit.update({
      where: { id },
      data: {
        ...data,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
      },
    });
    await audit(ctx, "deposit.updated", "deposit", id);
    return { id };
  }
  if (resource === "messages") {
    const c = await db.conversation.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        tenancy: { ...linkedPropertyScope(ctx) },
        ...(ctx.role === "TENANT"
          ? { participantUserIds: { has: ctx.userId } }
          : {}),
      },
    });
    invariant(c, 404, "Conversation not found.");
    if (ctx.role !== "TENANT") permit(ctx, "messages", true);
    await entitlement(ctx, "messages");
    if (x.read === true) {
      await db.message.updateMany({
        where: { conversationId: id, NOT: { readBy: { has: ctx.userId } } },
        data: { readBy: { push: ctx.userId } },
      });
      return { id };
    }
    const input = z.object({ body: z.string().min(1).max(10000) }).parse(raw);
    const m = await db.message.create({
      data: {
        ...input,
        organisationId: ctx.organisationId,
        conversationId: id,
        senderUserId: ctx.userId,
        senderName: ctx.name,
        readBy: [ctx.userId],
      },
    });
    await notify(
      ctx.organisationId,
      c.participantUserIds.filter((u) => u !== ctx.userId),
      "New message",
      "/app/messages",
      `message:${m.id}`,
    );
    return { id };
  }
  if (resource === "listings") {
    permit(ctx, "lettings", true);
    await entitlement(ctx, "operations");
    const l = await db.listing.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        ...linkedPropertyScope(ctx),
      },
    });
    invariant(l, 404, "Listing not found.");
    await db.listing.update({
      where: { id },
      data: z.object({ published: z.boolean() }).parse(raw),
    });
    return { id };
  }
  if (resource === "applications") {
    permit(ctx, "lettings", true);
    await entitlement(ctx, "operations");
    const a = await db.application.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        listing: { ...linkedPropertyScope(ctx) },
      },
    });
    invariant(a, 404, "Application not found.");
    const data = z
      .object({
        status: z.enum([
          "enquiry",
          "viewing scheduled",
          "applied",
          "under review",
          "accepted",
          "declined",
        ]),
        referencingStatus: z
          .enum([
            "not started",
            "manual review",
            "provider pending",
            "recorded manually",
          ])
          .optional(),
        viewingDate: z.iso.datetime().optional(),
      })
      .parse(raw);
    await db.application.update({
      where: { id },
      data: {
        status: data.status,
        referencingStatus: data.referencingStatus,
        details: data.viewingDate
          ? {
              ...(a.details as Record<string, string>),
              viewingDate: data.viewingDate,
            }
          : undefined,
      },
    });
    if (data.status === "accepted")
      await db.tenant.upsert({
        where: {
          organisationId_email: {
            organisationId: ctx.organisationId,
            email: a.email,
          },
        },
        create: {
          organisationId: ctx.organisationId,
          name: a.name,
          email: a.email,
          phone: a.phone,
        },
        update: {},
      });
    await audit(ctx, "application.updated", "application", id, {
      status: data.status,
    });
    return { id };
  }
  if (ctx.role === "TENANT" && resource === "inventories") {
    const input = z
      .object({
        acknowledge: z.literal(true),
        comment: z.string().max(5000).default(""),
      })
      .parse(raw);
    const r = await db.operationRecord.findFirst({
      where: {
        id,
        kind: "inventories",
        organisationId: ctx.organisationId,
        tenancyId: { in: ctx.tenancyIds },
      },
    });
    invariant(r, 404, "Inventory not found.");
    const data = operationSchemas.inventories.parse(r.data);
    await db.operationRecord.update({
      where: { id },
      data: {
        data: {
          ...data,
          acknowledged: true,
          tenantComments: [data.tenantComments, input.comment]
            .filter(Boolean)
            .join("\n"),
        },
      },
    });
    await audit(ctx, "inventory.acknowledged", "inventories", id);
    return { id };
  }
  invariant(operationKind(resource), 404, "Module not found.");
  const r = await db.operationRecord.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      kind: resource,
      ...(resource === "passport" ? { userId: ctx.userId } : {}),
      ...linkedPropertyScope(ctx),
      ...(ctx.role === "TENANT" ? { userId: ctx.userId } : {}),
    },
  });
  invariant(r, 404, "Record not found.");
  if (ctx.role === "TENANT")
    invariant(
      ["feedback", "passport"].includes(resource),
      403,
      "This record is read-only.",
    );
  else permit(ctx, operationPermission(resource), true);
  await entitlement(ctx, resource === "forecasts" ? "finance" : "operations");
  const input = z
    .object({
      status: z
        .enum(["draft", "in progress", "completed", "closed", "cancelled"])
        .optional(),
      data: z.unknown().optional(),
    })
    .parse(raw);
  const data =
    input.data === undefined
      ? undefined
      : operationSchemas[resource].parse(input.data);
  if (data && resource === "passport")
    invariant(
      "source" in data && data.source === "self-reported",
      403,
      "Verified records cannot be self-reported.",
    );
  if (
    ctx.role === "TENANT" &&
    data &&
    resource === "feedback" &&
    "response" in data
  )
    data.response = operationSchemas.feedback.parse(r.data).response;
  await db.operationRecord.update({
    where: { id },
    data: { status: input.status, data },
  });
  await audit(ctx, `${resource}.updated`, resource, id);
  return { id };
}
