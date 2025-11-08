export enum GameState {
  WELCOME,
  CHATTING,
  GUESSING,
  RESULT,
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export type Language = 'en' | 'tr';

export interface ProviderCredentials {
  apiKey: string;
  model: string;
}

export interface AdminConfig {
  aiDefaultBehavior: 'HUMAN_LIKE' | 'AI_LIKE';
  humanLikeRatio: number;
  aiProvider: 'gemini' | 'openai' | 'xai';
  providers: {
    gemini: ProviderCredentials;
    openai: ProviderCredentials;
    xai: ProviderCredentials;
  };
  aiMatchProbability: number;
  matchTimeoutMs: number;
  gameDurationSeconds: number;
  prompts: {
    [scope: string]: {
      humanLike: Record<Language, string>;
      aiLike: Record<Language, string>;
    };
  };
}

export interface PublicConfig {
  gameDurationSeconds: number;
  matchTimeoutMs: number;
  aiProvider: 'gemini' | 'openai' | 'xai';
}
