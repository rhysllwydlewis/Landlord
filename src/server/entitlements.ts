import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { invariant } from "./errors";
import type { Context } from "./context";
export async function entitlement(
  ctx: Context,
  feature: string,
  client: Prisma.TransactionClient = db,
) {
  const s = await client.subscription.findUnique({
    where: { organisationId: ctx.organisationId },
    include: { plan: true },
  });
  invariant(s, 402, "Choose a subscription plan first.");
  invariant(
    !(s.provider === "development" || s.plan.developmentOnly) ||
      process.env.NODE_ENV !== "production",
    402,
    "Development subscriptions cannot be used in production.",
  );
  invariant(
    ["active", "trialing"].includes(s.status),
    402,
    "Your subscription does not permit new changes.",
  );
  invariant(
    s.status !== "trialing" || (!!s.trialEndsAt && s.trialEndsAt > new Date()),
    402,
    "Your trial has ended.",
  );
  const flag = await client.platformSetting.findUnique({
    where: { key: `feature.${feature}` },
  });
  invariant(
    !flag ||
      !(
        typeof flag.value === "object" &&
        flag.value !== null &&
        !Array.isArray(flag.value) &&
        flag.value.enabled === false
      ),
    403,
    "This feature is temporarily disabled.",
  );
  invariant(
    s.plan.features.includes(feature),
    402,
    "This feature is not included in your plan.",
  );
  return s;
}
export async function checkLimit(
  ctx: Context,
  kind: "property" | "unit" | "staff" | "storage",
  addition = 1,
  client: Prisma.TransactionClient = db,
) {
  const s = await entitlement(
    ctx,
    kind === "storage" ? "documents" : "core",
    client,
  );
  const count =
    kind === "property"
      ? await client.property.count({
          where: { organisationId: ctx.organisationId, archivedAt: null },
        })
      : kind === "unit"
        ? await client.unit.count({
            where: { organisationId: ctx.organisationId, archivedAt: null },
          })
        : kind === "staff"
          ? (await client.membership.count({
              where: {
                organisationId: ctx.organisationId,
                role: "STAFF",
                active: true,
              },
            })) +
            (await client.invitation.count({
              where: {
                organisationId: ctx.organisationId,
                role: "STAFF",
                acceptedAt: null,
                expiresAt: { gt: new Date() },
              },
            }))
          : Number(
              (
                await client.document.aggregate({
                  where: {
                    organisationId: ctx.organisationId,
                    archivedAt: null,
                  },
                  _sum: { size: true },
                })
              )._sum.size || 0,
            );
  const limit =
    kind === "property"
      ? s.plan.propertyLimit
      : kind === "unit"
        ? s.plan.unitLimit
        : kind === "staff"
          ? s.plan.staffLimit
          : Number(s.plan.storageBytes);
  invariant(
    count + addition <= limit,
    402,
    `Your plan's ${kind} limit has been reached.`,
  );
}
