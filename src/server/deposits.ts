import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "./db";
import { permit, linkedPropertyScope, type Context } from "./context";
import { entitlement } from "./entitlements";
import { invariant } from "./errors";
import { notify, managerIds } from "./notifications";

const deductionsSchema = z
  .array(
    z.object({
      description: z.string().min(3).max(1000),
      amountPence: z.number().int().positive(),
      accepted: z.boolean(),
      tenantResponse: z.string().max(2000).default(""),
      documentIds: z.array(z.string()).default([]),
    }),
  )
  .max(100);
type Proposal = {
  amountPence: number;
  scheme: string;
  reference: string;
  returnedPence: number;
  deductions: unknown;
};
export function depositProposalHash(deposit: Proposal) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        amountPence: deposit.amountPence,
        scheme: deposit.scheme,
        reference: deposit.reference,
        returnedPence: deposit.returnedPence,
        deductions: deductionsSchema
          .parse(deposit.deductions)
          .map((d) => ({
            description: d.description,
            amountPence: d.amountPence,
            accepted: d.accepted,
            documentIds: [...d.documentIds].sort(),
          })),
      }),
    )
    .digest("hex");
}
function depositScope(ctx: Context, id: string) {
  return {
    id,
    organisationId: ctx.organisationId,
    tenancy: {
      ...linkedPropertyScope(ctx),
      ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
    },
  };
}
export async function getDepositDetail(ctx: Context, id: string) {
  if (ctx.role !== "TENANT") permit(ctx, "tenancies");
  const deposit = await db.deposit.findFirst({
    where: depositScope(ctx, id),
    include: {
      tenancy: {
        select: { reference: true, property: { select: { name: true } } },
      },
      responses: {
        where: ctx.role === "TENANT" ? { tenantId: { in: ctx.tenantIds } } : {},
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          proposalHash: true,
          decision: true,
          body: true,
          createdAt: true,
          tenant: { select: { name: true } },
        },
      },
    },
  });
  invariant(deposit, 404, "Deposit not found.");
  return {
    id: deposit.id,
    amountPence: deposit.amountPence,
    scheme: deposit.scheme,
    reference: deposit.reference,
    status: deposit.status,
    receivedAt: deposit.receivedAt,
    returnedPence: deposit.returnedPence,
    tenancy: deposit.tenancy,
    proposalHash: depositProposalHash(deposit),
    deductions: deductionsSchema
      .parse(deposit.deductions)
      .map((d) => ({
        description: d.description,
        amountPence: d.amountPence,
        accepted: d.accepted,
      })),
    responses: deposit.responses,
  };
}
export async function respondToDeposit(ctx: Context, id: string, raw: unknown) {
  invariant(
    ctx.role === "TENANT",
    403,
    "Only an affected tenant can submit their own response.",
  );
  await entitlement(ctx, "operations");
  const input = z
    .object({
      proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
      decision: z.enum(["agree", "disagree", "question"]),
      body: z.string().trim().min(5).max(2000),
      idempotencyKey: z.string().uuid(),
    })
    .strict()
    .parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Deposit" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
    const deposit = await tx.deposit.findFirst({
      where: depositScope(ctx, id),
      include: { tenancy: { select: { propertyId: true } } },
    });
    invariant(deposit, 404, "Deposit not found.");
    const participant = await tx.tenancyParticipant.findFirst({
      where: {
        organisationId: ctx.organisationId,
        tenancyId: deposit.tenancyId,
        tenantId: { in: ctx.tenantIds },
      },
      orderBy: { tenantId: "asc" },
    });
    invariant(participant, 404, "Deposit not found.");
    const duplicate = await tx.depositResponse.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId: ctx.organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (duplicate) {
      invariant(
        duplicate.depositId === id &&
          duplicate.tenantId === participant.tenantId &&
          duplicate.proposalHash === input.proposalHash &&
          duplicate.decision === input.decision &&
          duplicate.body === input.body,
        409,
        "This submission key was already used for another response.",
      );
      return { id: duplicate.id };
    }
    invariant(
      input.proposalHash === depositProposalHash(deposit),
      409,
      "The deposit proposal has changed. Reload and review it before responding.",
    );
    invariant(
      (await tx.depositResponse.count({
        where: { depositId: id, organisationId: ctx.organisationId },
      })) < 100,
      422,
      "This deposit has reached its response limit. Use private messages to continue.",
    );
    const response = await tx.depositResponse.create({
      data: {
        ...input,
        depositId: id,
        tenantId: participant.tenantId,
        organisationId: ctx.organisationId,
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "deposit.response.created",
        resourceType: "deposit",
        resourceId: id,
        metadata: { decision: input.decision },
      },
    });
    await notify(
      ctx.organisationId,
      await managerIds(ctx, "tenancies", deposit.tenancy.propertyId),
      "A tenant responded to a deposit proposal",
      "/app/deposits",
      `deposit-response:${response.id}`,
      "deposit",
      id,
      tx,
    );
    return { id: response.id };
  });
}
