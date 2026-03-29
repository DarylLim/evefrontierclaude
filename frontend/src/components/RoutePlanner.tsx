'use client';

import { useState, useMemo } from 'react';
import { REGION_GRAPH, findRoute, estimateFuelCost, type StarSystem } from '@/lib/regionGraph';

const STARTER_SYSTEM_ID = 'SL-001';

interface RouteResult {
  path: StarSystem[];
  hops: number;
  fuelCost: number;
  redZoneSystems: StarSystem[];
}

export default function RoutePlanner() {
  const [fromId, setFromId] = useState(STARTER_SYSTEM_ID);
  const [toId, setToId] = useState('');
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');

  const sortedSystems = useMemo(() => {
    return Array.from(REGION_GRAPH.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, []);

  function handlePlanRoute() {
    setError('');
    setResult(null);

    if (!toId) {
      setError('Select a destination system.');
      return;
    }
    if (fromId === toId) {
      setError('Origin and destination are the same system.');
      return;
    }

    const routeIds = findRoute(fromId, toId);
    if (routeIds.length === 0) {
      setError('No route found between these systems.');
      return;
    }

    const path = routeIds.map((id) => REGION_GRAPH.get(id)!);
    const fuelCost = estimateFuelCost(routeIds);
    const redZoneSystems = path.filter((s) => s.zone === 'red');

    setResult({
      path,
      hops: routeIds.length - 1,
      fuelCost,
      redZoneSystems,
    });
  }

  const zoneBadge = (zone: StarSystem['zone']) => {
    const colors = {
      green: 'text-ghost-safe',
      yellow: 'text-ghost-warning',
      red: 'text-ghost-danger',
    };
    return <span className={`${colors[zone]} uppercase text-[10px] font-bold`}>{zone}</span>;
  };

  return (
    <div className="bg-ghost-surface rounded-lg p-4 border border-ghost-border mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs text-gray-400 uppercase tracking-widest">Route Planner</h2>
        <span className="text-[10px] text-ghost-accent/60 border border-ghost-accent/30 rounded px-1.5 py-0.5">
          Early Access — local region only
        </span>
      </div>

      {/* Origin selector */}
      <label className="block text-xs text-gray-500 mb-1">From</label>
      <select
        value={fromId}
        onChange={(e) => { setFromId(e.target.value); setResult(null); }}
        className="w-full bg-ghost-bg border border-ghost-border rounded px-3 py-2 text-sm text-gray-200 mb-3 focus:outline-none focus:border-ghost-accent"
      >
        {sortedSystems.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} [{s.zone.toUpperCase()}]
          </option>
        ))}
      </select>

      {/* Destination selector */}
      <label className="block text-xs text-gray-500 mb-1">Destination</label>
      <select
        value={toId}
        onChange={(e) => { setToId(e.target.value); setResult(null); }}
        className="w-full bg-ghost-bg border border-ghost-border rounded px-3 py-2 text-sm text-gray-200 mb-3 focus:outline-none focus:border-ghost-accent"
      >
        <option value="">-- Select destination --</option>
        {sortedSystems.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} [{s.zone.toUpperCase()}]
          </option>
        ))}
      </select>

      {/* Plan button */}
      <button
        onClick={handlePlanRoute}
        className="w-full bg-ghost-accent/10 border border-ghost-accent/40 text-ghost-accent rounded px-4 py-2 text-sm font-medium hover:bg-ghost-accent/20 transition-colors"
      >
        Plan Route
      </button>

      {/* Error */}
      {error && (
        <p className="mt-3 text-xs text-ghost-danger">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 space-y-3">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ghost-bg rounded p-3 text-center">
              <div className="text-lg font-bold text-ghost-accent">{result.hops}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Hops</div>
            </div>
            <div className="bg-ghost-bg rounded p-3 text-center">
              <div className="text-lg font-bold text-ghost-accent">{result.fuelCost}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Fuel Est.</div>
            </div>
          </div>

          {/* Red zone warnings */}
          {result.redZoneSystems.length > 0 && (
            <div className="bg-ghost-danger/10 border border-ghost-danger/30 rounded p-3">
              <div className="text-xs text-ghost-danger font-bold mb-1">Red Zone Warning</div>
              <ul className="space-y-0.5">
                {result.redZoneSystems.map((s) => (
                  <li key={s.id} className="text-xs text-ghost-danger/80">
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Route path */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Route</div>
            <div className="space-y-1">
              {result.path.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 w-4 text-right">{i}</span>
                  <span className="text-gray-600">&#8250;</span>
                  <span className="text-gray-200">{s.name}</span>
                  {zoneBadge(s.zone)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
