import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { adminConfigService } from '../adminConfig.js';
import { AIProviderFactory } from '../aiService.js';
import { db } from '../database/db.js';
import { rateLimit } from '../rateLimit.js';

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is not set. Refusing to start with an unprotected admin API.');
}

// Placeholder sent to the client instead of a real key. Anything that comes
// back with this value means "unchanged", so we keep the stored key.
const MASKED = '********';

const maskKeys = (config: any) => ({
  ...config,
  aiProviders: Object.fromEntries(
    Object.entries(config.aiProviders).map(([name, settings]: [string, any]) => [
      name,
      { ...settings, apiKey: settings.apiKey ? MASKED : '' },
    ])
  ),
});

// Drop masked keys from an incoming update so a round-trip cannot wipe them.
const stripMaskedKeys = (updates: any) => {
  if (!updates?.aiProviders) return updates;
  const providers = Object.fromEntries(
    Object.entries(updates.aiProviders).map(([name, settings]: [string, any]) => {
      if (settings?.apiKey === MASKED) {
        const { apiKey, ...rest } = settings;
        return [name, rest];
      }
      return [name, settings];
    })
  );
  return { ...updates, aiProviders: providers };
};

const requireAdmin = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Slow down password guessing against the admin API.
router.use(rateLimit(20, 60_000));

// Get current admin configuration
router.get('/config', requireAdmin, (req: Request, res: Response) => {
  try {
    const config = adminConfigService.getConfig();
    res.json({ success: true, config: maskKeys(config) });
  } catch (error) {
    console.error('Error getting admin config:', error);
    res.status(500).json({ success: false, error: 'Failed to get configuration' });
  }
});

// Update full configuration
router.put('/config', requireAdmin, (req: Request, res: Response) => {
  try {
    adminConfigService.updateConfig(stripMaskedKeys(req.body));
    AIProviderFactory.reloadProvider();
    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
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
    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ success: false, error: 'Failed to reset configuration' });
  }
});

// Language Management Endpoints

// Add a new language
router.post('/languages', requireAdmin, (req: Request, res: Response) => {
  try {
    const { languageCode, prompt, initialPrompt } = req.body;

    if (!languageCode || typeof languageCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Language code is required' });
    }

    const success = adminConfigService.addLanguage(languageCode, prompt || '', initialPrompt || '');

    if (!success) {
      return res.status(400).json({ success: false, error: 'Language already exists' });
    }

    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
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

    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
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
    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ success: false, error: 'Failed to update prompt' });
  }
});

// Update initial prompt for a specific language
router.put('/initial-prompts/:languageCode', requireAdmin, (req: Request, res: Response) => {
  try {
    const { languageCode } = req.params;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt text is required' });
    }

    adminConfigService.setInitialPrompt(languageCode, prompt);
    res.json({ success: true, config: maskKeys(adminConfigService.getConfig()) });
  } catch (error) {
    console.error('Error updating initial prompt:', error);
    res.status(500).json({ success: false, error: 'Failed to update initial prompt' });
  }
});

// Moderation queue. App stores expect abuse reports to be acted on within 24h,
// which requires somewhere to actually see them.
router.get('/reports', requireAdmin, (req: Request, res: Response) => {
  try {
    res.json({ success: true, reports: db.getOpenReports() });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ success: false, error: 'Failed to list reports' });
  }
});

router.put('/reports/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 'reviewed' && status !== 'actioned') {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    // "Actioned" is the only place a ban is issued: reviewing a report is what
    // decides one, so a separate ban flow would just be a second door to the
    // same room. 'reviewed' lifts it again, which covers a misclick - once the
    // report leaves the open queue there is no UI left to unban from.
    const report = db.getReport(req.params.id);
    const target = report?.reported_id as string | undefined;
    // Reports can name 'AI' as the offender. There is nobody to ban.
    if (target && target !== 'AI') {
      db.setUserBanned(target, status === 'actioned');
    }

    db.setReportStatus(req.params.id, status);
    res.json({ success: true, banned: status === 'actioned' && target !== 'AI' });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ success: false, error: 'Failed to update report' });
  }
});

export default router;
