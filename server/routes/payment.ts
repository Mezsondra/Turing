import express from 'express';
import { stripeService } from '../payments/stripeService.js';
import { db } from '../database/db.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get subscription details
router.get('/subscription', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const subscription = db.getSubscriptionByUserId(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
      },
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create checkout session for premium upgrade
router.post('/create-checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const user = req.user!;

    const url = await stripeService.createCheckoutSession(userId, user.email);
    res.json({ url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create portal session for managing subscription
router.post('/create-portal', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const url = await stripeService.createPortalSession(userId);
    res.json({ url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  try {
    await stripeService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error}`);
  }
});

export default router;
