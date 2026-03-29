# Step 1 Walkthrough — Project Setup

## What was done

Implemented **Step 1: Project Setup** from the PRD (Section 2, "Confirmed APIs — Implementation Steps").

---

## Monorepo scaffold

Created a root `package.json` with npm workspaces pointing at `backend/` and `frontend/`. This lets both packages share a single `node_modules` and be managed from the repo root.

```
eve-frontier-ghost/
├── package.json          ← workspace root
├── .gitignore
├── backend/
└── frontend/
```

---

## Backend (`/backend`)

TypeScript/Node.js service. Handles Sui polling, alert logic, WebSocket connections, and LLM calls.

### Files created

| File | Purpose |
|---|---|
| `package.json` | Dependencies + `ts-node-dev` for local dev |
| `tsconfig.json` | Strict TypeScript, CommonJS output to `dist/` |
| `src/types/index.ts` | Canonical `PlayerContext` and `AlertCard` interfaces (from PRD §10) |
| `src/collector/StateCollector.ts` | Connects to Sui; polls `suix_queryEvents` every 1s for JumpEvents; queries GraphQL for `PlayerProfile` → `character_id`. Stubs for Character/Inventory/Fuel fetches marked TODO Day 1. |
| `src/engine/ContextEngine.ts` | Stateless transformer: raw Sui JSON → `PlayerContext`. Computes derived fields (`fuelPct`, `crownEstimatedHours`). No external calls. |
| `src/engine/HeuristicEngine.ts` | Evaluates all 6 alert rules from the PRD against `PlayerContext`. Returns `AlertCard[]`. No LLM, no latency. Rules: `fuel_critical`, `threat_proximity`, `shell_risk`, `stranding_alert`, `manufacturing_safety`, `tutorial_nudge`. |
| `src/dispatcher/AlertDispatcher.ts` | Wraps a WebSocket connection. Pushes `PlayerContext`, `AlertCard`, LLM token stream, and errors to the client. Keeps last 20 alerts for reconnect replay. |
| `src/llm/KnowledgeBase.ts` | SQLite FTS5 knowledge store. `search(query)` returns top-5 BM25-scored chunks. `insert()` adds chunks at build time. Schema auto-created on first run. DB file at `backend/data/knowledge.db`. |
| `src/llm/LLMHandler.ts` | Builds the exact prompt schema from PRD §12 (system prompt + PlayerContext + knowledge chunks + conversation history + user message). Streams Anthropic response token-by-token via callbacks. |
| `src/api/routes.ts` | Express routes: `POST /api/session/init` (start polling for a wallet address, return `sessionId`) and `POST /api/session/end` (stop polling). |
| `src/api/SessionManager.ts` | Owns the lifecycle of each player session. Creates `StateCollector`, runs `ContextEngine` + `HeuristicEngine` on every update, routes WebSocket messages to `LLMHandler`. |
| `src/index.ts` | Entry point. Express HTTP server + `ws` WebSocket server on `/ws?sessionId=`. |
| `.env.example` | All required env vars with descriptions (see §11 of PRD). |
| `data/` | Empty directory — SQLite DB will be created here at runtime. |

### Data flow (backend internal)

```
StateCollector (1s Sui poll)
  → PlayerContext (raw)
    → ContextEngine.transform()
      → PlayerContext (typed + derived fields)
        → HeuristicEngine.evaluate()
          → AlertCard[]
            → AlertDispatcher (WebSocket push to frontend)

WS message "chat" from frontend
  → KnowledgeBase.search() → top-5 chunks
  → LLMHandler.streamResponse() → Anthropic API
    → token stream → AlertDispatcher → frontend
```

---

## Frontend (`/frontend`)

Next.js 15 PWA. Mobile-first dark theme. Wallet gate → dashboard.

### Files created

| File | Purpose |
|---|---|
| `package.json` | Next.js 15, TailwindCSS, `@mysten/dapp-kit`, `@mysten/sui`, `@tanstack/react-query` |
| `tsconfig.json` | Next.js TypeScript config with `@/*` path alias |
| `next.config.ts` | Minimal Next.js config |
| `tailwind.config.ts` | Dark EVE-themed palette: `ghost-bg`, `ghost-accent` (cyan), `ghost-warning`, `ghost-danger`, `ghost-safe` |
| `postcss.config.js` | TailwindCSS + autoprefixer |
| `src/types/index.ts` | Frontend copies of `PlayerContext` and `AlertCard` (dates as strings for JSON serialization) |
| `src/app/globals.css` | Tailwind base + monospace font + dark background |
| `src/app/layout.tsx` | Root layout: wraps app in `QueryClientProvider` + `SuiClientProvider` + `WalletProvider` |
| `src/app/page.tsx` | Root page: shows `WalletConnector` if no wallet, `Dashboard` if connected |
| `src/app/dashboard/page.tsx` | Main dashboard: fuel gauge, threat ring, shell/crown stats, top 3 alerts, chat panel |
| `src/app/chat/page.tsx` | Chat UI: streaming GHOST responses, user messages (right-aligned), alert cards inline. Handles `llm_token` / `llm_done` / `alert` WebSocket message types. |
| `src/components/WalletConnector.tsx` | Full-screen connect screen. EVE Vault `ConnectButton` + fallback manual address input for read-only mode. |
| `src/components/FuelGauge.tsx` | Animated progress bar. Green >50%, amber 20–50%, red <20%. |
| `src/components/ThreatRing.tsx` | Circular threat indicator. Color + pulse animation based on threat level. |
| `src/components/AlertCard.tsx` | Alert display with severity-based border color (info/warning/critical). |
| `src/hooks/useWebSocket.ts` | WebSocket client hook. Connects to `NEXT_PUBLIC_BACKEND_WS_URL/ws?sessionId=...`. Auto-reconnects on close. Exposes `lastMessage` and `sendMessage`. |
| `src/hooks/usePlayerContext.ts` | Calls `POST /api/session/init` on wallet connect. Feeds `lastMessage` from `useWebSocket` into `playerContext` and `alerts` state. |
| `.env.example` | `NEXT_PUBLIC_BACKEND_WS_URL`, `NEXT_PUBLIC_BACKEND_HTTP_URL` |

---

## Dependencies installed

All 764 packages installed successfully via:

```bash
npm_config_python=$(pyenv root)/versions/3.10.16/bin/python3 npm install
```

> **Note:** Python 3.10 must be specified explicitly. The project's pyenv default (3.7) is too old for `node-gyp` (requires 3.8+ for the walrus operator). This only affects the initial install.

TypeScript compilation verified clean:

```bash
npx tsc --project backend/tsconfig.json --noEmit
# → 0 errors
```

---

---

# Step 2 Walkthrough — Day 2: Frontend + Chat + LLM

## What was done

Implemented **Day 2** tasks from the GHOST-IMPLEMENTATION.md plan. The Day 1 scaffolding was already more complete than expected — `LLMHandler`, `SessionManager`, `HeuristicEngine` (all 6 rules), and all frontend components/hooks were real implementations, not empty stubs.

---

## Backend changes

### KnowledgeBase seeding (`src/llm/seedKnowledge.ts`)

Created a seed module with **28 knowledge chunks** covering:

| Category | Topics |
|---|---|
| `fuel` | Fuel mechanics, consumption rates per shell type, stranding risk, refueling via SSU, crafting strontium clathrates |
| `shells` | Rugged / Reaping / Aggressive stats, cargo, fuel capacity, DPS, crafting recipes |
| `crowns` | What Crowns are, death penalty, safe storage strategy |
| `tutorial` | All 6 tutorial stages with step-by-step guidance |
| `combat` | Feral AI tiers, PvP escape tactics, death/respawn mechanics |
| `manufacturing` | SMU usage, basic material recipes, turret recipes, fuel crafting |
| `navigation` | Smart Gates, starter system protection, zone tiers (Green/Yellow/Red) |
| `economy` | SSU market mechanics, nearest fuel SSU lookup |
| `survival` | Top survival rules, tribe/alliance benefits |

Seeding runs at backend startup (`src/index.ts`) only if the DB is empty — safe to restart repeatedly.

### KnowledgeBase fix (`src/llm/KnowledgeBase.ts`)

Added `fs.mkdirSync(..., { recursive: true })` before opening the SQLite database so the `backend/data/` directory is created automatically on first run.

### dotenv dependency (`backend/package.json`)

Added `dotenv` to dependencies — it was imported in `src/index.ts` but missing from `package.json`.

---

## Frontend changes

### AlertFeed component (`src/components/AlertFeed.tsx`)

New component replacing the raw top-3 alert list in the dashboard. Features:
- Category filter tabs: **ALL / THREAT / FUEL / SAFETY / TUTORIAL / ECONOMIC**
- Badge count on each tab showing number of active alerts in that category
- Horizontally scrollable tab bar (fits 375px mobile)
- Empty state message per category

### Dashboard updated (`src/app/dashboard/page.tsx`)

Replaced the hardcoded `alerts.slice(0, 3).map(AlertCard)` block with `<AlertFeed alerts={alerts} />` inside a labelled panel.

---

## Session / LLM architecture (already complete from Day 1)

These were already fully implemented — no changes needed:

- **`LLMHandler`** — streams Anthropic API responses token-by-token, injects `PlayerContext` + top-5 BM25 knowledge chunks into every prompt
- **`SessionManager`** — manages session lifecycle, routes WebSocket `chat` messages to `LLMHandler`, replays last 20 alerts on reconnect
- **`AlertDispatcher`** — WebSocket wrapper for all 5 message types (`player_context`, `alert`, `llm_token`, `llm_done`, `error`)
- **`HeuristicEngine`** — all 6 rules live: `fuel_critical`, `threat_proximity`, `shell_risk`, `stranding_alert`, `manufacturing_safety`, `tutorial_nudge`
- **`useWebSocket`** / **`usePlayerContext`** hooks — fully wired
- **`ChatView`** — streaming chat UI with typing indicator, 3 message types (user/ghost/alert)

---

## Redis

Skipped for now. `SessionManager` uses an in-memory `Map` for session state. Redis would be needed for multi-instance production deploys. The in-memory store is sufficient for local dev and single-instance hosting.

---

## Startup verification

```
[KnowledgeBase] Seeding with game knowledge...
[KnowledgeBase] Seeded 28 chunks.
[GHOST Backend] Listening on port 3001
```

Frontend: Next.js 15 ready on `http://localhost:3000`

---

## What is NOT yet done (Day 1 TODOs)

All originally listed Day 1 TODOs are now resolved — see Step 3 below.

---

# Step 3 Walkthrough — Day 1 Data Fetches: Real On-Chain State

## What was done

Completed the Day 1 data fetches by researching the `world-contracts` GitHub source and probing the live Sui GraphQL schema. All data now flows from real on-chain objects.

---

## Research findings (world-contracts source)

| Assumption | Reality |
|---|---|
| Crowns exist on-chain | **No** — not in any Move contract. Not a `PlayerContext` field. |
| `shellType` is `Rugged/Reaping/Aggressive` | **No** — on-chain it's a `u64 type_id`. Name comes from world-api `/v2/ships/{id}` |
| `fuel.current_fuel`, `fuel.max_fuel` | **Wrong** — actual fields are `quantity` and `max_capacity` |
| Fuel is on Assembly directly | **No** — Assembly has `energy_source_id` → NetworkNode → `fuel.quantity` |
| `OwnerCap.object_id` | **Wrong** — actual field is `authorized_object_id` |
| Location is readable | **No** — stored as Poseidon2 hash. Not implemented. |
| Sui GraphQL: `... on MoveObject` fragment | **Invalid** — `address.objects` returns `MoveObjectConnection`; nodes are `MoveObject` directly; use `contents { json }` |

---

## StateCollector rewrite (`src/collector/StateCollector.ts`)

Full implementation of the on-chain fetch chain:

1. **`queryCharacterId()`** — GraphQL query fixed (removed invalid `... on MoveObject` fragment). Now correctly returns the Character's Sui object ID.

2. **`fetchOwnerCaps(characterObjectId)`** — Queries `OwnerCap<Assembly>` objects owned by the character's address using `client.getOwnedObjects`. Extracts `authorized_object_id` from each cap.

3. **`fetchAssembly(assemblyId)`** — Fetches Assembly shared object. Returns `typeId` (u64), `status` (parsed from Move enum), `energySourceId` (NetworkNode ID).

4. **`fetchFuel(networkNodeId)`** — Fetches NetworkNode shared object. Extracts `fuel.quantity` and `fuel.max_capacity`.

5. **`fetchShipName(typeId)`** — Calls world-api `/v2/ships/{typeId}` to resolve numeric type_id to ship name. Results cached in module-level `Map` to avoid repeated calls.

JumpEvent polling updated: module path corrected to `gate::JumpEvent`.

---

## Type changes

**`PlayerContext`** (backend `src/types/index.ts` + frontend `src/types/index.ts`):
- Removed: `crownCount`, `crownEstimatedHours` — not on-chain
- Changed: `shellType: string | null` (was hardcoded union `'Rugged' | 'Reaping' | 'Aggressive' | null`)
- Added: `shellTypeId: number | null` — raw on-chain type_id
- Changed: `activeAssemblies` entries now have `{ id, typeId, typeName, status }` (was `{ id, type, status }`)

**`ContextEngine`** — updated to match new types, removed crown derivation logic.

**`HeuristicEngine`** — `shell_risk` rule updated (no longer checks crownCount; checks for Online assembly + recent combat).

---

## Dashboard updated

- Removed Crown display
- Assembly list now shows real `typeName` + `status` with colour coding (Online = green)
- Ship name shown as `shellType` from world-api

---

## Environment

Added `WORLD_API_URL` to `backend/.env` (previously hardcoded default only).

---

## Still not implemented

- **Location** — Assembly location is a Poseidon2 hash. Human-readable system ID requires LocationRegistry lookup (not yet implemented). `currentSystemId` / `currentSystemName` remain `null`.

---

# Step 4 Walkthrough — Day 1 Complete: Inventory + Combat Events

## What was done

Completed the last two Day 1 TODOs: inventory fetch and killmail event polling.

---

## Inventory fetch (`fetchInventory`)

`Inventory` is not a standalone Sui object — it's a dynamic field on the Assembly shared object. Fetching it requires:

1. `client.getDynamicFields({ parentId: assemblyId })` — enumerate all dynamic fields
2. Find the field whose `name.type` or `objectType` contains `"Inventory"` or `"inventory"`
3. `client.getObject({ id: field.objectId })` — fetch the field value object
4. Parse the nested struct: `value.fields.items.fields.contents[]` (array of `{ key: typeId, value: { type_id, quantity, volume } }`)

**Type changes:**
- `cargoItems` updated from `{ typeId: string; quantity: number }[]` to `{ typeId: number; quantity: number; volume: number }[]` — matches on-chain u64 fields

If no inventory dynamic field is found on an assembly, returns `[]` silently.

---

## Killmail event polling (`pollKillmailEvents`)

Move event type: `${WORLD_PACKAGE_ID}::killmail::KillmailCreatedEvent`

Fields of interest: `victim_id: { item_id: u64, tenant: String }`

Implementation:
- `characterItemId` — the player's numeric game ID — is fetched once from `Character.key.item_id` and cached on the `StateCollector` instance
- `fetchCharacterItemId(characterObjectId)` calls `client.getObject` on the Character shared object and reads `fields.key.fields.item_id`
- `pollKillmailEvents()` runs on every poll interval alongside JumpEvent polling
- Events are filtered client-side: `victim_id.item_id === characterItemId`
- On match, `this.lastCombatEventAt` is updated (monotonic — only moves forward)
- `buildPlayerContext()` includes `this.lastCombatEventAt` in the returned context

**Why client-side filter:** Sui `suix_queryEvents` only supports filtering by `MoveEventType`, not by event field values. All `KillmailCreatedEvent`s must be fetched and filtered locally.

---

## Day 1 status

All Day 1 items are now implemented:

| Item | Status |
|---|---|
| PlayerProfile → character_id | ✅ |
| OwnerCap → Assembly | ✅ |
| Assembly → status, typeId | ✅ |
| NetworkNode → fuel quantity/capacity | ✅ |
| World API → ship name | ✅ |
| Assembly dynamic field → Inventory | ✅ |
| Character.key.item_id → killmail filter | ✅ |
| KillmailCreatedEvent polling | ✅ |
| Location (Poseidon2 hash) | ❌ not implemented |
