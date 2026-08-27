import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, User } from '../database/db.js';
import { verifyGoogleIdToken } from './google.js';
import { sendLoginCode } from './email.js';
import {
  generateCode, hashCode, checkCode, CODE_TTL_MS,
} from './loginCode.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Refusing to start with a guessable token secret.');
}
const JWT_EXPIRES_IN = '30d';

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
  /** Device of the guest signing up, so their existing progress carries over. */
  deviceId?: string;
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

    // Claim this device's guest row if there is an unclaimed one, so the
    // player keeps the score and streak they built before signing up.
    let user =
      data.deviceId
        ? (() => {
            const guest = db.getUserByDeviceId(data.deviceId!);
            return guest && !guest.email
              ? db.attachAccountToGuest(guest.id, data.email, passwordHash, data.username)
              : undefined;
          })()
        : undefined;

    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        email: data.email,
        password_hash: passwordHash,
        username: data.username,
      });
    }

    const userId = user.id;

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

    // A Google or email-code account has no password. Reject it the same way as
    // a wrong password: comparing against an absent hash would throw.
    if (!user.password_hash) {
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

  /**
   * Everything a signed-in client needs, for any sign-in method. Kept in one
   * place so password, Google and email-code logins cannot drift apart in what
   * they hand back or forget to create.
   */
  private issueSession(user: User): AuthResponse {
    let subscription = db.getSubscriptionByUserId(user.id);
    if (!subscription) {
      subscription = db.createSubscription({
        id: uuidv4(),
        user_id: user.id,
        status: 'active',
        plan: 'free',
      });
    }

    return {
      user: { id: user.id, email: user.email!, username: user.username },
      token: this.generateToken({ userId: user.id, email: user.email! }),
      subscription: { plan: subscription.plan, status: subscription.status },
    };
  }

  /**
   * Find the account for a verified address, or make one - claiming this
   * device's guest row if it is still unclaimed, so the score and streak the
   * player built before signing up carry over.
   *
   * Passwordless by design: password_hash stays null, and login() refuses it.
   */
  private findOrCreateByEmail(email: string, deviceId?: string, username?: string): User {
    const existing = db.getUserByEmail(email);
    if (existing) return existing;

    if (deviceId) {
      const guest = db.getUserByDeviceId(deviceId);
      if (guest && !guest.email) {
        const adopted = db.attachAccountToGuest(guest.id, email, null, username);
        if (adopted) return adopted;
      }
    }

    return db.createUser({ id: uuidv4(), email, password_hash: undefined, username });
  }

  /** Google has already verified the address, so this signs in immediately. */
  async signInWithGoogle(idToken: string, deviceId?: string): Promise<AuthResponse> {
    const identity = await verifyGoogleIdToken(idToken);
    const user = this.findOrCreateByEmail(identity.email, deviceId);
    return this.issueSession(user);
  }

  /**
   * Mail a one-time code. Deliberately returns nothing about whether the
   * address is already registered - that would turn this into a way to test
   * which emails have accounts here.
   */
  async startEmailLogin(email: string): Promise<void> {
    const code = generateCode();
    db.saveLoginCode(email, hashCode(code, email, JWT_SECRET!), Date.now() + CODE_TTL_MS);
    await sendLoginCode(email, code);
  }

  /** Verify the code and sign in, creating the account on first use. */
  async completeEmailLogin(email: string, code: string, deviceId?: string): Promise<AuthResponse> {
    const stored = db.getLoginCode(email);
    const result = checkCode(stored, code, email, JWT_SECRET!);

    if (result !== 'ok') {
      // Count the failure before rejecting, or the attempt cap never bites.
      if (stored && result === 'wrong') db.bumpLoginAttempts(email);
      throw new Error(
        result === 'locked'
          ? 'Too many attempts. Ask for a new code.'
          : result === 'expired'
            ? 'That code has expired. Ask for a new one.'
            : 'That code is not right.',
      );
    }

    // Single use: burn it before issuing the session, so a replay finds nothing.
    db.clearLoginCode(email);
    return this.issueSession(this.findOrCreateByEmail(email, deviceId));
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
