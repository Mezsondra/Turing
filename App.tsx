import React, { useState, useEffect, useRef } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';
import GuessScreen from './components/GuessScreen';
import ResultScreen from './components/ResultScreen';
import AdminPage from './components/AdminPage';
import { GameState } from './types';
import { socketService } from './services/socketService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.WELCOME);
  const [score, setScore] = useState(0);
  const [lastGuessCorrect, setLastGuessCorrect] = useState(false);
  const [partnerType, setPartnerType] = useState<'HUMAN' | 'AI'>('AI');
  const [matchId, setMatchId] = useState<string>('');
  const pendingGuessRef = useRef<'HUMAN' | 'AI' | null>(null);
  const [scoreData, setScoreData] = useState({
    score: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0
  });

  const applyLocalGuessResult = (guess: 'HUMAN' | 'AI') => {
    pendingGuessRef.current = null;
    const wasCorrect = guess === partnerType;
    const pointsDelta = wasCorrect ? 10 : -5;

    setLastGuessCorrect(wasCorrect);
    setScore((prevScore) => prevScore + pointsDelta);
    setScoreData((prev) => ({
      score: prev.score + pointsDelta,
      gamesPlayed: prev.gamesPlayed + 1,
      gamesWon: prev.gamesWon + (wasCorrect ? 1 : 0),
      gamesLost: prev.gamesLost + (wasCorrect ? 0 : 1),
    }));
    setGameState(GameState.RESULT);
  };

  useEffect(() => {
    // Set up listener for guess results
    const unsubscribe = socketService.onGuessResult((result) => {
      if (result.error) {
        console.error('Error submitting guess:', result.error);
        const fallbackGuess = pendingGuessRef.current;
        pendingGuessRef.current = null;
        if (fallbackGuess) {
          applyLocalGuessResult(fallbackGuess);
        }
        return;
      }

      pendingGuessRef.current = null;
      setLastGuessCorrect(result.wasCorrect);

      const hasServerStats =
        result.score !== 0 ||
        result.gamesPlayed > 0 ||
        result.gamesWon > 0 ||
        result.gamesLost > 0;
      const pointsDelta = result.wasCorrect ? 10 : -5;

      setScore((prevScore) => (hasServerStats ? result.score : prevScore + pointsDelta));

      setScoreData((prev) =>
        hasServerStats
          ? {
              score: result.score,
              gamesPlayed: result.gamesPlayed,
              gamesWon: result.gamesWon,
              gamesLost: result.gamesLost,
            }
          : {
              score: prev.score + pointsDelta,
              gamesPlayed: prev.gamesPlayed + 1,
              gamesWon: prev.gamesWon + (result.wasCorrect ? 1 : 0),
              gamesLost: prev.gamesLost + (result.wasCorrect ? 0 : 1),
            }
      );

      setGameState(GameState.RESULT);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStartGame = () => {
    setGameState(GameState.CHATTING);
  };

  const handleTimeUp = (actualPartner: 'HUMAN' | 'AI', currentMatchId: string) => {
    // The actual partner type is now revealed by the server
    setPartnerType(actualPartner);
    setMatchId(currentMatchId);
    setGameState(GameState.GUESSING);
  };

  const handleGuess = (guess: 'HUMAN' | 'AI') => {
    // Submit guess via socket and wait for result
    pendingGuessRef.current = guess;
    if (matchId) {
      try {
        socketService.submitGuess(matchId, guess);
      } catch (error) {
        console.error('Failed to submit guess via socket:', error);
        applyLocalGuessResult(guess);
      }
    } else {
      // Fallback for local scoring if no matchId
      applyLocalGuessResult(guess);
    }
  };

  const handlePlayAgain = () => {
    setGameState(GameState.WELCOME);
  };

  const renderGameState = () => {
    switch (gameState) {
      case GameState.CHATTING:
        return <ChatScreen key={Date.now()} onTimeUp={handleTimeUp} score={score} />;
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
        />;
      case GameState.WELCOME:
      default:
        return <WelcomeScreen onStartGame={handleStartGame} />;
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
    </div>
  );
};

export default App;
