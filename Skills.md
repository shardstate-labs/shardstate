# SHARDSTATE - Engineering Skills

Use this file as local project guidance for future agents and contributors.

## Safe Refactoring

- Read the relevant files before editing.
- Prefer small targeted patches over full rewrites.
- Preserve current behavior unless the task explicitly changes behavior.
- Keep dirty user work unless the user explicitly asks to remove it.
- Verify with at least static file checks or live smoke checks before calling work done.

## Architecture

- Keep engine logic separate from UI logic.
- Core engine files:
  - `engine/cards.js`
  - `engine/ability_catalog.js`
  - `engine/round_engine.js`
  - `game/engine.js`
- UI/gameplay files:
  - `game/main.js`
  - `game/render.js`
  - `game/style.css`
  - `gamehub/app.js`
- Shared backend/client files:
  - `js/sb.js`
  - `js/sync.js`
  - `js/pvp.js`
  - `js/payments.js`

## TCG Rules

- Do not modify card stats unless explicitly instructed.
- Do not rename clans or cards unless explicitly instructed.
- Maintain the 8-card deck limit.
- Game combat hand is 4 cards selected from the player's 8-card Gamehub deck.
- The Game deck must match the deck built by the player in Gamehub.
- Ability resolution integrity is more important than UI convenience.

## PvP Rules

- Supabase is authoritative for matchmaking and finalization.
- Realtime is used for live actions, but the client must tolerate missed events through polling fallback.
- Matchmaking must never leave a player stuck indefinitely.
- Surrender counts as abandon and must finalize through the normal PvP path.

## Payments Rules

- Keep purchases server-authoritative.
- Frontend opens checkout only; rewards are granted by webhook/RPC.
- Do not trust client-side product amounts.
- Store every payment provider event in `purchases.raw` for auditability.
- Use `entitlements` for granted perks.

## Web3 Preparation

- The game remains off-chain for now.
- Do not block current off-chain UX on future on-chain assumptions.
- Design data flows so ownership, tournaments, and ranked modes can later move on-chain cleanly.

## UX Rules

- Combat readability comes first.
- No hidden mechanics.
- Every PvP waiting state must explain what is happening.
- Spanish and English should remain supported in game-facing UI.
- Avoid browser-native alerts for important game flows; use in-app modals.
