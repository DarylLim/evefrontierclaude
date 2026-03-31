import { AlertCard, PlayerContext } from '../types';
import { randomUUID } from 'crypto';

type Rule = {
  id: AlertCard['ruleId'];
  category: AlertCard['category'];
  severity: AlertCard['severity'];
  trigger: (ctx: PlayerContext) => boolean;
  title: (ctx: PlayerContext) => string;
  message: (ctx: PlayerContext) => string;
};

function estimatedReturnCost(ctx: PlayerContext): number {
  // Base cost: 10 fuel units per hop. Estimate hops based on tutorial progress.
  // Players who have jumped (left starter) need at minimum 3 hops back.
  // Players still in starter need 0 hops.
  const baseHops = ctx.hasJumped ? 3 : 0;
  const costPerHop = 10;
  // Add buffer for shell mass variance (heavier shells burn more)
  const massMultiplier = ctx.shellType?.toLowerCase().includes('aggressive') ? 1.5
    : ctx.shellType?.toLowerCase().includes('reaping') ? 1.2
    : 1.0;
  return Math.ceil(baseHops * costPerHop * massMultiplier);
}

function idleMinutes(ctx: PlayerContext): number {
  const diffMs = Date.now() - ctx.lastUpdatedAt.getTime();
  return diffMs / 60000;
}

const rules: Rule[] = [
  {
    id: 'fuel_critical',
    category: 'FUEL',
    severity: 'critical',
    trigger: (ctx) => ctx.fuelPct < 20,
    title: () => 'Fuel Critical',
    message: (ctx) => `Fuel at ${ctx.fuelPct}%. Nearest refuel: ${ctx.nearestFuelSSU?.systemName ?? 'unknown'}. Return cost ~30 units.`,
  },
  {
    id: 'threat_proximity',
    category: 'THREAT',
    severity: 'warning',
    trigger: (ctx) => ctx.hostileEntityCount > 0,
    title: () => 'Hostile Contact',
    message: (ctx) => `${ctx.hostileEntityCount} hostile entity/entities detected in current system.`,
  },
  {
    id: 'shell_risk',
    category: 'SAFETY',
    severity: 'warning',
    trigger: (ctx) => ctx.lastCombatEventAt !== null && ctx.activeAssemblies.some(a => a.status === 'Online'),
    title: () => 'Shell at Risk',
    message: () => 'Recent combat activity detected with an Online assembly. Consider docking.',
  },
  {
    id: 'stranding_alert',
    category: 'FUEL',
    severity: 'critical',
    trigger: (ctx) => ctx.fuelUnitsRemaining < estimatedReturnCost(ctx),
    title: () => 'Stranding Risk',
    message: (ctx) => `Only ${ctx.fuelUnitsRemaining} fuel units remain — below estimated return cost of ${estimatedReturnCost(ctx)} units. Refuel before moving.`,
  },
  {
    id: 'manufacturing_safety',
    category: 'SAFETY',
    severity: 'warning',
    trigger: (ctx) => ctx.activeManufacturingJobs > 0,
    title: () => 'Manufacturing Active',
    message: (ctx) => `${ctx.activeManufacturingJobs} manufacturing job(s) running. Do not dismantle printer.`,
  },
  {
    id: 'tutorial_nudge',
    category: 'TUTORIAL',
    severity: 'info',
    trigger: (ctx) => ctx.tutorialStage < 6 && idleMinutes(ctx) > 5,
    title: (ctx) => `Tutorial Stage ${ctx.tutorialStage + 1}`,
    message: (ctx) => `You've been idle for a while. Ready for the next tutorial step?`,
  },
];

export class HeuristicEngine {
  static evaluate(ctx: PlayerContext): AlertCard[] {
    const alerts: AlertCard[] = [];
    for (const rule of rules) {
      if (rule.trigger(ctx)) {
        alerts.push({
          id: randomUUID(),
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.title(ctx),
          message: rule.message(ctx),
          timestamp: new Date(),
          dismissed: false,
        });
      }
    }
    return alerts;
  }
}
