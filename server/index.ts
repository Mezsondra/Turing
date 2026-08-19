// Env comes from node's --env-file flag (see package.json scripts). A
// dotenv.config() call here would NOT work: ES modules evaluate every import
// before this file's body runs, so imported modules would see no env at all.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { matchmakingService } from './matchmaking.js';
import { aiService } from './aiService.js';
import { User } from './types.js';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import gameRoutes from './routes/game.js';
import adminRoutes from './routes/admin.js';
import { adminConfigService } from './adminConfig.js';
import { rateLimit, hitLimit } from './rateLimit.js';
import { db } from './database/db.js';
import { authService } from './auth/authService.js';
import { v4 as uuidv4 } from 'uuid';

/** Free players see an interstitial every N completed rounds. */
const AD_EVERY_N_ROUNDS = 3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';


const app = express();
const httpServer = createServer(app);

// Behind Caddy/nginx: trust exactly one proxy so req.ip is the real visitor,
// not the reverse proxy. Rate limiting depends on this.
app.set('trust proxy', 1);

// Only the site itself may call the API. The built frontend is served from this
// same origin, so in production this allowlist is a safety net rather than a
// day-to-day dependency.
app.use(cors({ origin: CLIENT_URL }));

// Parse JSON bodies (except for webhooks)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// API Routes
app.use('/api/auth', rateLimit(10, 60_000), authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// Create Socket.io server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Map socket IDs to user IDs for easy lookup
const socketToUser: Map<string, string> = new Map();

// Socket -> database player id (guest or registered). Scores are written here.
const socketToPlayer: Map<string, string> = new Map();

// Server owns the round clock. A client-side timer is both cheatable and, in
// human-vs-human matches, out of sync between the two players.
const roundTimers: Map<string, NodeJS.Timeout> = new Map();

const endRound = (match: { id: string; user1: User; user2: User | null; actualPartnerType: 'HUMAN' | 'AI' }) => {
  roundTimers.delete(match.id);
  const payload = { actualPartnerType: match.actualPartnerType, matchId: match.id };
  io.to(match.user1.socketId).emit('reveal-partner', payload);
  if (match.user2) io.to(match.user2.socketId).emit('reveal-partner', payload);
};

const clearRoundTimer = (matchId: string) => {
  const timer = roundTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    roundTimers.delete(matchId);
  }
};

const sendStats = (socketId: string, playerId: string) => {
  const player = db.getUserById(playerId);
  if (!player) return;
  io.to(socketId).emit('stats', {
    score: player.score,
    gamesPlayed: player.games_played,
    gamesWon: player.games_won,
    gamesLost: player.games_lost,
    currentStreak: player.current_streak,
    bestStreak: player.best_streak,
    timesFooled: player.times_fooled,
  });
};

// Emit an AI message the way a human would send it: think, then type, then send.
const sendAsIfTyping = (socketId: string, text: string) => {
  const thinkingDelay = 800 + Math.random() * 1200;
  const typingDuration = Math.min(4500, Math.max(1200, text.length * 30));

  setTimeout(() => {
    io.to(socketId).emit('partner-typing', { isTyping: true });
    setTimeout(() => {
      io.to(socketId).emit('message', { text, fromAI: true });
      io.to(socketId).emit('partner-typing', { isTyping: false });
    }, typingDuration);
  }, thinkingDelay);
};

// Single place where a match becomes visible to players. Previously this lived
// inside the join-queue handler, so matches created by the AI-fallback timeout
// were never announced and those players waited forever.
matchmakingService.onMatch(async (match) => {
  const roundDurationSeconds = adminConfigService.getConversationDurationSeconds();
  const roundEndsAt = Date.now() + roundDurationSeconds * 1000;
  const payload = { matchId: match.id, partnerType: 'unknown', roundDurationSeconds, roundEndsAt };

  io.to(match.user1.socketId).emit('matched', payload);
  if (match.user2) {
    io.to(match.user2.socketId).emit('matched', payload);
  }

  clearRoundTimer(match.id);
  roundTimers.set(match.id, setTimeout(() => endRound(match), roundDurationSeconds * 1000));

  if (!match.isAiMatch) return;

  try {
    const opening = await aiService.initializeConversation(match.id);
    sendAsIfTyping(match.user1.socketId, opening);
  } catch (error) {
    console.error('Error initializing AI conversation:', error);
    io.to(match.user1.socketId).emit('error', { message: 'Failed to initialize chat' });
  }
});

matchmakingService.onMatchFailure((user) => {
  io.to(user.socketId).emit('error', { message: 'Could not start a chat. Please try again.' });
});

io.on('connection', async (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Identity, in order of precedence:
  //  1. a signed-in account (same player on any device)
  //  2. a guest device id kept in localStorage (no signup, still persistent)
  const rawDeviceId = socket.handshake.auth?.deviceId;
  const rawToken = socket.handshake.auth?.token;
  const deviceId =
    typeof rawDeviceId === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(rawDeviceId) ? rawDeviceId : null;

  try {
    let playerId: string | null = null;

    if (typeof rawToken === 'string' && rawToken) {
      const account = await authService.getUserFromToken(rawToken);
      if (account) playerId = account.id;
    }

    if (!playerId && deviceId) {
      playerId = db.getOrCreateGuest(deviceId, uuidv4()).id;
    }

    if (playerId) {
      socketToPlayer.set(socket.id, playerId);
      sendStats(socket.id, playerId);
    }
  } catch (error) {
    console.error('Failed to resolve player identity:', error);
  }

  // Handle user joining the matchmaking queue
  socket.on('join-queue', async ({ language }: { language: string }) => {
    try {
      if (hitLimit(`queue:${socket.handshake.address}`, 20, 60_000)) {
        socket.emit('error', { message: 'Too many games started. Slow down.' });
        return;
      }

      console.log(`Socket ${socket.id} joining queue with language: ${language}`);

      // The client keeps one socket across rounds, so clear out the previous
      // match before queueing again.
      const previous = matchmakingService.getMatchForUser(socket.id);
      if (previous) {
        clearRoundTimer(previous.id);
        matchmakingService.removeUser(socket.id);
      }

      const user: User = {
        id: socket.id,
        playerId: socketToPlayer.get(socket.id) || '',
        socketId: socket.id,
        language,
        joinedAt: Date.now(),
      };

      socketToUser.set(socket.id, user.id);
      socket.emit('searching');

      // Matches are delivered through matchmakingService.onMatch below - including
      // the ones created later by the AI-fallback timeout.
      matchmakingService.addToQueue(user);
    } catch (error) {
      console.error('Error in join-queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // Handle chat messages
  socket.on('send-message', async ({ text }: { text: string }) => {
    try {
      // Trust boundary: this is raw client input that goes to a paid AI API and
      // to another player's screen.
      if (typeof text !== 'string') return;
      const message = text.trim().slice(0, 500);
      if (!message) return;

      const userId = socketToUser.get(socket.id);
      if (!userId) {
        console.error('User not found for socket:', socket.id);
        return;
      }

      const match = matchmakingService.getMatchForUser(userId);
      if (!match) {
        console.error('No active match for user:', userId);
        socket.emit('error', { message: 'No active match' });
        return;
      }

      // Caps AI spend per player and stops message-flood abuse.
      if (hitLimit(`msg:${socket.id}`, 30, 60_000)) {
        socket.emit('error', { message: 'You are sending messages too quickly.' });
        return;
      }

      if (match.isAiMatch) {
        try {
          const aiResponse = await aiService.sendMessage(match.id, message);
          // Re-check: the player may have disconnected while the API call ran.
          if (!matchmakingService.getMatch(match.id)) return;
          sendAsIfTyping(socket.id, aiResponse);
        } catch (error) {
          console.error('Error getting AI response:', error);
          socket.emit('partner-typing', { isTyping: false });
          socket.emit('error', { message: 'Failed to get response' });
        }
      } else {
        const partner = matchmakingService.getPartnerInMatch(match.id, userId);
        if (partner) {
          io.to(partner.socketId).emit('message', { text: message, fromAI: false });
        }
      }
    } catch (error) {
      console.error('Error in send-message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', ({ isTyping }: { isTyping: boolean }) => {
    try {
      const userId = socketToUser.get(socket.id);
      if (!userId) return;

      const match = matchmakingService.getMatchForUser(userId);
      if (!match || match.isAiMatch) return; // Don't send typing for AI matches

      const partner = matchmakingService.getPartnerInMatch(match.id, userId);
      if (partner) {
        io.to(partner.socketId).emit('partner-typing', { isTyping });
      }
    } catch (error) {
      console.error('Error in typing event:', error);
    }
  });

  // Handle guess submission. The server is the only authority on whether a
  // guess was right and what it is worth - the client is not consulted.
  socket.on('submit-guess', async ({ matchId, guess }: { matchId: string; guess: 'HUMAN' | 'AI' }) => {
    try {
      if (guess !== 'HUMAN' && guess !== 'AI') {
        socket.emit('guess-result', { error: 'Invalid guess' });
        return;
      }

      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('guess-result', { error: 'User not found' });
        return;
      }

      const match = matchmakingService.getMatchForUser(userId);
      if (!match || match.id !== matchId) {
        socket.emit('guess-result', { error: 'Invalid match' });
        return;
      }

      // Guessing before the round is over would let a player peek and retry.
      if (roundTimers.has(match.id)) {
        socket.emit('guess-result', { error: 'Round is still in progress' });
        return;
      }

      const wasCorrect = guess === match.actualPartnerType;
      const playerId = socketToPlayer.get(socket.id);

      if (!playerId) {
        // No device id (e.g. an old client): score the round but do not persist.
        socket.emit('guess-result', {
          wasCorrect,
          score: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          currentStreak: 0,
          bestStreak: 0,
          timesFooled: 0,
          shouldShowAd: false,
          persisted: false,
        });
        return;
      }

      const partner = matchmakingService.getPartnerInMatch(match.id, userId);

      const { fooledPartner } = db.recordGuess({
        userId: playerId,
        matchId: match.id,
        partnerType: match.actualPartnerType,
        guess,
        wasCorrect,
        partnerPlayerId: partner?.playerId || undefined,
      });

      // Reverse role: this player just called a real human a bot, so that human
      // wins the exchange. Tell them, and refresh their score.
      if (fooledPartner && partner) {
        io.to(partner.socketId).emit('partner-verdict', { fooledPartner: true });
        sendStats(partner.socketId, partner.playerId);
      }

      const player = db.getUserById(playerId);
      const roundsPlayed = player?.games_played ?? 0;
      const shouldShowAd =
        !authService.isPremiumUser(playerId) &&
        roundsPlayed > 0 &&
        roundsPlayed % AD_EVERY_N_ROUNDS === 0;

      socket.emit('guess-result', {
        wasCorrect,
        shouldShowAd,
        score: player?.score ?? 0,
        gamesPlayed: player?.games_played ?? 0,
        gamesWon: player?.games_won ?? 0,
        gamesLost: player?.games_lost ?? 0,
        currentStreak: player?.current_streak ?? 0,
        bestStreak: player?.best_streak ?? 0,
        timesFooled: player?.times_fooled ?? 0,
        persisted: true,
      });
    } catch (error) {
      console.error('Error in submit-guess:', error);
      socket.emit('guess-result', { error: 'Failed to submit guess' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const userId = socketToUser.get(socket.id);

    if (userId) {
      // Notify partner if in active match
      const match = matchmakingService.getMatchForUser(userId);
      if (match && !match.isAiMatch) {
        const partner = matchmakingService.getPartnerInMatch(match.id, userId);
        if (partner) {
          io.to(partner.socketId).emit('partner-disconnected');
        }
      }

      // Remove user from matchmaking
      if (match) clearRoundTimer(match.id);
      matchmakingService.removeUser(userId);
      socketToUser.delete(socket.id);
      socketToPlayer.delete(socket.id);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    queue: matchmakingService.getQueueSize(),
    activeMatches: matchmakingService.getActiveMatchesCount(),
    aiProvider: aiService.getProviderName(),
  });
});

// Serve the built frontend from this same process, so there is one origin,
// one port and one service to run. Must come after the API routes.
const clientDist = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
