import { KnowledgeBase } from './KnowledgeBase';

type SeedChunk = {
  source: string;
  category: string;
  keywords: string[];
  text: string;
};

const SEED_DATA: SeedChunk[] = [
  // ── FUEL ──────────────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Survival Guide',
    category: 'fuel',
    keywords: ['fuel', 'stranding', 'refuel', 'fuel tank', 'capacity'],
    text: `Fuel is the single most critical resource in EVE Frontier. Every gate jump consumes fuel. If your fuel drops to zero mid-route, your Shell stops and you are stranded until rescued or until you acquire fuel from a nearby Smart Storage Unit (SSU). Always maintain at least 30 units above your estimated return cost before deep-space exploration. The Rugged Shell has the largest fuel tank; the Aggressive Shell burns fuel faster due to its heavier loadout.`,
  },
  {
    source: 'EVE Frontier Survival Guide',
    category: 'fuel',
    keywords: ['fuel', 'SSU', 'refuel', 'smart storage', 'buy fuel'],
    text: `To refuel, dock at a Smart Storage Unit (SSU) that has fuel listed in its public inventory. Not all SSUs sell fuel — check the market price before jumping to one. SSUs are player-owned; prices vary. Fuel type: Strontium Clathrates are the standard fuel for gate jumps in the starter region. One gate jump costs approximately 10 units of strontium clathrates at standard shell mass.`,
  },
  {
    source: 'EVE Frontier Mechanics Reference',
    category: 'fuel',
    keywords: ['fuel cost', 'jump cost', 'distance', 'fuel consumption'],
    text: `Fuel consumption per jump is roughly proportional to shell mass and gate distance. A Rugged Shell consumes ~8–12 units per jump. A Reaping Shell consumes ~10–14 units. An Aggressive Shell consumes ~12–18 units. Always carry a 20% buffer above your planned route cost. The GHOST stranding alert fires when your remaining fuel falls below 30 units (estimated 3-hop return cost).`,
  },

  // ── SHELLS / SHIPS ────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Ship Classification',
    category: 'shells',
    keywords: ['shell', 'Rugged', 'Reaping', 'Aggressive', 'ship type', 'hull'],
    text: `EVE Frontier has three Shell types in the starter tier: Rugged, Reaping, and Aggressive. The Rugged Shell is a balanced generalist — larger cargo bay, more fuel capacity, moderate combat stats. Best for new players and haulers. The Reaping Shell is a mining/industry specialist with bonus ore processing speed and module slots for industrial equipment. The Aggressive Shell is a combat-focused hull with higher DPS but smaller cargo and faster fuel burn.`,
  },
  {
    source: 'EVE Frontier Ship Classification',
    category: 'shells',
    keywords: ['Rugged Shell', 'stats', 'cargo', 'tank', 'new player'],
    text: `Rugged Shell stats (approximate): Cargo bay 150 m³, Fuel capacity 200 units, Shield HP 800, Armor HP 600, Base DPS 45. This is the recommended starting shell for tutorial completion. It can complete all 6 tutorial stages without switching hulls. Crafting a Rugged Shell requires: 50x Iron Plates, 20x Copper Wire, 10x Refined Water Ice, 5x Microprocessors.`,
  },
  {
    source: 'EVE Frontier Ship Classification',
    category: 'shells',
    keywords: ['Reaping Shell', 'mining', 'industry', 'ore', 'manufacturing'],
    text: `Reaping Shell stats (approximate): Cargo bay 200 m³ (largest), Fuel capacity 160 units, Shield HP 600, Armor HP 500, Base DPS 25. Specialised for ore extraction and manufacturing. Has bonus module slots for mining lasers. Best used in safe systems. Do NOT take a Reaping Shell into PvP-active systems — it cannot escape Aggressive Shell pilots.`,
  },
  {
    source: 'EVE Frontier Ship Classification',
    category: 'shells',
    keywords: ['Aggressive Shell', 'combat', 'PvP', 'DPS', 'damage'],
    text: `Aggressive Shell stats (approximate): Cargo bay 80 m³, Fuel capacity 140 units, Shield HP 1200, Armor HP 900, Base DPS 120. Built for combat. High DPS but burns fuel quickly and carries little cargo. If you see an Aggressive Shell in your system, increase threat level to HIGH. Two Aggressive Shells together can destroy a Rugged in under 30 seconds.`,
  },

  // ── CROWNS ────────────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Progression Guide',
    category: 'crowns',
    keywords: ['Crown', 'progression', 'loss', 'skill', 'death penalty'],
    text: `Crowns represent accumulated player progression in EVE Frontier. They are carried on your Shell and are LOST on death. Each Crown represents approximately 8 hours of in-game investment. When you die carrying Crowns, your killer receives them. This makes Crown-carriers high-value targets. GHOST tracks your Crown count and fires a Shell Risk alert if you carry Crowns in a system with recent combat activity.`,
  },
  {
    source: 'EVE Frontier Progression Guide',
    category: 'crowns',
    keywords: ['Crown', 'store', 'safe', 'station', 'deposit'],
    text: `To protect Crowns, deposit them at a player-owned Smart Assembly station before entering dangerous systems. Crowns stored at a station are safe from PvP loss. Rule of thumb: never carry more Crowns than you can afford to lose in one session. If GHOST warns you about Crown risk, consider depositing before jumping to a new system.`,
  },

  // ── TUTORIAL ──────────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 1', 'start', 'new player', 'beginning'],
    text: `Tutorial Stage 1 — First Login: Create your character and Shell. Connect your EVE Vault wallet. You start in a protected starter system. Your first goal: collect 50x Iron Ore from nearby asteroid fields. Iron Ore is abundant in the starter system and is the foundation of all early crafting. Use your mining laser module (pre-equipped on Rugged Shell) to extract ore from asteroids.`,
  },
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 2', 'refinery', 'refine', 'water ice', 'processing'],
    text: `Tutorial Stage 2 — Build a Refinery: Smelt your Iron Ore into Iron Plates using a Smart Manufacturing Unit (SMU). Recipe: 5x Iron Ore → 1x Iron Plate. Then refine Water Ice into Refined Water Ice: 3x Water Ice → 1x Refined Water Ice. Water Ice is found in ice anomalies in the starter system — they appear as blue asteroids. You need Refined Water Ice to craft fuel and advanced components.`,
  },
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 3', 'combat', 'kill', 'Feral AI', 'NPC'],
    text: `Tutorial Stage 3 — First Combat: Engage and destroy a Feral AI drone in the starter system. Feral AI drones are NPC enemies that appear in asteroid fields and near derelict stations. They have approximately 400 Shield HP and 200 Armor HP. Use your starter turret module. Keep moving during combat — Feral AI drones have a short-range attack that misses if you maintain ~5km distance. Reward: 2x Microprocessors, 1x Combat Data Log.`,
  },
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 4', 'Reflex', 'craft', 'component', 'manufacturing'],
    text: `Tutorial Stage 4 — Craft a Reflex Component: Manufacture a Reflex Hull Component using your SMU. Recipe: 10x Iron Plates + 5x Copper Wire + 2x Refined Water Ice + 1x Microprocessor → 1x Reflex Hull Component. This component is used in upgrading your Shell. Copper Wire is crafted from Copper Ore (found in the same asteroid fields as Iron Ore): 3x Copper Ore → 1x Copper Wire.`,
  },
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 5', 'Reflex', 'launch', 'upgrade', 'ship upgrade'],
    text: `Tutorial Stage 5 — Launch Your Reflex: Apply the Reflex Hull Component to your Shell via the Ship Fitting screen. This upgrades your Rugged Shell to a Rugged Shell Mk.II, adding +50 cargo bay, +100 fuel capacity, and +200 Shield HP. You must be docked at your own Smart Assembly to apply hull upgrades. Components cannot be applied in open space.`,
  },
  {
    source: 'EVE Frontier Tutorial Guide',
    category: 'tutorial',
    keywords: ['tutorial', 'stage 6', 'complete', 'gate', 'jump', 'leave', 'starter system'],
    text: `Tutorial Stage 6 — Leave the Starter System: Use a Smart Gate to jump to an adjacent system. Smart Gates require a small fuel toll (typically 5–10 units) paid to the gate owner. Before leaving the starter system, ensure you have: at least 100 units of fuel, 50+ Iron Plates in cargo, and your Reflex Component applied. The adjacent systems have richer resources but also higher Feral AI density and active PvP.`,
  },

  // ── COMBAT / THREATS ──────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Combat Reference',
    category: 'combat',
    keywords: ['Feral AI', 'NPC', 'threat', 'hostile', 'danger', 'enemy'],
    text: `Feral AI entities are NPC enemies that roam EVE Frontier systems. They range from weak Scout Drones (200 HP total, easy) to heavy Feral Cruisers (4000+ HP, dangerous solo). Feral AI density increases with system distance from the starter zone. GHOST tracks hostile entity count from on-chain combat events. If GHOST fires a Threat Proximity alert, dock immediately or prepare to fight. Never engage a Feral Cruiser in a Rugged Shell without full shield modules equipped.`,
  },
  {
    source: 'EVE Frontier Combat Reference',
    category: 'combat',
    keywords: ['PvP', 'player combat', 'attack', 'kill', 'defend', 'escape'],
    text: `Player vs Player (PvP) combat is unrestricted outside the starter system. If another player attacks you, your best options in order of preference: (1) Gate jump immediately — you can jump even under attack if fuel is available. (2) Dock at the nearest SSU — docking gives temporary invulnerability (5 seconds grace period). (3) Fight back — only if you are in an Aggressive Shell or have turret advantage. Never fight a 2v1 in a Rugged Shell.`,
  },
  {
    source: 'EVE Frontier Combat Reference',
    category: 'combat',
    keywords: ['death', 'respawn', 'clone', 'loss', 'pod', 'recovery'],
    text: `When your Shell is destroyed, you respawn in your last docked station (or the starter system if you have never docked). You lose: all cargo in the Shell, all Crowns carried on the Shell, any fitted modules not insured. You keep: Crowns stored at stations, skills, and your wallet balance. After death, retrieve your insurance payout (if any) from the nearest station terminal. Rebuild time for a basic Rugged Shell is approximately 30 minutes of farming.`,
  },

  // ── SMART ASSEMBLIES / MANUFACTURING ─────────────────────────────────────
  {
    source: 'EVE Frontier Industry Guide',
    category: 'manufacturing',
    keywords: ['manufacturing', 'SMU', 'Smart Manufacturing Unit', 'craft', 'recipe', 'printer'],
    text: `Smart Manufacturing Units (SMUs) are player-deployable assembly structures. Once anchored and brought Online, they allow crafting of components, modules, and shells. SMUs can be set to public (any player can use for a fee) or private. Do NOT dismantle an SMU while a manufacturing job is running — the job will be cancelled and materials lost. GHOST fires a Manufacturing Safety alert if you have active jobs.`,
  },
  {
    source: 'EVE Frontier Industry Guide',
    category: 'manufacturing',
    keywords: ['recipe', 'Iron Plate', 'iron', 'ore', 'smelt', 'basic material'],
    text: `Basic Material Recipes (SMU required): Iron Ore × 5 → Iron Plate × 1 (2 min). Copper Ore × 3 → Copper Wire × 1 (2 min). Water Ice × 3 → Refined Water Ice × 1 (5 min). Silicon Crystal × 4 → Microprocessor × 1 (10 min). Iron Plate × 3 + Copper Wire × 2 → Structural Frame × 1 (15 min). These are the foundation materials for all advanced components. Silicon Crystals are found in rocky asteroid fields in mid-tier systems.`,
  },
  {
    source: 'EVE Frontier Industry Guide',
    category: 'manufacturing',
    keywords: ['turret', 'module', 'weapon', 'craft', 'equip', 'combat module'],
    text: `Turret Module Recipes: Light Railgun: 5x Iron Plates + 3x Copper Wire + 1x Microprocessor (20 min) — best DPS/cost for new players. Medium Autocannon: 10x Iron Plates + 5x Copper Wire + 3x Microprocessors + 1x Structural Frame (45 min) — 2× DPS of Light Railgun, requires Aggressive or Rugged Mk.II. Heavy Torpedo Launcher: 20x Iron Plates + 10x Copper Wire + 8x Microprocessors + 3x Structural Frames (90 min) — capital-class damage, Aggressive Shell only.`,
  },
  {
    source: 'EVE Frontier Industry Guide',
    category: 'manufacturing',
    keywords: ['fuel', 'strontium', 'craft fuel', 'make fuel', 'fuel recipe'],
    text: `Fuel Crafting Recipe: Strontium Clathrates (fuel) can be crafted or purchased. Crafting: 5x Refined Water Ice + 2x Iron Plates → 10x Strontium Clathrates (15 min in SMU). This is the cheapest source of fuel if you have water ice stockpiles. Alternatively, buy from SSU market terminals — prices typically range from 5–15 ISK per unit depending on system supply.`,
  },

  // ── SMART GATES / NAVIGATION ──────────────────────────────────────────────
  {
    source: 'EVE Frontier Navigation Guide',
    category: 'navigation',
    keywords: ['Smart Gate', 'gate', 'jump', 'travel', 'system', 'navigation'],
    text: `Smart Gates are player-built transit structures connecting systems. Each jump through a Smart Gate costs fuel (typically 5–15 units toll paid to gate owner, plus your ship's own fuel consumption per jump). Gates can be set to public, ally-only, or private. If a gate is private and you don't have access, you cannot jump through it. Always check gate access permissions before planning a route. GHOST uses JumpEvent data to track which gates you have used.`,
  },
  {
    source: 'EVE Frontier Navigation Guide',
    category: 'navigation',
    keywords: ['starter system', 'safe', 'protected', 'new player zone', 'tutorial zone'],
    text: `The starter system (Seraph's Landing) is a protected zone: PvP is disabled, Feral AI is capped at Scout-class only, and resources respawn quickly. It is the safest place to farm and build early. However, resources are limited compared to outer systems. Once you complete Tutorial Stage 6 and jump out, you cannot return to the protected status — the starter system remains accessible but PvP becomes active beyond its border gates.`,
  },

  // ── SMART STORAGE UNITS / MARKET ──────────────────────────────────────────
  {
    source: 'EVE Frontier Economy Guide',
    category: 'economy',
    keywords: ['SSU', 'Smart Storage Unit', 'market', 'sell', 'buy', 'trade', 'price'],
    text: `Smart Storage Units (SSUs) serve as both storage and player-run market terminals. Owners can list items for sale at any price. To buy from an SSU: fly within docking range, open the market panel, and purchase. Items go directly into your cargo bay — ensure you have enough free space. SSUs can also accept buy orders. The GHOST "nearest fuel SSU" feature queries the blockchain gateway for SSUs near your current system with Strontium Clathrates in stock.`,
  },

  // ── ORBITAL ZONES ─────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier World Guide',
    category: 'navigation',
    keywords: ['orbital zone', 'zone', 'region', 'dangerous', 'high sec', 'low sec'],
    text: `Systems in EVE Frontier are divided into three zone tiers: Green Zone (starter, protected, low resource), Yellow Zone (mid-tier, PvP enabled, moderate Feral AI, good resources), and Red Zone (outer systems, heavy PvP, Elite Feral AI, richest ore deposits and rarest blueprints). GHOST threat level maps roughly to zone: SAFE/LOW = Green, ELEVATED = Yellow, HIGH/CRITICAL = Red. Do not enter Red Zone systems without a combat-fitted shell and an escape plan.`,
  },

  // ── SURVIVAL TIPS ─────────────────────────────────────────────────────────
  {
    source: 'EVE Frontier Survival Guide',
    category: 'survival',
    keywords: ['survival', 'tips', 'beginner', 'advice', 'mistake', 'warning'],
    text: `Top survival rules for EVE Frontier: (1) Never carry more than you can afford to lose. (2) Always have fuel to return home before exploring. (3) Check local system activity before mining in open space. (4) Store Crowns at a station before going into PvP zones. (5) Keep your SMU Online only when you have active jobs — an offline SMU cannot be attacked. (6) Join a tribe early — solo play in Yellow/Red zones is extremely high risk.`,
  },
  {
    source: 'EVE Frontier Survival Guide',
    category: 'survival',
    keywords: ['tribe', 'alliance', 'group', 'fleet', 'cooperation', 'multiplayer'],
    text: `Tribes are player groups in EVE Frontier (similar to corporations in classic EVE). Benefits of joining a tribe: shared SSU access, gate permissions, coordinated defense, and resource pooling. To join a tribe, find recruitment posts in the in-game chat or EVE Frontier Discord. GHOST Commander Mode (when multiple tribe members connect their wallets) aggregates fleet state and can warn the tribe leader of individual member fuel/threat levels.`,
  },
];

export function seedKnowledgeBase(): void {
  if (KnowledgeBase.count() > 0) return;

  console.log('[KnowledgeBase] Seeding with game knowledge...');
  for (const chunk of SEED_DATA) {
    KnowledgeBase.insert(chunk);
  }
  console.log(`[KnowledgeBase] Seeded ${SEED_DATA.length} chunks.`);
}
