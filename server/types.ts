export interface User {
  id: string;
  /** Database user id (guest or registered). Survives reconnects; `id` does not. */
  playerId: string;
  socketId: string;
  language: string; // dynamic: admin can add languages
  joinedAt: number;
}

export interface Match {
  id: string;
  user1: User;
  user2: User | null; // null if matched with AI
  isAiMatch: boolean;
  actualPartnerType: 'HUMAN' | 'AI'; // What the partner truly is
  createdAt: number;
}

export interface ChatMessage {
  text: string;
  fromUserId: string;
}

export interface TypingStatus {
  isTyping: boolean;
  fromUserId: string;
}
