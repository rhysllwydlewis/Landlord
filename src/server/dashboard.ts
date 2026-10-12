import { db } from "./db";
import { linkedPropertyScope, propertyScope, type Context } from "./context";
import { repairWhere } from "./repairs";
import { outstanding, anomalies, utcDay } from "@/lib/calculations";
export function can(ctx: Context, p: string) {
  return (
    ctx.role === "OWNER" ||
    (ctx.role === "STAFF" &&
      (ctx.permissions.includes(`${p}:read`) ||
        ctx.permissions.includes(`${p}:write`)))
  );
}
export async function dashboard(ctx: Context) {
  const base = { organisationId: ctx.organisationId };
  const tenant = ctx.role === "TENANT";
  const stakeholder = ctx.role === "STAKEHOLDER";
  const tenancyScope = {
    ...base,
    ...linkedPropertyScope(ctx),
    ...(tenant ? { id: { in: ctx.tenancyIds } } : {}),
  };
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const [
    properties,
    tenancies,
    units,
    repairs,
    obligations,
    payments,
    expenses,
    compliance,
    tasks,
    activity,
  ] = await Promise.all([
    can(ctx, "properties") || stakeholder || tenant
      ? db.property.findMany({
          where: {
            ...base,
            ...propertyScope(ctx),
            ...(tenant ? { id: { in: ctx.activePropertyIds } } : {}),
            archivedAt: null,
          },
          select: {
            id: true,
            name: true,
            postcode: true,
            type: true,
            bedrooms: true,
            epcRating: true,
          },
        })
      : [],
    can(ctx, "tenancies") || tenant
      ? db.tenancy.findMany({
          where: tenancyScope,
          select: {
            id: true,
            propertyId: true,
            unitId: true,
            status: true,
            rentPence: true,
            frequency: true,
            reference: true,
            startDate: true,
            endDate: true,
          },
        })
      : [],
    can(ctx, "properties") || stakeholder
      ? db.unit.count({
          where: { ...base, ...linkedPropertyScope(ctx), archivedAt: null },
        })
      : 0,
    can(ctx, "repairs") || tenant
      ? db.repair.findMany({
          where: repairWhere(ctx),
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            targetDate: true,
            property: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    can(ctx, "rent") || tenant
      ? db.rentObligation.findMany({
          where: { ...base, tenancy: tenancyScope },
          include: { allocations: { select: { amountPence: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    can(ctx, "rent") || can(ctx, "finance") || tenant
      ? db.payment.findMany({
          where: {
            ...base,
            tenancy: {
              ...linkedPropertyScope(ctx),
              ...(tenant ? { id: { in: ctx.tenancyIds } } : {}),
            },
          },
          select: {
            id: true,
            amountPence: true,
            paidAt: true,
            allocations: { select: { amountPence: true } },
          },
          orderBy: { paidAt: "desc" },
        })
      : [],
    can(ctx, "finance")
      ? db.expense.findMany({
          where: { ...base, ...linkedPropertyScope(ctx) },
          select: {
            id: true,
            amountPence: true,
            description: true,
            invoiceReference: true,
            propertyId: true,
            incurredAt: true,
          },
        })
      : [],
    can(ctx, "compliance") || stakeholder
      ? db.complianceRecord.findMany({
          where: {
            ...base,
            ...linkedPropertyScope(ctx),
            status: { not: "superseded" },
            expiresAt: { lte: new Date(Date.now() + 30 * 86400000) },
          },
          select: {
            id: true,
            title: true,
            expiresAt: true,
            property: { select: { name: true } },
          },
          orderBy: { expiresAt: "asc" },
        })
      : [],
    can(ctx, "tasks")
      ? db.task.findMany({
          where: { ...base, ...linkedPropertyScope(ctx), status: "open" },
          select: { id: true, title: true, dueDate: true, priority: true },
          orderBy: { dueDate: "asc" },
        })
      : [],
    ctx.role === "OWNER"
      ? db.auditLog.findMany({
          where: base,
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            resourceType: true,
            createdAt: true,
          },
        })
      : [],
  ]);
  const active = tenancies.filter((t) =>
    ["active", "periodic", "ending"].includes(t.status),
  );
  const openRepairs = repairs.filter(
    (r) => !["resolved", "closed", "cancelled"].includes(r.status),
  );
  const occupied = new Set(active.map((t) => t.propertyId)).size;
  const overdue = obligations.filter(
    (o) =>
      o.dueDate < utcDay(now) && outstanding(o.amountPence, o.allocations) > 0,
  );
  const dueMonth = obligations.filter(
    (o) => o.dueDate >= monthStart && o.dueDate < monthEnd,
  );
  const creditPence = payments.reduce(
    (s, p) =>
      s + p.amountPence - p.allocations.reduce((a, x) => a + x.amountPence, 0),
    0,
  );
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
    );
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
    return {
      label: start.toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      }),
      incomePence: payments
        .filter((p) => p.paidAt >= start && p.paidAt < end)
        .reduce((s, p) => s + p.amountPence, 0),
      expensePence: expenses
        .filter((p) => p.incurredAt >= start && p.incurredAt < end)
        .reduce((s, p) => s + p.amountPence, 0),
    };
  });
  return {
    properties,
    tenancies,
    stats: {
      properties: properties.length,
      units,
      occupied,
      vacant: properties.length - occupied,
      activeTenancies: active.length,
      expectedPence: dueMonth.reduce((s, o) => s + o.amountPence, 0),
      receivedPence: payments
        .filter((p) => p.paidAt >= monthStart && p.paidAt < monthEnd)
        .reduce((s, p) => s + p.amountPence, 0),
      outstandingPence: obligations
        .filter((o) => o.dueDate <= now)
        .reduce((s, o) => s + outstanding(o.amountPence, o.allocations), 0),
      creditPence,
      overdue: overdue.length,
      openRepairs: openRepairs.length,
      urgentRepairs: openRepairs.filter((r) =>
        ["high", "emergency"].includes(r.priority),
      ).length,
      compliance: compliance.length,
      tasks: tasks.length,
    },
    monthly,
    repairs: openRepairs.slice(0, 5),
    compliance: compliance.slice(0, 5),
    tasks: tasks.slice(0, 5),
    activity,
    nextRent: obligations.find((o) => o.dueDate >= utcDay(now)) || null,
    anomalies: anomalies(expenses),
    payments: payments.slice(0, 5),
  };
}
export async function options(ctx: Context) {
  const [properties, tenants, tenancies, repairs, documents, compliance] =
    await Promise.all([
      db.property.findMany({
        where: {
          organisationId: ctx.organisationId,
          ...propertyScope(ctx),
          archivedAt: null,
          ...(ctx.role === "TENANT"
            ? { id: { in: ctx.activePropertyIds } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          units: { select: { id: true, name: true } },
        },
      }),
      can(ctx, "tenants") ||
      can(ctx, "repairs") ||
      can(ctx, "documents") ||
      can(ctx, "messages")
        ? db.tenant.findMany({
            where: {
              organisationId: ctx.organisationId,
              ...(ctx.role === "STAFF" && ctx.propertyIds.length
                ? {
                    participants: {
                      some: {
                        tenancy: { propertyId: { in: ctx.propertyIds } },
                      },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
              email: true,
              userId: true,
              participants: { select: { tenancyId: true } },
            },
          })
        : ctx.role === "TENANT"
          ? db.tenant.findMany({
              where: { id: { in: ctx.tenantIds } },
              select: {
                id: true,
                name: true,
                email: true,
                userId: true,
                participants: { select: { tenancyId: true } },
              },
            })
          : [],
      can(ctx, "tenancies") ||
      can(ctx, "rent") ||
      can(ctx, "messages") ||
      can(ctx, "operations") ||
      ctx.role === "TENANT"
        ? db.tenancy.findMany({
            where: {
              organisationId: ctx.organisationId,
              ...linkedPropertyScope(ctx),
              ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
            },
            select: {
              id: true,
              reference: true,
              propertyId: true,
              unitId: true,
            },
          })
        : [],
      can(ctx, "repairs") || ctx.role === "TENANT"
        ? db.repair.findMany({
            where: repairWhere(ctx),
            select: { id: true, title: true, propertyId: true },
          })
        : [],
      can(ctx, "documents")
        ? db.document.findMany({
            where: {
              organisationId: ctx.organisationId,
              archivedAt: null,
              ...linkedPropertyScope(ctx),
            },
            select: { id: true, name: true, propertyId: true },
          })
        : [],
      can(ctx, "compliance")
        ? db.complianceRecord.findMany({
            where: {
              organisationId: ctx.organisationId,
              ...linkedPropertyScope(ctx),
              status: { not: "superseded" },
            },
            select: { id: true, title: true, propertyId: true },
          })
        : [],
    ]);
  return {
    properties,
    tenants: tenants.map((t) => ({
      ...t,
      email: ctx.role === "TENANT" || can(ctx, "tenants") ? t.email : "",
    })),
    tenancies,
    repairs,
    documents,
    compliance,
  };
}
