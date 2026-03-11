# Mercenary Contract Exchange

> A programmable war economy for EVE Frontier — built on Sui.

**EVE Frontier Hackathon 2026** | Theme: *A Toolkit for Civilization*

---

## What is this?

The Mercenary Contract Exchange transforms military and logistical missions into tradable financial instruments.

Tribes issue operational contracts. Mercenaries compete to fulfil them. Traders buy and sell execution rights. Settlement is automatic, enforced by live world state.

No trust required. No arbitrators. The frontier itself is the source of truth.

---

## How it works

```
Tribe creates contract → reward locked in escrow
        ↓
Mercenary accepts → obligation created on-chain
        ↓
Mission executed in-game
        ↓
World event observed (killmail / status / delivery)
        ↓
Contract auto-verified → funds settled instantly
```

---

## Contract Types

| Type | Verification Event |
|------|--------------------|
| Defend Base | `StatusChangedEvent` (ONLINE after deadline) |
| Destroy Target | `KillmailCreatedEvent` |
| Deliver Cargo | `ItemDepositedEvent` |
| Patrol Zone | `JumpEvent` (character presence) |
| Escort | `JumpEvent` (convoy movement) |

---

## Architecture

```
contracts/mercenary-exchange/
  sources/
    contract.move    — Core MercenaryContract<T> object (create/accept/transfer/settle)
    registry.move    — Shared global index for UI discovery
    verifier.move    — VerifierCap pattern for trusted settlement

client/src/
  client.ts          — Sui SDK: event polling, tx builders, auto-verifier
```

---

## Tech Stack

- **Smart Contracts**: Sui Move
- **Blockchain**: Sui (EVE Frontier hackathon network)
- **World Integration**: EVE Frontier world-contracts event surface
- **Client**: TypeScript + `@mysten/sui`

---

## Build & Deploy

```bash
# Install Sui CLI: https://docs.sui.io/guides/developer/getting-started/sui-install

cd contracts/mercenary-exchange
sui move build
sui client publish --gas-budget 100000000
```

After deploy, update `CONFIG` in `client/src/client.ts` with the deployed package and object IDs.

---

## Hackathon Timeline

| Date | Milestone |
|------|-----------|
| March 11 | Build starts — deploy MVP contracts |
| March 31 | Submission deadline |
| April 1–8 | Deploy into Stillness (live universe) |
| April 24 | Winners announced |

---

## The Pitch

> Civilization on the frontier is defined by risk.
> We built the primitive that prices it.

Tribes fund campaigns. Mercenaries execute them. Contracts become market assets.
Settlement is enforced by the world — not by trust.

This is the military and operational economy of the frontier.
