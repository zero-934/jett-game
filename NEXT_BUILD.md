# Next Build — Inferno & Surge

## Games
Two separate 3x3 slot games, both sharing the Crown Flip mechanic.

---

## Game 1: Inferno 🔥
- 3x3 grid, 5 paylines
- **Cascade mechanic**: winning symbols explode, new ones fall from above
- Each cascade charges a **Heat Meter** (5 stages, glowing bar at top of screen)
- Max heat → **Inferno Spin**: all symbols go wild for one mega spin, meter resets
- After any win → **Crown Flip** triggers
- Aesthetic: dark red/charcoal, ember golds, fire particle effects on cascades

## Game 2: Surge ⚡
- 3x3 grid, 5 paylines
- Every winning spin charges a **Surge Meter** (5 stages, electric progress bar)
- Max surge → **3 free Surge Spins**: one random reel fully wild each time
- After any win → **Crown Flip** triggers
- Aesthetic: electric blue/gold, lightning crackle on meter fill

---

## Shared Mechanic: Crown Flip 👑
- Appears after any base win
- Full-screen modal moment — dramatic coin, large payout number displayed
- Tap to flip: 2× win or bust
- Can chain: keep flipping until player walks or busts
- Must feel high-stakes and cinematic

---

## UI Rules
- **Full screen utilization** — grid takes center stage, no dead space
- **Payout table**: sleek floating cards on side OR swipe-up panel (not static table)
- **Win display**: animated pop-up chips/badges directly on winning cells
- **Heat/Surge meter**: glowing progress bar built into top of screen
- **Crown Flip**: full-screen modal, not inline
- Reference aesthetic: Sweet Bonanza / Gates of Olympus energy — but darker, sharper, Midnight Luxury
- Check stock slot machine UI references for layout inspiration, then exceed them

---

## Tech
- 3-file rule: Logic / UI / Scene per game
- Uses SlotEngineLogic + ProvablyFairRNG (new shared engine)
- RTP 96%, Solana-ready
- Branch: `feat/inferno` and `feat/surge` (one PR each)
- Two-agent workflow: AgentX spec → Gemini code → AgentX review → PR

---

## Status
- [ ] Inferno spec written
- [ ] Inferno Gemini build
- [ ] Inferno tests pass + PR
- [ ] Surge spec written
- [ ] Surge Gemini build
- [ ] Surge tests pass + PR

---

## Pre-Pitch Roadmap (updated 2026-04-18)

### Week 1-2: Polish Sprint
- [ ] Visual polish — all games (consistent UI, better symbols, spacing)
- [ ] Technical polish — audio working on all games, no layout bugs
- [ ] Homepage rebuild — brand header, game grid, locked placeholder cards
- [ ] Analytics: PostHog (behavior) + Supabase (game data) wired in

### Week 2-3: Audio + Beta
- [ ] Buy casino audio pack (AudioJungle/Zapsplat, ~$50-80)
- [ ] Wire real audio into CasinoAudioManager
- [ ] Beta program setup — invite link, onboarding screen
- [ ] Jet Coins promise system — loyalty currency for early testers
- [ ] Supabase spin logging (bet, win, game, session)

### Week 3-4: Investor Prep
- [ ] Pitch deck (Claude drafts, C Lee reviews)
- [ ] Beta metrics dashboard
- [ ] Demo video walkthrough
- [ ] Legal placeholder (terms, responsible gambling notice)

### Then: Pitch

---

## Analytics Plan
- **PostHog** (free tier) — behavior: game started, spin placed, cashout, session time
- **Supabase** (free tier) — game data: every spin logged with bet/win/RTP/game type
- Both wired in one session after visual polish complete

## Missing Before Pitch
- [ ] Wallet connect (Solana) — can be mocked for demo
- [ ] Jet Coins concept explained on homepage
- [ ] Responsible gambling notice (legal requirement for any pitch)
- [ ] Privacy policy page
- [ ] Demo mode (play without betting) for investor demos
