import { AIProvider, Language } from './ai/baseProvider.js';
import { GeminiProvider } from './ai/geminiProvider.js';
import { OpenAIProvider } from './ai/openaiProvider.js';
import { adminConfigService } from './adminConfig.js';

export class AIProviderFactory {
  private static currentProvider: AIProvider | null = null;
  private static currentProviderType: string | null = null;

  static getProvider(): AIProvider {
    const providerType = adminConfigService.getAIProvider();

    // Return cached provider if type hasn't changed
    if (this.currentProvider && this.currentProviderType === providerType) {
      return this.currentProvider;
    }

    // Create new provider instance
    console.log(`Creating new AI provider: ${providerType}`);
    switch (providerType) {
      case 'openai': {
        const apiKey = adminConfigService.getOpenAIApiKey();
        const model = adminConfigService.getOpenAIModel();
        if (!apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        this.currentProvider = new OpenAIProvider(apiKey, model);
        break;
      }
      case 'xai': {
        const apiKey = adminConfigService.getXAIApiKey();
        const model = adminConfigService.getXAIModel();
        if (!apiKey) {
          throw new Error('XAI API key not configured');
        }
        // XAI uses OpenAI-compatible API
        this.currentProvider = new OpenAIProvider(apiKey, model, 'https://api.x.ai/v1');
        break;
      }
      case 'gemini':
      default: {
        const apiKey = adminConfigService.getGeminiApiKey();
        const model = adminConfigService.getGeminiModel();
        if (!apiKey) {
          throw new Error('Gemini API key not configured');
        }
        this.currentProvider = new GeminiProvider(apiKey, model);
        break;
      }
    }

    this.currentProviderType = providerType;
    console.log(`Using AI provider: ${this.currentProvider.name}`);
    return this.currentProvider;
  }

  // Force reload provider (useful when config changes)
  static reloadProvider(): void {
    this.currentProvider = null;
    this.currentProviderType = null;
  }
}

export class AIService {
  async createSession(matchId: string, language: Language): Promise<void> {
    const provider = AIProviderFactory.getProvider();
    await provider.createSession(matchId, language);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    const provider = AIProviderFactory.getProvider();
    return await provider.sendMessage(matchId, message);
  }

  async initializeConversation(matchId: string): Promise<string> {
    const provider = AIProviderFactory.getProvider();
    return await provider.initializeConversation(matchId);
  }

  deleteSession(matchId: string): void {
    const provider = AIProviderFactory.getProvider();
    provider.deleteSession(matchId);
  }

  hasSession(matchId: string): boolean {
    const provider = AIProviderFactory.getProvider();
    return provider.hasSession(matchId);
  }

  getProviderName(): string {
    const provider = AIProviderFactory.getProvider();
    return provider.name;
  }
}

export const aiService = new AIService();
