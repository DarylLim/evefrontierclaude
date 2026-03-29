/**
 * SSUMarketCollector — queries the blockchain gateway REST API for Smart Storage
 * Units (SSUs) that have fuel available for sale.
 *
 * Since there is no "list all SSUs" endpoint, we maintain a small hardcoded list
 * of known SSU IDs from the starter region and query each one individually.
 */

const BLOCKCHAIN_GATEWAY_URL =
  process.env.BLOCKCHAIN_GATEWAY_URL ??
  'https://blockchain-gateway-utopia.live.tech.evefrontier.com';

const CACHE_TTL_MS = 60_000; // 60 seconds

// Fuel type ID used in EVE Frontier inventories
const FUEL_TYPE_ID = 77;

/**
 * Known SSU IDs in the starter region.  These are placeholders — replace with
 * real smart-assembly IDs once discovered in-game.
 */
const KNOWN_SSU_IDS: { id: string; systemName: string }[] = [
  { id: '0xSSU_STARTER_REGION_A', systemName: 'Utopia Starter A' },
  { id: '0xSSU_STARTER_REGION_B', systemName: 'Utopia Starter B' },
  { id: '0xSSU_STARTER_REGION_C', systemName: 'Utopia Starter C' },
];

interface SSUResult {
  id: string;
  systemName: string;
  fuelAvailable: number;
}

interface InventoryItem {
  typeId?: number;
  type_id?: number;
  quantity?: number;
}

interface SmartAssemblyResponse {
  inventory?: InventoryItem[];
  items?: InventoryItem[];
}

export class SSUMarketCollector {
  private cache: SSUResult | null = null;
  private cacheExpiresAt = 0;

  /**
   * Returns the SSU with the most fuel available, or null if none can be
   * reached or none have fuel.  Results are cached for 60 seconds.
   */
  async fetchNearestFuelSSU(): Promise<SSUResult | null> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    try {
      const results = await Promise.allSettled(
        KNOWN_SSU_IDS.map((ssu) => this.querySSU(ssu)),
      );

      let best: SSUResult | null = null;

      for (const result of results) {
        if (result.status !== 'fulfilled' || result.value === null) continue;
        if (best === null || result.value.fuelAvailable > best.fuelAvailable) {
          best = result.value;
        }
      }

      this.cache = best;
      this.cacheExpiresAt = now + CACHE_TTL_MS;
      return best;
    } catch (err) {
      console.warn('[SSUMarketCollector] fetchNearestFuelSSU error:', err);
      return null;
    }
  }

  /**
   * Query a single SSU by its ID and extract the fuel quantity from its
   * inventory.
   */
  private async querySSU(
    ssu: { id: string; systemName: string },
  ): Promise<SSUResult | null> {
    const url = `${BLOCKCHAIN_GATEWAY_URL}/smartassemblies/${ssu.id}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SmartAssemblyResponse;

    // The inventory may live under "inventory" or "items" depending on the
    // gateway version.
    const items: InventoryItem[] = data.inventory ?? data.items ?? [];

    let fuelAvailable = 0;
    for (const item of items) {
      const typeId = item.typeId ?? item.type_id ?? 0;
      if (typeId === FUEL_TYPE_ID) {
        fuelAvailable += item.quantity ?? 0;
      }
    }

    if (fuelAvailable <= 0) {
      return null;
    }

    return {
      id: ssu.id,
      systemName: ssu.systemName,
      fuelAvailable,
    };
  }
}
