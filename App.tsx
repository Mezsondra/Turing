import React, { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';
import GuessScreen from './components/GuessScreen';
import ResultScreen from './components/ResultScreen';
import { GameState } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.WELCOME);
  const [score, setScore] = useState(0);
  const [lastGuessCorrect, setLastGuessCorrect] = useState(false);
  const [partnerType, setPartnerType] = useState<'HUMAN' | 'AI'>('AI');

  const handleStartGame = () => {
    setGameState(GameState.CHATTING);
  };

  const handleTimeUp = (actualPartner: 'HUMAN' | 'AI') => {
    // The actual partner type is now revealed by the server
    setPartnerType(actualPartner);
    setGameState(GameState.GUESSING);
  };

  const handleGuess = (guess: 'HUMAN' | 'AI') => {
    const wasCorrect = guess === partnerType;
    setLastGuessCorrect(wasCorrect);
    if (wasCorrect) {
      setScore(prevScore => prevScore + 1);
    }
    setGameState(GameState.RESULT);
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
        return <ResultScreen wasCorrect={lastGuessCorrect} actualPartner={partnerType} onPlayAgain={handlePlayAgain} />;
      case GameState.WELCOME:
      default:
        return <WelcomeScreen onStartGame={handleStartGame} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      {renderGameState()}
    </div>
  );
};

export default App;
