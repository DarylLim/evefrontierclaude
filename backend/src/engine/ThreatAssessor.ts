type ThreatLevel = 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

const THREAT_RANK: Record<ThreatLevel, number> = {
  SAFE: 0,
  LOW: 1,
  ELEVATED: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function maxThreat(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  return THREAT_RANK[a] >= THREAT_RANK[b] ? a : b;
}

export function assessThreat(params: {
  lastCombatEventAt: Date | null;
  activeAssemblies: { status: string }[];
  hasJumped: boolean;
  fuelPct: number;
}): { threatLevel: ThreatLevel; hostileEntityCount: number } {
  let threatLevel: ThreatLevel = 'SAFE';
  let hostileEntityCount = 0;

  // Left the starter system → at least LOW
  if (params.hasJumped) {
    threatLevel = maxThreat(threatLevel, 'LOW');
  }

  // Combat recency checks
  if (params.lastCombatEventAt) {
    const nowMs = Date.now();
    const combatMs = params.lastCombatEventAt.getTime();
    const minutesAgo = (nowMs - combatMs) / 60_000;

    if (minutesAgo <= 2 && params.fuelPct < 20) {
      threatLevel = maxThreat(threatLevel, 'CRITICAL');
      hostileEntityCount = 3;
    } else if (minutesAgo <= 5) {
      threatLevel = maxThreat(threatLevel, 'HIGH');
      hostileEntityCount = Math.max(hostileEntityCount, 2);
    } else if (minutesAgo <= 15) {
      threatLevel = maxThreat(threatLevel, 'ELEVATED');
      hostileEntityCount = Math.max(hostileEntityCount, 1);
    }
  }

  // Fuel emergency: low fuel outside starter system → at minimum ELEVATED
  if (params.fuelPct < 10 && params.hasJumped) {
    threatLevel = maxThreat(threatLevel, 'ELEVATED');
  }

  return { threatLevel, hostileEntityCount };
}
