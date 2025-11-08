import { Router } from 'express';
import { adminConfigService } from '../adminConfig.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const config = adminConfigService.getPublicConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting public config:', error);
    res.status(500).json({ success: false, error: 'Failed to load configuration' });
  }
});

export default router;
