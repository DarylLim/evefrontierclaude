export interface PlayerContext {
  // Identity
  walletAddress: string;
  characterId: string;

  // Shell / Skills
  shellType: 'Rugged' | 'Reaping' | 'Aggressive' | null;
  crownCount: number;
  crownEstimatedHours: number;

  // Fuel
  fuelPct: number;
  fuelUnitsRemaining: number;
  fuelMaxCapacity: number;

  // Inventory
  cargoItems: { typeId: string; quantity: number }[];
  ammoCount: number;

  // Location (may be null if location is hashed)
  currentSystemId: string | null;
  currentSystemName: string | null;

  // Threat
  threatLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  hostileEntityCount: number;

  // Progression
  tutorialStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  // Assemblies
  activeAssemblies: { id: string; type: string; status: 'Online' | 'Offline' | 'Anchored' }[];
  activeManufacturingJobs: number;

  // Combat
  lastCombatEventAt: Date | null;

  // Market Intel
  nearestFuelSSU: {
    id: string;
    systemName: string;
    fuelAvailable: number;
  } | null;

  // Meta
  lastUpdatedAt: Date;
}

export interface AlertCard {
  id: string;
  ruleId: 'fuel_critical' | 'threat_proximity' | 'shell_risk' | 'stranding_alert' | 'manufacturing_safety' | 'tutorial_nudge';
  category: 'THREAT' | 'FUEL' | 'TUTORIAL' | 'ECONOMIC' | 'SAFETY';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  dismissed: boolean;
}

export interface KnowledgeChunk {
  id: number;
  source: string;
  category: string;
  keywords: string[];
  text: string;
}

export interface WSMessage {
  type: 'player_context' | 'alert' | 'llm_token' | 'llm_done' | 'error';
  payload: unknown;
}
