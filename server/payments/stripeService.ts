import Stripe from 'stripe';
import { db } from '../database/db.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// One Stripe price per plan. Create these in the Stripe dashboard; the monthly
// and yearly ones are recurring prices, the lifetime one is a one-off.
const PRICE_IDS: Record<PremiumPlan, string> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || '',
  yearly: process.env.STRIPE_PRICE_YEARLY || '',
  lifetime: process.env.STRIPE_PRICE_LIFETIME || '',
};

export type PremiumPlan = 'monthly' | 'yearly' | 'lifetime';

export const isPremiumPlan = (value: unknown): value is PremiumPlan =>
  value === 'monthly' || value === 'yearly' || value === 'lifetime';

// Stripe has eight subscription statuses; only some of them mean "stop serving
// premium". Collapsing every non-active one to canceled revoked access from
// customers who had actually paid: a new subscription is `incomplete` until the
// first charge (or the 3DS challenge) clears, and `past_due` is Stripe retrying
// the card, not a cancellation. Returns null for "no decision yet, leave the
// row alone" - including for any status Stripe adds later, since inventing a
// downgrade from an unknown state is how paying users lose access.
export const subscriptionStatus = (
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'trialing' | 'canceled' | null => {
  switch (stripeStatus) {
    case 'active':
    case 'past_due': // dunning: keep access while Stripe retries the card
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default: // incomplete, paused, anything new
      return null;
  }
};

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not set. Payment features will not work.');
    }
    // Stripe's constructor throws on an empty key, and this module is imported
    // from the route table, so an unset key took the entire server down at
    // import time - over a feature the warning above says is merely
    // unavailable. A placeholder keeps boot working; real calls still fail.
    this.stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_unset', {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCheckoutSession(userId: string, email: string, plan: PremiumPlan): Promise<string> {
    try {
      const priceId = PRICE_IDS[plan];
      if (!priceId) {
        throw new Error(`No Stripe price configured for the ${plan} plan`);
      }
      // Check if user already has a customer ID
      let customerId = db.getStripeCustomerId(userId);

      // Create customer if doesn't exist
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email,
          metadata: {
            userId,
          },
        });
        customerId = customer.id;
      }

      // Lifetime is a one-off payment; the other two are recurring.
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: plan === 'lifetime' ? 'payment' : 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/?premium=success`,
        cancel_url: `${process.env.CLIENT_URL}/?premium=cancel`,
        metadata: { userId, plan },
        // Subscription webhooks arrive without the session metadata, so copy it
        // onto the subscription itself or the handler cannot tell whose it is.
        ...(plan === 'lifetime'
          ? { payment_intent_data: { metadata: { userId, plan } } }
          : { subscription_data: { metadata: { userId, plan } } }),
      });

      return session.url!;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  async createPortalSession(userId: string): Promise<string> {
    try {
      const customerId = db.getStripeCustomerId(userId);
      if (!customerId) {
        throw new Error('No Stripe customer found');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        // There is no /settings route - the app is a single screen - so send
        // them back to where they started.
        return_url: process.env.CLIENT_URL,
      });

      return session.url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw new Error('Failed to create portal session');
    }
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error.message);
      throw new Error('Invalid signature');
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event, event.data.object as Stripe.Subscription);
        break;

      case 'charge.refunded':
        await this.handleLifetimeRefund(event, event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('No userId in session metadata');
      return;
    }

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    // A lifetime unlock is a one-off payment: there is no subscription to read,
    // and no period end, which is what makes it never expire.
    let periodStart: number | null = null;
    let periodEnd: number | null = null;
    let status: 'active' | 'trialing' | 'canceled' | null = 'active';

    if (subscriptionId) {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      periodStart = stripeSubscription.current_period_start * 1000;
      periodEnd = stripeSubscription.current_period_end * 1000;
      status = subscriptionStatus(stripeSubscription.status);
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    const externalKey = subscriptionId || paymentIntentId || session.id;

    db.applyBillingEvent({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      occurredAt: event.created * 1000,
      userId,
      externalKey,
      kind: subscriptionId ? 'subscription' : 'lifetime',
      status: status === 'canceled' ? 'canceled' : status,
      customerId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    console.log(`Premium (${session.metadata?.plan ?? 'unknown'}) activated for user ${userId}`);
  }

  private async handleSubscriptionUpdated(event: Stripe.Event, subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const status = subscriptionStatus(subscription.status);
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
    db.applyBillingEvent({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      occurredAt: event.created * 1000,
      userId,
      externalKey: subscription.id,
      kind: 'subscription',
      status,
      customerId,
      currentPeriodStart: subscription.current_period_start * 1000,
      currentPeriodEnd: subscription.current_period_end * 1000,
    });

    console.log(`Subscription updated for user ${userId}: ${status ?? 'no entitlement change'}`);
  }

  private async handleSubscriptionDeleted(event: Stripe.Event, subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
    db.applyBillingEvent({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      occurredAt: event.created * 1000,
      userId,
      externalKey: subscription.id,
      kind: 'subscription',
      status: 'expired',
      customerId,
      currentPeriodStart: subscription.current_period_start * 1000,
      currentPeriodEnd: subscription.current_period_end * 1000,
    });

    console.log(`Subscription canceled for user ${userId}`);
  }

  private async handleLifetimeRefund(event: Stripe.Event, charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
    if (!paymentIntentId) {
      console.error('Refunded charge has no payment intent');
      return;
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    const userId = paymentIntent.metadata?.userId;
    if (!userId) {
      console.error('Refunded lifetime payment has no userId metadata');
      return;
    }

    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    db.applyBillingEvent({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      occurredAt: event.created * 1000,
      userId,
      externalKey: paymentIntentId,
      kind: 'lifetime',
      status: 'refunded',
      customerId,
    });
    console.log(`Lifetime purchase refunded for user ${userId}`);
  }
}

export const stripeService = new StripeService();
