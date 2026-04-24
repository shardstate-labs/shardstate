# Skills

## Safe Refactoring
- Extract logic from large HTML files
- Preserve full behavior (no regression)
- Maintain existing structures
-create web platform architecture for embedding the PWA game in the web platform

## Game Architecture
- Separate engine from UI
- Modularize clans/cards/abilities/clan bonuses
- Isolate state management

## TCG Systems
- Handle multi-clan systems (13 factions)
- Support fixed card sets (12 per clan, 10 special)
- Maintain ability resolution integrity
- Maintain 8 card limit per deck choosing 4 cards randomly from the deck when starting a battle

## Frontend Separation
- Remove DOM from logic
- Build render layer on top of engine
- Prepare PWA embedding

## Data Integrity
- Do not modify card stats
- Do not rename clans or cards
- Keep all definitions identical

## Web3 Preparation
- Add abstraction layers only
- Keep game fully off-chain for now to scale the game in the future

## Constraints
- No simplification
- No logic changes