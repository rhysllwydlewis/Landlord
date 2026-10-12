import { z } from "zod";
import { db } from "./db";
import { permit, linkedPropertyScope, type Context } from "./context";
import { entitlement } from "./entitlements";
import { invariant } from "./errors";
import { operationSchemas } from "./schemas";
import { notify } from "./notifications";
const status = z.enum([
  "draft",
  "in progress",
  "completed",
  "closed",
  "cancelled",
]);
function feedbackScope(ctx: Context, id: string) {
  return {
    id,
    organisationId: ctx.organisationId,
    kind: "feedback",
    ...linkedPropertyScope(ctx),
    ...(ctx.role === "TENANT" ? { userId: ctx.userId } : {}),
  };
}
async function access(ctx: Context) {
  if (ctx.role !== "TENANT") permit(ctx, "operations", true);
  await entitlement(ctx, "operations");
}
export async function updateFeedback(ctx: Context, id: string, raw: unknown) {
  await access(ctx);
  const input = z
    .object({
      status: status.optional(),
      data: operationSchemas.feedback.optional(),
      title: z.string().trim().min(3).max(150).optional(),
      propertyId: z.string().optional(),
      tenancyId: z.string().optional(),
    })
    .strict()
    .parse(raw);
  invariant(
    ctx.role === "TENANT" || input.data === undefined,
    422,
    "Use the response form; tenant feedback cannot be rewritten by a manager.",
  );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OperationRecord" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
    const record = await tx.operationRecord.findFirst({
      where: feedbackScope(ctx, id),
    });
    invariant(record, 404, "Feedback not found.");
    invariant(
      (input.propertyId === undefined ||
        input.propertyId === record.propertyId) &&
        (input.tenancyId === undefined || input.tenancyId === record.tenancyId),
      422,
      "Feedback links cannot be changed after submission.",
    );
    const before = operationSchemas.feedback.parse(record.data);
    if (input.data?.repairId !== undefined)
      invariant(
        input.data.repairId === before.repairId,
        422,
        "The linked repair cannot be changed after submission.",
      );
    await tx.operationRecord.update({
      where: { id },
      data: {
        status: input.status,
        title: ctx.role === "TENANT" ? input.title : undefined,
        data: input.data
          ? {
              ...input.data,
              repairId: before.repairId,
              response: before.response,
              responses: before.responses,
            }
          : undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "feedback.updated",
        resourceType: "feedback",
        resourceId: id,
      },
    });
    return { id };
  });
}
export async function respondToFeedback(
  ctx: Context,
  id: string,
  raw: unknown,
) {
  permit(ctx, "operations", true);
  await entitlement(ctx, "operations");
  const input = z
    .object({
      response: z.string().trim().min(1).max(5000),
      status: status.optional(),
      idempotencyKey: z.string().uuid(),
    })
    .strict()
    .parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OperationRecord" WHERE id=${id} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
    const record = await tx.operationRecord.findFirst({
      where: feedbackScope(ctx, id),
    });
    invariant(record, 404, "Feedback not found.");
    const before = operationSchemas.feedback.parse(record.data);
    const duplicate = before.responses.find(
      (r) => r.id === input.idempotencyKey,
    );
    if (duplicate) {
      invariant(
        duplicate.body === input.response &&
          (!input.status || duplicate.status === input.status),
        409,
        "This submission key was already used for a different response.",
      );
      return { id };
    }
    invariant(
      before.responses.length < 100,
      422,
      "This feedback thread has reached its response limit.",
    );
    const nextStatus =
      input.status ||
      (record.status === "draft" ? "in progress" : status.parse(record.status));
    const entry = {
      id: input.idempotencyKey,
      body: input.response,
      authorName: ctx.name,
      createdAt: new Date().toISOString(),
      status: nextStatus,
    };
    await tx.operationRecord.update({
      where: { id },
      data: {
        status: nextStatus,
        data: {
          ...before,
          response: input.response,
          responses: [...before.responses, entry],
        },
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "feedback.response.created",
        resourceType: "feedback",
        resourceId: id,
      },
    });
    if (
      record.userId &&
      (await tx.membership.findFirst({
        where: {
          organisationId: ctx.organisationId,
          userId: record.userId,
          active: true,
        },
      }))
    )
      await notify(
        ctx.organisationId,
        [record.userId],
        "Your feedback has a response",
        "/app/feedback",
        `feedback-response:${id}:${input.idempotencyKey}`,
        "feedback",
        id,
        tx,
      );
    return { id };
  });
}
