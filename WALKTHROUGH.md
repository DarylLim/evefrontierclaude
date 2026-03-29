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

## What is NOT yet done (Day 1 TODOs)

The following are marked `// TODO Day 1` in the code and must be completed before any feature works end-to-end:

1. **Source `WORLD_PACKAGE_ID` and Sui endpoints** from the [Utopia Blockchain Addresses page](https://docs.evefrontier.com/Tools/BlockchainAddresses). Fill into `backend/.env.local`.
2. **Verify `fuel.move` field names** (`current_fuel`, `max_fuel`) against Utopia live data. Implement fuel object fetch in `StateCollector`.
3. **Implement Character + Inventory object fetches** using `TenantItemId` derivation from `object_registry.move`.
4. **Validate `location.move`** — confirm whether system ID is hashed or cleartext. Begin JumpEvent fallback if hashed.
5. **Discover combat event MoveEventType strings** by grepping `world-contracts` repo for `has copy, drop` in combat modules.
