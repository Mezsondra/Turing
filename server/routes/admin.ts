import { Router, Request, Response } from 'express';
import { adminConfigService } from '../adminConfig.js';
import { AIProviderFactory } from '../aiService.js';

const router = Router();

// Simple admin authentication middleware
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
    AIProviderFactory.reloadProvider();
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error updating admin config:', error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

// Reset to default configuration
router.post('/reset', requireAdmin, (req: Request, res: Response) => {
  try {
    adminConfigService.resetToDefaults();
    AIProviderFactory.reloadProvider();
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ success: false, error: 'Failed to reset configuration' });
  }
});

// Language Management Endpoints

// Add a new language
router.post('/languages', requireAdmin, (req: Request, res: Response) => {
  try {
    const { languageCode, prompt } = req.body;

    if (!languageCode || typeof languageCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Language code is required' });
    }

    const success = adminConfigService.addLanguage(languageCode, prompt || '');

    if (!success) {
      return res.status(400).json({ success: false, error: 'Language already exists' });
    }

    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error adding language:', error);
    res.status(500).json({ success: false, error: 'Failed to add language' });
  }
});

// Remove a language
router.delete('/languages/:languageCode', requireAdmin, (req: Request, res: Response) => {
  try {
    const { languageCode } = req.params;

    const success = adminConfigService.removeLanguage(languageCode);

    if (!success) {
      return res.status(400).json({ success: false, error: 'Cannot remove this language (it may be English or non-existent)' });
    }

    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error removing language:', error);
    res.status(500).json({ success: false, error: 'Failed to remove language' });
  }
});

// Update prompt for a specific language
router.put('/prompts/:languageCode', requireAdmin, (req: Request, res: Response) => {
  try {
    const { languageCode } = req.params;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt text is required' });
    }

    adminConfigService.setPrompt(languageCode, prompt);
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ success: false, error: 'Failed to update prompt' });
  }
});

export default router;
