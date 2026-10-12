import Stripe from "stripe";
import { z } from "zod";
import { db } from "./db";
import { invariant } from "./errors";
import { audit, type Context } from "./context";
export function stripeClient() {
  invariant(
    process.env.STRIPE_SECRET_KEY,
    503,
    "Stripe Billing is not configured.",
  );
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export async function billingAction(ctx: Context, raw: unknown) {
  invariant(
    ctx.role === "OWNER",
    403,
    "Only the organisation owner can manage billing.",
  );
  const x = z
    .object({
      action: z.enum(["checkout", "portal"]),
      planId: z.string().optional(),
      interval: z.enum(["monthly", "annual"]).default("monthly"),
    })
    .parse(raw);
  const stripe = stripeClient();
  const s = await db.subscription.findUnique({
    where: { organisationId: ctx.organisationId },
  });
  invariant(s, 404, "Subscription not found.");
  const returnUrl = `${process.env.APP_URL}/app/billing`;
  if (x.action === "portal") {
    invariant(
      s.stripeCustomerId,
      422,
      "No Stripe customer is linked to this organisation.",
    );
    const portal = await stripe.billingPortal.sessions.create({
      customer: s.stripeCustomerId,
      return_url: returnUrl,
    });
    await audit(ctx, "billing.portal.opened", "subscription", s.id);
    return { url: portal.url };
  }
  const plan = await db.subscriptionPlan.findFirst({
    where: { id: x.planId, active: true, developmentOnly: false },
  });
  invariant(plan, 422, "Select an active production plan.");
  const price =
    x.interval === "monthly"
      ? plan.stripeMonthlyPriceId
      : plan.stripeAnnualPriceId;
  invariant(price, 503, "This plan has no Stripe price configured.");
  invariant(
    !s.stripeSubscriptionId,
    409,
    "Manage your existing subscription through the customer portal.",
  );
  let customerId = s.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email: ctx.email, metadata: { organisationId: ctx.organisationId } },
      { idempotencyKey: `customer:${ctx.organisationId}` },
    );
    customerId = customer.id;
    await db.subscription.update({
      where: { id: s.id },
      data: { stripeCustomerId: customerId },
    });
  }
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${returnUrl}?returned=1`,
    cancel_url: returnUrl,
    metadata: { organisationId: ctx.organisationId },
    subscription_data: { metadata: { organisationId: ctx.organisationId } },
  });
  await audit(ctx, "billing.checkout.created", "subscription", s.id);
  return { url: checkout.url };
}
export async function stripeWebhook(body: string, signature: string) {
  invariant(
    process.env.STRIPE_WEBHOOK_SECRET,
    503,
    "Stripe webhook is unconfigured.",
  );
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    invariant(false, 400, "Invalid webhook signature.");
  }
  if (await db.integrationEvent.findUnique({ where: { id: event.id } }))
    return { received: true };
  let subscription: Stripe.Subscription | undefined;
  if (event.type.startsWith("customer.subscription."))
    subscription = event.data.object as Stripe.Subscription;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription === "string")
      subscription = await stripe.subscriptions.retrieve(session.subscription);
  }
  await db.$transaction(
    async (tx) => {
      if (await tx.integrationEvent.findUnique({ where: { id: event.id } }))
        return;
      await tx.integrationEvent.create({
        data: { id: event.id, provider: "stripe" },
      });
      if (subscription) {
        const orgId = subscription.metadata.organisationId;
        const customer =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const record = await tx.subscription.findFirst({
          where: { organisationId: orgId, stripeCustomerId: customer },
        });
        if (!record) return;
        const price = subscription.items.data[0]?.price.id;
        const plan = await tx.subscriptionPlan.findFirst({
          where: {
            developmentOnly: false,
            OR: [
              { stripeMonthlyPriceId: price },
              { stripeAnnualPriceId: price },
            ],
          },
        });
        invariant(plan, 422, "Stripe price has no matching plan.");
        await tx.subscription.update({
          where: { id: record.id },
          data: {
            planId: plan.id,
            provider: "stripe",
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.items.data[0]?.current_period_end
              ? new Date(subscription.items.data[0].current_period_end * 1000)
              : null,
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        await tx.auditLog.create({
          data: {
            organisationId: orgId,
            actorUserId: "stripe",
            action: "subscription.synchronised",
            resourceType: "subscription",
            resourceId: record.id,
            metadata: { eventId: event.id, status: subscription.status },
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );
  return { received: true };
}
