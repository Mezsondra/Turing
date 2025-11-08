import { GoogleGenAI, Chat, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIProvider, Language } from './baseProvider.js';
import { adminConfigService } from '../adminConfig.js';

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private sessions: Map<string, Chat> = new Map();
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async createSession(matchId: string, language: Language): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Get prompt from admin config
    const systemInstruction = adminConfigService.getPrompt(language);

    const chat = ai.chats.create({
      model: this.model,
      config: {
        systemInstruction,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      },
      history: [],
    });

    this.sessions.set(matchId, chat);
  }

  async sendMessage(matchId: string, message: string): Promise<string> {
    const session = this.sessions.get(matchId);
    if (!session) {
      throw new Error(`No AI session found for match ${matchId}`);
    }

    try {
      const response = await session.sendMessage({ message });
      return response.text;
    } catch (error) {
      console.error(`Error getting Gemini response for match ${matchId}:`, error);
      throw error;
    }
  }

  async initializeConversation(matchId: string): Promise<string> {
    const session = this.sessions.get(matchId);
    if (!session) {
      throw new Error(`No AI session found for match ${matchId}`);
    }

    try {
      const response = await session.sendMessage({
        message: "Start the conversation naturally as if you just connected with someone."
      });
      return response.text;
    } catch (error) {
      console.error(`Error initializing Gemini conversation for match ${matchId}:`, error);
      throw error;
    }
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

