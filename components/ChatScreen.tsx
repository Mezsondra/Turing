import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import Timer from './Timer';
import LoadingSpinner from './LoadingSpinner';
import { useSettings } from '../context/SettingsContext';
import { useTranslations } from '../hooks/useTranslations';
import { playSound } from '../lib/audio';
import { triggerVibration } from '../lib/vibration';
import { socketService } from '../services/socketService';
import ReportModal from './ReportModal';
import ExitToMenu from './ExitToMenu';

interface ChatScreenProps {
  onTimeUp: (actualPartner: 'HUMAN' | 'AI', matchId: string) => void;
  score: number;
  onExit: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onTimeUp, score, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'searching' | 'matched' | 'error'>('connecting');
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);
  const { language, isSoundEnabled, isVibrationEnabled } = useSettings();
  const { t } = useTranslations();

  // Read through refs so changing a setting mid-match does not tear down the
  // socket and throw the player back into the queue.
  const soundRef = useRef(isSoundEnabled);
  const vibrationRef = useRef(isVibrationEnabled);
  useEffect(() => { soundRef.current = isSoundEnabled; }, [isSoundEnabled]);
  useEffect(() => { vibrationRef.current = isVibrationEnabled; }, [isVibrationEnabled]);

  useEffect(() => {
    let mounted = true;
    const unsubscribers: Array<() => void> = [];

    const initializeConnection = async () => {
      try {
        setConnectionStatus('connecting');
        await socketService.connect();

        if (!mounted) return;

        unsubscribers.push(
          socketService.onSearching(() => {
            if (mounted) setConnectionStatus('searching');
          }),

          socketService.onMatched(({ matchId: newMatchId, roundEndsAt: endsAt, roundDurationSeconds }) => {
            if (!mounted) return;
            setMatchId(newMatchId);
            setRoundEndsAt(endsAt ?? Date.now() + (roundDurationSeconds ?? 60) * 1000);
            setConnectionStatus('matched');
            setMessages([]);
            setIsPartnerTyping(false);
          }),

          socketService.onMessage(({ text }) => {
            if (!mounted) return;
            if (soundRef.current) playSound('received');
            if (vibrationRef.current) triggerVibration();
            setMessages((prev) => [...prev, { role: 'model', text }]);
            setIsPartnerTyping(false);
          }),

          socketService.onPartnerTyping(({ isTyping }) => {
            if (mounted) setIsPartnerTyping(isTyping);
          }),

          // The server ends the round and reveals the partner, so both players
          // in a human-vs-human match stop at exactly the same moment.
          socketService.onRevealPartner(({ actualPartnerType, matchId }) => {
            if (mounted) onTimeUpRef.current(actualPartnerType, matchId);
          }),

          socketService.onPartnerDisconnected(() => {
            if (mounted) {
              alert('Your partner has disconnected. Returning to welcome screen.');
              window.location.reload();
            }
          }),

          // The server refused to deliver a message: tell the sender why,
          // rather than letting it silently vanish.
          socketService.onMessageBlocked(({ reason }) => {
            if (!mounted) return;
            setNotice(reason === 'contact' ? t('message_blocked_contact') : t('message_blocked_abuse'));
            setTimeout(() => mounted && setNotice(null), 4000);
          }),

          socketService.onError(({ message, code }) => {
            if (!mounted) return;
            console.error('Socket error:', message);
            // Say what actually went wrong. Reporting an AI outage as a
            // connection failure sends players debugging the wrong thing.
            setErrorMessage(code === 'ai_unavailable' ? t('ai_unavailable') : message);
            setConnectionStatus('error');
          })
        );

        socketService.joinQueue(language);
      } catch (error) {
        console.error('Failed to connect:', error);
        if (mounted) setConnectionStatus('error');
      }
    };

    initializeConnection();

    return () => {
      mounted = false;
      // Detach only this screen's listeners. The socket itself stays open: the
      // guess is submitted from App after this component unmounts, and closing
      // the socket would destroy the match server-side before it arrives.
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || connectionStatus !== 'matched') return;

    if (soundRef.current) playSound('sent');

    const userMessage: Message = { role: 'user', text: inputValue };
    setMessages((prev) => [...prev, userMessage]);

    // Send message via socket
    socketService.sendMessage(inputValue);
    setInputValue('');

    // Stop typing indicator
    socketService.sendTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Send typing indicator to partner (only for human matches)
    if (e.target.value.trim() && connectionStatus === 'matched') {
      socketService.sendTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing indicator after 1 second of no typing
      typingTimeoutRef.current = setTimeout(() => {
        socketService.sendTyping(false);
      }, 1000);
    } else {
      socketService.sendTyping(false);
    }
  };

  // Show loading/searching state
  if (connectionStatus === 'connecting' || connectionStatus === 'searching') {
    const statusText = connectionStatus === 'connecting'
      ? t('connecting') || 'Connecting...'
      : t('searching_partner') || 'Searching for a partner...';

    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
        <ExitToMenu onExit={onExit} className="absolute top-5 left-5" />
        <LoadingSpinner />
        <span className="sr-only" aria-live="polite">{statusText}</span>
        <div className="relative mt-4 h-7 w-full max-w-sm" aria-hidden="true">
          <p
            className="matchmaking-status text-xl text-slate-300"
            data-state={connectionStatus === 'connecting' ? 'current' : 'left'}
          >
            {t('connecting') || 'Connecting...'}
          </p>
          <p
            className="matchmaking-status text-xl text-slate-300"
            data-state={connectionStatus === 'searching' ? 'current' : undefined}
          >
            {t('searching_partner') || 'Searching for a partner...'}
          </p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    const retry = () => {
      setErrorMessage(null);
      // Still connected in most cases, so re-queue rather than reload.
      if (socketService.isConnected()) {
        setConnectionStatus('searching');
        socketService.joinQueue(language);
      } else {
        window.location.reload();
      }
    };

    return (
      <div className="relative flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
        <ExitToMenu onExit={onExit} className="absolute top-5 left-5" />
        <p className="text-xl text-red-400 max-w-sm">{errorMessage || t('connection_failed')}</p>
        <button
          onClick={retry}
          className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-full"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-800">
      <header className="bg-slate-900/70 backdrop-blur-sm p-4 flex justify-between items-center border-b border-slate-700 sticky top-0">
        <div className="flex items-center gap-4">
          <ExitToMenu onExit={onExit} confirm />
          <h2 className="text-xl font-bold text-slate-200">{t('score')}: <span className="text-cyan-400">{score}</span></h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReporting(true)}
            className="text-slate-400 hover:text-red-400 text-sm font-semibold transition-colors"
          >
            ⚑ {t('report')}
          </button>
          {roundEndsAt && <Timer endsAt={roundEndsAt} />}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`message-enter flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-lg' : 'bg-slate-700 text-slate-200 rounded-bl-lg'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isPartnerTyping && (
          <div className="flex justify-start">
            <div className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-2xl bg-slate-700 text-slate-200 rounded-bl-lg flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-0"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-200"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-400"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {notice && (
        <div className="bg-amber-500/15 border-t border-amber-500/40 text-amber-300 text-sm text-center py-2 px-4">
          {notice}
        </div>
      )}

      <footer className="bg-slate-900 p-4 sticky bottom-0 border-t border-slate-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={t('type_your_message')}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-full py-2 px-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={connectionStatus !== 'matched'}
            aria-label={t('type_your_message')}
          />
          <button
            type="submit"
            className="bg-cyan-500 text-white rounded-full p-3 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            disabled={!inputValue.trim() || connectionStatus !== 'matched'}
            aria-label="Send Message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </footer>

      {isReporting && (
        <ReportModal
          onClose={() => setIsReporting(false)}
          onSubmit={(reason) => {
            if (matchId) {
              // Send the transcript so a moderator can see the context.
              const transcript = messages.map((m) => `${m.role}: ${m.text}`).join('\n');
              socketService.reportPartner(matchId, reason, transcript);
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatScreen;
