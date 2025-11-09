import { useState } from 'react';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

type ProviderKey = 'gemini' | 'openai' | 'xai';

interface ProviderConfig {
  apiKey: string;
  model: string;
  apiBaseUrl?: string;
}

interface AdminConfig {
  aiProvider: ProviderKey;
  aiProviders: Record<ProviderKey, ProviderConfig>;
  aiMatchProbability: number;
  matchTimeoutMs: number;
  conversationDurationSeconds: number;
  languages: string[];
  prompts: {
    [languageCode: string]: string;
  };
  initialPrompts: {
    [languageCode: string]: string;
  };
}

type AdminConfigUpdate = Partial<Omit<AdminConfig, 'aiProviders' | 'prompts' | 'languages'>> & {
  aiProviders?: Partial<Record<ProviderKey, Partial<ProviderConfig>>>;
  prompts?: Partial<AdminConfig['prompts']>;
  initialPrompts?: Partial<AdminConfig['initialPrompts']>;
  languages?: string[];
};

interface AdminState {
  isAuthenticated: boolean;
  password: string;
  config: AdminConfig | null;
  loading: boolean;
  error: string;
  success: string;
  authToken: string;
}

const useAdminState = () => {
  const [state, setState] = useState<AdminState>({
    isAuthenticated: false,
    password: '',
    config: null,
    loading: false,
    error: '',
    success: '',
    authToken: '',
  });

  const setPassword = (password: string) => {
    setState(prevState => ({ ...prevState, password }));
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prevState => ({ ...prevState, loading: true, error: '' }));

    const token = `Bearer ${state.password}`;

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        headers: { Authorization: token },
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          isAuthenticated: true,
          loading: false,
          config: data.config,
          authToken: token,
          password: '', // Clear password after successful login
        }));
      } else {
        setState(prevState => ({
          ...prevState,
          loading: false,
          error: 'Invalid password',
          password: '',
        }));
      }
    } catch (err) {
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: 'Failed to connect to server',
      }));
    }
  };

  const mergeConfig = (current: AdminConfig, updates: AdminConfigUpdate): AdminConfig => {
    const mergedProviders = { ...current.aiProviders } as Record<ProviderKey, ProviderConfig>;

    if (updates.aiProviders) {
      (Object.keys(updates.aiProviders) as ProviderKey[]).forEach(provider => {
        const update = updates.aiProviders?.[provider];
        if (update) {
          mergedProviders[provider] = {
            ...current.aiProviders[provider],
            ...update,
          };
        }
      });
    }

    return {
      ...current,
      ...updates,
      aiProviders: mergedProviders,
      prompts: {
        ...current.prompts,
        ...(updates.prompts || {}),
      },
      initialPrompts: {
        ...current.initialPrompts,
        ...(updates.initialPrompts || {}),
      },
      languages: updates.languages || current.languages,
    };
  };

  const updateConfig = async (updates: AdminConfigUpdate) => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    if (!state.config) {
      setState(prevState => ({ ...prevState, loading: false }));
      return;
    }

    const previousConfig = state.config;
    const newConfig = mergeConfig(state.config, updates);

    setState(prevState => ({
      ...prevState,
      config: newConfig,
    }));

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        method: 'PUT',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: 'Configuration updated successfully!',
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        setState(prevState => ({
          ...prevState,
          error: 'Failed to update configuration',
          loading: false,
          config: previousConfig,
        }));
      }
    } catch (err) {
      setState(prevState => ({
        ...prevState,
        error: 'Failed to connect to server',
        loading: false,
        config: previousConfig,
      }));
    }
  };

  const reset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/reset`, {
        method: 'POST',
        headers: { Authorization: state.authToken },
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: 'Configuration reset to defaults!',
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        setState(prevState => ({ ...prevState, error: 'Failed to reset configuration', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
    }
  };

  const savePrompt = async (languageCode: string, value: string) => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/prompts/${languageCode}`, {
        method: 'PUT',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: 'Prompt updated successfully!',
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        setState(prevState => ({ ...prevState, error: 'Failed to update prompt', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
    }
  };

  const saveInitialPrompt = async (languageCode: string, value: string) => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/initial-prompts/${languageCode}`, {
        method: 'PUT',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: 'Initial prompt updated successfully!',
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        setState(prevState => ({ ...prevState, error: 'Failed to update initial prompt', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
    }
  };

  const addLanguage = async (languageCode: string, prompt: string = '', initialPrompt: string = '') => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/languages`, {
        method: 'POST',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ languageCode, prompt, initialPrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: `Language ${languageCode} added successfully!`,
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        const errorData = await response.json();
        setState(prevState => ({ ...prevState, error: errorData.error || 'Failed to add language', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
    }
  };

  const removeLanguage = async (languageCode: string) => {
    if (!confirm(`Are you sure you want to remove the language "${languageCode}"?`)) {
      return;
    }

    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/languages/${languageCode}`, {
        method: 'DELETE',
        headers: {
          Authorization: state.authToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setState(prevState => ({
          ...prevState,
          config: data.config,
          success: `Language ${languageCode} removed successfully!`,
          loading: false,
        }));
        setTimeout(() => setState(prevState => ({ ...prevState, success: '' })), 3000);
      } else {
        const errorData = await response.json();
        setState(prevState => ({ ...prevState, error: errorData.error || 'Failed to remove language', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
    }
  };

  return {
    state,
    actions: {
      setPassword,
    },
    login,
    reset,
    savePrompt,
    saveInitialPrompt,
    addLanguage,
    removeLanguage,
    updateConfig,
  };
};

export default useAdminState;
