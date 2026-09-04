import { io, Socket } from 'socket.io-client';
import { API_URL } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';

type Language = string; // admin can add languages at runtime

interface MatchedEvent {
  matchId: string;
  partnerType: 'unknown';
  roundDurationSeconds?: number;
  /** Server-authoritative round end time (epoch ms). */
  roundEndsAt: number;
}

export interface StatsEvent {
  /** Server-side identity, used to tag a rewarded ad for SSV. */
  playerId: string;
  /** Free rounds remaining for good; null means unlimited (premium). */
  roundsLeft: number | null;
  score: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  currentStreak: number;
  bestStreak: number;
  timesFooled: number;
}

interface MessageEvent {
  text: string;
  fromAI: boolean;
}

interface RevealPartnerEvent {
  actualPartnerType: 'HUMAN' | 'AI';
  matchId: string;
}

interface GuessResultEvent extends StatsEvent {
  wasCorrect: boolean;
  /** Server-decided ad pacing, so a client cannot opt itself out. */
  shouldShowAd?: boolean;
  /** False when the round could not be saved (no device id). */
  persisted?: boolean;
  error?: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private pendingGuessResultHandlers: Array<(data: GuessResultEvent) => void> = [];
  private statsHandlers: Array<(data: StatsEvent) => void> = [];
  private connecting: Promise<void> | null = null;
  private latestStats: StatsEvent | null = null;

  constructor() {
    this.serverUrl = API_URL;
  }

  connect(): Promise<void> {
    // The socket outlives the chat screen, so a second call must reuse it.
    // Latching the in-flight promise matters too: React StrictMode calls this
    // twice in a row, and checking `connected` alone would orphan the first
    // socket while it was still handshaking.
    if (this.socket?.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        // Websocket first because the handshake is exempt from CORS, while
        // polling is not. Once a server carrying https://localhost in
        // ALLOWED_ORIGINS is deployed, delete this line: socket.io's default
        // (polling, then upgrade) survives networks that block the websocket
        // handshake, which this order does not.
        transports: ['websocket', 'polling'],
        // A signed-in player is identified by their token; guests by device id.
        auth: { deviceId: getDeviceId(), token: localStorage.getItem('auth_token') || undefined },
      });

      this.socket.on('stats', (stats: StatsEvent) => {
        this.latestStats = stats;
        this.statsHandlers.forEach((handler) => handler(stats));
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
        this.connecting = null;
        reject(error);
      });
    });

    return this.connecting;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connecting = null;
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

  submitGuess(matchId: string, guess: 'HUMAN' | 'AI'): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('submit-guess', { matchId, guess });
  }

  /** Subscribes to a socket event and returns an unsubscribe function. */
  private subscribe<T>(event: string, callback: (data: T) => void): () => void {
    this.socket?.on(event, callback as never);
    return () => {
      this.socket?.off(event, callback as never);
    };
  }

  onSearching(callback: () => void): () => void {
    return this.subscribe('searching', callback);
  }

  onMatched(callback: (data: MatchedEvent) => void): () => void {
    return this.subscribe('matched', callback);
  }

  onMessage(callback: (data: MessageEvent) => void): () => void {
    return this.subscribe('message', callback);
  }

  onPartnerTyping(callback: (data: { isTyping: boolean }) => void): () => void {
    return this.subscribe('partner-typing', callback);
  }

  onRevealPartner(callback: (data: RevealPartnerEvent) => void): () => void {
    return this.subscribe('reveal-partner', callback);
  }

  /** Subscribes to stats, replaying the most recent value if it already arrived. */
  onStats(callback: (data: StatsEvent) => void): () => void {
    this.statsHandlers.push(callback);
    if (this.latestStats) callback(this.latestStats);

    return () => {
      this.statsHandlers = this.statsHandlers.filter((handler) => handler !== callback);
    };
  }

  reportPartner(matchId: string, reason: string, transcript?: string): void {
    this.socket?.emit('report-partner', { matchId, reason, transcript });
  }

  blockPartner(matchId: string): void {
    this.socket?.emit('block-partner', { matchId });
  }

  /** Fires when the server refused to deliver a message. */
  onMessageBlocked(callback: (data: { reason?: string }) => void): () => void {
    return this.subscribe('message-blocked', callback);
  }

  onReportReceived(callback: () => void): () => void {
    return this.subscribe('report-received', callback);
  }

  /** Fires when a free player has used up today's rounds. */
  onRoundLimit(callback: (data: { limit: number; isGuest: boolean }) => void): () => void {
    return this.subscribe('round-limit-reached', callback);
  }

  /** Fires when a human partner guessed you were a bot - you fooled them. */
  onPartnerVerdict(callback: (data: { fooledPartner: boolean }) => void): () => void {
    return this.subscribe('partner-verdict', callback);
  }

  /** Pull a fresh round balance, e.g. after a rewarded ad was credited. */
  refreshStats(): void {
    this.socket?.emit('refresh-stats');
  }

  /** Fires when a suspended player tries to start a round. */
  onBanned(callback: () => void): () => void {
    return this.subscribe('banned', callback);
  }

  onPartnerDisconnected(callback: () => void): () => void {
    return this.subscribe('partner-disconnected', callback);
  }

  onError(callback: (data: { message: string; code?: string }) => void): () => void {
    return this.subscribe('error', callback);
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

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
