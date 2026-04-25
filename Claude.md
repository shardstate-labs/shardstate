# SHARDSTATE - Project Handoff

Last updated: 2026-04-25

## Stack

- PWA + Web platform on Vercel.
- Supabase project `ivtnqwqmhdotsralghjt` in `sa-east-1`.
- Single repo: `https://github.com/shardstate-labs/shardstate`, branch `main`.
- Current asset cache version: `v=22`.

## Live URLs

- `https://shardstate.vercel.app/` - landing page.
- `https://shardstate.vercel.app/gamehub/` - collection, market, packs, profile, Battle Pass.
- `https://shardstate.vercel.app/game/` - combat PWA.
- `https://shardstate.vercel.app/admin/` - card editor, gated to `faxie.contact@gmail.com`.

## Core Concept

- Humanity is extracted as a resource to produce PULSOS.
- 12 main clans + 1 special clan: TITANS.
- Each main clan has 12 cards.
- TITANS has 10 cards.
- PROTOCOL controls the system from the shadows.

## Current Battle Modes

- `Entrenamiento`: player deck from Gamehub vs AI random deck. Very low SHARDS, account XP, and card XP. No ELO.
- `Casual`: live PvP, no ELO. Normal-low SHARDS, account XP, and card XP.
- `Ranked`: live PvP off-chain. Adds ELO for weekly off-chain leaderboard. Normal SHARDS, account XP, and card XP.

Future modes are intentionally not enabled yet:
- Torneo (off-chain)
- Gran Torneo (on-chain)
- Rango Fractal (on-chain)

## Done

### Plan A - Engine + Ability System

- `engine/ability_catalog.js`: normalized ability catalog, locked constants, clan bonus map.
- `engine/round_engine.js`: deterministic 9-phase round resolution.
- `game/engine.js`: bridges legacy combat UI to `SHS_ENGINE.runRound()`.
- Deterministic `assignAbilities()` by card id hash.
- TITANS-only ability pool gated by `clan === 'titans'`.
- Locked combat constants: `HP_MAX = 12`, `PULSO_MAX = 12`, `ROUNDS = 4`, `COLLAPSE_BONUS_DMG = 2`.
- Edge cases documented in code: ties, cancel flow, copy snapshot, poison stacks, cancelled onWin/onLose.

### Plan B - Admin + Custom Cards + Clan Migration

- Admin editor supports clan-filtered ability dropdown.
- Clan bonus is auto-derived and read-only.
- Card types: `normal`, `grand`, `eco`.
- TITANS migrated from legacy ECHO.
- `public.custom_cards` is synced into Gamehub and Game on boot.
- Custom cards are not auto-gifted; they enter inventories through packs/market only.
- Admin link is visible only for `faxie.contact@gmail.com`.

### Plan C / Phase 3D - PvP

- PvP modes are wired from Gamehub into the combat PWA.
- Supabase RPCs in use: `find_or_join_match`, `leave_queue`, `finalize_pvp_match`.
- Tables in use: `match_queue`, `matches`.
- Realtime broadcast channel handles moves.
- PvP has deterministic shared hands from match seed.
- Matchmaking has:
  - Realtime insert listener.
  - `SUBSCRIBED` guard before queue RPC.
  - Polling fallback through `myActiveMatch()` if Realtime misses the insert.
  - Timer, connected-player presence count, long-wait messaging, and auto-close at 3:10.
- Opponent HUD shows username, level, and ELO.
- Opponent cards show ability and clan bonus, support hover, and open card-detail modal on click.
- PvP end screen parses server rewards from `finalize_pvp_match`.
- Surrender uses an in-game modal with 10s timeout, not browser `confirm()`.

### UX / Polish

- Game supports Spanish and English toggle in combat.
- Battle labels are localized: round/ronda, pulse/pulsos, clash/combate, waiting states, rewards, end screen.
- PvP timer stays active after local card lock and warns in red for the final 10 seconds.
- HP/PULSOS labels have dedicated space to avoid overlap.
- Landing page has SEO + OG metadata.
- Empty DB collection fallback exists: if Supabase collection is empty, Gamehub can force a full local collection resync instead of leaving a brand-new account empty.

### Phase 4 - Payments Scaffold

- Supabase CLI structure exists under `supabase/`.
- Migration scaffold: `supabase/migrations/20260425000001_payments.sql`.
- Tables: `purchases`, `entitlements`.
- RPCs: `grant_flux`, `grant_bp_premium`.
- Edge Function scaffold: `supabase/functions/polar-webhook/index.ts`.
- Frontend helper: `js/payments.js`.
- Provider currently scaffolded as Polar.sh Merchant of Record, not Stripe.
- Product buy links and `POLAR_WEBHOOK_SECRET` still need real production configuration before enabling checkout UX fully.

## Pending Priorities

1. Validate PvP live with two accounts after the matchmaking fallback deploy.
2. Finish payment product configuration:
   - Create Polar products.
   - Add buy links to config or `js/payments.js`.
   - Set `POLAR_WEBHOOK_SECRET`.
   - Apply payment migration.
   - Deploy `polar-webhook`.
   - Wire visible FLUX/Battle Pass purchase buttons.
3. Apple OAuth + custom domain:
   - Enable Apple provider in Supabase Auth.
   - Configure final domain in Vercel.
4. Add weekly leaderboard surface for ranked off-chain ELO.

## Low-Priority Cleanup

- Sweep legacy free-text ability labels in old card instances and rebuild through `assignAbilities()`.
- Add a code comment explaining why `applyCustomCardsToCollection()` must not auto-gift custom cards.
- Add automated smoke tests for Gamehub boot, deck handoff, PvP matchmaking, and finalization.

## Critical Rules

- Do not rebalance card stats unless explicitly requested.
- Do not rename cards or clans unless explicitly requested.
- Do not rewrite core round math unless explicitly requested.
- Server state in Supabase is authoritative where available.
- Bump cache globally on every deploy.
- Prefer small, targeted edits over broad rewrites.
- Validate before reporting done.
