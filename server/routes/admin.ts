import { Router, Request, Response } from 'express';
import { adminConfigService } from '../adminConfig.js';

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
    res.json({ success: true, config: adminConfigService.getConfig() });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ success: false, error: 'Failed to reset configuration' });
  }
});

export default router;
