import { Router, Request, Response } from 'express';
import { adminConfigService } from '../adminConfig.js';
import { AIBehavior } from '../ai/baseProvider.js';

const router = Router();

// Simple admin authentication middleware
// In production, replace this with proper authentication
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Get current admin configuration
router.get('/config', requireAdmin, (req: Request, res: Response) => {
  try {
    const config = adminConfigService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting admin config:', error);
    res.status(500).json({ success: false, error: 'Failed to get configuration' });
  }
});

// Update full configuration
router.put('/config', requireAdmin, (req: Request, res: Response) => {
  try {
    const updates = req.body;
    adminConfigService.updateConfig(updates);
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error updating admin config:', error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

// Get AI behavior settings
router.get('/ai-behavior', requireAdmin, (req: Request, res: Response) => {
  try {
    const config = adminConfigService.getConfig();
    res.json({
      success: true,
      defaultBehavior: config.aiDefaultBehavior,
      humanLikeRatio: config.humanLikeRatio,
    });
  } catch (error) {
    console.error('Error getting AI behavior:', error);
    res.status(500).json({ success: false, error: 'Failed to get AI behavior settings' });
  }
});

// Update AI behavior ratio
router.post('/ai-behavior', requireAdmin, (req: Request, res: Response) => {
  try {
    const { humanLikeRatio, defaultBehavior } = req.body;

    if (humanLikeRatio !== undefined) {
      adminConfigService.setHumanLikeRatio(humanLikeRatio);
    }

    if (defaultBehavior) {
      adminConfigService.setAIDefaultBehavior(defaultBehavior as AIBehavior);
    }

    res.json({
      success: true,
      config: {
        defaultBehavior: adminConfigService.getConfig().aiDefaultBehavior,
        humanLikeRatio: adminConfigService.getConfig().humanLikeRatio,
      },
    });
  } catch (error) {
    console.error('Error updating AI behavior:', error);
    res.status(500).json({ success: false, error: 'Failed to update AI behavior' });
  }
});

// Get AI provider
router.get('/provider', requireAdmin, (req: Request, res: Response) => {
  try {
    const provider = adminConfigService.getAIProvider();
    res.json({ success: true, provider });
  } catch (error) {
    console.error('Error getting AI provider:', error);
    res.status(500).json({ success: false, error: 'Failed to get AI provider' });
  }
});

// Update AI provider
router.post('/provider', requireAdmin, (req: Request, res: Response) => {
  try {
    const { provider } = req.body;

    if (!provider || (provider !== 'gemini' && provider !== 'openai')) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }

    adminConfigService.setAIProvider(provider);
    res.json({ success: true, provider });
  } catch (error) {
    console.error('Error updating AI provider:', error);
    res.status(500).json({ success: false, error: 'Failed to update AI provider' });
  }
});

// Get AI prompts
router.get('/prompts/:language', requireAdmin, (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const config = adminConfigService.getConfig();

    if (!config.prompts.global) {
      return res.status(404).json({ success: false, error: 'Prompts not found' });
    }

    res.json({
      success: true,
      prompts: {
        humanLike: config.prompts.global.humanLike,
        aiLike: config.prompts.global.aiLike,
      },
    });
  } catch (error) {
    console.error('Error getting prompts:', error);
    res.status(500).json({ success: false, error: 'Failed to get prompts' });
  }
});

// Update AI prompt
router.put('/prompts/:language/:behavior', requireAdmin, (req: Request, res: Response) => {
  try {
    const { language, behavior } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid prompt text' });
    }

    if (behavior !== 'HUMAN_LIKE' && behavior !== 'AI_LIKE') {
      return res.status(400).json({ success: false, error: 'Invalid behavior type' });
    }

    adminConfigService.setPrompt(language, behavior as AIBehavior, text);
    res.json({ success: true, message: 'Prompt updated successfully' });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ success: false, error: 'Failed to update prompt' });
  }
});

// Get matchmaking settings
router.get('/matchmaking', requireAdmin, (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      aiMatchProbability: adminConfigService.getAIMatchProbability(),
      matchTimeoutMs: adminConfigService.getMatchTimeoutMs(),
    });
  } catch (error) {
    console.error('Error getting matchmaking settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get matchmaking settings' });
  }
});

// Update matchmaking settings
router.post('/matchmaking', requireAdmin, (req: Request, res: Response) => {
  try {
    const { aiMatchProbability, matchTimeoutMs } = req.body;

    if (aiMatchProbability !== undefined) {
      adminConfigService.setAIMatchProbability(aiMatchProbability);
    }

    if (matchTimeoutMs !== undefined) {
      adminConfigService.setMatchTimeoutMs(matchTimeoutMs);
    }

    res.json({
      success: true,
      config: {
        aiMatchProbability: adminConfigService.getAIMatchProbability(),
        matchTimeoutMs: adminConfigService.getMatchTimeoutMs(),
      },
    });
  } catch (error) {
    console.error('Error updating matchmaking settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update matchmaking settings' });
  }
});

// Reset to default configuration
router.post('/reset', requireAdmin, (req: Request, res: Response) => {
  try {
    adminConfigService.resetToDefaults();
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ success: false, error: 'Failed to reset configuration' });
  }
});

export default router;
