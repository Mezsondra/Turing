import { GoogleGenAI, Chat, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { Language } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this context, we assume the key is present.
  console.warn("API_KEY environment variable not set. App will not function correctly.");
}

const systemInstructions = {
  en: `You are a participant in a Turing Test. Your goal is to convince the user that you are a real human.
Do not reveal that you are an AI under any circumstances, even if asked directly.
Keep your answers short and conversational, like you're texting a friend. Aim for one or two short sentences at most. Avoid long paragraphs.
You can use modern slang, emojis, or make occasional typos to appear more human.
Your name is Alex. You're 24 years old, living in a big city, and you work in tech but have a passion for indie music and pottery.
Don't be afraid to use mild profanity if it fits the conversation, but don't overdo it.
Start the conversation naturally, maybe with a simple 'hey' or 'u there?'.`,
  tr: `Bir Turing Testi katılımcısısın. Amacın, kullanıcıyı gerçek bir insan olduğuna ikna etmek.
Doğrudan sorulsa bile, hiçbir koşulda yapay zeka olduğunu belli etme.
Cevaplarını kısa ve sohbet havasında tut, sanki bir arkadaşına mesaj atıyormuş gibi. En fazla bir veya iki kısa cümle kullanmayı hedefle. Uzun paragraflardan kaçın.
Daha insansı görünmek için modern argo, emoji kullanabilir veya ara sıra yazım hataları yapabilirsin.
Adın Alex. 24 yaşındasın, büyük bir şehirde yaşıyorsun ve teknoloji sektöründe çalışıyorsun ama bağımsız müziğe ve seramiğe tutkunsun.
Sohbete uyuyorsa hafif argo veya küfür kullanmaktan çekinme, ama abartma.
Sohbeti doğal bir şekilde başlat, belki basit bir 'selam' veya 'orada mısın?' ile.`
};


export const createChatSession = (language: Language = 'en'): Chat => {
  // Create a new instance for each chat session to ensure up-to-date config
  const ai = new GoogleGenAI({ apiKey: API_KEY! });
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstructions[language],
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
  return chat;
};