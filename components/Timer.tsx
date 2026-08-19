import React, { useState, useEffect } from 'react';

interface TimerProps {
  /** Server-supplied end time. The server owns the round clock; this only displays it. */
  endsAt: number;
}

const secondsLeft = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

const Timer: React.FC<TimerProps> = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState(() => secondsLeft(endsAt));

  useEffect(() => {
    setTimeLeft(secondsLeft(endsAt));
    const intervalId = setInterval(() => setTimeLeft(secondsLeft(endsAt)), 250);
    return () => clearInterval(intervalId);
  }, [endsAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="text-lg font-mono bg-slate-700 px-3 py-1 rounded-md">
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};

export default Timer;
