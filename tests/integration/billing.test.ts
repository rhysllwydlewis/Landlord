import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { billingAction, stripeWebhook } from "@/server/billing";
import type { Context } from "@/server/context";
const provider = vi.hoisted(() => ({
  retrieve: vi.fn(),
  checkout: vi.fn(),
  customer: vi.fn(),
}));
vi.mock("stripe", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("stripe")>();
  return {
    default: class {
      webhooks = new sdk.default("sk_test_offline_review_fixture").webhooks;
      subscriptions = { retrieve: provider.retrieve };
      checkout = { sessions: { create: provider.checkout } };
      customers = { create: provider.customer };
    },
  };
});
const suffix = randomUUID();
const secret = "whsec_offline_review_fixture";
let ctx: Context, planId: string, customerId: string;
let sdk: Stripe;
beforeAll(async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_offline_review_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  const actual = await vi.importActual<typeof import("stripe")>("stripe");
  sdk = new actual.default("sk_test_offline_review_fixture");
  const plan = await db.subscriptionPlan.create({
    data: {
      name: `Billing ${suffix}`,
      monthlyPence: 2500,
      annualPence: 25000,
      propertyLimit: 10,
      unitLimit: 20,
      staffLimit: 3,
      storageBytes: BigInt(10000000),
      features: ["core"],
      active: true,
      trialDays: 14,
      stripeMonthlyPriceId: `price_${suffix}`,
    },
  });
  planId = plan.id;
  customerId = `cus_${suffix}`;
  const org = await db.organisation.create({
    data: {
      name: `Billing review ${suffix}`,
      subscription: {
        create: {
          planId,
          provider: "development",
          status: "trialing",
          stripeCustomerId: customerId,
        },
      },
    },
  });
  ctx = {
    userId: `review_${suffix}`,
    name: "Review owner",
    email: "review@example.test",
    organisationId: org.id,
    role: "OWNER",
    permissions: [],
    propertyIds: [],
    tenantIds: [],
    tenancyIds: [],
    activePropertyIds: [],
  };
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
});
async function event(body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  const signature = sdk.webhooks.generateTestHeaderString({ payload, secret });
  return stripeWebhook(payload, signature);
}
describe("Stripe contract and signature verification (offline provider fixtures)", () => {
  it("rejects missing checkout plans and unauthorised users", async () => {
    await expect(
      billingAction(ctx, { action: "checkout" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      billingAction({ ...ctx, role: "TENANT" }, { action: "checkout", planId }),
    ).rejects.toMatchObject({ status: 403 });
    expect(provider.checkout).not.toHaveBeenCalled();
  });
  it("passes configured trial days to checkout without processing money", async () => {
    provider.checkout.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/offline-fixture",
    });
    await billingAction(ctx, { action: "checkout", planId });
    expect(provider.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: customerId,
        subscription_data: expect.objectContaining({ trial_period_days: 14 }),
      }),
    );
  });
  it("rejects invalid signatures before provider access", async () => {
    await expect(stripeWebhook("{}", "invalid")).rejects.toMatchObject({
      status: 400,
    });
    expect(provider.retrieve).not.toHaveBeenCalled();
  });
  it("fetches authoritative subscription state and deduplicates signed events", async () => {
    provider.retrieve.mockResolvedValue({
      id: `sub_${suffix}`,
      customer: customerId,
      metadata: { organisationId: ctx.organisationId },
      status: "active",
      trial_end: null,
      items: {
        data: [
          {
            price: { id: `price_${suffix}` },
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        ],
      },
    });
    const payload = {
      id: `evt_${suffix}`,
      type: "customer.subscription.updated",
      data: { object: { id: `sub_${suffix}`, status: "canceled" } },
    };
    await event(payload);
    await event(payload);
    expect(provider.retrieve).toHaveBeenCalledTimes(1);
    expect(
      await db.subscription.findUnique({
        where: { organisationId: ctx.organisationId },
      }),
    ).toMatchObject({ status: "active", planId, provider: "stripe" });
    expect(
      await db.integrationEvent.count({ where: { id: `evt_${suffix}` } }),
    ).toBe(1);
  });
  it("does not match a subscription with a missing price to an unconfigured plan", async () => {
    provider.retrieve.mockResolvedValue({
      id: `sub_${suffix}`,
      customer: customerId,
      metadata: { organisationId: ctx.organisationId },
      status: "active",
      items: { data: [] },
    });
    await expect(
      event({
        id: `evt_missing_${suffix}`,
        type: "customer.subscription.updated",
        data: { object: { id: `sub_${suffix}` } },
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      await db.integrationEvent.count({
        where: { id: `evt_missing_${suffix}` },
      }),
    ).toBe(0);
  });
  it("permits resubscription after cancellation without granting a second trial", async () => {
    await db.subscription.update({
      where: { organisationId: ctx.organisationId },
      data: { status: "canceled" },
    });
    provider.checkout.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/offline-fixture",
    });
    await billingAction(ctx, { action: "checkout", planId });
    expect(
      provider.checkout.mock.lastCall?.[0].subscription_data,
    ).not.toHaveProperty("trial_period_days");
  });
  it("ignores delayed events for an old subscription after a new one is active", async () => {
    await db.subscription.update({
      where: { organisationId: ctx.organisationId },
      data: { status: "active", stripeSubscriptionId: `sub_new_${suffix}` },
    });
    provider.retrieve.mockResolvedValue({
      id: `sub_${suffix}`,
      customer: customerId,
      metadata: { organisationId: ctx.organisationId },
      status: "canceled",
      items: { data: [{ price: { id: `price_${suffix}` } }] },
    });
    await event({
      id: `evt_old_${suffix}`,
      type: "customer.subscription.deleted",
      data: { object: { id: `sub_${suffix}` } },
    });
    expect(
      await db.subscription.findUnique({
        where: { organisationId: ctx.organisationId },
      }),
    ).toMatchObject({
      status: "active",
      stripeSubscriptionId: `sub_new_${suffix}`,
    });
  });
});
