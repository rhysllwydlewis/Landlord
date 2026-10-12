import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { operationsFixture } from "../helpers/operations-fixture";
import { createResource, updateResource } from "@/server/resources";
import { updateUnit } from "@/server/properties";
import { updateSettings } from "@/server/settings";
import { createRepair, getRepair } from "@/server/repairs";
import {
  uploadDocument,
  downloadDocument,
  shareDocument,
} from "@/server/documents";
import {
  canViewNotification,
  hasUnreadNotifications,
  notify,
} from "@/server/notifications";
import { processJobs } from "@/server/jobs";
import type { Context } from "@/server/context";

let f: Awaited<ReturnType<typeof operationsFixture>>;
beforeAll(async () => {
  f = await operationsFixture();
});
afterAll(async () => {
  await db.$disconnect();
});
function fileInput(repairId?: string) {
  const form = new FormData();
  form.set(
    "file",
    new File(["%PDF-1.4\n test"], "Private repair evidence.pdf", {
      type: "application/pdf",
    }),
  );
  if (repairId) form.set("repairId", repairId);
  else form.set("propertyId", f.propertyId);
  return form;
}

describe("Partial updates preserve omitted values", () => {
  it("does not reset property specifications and notes when only the name changes", async () => {
    const property = await createResource(f.owner, "properties", {
      name: "Before rename",
      address: "7 Review Road",
      postcode: "CF10 1AA",
      type: "house",
      jurisdiction: "Wales",
      bedrooms: 4,
      bathrooms: 2,
      furnishing: "furnished",
      notes: "Existing private notes.",
    });
    await updateResource(f.owner, "properties", property.id, {
      name: "After rename",
    });
    expect(
      await db.property.findUniqueOrThrow({ where: { id: property.id } }),
    ).toMatchObject({
      name: "After rename",
      jurisdiction: "Wales",
      bedrooms: 4,
      bathrooms: 2,
      furnishing: "furnished",
      notes: "Existing private notes.",
    });
  });
  it("preserves a flat's type through rename, archive and restore", async () => {
    const unit = await createResource(f.owner, "units", {
      propertyId: f.propertyId,
      name: "Before rename",
      type: "flat",
    });
    for (const change of [
      { name: "After rename" },
      { archive: true },
      { archive: false },
    ]) {
      await updateUnit(f.owner, unit.id, change);
      expect(
        (await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).type,
      ).toBe("flat");
    }
  });
  it("does not erase a tenant's telephone when a manager updates their name", async () => {
    const tenant = await createResource(f.owner, "tenants", {
      name: "Before rename",
      email: `review-${randomUUID()}@example.test`,
      phone: "01234 567890",
    });
    await updateResource(f.owner, "tenants", tenant.id, {
      name: "After rename",
    });
    expect(
      (await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).phone,
    ).toBe("01234 567890");
  });
  it("merges one profile field without resetting contact, accessibility or email preferences", async () => {
    await updateSettings(f.tenant, {
      profile: {
        phone: "01234 567890",
        preferredContact: "phone",
        accessibilityNeeds: "Written updates please.",
      },
      notificationPreferences: { email: false },
    });
    await updateSettings(f.tenant, { profile: { phone: "" } });
    const preferences = await db.operationRecord.findUniqueOrThrow({
      where: {
        id: `preferences:${f.tenant.userId}:${f.tenant.organisationId}`,
      },
    });
    expect(preferences.data).toMatchObject({
      phone: "",
      preferredContact: "phone",
      accessibilityNeeds: "Written updates please.",
      email: false,
    });
    expect(
      (
        await db.tenant.findUniqueOrThrow({
          where: { id: f.tenant.tenantIds[0] },
        })
      ).phone,
    ).toBe("");
  });
  it("changes a reminder lead time without erasing safety contacts or other lead times", async () => {
    await updateSettings(f.owner, {
      organisationSettings: {
        emergencyContact: "01234 567890",
        emergencyGuidance: "Phone for urgent repair support.",
        complianceReminderDays: 90,
        documentReminderDays: 60,
      },
    });
    await updateSettings(f.owner, {
      organisationSettings: { documentReminderDays: 45 },
    });
    expect(
      (
        await db.organisation.findUniqueOrThrow({
          where: { id: f.owner.organisationId },
        })
      ).settings,
    ).toMatchObject({
      emergencyContact: "01234 567890",
      emergencyGuidance: "Phone for urgent repair support.",
      complianceReminderDays: 90,
      documentReminderDays: 45,
    });
  });
});

describe("Attachments and notification permissions", () => {
  it("omits attachment metadata from repair-only staff and preserves authorised document access", async () => {
    const repair = await createRepair(f.owner, {
      propertyId: f.propertyId,
      title: "Private repair",
      description: "A private maintenance repair for testing.",
      category: "Plumbing",
    });
    const document = await uploadDocument(f.owner, fileInput(repair.id));
    const repairStaff = { ...f.staff, permissions: ["repairs:read"] };
    expect((await getRepair(repairStaff, repair.id)).documents).toEqual([]);
    await expect(
      downloadDocument(repairStaff, document.id, true),
    ).rejects.toMatchObject({ status: 403 });
    const documentStaff = {
      ...repairStaff,
      permissions: ["repairs:read", "documents:read"],
    };
    expect((await getRepair(documentStaff, repair.id)).documents).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: document.id })]),
    );
    expect(
      (await downloadDocument(documentStaff, document.id, true)).status,
    ).toBe(200);
  });
  it("filters deposit, feedback and document alerts after scope or permissions are revoked", async () => {
    const deposit = await db.deposit.findUniqueOrThrow({
      where: { tenancyId: f.tenancyId },
    });
    const feedback = await createResource(f.tenant, "feedback", {
      title: "Private feedback",
      propertyId: f.propertyId,
      data: { type: "general", body: "A private service concern." },
    });
    const document = await uploadDocument(f.owner, fileInput());
    const staff: Context = {
      ...f.staff,
      permissions: ["tenancies:read", "operations:read", "documents:read"],
      propertyIds: [f.propertyId],
    };
    const pointers = [
      { resourceType: "deposit", resourceId: deposit.id },
      { resourceType: "feedback", resourceId: feedback.id },
      { resourceType: "document", resourceId: document.id },
    ];
    for (const pointer of pointers) {
      expect(await canViewNotification(staff, pointer)).toBe(true);
      expect(
        await canViewNotification(
          { ...staff, propertyIds: [randomUUID()] },
          pointer,
        ),
      ).toBe(false);
      expect(
        await canViewNotification({ ...staff, permissions: [] }, pointer),
      ).toBe(false);
      expect(await canViewNotification(f.outside, pointer)).toBe(false);
      await notify(
        f.owner.organisationId,
        [staff.userId],
        "Private record update",
        "/app/notifications",
        `review:${randomUUID()}`,
        pointer.resourceType,
        pointer.resourceId,
      );
    }
    expect(await hasUnreadNotifications(staff)).toBe(true);
    expect(await hasUnreadNotifications({ ...staff, permissions: [] })).toBe(
      false,
    );
    expect(await canViewNotification(f.tenant, pointers[1])).toBe(true);
    expect(await canViewNotification(f.otherTenant, pointers[1])).toBe(false);
  });
  it("keeps manager-only expiry alerts private even when a tenant can read the document", async () => {
    const document = await uploadDocument(f.owner, fileInput());
    await shareDocument(f.owner, document.id, {
      tenantIds: f.tenant.tenantIds,
    });
    const pointer = { resourceType: "document", resourceId: document.id };
    expect(await canViewNotification(f.tenant, pointer)).toBe(true);
    for (const prefix of ["document-expiry:", "email:document-expiry:"]) {
      expect(
        await canViewNotification(f.tenant, {
          ...pointer,
          dedupeKey: `${prefix}${document.id}`,
        }),
      ).toBe(false);
      expect(
        await canViewNotification(f.owner, {
          ...pointer,
          dedupeKey: `${prefix}${document.id}`,
        }),
      ).toBe(true);
    }
    await shareDocument(f.owner, document.id, { tenantIds: [] });
    expect(await canViewNotification(f.tenant, pointer)).toBe(false);
  });
  it("cancels queued object alerts before delivery when staff no longer have access", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    try {
      const deposit = await db.deposit.findUniqueOrThrow({
        where: { tenancyId: f.tenancyId },
      });
      const feedback = await createResource(f.tenant, "feedback", {
        title: "Private queued feedback",
        propertyId: f.propertyId,
        data: { type: "general", body: "A private queued service concern." },
      });
      await db.membership.update({
        where: {
          organisationId_userId: {
            organisationId: f.owner.organisationId,
            userId: f.staff.userId,
          },
        },
        data: { permissions: [] },
      });
      const keys = [];
      for (const pointer of [
        { resourceType: "deposit", resourceId: deposit.id },
        { resourceType: "feedback", resourceId: feedback.id },
      ]) {
        const key = `revoked-mail:${randomUUID()}`;
        keys.push(`email:${key}:${f.staff.userId}`);
        await notify(
          f.owner.organisationId,
          [f.staff.userId],
          "Private record update",
          "/app/notifications",
          key,
          pointer.resourceType,
          pointer.resourceId,
        );
      }
      await processJobs(f.owner.organisationId);
      expect(
        await db.backgroundJob.findMany({
          where: { dedupeKey: { in: keys } },
          select: { status: true },
        }),
      ).toEqual([{ status: "cancelled" }, { status: "cancelled" }]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
