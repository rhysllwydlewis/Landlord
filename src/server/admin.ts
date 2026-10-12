import { z } from "zod";
import { sessionUser } from "./context";
import { db } from "./db";
import { invariant } from "./errors";
export async function adminUser() {
  const user = await sessionUser();
  const record = await db.user.findUnique({ where: { id: user.id } });
  invariant(
    record?.platformAdmin,
    403,
    "Platform administrator access required.",
  );
  invariant(
    process.env.NODE_ENV !== "production" || record.twoFactorEnabled,
    403,
    "Platform administrators must enable two-factor authentication.",
  );
  return user;
}
export async function adminOverview() {
  const u = await adminUser();
  await db.auditLog.create({
    data: {
      actorUserId: u.id,
      action: "admin.overview.viewed",
      resourceType: "platform",
      resourceId: "overview",
    },
  });
  const [
    organisations,
    users,
    plans,
    rules,
    jobs,
    audit,
    subscriptions,
    settings,
  ] = await Promise.all([
    db.organisation.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { properties: true, memberships: true } },
      },
    }),
    db.user.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    db.subscriptionPlan.findMany(),
    db.complianceRule.findMany(),
    db.backgroundJob.findMany({
      where: { status: { in: ["failed", "queued"] } },
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
      },
    }),
    db.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        createdAt: true,
      },
    }),
    db.subscription.groupBy({ by: ["status", "planId"], _count: true }),
    db.platformSetting.findMany(),
  ]);
  return {
    organisations,
    users,
    plans,
    rules,
    jobs,
    audit,
    subscriptions,
    settings,
  };
}
export async function adminAction(raw: unknown) {
  const u = await adminUser();
  const x = z
    .object({
      action: z.enum(["plan", "rule", "retry", "organisation", "setting"]),
      id: z.string().optional(),
      data: z.unknown(),
    })
    .parse(raw);
  let resourceId = x.id || "";
  if (x.action === "plan") {
    const data = z
      .object({
        name: z.string().min(2).max(100),
        monthlyPence: z.number().int().min(0),
        annualPence: z.number().int().min(0),
        propertyLimit: z.number().int().min(1),
        unitLimit: z.number().int().min(1),
        staffLimit: z.number().int().min(0),
        storageBytes: z.number().int().positive(),
        features: z.array(
          z.enum([
            "core",
            "repairs",
            "rent",
            "documents",
            "messages",
            "compliance",
            "finance",
            "operations",
          ]),
        ),
        trialDays: z.number().int().min(0).max(90),
        active: z.boolean(),
        developmentOnly: z.boolean(),
        stripeMonthlyPriceId: z.string().optional(),
        stripeAnnualPriceId: z.string().optional(),
      })
      .parse(x.data);
    invariant(
      process.env.NODE_ENV !== "production" || !data.developmentOnly,
      422,
      "Development plans cannot be created in production.",
    );
    const p = x.id
      ? await db.subscriptionPlan.update({
          where: { id: x.id },
          data: { ...data, storageBytes: BigInt(data.storageBytes) },
        })
      : await db.subscriptionPlan.create({
          data: { ...data, storageBytes: BigInt(data.storageBytes) },
        });
    resourceId = p.id;
  }
  if (x.action === "rule") {
    const data = z
      .object({
        name: z.string().min(3),
        jurisdiction: z.enum([
          "England",
          "Wales",
          "Scotland",
          "Northern Ireland",
        ]),
        propertyTypes: z.array(z.string()).min(1),
        version: z.number().int().positive(),
        effectiveFrom: z.iso.date(),
        effectiveTo: z.iso.date().optional(),
        sourceUrl: z.url(),
        instructions: z.string().min(20),
        reviewed: z.boolean(),
        active: z.boolean(),
      })
      .parse(x.data);
    invariant(
      !data.active || data.reviewed,
      422,
      "Review a rule before activating it.",
    );
    invariant(
      !data.effectiveTo || data.effectiveTo >= data.effectiveFrom,
      422,
      "Invalid rule dates.",
    );
    const r = await db.complianceRule.create({
      data: {
        ...data,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      },
    });
    resourceId = r.id;
  }
  if (x.action === "retry") {
    invariant(x.id, 422, "Select a failed job.");
    const result = await db.backgroundJob.updateMany({
      where: { id: x.id, status: "failed" },
      data: {
        status: "queued",
        attempts: 0,
        lastError: null,
        runAt: new Date(),
      },
    });
    invariant(result.count, 404, "Failed job not found.");
  }
  if (x.action === "organisation") {
    invariant(x.id, 422, "Select an organisation.");
    const data = z
      .object({ status: z.enum(["active", "suspended"]) })
      .parse(x.data);
    await db.organisation.update({ where: { id: x.id }, data });
    if (data.status === "suspended") {
      const ids = (
        await db.membership.findMany({
          where: { organisationId: x.id },
          select: { userId: true },
        })
      ).map((m) => m.userId);
      await db.session.deleteMany({ where: { userId: { in: ids } } });
    }
  }
  if (x.action === "setting") {
    const data = z
      .object({
        key: z.string().regex(/^[a-z0-9_.-]{3,100}$/),
        enabled: z.boolean(),
      })
      .parse(x.data);
    await db.platformSetting.upsert({
      where: { key: data.key },
      create: { key: data.key, value: { enabled: data.enabled } },
      update: { value: { enabled: data.enabled } },
    });
    resourceId = data.key;
  }
  await db.auditLog.create({
    data: {
      actorUserId: u.id,
      action: `admin.${x.action}.changed`,
      resourceType: x.action,
      resourceId,
    },
  });
  return { ok: true };
}
