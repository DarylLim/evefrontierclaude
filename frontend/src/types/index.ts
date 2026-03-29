export interface PlayerContext {
  walletAddress: string;
  characterId: string;
  shellType: string | null;
  shellTypeId: number | null;
  fuelPct: number;
  fuelUnitsRemaining: number;
  fuelMaxCapacity: number;
  cargoItems: { typeId: number; quantity: number; volume: number }[];
  ammoCount: number;
  currentSystemId: string | null;
  currentSystemName: string | null;
  threatLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  hostileEntityCount: number;
  tutorialStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  activeAssemblies: { id: string; typeId: number; typeName: string; status: string }[];
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
