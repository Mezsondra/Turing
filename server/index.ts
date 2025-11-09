import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import express from 'express';
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


const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors());

// Parse JSON bodies (except for webhooks)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
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

io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle user joining the matchmaking queue
  socket.on('join-queue', async ({ language }: { language: 'en' | 'tr' }) => {
    try {
      console.log(`Socket ${socket.id} joining queue with language: ${language}`);

      const user: User = {
        id: socket.id,
        socketId: socket.id,
        language,
        joinedAt: Date.now(),
      };

      socketToUser.set(socket.id, user.id);

      // Add to matchmaking queue
      matchmakingService.addToQueue(user);

      // Get the match (either immediate or after timeout)
      const match = matchmakingService.getMatchForUser(user.id);

      if (match) {
        const roundDurationSeconds = adminConfigService.getConversationDurationSeconds();
        if (match.isAiMatch) {
          // Matched with AI
          console.log(`User ${user.id} matched with AI`);
          socket.emit('matched', {
            matchId: match.id,
            partnerType: 'unknown', // Don't reveal it's AI
            roundDurationSeconds,
          });

          // Initialize AI conversation
          try {
            const initialMessage = await aiService.initializeConversation(match.id);

            const thinkingDelay = 800 + Math.random() * 1200;
            const typingDuration = Math.min(4500, Math.max(1200, initialMessage.length * 30));

            setTimeout(() => {
              socket.emit('partner-typing', { isTyping: true });

              setTimeout(() => {
                socket.emit('message', {
                  text: initialMessage,
                  fromAI: true,
                });
                socket.emit('partner-typing', { isTyping: false });
              }, typingDuration);
            }, thinkingDelay);
          } catch (error) {
            console.error('Error initializing AI conversation:', error);
            socket.emit('error', { message: 'Failed to initialize chat' });
          }
        } else {
          // Matched with human
          console.log(`User ${user.id} matched with human ${match.user2?.id}`);

          const partner = matchmakingService.getPartnerInMatch(match.id, user.id);
          if (partner) {
            // Notify both users
            socket.emit('matched', {
              matchId: match.id,
              partnerType: 'unknown',
              roundDurationSeconds,
            });

            io.to(partner.socketId).emit('matched', {
              matchId: match.id,
              partnerType: 'unknown',
              roundDurationSeconds,
            });
          }
        }
      } else {
        // Still waiting
        socket.emit('searching');
      }
    } catch (error) {
      console.error('Error in join-queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // Handle chat messages
  socket.on('send-message', async ({ text }: { text: string }) => {
    try {
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

      console.log(`Message from ${userId} in match ${match.id}: ${text}`);

      if (match.isAiMatch) {
        // Send to AI and get response
        try {
          // Simulate thinking delay before AI starts typing
          const thinkingDelay = 800 + Math.random() * 1200;

          setTimeout(async () => {
            socket.emit('partner-typing', { isTyping: true });
            try {
              const aiResponse = await aiService.sendMessage(match.id, text);
              const typingDuration = Math.min(4500, Math.max(1200, aiResponse.length * 30));

              setTimeout(() => {
                socket.emit('message', {
                  text: aiResponse,
                  fromAI: true,
                });
                socket.emit('partner-typing', { isTyping: false });
              }, typingDuration);
            } catch (error) {
              console.error('Error getting AI response:', error);
              socket.emit('partner-typing', { isTyping: false });
              socket.emit('error', { message: 'Failed to get response' });
            }
          }, thinkingDelay);
        } catch (error) {
          console.error('Error processing AI message:', error);
          socket.emit('partner-typing', { isTyping: false });
          socket.emit('error', { message: 'Failed to send message' });
        }
      } else {
        // Send to other human
        const partner = matchmakingService.getPartnerInMatch(match.id, userId);
        if (partner) {
          io.to(partner.socketId).emit('message', {
            text,
            fromAI: false,
          });
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

  // Handle time up - reveal the partner type
  socket.on('time-up', () => {
    try {
      const userId = socketToUser.get(socket.id);
      if (!userId) return;

      const match = matchmakingService.getMatchForUser(userId);
      if (!match) return;

      socket.emit('reveal-partner', {
        actualPartnerType: match.actualPartnerType,
        matchId: match.id,
      });
    } catch (error) {
      console.error('Error in time-up:', error);
    }
  });

  // Handle guess submission
  socket.on('submit-guess', async ({ matchId, guess }: { matchId: string; guess: 'HUMAN' | 'AI' }) => {
    try {
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

      const wasCorrect = guess === match.actualPartnerType;

      // For guest users (non-authenticated), just return the result without updating database
      socket.emit('guess-result', {
        wasCorrect,
        score: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0
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
      matchmakingService.removeUser(userId);
      socketToUser.delete(socket.id);
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

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
