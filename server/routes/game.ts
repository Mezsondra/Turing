import express from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user stats
router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const user = db.getUserById(userId);
    const totalGames = user?.games_played ?? 0;
    const correctGames = user?.games_won ?? 0;
    const accuracy = totalGames > 0 ? (correctGames / totalGames) * 100 : 0;

    res.json({
      stats: {
        total: totalGames,
        correct: correctGames,
        accuracy: Math.round(accuracy * 10) / 10,
        totalGames,
        score: user?.score || 0,
        gamesPlayed: user?.games_played || 0,
        gamesWon: user?.games_won || 0,
        gamesLost: user?.games_lost || 0,
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

// Update game session with guess.
//
// Scoring is NOT done here. The server decides whether a guess was correct in
// the socket 'submit-guess' handler, where it can see the real partner type.
// This endpoint would otherwise let any client set its own score.
router.put('/session/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    const session = db.getGameSession(sessionId);
    if (!session || session.user_id !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const user = db.getUserById(userId);
    const totalGames = user?.games_played ?? 0;

    res.json({
      success: true,
      shouldShowAd: totalGames % 5 === 0 && totalGames > 0,
      score: user?.score || 0,
      gamesPlayed: user?.games_played || 0,
      gamesWon: user?.games_won || 0,
      gamesLost: user?.games_lost || 0,
    });
  } catch (error) {
    console.error('Error reading game session:', error);
    res.status(500).json({ error: 'Failed to read game session' });
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
