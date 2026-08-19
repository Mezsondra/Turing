import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import Timer from './Timer';
import LoadingSpinner from './LoadingSpinner';
import { useSettings } from '../context/SettingsContext';
import { useTranslations } from '../hooks/useTranslations';
import { playSound } from '../lib/audio';
import { triggerVibration } from '../lib/vibration';
import { socketService } from '../services/socketService';

interface ChatScreenProps {
  onTimeUp: (actualPartner: 'HUMAN' | 'AI', matchId: string) => void;
  score: number;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onTimeUp, score }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'searching' | 'matched' | 'error'>('connecting');
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null);
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

          socketService.onMatched(({ roundEndsAt: endsAt, roundDurationSeconds }) => {
            if (!mounted) return;
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

          socketService.onError(({ message }) => {
            if (!mounted) return;
            console.error('Socket error:', message);
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
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
        <LoadingSpinner />
        <p className="text-xl text-slate-300 mt-4">
          {connectionStatus === 'connecting' ? t('connecting') || 'Connecting...' : t('searching_partner') || 'Searching for a partner...'}
        </p>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
        <p className="text-xl text-red-400">Failed to connect to server</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-full"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-800">
      <header className="bg-slate-900/70 backdrop-blur-sm p-4 flex justify-between items-center border-b border-slate-700 sticky top-0">
        <h2 className="text-xl font-bold text-slate-200">{t('score')}: <span className="text-cyan-400">{score}</span></h2>
        {roundEndsAt && <Timer endsAt={roundEndsAt} />}
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
    </div>
  );
};

export default ChatScreen;
