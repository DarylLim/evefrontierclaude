'use client';

type ThreatLevel = 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

const COLORS: Record<ThreatLevel, string> = {
  SAFE: 'text-ghost-safe border-ghost-safe',
  LOW: 'text-ghost-safe border-ghost-safe',
  ELEVATED: 'text-ghost-warning border-ghost-warning',
  HIGH: 'text-ghost-danger border-ghost-danger',
  CRITICAL: 'text-ghost-danger border-ghost-danger animate-pulse',
};

export default function ThreatRing({ level }: { level: ThreatLevel }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold ${COLORS[level]}`}>
        {level === 'SAFE' || level === 'LOW' ? '◎' : '⚠'}
      </div>
      <span className={`text-xs mt-1 ${COLORS[level].split(' ')[0]}`}>{level}</span>
    </div>
  );
}
