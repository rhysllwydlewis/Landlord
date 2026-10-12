import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { queueEmail } from "./email";
import type { Context } from "./context";
type Recipient = Pick<
  Context,
  "organisationId" | "userId" | "role" | "permissions" | "propertyIds"
>;
type NotificationRecord = {
  resourceType?: string | null;
  resourceId?: string | null;
  dedupeKey?: string;
};

// Use the same current permissions for the notification centre and queued mail.
export async function canViewNotification(
  ctx: Recipient,
  record: NotificationRecord,
) {
  if (!record.resourceType) return true; // Legacy non-object announcements.
  if (!record.resourceId) return false;
  const manager = (domain: string) =>
    ctx.role === "OWNER" ||
    (ctx.role === "STAFF" &&
      ctx.permissions.some((p) =>
        [`${domain}:read`, `${domain}:write`].includes(p),
      ));
  const scope =
    ctx.role === "STAKEHOLDER" ||
    (ctx.role === "STAFF" && ctx.propertyIds.length)
      ? { propertyId: { in: ctx.propertyIds } }
      : {};
  const identity = {
    id: record.resourceId,
    organisationId: ctx.organisationId,
  };
  if (record.resourceType === "repair") {
    if (ctx.role !== "TENANT" && !manager("repairs")) return false;
    return !!(await db.repair.findFirst({
      where: {
        ...identity,
        ...scope,
        ...(ctx.role === "TENANT"
          ? {
              OR: [
                { reporter: { userId: ctx.userId } },
                { grants: { some: { tenant: { userId: ctx.userId } } } },
              ],
            }
          : {}),
      },
      select: { id: true },
    }));
  }
  if (record.resourceType === "document") {
    const expiry = /^(email:)?document-expiry:/.test(record.dedupeKey || "");
    if (
      expiry
        ? !manager("documents")
        : ctx.role !== "TENANT" &&
          !manager("documents") &&
          !(
            ctx.role === "STAKEHOLDER" &&
            ctx.permissions.includes("documents:read")
          )
    )
      return false;
    return !!(await db.document.findFirst({
      where: {
        ...identity,
        ...scope,
        archivedAt: null,
        ...(ctx.role === "STAKEHOLDER" ? { ownerVisible: true } : {}),
        ...(ctx.role === "TENANT"
          ? {
              visibility: "shared",
              grants: { some: { tenant: { userId: ctx.userId } } },
              OR: [
                { repairId: null },
                {
                  repair: {
                    OR: [
                      { reporter: { userId: ctx.userId } },
                      { grants: { some: { tenant: { userId: ctx.userId } } } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      select: { id: true },
    }));
  }
  if (record.resourceType === "deposit") {
    if (!manager("tenancies")) return false;
    return !!(await db.deposit.findFirst({
      where: { ...identity, tenancy: scope },
      select: { id: true },
    }));
  }
  if (record.resourceType === "feedback") {
    if (ctx.role !== "TENANT" && !manager("operations")) return false;
    return !!(await db.operationRecord.findFirst({
      where: {
        ...identity,
        ...scope,
        kind: "feedback",
        ...(ctx.role === "TENANT" ? { userId: ctx.userId } : {}),
      },
      select: { id: true },
    }));
  }
  return false;
}
export async function hasUnreadNotifications(ctx: Recipient) {
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.notification.findMany({
      where: {
        organisationId: ctx.organisationId,
        userId: ctx.userId,
        readAt: null,
      },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        dedupeKey: true,
      },
    });
    for (const row of rows)
      if (await canViewNotification(ctx, row)) return true;
    if (rows.length < 100) return false;
    cursor = rows[rows.length - 1].id;
  }
}

export async function notify(
  organisationId: string,
  userIds: string[],
  title: string,
  href: string,
  key: string,
  resourceType?: string,
  resourceId?: string,
  client?: Prisma.TransactionClient,
): Promise<void> {
  if (!client) {
    await db.$transaction((tx) =>
      notify(
        organisationId,
        userIds,
        title,
        href,
        key,
        resourceType,
        resourceId,
        tx,
      ),
    );
    return;
  }
  for (const userId of [...new Set(userIds)]) {
    await client.notification.upsert({
      where: { dedupeKey: `${key}:${userId}` },
      create: {
        organisationId,
        userId,
        title,
        href,
        dedupeKey: `${key}:${userId}`,
        resourceType,
        resourceId,
      },
      update: {},
    });
    const preferences = await client.operationRecord.findUnique({
      where: { id: `preferences:${userId}:${organisationId}` },
    });
    const optedOut =
      preferences &&
      typeof preferences.data === "object" &&
      preferences.data !== null &&
      !Array.isArray(preferences.data) &&
      preferences.data.email === false;
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user && !optedOut)
      await queueEmail(
        user.email,
        title,
        `There is an update in your property portal. Sign in to view it: ${process.env.APP_URL}${href}`,
        organisationId,
        `email:${key}:${userId}`,
        { userId, resourceType, resourceId },
        client,
      );
  }
}
export async function managerIds(
  ctx: Context,
  domain: string,
  propertyId?: string,
) {
  const m = await db.membership.findMany({
    where: {
      organisationId: ctx.organisationId,
      active: true,
      OR: [
        { role: "OWNER" },
        {
          role: "STAFF",
          permissions: { hasSome: [`${domain}:read`, `${domain}:write`] },
        },
      ],
    },
  });
  return m
    .filter(
      (x) =>
        x.role === "OWNER" ||
        !x.propertyIds.length ||
        (!!propertyId && x.propertyIds.includes(propertyId)),
    )
    .map((x) => x.userId);
}
