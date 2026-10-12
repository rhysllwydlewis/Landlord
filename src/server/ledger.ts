import { z } from "zod";
import { db } from "./db";
import { checkTenancy, audit, type Context } from "./context";
import { entitlement } from "./entitlements";
import { allocate, outstanding, rentDates } from "@/lib/calculations";
export const paymentInput = z.object({
  tenancyId: z.string(),
  amountPence: z.number().int().positive().max(100000000),
  paidAt: z.iso.date(),
  method: z
    .enum(["bank transfer", "cash", "cheque", "other"])
    .default("bank transfer"),
  reference: z.string().trim().min(1).max(150),
  idempotencyKey: z.uuid(),
});
export async function recordPayment(ctx: Context, raw: unknown) {
  const input = paymentInput.parse(raw);
  await checkTenancy(ctx, input.tenancyId, "rent", true);
  await entitlement(ctx, "rent");
  const p = await db.$transaction(
    async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (
          existing.organisationId !== ctx.organisationId ||
          existing.tenancyId !== input.tenancyId ||
          existing.amountPence !== input.amountPence
        )
          throw new Error("Idempotency conflict");
        return existing;
      }
      const obligations = await tx.rentObligation.findMany({
        where: {
          organisationId: ctx.organisationId,
          tenancyId: input.tenancyId,
        },
        include: { allocations: true },
        orderBy: { dueDate: "asc" },
      });
      const allocation = allocate(
        input.amountPence,
        obligations.map((o) => ({
          id: o.id,
          balance: outstanding(o.amountPence, o.allocations),
        })),
      );
      const payment = await tx.payment.create({
        data: {
          ...input,
          paidAt: new Date(input.paidAt),
          organisationId: ctx.organisationId,
          allocations: {
            create: allocation.allocations.map((a) => ({ ...a })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId: ctx.organisationId,
          actorUserId: ctx.userId,
          action: "payment.recorded",
          resourceType: "payment",
          resourceId: payment.id,
          metadata: {
            amountPence: input.amountPence,
            creditPence: allocation.creditPence,
          },
        },
      });
      return payment;
    },
    { isolationLevel: "Serializable" },
  );
  return { id: p.id };
}
export async function generateRent(
  organisationId: string,
  tenancyId?: string,
  now = new Date(),
) {
  const tenancies = await db.tenancy.findMany({
    where: {
      organisationId,
      status: { in: ["active", "periodic", "ending"] },
      ...(tenancyId ? { id: tenancyId } : {}),
    },
    include: { rentChanges: { orderBy: { effectiveFrom: "asc" } } },
  });
  for (const t of tenancies) {
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0),
    );
    const dates = rentDates(
      t.startDate,
      t.endDate && t.endDate < end ? t.endDate : end,
      t.frequency,
      t.dueDay,
    );
    await db.$transaction(
      async (tx) => {
        for (const dueDate of dates) {
          const rate =
            [...t.rentChanges].reverse().find((c) => c.effectiveFrom <= dueDate)
              ?.rentPence || t.rentPence;
          const key = `rent:${t.id}:${dueDate.toISOString().slice(0, 10)}`;
          const existing = await tx.rentObligation.findUnique({
            where: { scheduleKey: key },
            include: { allocations: true },
          });
          await tx.rentObligation.upsert({
            where: {
              scheduleKey: `rent:${t.id}:${dueDate.toISOString().slice(0, 10)}`,
            },
            create: {
              organisationId,
              tenancyId: t.id,
              dueDate,
              amountPence: rate,
              scheduleKey: `rent:${t.id}:${dueDate.toISOString().slice(0, 10)}`,
            },
            update:
              existing &&
              existing.dueDate >=
                new Date(new Date().toISOString().slice(0, 10)) &&
              !existing.allocations.length
                ? { amountPence: rate }
                : {},
          });
        }
        const currentRate = [...t.rentChanges]
          .reverse()
          .find((c) => c.effectiveFrom <= now);
        if (currentRate)
          await tx.tenancy.update({
            where: { id: t.id },
            data: { rentPence: currentRate.rentPence },
          });
        const payments = await tx.payment.findMany({
          where: { organisationId, tenancyId: t.id },
          include: { allocations: true },
          orderBy: { paidAt: "asc" },
        });
        const obligations = await tx.rentObligation.findMany({
          where: { organisationId, tenancyId: t.id },
          include: { allocations: true },
          orderBy: { dueDate: "asc" },
        });
        const remaining = obligations.map((o) => ({
          id: o.id,
          balance: outstanding(o.amountPence, o.allocations),
        }));
        for (const p of payments) {
          const credit =
            p.amountPence -
            p.allocations.reduce((s, a) => s + a.amountPence, 0);
          const { allocations } = allocate(credit, remaining);
          for (const a of allocations) {
            await tx.paymentAllocation.upsert({
              where: {
                paymentId_obligationId: {
                  paymentId: p.id,
                  obligationId: a.obligationId,
                },
              },
              create: { ...a, organisationId, paymentId: p.id },
              update: { amountPence: { increment: a.amountPence } },
            });
            remaining.find((o) => o.id === a.obligationId)!.balance -=
              a.amountPence;
          }
        }
      },
      { isolationLevel: "Serializable" },
    );
  }
}
export async function addCharge(ctx: Context, raw: unknown) {
  const x = z
    .object({
      tenancyId: z.string(),
      amountPence: z.number().int().min(0).max(100000000),
      dueDate: z.iso.date(),
      description: z.string().min(3).max(250),
      idempotencyKey: z.uuid(),
    })
    .parse(raw);
  await checkTenancy(ctx, x.tenancyId, "rent", true);
  await entitlement(ctx, "rent");
  const r = await db.rentObligation.create({
    data: {
      organisationId: ctx.organisationId,
      tenancyId: x.tenancyId,
      amountPence: x.amountPence,
      dueDate: new Date(x.dueDate),
      description: x.description,
      scheduleKey: `charge:${x.idempotencyKey}`,
    },
  });
  await audit(ctx, "charge.created", "rent", r.id);
  return { id: r.id };
}
