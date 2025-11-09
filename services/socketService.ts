import { io, Socket } from 'socket.io-client';

type Language = 'en' | 'tr';

interface MatchedEvent {
  matchId: string;
  partnerType: 'unknown';
  roundDurationSeconds?: number;
}

interface MessageEvent {
  text: string;
  fromAI: boolean;
}

interface RevealPartnerEvent {
  actualPartnerType: 'HUMAN' | 'AI';
  matchId: string;
}

interface GuessResultEvent {
  wasCorrect: boolean;
  score: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  error?: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private pendingGuessResultHandlers: Array<(data: GuessResultEvent) => void> = [];

  constructor() {
    this.serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket?.id);

        // Register any guess result handlers that were added before connection
        this.pendingGuessResultHandlers.forEach((handler) => {
          this.socket?.on('guess-result', handler);
        });
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinQueue(language: Language): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    console.log('Joining queue with language:', language);
    this.socket.emit('join-queue', { language });
  }

  sendMessage(text: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('send-message', { text });
  }

  sendTyping(isTyping: boolean): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('typing', { isTyping });
  }

  notifyTimeUp(): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('time-up');
  }

  submitGuess(matchId: string, guess: 'HUMAN' | 'AI'): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('submit-guess', { matchId, guess });
  }

  onSearching(callback: () => void): void {
    if (!this.socket) return;
    this.socket.on('searching', callback);
  }

  onMatched(callback: (data: MatchedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('matched', callback);
  }

  onMessage(callback: (data: MessageEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('message', callback);
  }

  onPartnerTyping(callback: (data: { isTyping: boolean }) => void): void {
    if (!this.socket) return;
    this.socket.on('partner-typing', callback);
  }

  onRevealPartner(callback: (data: RevealPartnerEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('reveal-partner', callback);
  }

  onPartnerDisconnected(callback: () => void): void {
    if (!this.socket) return;
    this.socket.on('partner-disconnected', callback);
  }

  onError(callback: (data: { message: string }) => void): void {
    if (!this.socket) return;
    this.socket.on('error', callback);
  }

  onGuessResult(callback: (data: GuessResultEvent) => void): () => void {
    if (this.socket) {
      this.socket.on('guess-result', callback);
    } else {
      this.pendingGuessResultHandlers.push(callback);
    }

    return () => {
      if (this.socket) {
        this.socket.off('guess-result', callback);
      }
      this.pendingGuessResultHandlers = this.pendingGuessResultHandlers.filter(
        (handler) => handler !== callback
      );
    };
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
