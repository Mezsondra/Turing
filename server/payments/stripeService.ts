import Stripe from 'stripe';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Premium plan pricing
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || '';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not set. Payment features will not work.');
    }
    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createCheckoutSession(userId: string, email: string): Promise<string> {
    try {
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

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: PREMIUM_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/premium/cancel`,
        metadata: {
          userId,
        },
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

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    // Retrieve subscription details
    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    // Update or create subscription in database
    const existingSubscription = db.getSubscriptionByUserId(userId);

    if (existingSubscription) {
      db.updateSubscription(existingSubscription.id, {
        status: 'active',
        plan: 'premium',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        current_period_start: stripeSubscription.current_period_start * 1000,
        current_period_end: stripeSubscription.current_period_end * 1000,
      });
    } else {
      db.createSubscription({
        id: uuidv4(),
        user_id: userId,
        status: 'active',
        plan: 'premium',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        current_period_start: stripeSubscription.current_period_start * 1000,
        current_period_end: stripeSubscription.current_period_end * 1000,
      });
    }

    console.log(`Premium subscription activated for user ${userId}`);
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

    db.updateSubscription(existingSubscription.id, {
      status: 'expired',
      plan: 'free',
    });

    console.log(`Subscription canceled for user ${userId}`);
  }
}

export const stripeService = new StripeService();
