import React, { useEffect, useState } from 'react';
import { LockClosedIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, PlusIcon, TrashIcon, FlagIcon } from '@heroicons/react/24/outline';
import { API_URL } from '../lib/api';
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


interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  match_id: string;
  reason: string;
  transcript: string | null;
  created_at: number;
}

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment or bullying',
  sexual_content: 'Sexual or explicit content',
  hate_speech: 'Hate speech',
  spam: 'Spam or scam',
  other: 'Something else',
};

const sinceLabel = (ms: number): string => {
  const hours = (Date.now() - ms) / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/**
 * The moderation queue. The onboarding tells players a person reads every
 * report; this is where that person reads it. Reports older than 24h are
 * flagged, because that is the window app stores expect them acted on in.
 */
const ReportsCard: React.FC<{ authToken: string }> = ({ authToken }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: authToken },
      });
      if (!response.ok) throw new Error('Failed to load reports');
      const data = await response.json();
      setReports(data.reports || []);
    } catch {
      setError('Could not load the moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [authToken]);

  const resolve = async (id: string, status: 'reviewed' | 'actioned') => {
    setBusyId(id);
    try {
      const response = await fetch(`${API_URL}/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { Authorization: authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed');
      // The list only ever holds open reports, so a resolved one leaves it.
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Could not update that report. It is still in the queue.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminCard title={`Moderation Queue${reports.length ? ` (${reports.length})` : ''}`}>
      <div className="flex items-center justify-between -mt-2">
        <p className="text-sm text-slate-400">
          Open reports, newest first. Players are told these are read within 24 hours.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 ml-4 text-sm font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && reports.length === 0 && !error && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-700/30 px-4 py-6 text-slate-400">
          <CheckCircleIcon className="w-6 h-6 text-green-400 shrink-0" />
          <span>Nothing waiting. Every report has been dealt with.</span>
        </div>
      )}

      {reports.map((report) => {
        const stale = Date.now() - report.created_at > 86_400_000;
        return (
          <div key={report.id} className="bg-slate-700/30 p-4 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <FlagIcon className="w-5 h-5 text-red-400 shrink-0" />
              <span className="font-semibold text-slate-100">
                {REASON_LABELS[report.reason] || report.reason}
              </span>
              <span className={`text-sm ${stale ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                {sinceLabel(report.created_at)}{stale ? ' — over 24h' : ''}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-mono break-all">
              reported {report.reported_id} · by {report.reporter_id}
            </p>

            {report.transcript ? (
              <details className="group">
                <summary className="cursor-pointer text-sm text-cyan-300 hover:text-cyan-200">
                  Transcript
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900/70 p-3 text-sm text-slate-300">
                  {report.transcript}
                </pre>
              </details>
            ) : (
              <p className="text-sm text-slate-500 italic">No transcript was captured.</p>
            )}

            <div className="flex gap-3">
              <AdminButton
                onClick={() => resolve(report.id, 'reviewed')}
                disabled={busyId === report.id}
                className="bg-slate-600 hover:bg-slate-500 text-white"
              >
                No action needed
              </AdminButton>
              <AdminButton
                onClick={() => resolve(report.id, 'actioned')}
                disabled={busyId === report.id}
                className="bg-red-700 hover:bg-red-600 text-white"
              >
                Ban this player
              </AdminButton>
            </div>
          </div>
        );
      })}
    </AdminCard>
  );
};

const AdminPage: React.FC = () => {
  const {
    state,
    actions,
    login,
    reset,
    savePrompt,
    saveInitialPrompt,
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
            <ReportsCard authToken={state.authToken} />

            <AdminCard title="Free Rounds">
              <p className="text-sm text-slate-400 -mt-2">
                Lifetime allowances, not per day. A player who runs out is sent to sign up
                (guests) or to the paywall (members). Premium is always unlimited.
              </p>
              {([
                ['guest', 'Guest', 'Anonymous players, identified only by a browser-held device id.'],
                ['member', 'Signed-in member', 'Accounts without a subscription. Should exceed the guest cap, or signing up buys nothing.'],
                ['guestPerIp', 'Guest cap per IP', 'Backstop so clearing site data does not hand out a fresh allowance. Set well above the guest cap - offices and households share one address.'],
              ] as const).map(([key, label, help]) => (
                <LabeledInput key={key} label={label} description={help}>
                  <input
                    type="number"
                    min={0}
                    value={state.config.freeRounds?.[key] ?? 0}
                    onChange={(e) =>
                      updateConfig({
                        freeRounds: {
                          ...state.config!.freeRounds,
                          [key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        },
                      })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </LabeledInput>
              ))}
            </AdminCard>

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

            <AdminCard title="Initial Conversation Prompts">
              <p className="text-slate-400 text-sm mb-4">Control how the AI begins a new chat for each language</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.config.languages.map((lang) => (
                  <PromptEditor
                    key={lang}
                    title={`Initial Prompt (${lang.toUpperCase()})`}
                    initialValue={state.config.initialPrompts[lang] || ''}
                    onSave={(value) => saveInitialPrompt(lang, value)}
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
              <LabeledInput label="Round Duration (seconds)" description="How long each conversation lasts before the reveal">
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={state.config.conversationDurationSeconds}
                  onChange={(e) => {
                    const nextValue = Math.max(10, parseInt(e.target.value) || 0);
                    updateConfig({ conversationDurationSeconds: nextValue });
                  }}
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
