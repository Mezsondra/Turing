import React, { useEffect, useState } from 'react';
import { LockClosedIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import useAdminState from '../hooks/useAdminState';
import PromptEditor from './PromptEditor';

type ProviderKey = 'gemini' | 'openai' | 'xai';

type ProviderDrafts = Record<ProviderKey, {
  apiKey: string;
  model: string;
  apiBaseUrl?: string;
}>;

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
    addLanguage,
    removeLanguage,
    updateConfig,
  } = useAdminState();

  const [newLanguageCode, setNewLanguageCode] = useState('');
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [providerDrafts, setProviderDrafts] = useState<ProviderDrafts>({
    gemini: { apiKey: '', model: '', apiBaseUrl: '' },
    openai: { apiKey: '', model: '', apiBaseUrl: '' },
    xai: { apiKey: '', model: '', apiBaseUrl: '' },
  });

  useEffect(() => {
    if (state.config) {
      setProviderDrafts({
        gemini: { ...state.config.aiProviders.gemini },
        openai: { ...state.config.aiProviders.openai },
        xai: { ...state.config.aiProviders.xai },
      });
    }
  }, [state.config]);

  const providerLabels: Record<ProviderKey, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    xai: 'XAI',
  };

  const handleProviderDraftChange = (
    provider: ProviderKey,
    field: 'apiKey' | 'model' | 'apiBaseUrl',
    value: string,
  ) => {
    setProviderDrafts(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const handleProviderSave = (provider: ProviderKey) => {
    if (!state.config) return;
    const current = state.config.aiProviders[provider];
    const draft = providerDrafts[provider];

    if (
      current &&
      draft &&
      current.apiKey === draft.apiKey &&
      current.model === draft.model &&
      (current.apiBaseUrl || '') === (draft.apiBaseUrl || '')
    ) {
      return;
    }

    updateConfig({ aiProviders: { [provider]: draft } });
  };

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

  const handleAddLanguage = () => {
    if (!newLanguageCode.trim()) return;
    addLanguage(newLanguageCode.trim().toLowerCase());
    setNewLanguageCode('');
    setShowAddLanguage(false);
  };

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
            <AdminCard title="AI Provider">
              <LabeledInput label="Provider">
                <select
                  value={state.config.aiProvider}
                  onChange={(e) =>
                    updateConfig({ aiProvider: e.target.value as ProviderKey })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  disabled={state.loading}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="xai">XAI</option>
                </select>
              </LabeledInput>

              <div className="space-y-4 pt-2">
                {(Object.keys(providerLabels) as ProviderKey[]).map((provider) => {
                  const currentSettings = state.config.aiProviders[provider];
                  const draftSettings = providerDrafts[provider];
                  const hasChanges = Boolean(
                    currentSettings &&
                      draftSettings &&
                      (
                        currentSettings.apiKey !== draftSettings.apiKey ||
                        currentSettings.model !== draftSettings.model ||
                        (currentSettings.apiBaseUrl || '') !== (draftSettings.apiBaseUrl || '')
                      ),
                  );
                  const saveButtonClasses = `bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center gap-2 ${hasChanges ? '' : 'opacity-50 cursor-not-allowed'}`;

                  return (
                    <div key={provider} className="bg-slate-700/30 p-4 rounded-lg space-y-3">
                      <h3 className="text-lg font-semibold text-cyan-200">{providerLabels[provider]} Settings</h3>
                      <LabeledInput label="API Key" description="Stored securely on the server">
                        <input
                          type="password"
                          value={providerDrafts[provider]?.apiKey || ''}
                          onChange={(e) => handleProviderDraftChange(provider, 'apiKey', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          placeholder="Enter API key"
                          autoComplete="off"
                        />
                      </LabeledInput>
                      <LabeledInput label="Model" description="Select the model to use for this provider">
                        <input
                          type="text"
                          value={providerDrafts[provider]?.model || ''}
                          onChange={(e) => handleProviderDraftChange(provider, 'model', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          placeholder="e.g., gpt-4o-mini"
                        />
                      </LabeledInput>
                      {(provider === 'openai' || provider === 'xai') && (
                        <LabeledInput
                          label="API Base URL"
                          description="Override the default endpoint if using a compatible service"
                        >
                          <input
                            type="text"
                            value={providerDrafts[provider]?.apiBaseUrl || ''}
                            onChange={(e) => handleProviderDraftChange(provider, 'apiBaseUrl', e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="https://api.openai.com/v1"
                          />
                        </LabeledInput>
                      )}
                      <AdminButton
                        onClick={() => handleProviderSave(provider)}
                        className={saveButtonClasses}
                        disabled={state.loading}
                      >
                        Save {providerLabels[provider]} Settings
                      </AdminButton>
                    </div>
                  );
                })}
              </div>
            </AdminCard>

            <AdminCard title="Language Management">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-300">Manage available languages</p>
                <button
                  onClick={() => setShowAddLanguage(!showAddLanguage)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                  disabled={state.loading}
                >
                  <PlusIcon className="w-5 h-5" />
                  Add Language
                </button>
              </div>

              {showAddLanguage && (
                <div className="bg-slate-700/50 p-4 rounded-lg mb-4">
                  <LabeledInput label="Language Code" description="e.g., 'es' for Spanish, 'fr' for French">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLanguageCode}
                        onChange={(e) => setNewLanguageCode(e.target.value)}
                        className="flex-1 bg-slate-600 border border-slate-500 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Language code"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddLanguage()}
                      />
                      <button
                        onClick={handleAddLanguage}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                        disabled={state.loading || !newLanguageCode.trim()}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddLanguage(false);
                          setNewLanguageCode('');
                        }}
                        className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </LabeledInput>
                </div>
              )}

              <div className="space-y-2">
                {state.config.languages.map((lang) => (
                  <div key={lang} className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg">
                    <span className="text-white font-mono">{lang}</span>
                    {lang !== 'en' && (
                      <button
                        onClick={() => removeLanguage(lang)}
                        className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1 rounded-md flex items-center gap-1 transition-colors"
                        disabled={state.loading}
                      >
                        <TrashIcon className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                    {lang === 'en' && (
                      <span className="text-slate-400 text-sm">Default language</span>
                    )}
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard title="AI Prompts">
              <p className="text-slate-400 text-sm mb-4">Configure the AI's behavior prompt for each language</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.config.languages.map((lang) => (
                  <PromptEditor
                    key={lang}
                    title={`Prompt (${lang.toUpperCase()})`}
                    initialValue={state.config.prompts[lang] || ''}
                    onSave={(value) => savePrompt(lang, value)}
                    loading={state.loading}
                  />
                ))}
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
              <AdminButton onClick={() => updateConfig({ aiMatchProbability: 1.0 })} className="bg-green-600 hover:bg-green-700" disabled={state.loading}>
                Force 100% AI Matches
              </AdminButton>
              <AdminButton onClick={() => updateConfig({ aiMatchProbability: 0.0 })} className="bg-blue-600 hover:bg-blue-700" disabled={state.loading}>
                Disable AI Matches
              </AdminButton>
              <AdminButton onClick={() => updateConfig({ aiMatchProbability: 0.5 })} className="bg-purple-600 hover:bg-purple-700" disabled={state.loading}>
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
