import express from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user stats
router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const stats = db.getUserStats(userId);
    const totalGames = db.getTotalGameCount(userId);

    res.json({
      stats: {
        total: stats.total,
        correct: stats.correct,
        accuracy: Math.round(stats.accuracy * 10) / 10,
        totalGames,
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Create game session
router.post('/session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { partnerType } = req.body;

    if (!partnerType || !['HUMAN', 'AI'].includes(partnerType)) {
      return res.status(400).json({ error: 'Invalid partner type' });
    }

    const sessionId = uuidv4();
    const session = db.createGameSession({
      id: sessionId,
      user_id: userId,
      partner_type: partnerType,
    });

    res.json({ session });
  } catch (error) {
    console.error('Error creating game session:', error);
    res.status(500).json({ error: 'Failed to create game session' });
  }
});

// Update game session with guess
router.put('/session/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;
    const { guess, wasCorrect } = req.body;

    if (!guess || !['HUMAN', 'AI'].includes(guess)) {
      return res.status(400).json({ error: 'Invalid guess' });
    }

    if (typeof wasCorrect !== 'boolean') {
      return res.status(400).json({ error: 'wasCorrect must be a boolean' });
    }

    db.updateGameSession(sessionId, guess, wasCorrect);

    // Get updated stats
    const totalGames = db.getTotalGameCount(userId);
    const shouldShowAd = totalGames % 5 === 0 && totalGames > 0;

    res.json({ success: true, shouldShowAd });
  } catch (error) {
    console.error('Error updating game session:', error);
    res.status(500).json({ error: 'Failed to update game session' });
  }
});

// Check if should show ad
router.get('/should-show-ad', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const totalGames = db.getTotalGameCount(userId);
    const subscription = db.getSubscriptionByUserId(userId);

    const isPremium = subscription?.plan === 'premium' && subscription?.status === 'active';
    const shouldShowAd = !isPremium && totalGames % 5 === 0 && totalGames > 0;

    res.json({ shouldShowAd, totalGames, isPremium });
  } catch (error) {
    console.error('Error checking ad status:', error);
    res.status(500).json({ error: 'Failed to check ad status' });
  }
});

export default router;
