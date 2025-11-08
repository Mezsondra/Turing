import { useState } from 'react';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface AdminConfig {
  aiProvider: 'gemini' | 'openai' | 'xai';
  aiMatchProbability: number;
  matchTimeoutMs: number;
  languages: string[];
  prompts: {
    [languageCode: string]: string;
  };
}

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

  const updateConfig = async (updates: Partial<AdminConfig>) => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    const newConfig = { ...state.config, ...updates };

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        method: 'PUT',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
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
        setState(prevState => ({ ...prevState, error: 'Failed to update configuration', loading: false }));
      }
    } catch (err) {
      setState(prevState => ({ ...prevState, error: 'Failed to connect to server', loading: false }));
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

  const addLanguage = async (languageCode: string, prompt: string = '') => {
    setState(prevState => ({ ...prevState, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_URL}/api/admin/languages`, {
        method: 'POST',
        headers: {
          Authorization: state.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ languageCode, prompt }),
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
    addLanguage,
    removeLanguage,
    updateConfig,
  };
};

export default useAdminState;
