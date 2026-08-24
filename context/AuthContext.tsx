import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';

interface User {
  id: string;
  email: string;
  username?: string;
}

interface Subscription {
  plan: 'free' | 'premium';
  status: string;
}

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isPremium: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
  upgrade: (plan: 'monthly' | 'yearly' | 'lifetime') => Promise<void>;
  manageSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSubscription(data.subscription);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      // Reload so the websocket reconnects and the server re-resolves identity
      // from the token instead of the guest device id.
      window.location.reload();
    } catch (error: any) {
      throw error;
    }
  };

  const register = async (email: string, password: string, username?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // The device id lets the server claim this guest's existing progress
        // instead of starting the new account from zero.
        body: JSON.stringify({ email, password, username, deviceId: getDeviceId() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      window.location.reload();
    } catch (error: any) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    window.location.reload();
  };

  const upgrade = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('You need an account before upgrading');

    const response = await fetch(`${API_URL}/api/payment/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Could not start checkout');
    }

    const { url } = await response.json();
    window.location.href = url;
  };

  // Stripe's hosted billing portal is the whole cancellation flow: without a
  // way to reach it a subscriber can only cancel by emailing us or filing a
  // chargeback. Lifetime buyers get here too - they have no subscription to
  // cancel, but the portal still shows their receipt.
  const manageSubscription = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('You need an account to manage billing');

    const response = await fetch(`${API_URL}/api/payment/create-portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Could not open the billing portal');
    }

    const { url } = await response.json();
    window.location.href = url;
  };

  const refreshSubscription = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/payment/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    }
  };

  const value: AuthContextType = {
    user,
    subscription,
    isAuthenticated: !!user,
    isPremium: subscription?.plan === 'premium' && subscription?.status === 'active',
    isLoading,
    login,
    register,
    logout,
    refreshSubscription,
    upgrade,
    manageSubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
