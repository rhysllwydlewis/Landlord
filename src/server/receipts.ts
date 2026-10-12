import { db } from "./db";
import { permit, linkedPropertyScope, audit, type Context } from "./context";
import { invariant } from "./errors";
export async function paymentReceipt(ctx: Context, id: string) {
  if (ctx.role !== "TENANT") permit(ctx, "rent");
  const payment = await db.payment.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      tenancy: {
        ...linkedPropertyScope(ctx),
        ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
      },
    },
    select: {
      id: true,
      amountPence: true,
      paidAt: true,
      reference: true,
      method: true,
      tenancy: {
        select: {
          reference: true,
          property: { select: { name: true, address: true, postcode: true } },
          unit: { select: { name: true } },
        },
      },
      allocations: {
        orderBy: { obligation: { dueDate: "asc" } },
        select: {
          amountPence: true,
          obligation: { select: { description: true, dueDate: true } },
        },
      },
    },
  });
  invariant(payment, 404, "Payment not found.");
  const organisation = await db.organisation.findUniqueOrThrow({
    where: { id: ctx.organisationId },
    select: { name: true },
  });
  await audit(ctx, "payment.receipt.viewed", "payment", id);
  return {
    ...payment,
    organisation,
    creditPence:
      payment.amountPence -
      payment.allocations.reduce(
        (sum, allocation) => sum + allocation.amountPence,
        0,
      ),
  };
}
