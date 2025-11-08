import React, { useState, useEffect } from 'react';
import ToggleSwitch from './ToggleSwitch';

interface AdminConfig {
  aiDefaultBehavior: 'HUMAN_LIKE' | 'AI_LIKE';
  humanLikeRatio: number;
  aiProvider: 'gemini' | 'openai';
  aiMatchProbability: number;
  matchTimeoutMs: number;
  prompts: {
    global: {
      humanLike: {
        en: string;
        tr: string;
      };
      aiLike: {
        en: string;
        tr: string;
      };
    };
  };
}

const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authToken, setAuthToken] = useState<string>('');

  // Edit states
  const [editingPrompt, setEditingPrompt] = useState<{
    type: 'humanLike' | 'aiLike';
    lang: 'en' | 'tr';
    value: string;
  } | null>(null);

  const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const token = `Bearer ${password}`;
    setAuthToken(token);

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        headers: { Authorization: token },
      });

      if (response.ok) {
        setIsAuthenticated(true);
        loadConfig(token);
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const loadConfig = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        headers: { Authorization: token },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      } else {
        setError('Failed to load configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<AdminConfig>) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        method: 'PUT',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setSuccess('Configuration updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to update configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/admin/reset`, {
        method: 'POST',
        headers: { Authorization: authToken },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setSuccess('Configuration reset to defaults!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to reset configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    if (!editingPrompt || !config) return;

    const { type, lang, value } = editingPrompt;

    const updates: AdminConfig = {
      ...config,
      prompts: {
        ...config.prompts,
        global: {
          ...config.prompts.global,
          [type]: {
            ...config.prompts.global[type],
            [lang]: value,
          },
        },
      },
    };

    await updateConfig(updates);
    setEditingPrompt(null);
  };

  const renderPromptPreview = (text: string) => {
    if (text.length <= 100) {
      return text;
    }
    return `${text.substring(0, 100)}...`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-700">
          <h1 className="text-3xl font-bold text-cyan-400 mb-6 text-center">Admin Panel</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-lg text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Enter admin password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-md transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading configuration...</div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-cyan-400">Admin Panel</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md"
          >
            Back to Game
          </button>
        </div>

        {success && (
          <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-md mb-4">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Behavior Settings */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">AI Behavior</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-lg text-slate-300 mb-2">
                  Human-Like Ratio: {Math.round(config.humanLikeRatio * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.humanLikeRatio * 100}
                  onChange={(e) =>
                    updateConfig({ humanLikeRatio: parseInt(e.target.value) / 100 })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-sm text-slate-400 mt-1">
                  Probability that AI acts human-like vs assistant-like
                </p>
              </div>

              <div>
                <label className="block text-lg text-slate-300 mb-2">Default Behavior</label>
                <select
                  value={config.aiDefaultBehavior}
                  onChange={(e) =>
                    updateConfig({
                      aiDefaultBehavior: e.target.value as 'HUMAN_LIKE' | 'AI_LIKE',
                    })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="HUMAN_LIKE">Human-Like</option>
                  <option value="AI_LIKE">AI Assistant-Like</option>
                </select>
              </div>
            </div>
          </div>

          {/* Provider Settings */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">AI Provider</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-lg text-slate-300 mb-2">Provider</label>
                <select
                  value={config.aiProvider}
                  onChange={(e) =>
                    updateConfig({ aiProvider: e.target.value as 'gemini' | 'openai' })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
            </div>
          </div>

          {/* Matchmaking Settings */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">Matchmaking</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-lg text-slate-300 mb-2">
                  AI Match Probability: {Math.round(config.aiMatchProbability * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.aiMatchProbability * 100}
                  onChange={(e) =>
                    updateConfig({ aiMatchProbability: parseInt(e.target.value) / 100 })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-sm text-slate-400 mt-1">
                  Probability of matching users with AI immediately
                </p>
              </div>

              <div>
                <label className="block text-lg text-slate-300 mb-2">
                  Match Timeout (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={config.matchTimeoutMs}
                  onChange={(e) =>
                    updateConfig({ matchTimeoutMs: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-sm text-slate-400 mt-1">
                  Time to wait before matching with AI (default: 10000ms)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">Quick Actions</h2>

            <div className="space-y-3">
              <button
                onClick={() =>
                  updateConfig({
                    humanLikeRatio: 1.0,
                    aiDefaultBehavior: 'HUMAN_LIKE',
                  })
                }
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Force 100% Human-Like
              </button>

              <button
                onClick={() =>
                  updateConfig({
                    humanLikeRatio: 0.0,
                    aiDefaultBehavior: 'AI_LIKE',
                  })
                }
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Force 100% Assistant-Like
              </button>

              <button
                onClick={() =>
                  updateConfig({
                    humanLikeRatio: 0.5,
                  })
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                50/50 Mix
              </button>

              <button
                onClick={resetConfig}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        {/* AI Prompts Section */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mt-6">
          <h2 className="text-2xl font-bold text-cyan-400 mb-4">AI Prompts</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Human-Like Prompts */}
            <div>
              <h3 className="text-xl font-semibold text-green-400 mb-3">Human-Like Behavior</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-md text-slate-300 mb-2">English</label>
                  {editingPrompt?.type === 'humanLike' && editingPrompt.lang === 'en' ? (
                    <div>
                      <textarea
                        value={editingPrompt.value}
                        onChange={(e) =>
                          setEditingPrompt({ ...editingPrompt, value: e.target.value })
                        }
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={savePrompt}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md">
                        {renderPromptPreview(config.prompts.global.humanLike.en)}
                      </p>
                      <button
                        onClick={() =>
                          setEditingPrompt({
                            type: 'humanLike',
                            lang: 'en',
                            value: config.prompts.global.humanLike.en,
                          })
                        }
                        className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1 rounded-md text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-md text-slate-300 mb-2">Turkish</label>
                  {editingPrompt?.type === 'humanLike' && editingPrompt.lang === 'tr' ? (
                    <div>
                      <textarea
                        value={editingPrompt.value}
                        onChange={(e) =>
                          setEditingPrompt({ ...editingPrompt, value: e.target.value })
                        }
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={savePrompt}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md">
                        {renderPromptPreview(config.prompts.global.humanLike.tr)}
                      </p>
                      <button
                        onClick={() =>
                          setEditingPrompt({
                            type: 'humanLike',
                            lang: 'tr',
                            value: config.prompts.global.humanLike.tr,
                          })
                        }
                        className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1 rounded-md text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI-Like Prompts */}
            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-3">AI Assistant Behavior</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-md text-slate-300 mb-2">English</label>
                  {editingPrompt?.type === 'aiLike' && editingPrompt.lang === 'en' ? (
                    <div>
                      <textarea
                        value={editingPrompt.value}
                        onChange={(e) =>
                          setEditingPrompt({ ...editingPrompt, value: e.target.value })
                        }
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={savePrompt}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md">
                        {renderPromptPreview(config.prompts.global.aiLike.en)}
                      </p>
                      <button
                        onClick={() =>
                          setEditingPrompt({
                            type: 'aiLike',
                            lang: 'en',
                            value: config.prompts.global.aiLike.en,
                          })
                        }
                        className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1 rounded-md text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-md text-slate-300 mb-2">Turkish</label>
                  {editingPrompt?.type === 'aiLike' && editingPrompt.lang === 'tr' ? (
                    <div>
                      <textarea
                        value={editingPrompt.value}
                        onChange={(e) =>
                          setEditingPrompt({ ...editingPrompt, value: e.target.value })
                        }
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={savePrompt}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md">
                        {renderPromptPreview(config.prompts.global.aiLike.tr)}
                      </p>
                      <button
                        onClick={() =>
                          setEditingPrompt({
                            type: 'aiLike',
                            lang: 'tr',
                            value: config.prompts.global.aiLike.tr,
                          })
                        }
                        className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1 rounded-md text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
