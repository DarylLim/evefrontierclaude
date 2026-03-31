import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { PlayerContext } from '../types';
import { SSUMarketCollector } from './SSUMarketCollector';
import { determineTutorialStage } from '../engine/TutorialTracker';
import { assessThreat } from '../engine/ThreatAssessor';

const WORLD_PACKAGE_ID = process.env.WORLD_PACKAGE_ID ?? '';
const SUI_FULL_NODE_URL = process.env.SUI_FULL_NODE_URL ?? getFullnodeUrl('testnet');
const POLL_INTERVAL_MS = parseInt(process.env.SESSION_POLL_INTERVAL_MS ?? '1000', 10);
const WORLD_API_URL = process.env.WORLD_API_URL ?? 'https://world-api-utopia.uat.pub.evefrontier.com';
const TENANT = process.env.TENANT ?? 'utopia';

// Cache ship type names so we don't call the world-api on every poll
const shipNameCache = new Map<number, string>();

type SuiObjectContent = {
  dataType: string;
  fields?: Record<string, unknown>;
};

export class StateCollector {
  private client: SuiClient;
  private walletAddress: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onUpdate: (ctx: PlayerContext) => void;
  private lastEventCursor: string | null = null;
  private lastKillmailCursor: string | null = null;
  private lastCombatEventAt: Date | null = null;
  private characterItemId: number | null = null; // numeric game ID for killmail filtering
  private hasJumped = false; // set to true once a JumpEvent is observed
  private ssuMarketCollector: SSUMarketCollector;

  constructor(walletAddress: string, onUpdate: (ctx: PlayerContext) => void) {
    this.walletAddress = walletAddress;
    this.onUpdate = onUpdate;
    this.client = new SuiClient({ url: SUI_FULL_NODE_URL });
    this.ssuMarketCollector = new SSUMarketCollector();
  }

  async start(): Promise<void> {
    try {
      await this.fetchAndEmit();
    } catch (err) {
      console.error('[StateCollector] Initial fetch failed, will retry on next poll:', err);
    }
    this.pollTimer = setInterval(() => this.pollEvents(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async fetchAndEmit(): Promise<void> {
    try {
      const ctx = await this.buildPlayerContext();
      this.onUpdate(ctx);
    } catch (err) {
      console.error('[StateCollector] fetchAndEmit error:', err);
    }
  }

  private async pollEvents(): Promise<void> {
    try {
      const jumpEventType = `${WORLD_PACKAGE_ID}::gate::JumpEvent`;
      const response = await fetch(SUI_FULL_NODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'suix_queryEvents',
          params: [{ MoveEventType: jumpEventType }, this.lastEventCursor, 10, false],
        }),
      });
      const data = await response.json() as {
        result?: { data: { id: { txDigest: string; eventSeq: string } }[]; nextCursor: string | null };
      };
      const result = data.result;
      if (result && result.data.length > 0) {
        this.lastEventCursor = result.nextCursor;
        this.hasJumped = true;
        await this.fetchAndEmit();
      }
    } catch (err) {
      console.error('[StateCollector] pollEvents error:', err);
    }

    // Also poll for killmail events if we know the player's numeric character ID
    if (this.characterItemId !== null) {
      await this.pollKillmailEvents(this.characterItemId);
    }
  }

  private async pollKillmailEvents(characterItemId: number): Promise<void> {
    try {
      const killmailEventType = `${WORLD_PACKAGE_ID}::killmail::KillmailCreatedEvent`;
      const response = await fetch(SUI_FULL_NODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'suix_queryEvents',
          params: [{ MoveEventType: killmailEventType }, this.lastKillmailCursor, 20, false],
        }),
      });
      const data = await response.json() as {
        result?: {
          data: {
            id: { txDigest: string; eventSeq: string };
            timestampMs?: string;
            parsedJson?: { victim_id?: { item_id?: string | number } };
          }[];
          nextCursor: string | null;
        };
      };
      const result = data.result;
      if (!result || result.data.length === 0) return;
      this.lastKillmailCursor = result.nextCursor;

      for (const event of result.data) {
        const victimItemId = Number(event.parsedJson?.victim_id?.item_id ?? -1);
        if (victimItemId === characterItemId) {
          const ts = event.timestampMs ? new Date(Number(event.timestampMs)) : new Date();
          if (!this.lastCombatEventAt || ts > this.lastCombatEventAt) {
            this.lastCombatEventAt = ts;
            console.log(`[StateCollector] Killmail event: player was killed at ${ts.toISOString()}`);
          }
        }
      }
    } catch (err) {
      console.warn('[StateCollector] pollKillmailEvents error:', err);
    }
  }

  private async buildPlayerContext(): Promise<PlayerContext> {
    const characterId = await this.queryCharacterId();

    let shellType: string | null = null;
    let shellTypeId: number | null = null;
    let fuelUnitsRemaining = 0;
    let fuelMaxCapacity = 0;
    let cargoItems: PlayerContext['cargoItems'] = [];
    const activeAssemblies: PlayerContext['activeAssemblies'] = [];

    if (characterId) {
      // Fetch numeric character item_id for killmail filtering (cached after first fetch)
      if (this.characterItemId === null) {
        this.characterItemId = await this.fetchCharacterItemId(characterId);
      }

      const ownerCaps = await this.fetchOwnerCaps(characterId);

      for (const cap of ownerCaps) {
        const assembly = await this.fetchAssembly(cap.authorizedObjectId);
        if (!assembly) continue;

        const typeName = await this.fetchShipName(assembly.typeId);
        activeAssemblies.push({
          id: cap.authorizedObjectId,
          typeId: assembly.typeId,
          typeName,
          status: assembly.status,
        });

        if (shellType === null) {
          shellType = typeName;
          shellTypeId = assembly.typeId;
        }

        if (assembly.energySourceId && fuelUnitsRemaining === 0) {
          const fuel = await this.fetchFuel(assembly.energySourceId);
          fuelUnitsRemaining = fuel.quantity;
          fuelMaxCapacity = fuel.maxCapacity;
        }

        // Fetch inventory from first assembly that has one
        if (cargoItems.length === 0) {
          cargoItems = await this.fetchInventory(cap.authorizedObjectId);
        }
      }
    }

    const fuelPct = fuelMaxCapacity > 0
      ? Math.round((fuelUnitsRemaining / fuelMaxCapacity) * 100)
      : 0;

    // Fetch nearest fuel SSU (cached, non-blocking on failure)
    const nearestFuelSSU = await this.ssuMarketCollector.fetchNearestFuelSSU();

    const { threatLevel, hostileEntityCount } = assessThreat({
      lastCombatEventAt: this.lastCombatEventAt,
      activeAssemblies,
      hasJumped: this.hasJumped,
      fuelPct,
    });

    const ctx: PlayerContext = {
      walletAddress: this.walletAddress,
      characterId,
      shellType,
      shellTypeId,
      fuelPct,
      fuelUnitsRemaining,
      fuelMaxCapacity,
      cargoItems,
      ammoCount: this.deriveAmmoCount(cargoItems),
      currentSystemId: null,
      currentSystemName: null,
      threatLevel,
      hostileEntityCount,
      tutorialStage: 0, // placeholder – computed below
      activeAssemblies,
      activeManufacturingJobs: this.countManufacturingJobs(activeAssemblies),
      hasJumped: this.hasJumped,
      lastCombatEventAt: this.lastCombatEventAt,
      nearestFuelSSU,
      lastUpdatedAt: new Date(),
    };

    ctx.tutorialStage = determineTutorialStage(ctx);

    return ctx;
  }

  // ── PlayerProfile → character_id ──────────────────────────────────────────

  private async queryCharacterId(): Promise<string> {
    const graphqlUrl = process.env.SUI_GRAPHQL_URL ?? '';
    if (!graphqlUrl || !WORLD_PACKAGE_ID) {
      console.warn('[StateCollector] SUI_GRAPHQL_URL or WORLD_PACKAGE_ID not set');
      return '';
    }

    const profileType = `${WORLD_PACKAGE_ID}::character::PlayerProfile`;
    const query = `
      query GetPlayerProfile($address: SuiAddress!, $profileType: String!) {
        address(address: $address) {
          objects(last: 10, filter: { type: $profileType }) {
            nodes {
              contents { json }
            }
          }
        }
      }
    `;

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { address: this.walletAddress, profileType } }),
    });

    const data = await response.json() as {
      data?: {
        address?: {
          objects?: { nodes?: { contents?: { json?: { character_id?: string } } }[] };
        };
      };
    };

    const nodes = data.data?.address?.objects?.nodes ?? [];
    return nodes[0]?.contents?.json?.character_id ?? '';
  }

  // ── OwnerCap<Assembly> objects owned by the character ────────────────────

  private async fetchOwnerCaps(
    characterObjectId: string,
  ): Promise<{ capId: string; authorizedObjectId: string }[]> {
    try {
      const ownerCapType = `${WORLD_PACKAGE_ID}::access::OwnerCap<${WORLD_PACKAGE_ID}::assembly::Assembly>`;
      const result = await this.client.getOwnedObjects({
        owner: characterObjectId,
        filter: { StructType: ownerCapType },
        options: { showContent: true },
      });

      const caps: { capId: string; authorizedObjectId: string }[] = [];
      for (const item of result.data) {
        const content = item.data?.content as SuiObjectContent | undefined;
        const fields = content?.fields;
        const authorizedObjectId = fields?.authorized_object_id as string | undefined;
        const capId = item.data?.objectId;
        if (capId && authorizedObjectId) {
          caps.push({ capId, authorizedObjectId });
        }
      }
      return caps;
    } catch (err) {
      console.warn('[StateCollector] fetchOwnerCaps error:', err);
      return [];
    }
  }

  // ── Assembly object ───────────────────────────────────────────────────────

  private async fetchAssembly(assemblyId: string): Promise<{
    typeId: number;
    status: string;
    energySourceId: string | null;
  } | null> {
    try {
      const obj = await this.client.getObject({
        id: assemblyId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as SuiObjectContent | undefined)?.fields;
      if (!fields) return null;

      const typeId = Number(fields.type_id ?? 0);
      const status = this.parseAssemblyStatus(fields.status);
      const energySourceId = (fields.energy_source_id as { fields?: { id?: string } } | null)?.fields?.id ?? null;

      return { typeId, status, energySourceId };
    } catch (err) {
      console.warn(`[StateCollector] fetchAssembly(${assemblyId}) error:`, err);
      return null;
    }
  }

  private parseAssemblyStatus(status: unknown): string {
    // AssemblyStatus is a Move enum — may come as a string or number
    if (typeof status === 'string') return status;
    if (typeof status === 'number') {
      return ['Unanchored', 'Anchored', 'Online', 'Offline'][status] ?? 'Unknown';
    }
    if (typeof status === 'object' && status !== null) {
      // Sui sometimes serialises Move enums as { variant: string }
      const variant = Object.keys(status as object)[0];
      if (variant) return variant;
    }
    return 'Unknown';
  }

  // ── NetworkNode → Fuel ────────────────────────────────────────────────────

  private async fetchFuel(networkNodeId: string): Promise<{ quantity: number; maxCapacity: number }> {
    try {
      const obj = await this.client.getObject({
        id: networkNodeId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as SuiObjectContent | undefined)?.fields;
      if (!fields) return { quantity: 0, maxCapacity: 0 };

      // NetworkNode.fuel is a Fuel struct with quantity and max_capacity
      const fuel = fields.fuel as Record<string, unknown> | undefined;
      const fuelFields = (fuel as { fields?: Record<string, unknown> } | undefined)?.fields ?? fuel ?? {};

      const quantity = Number(fuelFields.quantity ?? 0);
      const maxCapacity = Number(fuelFields.max_capacity ?? 0);
      return { quantity, maxCapacity };
    } catch (err) {
      console.warn(`[StateCollector] fetchFuel(${networkNodeId}) error:`, err);
      return { quantity: 0, maxCapacity: 0 };
    }
  }

  // ── Character → numeric item_id (for killmail filtering) ─────────────────

  private async fetchCharacterItemId(characterObjectId: string): Promise<number | null> {
    try {
      const obj = await this.client.getObject({
        id: characterObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as SuiObjectContent | undefined)?.fields;
      if (!fields) return null;

      // Character.key is a TenantItemId { item_id: u64, tenant: String }
      const key = fields.key as { fields?: { item_id?: string | number } } | undefined;
      const itemId = key?.fields?.item_id ?? (fields.key as Record<string, unknown>)?.item_id;
      return itemId !== undefined ? Number(itemId) : null;
    } catch (err) {
      console.warn('[StateCollector] fetchCharacterItemId error:', err);
      return null;
    }
  }

  // ── Assembly → Inventory (dynamic field) ─────────────────────────────────

  private async fetchInventory(assemblyId: string): Promise<PlayerContext['cargoItems']> {
    try {
      const dynamicFields = await this.client.getDynamicFields({ parentId: assemblyId });
      // Find the inventory field — its type contains "Inventory"
      const inventoryField = dynamicFields.data.find(
        (f) => typeof f.name?.type === 'string' && (f.name.type as string).includes('Inventory') ||
               typeof f.objectType === 'string' && (f.objectType as string).includes('inventory')
      );
      if (!inventoryField) return [];

      const obj = await this.client.getObject({
        id: inventoryField.objectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as SuiObjectContent | undefined)?.fields;
      if (!fields) return [];

      // Inventory.value.items.contents is the item array
      // Structure: { value: { fields: { items: { fields: { contents: [...] } } } } }
      const value = fields.value as { fields?: Record<string, unknown> } | undefined;
      const items = (value?.fields?.items as { fields?: { contents?: unknown[] } } | undefined)?.fields?.contents
        ?? (fields.items as { fields?: { contents?: unknown[] } } | undefined)?.fields?.contents
        ?? [];

      return (items as unknown[]).map((entry) => {
        const e = entry as {
          fields?: {
            key?: string | number;
            value?: {
              fields?: { type_id?: string | number; quantity?: string | number; volume?: string | number };
            };
          };
        };
        const v = e.fields?.value?.fields ?? {};
        return {
          typeId: Number(v.type_id ?? 0),
          quantity: Number(v.quantity ?? 0),
          volume: Number(v.volume ?? 0),
        };
      });
    } catch (err) {
      console.warn(`[StateCollector] fetchInventory(${assemblyId}) error:`, err);
      return [];
    }
  }

  // ── Ammo derivation from cargo ─────────────────────────────────────────────

  private deriveAmmoCount(cargoItems: PlayerContext['cargoItems']): number {
    // Ammo type IDs are not definitively documented. Heuristic: items with
    // volume <= 0.1 and quantity > 10 are likely ammo/charges. If we later
    // learn exact typeIds, this can be refined.
    let ammoTotal = 0;
    for (const item of cargoItems) {
      if (item.volume <= 0.1 && item.quantity > 10) {
        ammoTotal += item.quantity;
      }
    }
    return ammoTotal;
  }

  // ── Manufacturing job detection ───────────────────────────────────────────

  private countManufacturingJobs(assemblies: PlayerContext['activeAssemblies']): number {
    // Assemblies with status "Online" that are SMU-type are potential
    // manufacturing hosts. We count Online assemblies as a proxy for active
    // manufacturing since querying individual SMU job queues requires
    // additional dynamic field lookups not yet implemented.
    return assemblies.filter((a) => a.status === 'Online').length;
  }

  // ── World API → Ship type name ────────────────────────────────────────────

  private async fetchShipName(typeId: number): Promise<string> {
    if (shipNameCache.has(typeId)) return shipNameCache.get(typeId)!;
    try {
      const response = await fetch(`${WORLD_API_URL}/v2/ships/${typeId}`);
      if (!response.ok) return `type_${typeId}`;
      const data = await response.json() as { name?: string };
      const name = data.name ?? `type_${typeId}`;
      shipNameCache.set(typeId, name);
      return name;
    } catch {
      return `type_${typeId}`;
    }
  }
}
