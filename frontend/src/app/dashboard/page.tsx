'use client';

import { usePlayerContext } from '@/hooks/usePlayerContext';
import FuelGauge from '@/components/FuelGauge';
import ThreatRing from '@/components/ThreatRing';
import AlertCard from '@/components/AlertCard';
import ChatView from '../chat/page';

export default function Dashboard() {
  const { playerContext, alerts, sessionId } = usePlayerContext();

  return (
    <div className="min-h-screen bg-ghost-bg text-gray-100 p-4 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-widest text-ghost-accent">GHOST</h1>
        <span className="text-xs text-gray-500">
          {playerContext?.currentSystemName ?? 'Locating...'}
        </span>
      </header>

      {playerContext ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-ghost-surface rounded-lg p-4 border border-ghost-border">
              <FuelGauge pct={playerContext.fuelPct} />
            </div>
            <div className="bg-ghost-surface rounded-lg p-4 border border-ghost-border">
              <ThreatRing level={playerContext.threatLevel} />
            </div>
          </div>

          <div className="bg-ghost-surface rounded-lg p-4 border border-ghost-border mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Shell</span>
              <span>{playerContext.shellType ?? 'None'}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Crowns</span>
              <span className={playerContext.crownCount > 0 ? 'text-ghost-warning' : 'text-gray-300'}>
                {playerContext.crownCount} (~{playerContext.crownEstimatedHours}h)
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Assemblies</span>
              <span>{playerContext.activeAssemblies.length}</span>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2 mb-4">
              {alerts.slice(0, 3).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 py-8">
          <div className="animate-pulse">Loading player state...</div>
        </div>
      )}

      <ChatView sessionId={sessionId} />
    </div>
  );
}
