import React, { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';
import GuessScreen from './components/GuessScreen';
import ResultScreen from './components/ResultScreen';
import AdminPage from './components/AdminPage';
import AdModal from './components/AdModal';
import PremiumModal, { PremiumPlan } from './components/PremiumModal';
import AuthModal from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { useTranslations } from './hooks/useTranslations';
import { GameState } from './types';
import { socketService } from './services/socketService';

const App: React.FC = () => {
  const { isAuthenticated, isPremium, upgrade } = useAuth();
  const { t } = useTranslations();
  const [modal, setModal] = useState<'none' | 'ad' | 'premium' | 'auth'>('none');
  const [pendingAd, setPendingAd] = useState(false);
  const [gameState, setGameState] = useState<GameState>(GameState.WELCOME);
  const [lastGuessCorrect, setLastGuessCorrect] = useState(false);
  const [partnerType, setPartnerType] = useState<'HUMAN' | 'AI'>('AI');
  const [matchId, setMatchId] = useState<string>('');
  const [fooledPartner, setFooledPartner] = useState(false);
  const [scoreData, setScoreData] = useState({
    score: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    currentStreak: 0,
    bestStreak: 0,
    timesFooled: 0,
  });

  // Score and stats come from the server, which owns them. The client never
  // computes a score - it only displays what it is told.
  useEffect(() => {
    // Connect at app start, not when the chat opens, so the welcome screen can
    // show the player's streak - which is what makes it worth coming back for.
    socketService.connect().catch((error) => console.error('Connection failed:', error));

    const unsubscribeStats = socketService.onStats(setScoreData);

    // A human partner may declare you a bot before or after your own guess
    // lands, so this is tracked separately rather than folded into the result.
    const unsubscribeVerdict = socketService.onPartnerVerdict(({ fooledPartner: fooled }) => {
      setFooledPartner(fooled);
    });

    const unsubscribeGuess = socketService.onGuessResult((result) => {
      if (result.error) {
        console.error('Error submitting guess:', result.error);
        return;
      }

      setLastGuessCorrect(result.wasCorrect);
      setPendingAd(Boolean(result.shouldShowAd));
      setScoreData({
        score: result.score,
        gamesPlayed: result.gamesPlayed,
        gamesWon: result.gamesWon,
        gamesLost: result.gamesLost,
        currentStreak: result.currentStreak,
        bestStreak: result.bestStreak,
        timesFooled: result.timesFooled,
      });
      setGameState(GameState.RESULT);
    });

    return () => {
      unsubscribeStats();
      unsubscribeVerdict();
      unsubscribeGuess();
    };
  }, []);

  const handleStartGame = () => {
    setFooledPartner(false);
    setGameState(GameState.CHATTING);
  };

  const handleTimeUp = (actualPartner: 'HUMAN' | 'AI', currentMatchId: string) => {
    // The actual partner type is now revealed by the server
    setPartnerType(actualPartner);
    setMatchId(currentMatchId);
    setGameState(GameState.GUESSING);
  };

  const handleGuess = (guess: 'HUMAN' | 'AI') => {
    try {
      socketService.submitGuess(matchId, guess);
    } catch (error) {
      console.error('Failed to submit guess:', error);
    }
  };

  const handlePlayAgain = () => {
    // Premium removes the interstitial entirely; everyone else sees one every
    // few rounds, and the server decides when.
    if (pendingAd && !isPremium) {
      setModal('ad');
      return;
    }
    setGameState(GameState.WELCOME);
  };

  const dismissAd = () => {
    setPendingAd(false);
    setModal('none');
    setGameState(GameState.WELCOME);
  };

  // Premium has to be attached to an account, or it would vanish with the
  // browser storage the player never knew existed.
  const openPremium = () => setModal(isAuthenticated ? 'premium' : 'auth');

  const handleUpgrade = async (plan: PremiumPlan) => {
    await upgrade(plan);
  };

  const renderGameState = () => {
    switch (gameState) {
      case GameState.CHATTING:
        return <ChatScreen onTimeUp={handleTimeUp} score={scoreData.score} />;
      case GameState.GUESSING:
        return <GuessScreen onGuess={handleGuess} />;
      case GameState.RESULT:
        return <ResultScreen
          wasCorrect={lastGuessCorrect}
          actualPartner={partnerType}
          onPlayAgain={handlePlayAgain}
          score={scoreData.score}
          gamesPlayed={scoreData.gamesPlayed}
          gamesWon={scoreData.gamesWon}
          gamesLost={scoreData.gamesLost}
          currentStreak={scoreData.currentStreak}
          bestStreak={scoreData.bestStreak}
          timesFooled={scoreData.timesFooled}
          fooledPartner={fooledPartner}
        />;
      case GameState.WELCOME:
      default:
        return (
          <WelcomeScreen
            onStartGame={handleStartGame}
            score={scoreData.score}
            currentStreak={scoreData.currentStreak}
            gamesPlayed={scoreData.gamesPlayed}
            isPremium={isPremium}
            onOpenAccount={() => setModal(isAuthenticated ? 'premium' : 'auth')}
          />
        );
    }
  };

  // Check if we're on the admin page
  const isAdminPage = window.location.pathname === '/admin';

  if (isAdminPage) {
    return <AdminPage />;
  }

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      {renderGameState()}

      {modal === 'ad' && <AdModal onClose={dismissAd} onUpgrade={openPremium} />}
      {modal === 'premium' && (
        <PremiumModal onClose={() => setModal('none')} onUpgrade={handleUpgrade} />
      )}
      {modal === 'auth' && (
        <AuthModal onClose={() => setModal('none')} reason={t('login_to_upgrade')} />
      )}
    </div>
  );
};

export default App;
