import { AIProvider, AIBehavior, Language } from './ai/baseProvider.js';
import { AIProviderFactory } from './ai/providerFactory.js';

export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || AIProviderFactory.getProviderFromEnv();
    console.log(`Using AI provider: ${this.provider.name}`);
  }

  async createSession(matchId: string, language: Language, behavior: AIBehavior): Promise<void> {
    await this.provider.createSession(matchId, language, behavior);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    return await this.provider.sendMessage(matchId, message);
  }

  async initializeConversation(matchId: string): Promise<string> {
    return await this.provider.initializeConversation(matchId);
  }

  deleteSession(matchId: string): void {
    this.provider.deleteSession(matchId);
  }

  hasSession(matchId: string): boolean {
    return this.provider.hasSession(matchId);
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

export const aiService = new AIService();
