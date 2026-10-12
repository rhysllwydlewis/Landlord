import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import {
  createResource,
  listResource,
  updateResource,
} from "@/server/resources";
import {
  createRepair,
  getRepair,
  setRepairVisibility,
  commentRepair,
  updateRepair,
} from "@/server/repairs";
import { recordPayment, generateRent, addCharge } from "@/server/ledger";
import {
  uploadDocument,
  downloadDocument,
  shareDocument,
} from "@/server/documents";
import { entitlement } from "@/server/entitlements";
import { previewImport, commitImport } from "@/server/imports";
import { schedule } from "@/server/jobs";
import { financialReport } from "@/server/reports";
import type { Context } from "@/server/context";
import { checkProperty, checkTenancy } from "@/server/context";
import { utcDay } from "@/lib/calculations";
import { earlierMessages } from "@/server/messages";
import { options, dashboard } from "@/server/dashboard";
import { acceptInvitation } from "@/server/onboarding";
import * as contextMethods from "@/server/context";
let owner: Context,
  tenant: Context,
  otherTenant: Context,
  otherOwner: Context,
  staff: Context;
let propertyId: string,
  otherProperty: string,
  tenancyId: string,
  privateRepair: string,
  tenantRepair: string,
  tenantId: string,
  tenantB: string;
const suffix = randomUUID().slice(0, 8);
const now = new Date();
const past = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  .toISOString()
  .slice(0, 10);
beforeAll(async () => {
  const plan = await db.subscriptionPlan.create({
    data: {
      name: `Test ${suffix}`,
      monthlyPence: 0,
      annualPence: 0,
      propertyLimit: 20,
      unitLimit: 50,
      staffLimit: 5,
      storageBytes: BigInt(10000000),
      features: [
        "core",
        "repairs",
        "rent",
        "documents",
        "messages",
        "compliance",
        "finance",
        "operations",
      ],
      developmentOnly: true,
      active: true,
    },
  });
  const users = await Promise.all(
    ["owner", "tenant", "tenantB", "other", "staff"].map(async (n) => {
      const result = await auth.api.signUpEmail({
        body: {
          name: n,
          email: `${n}-${suffix}@example.test`,
          password: `Test-only-${randomUUID()}`,
        },
      });
      await db.user.update({
        where: { id: result.user.id },
        data: { emailVerified: true },
      });
      return result.user;
    }),
  );
  const org = await db.organisation.create({
    data: {
      name: `Test ${suffix}`,
      subscription: {
        create: { planId: plan.id, provider: "development", status: "active" },
      },
      memberships: {
        create: [
          { userId: users[0].id, role: "OWNER" },
          { userId: users[1].id, role: "TENANT" },
          { userId: users[2].id, role: "TENANT" },
          { userId: users[4].id, role: "STAFF", permissions: ["repairs:read"] },
        ],
      },
    },
  });
  const org2 = await db.organisation.create({
    data: {
      name: `Other ${suffix}`,
      subscription: {
        create: { planId: plan.id, provider: "development", status: "active" },
      },
      memberships: { create: { userId: users[3].id, role: "OWNER" } },
    },
  });
  function ctx(
    i: number,
    organisationId: string,
    role: Context["role"],
  ): Context {
    return {
      userId: users[i].id,
      name: users[i].name,
      email: users[i].email,
      organisationId,
      role,
      permissions: [],
      propertyIds: [],
      tenantIds: [],
      tenancyIds: [],
      activePropertyIds: [],
    };
  }
  owner = ctx(0, org.id, "OWNER");
  otherOwner = ctx(3, org2.id, "OWNER");
  staff = { ...ctx(4, org.id, "STAFF"), permissions: ["repairs:read"] };
  propertyId = (
    await createResource(owner, "properties", {
      name: "Test HMO",
      address: "1 Test Road, Bristol",
      postcode: "BS1 1AA",
      type: "HMO",
    })
  ).id;
  otherProperty = (
    await createResource(otherOwner, "properties", {
      name: "Other property",
      address: "2 Test Road, Bristol",
      postcode: "BS1 1AB",
      type: "house",
    })
  ).id;
  const unit = await createResource(owner, "units", {
    propertyId,
    name: "Room 1",
  });
  const unitB = await createResource(owner, "units", {
    propertyId,
    name: "Room 2",
  });
  tenantId = (
    await createResource(owner, "tenants", {
      name: "Jamie Test",
      email: users[1].email,
    })
  ).id;
  tenantB = (
    await createResource(owner, "tenants", {
      name: "Sam Test",
      email: users[2].email,
    })
  ).id;
  await db.tenant.update({
    where: { id: tenantId },
    data: { userId: users[1].id },
  });
  await db.tenant.update({
    where: { id: tenantB },
    data: { userId: users[2].id },
  });
  tenancyId = (
    await createResource(owner, "tenancies", {
      propertyId,
      unitId: unit.id,
      tenantIds: [tenantId],
      reference: `T-${suffix}`,
      startDate: past,
      rentPence: 100000,
      frequency: "monthly",
      dueDay: 1,
      depositPence: 100000,
    })
  ).id;
  const tB = (
    await createResource(owner, "tenancies", {
      propertyId,
      unitId: unitB.id,
      tenantIds: [tenantB],
      reference: `TB-${suffix}`,
      startDate: past,
      rentPence: 90000,
      frequency: "monthly",
      dueDay: 1,
    })
  ).id;
  tenant = {
    ...ctx(1, org.id, "TENANT"),
    tenantIds: [tenantId],
    tenancyIds: [tenancyId],
    activePropertyIds: [propertyId],
  };
  otherTenant = {
    ...ctx(2, org.id, "TENANT"),
    tenantIds: [tenantB],
    tenancyIds: [tB],
    activePropertyIds: [propertyId],
  };
});
afterAll(async () => {
  await db.$disconnect();
});
describe("Organisation and role boundaries", () => {
  it("requires the exact requested property for scoped staff", async () => {
    const scoped = {
      ...staff,
      permissions: ["properties:write"],
      propertyIds: [propertyId],
    };
    expect((await checkProperty(scoped, propertyId)).id).toBe(propertyId);
    await expect(checkProperty(scoped, otherProperty)).rejects.toMatchObject({
      status: 404,
    });
    await expect(checkProperty(scoped, "missing")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      updateResource(scoped, "properties", otherProperty, {
        name: "Unauthorised edit",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await db.property.findUniqueOrThrow({ where: { id: otherProperty } }))
        .name,
    ).toBe("Other property");
  });
  it("filters nested tenancy history for property-restricted staff", async () => {
    const hidden = await createResource(owner, "properties", {
      name: "Restricted tenancy history",
      address: "9 Private Road, Bristol",
      postcode: "BS1 1AZ",
      type: "house",
    });
    const hiddenTenancy = await createResource(owner, "tenancies", {
      propertyId: hidden.id,
      tenantIds: [tenantId],
      reference: `PRIVATE-${suffix}`,
      startDate: past,
      rentPence: 90000,
      frequency: "monthly",
      dueDay: 1,
      depositPence: 90000,
    });
    const scoped = {
      ...staff,
      permissions: ["tenants:read"],
      propertyIds: [propertyId],
    };
    const result = await listResource(scoped, "tenants", new URLSearchParams());
    const entry = (
      result.rows as {
        id: string;
        participants: { tenancy: { reference: string } }[];
      }[]
    ).find((t) => t.id === tenantId)!;
    expect(entry).toBeTruthy();
    expect(entry.participants).toEqual([
      expect.objectContaining({
        tenancy: expect.objectContaining({ reference: `T-${suffix}` }),
      }),
    ]);
    const ownerRows = await listResource(
      owner,
      "tenants",
      new URLSearchParams(),
    );
    expect(JSON.stringify(ownerRows.rows)).toContain(`PRIVATE-${suffix}`);
    const choices = await options(scoped);
    expect(
      choices.tenants.find((t) => t.id === tenantId)?.participants,
    ).toEqual([{ tenancyId }]);
    expect(
      choices.tenants.flatMap((t) => t.participants.map((p) => p.tenancyId)),
    ).not.toContain(hiddenTenancy.id);
    // Leave the tenant's original active-tenancy test fixtures unchanged.
    await db.task.deleteMany({ where: { tenancyId: hiddenTenancy.id } });
    await db.rentObligation.deleteMany({
      where: { tenancyId: hiddenTenancy.id },
    });
    await db.deposit.deleteMany({ where: { tenancyId: hiddenTenancy.id } });
    await db.tenancy.delete({ where: { id: hiddenTenancy.id } });
    await db.property.delete({ where: { id: hidden.id } });
  });
  it.each(["STAFF", "STAKEHOLDER"] as const)(
    "uses new invitation grants when reactivating %s and protects active access",
    async (role) => {
      const membership = await db.membership.findUniqueOrThrow({
        where: {
          organisationId_userId: {
            organisationId: owner.organisationId,
            userId: staff.userId,
          },
        },
      });
      await db.membership.update({
        where: { id: membership.id },
        data: {
          role,
          active: false,
          permissions: ["finance:write"],
          propertyIds: [],
        },
      });
      const token = randomBytes(32).toString("hex");
      const invitation = await db.invitation.create({
        data: {
          organisationId: owner.organisationId,
          email: staff.email,
          role,
          permissions: ["repairs:read"],
          propertyIds: [propertyId],
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const user = await db.user.findUniqueOrThrow({
        where: { id: staff.userId },
      });
      const session = vi
        .spyOn(contextMethods, "sessionUser")
        .mockResolvedValue(user);
      try {
        await acceptInvitation({ token });
        const updated = await db.membership.findUniqueOrThrow({
          where: { id: membership.id },
        });
        expect(updated).toMatchObject({
          active: true,
          permissions: ["repairs:read"],
          propertyIds: [propertyId],
        });
        await expect(acceptInvitation({ token })).rejects.toMatchObject({
          status: 404,
        });
        const activeToken = randomBytes(32).toString("hex");
        const pending = await db.invitation.create({
          data: {
            organisationId: owner.organisationId,
            email: staff.email,
            role,
            permissions: ["finance:write"],
            propertyIds: [],
            tokenHash: createHash("sha256").update(activeToken).digest("hex"),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        try {
          await expect(
            acceptInvitation({ token: activeToken }),
          ).rejects.toMatchObject({ status: 409 });
          expect(
            await db.membership.findUniqueOrThrow({
              where: { id: membership.id },
            }),
          ).toMatchObject({
            permissions: ["repairs:read"],
            propertyIds: [propertyId],
          });
          expect(
            (
              await db.invitation.findUniqueOrThrow({
                where: { id: pending.id },
              })
            ).acceptedAt,
          ).toBeNull();
        } finally {
          await db.invitation.delete({ where: { id: pending.id } });
        }
      } finally {
        session.mockRestore();
        await db.membership.update({
          where: { id: membership.id },
          data: {
            role: membership.role,
            active: membership.active,
            permissions: membership.permissions,
            propertyIds: membership.propertyIds,
          },
        });
        await db.invitation.delete({ where: { id: invitation.id } });
      }
    },
  );
  it("requires the exact requested tenancy for tenants", async () => {
    expect((await checkTenancy(tenant, tenancyId, "documents")).id).toBe(
      tenancyId,
    );
    await expect(
      checkTenancy(tenant, otherTenant.tenancyIds[0], "documents"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      checkTenancy(tenant, "missing", "documents"),
    ).rejects.toMatchObject({ status: 404 });
    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }),
    );
    form.set("tenancyId", otherTenant.tenancyIds[0]);
    await expect(uploadDocument(tenant, form)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("creates persistent property and tenancy records", async () => {
    expect(
      await db.property.findUnique({ where: { id: propertyId } }),
    ).toMatchObject({ organisationId: owner.organisationId });
    expect(await db.tenancyParticipant.count({ where: { tenancyId } })).toBe(1);
  });
  it("isolates properties across organisations", async () => {
    const data = await listResource(owner, "properties", new URLSearchParams());
    expect(data.rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherProperty })]),
    );
    await expect(
      createResource(owner, "repairs", {
        propertyId: otherProperty,
        title: "Hidden property",
        description: "Attempt access to a different organisation.",
        category: "Other",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("denies staff writes without granular permission", async () => {
    await expect(
      createResource(staff, "properties", {
        name: "Denied",
        address: "1 Test Road",
        postcode: "BS1",
        type: "house",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("denies tenant payment and tenancy status writes", async () => {
    await expect(
      recordPayment(tenant, {
        tenancyId,
        amountPence: 50000,
        paidAt: past,
        reference: "forged",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateResource(tenant, "tenancies", tenancyId, { status: "ended" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects cross-organisation tenancy foreign keys", async () => {
    await expect(
      createResource(owner, "tenancies", {
        propertyId: otherProperty,
        tenantIds: [tenantId],
        reference: "Bad",
        startDate: past,
        rentPence: 1000,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("enforces subscription feature entitlements", async () => {
    const s = await db.subscription.findUniqueOrThrow({
      where: { organisationId: otherOwner.organisationId },
    });
    await db.subscription.update({
      where: { id: s.id },
      data: { status: "canceled" },
    });
    await expect(entitlement(otherOwner, "repairs")).rejects.toMatchObject({
      status: 402,
    });
  });
});
describe("Repair privacy and workflow", () => {
  it("creates landlord repairs private by default", async () => {
    const r = await createRepair(owner, {
      propertyId,
      title: "Private inspection",
      description: "Internal landlord inspection and cost review.",
      category: "General maintenance",
      internalNotes: "Sensitive internal note",
    });
    privateRepair = r.id;
    expect(await getRepair(owner, r.id)).toMatchObject({
      visibility: "private",
      internalNotes: "Sensitive internal note",
    });
  });
  it("excludes private repairs from tenant lists and direct queries", async () => {
    await expect(getRepair(tenant, privateRepair)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await listResource(tenant, "repairs", new URLSearchParams())).rows,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: privateRepair })]),
    );
  });
  it("shares only with the selected affected tenant", async () => {
    await setRepairVisibility(owner, privateRepair, {
      visibility: "selected",
      tenantIds: [tenantId],
    });
    const r = await getRepair(tenant, privateRepair);
    expect(r).not.toHaveProperty("internalNotes");
    expect(r).not.toHaveProperty("expenses");
    await expect(getRepair(otherTenant, privateRepair)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("filters private comments and exposes permitted messages", async () => {
    await commentRepair(owner, privateRepair, {
      body: "Private comment",
      public: false,
    });
    await commentRepair(owner, privateRepair, {
      body: "Public progress",
      public: true,
    });
    const r = await getRepair(tenant, privateRepair);
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0].body).toBe("Public progress");
  });
  it("records status changes with permitted tenant updates", async () => {
    await updateRepair(owner, privateRepair, { status: "acknowledged" });
    expect(await getRepair(tenant, privateRepair)).toMatchObject({
      status: "acknowledged",
    });
  });
  it("creates authorised sharing notifications", async () => {
    expect(
      await db.notification.count({
        where: { userId: tenant.userId, resourceId: privateRepair },
      }),
    ).toBeGreaterThan(0);
    expect(
      await db.notification.count({
        where: { userId: otherTenant.userId, resourceId: privateRepair },
      }),
    ).toBe(0);
  });
  it("revokes access server-side, including direct attachment downloads", async () => {
    const f = new FormData();
    f.set(
      "file",
      new File([Buffer.from("%PDF-1.4\nTest")], "evidence.pdf", {
        type: "application/pdf",
      }),
    );
    f.set("repairId", privateRepair);
    f.set("category", "Repair evidence");
    f.set("tenantIds", JSON.stringify([tenantId]));
    const d = await uploadDocument(owner, f);
    expect((await downloadDocument(tenant, d.id)).status).toBe(200);
    await setRepairVisibility(owner, privateRepair, { visibility: "private" });
    await expect(getRepair(tenant, privateRepair)).rejects.toMatchObject({
      status: 404,
    });
    await expect(downloadDocument(tenant, d.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("automatically permits reporters and excludes unrelated occupants", async () => {
    tenantRepair = (
      await createRepair(tenant, {
        propertyId,
        title: "My boiler has stopped",
        description: "The boiler is not heating water since this morning.",
        category: "Heating",
        priority: "high",
      })
    ).id;
    expect(await getRepair(tenant, tenantRepair)).toHaveProperty(
      "id",
      tenantRepair,
    );
    await expect(getRepair(otherTenant, tenantRepair)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("allows public tenant comments and denies tenant status changes", async () => {
    await commentRepair(tenant, tenantRepair, {
      body: "Please review this issue",
      public: false,
    });
    const r = await getRepair(owner, tenantRepair);
    expect(r.comments.at(-1)).toMatchObject({ public: true });
    await expect(
      updateRepair(tenant, tenantRepair, { status: "closed" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects arbitrary recipients and tenants outside the affected property", async () => {
    await expect(
      setRepairVisibility(owner, tenantRepair, {
        visibility: "selected",
        tenantIds: ["unknown"],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("prevents read-only staff from changing visibility", async () => {
    await expect(
      setRepairVisibility(staff, tenantRepair, { visibility: "occupants" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
describe("Ledger, reminders and operations", () => {
  it("records partial payments and idempotently allocates them", async () => {
    const key = randomUUID();
    await recordPayment(owner, {
      tenancyId,
      amountPence: 35000,
      paidAt: past,
      reference: "partial",
      idempotencyKey: key,
    });
    await recordPayment(owner, {
      tenancyId,
      amountPence: 35000,
      paidAt: past,
      reference: "partial",
      idempotencyKey: key,
    });
    expect(await db.payment.count({ where: { idempotencyKey: key } })).toBe(1);
    const row = (await listResource(tenant, "rent", new URLSearchParams()))
      .rows as { balancePence: number }[];
    expect(row.some((r) => r.balancePence === 65000)).toBe(true);
  });
  it("generates recurring obligations without duplication", async () => {
    const before = await db.rentObligation.count({ where: { tenancyId } });
    await generateRent(owner.organisationId, tenancyId);
    await generateRent(owner.organisationId, tenancyId);
    expect(await db.rentObligation.count({ where: { tenancyId } })).toBe(
      before,
    );
  });
  it("prevents cross-property filtering from widening staff access", async () => {
    const scoped = {
      ...owner,
      role: "STAFF" as const,
      permissions: ["rent:read"],
      propertyIds: [propertyId],
    };
    const list = await listResource(
      scoped,
      "rent",
      new URLSearchParams({ propertyId: otherProperty }),
    );
    expect(list.total).toBe(0);
  });
  it("calculates reports from persisted payments and expenses", async () => {
    await createResource(owner, "expenses", {
      propertyId,
      category: "Repairs",
      description: "Test repair",
      amountPence: 5000,
      incurredAt: past,
    });
    const report = await financialReport(owner, new URLSearchParams());
    expect(report.totals.incomePence).toBe(35000);
    expect(report.totals.expensePence).toBe(5000);
    expect(report.totals.profitPence).toBe(30000);
  });
  it("queues idempotent compliance reminders", async () => {
    await createResource(owner, "compliance", {
      propertyId,
      title: "Gas safety record",
      category: "Gas safety",
      issuedAt: past,
      expiresAt: new Date(Date.now() + 10 * 86400000)
        .toISOString()
        .slice(0, 10),
    });
    await schedule();
    const before = await db.notification.count({
      where: { organisationId: owner.organisationId },
    });
    await schedule();
    expect(
      await db.notification.count({
        where: { organisationId: owner.organisationId },
      }),
    ).toBe(before);
  });
  it("rejects deposit returns beyond the held amount", async () => {
    const deposit = await db.deposit.findUniqueOrThrow({
      where: { tenancyId },
    });
    await expect(
      updateResource(owner, "deposits", deposit.id, {
        scheme: "Example",
        reference: "ABC",
        status: "returned",
        returnedPence: 200000,
        notes: "",
        deductions: [],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("validates and atomically imports tenant records", async () => {
    const preview = await previewImport(owner, {
      type: "tenants",
      csv: `Name,Email\nImported Tenant,import-${suffix}@example.test`,
      mapping: { name: "Name", email: "Email" },
    });
    expect(preview.valid).toBe(true);
    const result = await commitImport(owner, preview.id);
    expect(result.count).toBe(1);
    expect(
      await db.tenant.findUnique({
        where: {
          organisationId_email: {
            organisationId: owner.organisationId,
            email: `import-${suffix}@example.test`,
          },
        },
      }),
    ).toBeTruthy();
    await expect(commitImport(owner, preview.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("blocks malformed import previews and duplicate tenant rows", async () => {
    const p = await previewImport(owner, {
      type: "tenants",
      csv: `Name,Email\nAlready Here,${tenant.email}`,
      mapping: { name: "Name", email: "Email" },
    });
    expect(p.valid).toBe(false);
    await expect(commitImport(owner, p.id)).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("Additional integrity and lifecycle checks", () => {
  it("preserves prior obligations when recording a future rent change", async () => {
    const effective = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    )
      .toISOString()
      .slice(0, 10);
    await updateResource(owner, "tenancies", tenancyId, {
      rentPence: 110000,
      effectiveFrom: effective,
      reason: "Documented future rent change for test",
      requirementsReviewed: true,
    });
    const obligations = await db.rentObligation.findMany({
      where: { tenancyId },
      orderBy: { dueDate: "asc" },
    });
    expect(obligations[0].amountPence).toBe(100000);
    expect(
      obligations.find(
        (o) => o.dueDate.toISOString().slice(0, 10) === effective,
      )?.amountPence,
    ).toBe(110000);
    expect(await db.rentChange.count({ where: { tenancyId } })).toBe(1);
  });
  it("supersedes a replaced compliance record while retaining history", async () => {
    const prior = await db.complianceRecord.findFirstOrThrow({
      where: {
        organisationId: owner.organisationId,
        propertyId,
        category: "Gas safety",
      },
    });
    const current = await createResource(owner, "compliance", {
      propertyId,
      title: "Replacement gas safety record",
      category: "Gas safety",
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt: new Date(Date.now() + 365 * 86400000)
        .toISOString()
        .slice(0, 10),
      replacesId: prior.id,
    });
    expect(
      await db.complianceRecord.findUnique({ where: { id: prior.id } }),
    ).toMatchObject({ status: "superseded" });
    expect(
      await db.complianceRecord.findUnique({ where: { id: current.id } }),
    ).toMatchObject({ replacesId: prior.id });
  });
  it("rejects allocations across tenancies at the database boundary", async () => {
    const payment = await db.payment.findFirstOrThrow({ where: { tenancyId } });
    const obligation = await db.rentObligation.findFirstOrThrow({
      where: {
        organisationId: owner.organisationId,
        tenancyId: { not: tenancyId },
      },
    });
    await expect(
      db.paymentAllocation.create({
        data: {
          organisationId: owner.organisationId,
          paymentId: payment.id,
          obligationId: obligation.id,
          amountPence: 1,
        },
      }),
    ).rejects.toThrow();
  });
  it("cannot create verified rental passport claims from a tenant account", async () => {
    await expect(
      createResource(tenant, "passport", {
        title: "My history",
        data: {
          source: "platform-record",
          description: "Claiming a verified record without a platform source",
          shared: true,
          consent: true,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("prevents development subscription use in production", async () => {
    try {
      vi.stubEnv("NODE_ENV", "production");
      await expect(entitlement(owner, "core")).rejects.toMatchObject({
        status: 402,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("serialises concurrent property creation at a subscription limit", async () => {
    const plan = await db.subscriptionPlan.create({
      data: {
        name: "Limited test " + suffix,
        monthlyPence: 0,
        annualPence: 0,
        propertyLimit: 1,
        unitLimit: 1,
        staffLimit: 0,
        storageBytes: BigInt(1000),
        features: ["core"],
        developmentOnly: true,
        active: true,
      },
    });
    const org = await db.organisation.create({
      data: {
        name: "Limited org " + suffix,
        subscription: {
          create: {
            planId: plan.id,
            provider: "development",
            status: "active",
          },
        },
      },
    });
    const ctx = { ...owner, organisationId: org.id };
    const results = await Promise.allSettled([
      createResource(ctx, "properties", {
        name: "First",
        address: "1 Test Road",
        postcode: "BS1 1AA",
        type: "house",
      }),
      createResource(ctx, "properties", {
        name: "Second",
        address: "2 Test Road",
        postcode: "BS1 1AB",
        type: "house",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.property.count({ where: { organisationId: org.id } })).toBe(
      1,
    );
  });
});

describe("Review regressions", () => {
  async function freshTenancy() {
    const p = await createResource(owner, "properties", {
      name: `Lifecycle ${randomUUID()}`,
      address: "10 Review Road",
      postcode: "BS1 1AA",
      type: "house",
    });
    const t = await createResource(owner, "tenancies", {
      propertyId: p.id,
      tenantIds: [tenantId],
      reference: randomUUID(),
      startDate: past,
      rentPence: 100000,
      dueDay: 1,
      frequency: "monthly",
    });
    return { propertyId: p.id, tenancyId: t.id };
  }
  it("redacts private compliance titles from stakeholder dashboard summaries", async () => {
    const record = await createResource(owner, "compliance", {
      propertyId,
      title: "Private tenant insurance investigation",
      category: "Insurance",
      issuedAt: past,
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      notes: "Internal tenant details",
    });
    const stakeholder = {
      ...owner,
      role: "STAKEHOLDER" as const,
      propertyIds: [propertyId],
      permissions: [],
    };
    try {
      const summary = await dashboard(stakeholder);
      expect(summary.compliance.find((c) => c.id === record.id)?.title).toBe(
        "Insurance",
      );
      expect(JSON.stringify(summary)).not.toContain(
        "Private tenant insurance investigation",
      );
      expect(
        (await dashboard(owner)).compliance.find((c) => c.id === record.id)
          ?.title,
      ).toBe("Private tenant insurance investigation");
    } finally {
      await db.complianceRecord.delete({ where: { id: record.id } });
    }
  });
  it("intersects requested property filters with read-only owner access and returns compliance summaries", async () => {
    const t = await freshTenancy();
    await createResource(owner, "compliance", {
      propertyId: t.propertyId,
      title: "Restricted review record",
      category: "Insurance",
      issuedAt: past,
      notes: "Private information must not be shared",
    });
    const stakeholder = {
      ...owner,
      role: "STAKEHOLDER" as const,
      propertyIds: [propertyId],
      permissions: [],
    };
    expect(
      (
        await listResource(
          stakeholder,
          "compliance",
          new URLSearchParams({ propertyId: t.propertyId }),
        )
      ).total,
    ).toBe(0);
    const allowed = (
      await listResource(
        stakeholder,
        "compliance",
        new URLSearchParams({ propertyId }),
      )
    ).rows as Record<string, unknown>[];
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed[0]).not.toHaveProperty("notes");
    expect(allowed[0]).not.toHaveProperty("reference");
    expect(allowed[0]).not.toHaveProperty("documentId");
  });
  it("does not mark a charge due today as overdue", async () => {
    const charge = await addCharge(owner, {
      tenancyId,
      amountPence: 1200,
      dueDate: utcDay().toISOString().slice(0, 10),
      description: "Due today",
      idempotencyKey: randomUUID(),
    });
    const rows = (await listResource(owner, "rent", new URLSearchParams()))
      .rows as { id: string; status: string }[];
    expect(rows.find((r) => r.id === charge.id)?.status).toBe("due");
  });
  it("retries a charge without duplication and rejects changed idempotent submissions", async () => {
    const input = {
      tenancyId,
      amountPence: 2000,
      dueDate: past,
      description: "Manual agreed charge",
      idempotencyKey: randomUUID(),
    };
    expect(await addCharge(owner, input)).toEqual(
      await addCharge(owner, input),
    );
    await expect(
      addCharge(owner, { ...input, amountPence: 2100 }),
    ).rejects.toMatchObject({ status: 409 });
    const payment = {
      tenancyId,
      amountPence: 1000,
      paidAt: past,
      reference: "Recorded transfer",
      idempotencyKey: randomUUID(),
    };
    await recordPayment(owner, payment);
    await expect(
      recordPayment(owner, { ...payment, reference: "Different transfer" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("retains the original rent when historical schedules are regenerated after a rate change", async () => {
    const t = await freshTenancy();
    const effective = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    await updateResource(owner, "tenancies", t.tenancyId, {
      rentPence: 125000,
      effectiveFrom: effective.toISOString().slice(0, 10),
      reason: "Reviewed rent change",
      requirementsReviewed: true,
    });
    await generateRent(owner.organisationId, t.tenancyId, effective);
    await db.rentObligation.deleteMany({
      where: { tenancyId: t.tenancyId, dueDate: new Date(past) },
    });
    await generateRent(owner.organisationId, t.tenancyId, effective);
    expect(
      await db.rentObligation.findFirst({
        where: { tenancyId: t.tenancyId, dueDate: new Date(past) },
      }),
    ).toMatchObject({ amountPence: 100000 });
    expect(
      await db.tenancy.findUnique({ where: { id: t.tenancyId } }),
    ).toMatchObject({ rentPence: 125000, initialRentPence: 100000 });
  });
  it("rejects a rate change that would silently leave paid future rent at the old amount", async () => {
    const t = await freshTenancy();
    await recordPayment(owner, {
      tenancyId: t.tenancyId,
      amountPence: 200000,
      paidAt: past,
      reference: "Prepaid rent",
      idempotencyKey: randomUUID(),
    });
    const effective = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    )
      .toISOString()
      .slice(0, 10);
    await expect(
      updateResource(owner, "tenancies", t.tenancyId, {
        rentPence: 130000,
        effectiveFrom: effective,
        reason: "Reviewed rent change",
        requirementsReviewed: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await db.rentChange.count({ where: { tenancyId: t.tenancyId } }),
    ).toBe(0);
  });
  it("continues periodic rent, protects occupied properties and stops future rent at move-out", async () => {
    const t = await freshTenancy();
    await db.tenancy.update({
      where: { id: t.tenancyId },
      data: { endDate: new Date(past) },
    });
    await updateResource(owner, "tenancies", t.tenancyId, {
      status: "periodic",
    });
    expect(
      await db.tenancy.findUnique({ where: { id: t.tenancyId } }),
    ).toMatchObject({ status: "periodic", endDate: null });
    expect(
      await db.rentObligation.count({
        where: { tenancyId: t.tenancyId, dueDate: { gt: utcDay() } },
      }),
    ).toBeGreaterThan(0);
    await expect(
      updateResource(owner, "properties", t.propertyId, { archive: true }),
    ).rejects.toMatchObject({ status: 409 });
    await updateResource(owner, "tenancies", t.tenancyId, { status: "ended" });
    expect(
      await db.rentObligation.count({
        where: { tenancyId: t.tenancyId, dueDate: { gt: utcDay() } },
      }),
    ).toBe(0);
    const replacement = await createResource(owner, "tenancies", {
      propertyId: t.propertyId,
      tenantIds: [tenantB],
      reference: randomUUID(),
      startDate: past,
      rentPence: 90000,
    });
    await expect(
      updateResource(owner, "tenancies", t.tenancyId, { status: "active" }),
    ).rejects.toMatchObject({ status: 409 });
    await updateResource(owner, "tenancies", replacement.id, {
      status: "ended",
    });
    await updateResource(owner, "properties", t.propertyId, { archive: true });
    await expect(
      createResource(owner, "tenancies", {
        propertyId: t.propertyId,
        tenantIds: [tenantId],
        reference: randomUUID(),
        startDate: past,
        rentPence: 90000,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("keeps completed onboarding from regressing when more records are created", async () => {
    await db.organisation.update({
      where: { id: owner.organisationId },
      data: { onboardingStep: 4 },
    });
    await freshTenancy();
    expect(
      await db.organisation.findUnique({ where: { id: owner.organisationId } }),
    ).toMatchObject({ onboardingStep: 4 });
  });
  it("preserves applicant details when scheduling a viewing", async () => {
    const listing = await createResource(owner, "listings", {
      propertyId,
      title: "Review listing",
      description: "A review listing with a manual application workflow",
      rentPence: 100000,
      depositPence: 100000,
      availableAt: past,
    });
    const a = await db.application.create({
      data: {
        organisationId: owner.organisationId,
        listingId: listing.id,
        name: "Applicant",
        phone: "",
        consentAt: new Date(),
        retentionUntil: new Date(Date.now() + 90 * 86400000),
        email: `app-${suffix}@example.test`,
        details: {
          enquiry: "I would like a viewing",
          employment: "Self-reported",
        },
      },
    });
    await updateResource(owner, "applications", a.id, {
      status: "viewing scheduled",
      viewingDate: new Date().toISOString(),
    });
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: a.id } })).details,
    ).toMatchObject({
      enquiry: "I would like a viewing",
      employment: "Self-reported",
    });
  });
  it("shows recent replies once a conversation exceeds fifty messages", async () => {
    const c = await createResource(tenant, "messages", {
      tenancyId,
      subject: "Review thread",
      body: "Initial message",
      tenantIds: [],
    });
    const initialMessage = await db.message.findFirstOrThrow({
      where: { conversationId: c.id },
    });
    await db.message.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        organisationId: owner.organisationId,
        conversationId: c.id,
        senderUserId: owner.userId,
        senderName: "Landlord",
        body: `Reply ${i}`,
        createdAt: new Date(
          initialMessage.createdAt.getTime() + (i + 1) * 1000,
        ),
      })),
    });
    const row = (await listResource(tenant, "messages", new URLSearchParams()))
      .rows as { id: string; messages: { body: string }[] }[];
    const messages = row.find((r) => r.id === c.id)!.messages;
    expect(messages).toHaveLength(50);
    expect(messages.at(-1)?.body).toBe("Reply 54");
    const recent = await earlierMessages(tenant, c.id);
    const earlier = await earlierMessages(tenant, c.id, recent.messages[0].id);
    expect(earlier.messages[0].body).toBe("Initial message");
    expect(earlier.hasMore).toBe(false);
    await expect(earlierMessages(otherTenant, c.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(earlierMessages(otherOwner, c.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("protects portable profiles and retains landlord responses when tenants edit feedback", async () => {
    const profile = await createResource(tenant, "passport", {
      title: "Private history",
      data: {
        source: "self-reported",
        description: "Private self-reported rental history",
        shared: false,
        consent: false,
      },
    });
    expect(
      (await listResource(owner, "passport", new URLSearchParams())).rows,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: profile.id })]),
    );
    await expect(
      updateResource(owner, "passport", profile.id, { status: "closed" }),
    ).rejects.toMatchObject({ status: 404 });
    const feedback = await createResource(tenant, "feedback", {
      title: "Feedback",
      propertyId,
      tenancyId,
      data: { type: "general", body: "Please review this message" },
    });
    await updateResource(owner, "feedback", feedback.id, {
      data: {
        type: "general",
        body: "Please review this message",
        response: "We have responded",
      },
    });
    await updateResource(tenant, "feedback", feedback.id, {
      data: {
        type: "general",
        body: "Updated tenant message",
        response: "Attempt to overwrite",
      },
    });
    expect(
      (
        await db.operationRecord.findUniqueOrThrow({
          where: { id: feedback.id },
        })
      ).data,
    ).toMatchObject({ response: "We have responded" });
  });
  it("rejects mismatched document links and respects private repair attachment recipients", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-test"], "review.pdf", { type: "application/pdf" }),
    );
    form.set("propertyId", propertyId);
    form.set("tenancyId", otherTenant.tenancyIds[0]);
    form.set("repairId", tenantRepair);
    await expect(uploadDocument(owner, form)).rejects.toMatchObject({
      status: 422,
    });
    form.delete("repairId");
    form.set("tenancyId", tenancyId);
    const file = await uploadDocument(owner, form);
    await shareDocument(owner, file.id, { tenantIds: [tenantId] });
    expect(
      (await listResource(owner, "documents", new URLSearchParams())).rows,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: file.id, grants: [{ tenantId }] }),
      ]),
    );
    expect(
      await db.notification.count({
        where: {
          resourceType: "document",
          resourceId: file.id,
          userId: tenant.userId,
        },
      }),
    ).toBe(1);
    await shareDocument(owner, file.id, { tenantIds: [] });
    await expect(downloadDocument(tenant, file.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await db.notification.count({
        where: {
          resourceType: "document",
          resourceId: file.id,
          userId: tenant.userId,
        },
      }),
    ).toBe(0);
    form.delete("tenancyId");
    form.set("repairId", privateRepair);
    const privateFile = await uploadDocument(owner, form);
    await expect(
      shareDocument(owner, privateFile.id, { tenantIds: [tenantId] }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
