import { db } from "./db";
import { permit, linkedPropertyScope, type Context } from "./context";
import { invariant } from "./errors";

export async function earlierMessages(
  ctx: Context,
  conversationId: string,
  before?: string,
) {
  if (ctx.role !== "TENANT") permit(ctx, "messages");
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      organisationId: ctx.organisationId,
      tenancy: linkedPropertyScope(ctx),
      ...(ctx.role === "TENANT"
        ? { participantUserIds: { has: ctx.userId } }
        : {}),
    },
  });
  invariant(conversation, 404, "Conversation not found.");
  const anchor = before
    ? await db.message.findFirst({
        where: {
          id: before,
          conversationId,
          organisationId: ctx.organisationId,
        },
      })
    : null;
  invariant(!before || anchor, 404, "Message not found.");
  const rows = await db.message.findMany({
    where: {
      conversationId,
      organisationId: ctx.organisationId,
      ...(anchor
        ? {
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
  });
  const hasMore = rows.length > 50;
  return { messages: rows.slice(0, 50).reverse(), hasMore };
}
