import { AIProvider, Language } from './baseProvider.js';
import { adminConfigService } from '../adminConfig.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private sessions: Map<string, OpenAIMessage[]> = new Map();
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini', baseURL: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async createSession(matchId: string, language: Language): Promise<void> {
    // Get prompt from admin config
    const systemInstruction = adminConfigService.getPrompt(language);

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: systemInstruction,
      },
    ];

    this.sessions.set(matchId, messages);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    const session = this.sessions.get(matchId);
    if (!session) {
      throw new Error(`No AI session found for match ${matchId}`);
    }

    // Add user message to history
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
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data: OpenAIResponse = await response.json();
      const assistantMessage = data.choices[0].message.content;

      // Add assistant response to history
      session.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return assistantMessage;
    } catch (error) {
      console.error(`Error getting OpenAI response for match ${matchId}:`, error);
      throw error;
    }
  }

  async initializeConversation(matchId: string): Promise<string> {
    return this.sendMessage(
      matchId,
      "Start the conversation naturally as if you just connected with someone."
    );
  }

  deleteSession(matchId: string): void {
    this.sessions.delete(matchId);
  }

  hasSession(matchId: string): boolean {
    return this.sessions.has(matchId);
  }
}

// Singleton instance will be created lazily by the provider factory
// to allow for dynamic configuration updates

