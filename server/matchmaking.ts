import { User, Match } from './types.js';
import { aiService } from './aiService.js';
import type { AIBehavior } from './ai/baseProvider.js';
import { v4 as uuidv4 } from 'uuid';
import { adminConfigService } from './adminConfig.js';

export class MatchmakingService {
  private waitingQueue: User[] = [];
  private activeMatches: Map<string, Match> = new Map();
  private userToMatch: Map<string, string> = new Map(); // userId -> matchId
  private matchTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Configuration - now loaded from admin config
  private get MATCH_TIMEOUT_MS(): number {
    return adminConfigService.getMatchTimeoutMs();
  }

  private get AI_MATCH_PROBABILITY(): number {
    return adminConfigService.getAIMatchProbability();
  }

  addToQueue(user: User): void {
    console.log(`User ${user.id} added to queue`);
    this.waitingQueue.push(user);

    // Try to match immediately
    this.tryMatchUser(user);
  }

  private tryMatchUser(user: User): void {
    // Check if user should be matched with AI immediately (random chance)
    const shouldMatchWithAI = Math.random() < this.AI_MATCH_PROBABILITY;

    if (shouldMatchWithAI) {
      console.log(`User ${user.id} will be matched with AI (random selection)`);
      this.matchWithAI(user);
      return;
    }

    // Try to find another waiting user with same language
    const otherUserIndex = this.waitingQueue.findIndex(
      u => u.id !== user.id && u.language === user.language
    );

    if (otherUserIndex !== -1) {
      const otherUser = this.waitingQueue[otherUserIndex];

      // Remove both users from queue
      this.waitingQueue = this.waitingQueue.filter(
        u => u.id !== user.id && u.id !== otherUser.id
      );

      // Clear any pending timeouts
      this.clearMatchTimeout(user.id);
      this.clearMatchTimeout(otherUser.id);

      // Create human-to-human match
      this.createHumanMatch(user, otherUser);
      console.log(`Matched ${user.id} with ${otherUser.id} (human vs human)`);
    } else {
      // Set timeout to match with AI if no human found
      console.log(`User ${user.id} waiting for match, will match with AI in ${this.MATCH_TIMEOUT_MS}ms if no human found`);
      const timeout = setTimeout(() => {
        // Check if user is still in queue
        const stillWaiting = this.waitingQueue.some(u => u.id === user.id);
        if (stillWaiting) {
          console.log(`Timeout reached for user ${user.id}, matching with AI`);
          this.matchWithAI(user);
        }
      }, this.MATCH_TIMEOUT_MS);

      this.matchTimeouts.set(user.id, timeout);
    }
  }

  private createHumanMatch(user1: User, user2: User): string {
    const matchId = uuidv4();
    const match: Match = {
      id: matchId,
      user1,
      user2,
      isAiMatch: false,
      actualPartnerType: 'HUMAN',
      createdAt: Date.now(),
    };

    this.activeMatches.set(matchId, match);
    this.userToMatch.set(user1.id, matchId);
    this.userToMatch.set(user2.id, matchId);

    return matchId;
  }

  private matchWithAI(user: User): string {
    // Remove from queue
    this.waitingQueue = this.waitingQueue.filter(u => u.id !== user.id);
    this.clearMatchTimeout(user.id);

    const matchId = uuidv4();

    // Get AI behavior from admin configuration
    const behavior: AIBehavior = adminConfigService.getAIBehavior();

    console.log(`AI will act as: ${behavior} for match ${matchId}`);

    // Create AI session
    aiService.createSession(matchId, user.language, behavior);

    const match: Match = {
      id: matchId,
      user1: user,
      user2: null,
      isAiMatch: true,
      actualPartnerType: 'AI',
      createdAt: Date.now(),
    };

    this.activeMatches.set(matchId, match);
    this.userToMatch.set(user.id, matchId);

    return matchId;
  }

  private clearMatchTimeout(userId: string): void {
    const timeout = this.matchTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.matchTimeouts.delete(userId);
    }
  }

  getMatchForUser(userId: string): Match | null {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return null;
    return this.activeMatches.get(matchId) || null;
  }

  getMatch(matchId: string): Match | null {
    return this.activeMatches.get(matchId) || null;
  }

  getPartnerInMatch(matchId: string, userId: string): User | null {
    const match = this.activeMatches.get(matchId);
    if (!match || match.isAiMatch) return null;

    if (match.user1.id === userId) return match.user2;
    if (match.user2?.id === userId) return match.user1;
    return null;
  }

  isAiMatch(matchId: string): boolean {
    const match = this.activeMatches.get(matchId);
    return match?.isAiMatch || false;
  }

  removeUser(userId: string): void {
    console.log(`Removing user ${userId} from matchmaking`);

    // Remove from waiting queue
    this.waitingQueue = this.waitingQueue.filter(u => u.id !== userId);

    // Clear any pending timeouts
    this.clearMatchTimeout(userId);

    // Find and clean up active match
    const matchId = this.userToMatch.get(userId);
    if (matchId) {
      const match = this.activeMatches.get(matchId);
      if (match) {
        // Clean up AI session if it exists
        if (match.isAiMatch) {
          aiService.deleteSession(matchId);
        }

        // Remove match mappings
        this.userToMatch.delete(match.user1.id);
        if (match.user2) {
          this.userToMatch.delete(match.user2.id);
        }

        // Remove match
        this.activeMatches.delete(matchId);
      }
    }
  }

  getQueueSize(): number {
    return this.waitingQueue.length;
  }

  getActiveMatchesCount(): number {
    return this.activeMatches.size;
  }
}

export const matchmakingService = new MatchmakingService();
