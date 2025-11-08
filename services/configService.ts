import type { PublicConfig } from '../types';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let cachedConfig: PublicConfig | null = null;

export const fetchPublicConfig = async (): Promise<PublicConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const response = await fetch(`${API_URL}/api/config`);
  if (!response.ok) {
    throw new Error('Failed to load configuration');
  }

  const data = await response.json();
  cachedConfig = data.config as PublicConfig;
  return cachedConfig;
};

export const getCachedConfig = (): PublicConfig | null => cachedConfig;
