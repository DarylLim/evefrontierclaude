import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { PlayerContext } from '../types';

// TODO Day 1: Source from Stillness Blockchain Addresses page
const WORLD_PACKAGE_ID = process.env.WORLD_PACKAGE_ID ?? '';
const SUI_FULL_NODE_URL = process.env.SUI_FULL_NODE_URL ?? getFullnodeUrl('mainnet');
const POLL_INTERVAL_MS = parseInt(process.env.SESSION_POLL_INTERVAL_MS ?? '1000', 10);

export class StateCollector {
  private client: SuiClient;
  private walletAddress: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onUpdate: (ctx: PlayerContext) => void;
  private lastEventCursor: string | null = null;

  constructor(walletAddress: string, onUpdate: (ctx: PlayerContext) => void) {
    this.walletAddress = walletAddress;
    this.onUpdate = onUpdate;
    this.client = new SuiClient({ url: SUI_FULL_NODE_URL });
  }

  async start(): Promise<void> {
    // Initial fetch
    await this.fetchAndEmit();
    // Poll for events
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
      // TODO Day 1: Replace with actual JumpEvent type string once WORLD_PACKAGE_ID is known
      const jumpEventType = `${WORLD_PACKAGE_ID}::smartgate::JumpEvent`;

      const response = await fetch(SUI_FULL_NODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_queryEvents',
          params: [
            { MoveEventType: jumpEventType },
            this.lastEventCursor,
            10,
            false,
          ],
        }),
      });

      const data = await response.json() as { result?: { data: { id: { txDigest: string; eventSeq: string } }[]; nextCursor: string | null } };
      const result = data.result;
      if (!result || result.data.length === 0) return;

      this.lastEventCursor = result.nextCursor;
      // Re-fetch full state on any new event
      await this.fetchAndEmit();
    } catch (err) {
      console.error('[StateCollector] pollEvents error:', err);
    }
  }

  private async buildPlayerContext(): Promise<PlayerContext> {
    const characterId = await this.queryCharacterId();

    // TODO Day 1: Implement remaining fetches (Character, Inventory, Fuel objects)
    // using TenantItemId derivation from object_registry.move

    return {
      walletAddress: this.walletAddress,
      characterId,
      shellType: null,
      crownCount: 0,
      crownEstimatedHours: 0,
      fuelPct: 0,
      fuelUnitsRemaining: 0,
      fuelMaxCapacity: 0,
      cargoItems: [],
      ammoCount: 0,
      currentSystemId: null,
      currentSystemName: null,
      threatLevel: 'SAFE',
      hostileEntityCount: 0,
      tutorialStage: 0,
      activeAssemblies: [],
      activeManufacturingJobs: 0,
      lastCombatEventAt: null,
      nearestFuelSSU: null,
      lastUpdatedAt: new Date(),
    };
  }

  private async queryCharacterId(): Promise<string> {
    // TODO Day 1: Query PlayerProfile via GraphQL
    // profileType = "0x<WORLD_PACKAGE_ID>::character::PlayerProfile"
    const graphqlUrl = process.env.SUI_GRAPHQL_URL ?? '';
    if (!graphqlUrl || !WORLD_PACKAGE_ID) {
      console.warn('[StateCollector] SUI_GRAPHQL_URL or WORLD_PACKAGE_ID not set');
      return '';
    }

    const profileType = `${WORLD_PACKAGE_ID}::character::PlayerProfile`;
    const query = `
      query GetCharacterDetails($address: SuiAddress!, $profileType: String!) {
        address(address: $address) {
          objects(last: 10, filter: { type: $profileType }) {
            nodes {
              contents {
                ... on MoveObject {
                  contents { type { repr } json }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { address: this.walletAddress, profileType },
      }),
    });

    const data = await response.json() as {
      data?: {
        address?: {
          objects?: {
            nodes?: { contents?: { contents?: { json?: { character_id?: string } } } }[];
          };
        };
      };
    };

    const nodes = data.data?.address?.objects?.nodes ?? [];
    if (nodes.length === 0) return '';

    const json = nodes[0]?.contents?.contents?.json;
    return json?.character_id ?? '';
  }
}
