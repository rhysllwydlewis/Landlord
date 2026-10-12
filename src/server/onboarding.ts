import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { sessionUser, permit, audit, type Context } from "./context";
import { checkLimit, entitlement } from "./entitlements";
import { invariant } from "./errors";
import { queueEmail } from "./email";
import { permissions } from "@/lib/config";
export async function createOrganisation(raw: unknown) {
  const user = await sessionUser();
  const x = z
    .object({
      name: z.string().trim().min(2).max(120),
      type: z.enum(["individual", "limited company"]),
      jurisdiction: z.enum([
        "England",
        "Wales",
        "Scotland",
        "Northern Ireland",
      ]),
    })
    .parse(raw);
  const existing = await db.membership.findFirst({
    where: { userId: user.id, role: "OWNER" },
  });
  invariant(!existing, 409, "You already have an organisation.");
  const plan = await db.subscriptionPlan.findFirst({
    where: {
      active: true,
      developmentOnly: process.env.NODE_ENV !== "production",
    },
    orderBy: { monthlyPence: "asc" },
  });
  invariant(plan, 503, "No subscription plan has been configured.");
  const org = await db.organisation.create({
    data: {
      ...x,
      onboardingStep: 1,
      memberships: { create: { userId: user.id, role: "OWNER" } },
      subscription: {
        create: {
          planId: plan.id,
          provider:
            process.env.NODE_ENV === "production" ? "stripe" : "development",
          status: "trialing",
          trialEndsAt: new Date(Date.now() + plan.trialDays * 86400000),
        },
      },
    },
  });
  return { id: org.id };
}
export async function invite(ctx: Context, raw: unknown) {
  await entitlement(ctx, "core");
  const input = z
    .object({
      email: z.email(),
      role: z.enum(["TENANT", "STAFF", "STAKEHOLDER"]),
      tenantId: z.string().optional(),
      permissions: z
        .array(
          z.enum(
            permissions.flatMap((p) => [`${p}:read`, `${p}:write`]) as [
              string,
              ...string[],
            ],
          ),
        )
        .default([]),
      propertyIds: z.array(z.string()).default([]),
    })
    .parse(raw);
  if (input.role === "TENANT") {
    permit(ctx, "tenants", true);
    invariant(input.tenantId, 422, "Select a tenant.");
    const tenant = await db.tenant.findFirst({
      where: {
        id: input.tenantId,
        organisationId: ctx.organisationId,
        ...(ctx.role === "STAFF" && ctx.propertyIds.length
          ? {
              participants: {
                some: { tenancy: { propertyId: { in: ctx.propertyIds } } },
              },
            }
          : {}),
      },
    });
    invariant(
      tenant && tenant.email.toLowerCase() === input.email.toLowerCase(),
      422,
      "Invitation email must match the tenant.",
    );
    invariant(!tenant.userId, 409, "This tenant already has portal access.");
  } else {
    invariant(
      ctx.role === "OWNER",
      403,
      "Only the organisation owner can invite staff or stakeholders.",
    );
  }
  const properties = await db.property.count({
    where: {
      organisationId: ctx.organisationId,
      id: { in: input.propertyIds },
    },
  });
  invariant(
    properties === input.propertyIds.length,
    422,
    "Invalid property access.",
  );
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const i = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
    invariant(
      !(await tx.invitation.findFirst({
        where: {
          organisationId: ctx.organisationId,
          email: input.email.toLowerCase(),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      })),
      409,
      "A valid invitation already exists for this email.",
    );
    if (input.role === "STAFF") await checkLimit(ctx, "staff", 1, tx);
    return tx.invitation.create({
      data: {
        ...input,
        email: input.email.toLowerCase(),
        organisationId: ctx.organisationId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  });
  await queueEmail(
    input.email,
    "Your portal invitation",
    `Create an account with this email address, verify it, then accept your invitation: ${process.env.APP_URL}/invite?token=${token}`,
    ctx.organisationId,
    `invitation:${i.id}`,
  );
  await audit(ctx, "invitation.created", "invitation", i.id, {
    role: input.role,
  });
  return { id: i.id };
}
export async function acceptInvitation(raw: unknown) {
  const user = await sessionUser();
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(raw);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return db.$transaction(
    async (tx) => {
      const i = await tx.invitation.findUnique({ where: { tokenHash } });
      invariant(
        i &&
          !i.acceptedAt &&
          i.expiresAt > new Date() &&
          i.email === user.email.toLowerCase(),
        404,
        "This invitation is unavailable or belongs to another email address.",
      );
      const existing = await tx.membership.findUnique({
        where: {
          organisationId_userId: {
            organisationId: i.organisationId,
            userId: user.id,
          },
        },
      });
      invariant(
        !existing || existing.role === i.role,
        409,
        "This account already has a different organisation role.",
      );
      await tx.membership.upsert({
        where: {
          organisationId_userId: {
            organisationId: i.organisationId,
            userId: user.id,
          },
        },
        create: {
          organisationId: i.organisationId,
          userId: user.id,
          role: i.role,
          permissions: i.permissions,
          propertyIds: i.propertyIds,
        },
        update: { active: true },
      });
      if (i.tenantId)
        await tx.tenant.updateMany({
          where: {
            id: i.tenantId,
            organisationId: i.organisationId,
            userId: null,
          },
          data: { userId: user.id },
        });
      await tx.invitation.update({
        where: { id: i.id },
        data: { acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organisationId: i.organisationId,
          actorUserId: user.id,
          action: "invitation.accepted",
          resourceType: "invitation",
          resourceId: i.id,
        },
      });
      return { id: i.organisationId };
    },
    { isolationLevel: "Serializable" },
  );
}
