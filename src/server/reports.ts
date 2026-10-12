import { z } from "zod";
import { db } from "./db";
import { permit, linkedPropertyScope, type Context } from "./context";
import { invariant } from "./errors";
import { outstanding } from "@/lib/calculations";
export async function financialReport(ctx: Context, params: URLSearchParams) {
  const owner = ctx.role === "STAKEHOLDER";
  if (owner)
    invariant(
      ctx.permissions.includes("finance:read"),
      403,
      "Your owner access does not include financial statements.",
    );
  else {
    permit(ctx, "reports");
    permit(ctx, "finance");
    permit(ctx, "rent");
  }
  const from = params.get("from")
    ? new Date(z.iso.date().parse(params.get("from")))
    : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const to = params.get("to")
    ? new Date(z.iso.date().parse(params.get("to")))
    : new Date();
  to.setUTCHours(23, 59, 59, 999);
  invariant(from <= to, 422, "Invalid date range.");
  const propertyId = params.get("propertyId");
  const scope = {
    organisationId: ctx.organisationId,
    ...linkedPropertyScope(ctx),
    ...(propertyId ? { AND: [{ propertyId }] } : {}),
  };
  const [
    properties,
    payments,
    expenses,
    obligations,
    repairs,
    compliance,
    tenancies,
  ] = await Promise.all([
    db.property.findMany({
      where: {
        organisationId: ctx.organisationId,
        ...(ctx.role === "STAKEHOLDER" ||
        (ctx.role === "STAFF" && ctx.propertyIds.length)
          ? { id: { in: ctx.propertyIds } }
          : {}),
        ...(propertyId ? { AND: [{ id: propertyId }] } : {}),
      },
      select: { id: true, name: true },
    }),
    db.payment.findMany({
      where: {
        organisationId: ctx.organisationId,
        tenancy: scope,
        paidAt: { gte: from, lte: to },
      },
      select: { amountPence: true, tenancy: { select: { propertyId: true } } },
    }),
    db.expense.findMany({
      where: { ...scope, incurredAt: { gte: from, lte: to } },
      select: { amountPence: true, propertyId: true, category: true },
    }),
    db.rentObligation.findMany({
      where: {
        organisationId: ctx.organisationId,
        tenancy: scope,
        dueDate: { lte: to },
      },
      include: {
        allocations: {
          where: { payment: { paidAt: { lte: to } } },
          select: { amountPence: true },
        },
        tenancy: { select: { propertyId: true } },
      },
    }),
    db.repair.groupBy({
      by: ["propertyId", "status"],
      where: { ...scope, createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    db.complianceRecord.findMany({
      where: { ...scope, status: { not: "superseded" } },
      select: { propertyId: true, expiresAt: true },
    }),
    db.tenancy.findMany({
      where: scope,
      select: {
        propertyId: true,
        unitId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);
  const rows = properties.map((p) => {
    const incomePence = payments
      .filter((x) => x.tenancy.propertyId === p.id)
      .reduce((s, x) => s + x.amountPence, 0);
    const expensePence = expenses
      .filter((x) => x.propertyId === p.id)
      .reduce((s, x) => s + x.amountPence, 0);
    return {
      property: p.name,
      incomePence,
      expensePence,
      profitPence: incomePence - expensePence,
      arrearsPence: obligations
        .filter((x) => x.tenancy.propertyId === p.id)
        .reduce((s, x) => s + outstanding(x.amountPence, x.allocations), 0),
      repairs: repairs
        .filter((x) => x.propertyId === p.id)
        .reduce((s, x) => s + x._count, 0),
      complianceDue: compliance.filter(
        (x) =>
          x.propertyId === p.id &&
          x.expiresAt &&
          x.expiresAt <= new Date(Date.now() + 30 * 86400000),
      ).length,
      activeTenancies: tenancies.filter(
        (x) =>
          x.propertyId === p.id &&
          ["active", "periodic", "ending"].includes(x.status),
      ).length,
    };
  });
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totals: rows.reduce(
      (s, r) => ({
        incomePence: s.incomePence + r.incomePence,
        expensePence: s.expensePence + r.expensePence,
        profitPence: s.profitPence + r.profitPence,
        arrearsPence: s.arrearsPence + r.arrearsPence,
      }),
      { incomePence: 0, expensePence: 0, profitPence: 0, arrearsPence: 0 },
    ),
    basis:
      "Cash income and recorded expenses within the range. Arrears as at the end date. Figures are administrative summaries, not tax returns.",
  };
}
