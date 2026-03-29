import { PlayerContext } from '../types';

/**
 * Stateless transformer: raw Sui JSON → PlayerContext.
 * No external calls. Pure TypeScript.
 */
export class ContextEngine {
  // Average hours a player invests per Crown — community-sourced estimate
  private static AVG_HOURS_PER_CROWN = 8;

  static transform(raw: Partial<PlayerContext>): PlayerContext {
    const crownCount = raw.crownCount ?? 0;
    const fuelUnitsRemaining = raw.fuelUnitsRemaining ?? 0;
    const fuelMaxCapacity = raw.fuelMaxCapacity ?? 1; // avoid div/0

    return {
      walletAddress: raw.walletAddress ?? '',
      characterId: raw.characterId ?? '',
      shellType: raw.shellType ?? null,
      crownCount,
      crownEstimatedHours: crownCount * ContextEngine.AVG_HOURS_PER_CROWN,
      fuelPct: Math.round((fuelUnitsRemaining / fuelMaxCapacity) * 100),
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
