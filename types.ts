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

export type Language = string; // Dynamic language support
