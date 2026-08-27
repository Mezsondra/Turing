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
import { moderateMessage } from './moderation.js';
import { computeDelays, forgetMatch } from './humanTiming.js';
import {
  personaFor,
  forgetPersona,
  noteIncoming,
  shouldIgnoreMessage,
  distractionPauseMs,
} from './persona.js';
import { db } from './database/db.js';
import { authService } from './auth/authService.js';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';
import { roundsLeft as computeRoundsLeft } from './freeRounds.js';

/** Free players see an interstitial every N completed rounds. */
const AD_EVERY_N_ROUNDS = 3;

/**
 * IPs are a fallback identity, so they are stored hashed rather than in the
 * clear. Keyed with JWT_SECRET: a leaked database alone does not reverse it.
 */
const hashIp = (address: string | undefined): string | null => {
  if (!address) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(address).digest('hex');
};

/** socket.id -> hashed IP, so the cap can be checked when a match is made. */
const socketToIp: Map<string, string | null> = new Map();

/** An account is a guest until it has an email on it. */
const isGuestPlayer = (playerId: string): boolean => {
  const user = db.getUserById(playerId);
  return !!user && !user.email;
};

/** Resolves the live inputs and defers the decision to the pure rule. */
const roundsLeft = (playerId: string | undefined, ipHash: string | null): number =>
  computeRoundsLeft({
    playerId,
    ipHash,
    isPremium: !!playerId && authService.isPremiumUser(playerId),
    isGuest: !!playerId && isGuestPlayer(playerId),
    caps: adminConfigService.getFreeRounds(),
    usedByPlayer: playerId ? db.getRoundStartCount(playerId) : 0,
    usedByIp: ipHash ? db.getRoundStartCountByIp(ipHash) : 0,
  });

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
  const remaining = roundsLeft(playerId, socketToIp.get(socketId) ?? null);

  io.to(socketId).emit('stats', {
    roundsLeft: Number.isFinite(remaining) ? remaining : null,
    score: player.score,
    gamesPlayed: player.games_played,
    gamesWon: player.games_won,
    gamesLost: player.games_lost,
    currentStreak: player.current_streak,
    bestStreak: player.best_streak,
    timesFooled: player.times_fooled,
  });
};

// Emit an AI message the way a human would send it: read, think, type, send.
/**
 * Some people send one considered message; others fire off two in a row. Split
 * on a sentence boundary when this opponent is a burster and the reply is long
 * enough to make two messages look natural.
 */
const splitForBurst = (matchId: string, text: string): string[] => {
  const { burstChance } = personaFor(matchId);
  if (!burstChance || Math.random() > burstChance || text.length < 25) return [text];

  const parts = text.split(/(?<=[.!?])\s+|\s+(?=but |and |also |tho )/i).filter(Boolean);
  if (parts.length < 2) return [text];

  // Two messages, not five: keep the first sentence, lump the rest together.
  return [parts[0].trim(), parts.slice(1).join(' ').trim()].filter(Boolean);
};

const sendAsIfTyping = (
  socketId: string,
  matchId: string,
  text: string,
  context: { incomingText?: string; elapsedMs?: number; distractedMs?: number } = {}
) => {
  const { preTypingMs, typingMs } = computeDelays({
    matchId,
    replyText: text,
    incomingText: context.incomingText,
    elapsedMs: context.elapsedMs,
    distractedMs: context.distractedMs,
  });

  const chunks = splitForBurst(matchId, text);

  setTimeout(() => {
    io.to(socketId).emit('partner-typing', { isTyping: true });

    // Each chunk takes its own share of the typing time, with a short gap
    // between them - the pause while someone hits send and keeps going.
    let elapsed = 0;
    chunks.forEach((chunk, index) => {
      const share = typingMs * (chunk.length / text.length);
      elapsed += share;

      setTimeout(() => {
        io.to(socketId).emit('message', { text: chunk, fromAI: true });

        const isLast = index === chunks.length - 1;
        io.to(socketId).emit('partner-typing', { isTyping: !isLast });
      }, elapsed);

      elapsed += 400 + Math.random() * 600;
    });
  }, preTypingMs);
};

// Single place where a match becomes visible to players. Previously this lived
// inside the join-queue handler, so matches created by the AI-fallback timeout
// were never announced and those players waited forever.
matchmakingService.onMatch(async (match) => {
  // Vary the round a little around the configured length. Always exactly 60
  // seconds reads as a game timer rather than a conversation, and both players
  // in a human match share this value because it is computed once, here.
  const configuredSeconds = adminConfigService.getConversationDurationSeconds();
  const roundDurationSeconds = Math.round(configuredSeconds * (0.85 + Math.random() * 0.4));
  const roundEndsAt = Date.now() + roundDurationSeconds * 1000;
  const payload = { matchId: match.id, partnerType: 'unknown', roundDurationSeconds, roundEndsAt };

  // Bill both players now. Doing this on the guess instead would mean leaving
  // mid-round - which the menu button makes a single tap - costs nothing.
  for (const user of [match.user1, match.user2]) {
    if (user?.playerId) {
      db.recordRoundStart(match.id, user.playerId, socketToIp.get(user.socketId) ?? null);
    }
  }

  io.to(match.user1.socketId).emit('matched', payload);
  if (match.user2) {
    io.to(match.user2.socketId).emit('matched', payload);
  }

  clearRoundTimer(match.id);
  roundTimers.set(match.id, setTimeout(() => endRound(match), roundDurationSeconds * 1000));

  if (!match.isAiMatch) return;

  // A human partner does not always message first. If the AI always opens,
  // "did they speak first?" becomes a perfect tell - so sometimes it waits.
  if (!personaFor(match.id).opensConversation) return;

  try {
    const startedAt = Date.now();
    const opening = await aiService.initializeConversation(match.id);
    sendAsIfTyping(match.user1.socketId, match.id, opening, { elapsedMs: Date.now() - startedAt });
  } catch (error) {
    console.error('Error initializing AI conversation:', error);
    // The match is unusable: drop it so the player can retry into a fresh one.
    matchmakingService.removeUser(match.user1.id);
    clearRoundTimer(match.id);
    io.to(match.user1.socketId).emit('error', {
      code: 'ai_unavailable',
      message: 'The AI opponent is unavailable right now.',
    });
  }
});

matchmakingService.onMatchFailure((user) => {
  io.to(user.socketId).emit('error', {
    code: 'ai_unavailable',
    message: 'Could not start a chat. Please try again.',
  });
});

io.on('connection', async (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Identity, in order of precedence:
  //  1. a signed-in account (same player on any device)
  //  2. a guest device id kept in localStorage (no signup, still persistent)
  socketToIp.set(socket.id, hashIp(socket.handshake.address));

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

      // Server-enforced: a client cannot grant itself more rounds.
      const playerId = socketToPlayer.get(socket.id);
      const ipHash = socketToIp.get(socket.id) ?? null;
      if (roundsLeft(playerId, ipHash) <= 0) {
        const caps = adminConfigService.getFreeRounds();
        socket.emit('round-limit-reached', {
          limit: playerId && !isGuestPlayer(playerId) ? caps.member : caps.guest,
          isGuest: !playerId || isGuestPlayer(playerId),
        });
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
        playerId: playerId || '',
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
        // A distracted person sometimes just does not answer. Skipping the API
        // call entirely is also the honest thing to do: they never read it.
        if (shouldIgnoreMessage(match.id, noteIncoming(match.id))) {
          console.log(`Match ${match.id}: opponent ignored a message`);
          return;
        }

        try {
          const startedAt = Date.now();
          const aiResponse = await aiService.sendMessage(match.id, message);
          // Re-check: the player may have disconnected while the API call ran.
          if (!matchmakingService.getMatch(match.id)) return;
          sendAsIfTyping(socket.id, match.id, aiResponse, {
            incomingText: message,
            elapsedMs: Date.now() - startedAt,
            distractedMs: distractionPauseMs(match.id),
          });
        } catch (error) {
          console.error('Error getting AI response:', error);
          socket.emit('partner-typing', { isTyping: false });
          socket.emit('error', { message: 'Failed to get response' });
        }
      } else {
        const verdict = moderateMessage(message);
        if (!verdict.allowed) {
          socket.emit('message-blocked', { reason: verdict.reason });
          return;
        }

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

      sendStats(socket.id, playerId);

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

  // Report a partner. Required by app store UGC rules, and the transcript is
  // stored with the report so a human can actually review it.
  socket.on('report-partner', ({ matchId, reason, transcript }: { matchId: string; reason: string; transcript?: string }) => {
    try {
      const playerId = socketToPlayer.get(socket.id);
      const userId = socketToUser.get(socket.id);
      if (!playerId || !userId) return;

      if (hitLimit(`report:${socket.id}`, 5, 60_000)) {
        socket.emit('error', { message: 'Too many reports. Please slow down.' });
        return;
      }

      const match = matchmakingService.getMatchForUser(userId);
      if (!match || match.id !== matchId) return;

      const partner = matchmakingService.getPartnerInMatch(match.id, userId);

      db.createReport({
        id: uuidv4(),
        reporter_id: playerId,
        reported_id: partner?.playerId || 'AI',
        match_id: match.id,
        reason: String(reason || 'unspecified').slice(0, 200),
        transcript: typeof transcript === 'string' ? transcript.slice(0, 5000) : undefined,
      });

      // Reporting implies you do not want to meet them again.
      if (partner?.playerId) db.blockPlayer(playerId, partner.playerId);

      socket.emit('report-received');
    } catch (error) {
      console.error('Error handling report:', error);
    }
  });

  socket.on('block-partner', ({ matchId }: { matchId: string }) => {
    try {
      const playerId = socketToPlayer.get(socket.id);
      const userId = socketToUser.get(socket.id);
      if (!playerId || !userId) return;

      const match = matchmakingService.getMatchForUser(userId);
      if (!match || match.id !== matchId) return;

      const partner = matchmakingService.getPartnerInMatch(match.id, userId);
      if (partner?.playerId) {
        db.blockPlayer(playerId, partner.playerId);
        socket.emit('report-received');
      }
    } catch (error) {
      console.error('Error handling block:', error);
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
      if (match) {
        clearRoundTimer(match.id);
        forgetMatch(match.id);
        forgetPersona(match.id);
      }
      matchmakingService.removeUser(userId);
      socketToUser.delete(socket.id);
      socketToPlayer.delete(socket.id);
    }
    socketToIp.delete(socket.id);
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
