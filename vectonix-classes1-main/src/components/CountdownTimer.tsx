import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  onEnd?: () => void;
  className?: string;
  showLabels?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  targetDate, 
  onEnd, 
  className = "",
  showLabels = true
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        if (onEnd) onEnd();
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [targetDate, onEnd]);

  if (!timeLeft) return null;

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <div className={`inline-flex items-center gap-1 font-mono ${className}`}>
      {days > 0 && (
        <span className="flex items-center">
          <span className="font-black">{days}</span>
          {showLabels && <span className="text-[8px] uppercase ml-0.5 opacity-60">d</span>}
          <span className="mx-0.5 opacity-40">:</span>
        </span>
      )}
      <span className="flex items-center">
        <span className="font-black">{hours.toString().padStart(2, '0')}</span>
        {showLabels && <span className="text-[8px] uppercase ml-0.5 opacity-60">h</span>}
      </span>
      <span className="mx-0.5 opacity-40">:</span>
      <span className="flex items-center">
        <span className="font-black">{minutes.toString().padStart(2, '0')}</span>
        {showLabels && <span className="text-[8px] uppercase ml-0.5 opacity-60">m</span>}
      </span>
      <span className="mx-0.5 opacity-40">:</span>
      <span className="flex items-center">
        <span className="font-black">{seconds.toString().padStart(2, '0')}</span>
        {showLabels && <span className="text-[8px] uppercase ml-0.5 opacity-60">s</span>}
      </span>
    </div>
  );
};
