import React, { useState, useEffect, useRef } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';
import GuessScreen from './components/GuessScreen';
import ResultScreen from './components/ResultScreen';
import AdminPage from './components/AdminPage';
import LoadingSpinner from './components/LoadingSpinner';
import AdModal from './components/AdModal';
import PremiumModal, { PremiumPlan } from './components/PremiumModal';
import AuthModal from './components/AuthModal';
import AgeGate, { hasConfirmedAge } from './components/AgeGate';
import Onboarding, { hasOnboarded } from './components/onboarding/Onboarding';
import { useAuth } from './context/AuthContext';
import { useTranslations } from './hooks/useTranslations';
import { GameState } from './types';
import { socketService } from './services/socketService';

const App: React.FC = () => {
  const { isAuthenticated, isPremium, isLoading: isAuthLoading, upgrade } = useAuth();
  const { t } = useTranslations();
  const [modal, setModal] = useState<'none' | 'ad' | 'premium' | 'auth'>('none');
  const [pendingAd, setPendingAd] = useState(false);
  const [roundsLeft, setRoundsLeft] = useState<number | null>(null);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(hasConfirmedAge);
  const [onboarded, setOnboarded] = useState(hasOnboarded);

  // Token verification resolves after mount, so isAuthenticated flips to true
  // without a re-render of the socket effect. Read it through a ref.
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);

  // The socket subscriptions below register once, so a t() captured in there
  // would keep speaking whatever language was loaded first.
  const tRef = useRef(t);
  tRef.current = t;
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

  // Score and stats come from the server, which owns them. Wait until a stored
  // auth token has been verified before connecting: otherwise a returning
  // account can receive `round-limit` while isAuthenticated is still briefly
  // false and be sent straight back to the sign-in modal.
  useEffect(() => {
    if (isAuthLoading) return;

    // Connect at app start, not when the chat opens, so the welcome screen can
    // show the player's streak - which is what makes it worth coming back for.
    socketService.connect().catch((error) => console.error('Connection failed:', error));

    const unsubscribeStats = socketService.onStats((stats) => {
      setScoreData(stats);
      setRoundsLeft(stats.roundsLeft);
      setHasLoadedStats(true);
    });

    // Out of free rounds. Guests are sent to sign up - which is worth more
    // rounds - and members to the paywall, because that is all that is left.
    const unsubscribeLimit = socketService.onRoundLimit(() => {
      setGameState(GameState.WELCOME);
      setModal(isAuthenticatedRef.current ? 'premium' : 'auth');
    });

    // Suspended. An alert rather than a screen: it is a dead end, not a state
    // the app has anything more to say about.
    const unsubscribeBanned = socketService.onBanned(() => {
      setGameState(GameState.WELCOME);
      alert(tRef.current('banned_message'));
    });

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
      unsubscribeLimit();
      unsubscribeBanned();
      unsubscribeVerdict();
      unsubscribeGuess();
    };
  }, [isAuthLoading]);

  // Recover if an auth surface was opened during the verification frame (for
  // example by a very fast click): once the account resolves, its destination
  // is Premium, never another sign-in form.
  useEffect(() => {
    if (modal === 'auth' && isAuthenticated) setModal('premium');
  }, [isAuthenticated, modal]);

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

  // Leaving mid-round has to reach the server, or the match lives on and the
  // partner is left talking to nobody. Dropping the socket runs the same
  // cleanup a closed tab would.
  const handleExitToMenu = () => {
    socketService.disconnect();
    socketService.connect().catch((error) => console.error('Reconnect failed:', error));
    setFooledPartner(false);
    setPendingAd(false);
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
        return <ChatScreen onTimeUp={handleTimeUp} score={scoreData.score} onExit={handleExitToMenu} />;
      case GameState.GUESSING:
        return <GuessScreen onGuess={handleGuess} onExit={handleExitToMenu} />;
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
          onExit={handleExitToMenu}
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
            roundsLeft={roundsLeft}
            onOpenAccount={() => setModal(isAuthenticated ? 'premium' : 'auth')}
            onReplayIntro={() => setOnboarded(false)}
            isAuthenticated={isAuthenticated}
          />
        );
    }
  };

  // Check if we're on the admin page
  const isAdminPage = window.location.pathname === '/admin';

  if (isAdminPage) {
    return <AdminPage />;
  }

  // Strangers in unmoderated live chat: confirm age before any of it is reachable.
  if (!ageConfirmed) {
    return <AgeGate onConfirm={() => setAgeConfirmed(true)} />;
  }

  // First run: explain the game and the house rules before anyone is matched
  // with a stranger.
  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  // The zeroed score data above is only a placeholder. Rendering it makes a
  // returning player look like a first-time player until the server responds.
  if (isAuthLoading || !hasLoadedStats) {
    return (
      <div
        className="grid min-h-[100dvh] place-items-center bg-slate-900 text-slate-400"
        role="status"
        aria-label={t('connecting')}
      >
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      {renderGameState()}

      {modal === 'ad' && <AdModal onClose={dismissAd} onUpgrade={openPremium} />}
      {modal === 'premium' && (
        <PremiumModal
          onClose={() => setModal('none')}
          onUpgrade={handleUpgrade}
          playerId={scoreData?.playerId}
        />
      )}
      {modal === 'auth' && (
        <AuthModal onClose={() => setModal('none')} reason={t('login_to_upgrade')} />
      )}
    </div>
  );
};

export default App;
