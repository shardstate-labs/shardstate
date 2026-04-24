# Project: SHARDSTATE

A browser-based TCG (off-chain + on-chain ready) currently implemented as a working prototype.

---

## Core Concept

* Humanity is used as a resource to produce PULSOS
* 12 main clans + 1 special clan (ECHO)
* Each main clan has 12 cards
* ECHO has 10 cards
* PROTOCOL controls the system from the shadows

---

## Current State

* Core combat system (casual mode) is functional
* Cards exist (partial implementation)
* Abilities and clan bonuses are defined BUT NOT fully implemented in logic
* UI is placeholder and must be replaced

---

## Source of Truth

* The official game brief defines:

  * all cards
  * stats
  * abilities
  * clan bonuses

Never invent or modify data outside the brief.

---

## Refactor Goal

Transform the project into a scalable architecture WITHOUT breaking behavior.

---

## Target Architecture

### Game Engine (Core)

* Pure logic (NO DOM)
* Contains:

  * cards
  * clans
  * combat
  * abilities
  * state

### PWA (Game Client)

* Renders the game
* Handles modes:

  * training
  * casual
  * ranked (off-chain)
  * ranked (on-chain)
* Embedded in Web under "Play"

### Web Platform

* Profile
* Collection
* Market
* Guilds
* Pack shop
* Auth (login/logout)
* Wallet connection (Abstract)

---

## Data Structure

* Cards must follow a strict schema
* Stored in:
  /game-engine/data/cards.js
  /game-engine/data/clans.js

---

## Critical Rules

* DO NOT rewrite existing logic

* DO NOT change game behavior

* DO NOT rebalance cards

* DO NOT rename cards or clans


---

## Refactor Constraints

* Preserve all formulas and mechanics 1:1
* Maintain exact card data:

  * power
  * damage
  * ability
  * bonus
  * stars
  * rarity

---

## UI/UX Direction

* Replace placeholder UI with structured system
* Follow design.md rules
* Use Skills.md when needed
* Focus on:

  * clarity
  * hierarchy
  * combat readability

---

# CLAUDE CODE RULES - TOKEN EFFICIENCY & GAME DEV PROTOCOLS

Apply these rules strictly to conserve context tokens, maximize execution speed, and protect the "Shardstate" game architecture.

## 1. No Coding Without Context
- BEFORE writing code: read relevant files, check git logs, and understand the Engine vs. Web Portal architecture.
- If context is insufficient, ask. Do not assume.

## 2. Zero Fluff & Short Answers
- Respond in 1-3 sentences. No preambles, no final summaries, no conversational filler.
- ZERO flattery (Do not say "Great idea", "Excellent question", "I understand"). Get straight to work.
- Let the code speak for itself: do not narrate every line you write.

## 3. No Full File Rewrites
- Use targeted `Edit` (partial replacement), NEVER full `Write` for existing files unless changing >80% of the content.
- Modify ONLY what is necessary. Do not "clean up" or format surrounding code.

## 4. One-Touch Reading
- If you have already read a file in the current conversation, do NOT read it again unless it was modified.
- Take mental notes of core structures (`STATE`, `ALL_CARDS`) on your first pass.

## 5. YAGNI (Simple Solutions Only)
- Implement the absolute minimum required to solve the task. Nothing more.

## 6. Execute, Do Not Narrate
- Do not narrate your plan in text ("I will read the file, then modify the function..."). Just execute the tool calls.
- The user can see your tool usage. A text preview is a waste of tokens.

## 7. Parallel & Targeted Tool Calls
- If you need to read 3 independent files, fetch all 3 in a single tool call, not sequentially. Less roundtrips = less context bloat.
- Read only what you need. Use `offset` and `limit` for large files. 
- Do not use `Glob` + `Grep` + `Read` when a direct `Read` suffices.

## 8. Avoid Code Duplication in Chat
- If you edited a file, do NOT print the resulting code in your chat response. The user can see the diff in their editor.
- If you created a new file, do not output the full file contents in the chat.

## 9. Obey the User
- If the user says "do it this way," do it exactly that way. Do not debate unless there is a severe risk of data loss.
- If you disagree architecturally, state your concern in 1 sentence and proceed with the user's request anyway.

## 10. Shardstate Strict Directives (ZERO BREAKAGE)
- NEVER rewrite core game math or turn resolution logic.
- NEVER alter cards stats or clans bonuses.
- Do not invent ability resolution logic unless explicitly instructed.

## 11. Validate Before "Done"
- Never say a task is complete without evidence. Verify that the game compiles, loads, or runs as expected after changes.








