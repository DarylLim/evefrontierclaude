# GHOST — Implementation Plan
> AI coding agent reference. Based on live API research of docs.evefrontier.com (March 2026) and the world-contracts GitHub repo.

---

## Table of Contents
1. [API Feasibility Assessment](#1-api-feasibility-assessment)
2. [Confirmed APIs — Implementation Steps](#2-confirmed-apis--implementation-steps)
3. [Partial APIs — Day 1 Validation Plan](#3-partial-apis--day-1-validation-plan)
4. [Not Feasible — Required Redesigns](#4-not-feasible--required-redesigns)
5. [Component Implementation Detail](#5-component-implementation-detail)
6. [Data Flow: End-to-End](#6-data-flow-end-to-end)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Revised Risk Assessment](#8-revised-risk-assessment)
9. [Hourly Task Breakdown](#9-hourly-task-breakdown)
10. [PlayerContext TypeScript Interface](#10-playercontext-typescript-interface)
11. [Environment Variables](#11-environment-variables)
12. [LLM Prompt Schema](#12-llm-prompt-schema)
13. [Knowledge Base Curation Plan](#13-knowledge-base-curation-plan)

---

## 1. API Feasibility Assessment

### ✅ Confirmed — Build with confidence

| Feature | Evidence |
|---|---|
| Query PlayerProfile by wallet address | Documented GraphQL query in official docs: `address(address: $address) { objects(filter: { type: $profileType }) }`. Returns `character_id`. |
| Read Character/Shell object (Crowns, Shell type, status) | Character is a shared Sui object. Fetch via deterministic ID derived from `character_id + TenantItemId`. Source: `character.move` on GitHub. |
| Read Inventory contents (cargo, ammo, ore, crafted items) | `inventory.move` is a Layer 1 primitive. SSU inventory confirmed via live endpoint: `blockchain-gateway-utopia.live.tech.evefrontier.com/smartassemblies/{ssu_id}`. |
| Read Assembly status (Online/Offline/Anchored) | `status.move` is a Layer 1 primitive exposed on all Smart Assembly shared objects. Queryable via SuiClient. |
| Subscribe to JumpEvent (gate traversal) | `suix_queryEvents` with `MoveEventType: "0x...::smartgate::JumpEvent"` — exact example in official interfacing docs. |
| Subscribe to inventory update events | Confirmed in interfacing docs: "World events include JumpEvent, inventory updates, and deployment changes." |
| EVE Vault wallet connection | External browser: connect to `https://dapps.evefrontier.com/?tenant=utopia`. EVE Vault browser extension required. Uses Sui Wallet Standard. |
| GraphQL batch queries (GetObjectsByType) | Live example querying NetworkNode objects by type. Endpoint live for Testnet and Utopia. |
| SSU inventory / market data via REST API | `GET blockchain-gateway-utopia.live.tech.evefrontier.com/smartassemblies/{ssu_id}` — confirmed in SmartStorageUnit docs. Returns JSON with inventory + ephemeral inventory. |
| Read Network Node status | `network_node.move` is a Layer 1 primitive. Shared objects queryable by type via GraphQL. |

### ⚠️ Partial — Validate on Day 1 before building

| Feature | Risk | Notes |
|---|---|---|
| `fuel.move` state (fuel level, consumption rate) | Medium | Primitive confirmed. Field names (`current_fuel`, `max_fuel`) NOT documented — must read `fuel.move` source on GitHub and test against Utopia. |
| `location.move` state (current system) | **HIGH** | Primitive confirmed. BUT: World Explainer explicitly states "on-chain locations are stored as cryptographic hashes, not cleartext coordinates." Raw system ID is NOT directly readable. Workaround: infer from JumpEvent history. |
| HP / hull damage state | High | Not listed as a Layer 1 primitive. May be server-side only. Test on Day 1. If unavailable, remove from dashboard. |
| Combat events (damage, kills) | Medium | Confirmed to exist but MoveEventType strings are not documented. Must grep `world-contracts` GitHub source for event struct definitions. |
| Feral AI / hostile entity detection | Medium | NPC objects exist on-chain but location hashing makes proximity filtering unclear. May need the blockchain-gateway REST API or custom indexer. |
| gRPC streaming | Low | gRPC confirmed live on Sui mainnet. But public full node may not expose the gRPC port. Use `suix_queryEvents` polling at 1s as safe fallback. |

### ❌ Not available via API — Redesign required

| Feature | Problem | Redesign |
|---|---|---|
| Route planner (star map pathfinding) | No star map or system graph API exists | Hardcode a ~30-system starter region graph for MVP demo. Label as "local region only." |
| Tutorial progression detection | No `tutorialStage` field on-chain | Infer from event patterns: first refined ore in inventory = refinery milestone, first kill event = combat milestone, etc. |
| Commander Mode (passive fleet aggregation) | No "query all tribe members" endpoint | Require opt-in: each tribe member connects their own wallet to GHOST. Aggregate from active sessions only. |

---

## 2. Confirmed APIs — Implementation Steps

### Step 1: Project Setup

```bash
npm install @mysten/sui @evefrontier/dapp-kit ws express next react tailwindcss
```

| # | Task | Detail |
|---|---|---|
| 1 | Install Sui TypeScript SDK | `npm install @mysten/sui` — gives access to SuiClient, GraphQL queries, suix_queryEvents |
| 2 | Configure network endpoint | Point SuiClient to EVE Frontier's Sui full node for Utopia. Source endpoint from the Utopia Blockchain Addresses page in docs. |
| 3 | Identify `WORLD_PACKAGE_ID` | Required for all GraphQL type filters (e.g. `0x<WORLD_PACKAGE_ID>::character::PlayerProfile`). Source from Utopia Blockchain Addresses page or world-contracts repo. |
| 4 | Clone world-contracts repo | `github.com/evefrontier/world-contracts` — contains Move source for all primitives. Essential for discovering undocumented field names. |

### Step 2: Player State Reader

```typescript
// Entry point: wallet address → character_id
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
// profileType = "0x<WORLD_PACKAGE_ID>::character::PlayerProfile"
```

| # | Task | Detail |
|---|---|---|
| 1 | Query PlayerProfile by wallet address | Input: player wallet address. Output: `character_id`. This is the entry point for all subsequent queries. |
| 2 | Derive Character object ID | Use `TenantItemId` (`character_id` + tenant string `"utopia"`) + `ObjectRegistry` to derive the deterministic Sui object ID. Formula is in `object_registry.move`. |
| 3 | Fetch Character object | `client.getObject({ id: characterObjectId, options: { showContent: true } })` — parse for Shell type, Crown list, tribe affiliation. |
| 4 | Fetch Inventory object | Derive inventory object ID from `character_id` using same `TenantItemId` pattern (`inventory.move`). Parse for cargo contents, ammo count, fuel quantity. |
| 5 | Fetch fuel.move state | Derive fuel object ID. Fetch and parse. **Caution:** field names must be verified against `fuel.move` source on GitHub. Expected: `current_fuel: u64`, `max_fuel: u64`. Validate on Day 1. |

### Step 3: Event Subscription

```typescript
// Poll suix_queryEvents every 1 second
const response = await fetch("https://fullnode.mainnet.sui.io:443", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 1,
    method: "suix_queryEvents",
    params: [{ MoveEventType: "0x<WORLD_PACKAGE_ID>::smartgate::JumpEvent" }, null, 10, false]
  })
});
```

| # | Task | Detail |
|---|---|---|
| 1 | Subscribe to JumpEvent | `MoveEventType: "0x<WORLD_PACKAGE_ID>::smartgate::JumpEvent"`. Poll every 1s. Each JumpEvent reveals which gate was used → enables system location inference. |
| 2 | Subscribe to inventory update events | Confirmed available. Discover exact MoveEventType string from world-contracts source. Use to detect cargo changes, manufacturing completions, fuel deposits. |
| 3 | Subscribe to assembly status events | Deployment changes are subscribable. Detect when player structures go online/offline. Derive from `status.move` event types. |
| 4 | Discover combat event types | Search `world-contracts` GitHub for `'event' structs` in combat modules. Look for `has copy, drop` struct definitions. Validate type strings against live Utopia data. |

### Step 4: Blockchain Gateway REST API

Base URL: `https://blockchain-gateway-utopia.live.tech.evefrontier.com`

| # | Task | Detail |
|---|---|---|
| 1 | Query SSU inventory | `GET /smartassemblies/{ssu_id}` — returns JSON with inventory items, prices, ephemeral inventory. Use for market intel and nearest fuel SSU. |
| 2 | Enumerate nearby SSUs | No "query all SSUs in system X" endpoint exists. Options: (a) query all SSUs by type via GraphQL then filter by inferred location, (b) maintain a community SSU registry from JumpEvent history. |
| 3 | Probe undocumented endpoints | Gateway likely exposes more than SSUs. On Day 1, probe `/smartassemblies`, `/characters`, `/world` to discover undocumented data. |

### Step 5: EVE Vault Wallet Connection

```typescript
import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";

// Tenant scoping
const tenantUrl = "https://dapps.evefrontier.com/?tenant=utopia"; // Utopia (test server)
```

| # | Task | Detail |
|---|---|---|
| 1 | Install `@evefrontier/dapp-kit` | Official EVE Frontier dApp kit. Provides wallet connection hooks for EVE Vault. |
| 2 | Configure tenant parameter | `?tenant=utopia` scopes all queries to Utopia (test server). Use `?tenant=stillness` for production. |
| 3 | Implement wallet connection flow | EVE Vault browser extension must be installed. Fallback: if not detected, prompt user to enter wallet address manually (read-only mode). |
| 4 | Extract wallet address post-connect | After connection, retrieve the player's Sui wallet address. This is the input to the PlayerProfile GraphQL query. |

---

## 3. Partial APIs — Day 1 Validation Plan

Run these tests in the **first 2 hours of Day 1** before writing any feature code.

| Feature | Validation Test | Fallback if Unavailable |
|---|---|---|
| `fuel.move` field names | Open `fuel.move` in world-contracts GitHub. Read struct fields. Write `client.getObject()` call against a test account on Utopia. Confirm JSON matches Move struct. | Derive fuel percentage from fuel-type items in cargo inventory instead. Less precise but functional for alerts. |
| Player location (`location.move`) | Fetch Character object, look for any location field. If hashed: try to match hash against known system hashes in world-contracts. If unhashable: fall back to JumpEvent tracking. | Infer from JumpEvent history. Ask player to confirm current system on first use. Store in session. |
| HP / hull damage state | Inspect Character and Assembly objects for `HP` or `hull_integrity` fields. Check combat Move modules for emitted event structs. | Remove real-time HP from dashboard. Show last combat outcome from kill events. Shell risk assessment uses Crown count only. |
| Combat event MoveEventType strings | `grep` world-contracts for `has copy, drop` in combat/kill/damage modules. Note full module path (e.g. `0x<PKG>::combat::KillEvent`). Attempt `suix_queryEvents`. | Player manually triggers debrief via chat ("I just fought X"). GHOST responds from knowledge base. |
| Feral AI entity detection | `GetObjectsByType` for NPC types via GraphQL. Check if objects include an unhashed system identifier or proximity field. | Descope proactive threat alerts. Player reports encounters via chat. GHOST responds reactively. |

---

## 4. Not Feasible — Required Redesigns

### Route Planner
No star map or system graph API exists.

**Redesign:**
1. Hardcode a ~30-system starter region graph (systems near the tutorial start) for MVP
2. Subscribe to JumpEvents across all connected GHOST users to crowd-source system adjacency data over time
3. Label the feature "Early Access — local region only" in the UI

### Tutorial Progression Detection
No `tutorialStage` field exists on-chain.

**Redesign — milestone detection engine:**

| Tutorial Stage | On-Chain Signal |
|---|---|
| Stage 1: First login | PlayerProfile created event |
| Stage 2: Refinery built | First inventory event containing `Refined Water Ice` |
| Stage 3: First combat | First combat kill event |
| Stage 4: Reflex crafting | Manufacturing complete event containing Reflex hull component |
| Stage 5: Reflex launched | Ship type change in Character object |
| Stage 6: Tutorial complete | Player exits starter system (JumpEvent from starter gate) |

### Commander Mode (Fleet Aggregation)
Passive aggregation of tribe member data is impossible — no "query all members of tribe X" endpoint.

**Redesign:**
- Require explicit opt-in: each tribe member connects their own wallet to GHOST
- Backend maintains a session store keyed by tribe affiliation (from `PlayerProfile`)
- When tribe leader views Commander Mode, GHOST aggregates state from currently-connected tribe members only
- MVP cap: 8 simultaneous connected players per tribe session

---

## 5. Component Implementation Detail

### Backend (TypeScript / Node.js)

```
/backend
  /src
    /collector     → StateCollector (Sui polling)
    /engine        → ContextEngine, HeuristicEngine
    /dispatcher    → AlertDispatcher (WebSocket)
    /llm           → LLMHandler, KnowledgeBase
    /api           → Express routes (/session/init, /session/end)
    /types         → PlayerContext, AlertCard interfaces
  index.ts
```

| Module | Dependencies | Notes |
|---|---|---|
| `StateCollector` | `@mysten/sui`, `node-fetch` | Polls `suix_queryEvents` every 1s. Fetches Character + Inventory + Fuel on connect and on event trigger. Caches in Redis (TTL: 5s live state, 60s static config). |
| `ContextEngine` | TypeScript (pure, no deps) | Stateless transformer. Input: raw Sui JSON. Output: `PlayerContext`. No external calls. |
| `HeuristicEngine` | TypeScript (pure, no deps) | Evaluates 6 rules after every ContextEngine update. Returns `AlertCard[]`. No LLM, no latency. |
| `AlertDispatcher` | `ws` | One persistent WebSocket per connected player. Pushes `AlertCard` on trigger. Stores last 20 alerts in Redis per player for reconnect replay. |
| `LLMHandler` | `@anthropic-ai/sdk` or `openai` | Builds prompt (see §12), streams response back via WebSocket. |
| `KnowledgeBase` | `better-sqlite3` (FTS5) | Chunked game knowledge. Returns top-5 BM25-scored chunks per query. Static file compiled at build time. |

**Heuristic rules:**

```typescript
const rules: Rule[] = [
  { id: "fuel_critical",       trigger: ctx => ctx.fuelPct < 20 },
  { id: "threat_proximity",    trigger: ctx => ctx.hostileEntityCount > 0 },
  { id: "shell_risk",          trigger: ctx => ctx.crownCount > 0 && ctx.lastCombatEventAt !== null },
  { id: "stranding_alert",     trigger: ctx => ctx.fuelUnitsRemaining < estimatedReturnCost(ctx) },
  { id: "manufacturing_safety",trigger: ctx => ctx.activeManufacturingJobs > 0 /* + dismantle event */ },
  { id: "tutorial_nudge",      trigger: ctx => ctx.tutorialStage < 6 && idleMinutes(ctx) > 5 },
];
```

### Frontend (Next.js PWA)

```
/frontend
  /app
    /page.tsx           → root: WalletConnector gate
    /dashboard/page.tsx → StatusDashboard
    /chat/page.tsx      → ChatView
    /alerts/page.tsx    → AlertFeed
    /route/page.tsx     → RoutePlanner
  /components
    FuelGauge.tsx
    ThreatRing.tsx
    AlertCard.tsx
    ChatBubble.tsx
  /hooks
    useWebSocket.ts
    usePlayerContext.ts
  /lib
    walletConnect.ts
    regionGraph.ts      → hardcoded 30-system starter graph
```

| Component | Dependencies | Notes |
|---|---|---|
| `WalletConnector` | `@evefrontier/dapp-kit`, `@mysten/sui/wallet-standard` | Detects EVE Vault extension. On success, sends wallet address to `POST /session/init`. |
| `StatusDashboard` | React, TailwindCSS | Subscribes to WebSocket for PlayerContext. Renders fuel gauge, Crown count + hours, system name, threat ring, assembly count. |
| `ChatView` | React, WebSocket | Three message types: `user` (right-aligned), `llm` (streaming GHOST response), `alert` (colored border card). Last 50 messages in local state. |
| `AlertFeed` | React, TailwindCSS | Chronological alert list. Filterable by: `ALL / THREAT / FUEL / TUTORIAL / ECONOMIC / SAFETY`. |
| `RoutePlanner` | React, hardcoded graph | Input: destination system name. Output: hop count, fuel cost, threat warnings. Labeled "local region only." |
| `ServiceWorker` | `next-pwa` | PWA install prompt, offline fallback, background alert processing. |

---

## 6. Data Flow: End-to-End

```
Player                Frontend              Backend               Sui Blockchain
  │                      │                     │                        │
  │── open GHOST dApp ──>│                     │                        │
  │── click Connect ────>│                     │                        │
  │                      │── POST /session/init ──>                     │
  │                      │                     │── GraphQL PlayerProfile ──>
  │                      │                     │<── character_id ──────────
  │                      │                     │── SuiClient getObject() ──>
  │                      │                     │<── Character + Inventory + Fuel ──
  │                      │                     │── suix_queryEvents (1s poll) ──>
  │                      │                     │<── events ────────────────────
  │                      │                     │
  │                      │                     │ ContextEngine → PlayerContext
  │                      │                     │ HeuristicEngine → AlertCard[]
  │                      │                     │
  │                      │<── WS: AlertCard ───│
  │<── alert rendered ───│                     │
  │                      │                     │
  │── types question ───>│                     │
  │                      │── WS: user message ─>                       │
  │                      │                     │ KnowledgeBase FTS → top-5 chunks
  │                      │                     │ LLMHandler builds prompt
  │                      │                     │── LLM API (streaming) ──>
  │                      │                     │<── token stream ────────
  │                      │<── WS: token stream ─│
  │<── streaming reply ──│                     │
  │                      │                     │
  │                      │                     │ (polling continues every 1s)
```

**Latency targets:**
- Sui block finality: ~400ms
- GHOST polling interval: 1s
- Heuristic alert generation: <100ms
- State change → alert delivered: **<3 seconds total**
- LLM response: **<8 seconds**

---

## 7. Deployment Architecture

| Service | Platform | Config |
|---|---|---|
| Frontend (Next.js PWA) | Vercel (free tier) | Set `NEXT_PUBLIC_BACKEND_WS_URL`. Auto-deploy from GitHub. Global CDN. |
| Backend (Node.js) | Railway or Fly.io | **Must be a persistent server** — not serverless. WebSocket connections are long-lived. Railway free: 500 hrs/month. Fly.io free: 3 shared VMs. |
| Redis | Railway Redis or Upstash | Upstash free tier: 10,000 req/day. Sufficient for <50 concurrent players during judging. |
| SQLite (knowledge base) | Bundled with backend | FTS5 keyword retrieval. Static file compiled at build time. No separate service needed. |
| LLM API | Anthropic (`claude-sonnet-4-20250514`) or OpenAI (`gpt-4o`) | Streaming. `max_tokens: 1000`. Rate limit: 1 req/3s per player session. Estimated cost: **$10–20 USD total** for judging period. |

---

## 8. Revised Risk Assessment

> Updated after live API research. Supersedes the risks section in the original PRD.

| Risk | Severity | Finding | Action |
|---|---|---|---|
| Location hashing | **HIGH** | CONFIRMED: `location.move` stores hashed coordinates by design. Cleartext system ID not readable. | Use JumpEvent chain to infer system. If insufficient, prompt player to name current system manually. |
| HP state not confirmed on-chain | **HIGH** | UNCONFIRMED: No HP primitive in docs. May be server-only. | Descope real-time HP from dashboard. Show Crown count as primary risk metric. |
| Combat event type strings unknown | MEDIUM | Events confirmed to exist but MoveEventType strings undocumented. | 30-min Day 1 task: grep world-contracts for `has copy, drop` in combat modules. |
| Star map / route data unavailable | MEDIUM | No API exists. Route planner as specced is unbuildable in 4 days. | Hardcode 30-system starter region. Label as regional preview. |
| gRPC not on public node | LOW | Public Sui full node may not expose gRPC port. | Use 1s polling as fallback. Meets latency targets for strategic gameplay. |
| EVE Vault extension required | LOW | Only supported wallet. Mobile wallet not available. | Demo on desktop Chrome with EVE Vault installed. Mobile wallet is post-hackathon. |

---

## 9. Hourly Task Breakdown

> 2-person team: **Dev A** = backend/blockchain, **Dev B** = frontend/UI.
> ⭐ = critical demo path. If behind, cut non-starred tasks first.

### Day 1 — March 27: Sui Ingestion + Context Engine

| Hour | Who | Task | Done When |
|---|---|---|---|
| 0–1 | Both | ⭐ Monorepo setup. Install all dependencies. | `npm install` succeeds for both `/backend` and `/frontend`. |
| 1–2 | Dev A | ⭐ Source `WORLD_PACKAGE_ID` + Sui endpoint. Configure SuiClient. Confirm connection. | `client.getLatestCheckpointSequenceNumber()` returns a number. |
| 2–3 | Dev A | ⭐ Implement GraphQL PlayerProfile query. Test with real Founder Access wallet. | Returns `character_id` from Utopia chain. |
| 3–4 | Dev A | ⭐ Derive Character object ID via TenantItemId. Fetch Character object. Log raw JSON. | Raw Character JSON visible including Shell type. |
| 4–5 | Dev A | ⭐ Fetch Inventory object. Parse cargo, ammo, fuel items. | `{ cargo: [], fuelItems: [], ammoCount: 0 }` logged. |
| 5–6 | Dev A | ⭐ Fetch `fuel.move` object. Verify field names against GitHub source. Compute `fuelPct`. | `fuelPct: number` logged. |
| 6–7 | Dev A | Validate `location.move`. Confirm if hashed or cleartext. Begin JumpEvent fallback. | Decision documented: "hashed" or "readable." |
| 7–8 | Dev A | ⭐ Implement `suix_queryEvents` JumpEvent polling at 1s. Log events. | JumpEvents appear in console when test account uses a gate. |
| 8–9 | Dev A | Grep world-contracts for combat event struct definitions. Attempt subscription. | Either combat events appear in console or "not available" documented. |
| 9–10 | Dev A | ⭐ Build ContextEngine. Raw Sui JSON → `PlayerContext` struct. | `PlayerContext` printed with correct `fuelPct`, `crownCount`, `tutorialStage`. |
| 10–11 | Dev A | ⭐ Build HeuristicEngine. Implement fuel critical + shell risk rules. Return `AlertCard[]`. | Fuel <20% triggers `AlertCard`. Logged to console. |
| 11–12 | Dev A | ⭐ Build Express HTTP + WebSocket server. `POST /session/init` starts polling. WS pushes alerts. | Postman POST starts polling. WS client receives `AlertCard`. |
| 0–4 | Dev B | Next.js scaffolding. TailwindCSS dark theme. Mobile-first layout. | Site renders at `localhost:3000` with dark background on mobile viewport. |
| 4–8 | Dev B | EVE Vault wallet connection UI. Connect button + detection. Show address post-connect. | Clicking Connect prompts EVE Vault extension. Address displayed on success. |
| 8–12 | Dev B | Status Dashboard shell. Fuel gauge, Crown count, threat ring, system name. Mock data. | Dashboard renders with mock PlayerContext on mobile. |

### Day 2 — March 28: Frontend + Chat + LLM

| Hour | Who | Task | Done When |
|---|---|---|---|
| 0–2 | Both | ⭐ Integration: frontend wallet → backend `/session/init` → real Utopia data in dashboard. | Real PlayerContext flowing from chain into dashboard. |
| 2–4 | Dev A | ⭐ Redis session store. Cache PlayerContext (TTL 5s). Last 20 alerts per player. Reconnect replay. | After reconnect, last 5 alerts re-appear in frontend. |
| 4–6 | Dev A | ⭐ LLMHandler. System prompt + PlayerContext injection. Streaming API call. Stream tokens over WS. | "What should I do?" returns streaming GHOST response in console. |
| 6–8 | Dev A | ⭐ KnowledgeBase. Seed with tutorial text, Cycle 5 notes, 10 recipes, turret comparison. FTS5 retrieval. | Query "how do I build the Reflex" returns 5 relevant chunks. |
| 8–10 | Dev A | Remaining 4 heuristic rules: stranding, shell risk, manufacturing safety, tutorial nudge. | All 6 rules fire correctly with mock data. |
| 10–12 | Dev A | Probe blockchain-gateway REST API. Document discovered endpoints. | SSU market data confirmed retrievable. Endpoint inventory documented. |
| 0–2 | Dev B | ⭐ ChatView component. Message history. Three message types (user, ghost, alert). | All three types render correctly on mobile. |
| 2–4 | Dev B | ⭐ Wire ChatView to WebSocket. Streaming response rendering. Typing indicator. | Typing a message produces streaming GHOST reply in chat UI. |
| 4–6 | Dev B | ⭐ AlertFeed. Category filter tabs. Tap to open detail in ChatView. | Alerts filterable. Tapping opens correct detail. |
| 6–8 | Dev B | Wire Status Dashboard to live WebSocket PlayerContext. Animate fuel gauge. Threat ring colors. | Dashboard responds to real Utopia data in <2s. |
| 8–12 | Dev B | Mobile polish pass. 375px viewport. Fix layout breaks. Min 44px tap targets. Loading skeleton. | App fully usable on 375px without horizontal scroll. |

### Day 3 — March 29: Intelligence Features + Integration Testing

| Hour | Who | Task | Done When |
|---|---|---|---|
| 0–3 | Dev A | ⭐ Tutorial Progression Tracker. Map events to 6 milestones. Set `tutorialStage` in PlayerContext. | New wallet receives Stage 1 guidance on connect. |
| 3–5 | Dev A | Expand knowledge base: Shell Industry, Feral AI patterns, Orbital Zones, turret table. | "How do I make a Rugged Shell?" returns accurate answer. |
| 5–7 | Dev A | SSU market intel. Query gateway for top-5 SSUs near starter system. Cache fuel prices. | "Nearest SSU with fuel" shows a real location name in alert text. |
| 7–9 | Dev A | ⭐ Full integration test end-to-end on Utopia with team accounts. Fix all errors. | End-to-end loop completes without errors on live data. |
| 9–12 | Dev A | Error handling. Sui node timeout, WS disconnect, LLM rate limit, missing fields. | Backend survives 30s timeout. Frontend shows "Reconnecting..." not blank. |
| 0–2 | Dev B | ⭐ Route Planner MVP. Input: destination. Hardcoded 30-system graph. Output: hops + fuel cost. | Known system name returns route with fuel estimate. |
| 2–4 | Dev B | GHOST onboarding flow. First-open greeting. Post-connect tutorial nudge for new players. | New user sees GHOST greeting before dashboard. |
| 4–6 | Dev B | PWA setup. `next-pwa` config. `manifest.json` with name, colors, icons. Install prompt. | App installable as PWA on Android Chrome. Appears on home screen. |
| 6–8 | Dev B | Lighthouse audit (throttled 4G mobile). Target: Performance >80, FCP <2s. | Lighthouse mobile score >80. FCP <2s on throttled connection. |
| 8–12 | Dev B | Full UI/UX review. Typography, spacing, contrast (WCAG AA). Error + empty states. | UI passes visual review at 375px, 768px, 1280px. |

### Day 4 — March 30–31: Production + Demo + Submission

| Hour | Who | Task | Done When |
|---|---|---|---|
| 0–2 | Both | ⭐ Deploy to production. Vercel (frontend) + Railway (backend + Redis). Set all env vars. | Live public URL connects to Utopia. Dashboard shows real data. |
| 2–5 | Both | ⭐ Live gameplay test on Utopia. Generate real scenarios: fuel alert, combat risk, tutorial guidance. | At least 3 genuine GHOST alerts fire. Screenshot/record all. |
| 5–8 | Dev A | ⭐ Record demo video (6 min max). Script: problem (60s) → solution (30s) → live demo (3m) → architecture (45s) → future (45s). | Demo video exported as MP4 with captions. |
| 5–8 | Dev B | ⭐ Write Devpost submission. All required fields filled. Demo video uploaded. | Devpost draft complete. |
| 8–10 | Both | Final bug sweep on production. Test all error paths. | No unhandled crashes on production URL. |
| 10–11 | Both | Screenshots for Devpost. Dashboard, alerts, chat, route planner, alert feed. Write captions. | 5+ screenshots uploaded with captions. |
| 11–12 | Both | ⭐ Submit on Devpost before March 31 deadline. Verify: live URL, video, architecture diagram, all team members listed. | Devpost shows "Submitted." Confirmation email received. |

---

## 10. PlayerContext TypeScript Interface

> Canonical data structure produced by ContextEngine. All other systems read from this.

```typescript
interface PlayerContext {
  // Identity
  walletAddress: string;                    // Sui wallet address — primary key for all queries
  characterId: string;                      // In-game character ID — used to derive all object IDs

  // Shell / Skills
  shellType: 'Rugged' | 'Reaping' | 'Aggressive' | null;  // Null if no Shell equipped
  crownCount: number;                       // Number of Crowns (skills) on current Shell
  crownEstimatedHours: number;              // crownCount * avgHoursPerCrown (derived)

  // Fuel
  fuelPct: number;                          // 0–100. Primary input to fuel heuristic rule
  fuelUnitsRemaining: number;               // Absolute fuel units
  fuelMaxCapacity: number;                  // Used to compute fuelPct

  // Inventory
  cargoItems: { typeId: string; quantity: number }[];
  ammoCount: number;                        // Derived from cargoItems

  // Location (⚠️ may be null if location is hashed)
  currentSystemId: string | null;           // Inferred from JumpEvent history
  currentSystemName: string | null;         // Resolved from KnowledgeBase

  // Threat
  threatLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  hostileEntityCount: number;               // Detected in current system (last 15 min)

  // Progression
  tutorialStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=pre-tutorial … 6=complete

  // Assemblies
  activeAssemblies: { id: string; type: string; status: 'Online' | 'Offline' | 'Anchored' }[];
  activeManufacturingJobs: number;

  // Combat
  lastCombatEventAt: Date | null;

  // Market Intel
  nearestFuelSSU: {
    id: string;
    systemName: string;
    fuelAvailable: number;
  } | null;

  // Meta
  lastUpdatedAt: Date;
}
```

### AlertCard Interface

```typescript
interface AlertCard {
  id: string;
  ruleId: 'fuel_critical' | 'threat_proximity' | 'shell_risk' | 'stranding_alert' | 'manufacturing_safety' | 'tutorial_nudge';
  category: 'THREAT' | 'FUEL' | 'TUTORIAL' | 'ECONOMIC' | 'SAFETY';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  dismissed: boolean;
}
```

---

## 11. Environment Variables

> Never commit to repo. Use `.env.local` for local dev, platform dashboard for production.

| Variable | Service | Value / Description |
|---|---|---|
| `SUI_FULL_NODE_URL` | Backend | Sui full node endpoint for Utopia. Source from Utopia Blockchain Addresses page. |
| `SUI_GRAPHQL_URL` | Backend | GraphQL endpoint for Sui Utopia network. |
| `WORLD_PACKAGE_ID` | Backend | EVE Frontier world contract package ID on Utopia. Required for all type filter strings. |
| `TENANT` | Backend | `"utopia"` for test server. `"stillness"` for production. |
| `BLOCKCHAIN_GATEWAY_URL` | Backend | `https://blockchain-gateway-utopia.live.tech.evefrontier.com` |
| `REDIS_URL` | Backend | Redis connection string from Railway or Upstash dashboard. |
| `ANTHROPIC_API_KEY` | Backend | Anthropic API key. Never expose to frontend. |
| `OPENAI_API_KEY` | Backend | OpenAI API key (fallback). Never expose to frontend. |
| `LLM_PROVIDER` | Backend | `"anthropic"` or `"openai"` |
| `LLM_MAX_TOKENS` | Backend | `1000` (default). Keep low to control cost and latency. |
| `SESSION_POLL_INTERVAL_MS` | Backend | `1000` (default). `suix_queryEvents` poll interval per active session. |
| `NEXT_PUBLIC_BACKEND_WS_URL` | Frontend | WebSocket URL of backend, e.g. `wss://ghost-backend.railway.app` |
| `NEXT_PUBLIC_BACKEND_HTTP_URL` | Frontend | HTTP URL of backend for `POST /session/init` |

---

## 12. LLM Prompt Schema

> Every LLM call uses this exact structure. Do not deviate — consistency is required for GHOST personality stability.

```typescript
const messages = [
  {
    role: "system",
    content: `
You are GHOST — a survival officer AI companion for EVE Frontier.
Your job is to keep the player alive and informed.

Tone rules:
- Never condescending. Never sugarcoat the odds.
- Confident and direct. Wry when appropriate.
- Adapt to player stage: encouraging for new players, analytical for veterans.
- Post-death: matter-of-fact. Not harsh, not soft.

Output format rules:
- Respond in 1–3 short paragraphs. Plain language.
- No markdown headers or bullet lists in responses.
- Lead with the most important thing first.

Hard constraints:
- Never invent crafting recipes or game stats not found in the knowledge base.
- If you are unsure, say so. Do not guess on game mechanics.
- Never recommend actions that would cost the player real money.
    `
  },
  {
    role: "user",
    content: `
[PLAYER STATE]
${JSON.stringify(playerContext, null, 2)}

[KNOWLEDGE CONTEXT]
${knowledgeChunks.map((c, i) => `[SOURCE ${i+1}: ${c.source}]\n${c.text}`).join("\n\n")}

[CONVERSATION HISTORY]
${conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join("\n")}

[PLAYER MESSAGE]
${userMessage}
    `
  }
];

// API call config
const config = {
  model: "claude-sonnet-4-20250514",  // or "gpt-4o"
  max_tokens: 1000,
  temperature: 0.4,    // factual, consistent
  stream: true,
};
```

---

## 13. Knowledge Base Curation Plan

> Day 3 (March 29) is allocated for curation. Compile all sources into SQLite FTS5.

### Chunking Strategy
- Chunk size: 200–400 words per chunk
- Each chunk tagged with: `source`, `category`, `keywords[]`
- FTS5 indexes chunk text + keyword list
- Retrieval: top-5 chunks by BM25 score against user query

### Sources

| Source | Priority | What to Extract |
|---|---|---|
| EVE Frontier Tutorial (`support.evefrontier.com`) | **P0** | Full text of official tutorial. Covers: first steps, mining, refining, manufacturing, ship fitting, fuel management. Extract all steps verbatim. |
| UI Breakdown article (`support.evefrontier.com`) | **P0** | Full text. HUD elements: fuel tank, capacitor, heat bar, ship fittings, radial menu. Essential for tutorial guidance. |
| Cycle 5 patch notes (official) | **P0** | Shell Industry, Orbital Zones, Passive Observation System, new fuel properties, turret types, Construction Sites. |
| Common new player mistakes (community Reddit/Discord) | **P0** | Top 10 mistakes: out of fuel, dismantling printer with active jobs, no hull repairer, fighting without ammo, etc. |
| Crafting recipes (community-sourced) | **P0** | Reflex ship bill of materials. Shell manufacturing requirements. Key structure build requirements. |
| EVE Frontier World Explainer (`docs.evefrontier.com`) | P1 | Three-layer architecture, Smart Assembly types, Layer 1 primitives. |
| Ship stats (community-sourced) | P1 | Hull HP, cargo capacity, fuel tank size, optimal engagement range per ship class. |
| Turret comparison table | P1 | Autocannon vs Plasma vs Railgun: range, DPS, best targets, fuel consumption. |
| Shell Industry guide | P1 | Nursery setup, Crown types, Shell type selection (Rugged/Reaping/Aggressive), Nest usage. |
| Feral AI patrol patterns (community) | P2 | Any documented patrol routes or behavior patterns. Label as "community-reported, unverified." |

### Categories for FTS tagging
`tutorial` · `mechanics` · `crafting` · `combat` · `economy` · `navigation` · `shell-industry` · `structures`
