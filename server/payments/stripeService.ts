import Stripe from 'stripe';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

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

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not set. Payment features will not work.');
    }
    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
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
      const subscription = db.getSubscriptionByUserId(userId);
      let customerId = subscription?.stripe_customer_id;

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
        ...(plan === 'lifetime' ? {} : { subscription_data: { metadata: { userId, plan } } }),
      });

      return session.url!;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  async createPortalSession(userId: string): Promise<string> {
    try {
      const subscription = db.getSubscriptionByUserId(userId);
      if (!subscription?.stripe_customer_id) {
        throw new Error('No Stripe customer found');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${process.env.CLIENT_URL}/settings`,
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
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('No userId in session metadata');
      return;
    }

    const customerId = session.customer as string;
    const subscriptionId = (session.subscription as string) || undefined;

    // A lifetime unlock is a one-off payment: there is no subscription to read,
    // and no period end, which is what makes it never expire.
    let periodStart: number | undefined;
    let periodEnd: number | undefined;

    if (subscriptionId) {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      periodStart = stripeSubscription.current_period_start * 1000;
      periodEnd = stripeSubscription.current_period_end * 1000;
    }

    const fields = {
      status: 'active' as const,
      plan: 'premium' as const,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    };

    const existingSubscription = db.getSubscriptionByUserId(userId);
    if (existingSubscription) {
      db.updateSubscription(existingSubscription.id, fields);
    } else {
      db.createSubscription({ id: uuidv4(), user_id: userId, ...fields });
    }

    console.log(`Premium (${session.metadata?.plan ?? 'unknown'}) activated for user ${userId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const existingSubscription = db.getSubscriptionByUserId(userId);
    if (!existingSubscription) {
      console.error(`No subscription found for user ${userId}`);
      return;
    }

    const status = subscription.status === 'active' ? 'active' : subscription.status === 'trialing' ? 'trialing' : 'canceled';

    db.updateSubscription(existingSubscription.id, {
      status,
      current_period_start: subscription.current_period_start * 1000,
      current_period_end: subscription.current_period_end * 1000,
    });

    console.log(`Subscription updated for user ${userId}: ${status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const existingSubscription = db.getSubscriptionByUserId(userId);
    if (!existingSubscription) {
      console.error(`No subscription found for user ${userId}`);
      return;
    }

    // Never revoke a lifetime unlock: it has no stripe subscription attached,
    // so a cancellation event for some other subscription must not touch it.
    if (!existingSubscription.stripe_subscription_id) {
      console.log(`Ignoring cancellation for user ${userId}: lifetime unlock`);
      return;
    }

    db.updateSubscription(existingSubscription.id, {
      status: 'expired',
      plan: 'free',
    });

    console.log(`Subscription canceled for user ${userId}`);
  }
}

export const stripeService = new StripeService();
