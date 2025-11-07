import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, User } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '30d';

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username?: string;
  };
  token: string;
  subscription: {
    plan: 'free' | 'premium';
    status: string;
  };
}

export class AuthService {
  async register(data: RegisterData): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = db.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const userId = uuidv4();
    const user = db.createUser({
      id: userId,
      email: data.email,
      password_hash: passwordHash,
      username: data.username,
    });

    // Create free subscription
    const subscriptionId = uuidv4();
    const subscription = db.createSubscription({
      id: subscriptionId,
      user_id: userId,
      status: 'active',
      plan: 'free',
    });

    // Generate JWT token
    const token = this.generateToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
      },
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    // Find user
    const user = db.getUserByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Get subscription
    const subscription = db.getSubscriptionByUserId(user.id);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Generate JWT token
    const token = this.generateToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
      },
    };
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = this.verifyToken(token);
      const user = db.getUserById(payload.userId);
      return user || null;
    } catch (error) {
      return null;
    }
  }

  isPremiumUser(userId: string): boolean {
    const subscription = db.getSubscriptionByUserId(userId);
    return subscription?.plan === 'premium' && subscription?.status === 'active';
  }
}

export const authService = new AuthService();
