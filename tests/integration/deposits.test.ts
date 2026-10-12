import { beforeAll, afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { operationsFixture } from "../helpers/operations-fixture";
import { getDepositDetail, respondToDeposit } from "@/server/deposits";
import { updateResource } from "@/server/resources";
let f: Awaited<ReturnType<typeof operationsFixture>>;
let depositId: string;
const proposal = (amountPence = 5000) => ({
  scheme: "Manually recorded test scheme",
  reference: "Test-reference",
  status: "scheme recorded",
  returnedPence: 0,
  notes: "PRIVATE-LANDLORD-NOTE",
  deductions: [
    {
      description: "Proposed recorded damage repair",
      amountPence,
      accepted: false,
      tenantResponse: "",
      documentIds: [],
    },
  ],
});
beforeAll(async () => {
  f = await operationsFixture();
  depositId = (
    await db.deposit.findUniqueOrThrow({ where: { tenancyId: f.tenancyId } })
  ).id;
  await updateResource(f.owner, "deposits", depositId, proposal());
});
it("keeps deposit information readable while disabling responses excluded by the plan", async () => {
  const subscription = await db.subscription.findUniqueOrThrow({
    where: { organisationId: f.owner.organisationId },
  });
  const plan = await db.subscriptionPlan.findUniqueOrThrow({
    where: { id: subscription.planId },
  });
  await db.subscriptionPlan.update({
    where: { id: plan.id },
    data: {
      features: plan.features.filter((feature) => feature !== "operations"),
    },
  });
  try {
    const detail = await getDepositDetail(f.tenant, depositId);
    expect(detail.canRespond).toBe(false);
    await expect(
      respondToDeposit(f.tenant, depositId, {
        proposalHash: detail.proposalHash,
        decision: "question",
        body: "Please explain the proposal.",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 402 });
  } finally {
    await db.subscriptionPlan.update({
      where: { id: plan.id },
      data: { features: plan.features },
    });
  }
  expect((await getDepositDetail(f.tenant, depositId)).canRespond).toBe(true);
});
afterAll(async () => {
  await db.$disconnect();
});
it("keeps deposit details private and prevents another tenant or organisation responding", async () => {
  const detail = await getDepositDetail(f.tenant, depositId);
  expect(detail).not.toHaveProperty("notes");
  expect(detail.deductions[0]).not.toHaveProperty("documentIds");
  await expect(
    getDepositDetail(f.otherTenant, depositId),
  ).rejects.toMatchObject({ status: 404 });
  await expect(getDepositDetail(f.outside, depositId)).rejects.toMatchObject({
    status: 404,
  });
  const input = {
    proposalHash: detail.proposalHash,
    decision: "disagree",
    body: "Please review fair wear and tear.",
    idempotencyKey: randomUUID(),
  };
  await expect(
    respondToDeposit(f.otherTenant, depositId, input),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    respondToDeposit(f.owner, depositId, input),
  ).rejects.toMatchObject({ status: 403 });
});
it("records idempotent tenant responses without altering deductions, amounts or returns", async () => {
  const detail = await getDepositDetail(f.tenant, depositId);
  const input = {
    proposalHash: detail.proposalHash,
    decision: "agree",
    body: "I have reviewed this recorded proposal.",
    idempotencyKey: randomUUID(),
  };
  const [first, second] = await Promise.all([
    respondToDeposit(f.tenant, depositId, input),
    respondToDeposit(f.tenant, depositId, input),
  ]);
  expect(first.id).toBe(second.id);
  expect(await db.depositResponse.count({ where: { depositId } })).toBe(1);
  const stored = await db.deposit.findUniqueOrThrow({
    where: { id: depositId },
  });
  expect(stored.amountPence).toBe(100000);
  expect(stored.returnedPence).toBe(0);
  expect(stored.deductions).toMatchObject([
    { accepted: false, amountPence: 5000 },
  ]);
  expect(
    await db.notification.count({
      where: {
        resourceId: depositId,
        title: "A tenant responded to a deposit proposal",
      },
    }),
  ).toBe(1);
  await expect(
    respondToDeposit(f.tenant, depositId, {
      ...input,
      body: "Altered replay of the original response.",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("rejects responses to changed proposals while preserving earlier response history", async () => {
  const before = await getDepositDetail(f.tenant, depositId);
  await updateResource(f.owner, "deposits", depositId, proposal(6000));
  await expect(
    respondToDeposit(f.tenant, depositId, {
      proposalHash: before.proposalHash,
      decision: "agree",
      body: "Responding to an old proposal.",
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 409 });
  const current = await getDepositDetail(f.tenant, depositId);
  expect(current.proposalHash).not.toBe(before.proposalHash);
  expect(current.responses[0].proposalHash).toBe(before.proposalHash);
  await respondToDeposit(f.tenant, depositId, {
    proposalHash: current.proposalHash,
    decision: "question",
    body: "Please explain the revised amount.",
    idempotencyKey: randomUUID(),
  });
  expect((await getDepositDetail(f.owner, depositId)).responses).toHaveLength(
    2,
  );
});
it("records separate co-tenant responses without exposing one person's private comments to another", async () => {
  const coTenant = await db.tenant.create({
    data: {
      organisationId: f.owner.organisationId,
      userId: f.otherTenant.userId,
      name: "Co-tenant",
      email: `co-${randomUUID()}@example.test`,
    },
  });
  await db.tenancyParticipant.create({
    data: {
      organisationId: f.owner.organisationId,
      tenancyId: f.tenancyId,
      tenantId: coTenant.id,
    },
  });
  const coContext = {
    ...f.otherTenant,
    tenantIds: [coTenant.id],
    tenancyIds: [f.tenancyId],
  };
  const detail = await getDepositDetail(coContext, depositId);
  expect(detail.responses).toHaveLength(0);
  await respondToDeposit(coContext, depositId, {
    proposalHash: detail.proposalHash,
    decision: "disagree",
    body: "My private co-tenant deposit response.",
    idempotencyKey: randomUUID(),
  });
  expect((await getDepositDetail(coContext, depositId)).responses).toHaveLength(
    1,
  );
  expect(
    (await getDepositDetail(f.tenant, depositId)).responses.some(
      (r) => r.body === "My private co-tenant deposit response.",
    ),
  ).toBe(false);
  expect((await getDepositDetail(f.owner, depositId)).responses).toHaveLength(
    3,
  );
});
it("enforces organisation consistency through database foreign keys", async () => {
  await expect(
    db.depositResponse.create({
      data: {
        organisationId: f.outside.organisationId,
        depositId,
        tenantId: f.tenant.tenantIds[0],
        proposalHash: (await getDepositDetail(f.tenant, depositId))
          .proposalHash,
        decision: "question",
        body: "Invalid cross-organisation record.",
        idempotencyKey: randomUUID(),
      },
    }),
  ).rejects.toMatchObject({ code: "P2003" });
});
