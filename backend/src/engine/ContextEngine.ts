import { PlayerContext } from '../types';

export class ContextEngine {
  static transform(raw: Partial<PlayerContext>): PlayerContext {
    const fuelUnitsRemaining = raw.fuelUnitsRemaining ?? 0;
    const fuelMaxCapacity = raw.fuelMaxCapacity ?? 1; // avoid div/0

    return {
      walletAddress: raw.walletAddress ?? '',
      characterId: raw.characterId ?? '',
      shellType: raw.shellType ?? null,
      shellTypeId: raw.shellTypeId ?? null,
      fuelPct: raw.fuelPct ?? Math.round((fuelUnitsRemaining / fuelMaxCapacity) * 100),
      fuelUnitsRemaining,
      fuelMaxCapacity,
      cargoItems: raw.cargoItems ?? [],
      ammoCount: raw.ammoCount ?? 0,
      currentSystemId: raw.currentSystemId ?? null,
      currentSystemName: raw.currentSystemName ?? null,
      threatLevel: raw.threatLevel ?? 'SAFE',
      hostileEntityCount: raw.hostileEntityCount ?? 0,
      tutorialStage: raw.tutorialStage ?? 0,
      activeAssemblies: raw.activeAssemblies ?? [],
      activeManufacturingJobs: raw.activeManufacturingJobs ?? 0,
      lastCombatEventAt: raw.lastCombatEventAt ?? null,
      nearestFuelSSU: raw.nearestFuelSSU ?? null,
      lastUpdatedAt: new Date(),
    };
  }
}
