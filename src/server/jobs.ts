import { Resend } from "resend";
import { db } from "./db";
import { generateRent } from "./ledger";
import { outstanding, utcDay } from "@/lib/calculations";
import { notify, managerIds } from "./notifications";
import type { Context } from "./context";
import { invariant } from "./errors";
import { organisationSettings } from "@/lib/workspace-settings";
export async function schedule(now = new Date(), organisationId?: string) {
  const orgs = await db.organisation.findMany({
    where: {
      status: "active",
      ...(organisationId ? { id: organisationId } : {}),
    },
  });
  for (const org of orgs) {
    const preferences = organisationSettings(org.settings);
    const ctx: Context = {
      organisationId: org.id,
      userId: "system",
      name: "System",
      email: "",
      role: "OWNER",
      permissions: [],
      propertyIds: [],
      tenantIds: [],
      tenancyIds: [],
      activePropertyIds: [],
    };
    await generateRent(org.id, undefined, now);
    const compliance = await db.complianceRecord.findMany({
      where: {
        organisationId: org.id,
        status: { not: "superseded" },
        expiresAt: {
          lte: new Date(
            now.getTime() + preferences.complianceReminderDays * 86400000,
          ),
        },
      },
    });
    for (const c of compliance) {
      const days = Math.ceil(
        (c.expiresAt!.getTime() - now.getTime()) / 86400000,
      );
      if (days <= preferences.complianceReminderDays)
        await notify(
          org.id,
          await managerIds(ctx, "compliance", c.propertyId),
          "Compliance record needs review",
          "/app/compliance",
          `compliance:${c.id}:${days > 7 ? String(preferences.complianceReminderDays) : days > 0 ? "7" : "expired"}`,
        );
    }
    const documents = await db.document.findMany({
      where: {
        organisationId: org.id,
        archivedAt: null,
        expiresAt: {
          lte: new Date(
            now.getTime() + preferences.documentReminderDays * 86400000,
          ),
        },
        OR: [{ propertyId: null }, { property: { archivedAt: null } }],
      },
    });
    for (const document of documents) {
      const days = Math.ceil(
        (document.expiresAt!.getTime() - now.getTime()) / 86400000,
      );
      await notify(
        org.id,
        await managerIds(ctx, "documents", document.propertyId || undefined),
        "Document expiry needs review",
        "/app/documents",
        `document-expiry:${document.id}:${document.expiresAt!.toISOString().slice(0, 10)}:${days > 7 ? "upcoming" : days > 0 ? "near" : "expired"}`,
        "document",
        document.id,
      );
    }
    const rent = await db.rentObligation.findMany({
      where: { organisationId: org.id, dueDate: { lt: utcDay(now) } },
      include: {
        allocations: true,
        tenancy: { include: { participants: { include: { tenant: true } } } },
      },
    });
    for (const o of rent)
      if (outstanding(o.amountPence, o.allocations) > 0) {
        const recipients = o.tenancy.participants
          .map((p) => p.tenant.userId)
          .filter((x): x is string => !!x);
        await notify(
          org.id,
          [
            ...recipients,
            ...(await managerIds(ctx, "rent", o.tenancy.propertyId)),
          ],
          "Rent balance needs review",
          "/app/rent",
          `arrears:${o.id}:${Math.floor(now.getTime() / (7 * 86400000))}`,
        );
      }
    const tasks = await db.task.findMany({
      where: { organisationId: org.id, status: "open", dueDate: { lte: now } },
    });
    for (const t of tasks)
      await notify(
        org.id,
        t.assignedToUserId
          ? [t.assignedToUserId]
          : await managerIds(ctx, "tasks", t.propertyId || undefined),
        "A task is due",
        "/app/tasks",
        `task:${t.id}:${now.toISOString().slice(0, 10)}`,
      );
    const rules = await db.complianceRule.findMany({
      where: {
        active: true,
        reviewed: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
    });
    for (const rule of rules) {
      const properties = await db.property.findMany({
        where: {
          organisationId: org.id,
          archivedAt: null,
          jurisdiction: rule.jurisdiction,
          type: { in: rule.propertyTypes },
        },
      });
      for (const p of properties)
        await db.task.upsert({
          where: { dedupeKey: `rule:${rule.id}:${p.id}` },
          create: {
            organisationId: org.id,
            propertyId: p.id,
            title: rule.name,
            category: "compliance",
            notes: `${rule.instructions}\nSource: ${rule.sourceUrl}\nRule version: ${rule.version}`,
            dueDate: now,
            dedupeKey: `rule:${rule.id}:${p.id}`,
          },
          update: {},
        });
    }
  }
}
export async function processJobs() {
  await db.backgroundJob.updateMany({
    where: {
      status: "processing",
      lockedAt: { lt: new Date(Date.now() - 15 * 60000) },
    },
    data: { status: "queued", lockedAt: null },
  });
  const jobs = await db.backgroundJob.findMany({
    where: { status: "queued", runAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const job of jobs) {
    const claimed = await db.backgroundJob.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "processing",
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    try {
      const payload = job.payload as {
        to: string;
        subject: string;
        text: string;
        userId?: string;
        resourceType?: string;
        resourceId?: string;
      };
      if (job.organisationId && payload.userId) {
        const member = await db.membership.findFirst({
          where: {
            organisationId: job.organisationId,
            userId: payload.userId,
            active: true,
            organisation: { status: "active" },
          },
        });
        let allowed = !!member;
        if (member && payload.resourceType === "repair") {
          const scope =
            member.role === "TENANT"
              ? {
                  OR: [
                    { reporter: { userId: payload.userId } },
                    {
                      grants: { some: { tenant: { userId: payload.userId } } },
                    },
                  ],
                }
              : member.role === "STAFF" && member.propertyIds.length
                ? { propertyId: { in: member.propertyIds } }
                : {};
          allowed =
            (member.role === "OWNER" ||
              member.role === "TENANT" ||
              (member.role === "STAFF" &&
                member.permissions.some((p) =>
                  ["repairs:read", "repairs:write"].includes(p),
                ))) &&
            !!(await db.repair.findFirst({
              where: {
                id: payload.resourceId,
                organisationId: job.organisationId,
                ...scope,
              },
            }));
        }
        if (member && payload.resourceType === "document") {
          allowed =
            (member.role === "OWNER" ||
              member.role === "TENANT" ||
              (member.role === "STAFF" &&
                member.permissions.some((p) =>
                  ["documents:read", "documents:write"].includes(p),
                )) ||
              (member.role === "STAKEHOLDER" &&
                member.permissions.includes("documents:read"))) &&
            !!(await db.document.findFirst({
              where: {
                id: payload.resourceId,
                organisationId: job.organisationId,
                archivedAt: null,
                ...(member.role === "TENANT"
                  ? {
                      visibility: "shared",
                      grants: { some: { tenant: { userId: payload.userId } } },
                      OR: [
                        { repairId: null },
                        {
                          repair: {
                            OR: [
                              { reporter: { userId: payload.userId } },
                              {
                                grants: {
                                  some: { tenant: { userId: payload.userId } },
                                },
                              },
                            ],
                          },
                        },
                      ],
                    }
                  : member.role === "STAKEHOLDER"
                    ? {
                        ownerVisible: true,
                        propertyId: { in: member.propertyIds },
                      }
                    : member.role === "STAFF" && member.propertyIds.length
                      ? { propertyId: { in: member.propertyIds } }
                      : {}),
              },
            }));
        }
        if (!allowed) {
          await db.backgroundJob.update({
            where: { id: job.id },
            data: { status: "cancelled", lockedAt: null },
          });
          continue;
        }
      }
      if (job.type === "email") {
        if (!process.env.RESEND_API_KEY) {
          invariant(
            process.env.NODE_ENV !== "production",
            503,
            "Email provider is unconfigured",
          );
          await db.backgroundJob.update({
            where: { id: job.id },
            data: { status: "local", lockedAt: null },
          });
          continue;
        }
        invariant(process.env.EMAIL_FROM, 503, "Email sender is unconfigured");
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
          {
            from: process.env.EMAIL_FROM,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
          },
          { idempotencyKey: job.dedupeKey },
        );
        invariant(!result.error, 502, "Email delivery failed");
      } else throw new Error("Unsupported job type");
      await db.backgroundJob.update({
        where: { id: job.id },
        data: { status: "completed", lockedAt: null, lastError: null },
      });
    } catch {
      const failed = job.attempts + 1 >= 5;
      await db.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: failed ? "failed" : "queued",
          lockedAt: null,
          lastError:
            "Delivery failed. Check provider configuration and status.",
          runAt: new Date(
            Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts),
          ),
        },
      });
    }
  }
}
