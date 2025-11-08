import { AIBehavior } from './ai/baseProvider.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProviderConfiguration {
  apiKey: string;
  model: string;
}

export interface AdminConfiguration {
  // AI Behavior Settings
  aiDefaultBehavior: AIBehavior;
  humanLikeRatio: number; // 0-1, probability of using HUMAN_LIKE behavior

  // Provider Settings
  aiProvider: 'gemini' | 'openai' | 'xai';
  providers: {
    gemini: ProviderConfiguration;
    openai: ProviderConfiguration;
    xai: ProviderConfiguration;
  };

  // Matchmaking Settings
  aiMatchProbability: number; // 0-1, probability of matching with AI
  matchTimeoutMs: number;

  // Game Settings
  gameDurationSeconds: number;

  // AI Prompts (by language)
  prompts: {
    [language: string]: {
      humanLike: {
        en: string;
        tr: string;
      };
      aiLike: {
        en: string;
        tr: string;
      };
    };
  };
}

export class AdminConfigService {
  private config: AdminConfiguration;
  private configPath: string;

  constructor() {
    this.configPath = path.join(__dirname, '..', 'admin-config.json');
    this.config = this.loadConfig();
  }

  private mergeConfigs<T extends Record<string, any>>(base: T, updates: Partial<T>): T {
    const result: Record<string, any> = Array.isArray(base) ? [...base] : { ...base };

    if (!updates) {
      return result as T;
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null) {
        result[key] = value;
        continue;
      }

      const existing = (base as Record<string, any>)[key];

      if (typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(
          typeof existing === 'object' && existing ? existing : {},
          value as Record<string, any>
        );
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  private getDefaultConfig(): AdminConfiguration {
    const defaultGeminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const defaultOpenAIModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const defaultXAIModel = process.env.XAI_MODEL || 'grok-1.5-flash';

    return {
      aiDefaultBehavior: 'HUMAN_LIKE',
      humanLikeRatio: 1.0, // Always use HUMAN_LIKE by default
      aiProvider: (process.env.AI_PROVIDER as 'gemini' | 'openai' | 'xai') || 'gemini',
      providers: {
        gemini: {
          apiKey: process.env.GEMINI_API_KEY || '',
          model: defaultGeminiModel,
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: defaultOpenAIModel,
        },
        xai: {
          apiKey: process.env.XAI_API_KEY || '',
          model: defaultXAIModel,
        },
      },
      aiMatchProbability: 0.5,
      matchTimeoutMs: 10000,
      gameDurationSeconds: 60,
      prompts: {
        global: {
          humanLike: {
            en: "You are chatting with someone online. Be casual, natural, and human-like in your conversation. Use informal language, occasional typos, emojis, and conversational patterns that real people use. Don't be overly formal or robotic. Keep responses relatively short (1-3 sentences usually) unless the conversation naturally calls for more. You might use slang, abbreviations (like 'lol', 'tbh', 'idk'), and show personality. Sometimes take a moment to respond. Make occasional grammar mistakes or typos that humans make. Show emotions and opinions.",
            tr: "Biriyle çevrimiçi sohbet ediyorsun. Rahat, doğal ve insan gibi konuş. Resmi olmayan bir dil kullan, ara sıra yazım hataları yap, emoji kullan ve gerçek insanların kullandığı konuşma kalıplarını takip et. Aşırı resmi veya robotik olma. Yanıtlarını kısa tut (genellikle 1-3 cümle), sohbet doğal olarak daha fazlasını gerektirmedikçe. Argo, kısaltmalar ('yani', 'vb', 'fln') kullanabilir ve kişilik gösterebilirsin. Bazen yanıt vermek için biraz zaman al. Ara sıra insanların yaptığı dilbilgisi hataları veya yazım hataları yap. Duygu ve fikirlerini göster."
          },
          aiLike: {
            en: "You are a helpful AI assistant. Provide clear, accurate, and well-structured responses. Use proper grammar and formatting. Be polite, professional, and informative. Acknowledge that you are an AI when relevant.",
            tr: "Sen yardımcı bir yapay zeka asistanısın. Açık, doğru ve iyi yapılandırılmış yanıtlar ver. Doğru dilbilgisi ve biçimlendirme kullan. Kibar, profesyonel ve bilgilendirici ol. Uygun olduğunda bir yapay zeka olduğunu kabul et."
          }
        }
      }
    };
  }

  private loadConfig(): AdminConfiguration {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        // Merge with defaults to ensure all fields exist
        return this.mergeConfigs(this.getDefaultConfig(), loadedConfig);
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
    return JSON.parse(JSON.stringify(this.config));
  }

  getPublicConfig(): Pick<AdminConfiguration, 'gameDurationSeconds' | 'matchTimeoutMs' | 'aiProvider'> {
    const { gameDurationSeconds, matchTimeoutMs, aiProvider } = this.config;
    return { gameDurationSeconds, matchTimeoutMs, aiProvider };
  }

  getAIBehavior(): AIBehavior {
    // Use ratio to determine behavior
    const random = Math.random();
    return random < this.config.humanLikeRatio ? 'HUMAN_LIKE' : 'AI_LIKE';
  }

  getAIProvider(): 'gemini' | 'openai' | 'xai' {
    return this.config.aiProvider;
  }

  getAIMatchProbability(): number {
    return this.config.aiMatchProbability;
  }

  getMatchTimeoutMs(): number {
    return this.config.matchTimeoutMs;
  }

  getGameDurationSeconds(): number {
    return this.config.gameDurationSeconds;
  }

  getProviderSettings(provider: 'gemini' | 'openai' | 'xai'): ProviderConfiguration {
    return { ...this.config.providers[provider] };
  }

  getPrompt(language: string, behavior: AIBehavior): string {
    const lang = language as 'en' | 'tr';
    if (behavior === 'HUMAN_LIKE') {
      return this.config.prompts.global.humanLike[lang];
    } else {
      return this.config.prompts.global.aiLike[lang];
    }
  }

  // Setters
  setAIDefaultBehavior(behavior: AIBehavior): void {
    this.config.aiDefaultBehavior = behavior;
    this.saveConfig(this.config);
  }

  setHumanLikeRatio(ratio: number): void {
    this.config.humanLikeRatio = Math.max(0, Math.min(1, ratio));
    this.saveConfig(this.config);
  }

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

  setGameDurationSeconds(durationSeconds: number): void {
    const clamped = Math.max(30, Math.min(300, durationSeconds));
    this.config.gameDurationSeconds = clamped;
    this.saveConfig(this.config);
  }

  setPrompt(language: string, behavior: AIBehavior, text: string): void {
    const lang = language as 'en' | 'tr';
    if (behavior === 'HUMAN_LIKE') {
      this.config.prompts.global.humanLike[lang] = text;
    } else {
      this.config.prompts.global.aiLike[lang] = text;
    }
    this.saveConfig(this.config);
  }

  updateConfig(updates: Partial<AdminConfiguration>): void {
    this.config = this.mergeConfigs(this.config, updates);

    if (updates.gameDurationSeconds !== undefined) {
      this.setGameDurationSeconds(updates.gameDurationSeconds);
      return;
    }

    this.saveConfig(this.config);
  }

  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig(this.config);
  }
}

export const adminConfigService = new AdminConfigService();
