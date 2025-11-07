export type Language = 'en' | 'tr';
export type AIBehavior = 'HUMAN_LIKE' | 'AI_LIKE';

export interface AIProvider {
  name: string;
  createSession(matchId: string, language: Language, behavior: AIBehavior): Promise<void>;
  sendMessage(matchId: string, message: string): Promise<string>;
  initializeConversation(matchId: string): Promise<string>;
  deleteSession(matchId: string): void;
  hasSession(matchId: string): boolean;
}

export interface AIProviderConfig {
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}
