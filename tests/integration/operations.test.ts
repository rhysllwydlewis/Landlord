import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { operationsFixture } from "../helpers/operations-fixture";
import { updatePropertyDetails, updateUnit } from "@/server/properties";
import {
  createResource,
  updateResource,
  listResource,
} from "@/server/resources";
import {
  createRepair,
  updateRepair,
  getRepair,
  setRepairVisibility,
} from "@/server/repairs";
import { updateSettings } from "@/server/settings";
import {
  uploadDocument,
  downloadDocument,
  updateDocumentMetadata,
  shareDocument,
} from "@/server/documents";
import { respondToFeedback } from "@/server/feedback";
import { operationSchemas } from "@/server/schemas";
import { options } from "@/server/dashboard";
import { schedule } from "@/server/jobs";
import { recordPayment } from "@/server/ledger";
import { paymentReceipt } from "@/server/receipts";
let f: Awaited<ReturnType<typeof operationsFixture>>;
beforeAll(async () => {
  f = await operationsFixture();
});
afterAll(async () => {
  await db.$disconnect();
});
const repairInput = () => ({
  propertyId: f.propertyId,
  title: "Operations repair",
  description: "A real recorded test issue requiring repair.",
  category: "Plumbing",
});
const docInput = () => {
  const form = new FormData();
  form.set(
    "file",
    new File(["%PDF-1.4\n test"], `evidence-${randomUUID()}.pdf`, {
      type: "application/pdf",
    }),
  );
  form.set("propertyId", f.propertyId);
  return form;
};
describe("Room tenancy and completion-date regressions", () => {
  it("enforces room limits atomically when archived rooms are restored", async () => {
    const rooms = await Promise.all(
      ["A", "B"].map((name) =>
        createResource(f.owner, "units", {
          propertyId: f.propertyId,
          name: `Restore ${name}`,
        }),
      ),
    );
    for (const room of rooms)
      await updateUnit(f.owner, room.id, { archive: true });
    const subscription = await db.subscription.findUniqueOrThrow({
      where: { organisationId: f.owner.organisationId },
    });
    const active = await db.unit.count({
      where: { organisationId: f.owner.organisationId, archivedAt: null },
    });
    const original = await db.subscriptionPlan.findUniqueOrThrow({
      where: { id: subscription.planId },
    });
    await db.subscriptionPlan.update({
      where: { id: original.id },
      data: { unitLimit: active + 1 },
    });
    try {
      const results = await Promise.allSettled(
        rooms.map((room) => updateUnit(f.owner, room.id, { archive: false })),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ status: 402 });
      expect(
        await db.unit.count({
          where: { organisationId: f.owner.organisationId, archivedAt: null },
        }),
      ).toBe(active + 1);
    } finally {
      await db.subscriptionPlan.update({
        where: { id: original.id },
        data: { unitLimit: original.unitLimit },
      });
    }
  });
  it("matches a tenant's selected room and excludes unrelated rooms from choices and lists", async () => {
    const ownRoom = await createResource(f.owner, "units", {
      propertyId: f.propertyId,
      name: `Second own room ${randomUUID()}`,
    });
    const ownTenancy = await createResource(f.owner, "tenancies", {
      propertyId: f.propertyId,
      unitId: ownRoom.id,
      tenantIds: f.tenant.tenantIds,
      reference: randomUUID(),
      startDate: new Date().toISOString().slice(0, 10),
      rentPence: 50000,
    });
    const anotherTenant = await createResource(f.owner, "tenants", {
      name: "Unrelated room tenant",
      email: `unrelated-${randomUUID()}@example.test`,
    });
    const otherRoom = await createResource(f.owner, "units", {
      propertyId: f.propertyId,
      name: `Unrelated room ${randomUUID()}`,
    });
    await createResource(f.owner, "tenancies", {
      propertyId: f.propertyId,
      unitId: otherRoom.id,
      tenantIds: [anotherTenant.id],
      reference: randomUUID(),
      startDate: new Date().toISOString().slice(0, 10),
      rentPence: 50000,
    });
    const repair = await createRepair(f.tenant, {
      ...repairInput(),
      unitId: ownRoom.id,
    });
    expect(
      (await db.repair.findUniqueOrThrow({ where: { id: repair.id } }))
        .tenancyId,
    ).toBe(ownTenancy.id);
    await expect(
      createRepair(f.tenant, { ...repairInput(), unitId: otherRoom.id }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await options(f.tenant)).properties
        .find((p) => p.id === f.propertyId)
        ?.units.some((u) => u.id === otherRoom.id),
    ).toBe(false);
    const listed = (
      await listResource(f.tenant, "properties", new URLSearchParams())
    ).rows as { id: string; units: { id: string }[] }[];
    expect(
      listed
        .find((p) => p.id === f.propertyId)
        ?.units.some((u) => u.id === otherRoom.id),
    ).toBe(false);
    const common = await createRepair(f.tenant, repairInput());
    expect(
      (await db.repair.findUniqueOrThrow({ where: { id: common.id } })).unitId,
    ).toBeNull();
  });
  it("supports room-level repair reporting and sharing for tenants occupying the whole property", async () => {
    const property = await createResource(f.owner, "properties", {
      name: "Whole-let property",
      address: "9 Operations Road",
      postcode: "BS1 1AC",
      type: "house",
    });
    const room = await createResource(f.owner, "units", {
      propertyId: property.id,
      name: "Kitchen unit",
    });
    const tenancy = await createResource(f.owner, "tenancies", {
      propertyId: property.id,
      tenantIds: f.tenant.tenantIds,
      reference: randomUUID(),
      startDate: new Date().toISOString().slice(0, 10),
      rentPence: 50000,
    });
    const ctx = {
      ...f.tenant,
      activePropertyIds: [...f.tenant.activePropertyIds, property.id],
      tenancyIds: [...f.tenant.tenancyIds, tenancy.id],
    };
    expect(
      (await options(ctx)).properties.find((p) => p.id === property.id)?.units,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: room.id })]),
    );
    await createRepair(ctx, {
      ...repairInput(),
      propertyId: property.id,
      unitId: room.id,
    });
    const privateRepair = await createRepair(f.owner, {
      ...repairInput(),
      propertyId: property.id,
      unitId: room.id,
    });
    await setRepairVisibility(f.owner, privateRepair.id, {
      visibility: "occupants",
    });
    expect((await getRepair(ctx, privateRepair.id)).id).toBe(privateRepair.id);
  });
  it("does not reset an exact completion timestamp when the same calendar date is submitted", async () => {
    const repair = await createRepair(f.owner, repairInput());
    await updateRepair(f.owner, repair.id, { status: "resolved" });
    const before = (
      await db.repair.findUniqueOrThrow({ where: { id: repair.id } })
    ).completedAt!;
    await updateRepair(f.owner, repair.id, {
      status: "resolved",
      completedAt: before.toISOString().slice(0, 10),
      internalNotes: "Private bookkeeping edit.",
    });
    expect(
      (
        await db.repair.findUniqueOrThrow({ where: { id: repair.id } })
      ).completedAt?.getTime(),
    ).toBe(before.getTime());
  });
});
describe("Payment receipt permissions and allocations", () => {
  it("returns precise allocations to the relevant tenant without unrelated personal data", async () => {
    const payment = await recordPayment(f.owner, {
      tenancyId: f.tenancyId,
      amountPence: 2500,
      paidAt: new Date().toISOString().slice(0, 10),
      reference: randomUUID(),
      method: "bank transfer",
      idempotencyKey: randomUUID(),
    });
    const receipt = await paymentReceipt(f.tenant, payment.id);
    expect(receipt.amountPence).toBe(2500);
    expect(receipt.allocations.reduce((sum, a) => sum + a.amountPence, 0)).toBe(
      2500,
    );
    expect(receipt.creditPence).toBe(0);
    expect(receipt.tenancy).not.toHaveProperty("participants");
  });
  it("rejects other tenants, other organisations and staff without rent access", async () => {
    const payment = await recordPayment(f.owner, {
      tenancyId: f.tenancyId,
      amountPence: 100,
      paidAt: new Date().toISOString().slice(0, 10),
      reference: randomUUID(),
      method: "cash",
      idempotencyKey: randomUUID(),
    });
    await expect(
      paymentReceipt(f.otherTenant, payment.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(paymentReceipt(f.outside, payment.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(paymentReceipt(f.staff, payment.id)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("respects a rent manager's selected properties", async () => {
    const payment = await recordPayment(f.owner, {
      tenancyId: f.tenancyId,
      amountPence: 100,
      paidAt: new Date().toISOString().slice(0, 10),
      reference: randomUUID(),
      method: "cash",
      idempotencyKey: randomUUID(),
    });
    await expect(
      paymentReceipt(
        {
          ...f.staff,
          permissions: ["rent:read"],
          propertyIds: ["other-property"],
        },
        payment.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("Property records and room integrity", () => {
  it("merges details, clears assignments and preserves financial records during partial edits", async () => {
    const portfolio = await createResource(f.owner, "portfolios", {
      name: `Portfolio ${randomUUID()}`,
    });
    const owner = await createResource(f.owner, "owners", {
      name: `Entity ${randomUUID()}`,
    });
    await updatePropertyDetails(f.owner, f.propertyId, {
      portfolioId: portfolio.id,
      ownerId: owner.id,
      details: {
        mortgageBalancePence: 19000000,
        localAuthority: "Bristol",
        licenceReference: "LIC-1",
      },
    });
    const staff = {
      ...f.staff,
      permissions: ["properties:write"],
      propertyIds: [f.propertyId],
    };
    await updatePropertyDetails(staff, f.propertyId, {
      details: { licenceReference: "LIC-2" },
      portfolioId: null,
    });
    const stored = await db.property.findUniqueOrThrow({
      where: { id: f.propertyId },
    });
    expect(stored.details).toMatchObject({
      mortgageBalancePence: 19000000,
      localAuthority: "Bristol",
      licenceReference: "LIC-2",
    });
    expect(stored.portfolioId).toBeNull();
    expect(stored.ownerId).toBe(owner.id);
  });
  it("denies financial edits without finance permissions and foreign organisation assignments", async () => {
    const staff = { ...f.staff, permissions: ["properties:write"] };
    await expect(
      updatePropertyDetails(staff, f.propertyId, {
        details: { mortgageBalancePence: 1 },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateResource(staff, "properties", f.propertyId, { valuePence: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    const entity = await createResource(f.outside, "owners", {
      name: "Foreign entity",
    });
    await expect(
      updateResource(f.owner, "properties", f.propertyId, {
        ownerId: entity.id,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updatePropertyDetails(f.outside, f.propertyId, {
        details: { localAuthority: "Other" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("requires write permission for room creation and blocks occupied-room archival", async () => {
    await expect(
      createResource(f.staff, "units", {
        propertyId: f.propertyId,
        name: "Unauthorised room",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await updateUnit(f.owner, f.roomId, {
      name: "Renamed occupied room",
      type: "room",
    });
    await expect(
      updateUnit(f.owner, f.roomId, { archive: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await db.unit.findUniqueOrThrow({ where: { id: f.roomId } })).archivedAt,
    ).toBeNull();
  });
  it("archives vacant rooms, excludes them from choices and rejects new tenancies until restored", async () => {
    const room = await createResource(f.owner, "units", {
      propertyId: f.propertyId,
      name: `Vacant ${randomUUID()}`,
    });
    await updateUnit(f.owner, room.id, { archive: true });
    expect(
      (await options(f.owner)).properties
        .find((p) => p.id === f.propertyId)
        ?.units.some((u) => u.id === room.id),
    ).toBe(false);
    await expect(
      createResource(f.owner, "tenancies", {
        propertyId: f.propertyId,
        unitId: room.id,
        tenantIds: f.tenant.tenantIds,
        reference: randomUUID(),
        startDate: "2026-01-01",
        rentPence: 10000,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await updateUnit(f.owner, room.id, { archive: false });
    expect(
      (await options(f.owner)).properties
        .find((p) => p.id === f.propertyId)
        ?.units.some((u) => u.id === room.id),
    ).toBe(true);
  });
  it("rejects changes outside a staff member's selected property", async () => {
    const restricted = {
      ...f.staff,
      permissions: ["properties:write"],
      propertyIds: ["unavailable"],
    };
    await expect(
      updateUnit(restricted, f.roomId, { name: "Wrong scope" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("Private repair estimates and completion history", () => {
  it("keeps estimates private, rejects unauthorised finance writes and retains completion dates", async () => {
    const repair = await createRepair(f.owner, {
      ...repairInput(),
      estimatedCostPence: 45000,
    });
    await setRepairVisibility(f.owner, repair.id, {
      visibility: "selected",
      tenantIds: f.tenant.tenantIds,
    });
    expect(await getRepair(f.tenant, repair.id)).not.toHaveProperty(
      "estimatedCostPence",
    );
    expect(
      await getRepair({ ...f.staff, permissions: ["repairs:read"] }, repair.id),
    ).toMatchObject({ estimatedCostPence: null });
    await expect(
      updateRepair({ ...f.staff, permissions: ["repairs:write"] }, repair.id, {
        estimatedCostPence: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await updateRepair(f.owner, repair.id, {
      status: "resolved",
      completedAt: "2026-01-01",
      completionSummary: "Repair completed.",
    });
    await updateRepair(f.owner, repair.id, {
      status: "resolved",
      internalNotes: "Private follow-up.",
      estimatedCostPence: 47000,
    });
    const stored = await db.repair.findUniqueOrThrow({
      where: { id: repair.id },
    });
    expect(stored.completedAt?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(stored.estimatedCostPence).toBe(47000);
    await updateRepair(f.owner, repair.id, { status: "in progress" });
    expect(
      (await db.repair.findUniqueOrThrow({ where: { id: repair.id } }))
        .completedAt,
    ).toBeNull();
  });
  it("rejects invalid completion dates and strips landlord-only fields from tenant reports", async () => {
    const repair = await createRepair(f.tenant, {
      ...repairInput(),
      estimatedCostPence: 90000,
      internalNotes: "Attempted private value",
    });
    const stored = await db.repair.findUniqueOrThrow({
      where: { id: repair.id },
    });
    expect(stored.estimatedCostPence).toBeNull();
    expect(stored.internalNotes).toBe("");
    await expect(
      updateRepair(f.owner, repair.id, { completedAt: "2026-01-01" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updateRepair(f.owner, repair.id, {
        status: "resolved",
        completedAt: "2099-01-01",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("does not notify tenants about private cost and note changes", async () => {
    const repair = await createRepair(f.owner, repairInput());
    await setRepairVisibility(f.owner, repair.id, {
      visibility: "selected",
      tenantIds: f.tenant.tenantIds,
    });
    const before = await db.notification.count({
      where: { resourceId: repair.id, userId: f.tenant.userId },
    });
    await updateRepair(f.owner, repair.id, {
      estimatedCostPence: 12345,
      internalNotes: "Supplier discussion",
    });
    expect(
      await db.notification.count({
        where: { resourceId: repair.id, userId: f.tenant.userId },
      }),
    ).toBe(before);
    await updateRepair(f.owner, repair.id, { priority: "high" });
    expect(
      await db.notification.count({
        where: { resourceId: repair.id, userId: f.tenant.userId },
      }),
    ).toBe(before + 1);
  });
});
describe("Settings atomicity and personal preferences", () => {
  it("rejects mixed unauthorised organisation changes without saving profile data", async () => {
    await expect(
      updateSettings(f.tenant, {
        name: "Should not save",
        organisationName: "Unauthorised",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: f.tenant.userId } }))
        .name,
    ).toBe("tenant");
  });
  it("preserves accessibility/contact preferences when email preferences change", async () => {
    await updateSettings(f.tenant, {
      profile: {
        phone: "07700 900123",
        preferredContact: "portal",
        accessibilityNeeds: "Please use written messages.",
      },
    });
    await updateSettings(f.tenant, {
      notificationPreferences: { email: false },
    });
    expect(
      (
        await db.operationRecord.findUniqueOrThrow({
          where: {
            id: `preferences:${f.tenant.userId}:${f.tenant.organisationId}`,
          },
        })
      ).data,
    ).toMatchObject({
      email: false,
      accessibilityNeeds: "Please use written messages.",
      phone: "07700 900123",
    });
    expect(
      (await db.tenant.findFirstOrThrow({ where: { userId: f.tenant.userId } }))
        .phone,
    ).toBe("07700 900123");
  });
  it("exposes only explicitly configured repair guidance and deduplicates deletion requests", async () => {
    await updateSettings(f.owner, {
      organisationSettings: {
        emergencyContact: "07700 900111",
        emergencyGuidance: "Use the agreed urgent contact for repairs.",
      },
    });
    expect((await options(f.tenant)).repairGuidance.emergencyContact).toBe(
      "07700 900111",
    );
    await expect(
      updateSettings(f.tenant, {
        organisationSettings: { emergencyContact: "spoof" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await updateSettings(f.tenant, { deletionRequest: true });
    await updateSettings(f.tenant, { deletionRequest: true });
    expect(
      await db.operationRecord.count({
        where: { kind: "deletionRequest", userId: f.tenant.userId },
      }),
    ).toBe(1);
  });
});
describe("Document previews and reminders", () => {
  it("uses the same authorisation for inline previews, downloads and sharing revocation", async () => {
    const document = await uploadDocument(f.owner, docInput());
    await expect(
      downloadDocument(f.tenant, document.id, true),
    ).rejects.toMatchObject({ status: 404 });
    await shareDocument(f.owner, document.id, {
      tenantIds: f.tenant.tenantIds,
    });
    const preview = await downloadDocument(f.tenant, document.id, true);
    expect(preview.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(preview.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await preview.text()).toContain("%PDF-");
    await shareDocument(f.owner, document.id, { tenantIds: [] });
    await expect(
      downloadDocument(f.tenant, document.id, true),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      downloadDocument(f.outside, document.id, true),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("protects expiry edits and generates idempotent, manager-only configured reminders", async () => {
    const form = docInput();
    const expiresAt = new Date(Date.now() + 45 * 86400000)
      .toISOString()
      .slice(0, 10);
    form.set("expiresAt", expiresAt);
    const document = await uploadDocument(f.owner, form);
    await expect(
      updateDocumentMetadata(f.tenant, document.id, { expiresAt }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateDocumentMetadata(f.outside, document.id, { expiresAt }),
    ).rejects.toMatchObject({ status: 404 });
    await schedule(new Date(), f.owner.organisationId);
    expect(
      await db.notification.count({ where: { resourceId: document.id } }),
    ).toBe(0);
    await updateSettings(f.owner, {
      organisationSettings: { documentReminderDays: 60 },
    });
    await schedule(new Date(), f.owner.organisationId);
    await schedule(new Date(), f.owner.organisationId);
    const notifications = await db.notification.findMany({
      where: { resourceId: document.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(f.owner.userId);
    await updateDocumentMetadata(f.owner, document.id, { expiresAt: null });
    expect(
      (await db.document.findUniqueOrThrow({ where: { id: document.id } }))
        .expiresAt,
    ).toBeNull();
  });
});
describe("Private feedback and preserved landlord responses", () => {
  it("keeps feedback private, persists response history and makes retries idempotent", async () => {
    const record = await createResource(f.tenant, "feedback", {
      title: "Private complaint",
      propertyId: f.propertyId,
      data: {
        type: "complaint",
        body: "Please investigate this private complaint.",
      },
    });
    expect(
      (
        await listResource(f.otherTenant, "feedback", new URLSearchParams())
      ).rows.some((r) => (r as { id: string }).id === record.id),
    ).toBe(false);
    await expect(
      respondToFeedback(f.outside, record.id, {
        response: "Wrong organisation",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      respondToFeedback(f.tenant, record.id, {
        response: "Forged manager",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403 });
    const request = {
      response: "We will investigate this concern.",
      idempotencyKey: randomUUID(),
      status: "in progress",
    };
    await respondToFeedback(f.owner, record.id, request);
    await respondToFeedback(f.owner, record.id, request);
    const data = operationSchemas.feedback.parse(
      (await db.operationRecord.findUniqueOrThrow({ where: { id: record.id } }))
        .data,
    );
    expect(data.responses).toHaveLength(1);
    expect(data.body).toBe("Please investigate this private complaint.");
    expect(
      await db.notification.count({
        where: { resourceId: record.id, title: "Your feedback has a response" },
      }),
    ).toBe(1);
    await expect(
      respondToFeedback(f.owner, record.id, {
        ...request,
        response: "Changed replay",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("preserves replies during tenant edits and prevents managers rewriting tenant feedback", async () => {
    const record = await createResource(f.tenant, "feedback", {
      title: "Repair satisfaction",
      tenancyId: f.tenancyId,
      data: { type: "general", body: "Original tenant report." },
    });
    await respondToFeedback(f.owner, record.id, {
      response: "Saved landlord response.",
      idempotencyKey: randomUUID(),
    });
    await updateResource(f.tenant, "feedback", record.id, {
      title: "Edited feedback title",
      data: {
        type: "general",
        body: "Updated tenant report.",
        response: "Forged response",
        responses: [],
      },
    });
    const data = operationSchemas.feedback.parse(
      (await db.operationRecord.findUniqueOrThrow({ where: { id: record.id } }))
        .data,
    );
    expect(data.response).toBe("Saved landlord response.");
    expect(data.responses).toHaveLength(1);
    await expect(
      updateResource(f.owner, "feedback", record.id, {
        data: { type: "general", body: "Manager replacement." },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("rejects inconsistent property links and feedback about inaccessible private repairs", async () => {
    const repair = await createRepair(f.owner, repairInput());
    await expect(
      createResource(f.tenant, "feedback", {
        title: "Hidden repair",
        data: {
          type: "repair",
          repairId: repair.id,
          body: "Attempted private repair feedback.",
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
    const other = await createResource(f.owner, "properties", {
      name: "Second operations property",
      address: "8 Operations Road",
      postcode: "BS1 1AB",
      type: "house",
    });
    await expect(
      createResource(f.owner, "feedback", {
        title: "Conflicting links",
        propertyId: other.id,
        tenancyId: f.tenancyId,
        data: { type: "general", body: "Conflicting property and tenancy." },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
