'use client';

import { useState } from 'react';
import { usePlayerContext } from '@/hooks/usePlayerContext';
import FuelGauge from '@/components/FuelGauge';
import ThreatRing from '@/components/ThreatRing';
import AlertFeed from '@/components/AlertFeed';
import RoutePlanner from '@/components/RoutePlanner';
import Onboarding from '@/components/Onboarding';
import ChatView from '../chat/page';

export default function Dashboard() {
  const { playerContext, alerts, sessionId, reconnecting } = usePlayerContext();
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ghost-bg text-gray-100 p-4 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-widest text-ghost-accent">GHOST</h1>
        <span className="text-xs text-gray-500">
          {reconnecting ? (
            <span className="text-ghost-warning animate-pulse">Reconnecting...</span>
          ) : (
            playerContext?.currentSystemName ?? 'Locating...'
          )}
        </span>
      </header>

      {playerContext ? (
        <>
          <Onboarding tutorialStage={playerContext.tutorialStage} onDismiss={() => {}} />

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
              <span className="text-gray-400">Ship</span>
              <span>{playerContext.shellType ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Assemblies</span>
              <span>{playerContext.activeAssemblies.length}</span>
            </div>
            {playerContext.activeAssemblies.length > 0 && (
              <div className="mt-2 space-y-1">
                {playerContext.activeAssemblies.map((a) => (
                  <div key={a.id} className="flex justify-between text-xs text-gray-400">
                    <span>{a.typeName}</span>
                    <span className={a.status === 'Online' ? 'text-ghost-safe' : 'text-gray-500'}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="bg-ghost-surface rounded-lg p-4 border border-ghost-border mb-4">
              <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Alerts</h2>
              <AlertFeed alerts={alerts} />
            </div>
          )}

          <RoutePlanner />
        </>
      ) : (
        <div className="text-center text-gray-500 py-8">
          <div className="animate-pulse">Loading player state...</div>
        </div>
      )}

      <ChatView sessionId={sessionId} />

      <div className="mt-4 border border-ghost-border rounded-lg overflow-hidden">
        <button
          onClick={() => setDebugOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 bg-ghost-surface hover:text-gray-300"
        >
          <span>DEBUG — playerContext</span>
          <span>{debugOpen ? '▲' : '▼'}</span>
        </button>
        {debugOpen && (
          <pre className="p-4 text-xs text-green-400 bg-black overflow-x-auto max-h-96 overflow-y-auto">
            {playerContext ? JSON.stringify(playerContext, null, 2) : 'null — no context received yet'}
          </pre>
        )}
      </div>
    </div>
  );
}
