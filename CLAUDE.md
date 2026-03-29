# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GHOST is an AI companion app for EVE Frontier (blockchain MMO). It reads on-chain player state from the Sui blockchain (Utopia test server) and surfaces survival alerts + an LLM chat assistant. It is a hackathon project targeting the EVE Frontier × Sui Hackathon 2026.

- **Implementation plan**: `GHOST-IMPLEMENTATION.md` — day-by-day task breakdown, PRD references, and feature scope
- **Progress log**: `WALKTHROUGH.md` — documents what was actually built each step, research findings, discovered field names, and what remains unimplemented

## Commands

All commands run from the repo root. Node must be loaded via nvm first:

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

| Task | Command |
|---|---|
| Install all deps | `npm install` |
| Run backend (dev) | `npm run dev:backend` |
| Run frontend (dev) | `npm run dev:frontend` |
| Type-check backend | `npx tsc --project backend/tsconfig.json --noEmit` |
| Type-check frontend | `npx tsc --project frontend/tsconfig.json --noEmit` |
| Build both | `npm run build` |
| Lint frontend | `npm run lint --workspace=frontend` |

Both dev servers must run simultaneously in separate terminals. Backend on `:3001`, frontend on `:3000`.

If `better-sqlite3` or any native module breaks after a Node version change: `npm rebuild <module-name>`.

## Architecture

npm workspaces monorepo: `backend/` (Node.js/TypeScript) + `frontend/` (Next.js 15).

### Data flow

```
EVE Frontier game → Sui testnet blockchain
                          │
                    StateCollector (1s poll)
                          │ suix_queryEvents (JumpEvents)
                          │ GraphQL (PlayerProfile → character_id)
                          │ getOwnedObjects (OwnerCap<Assembly>)
                          │ getObject (Assembly, NetworkNode/fuel)
                          │ world-api REST (ship type names)
                          ▼
                    ContextEngine.transform()   ← pure, no I/O
                          │
                    HeuristicEngine.evaluate()  ← pure, 6 rules
                          │
                    AlertDispatcher (WebSocket)
                          │
                    Frontend Dashboard + ChatView
                          │
                    (on chat message)
                    KnowledgeBase.search() → MiniSearch FTS
                    LLMHandler.streamResponse() → Anthropic API
```

### Backend (`backend/src/`)

- **`index.ts`** — Express + WebSocket server entry point. Calls `seedKnowledgeBase()` on startup.
- **`api/SessionManager.ts`** — One session per wallet. Owns the StateCollector lifecycle, routes WS `chat` messages to LLMHandler, stores conversation history in memory.
- **`api/routes.ts`** — `POST /api/session/init` (wallet → sessionId) and `POST /api/session/end`.
- **`collector/StateCollector.ts`** — All Sui + world-api reads. Polls every 1s. Derives assembly/fuel data via OwnerCap chain.
- **`engine/ContextEngine.ts`** — Stateless: `Partial<PlayerContext>` → `PlayerContext`. Fills defaults.
- **`engine/HeuristicEngine.ts`** — 6 alert rules evaluated on every context update. No LLM, no latency.
- **`dispatcher/AlertDispatcher.ts`** — WebSocket wrapper. 5 message types: `player_context`, `alert`, `llm_token`, `llm_done`, `error`. Keeps last 20 alerts for reconnect replay.
- **`llm/KnowledgeBase.ts`** — In-memory MiniSearch FTS index. Rebuilt from seed data on every startup.
- **`llm/LLMHandler.ts`** — Builds prompt (system + PlayerContext + top-5 KB chunks + history + user message) and streams Anthropic response.
- **`llm/seedKnowledge.ts`** — 28 knowledge chunks covering fuel, shells, combat, tutorial, crafting, navigation.

### Frontend (`frontend/src/`)

- **`app/layout.tsx`** — Wraps app in `QueryClientProvider` + `SuiClientProvider` (network key: `"utopia"`) + `WalletProvider`.
- **`app/page.tsx`** — Wallet gate: shows `WalletConnector` if no account, `Dashboard` if connected.
- **`app/dashboard/page.tsx`** — Main view: FuelGauge, ThreatRing, assembly list, AlertFeed, ChatView, debug panel.
- **`app/chat/page.tsx`** — ChatView component (imported as component, not routed). Handles `llm_token`/`llm_done`/`alert` WS messages.
- **`hooks/usePlayerContext.ts`** — Calls `POST /session/init` on wallet connect, feeds WS messages into `playerContext` and `alerts` state.
- **`hooks/useWebSocket.ts`** — WS client with 2s reconnect.

### Key types (`backend/src/types/index.ts` mirrored in `frontend/src/types/index.ts`)

`PlayerContext` is the central data structure flowing through the entire pipeline. Both files must stay in sync when fields change. Dates are `Date` in backend, `string` in frontend (JSON serialisation).

Notable fields:
- `shellType: string | null` — ship name from world-api (e.g. "Reflex"), not an enum
- `shellTypeId: number | null` — raw `type_id` from on-chain Assembly
- `activeAssemblies` — `{ id, typeId, typeName, status }[]`
- Crowns/progression tokens do not exist on-chain — no crown fields

## EVE Frontier / Sui specifics

- **Network**: Utopia runs on **Sui public testnet** (`fullnode.testnet.sui.io:443`)
- **GraphQL**: `graphql.testnet.sui.io/graphql` — `address.objects` returns `MoveObjectConnection` (nodes are `MoveObject` directly, no `asMoveObject` needed; use `contents { json }`)
- **World Package ID** (Utopia): `0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75`
- **Object Registry ID** (Utopia): `0xc2b969a72046c47e24991d69472afb2216af9e91caf802684514f39706d7dc57`
- **World API** (Utopia): `https://world-api-utopia.uat.pub.evefrontier.com` — exposes `/v2/ships`, `/v2/solarsystems`, `/v2/types` etc. No character/assembly endpoints.
- **Blockchain Gateway**: `https://blockchain-gateway-utopia.live.tech.evefrontier.com`

### On-chain object model

PlayerProfile (wallet-owned) → `character_id` = Sui object ID of Character
Character (shared) → `owner_cap_id`; Character's object ID used as address for owned-object queries
OwnerCap<Assembly> (owned by character address) → `authorized_object_id` = Assembly ID
Assembly (shared) → `type_id` (u64), `status`, `energy_source_id` (NetworkNode ID)
NetworkNode (shared) → `fuel.quantity`, `fuel.max_capacity`
Location on Assembly = Poseidon2 hash (not human-readable; use LocationRegistry or JumpEvent tracking)

### Key constraints discovered from world-contracts source
- `Fuel` struct fields: `quantity` (not `current_fuel`), `max_capacity` (not `max_fuel`)
- `OwnerCap` field: `authorized_object_id` (not `object_id`)
- Assembly `energy_source_id` points to a **NetworkNode**, not an EnergySource directly
- Ship class names (Reflex, Recurve, etc.) are fetched from `/v2/ships/{type_id}` — there are no "Rugged/Reaping/Aggressive" on-chain enums

## Environment variables

See `backend/.env` and `frontend/.env`. Key ones:

| Variable | Where | Notes |
|---|---|---|
| `WORLD_PACKAGE_ID` | backend | Already set in `.env` |
| `SUI_FULL_NODE_URL` | backend | `https://fullnode.testnet.sui.io:443` |
| `SUI_GRAPHQL_URL` | backend | `https://graphql.testnet.sui.io/graphql` |
| `ANTHROPIC_API_KEY` | backend | Required for GHOST chat |
| `TENANT` | backend | `utopia` (test), `stillness` (production) |
| `WORLD_API_URL` | backend | Defaults to Utopia world-api if not set |
