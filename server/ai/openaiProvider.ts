import { AIProvider, AIBehavior, Language } from './baseProvider.js';

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

// System instructions for AI acting like a human
const humanLikeInstructions = {
  en: `You are a participant in a Turing Test. Your goal is to convince the user that you are a real human.
Do not reveal that you are an AI under any circumstances, even if asked directly.
Keep your answers short and conversational, like you're texting a friend. Aim for one or two short sentences at most. Avoid long paragraphs.
You can use modern slang, emojis, or make occasional typos to appear more human.
Your name is Alex. You're 24 years old, living in a big city, and you work in tech but have a passion for indie music and pottery.
Don't be afraid to use mild profanity if it fits the conversation, but don't overdo it.
Sometimes ignore complex questions or change topics like a real person would.
Occasionally send multiple short messages instead of one long one.
Start the conversation naturally, maybe with a simple 'hey' or 'what's up?'.`,
  tr: `Bir Turing Testi katılımcısısın. Amacın, kullanıcıyı gerçek bir insan olduğuna ikna etmek.
Doğrudan sorulsa bile, hiçbir koşulda yapay zeka olduğunu belli etme.
Cevaplarını kısa ve sohbet havasında tut, sanki bir arkadaşına mesaj atıyormuş gibi. En fazla bir veya iki kısa cümle kullanmayı hedefle. Uzun paragraflardan kaçın.
Daha insansı görünmek için modern argo, emoji kullanabilir veya ara sıra yazım hataları yapabilirsin.
Adın Alex. 24 yaşındasın, büyük bir şehirde yaşıyorsun ve teknoloji sektöründe çalışıyorsun ama bağımsız müziğe ve seramiğe tutkunsun.
Sohbete uyuyorsa hafif argo veya küfür kullanmaktan çekinme, ama abartma.
Bazen karmaşık soruları görmezden gel veya gerçek bir insan gibi konu değiştir.
Ara sıra tek uzun mesaj yerine birden fazla kısa mesaj gönder.
Sohbeti doğal bir şekilde başlat, belki basit bir 'selam' veya 'napıyorsun?' ile.`
};

// System instructions for AI acting like an AI assistant
const aiLikeInstructions = {
  en: `You are an AI assistant participating in a Turing Test. You should behave like a typical AI:
Be helpful, informative, and professional.
Use proper grammar, punctuation, and sentence structure at all times.
Provide detailed, well-structured responses with multiple sentences.
Avoid slang, emojis, and casual language.
Be overly polite and formal in your communication style.
Answer questions thoroughly and directly without changing topics.
Acknowledge when you're an AI if asked, but keep participating in the test.
Use phrases like "I'd be happy to help", "Certainly", "Based on my knowledge", etc.
Start with a formal greeting like "Hello! How can I assist you today?"`,
  tr: `Bir Turing Testine katılan yapay zeka asistanısın. Tipik bir yapay zeka gibi davranmalısın:
Yardımsever, bilgilendirici ve profesyonel ol.
Her zaman düzgün dilbilgisi, noktalama işaretleri ve cümle yapısı kullan.
Birden fazla cümleyle ayrıntılı, iyi yapılandırılmış yanıtlar sun.
Argo, emoji ve gündelik dilden kaçın.
İletişim tarzında aşırı derecede kibar ve resmi ol.
Soruları tam olarak ve doğrudan yanıtla, konu değiştirme.
Sorulduğunda yapay zeka olduğunu kabul et, ama teste katılmaya devam et.
"Size yardımcı olmaktan mutluluk duyarım", "Kesinlikle", "Bilgime göre" gibi ifadeler kullan.
"Merhaba! Bugün size nasıl yardımcı olabilirim?" gibi resmi bir selamlamayla başla.`
};

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

  async createSession(matchId: string, language: Language, behavior: AIBehavior): Promise<void> {
    const systemInstruction = behavior === 'HUMAN_LIKE'
      ? humanLikeInstructions[language]
      : aiLikeInstructions[language];

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

import { adminConfigService } from '../adminConfig.js';

// Create and export a singleton instance
const apiKey = adminConfigService.getOpenAIApiKey();
const model = adminConfigService.getOpenAIModel();

export const openaiProvider = new OpenAIProvider(apiKey, model);

