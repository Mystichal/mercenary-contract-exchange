# Hackathon Prep Notes — March 11 Start

## Day 1 Checklist (March 11)

### First thing: validate the environment
- [ ] Get hackathon RPC endpoint URL from Discord
- [ ] Update `CONFIG.worldContractsPackage` with actual deployed world-contracts address
- [ ] Test `suix_queryEvents` works on hackathon RPC (try KillmailCreatedEvent)
- [ ] Test WebSocket subscription availability (`suix_subscribeEvent`) — if it works, swap polling for push
- [ ] Check if `location_hash` in GateCreatedEvent is reversible (see open questions in world-contracts-event-surface.md)
- [ ] Get SUI tokens from faucet for test deployments

### Deploy MVP contracts
```bash
cd contracts/mercenary-exchange
sui move build
sui client publish --gas-budget 100000000
# Note down: packageId, Registry objectId, VerifierCap objectId, AdminCap objectId
# Update client/src/client.ts CONFIG with these addresses
```

### Verify events work
```bash
# Quick check that world-contract events are queryable:
curl -X POST <RPC_URL> \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"suix_queryEvents","params":[{"MoveEventType":"<WORLD_PKG>::killmail::KillmailCreatedEvent"},null,10,false]}'
```

---

## Architecture Decisions Made

### MVP Scope (Days 1-8)
Focus on the core loop that DEMONSTRATES the concept:
1. Tribe creates contract → reward locked in escrow ✅ (contract.move ready)
2. Mercenary accepts → obligation created ✅
3. World event observed → mission verified ✅ (client.ts poller ready)
4. Auto-settlement → funds distributed ✅

### Deferred to Days 9-14 (if time)
- Contract transferability / secondary market UI
- Insurance module
- Risk scoring / analytics dashboard
- Auction model (bid-down)

### Verification: Trusted Verifier for MVP
- VerifierCap held by deployer — submits proof manually or via bot
- This is pragmatic for hackathon: trustless verification requires oracle infra
- Keep trusted path working, mention trustless path in pitch

### Event Consumption: Polling over WebSocket
- WebSocket availability unverified on hackathon RPC
- `suix_queryEvents` cursor-based polling at 8s intervals is safe
- See `startAutoVerifier()` in client.ts — swap internals if WebSocket confirmed

---

## Key Files

| File | Purpose |
|------|---------|
| `contracts/mercenary-exchange/sources/contract.move` | Core contract object — create, accept, transfer, settle |
| `contracts/mercenary-exchange/sources/registry.move` | Shared index of all contracts for UI discovery |
| `contracts/mercenary-exchange/sources/verifier.move` | Trusted settlement trigger via VerifierCap |
| `client/src/client.ts` | TypeScript — world event polling + tx builders |

---

## Winning Pitch Angle

> Civilization on the frontier runs on trust — but trust is scarce.
> We built the primitive that replaces it: a programmable war economy
> where tribes issue missions, mercenaries compete to fulfil them,
> and contracts are priced, traded, and settled automatically by the world itself.

Key differentiators to emphasize:
- **Verified by world state** — not just promises, real game events
- **Tradable obligations** — creates a secondary market (novel for gaming)
- **No arbitrator needed** — settlement is deterministic

---

## Open Questions (resolve March 11)
See `world-contracts-event-surface.md` → "Open Questions for March 11 Test Server Validation"
