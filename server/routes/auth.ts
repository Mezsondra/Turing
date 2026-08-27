import express from 'express';
import { authService } from '../auth/authService.js';
import { db } from '../database/db.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { normaliseEmail } from '../auth/loginCode.js';
import { isGoogleConfigured } from '../auth/google.js';
import { isEmailConfigured } from '../auth/email.js';
import { hitLimit } from '../rateLimit.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, deviceId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.register({ email, password, username, deviceId });
    res.json(result);
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login({ email, password });
    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * Which sign-in methods this deployment can actually offer. The client asks
 * first so it never renders a Google button that cannot work, or an email form
 * whose codes would go nowhere.
 */
router.get('/methods', (_req, res) => {
  res.json({ google: isGoogleConfigured(), emailCode: true, emailConfigured: isEmailConfigured() });
});

// Sign in with Google. The token is verified against Google before we trust
// one byte of it - see auth/google.ts.
router.post('/google', async (req, res) => {
  try {
    if (hitLimit(`google:${req.ip}`, 20, 60 * 60_000)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    const { idToken, deviceId } = req.body;
    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ error: 'Missing Google token' });
    }

    res.json(await authService.signInWithGoogle(idToken, deviceId));
  } catch (error: any) {
    console.error('Google sign-in error:', error.message);
    res.status(401).json({ error: 'Could not sign in with Google.' });
  }
});

// Ask for a one-time code.
router.post('/email/start', async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ error: 'That does not look like an email address.' });
  }

  // Two limits, because they stop different things: per-address stops someone
  // being mail-bombed, per-IP stops one machine farming codes across many
  // addresses. Both are needed; neither covers the other.
  if (hitLimit(`code-email:${email}`, 3, 15 * 60_000) || hitLimit(`code-ip:${req.ip}`, 15, 60 * 60_000)) {
    return res.status(429).json({ error: 'Too many codes requested. Wait a few minutes.' });
  }

  try {
    await authService.startEmailLogin(email);
  } catch (error) {
    console.error('Could not send login code:', error);
    return res.status(502).json({ error: 'Could not send the code. Try again shortly.' });
  }

  // Always the same answer, whether or not that address has an account here.
  // Anything else turns this endpoint into an account-existence oracle.
  res.json({ sent: true });
});

// Redeem a code.
router.post('/email/verify', async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the six-digit code from your email.' });
  }

  if (hitLimit(`verify-ip:${req.ip}`, 30, 60 * 60_000)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  try {
    res.json(await authService.completeEmailLogin(email, code, req.body?.deviceId));
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// Verify token
router.get('/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const user = db.getUserById(userId);
    const subscription = db.getSubscriptionByUserId(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
      } : null,
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Permanent account deletion. Apple requires this to be reachable in-app once
// an app offers accounts; it is not optional.
router.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    db.deleteUser(req.userId!);
    res.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
