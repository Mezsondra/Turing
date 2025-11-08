import { BaseProvider, AIBehavior } from './baseProvider.ts';
import { adminConfigService } from '../adminConfig.js';

class XAIProvider extends BaseProvider {
  private readonly API_URL = 'https://api.x.ai/v1/chat/completions';

  constructor() {
    super();
  }

  protected async getApiKey(): Promise<string> {
    const apiKey = adminConfigService.getXAIApiKey();
    if (!apiKey) {
      throw new Error('XAI API key not configured');
    }
    return apiKey;
  }

  protected getApiUrl(): string {
    return this.API_URL;
  }

  protected getModel(): string {
    return adminConfigService.getXAIModel();
  }
}

export const xaiProvider = new XAIProvider();
