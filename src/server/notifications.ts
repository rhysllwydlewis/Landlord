import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { queueEmail } from "./email";
import type { Context } from "./context";
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
