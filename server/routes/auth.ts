import express from 'express';
import { authService } from '../auth/authService.js';
import { db } from '../database/db.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.register({ email, password, username });
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

export default router;
