import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
import { createResource } from "../../src/server/resources";
import type { Context } from "../../src/server/context";

export async function operationsFixture() {
  const suffix = randomUUID();
  const plan = await db.subscriptionPlan.create({
    data: {
      name: `Operations test ${suffix}`,
      monthlyPence: 0,
      annualPence: 0,
      propertyLimit: 100,
      unitLimit: 100,
      staffLimit: 10,
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
      active: true,
      developmentOnly: true,
    },
  });
  const users = await Promise.all(
    ["owner", "tenant", "other-tenant", "staff", "outside"].map((name) =>
      db.user.create({
        data: {
          id: randomUUID(),
          name,
          email: `${name}-${suffix}@example.test`,
          emailVerified: true,
        },
      }),
    ),
  );
  const org = await db.organisation.create({
    data: {
      name: `Operations ${suffix}`,
      subscription: {
        create: { planId: plan.id, provider: "development", status: "active" },
      },
      memberships: {
        create: users
          .slice(0, 4)
          .map((u, i) => ({
            userId: u.id,
            role: i === 0 ? "OWNER" : i === 3 ? "STAFF" : "TENANT",
          })),
      },
    },
  });
  const outsideOrg = await db.organisation.create({
    data: {
      name: `Outside ${suffix}`,
      subscription: {
        create: { planId: plan.id, provider: "development", status: "active" },
      },
      memberships: { create: { userId: users[4].id, role: "OWNER" } },
    },
  });
  const ctx = (
    i: number,
    role: Context["role"],
    organisationId = org.id,
  ): Context => ({
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
  });
  const owner = ctx(0, "OWNER"),
    outside = ctx(4, "OWNER", outsideOrg.id);
  const property = await createResource(owner, "properties", {
    name: "Operations HMO",
    address: "7 Operations Road, Bristol",
    postcode: "BS1 1AA",
    type: "HMO",
  });
  const room = await createResource(owner, "units", {
    propertyId: property.id,
    name: "Occupied room",
  });
  const tenant = await db.tenant.create({
    data: {
      organisationId: org.id,
      name: users[1].name,
      email: users[1].email,
      userId: users[1].id,
    },
  });
  const tenancy = await createResource(owner, "tenancies", {
    propertyId: property.id,
    unitId: room.id,
    tenantIds: [tenant.id],
    reference: `OPS-${suffix}`,
    startDate: new Date().toISOString().slice(0, 10),
    rentPence: 100000,
    depositPence: 100000,
  });
  return {
    owner,
    outside,
    staff: { ...ctx(3, "STAFF"), permissions: ["properties:read"] },
    tenant: {
      ...ctx(1, "TENANT"),
      tenantIds: [tenant.id],
      tenancyIds: [tenancy.id],
      activePropertyIds: [property.id],
    },
    otherTenant: { ...ctx(2, "TENANT"), activePropertyIds: [property.id] },
    propertyId: property.id,
    roomId: room.id,
    tenancyId: tenancy.id,
  };
}
