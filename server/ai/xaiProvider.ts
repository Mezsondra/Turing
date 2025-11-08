import { AIProvider, AIBehavior, Language } from './baseProvider.js';
import { adminConfigService } from '../adminConfig.js';

interface XAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface XAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class XAIProvider implements AIProvider {
  public readonly name = 'xai';
  private sessions: Map<string, XAIMessage[]> = new Map();
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(apiKey: string, model: string = 'grok-1.5-flash', baseURL: string = 'https://api.x.ai/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async createSession(matchId: string, language: Language, behavior: AIBehavior): Promise<void> {
    const systemPrompt = adminConfigService.getPrompt(language, behavior);
    const messages: XAIMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    this.sessions.set(matchId, messages);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    const session = this.sessions.get(matchId);
    if (!session) {
      throw new Error(`No AI session found for match ${matchId}`);
    }

    session.push({
      role: 'user',
      content: message,
    });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: session,
          temperature: 0.9,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`XAI API error: ${response.status} - ${error}`);
      }

      const data: XAIResponse = await response.json();
      const assistantMessage = data.choices[0]?.message?.content || '';

      session.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return assistantMessage;
    } catch (error) {
      console.error(`Error getting XAI response for match ${matchId}:`, error);
      throw error;
    }
  }

  async initializeConversation(matchId: string): Promise<string> {
    return this.sendMessage(
      matchId,
      'Start the conversation naturally as if you just connected with someone.'
    );
  }

  deleteSession(matchId: string): void {
    this.sessions.delete(matchId);
  }

  hasSession(matchId: string): boolean {
    return this.sessions.has(matchId);
  }
}
