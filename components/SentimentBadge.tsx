import React from 'react';
import { clsx } from 'clsx';

interface SentimentBadgeProps {
  score: number | "unknown";
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ score, label, size = 'md' }) => {
  const getColors = (s: number | "unknown") => {
    if (s === "unknown") return "bg-gray-100 text-gray-600 border-gray-200";
    if (s >= 75) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s >= 55) return "bg-green-100 text-green-800 border-green-200";
    if (s >= 45) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (s >= 25) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-rose-100 text-rose-800 border-rose-200";
  };

  const formattedScore = score === "unknown" ? "?" : score;
  const colors = getColors(score);

  return (
    <div className={clsx(
      "inline-flex items-center justify-center font-bold rounded border",
      colors,
      size === 'sm' && "px-2 py-0.5 text-xs",
      size === 'md' && "px-2.5 py-1 text-sm",
      size === 'lg' && "px-4 py-2 text-base",
    )}>
      <span>{formattedScore}</span>
      {label && <span className="ml-2 font-normal opacity-75 capitalize">| {label}</span>}
    </div>
  );
};
