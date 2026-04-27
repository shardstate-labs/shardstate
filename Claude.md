# SHARDSTATE - Project Handoff

Last updated: 2026-04-27

## Stack

- PWA + Web platform on Vercel.
- Supabase project `ivtnqwqmhdotsralghjt` in `sa-east-1`.
- Single repo: `https://github.com/shardstate-labs/shardstate`, branch `main`.
- Current asset cache version: `v=40`.

## Live URLs

- `https://shardstate.vercel.app/` - landing page.
- `https://shardstate.vercel.app/gamehub/` - collection, market, packs, profile, Battle Pass.
- `https://shardstate.vercel.app/game/` - combat PWA.
- `https://shardstate.vercel.app/admin/` - card editor, gated to `faxie.contact@gmail.com` and `shardstate.game@gmail.com`.

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
- Current attack formula: `ATQ = final PWR * pulsos spent + ATK modifiers`; DMG no longer inflates ATQ and resolves only after the winner is known.

### Plan B - Admin + Custom Cards + Clan Migration

- Admin editor supports clan-filtered ability dropdown.
- Admin has a `Control users` tab for `faxie.contact@gmail.com`-only RPCs:
  - Search users by email or username.
  - Reset game values to zero and reopen welcome pack eligibility.
  - Pause/block/reactivate game access.
  - Delete game records and mark the account as deleted for game access.
  - Grant SHARDS/FLUX with user-facing notification.
  - Every action writes to `admin_audit_log`.
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

### Battle Pass Economy

- Free track: small SHARDS rewards every 3 levels.
- Premium price: `20 FLUX` (`1 FLUX = 1 USD`).
- Premium rewards:
  - `1 FLUX` every 5 levels.
  - Random common/uncommon non-TITANS, non-GRAND card every 9 levels.
  - Random GRAND card at level 30.
- Premium purchase is server-authoritative through `buy_battle_pass_with_flux()`.
- Battle Pass claims are server-authoritative through `claim_battle_pass()`.
- Premium filler levels now grant SHARDS (`100`, `200`, or `250`) instead of empty claim slots.

### Card Instances + Card XP

- `public.card_instances` exists as the per-copy ownership table (`id`, `card_id`, `level`, `xp`, `locked`, timestamps).
- `cards_owned` remains the aggregate compatibility table; trigger `trg_sync_card_instances_from_owned` keeps instances aligned with aggregate qty.
- Existing ownership was backfilled into `card_instances`.
- `load_my_card_instances()` returns per-copy data to Gamehub.
- `finalize_battle()` awards persistent card XP to played player cards through `award_card_xp()`.
- Card XP curve: LV1 `180`, LV2 `420`, LV3 `800`, LV4 `1400`; max database level is 5, UI clamps to each card's star cap.
- Collection views render duplicate copies as individual cards and use instance level/XP where available.

### UX / Polish

- Game supports Spanish and English toggle in combat.
- Battle labels are localized: round/ronda, pulse/pulsos, clash/combate, waiting states, rewards, end screen.
- PvP timer stays active after local card lock and warns in red for the final 10 seconds.
- HP/PULSOS labels have dedicated space to avoid overlap.
- Landing page has SEO + OG metadata.
- Empty DB collection fallback exists: if Supabase collection is empty, Gamehub can force a full local collection resync instead of leaving a brand-new account empty.
- Collection sync has a delete safety rail and DB trigger guard to prevent reload/stale-state bugs from wiping owned cards.
- Active deck persistence preserves local decks during pending Supabase sync and no longer deletes the server deck unless the player intentionally empties the deck.
- Collection duplicate filter is localized as `Duplicadas` / `Duplicates` and filters cards with quantity greater than 1.
- Pack openings never return two copies of the same card in a single pack.
- Pack reveal labels show `¡NUEVA!` for first-time cards and `Ahora tenés X` for duplicates.
- Admin emails: `faxie.contact@gmail.com`, `shardstate.game@gmail.com`.
- Usernames are normalized to lowercase `[a-z0-9_]` and enforced unique case-insensitively in Supabase.
- Referral ledger scaffold exists: a sponsor can receive `+1 FLUX` once when a referred account buys any FLUX bundle.
- Server-authoritative friends/guilds/DM scaffold exists:
  - Players can search profiles, send/respond friend requests, open public profile cards, and DM friends.
  - Guilds cost `2 FLUX` to create through Supabase RPC, support search/applications, and leaders can accept/reject with a response message.
  - Friend DMs support emoji shortcuts and GIF/GIPHY URLs.
- Collection duplicates filter now renders each duplicate copy as an individual card and does not overlay quantity badges on card art.
- GRAND cards are represented as `GD` rarity with a special aura/glow instead of a large `GRAND` label.
- Market listing UX has a visual sell-card picker and preview in addition to the fallback select.
- Security hardening:
  - Admin email allowlist includes `faxie.contact@gmail.com` and `shardstate.game@gmail.com` in both UI and Supabase `is_shardstate_admin()`.
  - Admin Card Editor now blocks non-admin clients before rendering tools.
  - Supabase-authenticated sessions are required when Supabase is available; localStorage-only auth fallback is disabled in production paths.
  - User/admin rendered server data is HTML-escaped in the most exposed modal/list surfaces.
  - `custom_cards` has admin-only RLS for insert/update/delete and published/admin read policy.
  - Guild icon and DM GIF URLs are constrained to HTTPS image/GIF sources in RPCs.

### Phase 4 - Payments Scaffold

- Supabase CLI structure exists under `supabase/`.
- Migration scaffold: `supabase/migrations/20260425000001_payments.sql`.
- Tables: `purchases`, `entitlements`.
- RPCs: `grant_flux`, `grant_bp_premium`.
- Edge Function scaffold: `supabase/functions/polar-webhook/index.ts`.
- Frontend helper: `js/payments.js`.
- Provider currently scaffolded as Polar.sh Merchant of Record, not Stripe.
- Product buy links and `POLAR_WEBHOOK_SECRET` still need real production configuration before enabling checkout UX fully.
- FLUX purchase products prepared: `FLUX_5`, `FLUX_10`, `FLUX_30`, `FLUX_50`.
- Pack shop products:
  - 4-card pack: `5 FLUX`.
  - 8-card pack: `10 FLUX`.
  - 20-card pack: `20 FLUX`.
- Paid packs share the same weighted rarity rates and exclude TITANS and GRAND cards.

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
- Deck slots and market listings now preserve `card_instance_id`; keep future evolution/selling logic per-copy, not only per `card_id`.

## Critical Rules

- Do not rebalance card stats unless explicitly requested.
- Do not rename cards or clans unless explicitly requested.
- Do not rewrite core round math unless explicitly requested.
- Server state in Supabase is authoritative where available.
- Bump cache globally on every deploy.
- Prefer small, targeted edits over broad rewrites.
- Validate before reporting done.
