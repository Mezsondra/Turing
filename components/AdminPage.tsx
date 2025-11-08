import React from 'react';
import { LockClosedIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import useAdminState from '../hooks/useAdminState';
import PromptEditor from './PromptEditor'; // Assuming PromptEditor is in the same directory

// Reusable components for the Admin Page UI
const AdminCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 backdrop-blur-sm">
    <h2 className="text-2xl font-bold text-cyan-300 mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </div>
);

const LabeledInput: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div>
    <label className="block text-lg text-slate-300 mb-2">{label}</label>
    {children}
    {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
  </div>
);

const AdminButton: React.FC<{ onClick: () => void; className: string; children: React.ReactNode; disabled?: boolean }> = ({ onClick, className, children, disabled }) => (
  <button onClick={onClick} className={`w-full font-bold py-2 px-4 rounded-md transition-all duration-300 ${className}`} disabled={disabled}>
    {disabled && <ArrowPathIcon className="w-5 h-5 animate-spin mr-2 inline-block" />}
    {children}
  </button>
);

const AdminPage: React.FC = () => {
  const {
    state,
    actions,
    login,
    reset,
    savePrompt,
    updateConfig,
  } = useAdminState();

  if (!state.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-800 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-700 backdrop-blur-md">
          <div className="flex flex-col items-center">
            <LockClosedIcon className="w-12 h-12 text-cyan-400 mb-4" />
            <h1 className="text-3xl font-bold text-cyan-400 mb-6">Admin Panel</h1>
          </div>

          <form onSubmit={login} className="space-y-4">
            <LabeledInput label="Password">
              <input
                id="password"
                type="password"
                value={state.password}
                onChange={(e) => actions.setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Enter admin password"
                required
              />
            </LabeledInput>

            {state.error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md flex items-center">
                <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                {state.error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-md transition-transform transform hover:scale-105"
              disabled={state.loading}
            >
              {state.loading ? <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto" /> : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (state.loading && !state.config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-800 flex items-center justify-center">
        <ArrowPathIcon className="w-8 h-8 text-cyan-400 animate-spin mr-2" />
        <div className="text-cyan-400 text-xl">Loading configuration...</div>
      </div>
    );
  }

  if (!state.config) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-cyan-300">Admin Dashboard</h1>
          <a href="/" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md transition-colors">
            Back to Game
          </a>
        </div>

        {state.success && (
          <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-md mb-4 flex items-center">
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            {state.success}
          </div>
        )}

        {state.error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md mb-4 flex items-center">
            <ExclamationCircleIcon className="w-5 h-5 mr-2" />
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminCard title="AI Behavior">
                <LabeledInput label={`Human-Like Ratio: ${Math.round(state.config.humanLikeRatio * 100)}%`} description="Probability that AI acts human-like vs assistant-like">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={state.config.humanLikeRatio * 100}
                    onChange={(e) =>
                      updateConfig({ humanLikeRatio: parseInt(e.target.value) / 100 })
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    disabled={state.loading}
                  />
                </LabeledInput>
                <LabeledInput label="Default Behavior">
                  <select
                    value={state.config.aiDefaultBehavior}
                    onChange={(e) =>
                      updateConfig({
                        aiDefaultBehavior: e.target.value as 'HUMAN_LIKE' | 'AI_LIKE',
                      })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={state.loading}
                  >
                    <option value="HUMAN_LIKE">Human-Like</option>
                    <option value="AI_LIKE">AI Assistant-Like</option>
                  </select>
                </LabeledInput>
              </AdminCard>

              <AdminCard title="AI Provider">
                <LabeledInput label="Provider">
                  <select
                    value={state.config.aiProvider}
                    onChange={(e) =>
                      updateConfig({ aiProvider: e.target.value as 'gemini' | 'openai' | 'xai' })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={state.loading}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">XAI</option>
                  </select>
                </LabeledInput>
              </AdminCard>
            </div>

            <AdminCard title="AI Prompts">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptEditor
                  title="Human-Like (English)"
                  initialValue={state.config.prompts.global.humanLike.en}
                  onSave={(value) => savePrompt('humanLike', 'en', value)}
                  loading={state.loading}
                />
                <PromptEditor
                  title="Human-Like (Turkish)"
                  initialValue={state.config.prompts.global.humanLike.tr}
                  onSave={(value) => savePrompt('humanLike', 'tr', value)}
                  loading={state.loading}
                />
                <PromptEditor
                  title="AI-Like (English)"
                  initialValue={state.config.prompts.global.aiLike.en}
                  onSave={(value) => savePrompt('aiLike', 'en', value)}
                  loading={state.loading}
                />
                <PromptEditor
                  title="AI-Like (Turkish)"
                  initialValue={state.config.prompts.global.aiLike.tr}
                  onSave={(value) => savePrompt('aiLike', 'tr', value)}
                  loading={state.loading}
                />
              </div>
            </AdminCard>
          </div>

          <div className="space-y-6">
            <AdminCard title="Matchmaking">
              <LabeledInput label={`AI Match Probability: ${Math.round(state.config.aiMatchProbability * 100)}%`} description="Probability of matching users with AI immediately">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={state.config.aiMatchProbability * 100}
                  onChange={(e) =>
                    updateConfig({ aiMatchProbability: parseInt(e.target.value) / 100 })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  disabled={state.loading}
                />
              </LabeledInput>
              <LabeledInput label="Match Timeout (ms)" description="Time to wait before matching with AI">
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={state.config.matchTimeoutMs}
                  onChange={(e) =>
                    updateConfig({ matchTimeoutMs: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  disabled={state.loading}
                />
              </LabeledInput>
            </AdminCard>

            <AdminCard title="Quick Actions">
              <AdminButton onClick={() => updateConfig({ humanLikeRatio: 1.0, aiDefaultBehavior: 'HUMAN_LIKE' })} className="bg-green-600 hover:bg-green-700" disabled={state.loading}>
                Force 100% Human-Like
              </AdminButton>
              <AdminButton onClick={() => updateConfig({ humanLikeRatio: 0.0, aiDefaultBehavior: 'AI_LIKE' })} className="bg-purple-600 hover:bg-purple-700" disabled={state.loading}>
                Force 100% Assistant-Like
              </AdminButton>
              <AdminButton onClick={() => updateConfig({ humanLikeRatio: 0.5 })} className="bg-blue-600 hover:bg-blue-700" disabled={state.loading}>
                50/50 Mix
              </AdminButton>
              <AdminButton onClick={reset} className="bg-red-600 hover:bg-red-700" disabled={state.loading}>
                Reset to Defaults
              </AdminButton>
            </AdminCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
