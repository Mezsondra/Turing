import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AIProviderSettings {
  apiKey: string;
  model: string;
  apiBaseUrl?: string;
}

export interface AdminConfiguration {
  // Provider Settings
  aiProvider: 'gemini' | 'openai' | 'xai';
  aiProviders: {
    gemini: AIProviderSettings;
    openai: AIProviderSettings;
    xai: AIProviderSettings;
  };

  // Matchmaking Settings
  aiMatchProbability: number; // 0-1, probability of matching with AI
  matchTimeoutMs: number;

  // Language Management
  languages: string[]; // List of available language codes

  // AI Prompts (by language code)
  prompts: {
    [languageCode: string]: string; // language code -> prompt
  };
}

export class AdminConfigService {
  private config: AdminConfiguration;
  private configPath: string;

  constructor() {
    this.configPath = path.join(__dirname, '..', 'admin-config.json');
    this.config = this.loadConfig();
  }

  private getDefaultConfig(): AdminConfiguration {
    return {
      aiProvider: (process.env.AI_PROVIDER as 'gemini' | 'openai' | 'xai') || 'gemini',
      aiProviders: {
        gemini: {
          apiKey: process.env.GEMINI_API_KEY || '',
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          apiBaseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
        },
        xai: {
          apiKey: process.env.XAI_API_KEY || '',
          model: process.env.XAI_MODEL || 'grok-1.5-flash',
          apiBaseUrl: process.env.XAI_API_BASE_URL || 'https://api.x.ai/v1',
        },
      },
      aiMatchProbability: 0.5,
      matchTimeoutMs: 10000,
      languages: ['en', 'tr'], // Default languages
      prompts: {
        en: "You are chatting with someone online. Be casual, natural, and human-like in your conversation. Use informal language, occasional typos, emojis, and conversational patterns that real people use. Don't be overly formal or robotic. Keep responses relatively short (1-3 sentences usually) unless the conversation naturally calls for more. You might use slang, abbreviations (like 'lol', 'tbh', 'idk'), and show personality. Sometimes take a moment to respond. Make occasional grammar mistakes or typos that humans make. Show emotions and opinions.",
        tr: "Biriyle çevrimiçi sohbet ediyorsun. Rahat, doğal ve insan gibi konuş. Resmi olmayan bir dil kullan, ara sıra yazım hataları yap, emoji kullan ve gerçek insanların kullandığı konuşma kalıplarını takip et. Aşırı resmi veya robotik olma. Yanıtlarını kısa tut (genellikle 1-3 cümle), sohbet doğal olarak daha fazlasını gerektirmedikçe. Argo, kısaltmalar ('yani', 'vb', 'fln') kullanabilir ve kişilik gösterebilirsin. Bazen yanıt vermek için biraz zaman al. Ara sıra insanların yaptığı dilbilgisi hataları veya yazım hataları yap. Duygu ve fikirlerini göster."
      }
    };
  }

  private loadConfig(): AdminConfiguration {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        const defaultConfig = this.getDefaultConfig();

        return {
          ...defaultConfig,
          ...loadedConfig,
          aiProviders: {
            gemini: {
              ...defaultConfig.aiProviders.gemini,
              ...(loadedConfig.aiProviders?.gemini || {}),
            },
            openai: {
              ...defaultConfig.aiProviders.openai,
              ...(loadedConfig.aiProviders?.openai || {}),
            },
            xai: {
              ...defaultConfig.aiProviders.xai,
              ...(loadedConfig.aiProviders?.xai || {}),
            },
          },
          prompts: {
            ...defaultConfig.prompts,
            ...(loadedConfig.prompts || {}),
          },
          languages: loadedConfig.languages || defaultConfig.languages,
        };
      }
    } catch (error) {
      console.error('Error loading admin config:', error);
    }

    // Return and save default config
    const defaultConfig = this.getDefaultConfig();
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  private saveConfig(config: AdminConfiguration): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('Admin configuration saved successfully');
    } catch (error) {
      console.error('Error saving admin config:', error);
    }
  }

  // Getters
  getConfig(): AdminConfiguration {
    return { ...this.config };
  }

  getAIProvider(): 'gemini' | 'openai' | 'xai' {
    return this.config.aiProvider;
  }

  getProviderSettings(provider: 'gemini' | 'openai' | 'xai'): AIProviderSettings {
    return { ...this.config.aiProviders[provider] };
  }

  getAIMatchProbability(): number {
    return this.config.aiMatchProbability;
  }

  getMatchTimeoutMs(): number {
    return this.config.matchTimeoutMs;
  }

  getLanguages(): string[] {
    return [...this.config.languages];
  }

  getPrompt(language: string): string {
    return this.config.prompts[language] || this.config.prompts['en'] || '';
  }

  getXAIApiKey(): string | undefined {
    return this.config.aiProviders.xai.apiKey || process.env.XAI_API_KEY;
  }

  getXAIModel(): string {
    return this.config.aiProviders.xai.model || process.env.XAI_MODEL || 'grok-1.5-flash';
  }

  getXAIBaseUrl(): string {
    return this.config.aiProviders.xai.apiBaseUrl || process.env.XAI_API_BASE_URL || 'https://api.x.ai/v1';
  }

  getGeminiApiKey(): string | undefined {
    return this.config.aiProviders.gemini.apiKey || process.env.GEMINI_API_KEY;
  }

  getGeminiModel(): string {
    return this.config.aiProviders.gemini.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  getOpenAIApiKey(): string | undefined {
    return this.config.aiProviders.openai.apiKey || process.env.OPENAI_API_KEY;
  }

  getOpenAIModel(): string {
    return this.config.aiProviders.openai.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  getOpenAIBaseUrl(): string {
    return this.config.aiProviders.openai.apiBaseUrl || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
  }


  // Setters
  setAIProvider(provider: 'gemini' | 'openai' | 'xai'): void {
    this.config.aiProvider = provider;
    this.saveConfig(this.config);
  }

  setAIMatchProbability(probability: number): void {
    this.config.aiMatchProbability = Math.max(0, Math.min(1, probability));
    this.saveConfig(this.config);
  }

  setMatchTimeoutMs(timeoutMs: number): void {
    this.config.matchTimeoutMs = Math.max(1000, timeoutMs);
    this.saveConfig(this.config);
  }

  setPrompt(language: string, text: string): void {
    this.config.prompts[language] = text;
    this.saveConfig(this.config);
  }

  addLanguage(languageCode: string, prompt: string = ''): boolean {
    if (this.config.languages.includes(languageCode)) {
      return false; // Language already exists
    }
    this.config.languages.push(languageCode);
    this.config.prompts[languageCode] = prompt || this.config.prompts['en'] || '';
    this.saveConfig(this.config);
    return true;
  }

  removeLanguage(languageCode: string): boolean {
    if (languageCode === 'en' || !this.config.languages.includes(languageCode)) {
      return false; // Cannot remove English or non-existent language
    }
    this.config.languages = this.config.languages.filter(lang => lang !== languageCode);
    delete this.config.prompts[languageCode];
    this.saveConfig(this.config);
    return true;
  }

  updateConfig(updates: Partial<AdminConfiguration>): void {
    const currentConfig = this.config;

    this.config = {
      ...currentConfig,
      ...updates,
      aiProviders: {
        ...currentConfig.aiProviders,
        ...(updates.aiProviders
          ? {
              gemini: {
                ...currentConfig.aiProviders.gemini,
                ...(updates.aiProviders.gemini || {}),
              },
              openai: {
                ...currentConfig.aiProviders.openai,
                ...(updates.aiProviders.openai || {}),
              },
              xai: {
                ...currentConfig.aiProviders.xai,
                ...(updates.aiProviders.xai || {}),
              },
            }
          : currentConfig.aiProviders),
      },
      prompts: {
        ...currentConfig.prompts,
        ...(updates.prompts || {}),
      },
      languages: updates.languages || currentConfig.languages,
    };
    this.saveConfig(this.config);
  }

  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig(this.config);
  }
}

export const adminConfigService = new AdminConfigService();
