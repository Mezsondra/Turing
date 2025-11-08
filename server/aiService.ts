import { AIProvider, AIBehavior, Language, AIProviderConfig } from './ai/baseProvider.js';
import { AIProviderFactory as ProviderFactory } from './ai/providerFactory.js';
import { adminConfigService } from './adminConfig.js';

function resolveProviderConfig(): AIProviderConfig {
  const providerType = adminConfigService.getAIProvider();
  const settings = adminConfigService.getProviderSettings(providerType);

  let fallbackApiKey: string | undefined;
  let fallbackModel: string | undefined;

  switch (providerType) {
    case 'openai':
      fallbackApiKey = process.env.OPENAI_API_KEY;
      fallbackModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      break;
    case 'xai':
      fallbackApiKey = process.env.XAI_API_KEY;
      fallbackModel = process.env.XAI_MODEL || 'grok-1.5-flash';
      break;
    case 'gemini':
    default:
      fallbackApiKey = process.env.GEMINI_API_KEY;
      fallbackModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      break;
  }

  const apiKey = settings.apiKey || fallbackApiKey;
  const model = settings.model || fallbackModel;

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${providerType}`);
  }

  return {
    provider: providerType,
    apiKey,
    model,
  };
}

function getProviderCacheKey(config: AIProviderConfig): string {
  return `${config.provider}:${config.apiKey}:${config.model ?? ''}`;
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private matchProviders: Map<string, AIProvider> = new Map();

  constructor() {}

  private getOrCreateProvider(): { provider: AIProvider; config: AIProviderConfig } {
    const config = resolveProviderConfig();
    const cacheKey = getProviderCacheKey(config);

    let provider = this.providers.get(cacheKey);
    if (!provider) {
      provider = ProviderFactory.createProvider(config);
      this.providers.set(cacheKey, provider);
      console.log(`Using AI provider: ${provider.name} (${config.model ?? 'default model'})`);
    }

    return { provider, config };
  }

  private getProviderForMatch(matchId: string): AIProvider {
    const provider = this.matchProviders.get(matchId);
    if (!provider) {
      throw new Error(`No AI provider found for match ${matchId}`);
    }
    return provider;
  }

  async createSession(matchId: string, language: Language, behavior: AIBehavior): Promise<void> {
    const { provider } = this.getOrCreateProvider();
    await provider.createSession(matchId, language, behavior);
    this.matchProviders.set(matchId, provider);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    const provider = this.getProviderForMatch(matchId);
    return await provider.sendMessage(matchId, message);
  }

  async initializeConversation(matchId: string): Promise<string> {
    const provider = this.getProviderForMatch(matchId);
    return await provider.initializeConversation(matchId);
  }

  deleteSession(matchId: string): void {
    const provider = this.matchProviders.get(matchId);
    if (provider) {
      provider.deleteSession(matchId);
      this.matchProviders.delete(matchId);
    }
  }

  hasSession(matchId: string): boolean {
    const provider = this.matchProviders.get(matchId);
    return provider ? provider.hasSession(matchId) : false;
  }

  getProviderName(): string {
    const { provider } = this.getOrCreateProvider();
    return provider.name;
  }
}

export const aiService = new AIService();
