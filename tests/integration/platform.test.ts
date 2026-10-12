import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
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
import { recordPayment, generateRent } from "@/server/ledger";
import { uploadDocument, downloadDocument } from "@/server/documents";
import { entitlement } from "@/server/entitlements";
import { previewImport, commitImport } from "@/server/imports";
import { schedule } from "@/server/jobs";
import { financialReport } from "@/server/reports";
import type { Context } from "@/server/context";
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
