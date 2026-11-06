# polish-004 — Casino integration readiness (demo seam only)

**Status:** a typed *presentation* host interface, a local demo adapter, two **fictional** brands and a local fake-host page now exist. **No operator, aggregator or RGS integration exists.** These games are **not** certified, approved or "casino-ready". All credits are demo credits with no cash value.

Evidence labels: **[Observed]** · **[Docs]** · **[Inference]** · **[Unverified]**. Access date for all sources: 2026-11-06.

## 1. Three different layers

| Layer | What it owns | In this repo today |
|---|---|---|
| **1. Browser game presentation** | Rendering, input, accessibility, branding tokens, launch-parameter parsing, lifecycle (ready/pause/resume), settings and lobby callbacks, *displaying* results | **Yes**: the pilots plus `src/shared/host/*` and `src/shared/brand/*` |
| **2. Provider backend / RGS** (remote game server) | Server-authoritative outcomes and RNG, round state, bet and settlement transactions with idempotency keys, rollback and reconciliation, replay and history, reporting, jurisdictional math certification, operational support | **No.** Outcomes are computed client-side in pure TS Logic for the demo. A real-money version must move outcome generation and settlement server-side. |
| **3. Operator / aggregator adapter** | The partner-specific launch API, session tokens, wallet callbacks (balance, bet, win, rollback), request signing, currency and minor-unit rules, certification and test plans, commercial and regulatory onboarding | **No.** Partner-specific; needs contracts and documentation access. |

[Inference] Branding is not API compatibility, and an iframe alone is not an integration. Layer 1 can be made portable. Layers 2–3 are server work, specific to each partner.

## 2. Public sources consulted

| Source | What it is | What it is *not* | Access |
|---|---|---|---|
| SOFTSWISS game-provider overview — https://www.softswiss.com/game-providers/ | Aggregator distribution context | Not a public provider SDK specification | Not fetched (network policy); cited from the brief **[Unverified this session]** |
| EveryMatrix SlotMatrix/RGS announcement (2023) — https://everymatrix.com/news/everymatrix-onboards-spinberry-to-slotmatrix-rgs/ | An example of a studio-to-RGS route | Not API documentation; no promise of access | Not fetched **[Unverified this session]** |
| Hub88 Wallet API, operator side — https://docs.hub88.io/developer-docs/operator-api-reference/wallet-api | **Operator-facing** endpoints, signed requests, idempotency examples (per the brief) | Not the contract our browser implements | Direct fetch blocked (DNS not allowlisted) **[Unverified this session]** |
| Hub88 Wallet API, supplier side — https://docs.hub88.io/developer-docs/supplier-api-reference/wallet-api | Surfaced by web search. The snippets say a rollback references the original `transaction_uuid`, and that suppliers must not call `/user/balance`, `/transaction/bet`, `/transaction/win` or `/transaction/rollback` before returning a successful `/game/url` (otherwise `RS_ERROR_INVALID_TOKEN`) | A full read; I saw only search-result excerpts | Search snippet only **[Docs, excerpt-level]** |
| ST8 Operator API — https://docs.st8api.com/ | **Operator-facing** launch/session/wallet context, including iframe or new-tab launch (per the brief) | No proof of integration with ST8 | Direct fetch blocked **[Unverified this session]** |
| Secondary: dev.to "casino API integration explained", partnerkin Hub88 review, BlueOcean GameProvider wiki | General patterns (seamless wallet, UUID idempotency, rollback retries) | Authoritative specs; one figure (e.g. "500 retries") is unverified | Search snippets **[Unverified]** |

Nothing here implies vendor approval, onboarding, commercial terms or compatibility. No vendor was contacted and no live API was called.

## 3. Capability matrix

| Documented pattern | Layer | Demo supports now | Needs future backend/adapter | Unknown |
|---|---|---|---|---|
| Launch by URL with game id, locale, currency, session | 1 / 3 | `parseLaunch`: scene-key routing, `brand`, `locale` (BCP-47 shape), opaque `session`, `hostOrigin`, `lobby`; invalid values dropped and reported | Partner parameter names, signed launch URLs or tokens, server session validation | Each partner's exact parameters |
| iframe or new-tab launch | 1 / 3 | Standalone and iframe (exact-origin handshake) | Partner CSP/frame-ancestors, cookie policy | Partner sandbox flags |
| Lobby return | 1 | `requestLobby()`: notifies `lobbyRequested`; standalone navigates to a validated lobby URL; embedded leaves navigation to the host | Partner callback conventions | — |
| Lifecycle ready/pause/resume, visibility | 1 | `ready`, `paused` (host / settings / blur / hidden), `settingsOpened/Closed`. Host `pause` pauses. Host `resume` does **not** auto-resume a live round (the player must tap) | Partner reality-check / session-timeout hooks | Partner semantics for resume |
| Round notifications | 1 | `roundStarted`, `roundSettled` derived from the existing DemoLedger (one each per real state change) | Server round IDs, history endpoints | — |
| Balance / bet / win / rollback | 2 / 3 | **None.** Demo ledger only, client-side, no cash value | Server wallet calls with idempotency keys, rollback, reconciliation, signed requests | Per partner |
| Currency and minor units | 2 / 3 | `DEMO`, exponent 2 (display only) | ISO-4217 / crypto exponents from the server, never assumed 2 | — |
| Replay / history | 2 | Local deterministic replay of Logic (fixed-step action logs); `resultRef = demo-ledger:<roundId>` | Server-side immutable round records | — |
| Branding | 1 | Validated `BrandConfig` (brandable keys only), two fictional examples, live switching | Partner asset delivery and approval | Partner brand guidelines |
| Localisation | 1 | Locale accepted; **English strings only** | String tables, number/currency formatting per locale, RTL review | — |
| Certification (RNG, math, jurisdiction) | 2 | None. The 96 % RTP is a design target. Shatter's maximum return is 72.75 %; Jett and Flap are skill-dependent | Lab certification of server RNG and math | — |

## 4. Host contract

File: `src/shared/host/GameHostAdapter.ts`, types only.
- **Launch context:** `protocolVersion 1`, `gameId` (`jett | flap-fortune | shatter-step`), `sceneKey`, `gameVersion` (build label), `mathVersion` (Logic sim version), `configId`, `mode: 'demo'`, `sessionRef` (opaque, never logged), `locale`, `currency {DEMO, 2}`, `brandId`, `embedded`, `hostOrigin`, `lobbyUrl`.
- **Game → host:** `loading | ready | error | paused | resumed | settingsOpened | settingsClosed | lobbyRequested | roundStarted | roundSettled`.
- **Host → game:** `pause | resume | openSettings | closeSettings | setBrand`. None of these can move money, choose outcomes or read hidden state.
- **Envelope:** `{ channel: 'jett.host', v: 1, seq, msg }`.

## 5. Security behaviour of the demo adapter (`DemoHostAdapter`, `HostProtocol`)

- **Embedding:** the page is embedded only when `window.parent !== window` **and** `hostOrigin` exactly matches the allowlist. The default allowlist is same-origin only, and wildcards are impossible: `*` and `"null"` are rejected by `normaliseOrigin`.
- **Outbound:** `parent.postMessage(envelope, hostOrigin)` uses the exact origin. [Observed: `host` test, every outbound target equals the dev origin.]
- **Inbound** (`InboundGate`) requires all of the following:
  - exact origin;
  - `event.source === window.parent`;
  - exact envelope keys;
  - channel and version match;
  - known command with exact keys;
  - `brandId` pattern;
  - ≤ 1024 chars;
  - **strictly increasing seq**, so duplicates and out-of-order messages are dropped.

  Rejections are counted by reason only; contents are never logged.
- **Redaction:** every outbound payload passes `isSafeOutbound` (no `seed`, `board`, `rngState`, `revealed`, `token`… at any depth). Unrevealed Shatter boards and future RNG state never leave the game. [Observed: `host` test]
- **URLs:** lobby and logo URLs come only from same-origin paths or allowlisted https origins. `javascript:`, `data:`, `blob:`, protocol-relative and credential URLs are rejected. No HTML injection: all text goes through `textContent`.
- **Money:** the adapter reads the **existing** page ledger through a read-only observer. There is no second balance. Ledger events fire only on real state changes, so repeated settles cannot re-credit or re-notify. A throwing observer cannot break settlement. [Observed: unit tests]

## 6. Using the fake host

```bash
npx vite --port 5199 --strictPort
open http://localhost:5199/jett-game/research/host/index.html
```

- Choose a game, a brand (Default / Harbor Lights / Orchid Club, the last two fictional) and an entry (dev harness or release `index.html`).
- Send commands (Pause, Resume, Open/Close settings, Brand) and the negative tests (duplicate seq, malformed, oversized, unknown `settle` command).
- The log shows messages received from the game.
- Inside the frame, `__host.getTrace()` lists message types (no payloads) and `__host.getRejections()` shows the counters.

Brands can also be selected without a host by adding `?brand=example-harbor-lights` to a launch URL.

## 7. Tests

**Unit** (`src/tests/HostProtocol.test.ts`, `Brand.test.ts`, 24 tests):
- exact origins, hostile launch parameters, lobby URL rules;
- command schemas (accepted and rejected);
- gate checks for origin, source and sequence;
- redaction;
- ledger notification idempotency and exception isolation;
- brand contrast, locked keys and logo URL rules.

**Browser** (`tests/browser/polish004.browser.cjs`, sections `host` and `theming`):
- a valid command is applied;
- duplicate and malformed messages are rejected;
- one round produces `roundStarted` and exactly one `roundSettled`;
- outbound messages use an exact origin with no sensitive keys;
- brand switches and a settings open/close mid-round leave the simulation state identical at the same tick.

## 8. What a real integration still needs (not implemented)

1. **Server-authoritative round service (RGS):** outcome generation, certified RNG, bet and settle transactions with idempotency keys, rollback, reconciliation, history and audit.
2. **Per-partner adapter:** launch and token exchange, wallet callbacks, request signing, error-code mapping, currency exponents, responsible-gaming hooks (reality checks, session limits), test plans and certification runs.
3. **Client changes:** the browser displays server results instead of computing them. The Logic modules become shared math for the server and for client prediction only.
4. **Localisation:** string tables, locale-aware number and currency formatting.
5. **Operations:** monitoring, versioned releases per jurisdiction, incident response.
6. **Legal and compliance review** per market, and rights review of the artwork (`docs/polish-003/RESEARCH_AND_ASSETS.md`).
