export interface StarSystem {
  id: string;
  name: string;
  zone: 'green' | 'yellow' | 'red';
  connections: string[]; // IDs of connected systems
}

// ~30 system starter region graph for EVE Frontier pathfinding
export const REGION_GRAPH: Map<string, StarSystem> = new Map([
  // GREEN ZONE (5 systems) — safe starter area
  ['SL-001', { id: 'SL-001', name: "Seraph's Landing", zone: 'green', connections: ['VH-002', 'AK-003', 'ER-004'] }],
  ['VH-002', { id: 'VH-002', name: 'Verdant Hollow', zone: 'green', connections: ['SL-001', 'AK-003', 'CP-006'] }],
  ['AK-003', { id: 'AK-003', name: 'Arkonis Prime', zone: 'green', connections: ['SL-001', 'VH-002', 'TG-007'] }],
  ['ER-004', { id: 'ER-004', name: 'Erida Station', zone: 'green', connections: ['SL-001', 'LM-005', 'CP-006'] }],
  ['LM-005', { id: 'LM-005', name: 'Luminar Gate', zone: 'green', connections: ['ER-004', 'KV-008'] }],

  // YELLOW ZONE (15 systems) — moderate risk
  ['CP-006', { id: 'CP-006', name: 'Corath Passage', zone: 'yellow', connections: ['VH-002', 'ER-004', 'TG-007', 'NX-009'] }],
  ['TG-007', { id: 'TG-007', name: 'Thalor Gap', zone: 'yellow', connections: ['AK-003', 'CP-006', 'KV-008'] }],
  ['KV-008', { id: 'KV-008', name: 'Kovaris Reach', zone: 'yellow', connections: ['LM-005', 'TG-007', 'NX-009', 'DR-010'] }],
  ['NX-009', { id: 'NX-009', name: 'Nexara Drift', zone: 'yellow', connections: ['CP-006', 'KV-008', 'SV-011'] }],
  ['DR-010', { id: 'DR-010', name: 'Draven Outpost', zone: 'yellow', connections: ['KV-008', 'SV-011', 'OB-012'] }],
  ['SV-011', { id: 'SV-011', name: 'Solvent Veil', zone: 'yellow', connections: ['NX-009', 'DR-010', 'MR-013'] }],
  ['OB-012', { id: 'OB-012', name: 'Obsidian Shelf', zone: 'yellow', connections: ['DR-010', 'MR-013', 'VX-021'] }],
  ['MR-013', { id: 'MR-013', name: 'Mireth Crossing', zone: 'yellow', connections: ['SV-011', 'OB-012', 'FZ-014', 'HL-015'] }],
  ['FZ-014', { id: 'FZ-014', name: 'Frozen Ascent', zone: 'yellow', connections: ['MR-013', 'HL-015', 'WR-022'] }],
  ['HL-015', { id: 'HL-015', name: 'Helvari Loop', zone: 'yellow', connections: ['MR-013', 'FZ-014', 'IG-016'] }],
  ['IG-016', { id: 'IG-016', name: 'Ignis Threshold', zone: 'yellow', connections: ['HL-015', 'ZK-017', 'PR-018'] }],
  ['ZK-017', { id: 'ZK-017', name: 'Zarketh Run', zone: 'yellow', connections: ['IG-016', 'PR-018', 'SH-023'] }],
  ['PR-018', { id: 'PR-018', name: 'Pyris Nebula', zone: 'yellow', connections: ['IG-016', 'ZK-017', 'XN-019'] }],
  ['XN-019', { id: 'XN-019', name: 'Xenith Spur', zone: 'yellow', connections: ['PR-018', 'CV-020', 'SH-023'] }],
  ['CV-020', { id: 'CV-020', name: 'Calvar Basin', zone: 'yellow', connections: ['XN-019', 'VX-021'] }],

  // RED ZONE (10 systems) — high danger
  ['VX-021', { id: 'VX-021', name: 'Vexor Abyss', zone: 'red', connections: ['OB-012', 'CV-020', 'WR-022'] }],
  ['WR-022', { id: 'WR-022', name: 'Wraith Corridor', zone: 'red', connections: ['FZ-014', 'VX-021', 'SH-023'] }],
  ['SH-023', { id: 'SH-023', name: 'Shattered Reach', zone: 'red', connections: ['ZK-017', 'XN-019', 'WR-022', 'NK-024'] }],
  ['NK-024', { id: 'NK-024', name: 'Nekros Void', zone: 'red', connections: ['SH-023', 'BL-025', 'TH-026'] }],
  ['BL-025', { id: 'BL-025', name: 'Blackfire Rift', zone: 'red', connections: ['NK-024', 'TH-026', 'DM-027'] }],
  ['TH-026', { id: 'TH-026', name: 'Thanatos Deep', zone: 'red', connections: ['NK-024', 'BL-025', 'AS-028'] }],
  ['DM-027', { id: 'DM-027', name: 'Doomspire Gate', zone: 'red', connections: ['BL-025', 'AS-028', 'OR-029'] }],
  ['AS-028', { id: 'AS-028', name: 'Ashfall Terminus', zone: 'red', connections: ['TH-026', 'DM-027', 'OR-029'] }],
  ['OR-029', { id: 'OR-029', name: 'Oblivion Ring', zone: 'red', connections: ['DM-027', 'AS-028', 'MX-030'] }],
  ['MX-030', { id: 'MX-030', name: 'Malachar Expanse', zone: 'red', connections: ['OR-029'] }],
]);

/**
 * BFS shortest-path between two systems.
 * Returns array of system IDs from `fromId` to `toId` (inclusive), or empty array if unreachable.
 */
export function findRoute(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  if (!REGION_GRAPH.has(fromId) || !REGION_GRAPH.has(toId)) return [];

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [fromId];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const system = REGION_GRAPH.get(current)!;

    for (const neighbor of system.connections) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === toId) {
        // Reconstruct path
        const path: string[] = [toId];
        let node = toId;
        while (node !== fromId) {
          node = parent.get(node)!;
          path.unshift(node);
        }
        return path;
      }

      queue.push(neighbor);
    }
  }

  return []; // unreachable
}

/**
 * Estimate fuel cost for a route.
 * Base: 10 fuel per hop. +5 for yellow zone destination. +10 for red zone destination.
 */
export function estimateFuelCost(route: string[]): number {
  if (route.length <= 1) return 0;

  let cost = 0;
  for (let i = 1; i < route.length; i++) {
    const system = REGION_GRAPH.get(route[i]);
    if (!system) continue;

    let hopCost = 10; // base
    if (system.zone === 'yellow') hopCost += 5;
    if (system.zone === 'red') hopCost += 10;
    cost += hopCost;
  }

  return cost;
}
