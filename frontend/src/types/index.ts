export interface PlayerContext {
  walletAddress: string;
  characterId: string;
  shellType: 'Rugged' | 'Reaping' | 'Aggressive' | null;
  crownCount: number;
  crownEstimatedHours: number;
  fuelPct: number;
  fuelUnitsRemaining: number;
  fuelMaxCapacity: number;
  cargoItems: { typeId: string; quantity: number }[];
  ammoCount: number;
  currentSystemId: string | null;
  currentSystemName: string | null;
  threatLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  hostileEntityCount: number;
  tutorialStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  activeAssemblies: { id: string; type: string; status: 'Online' | 'Offline' | 'Anchored' }[];
  activeManufacturingJobs: number;
  lastCombatEventAt: string | null;
  nearestFuelSSU: { id: string; systemName: string; fuelAvailable: number } | null;
  lastUpdatedAt: string;
}

export interface AlertCard {
  id: string;
  ruleId: 'fuel_critical' | 'threat_proximity' | 'shell_risk' | 'stranding_alert' | 'manufacturing_safety' | 'tutorial_nudge';
  category: 'THREAT' | 'FUEL' | 'TUTORIAL' | 'ECONOMIC' | 'SAFETY';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
}
