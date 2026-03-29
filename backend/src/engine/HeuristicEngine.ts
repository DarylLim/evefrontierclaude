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
  // Rough heuristic: 10 fuel units per hop, assume 3 hops back to safe zone
  // TODO Day 2: Improve using hardcoded region graph
  return 30;
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
    trigger: (ctx) => ctx.crownCount > 0 && ctx.lastCombatEventAt !== null,
    title: () => 'Shell at Risk',
    message: (ctx) => `Your Shell carries ${ctx.crownCount} Crown(s) (~${ctx.crownEstimatedHours}h). Recent combat activity detected.`,
  },
  {
    id: 'stranding_alert',
    category: 'FUEL',
    severity: 'critical',
    trigger: (ctx) => ctx.fuelUnitsRemaining < estimatedReturnCost(ctx),
    title: () => 'Stranding Risk',
    message: (ctx) => `Only ${ctx.fuelUnitsRemaining} fuel units remain — below estimated return cost. Refuel before moving.`,
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
