import { AIProvider, AIProviderConfig } from './baseProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';

export class AIProviderFactory {
  static createProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'gemini':
        return new GeminiProvider(config.apiKey, config.model);

      case 'openai':
        return new OpenAIProvider(config.apiKey, config.model);

      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  static getProviderFromEnv(): AIProvider {
    const provider = (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'openai';

    let apiKey: string | undefined;
    let model: string | undefined;

    switch (provider) {
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        break;

      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        break;

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    if (!apiKey) {
      throw new Error(`API key not found for provider: ${provider}`);
    }

    return AIProviderFactory.createProvider({
      provider,
      apiKey,
      model,
    });
  }
}
