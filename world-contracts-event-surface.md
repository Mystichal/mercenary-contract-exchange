# World-Contracts Event Surface Audit (Sui) + Access Paths

**Retention:** Prep-only

> Canonical reference for all events emitted by `vendor/world-contracts` Move modules, their fields, spatial linkage, and practical consumption methods on Sui. Produced 2026-03-02 from code scan of world-contracts v0.0.14.

---

## Executive Summary

World-contracts emits **28 unique event types** from **37 call sites** across 11 modules. Events cover assembly lifecycle (gate, turret, SSU, network node), inventory operations (mint/burn/deposit/withdraw), fuel/energy state, access control, killmails, metadata, and status changes.

**Spatial linkage is sparse.** Only `KillmailCreatedEvent` contains a direct `solar_system_id`. Gate and SSU creation events include a hashed `location_hash`. All other events require an off-chain object lookup to derive spatial position from `assembly_id` → assembly object → location field.

**No event indexer or streaming service exists** in the EVE Frontier builder ecosystem. The only implemented consumption pattern is synchronous extraction from `executeTransactionBlock` responses (your own transactions). Historical/cross-user event queries require `suix_queryEvents` (cursor-based JSON-RPC), which is documented but has **zero running code** in this workspace. GraphQL, gRPC checkpoint streaming, and WebSocket subscriptions are referenced in docs but unimplemented.

**Sui is not Ethereum.** Failed transactions emit no events. Events are not in a Merkle trie. There is no `eth_getLogs` block-range scan. Cursor-based pagination replaced time-range filtering. MoveAbort discards all events — only the tx digest and abort code survive.

**Recommended hackathon MVP consumption method:** `suix_queryEvents` with `MoveEventType` filter + cursor pagination, polled at 5–10s intervals. Validate on March 11 test server. WebSocket subscription (`suix_subscribeEvent`) is a stretch goal — availability varies by RPC provider.

---

## Event Index

### Module: `world::access` — access_control.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `OwnerCapCreatedEvent` | `create_owner_cap()`, `create_owner_cap_by_id()` | `owner_cap_id: ID`, `authorized_object_id: ID` | None (indirect via authorized_object_id → assembly) | Cap creation for any assembly type |
| `OwnerCapTransferred` | `transfer()` (private; called by `transfer_owner_cap_to_address`, `create_and_transfer_owner_cap`) | `owner_cap_id: ID`, `authorized_object_id: ID`, `previous_owner: address`, `owner: address` | None | Ownership transfer tracking |

### Module: `world::assembly` — assembly.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `AssemblyCreatedEvent` | `anchor()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `owner_cap_id: ID`, `type_id: u64` | None (location_hash on object, NOT in event) | Generic assembly creation |

### Module: `world::gate` — gate.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `GateCreatedEvent` | `anchor()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `owner_cap_id: ID`, `type_id: u64`, `location_hash: vector<u8>`, `status: Status` | **Direct: `location_hash`** (hashed) | One of 2 events with spatial data |
| `GateLinkedEvent` | `link_gates()` | `source_gate_id: ID`, `source_gate_key: TenantItemId`, `destination_gate_id: ID`, `destination_gate_key: TenantItemId` | Derivable (gate IDs → objects → location) | Topology change |
| `GateUnlinkedEvent` | `unlink()` (private; called by `unlink_gates()`) | `source_gate_id: ID`, `source_gate_key: TenantItemId`, `destination_gate_id: ID`, `destination_gate_key: TenantItemId` | Derivable (gate IDs → objects → location) | Topology change |
| `JumpEvent` | `jump_internal()` (private; called by `jump()`, `jump_with_permit()`) | `source_gate_id: ID`, `source_gate_key: TenantItemId`, `destination_gate_id: ID`, `destination_gate_key: TenantItemId`, `character_id: ID`, `character_key: TenantItemId` | Derivable (gate IDs → objects → location); **character_id** present | **Highest-value event for activity tracking** |

### Module: `world::turret` — turret.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `TurretCreatedEvent` | `anchor()` | `turret_id: ID`, `turret_key: TenantItemId`, `owner_cap_id: ID`, `type_id: u64` | None (location on object, not in event) | |
| `PriorityListUpdatedEvent` | `get_target_priority_list()` | `turret_id: ID`, `priority_list: vector<TargetCandidate>` | None (turret_id → object → location) | TargetCandidate includes character_id, tribe, aggressor flag |

### Module: `world::storage_unit` — storage_unit.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `StorageUnitCreatedEvent` | `anchor()` | `storage_unit_id: ID`, `assembly_key: TenantItemId`, `owner_cap_id: ID`, `type_id: u64`, `max_capacity: u64`, `location_hash: vector<u8>`, `status: Status` | **Direct: `location_hash`** (hashed) | One of 2 events with spatial data |

### Module: `world::metadata` — metadata.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `MetadataChangedEvent` | `emit_metadata_changed()` (private; called by `update_name`, `update_description`, `update_url`, `create_metadata`) | `assembly_id: ID`, `assembly_key: TenantItemId`, `name: String`, `description: String`, `url: String` | Derivable (assembly_id → object → location) | |

### Module: `world::status` — status.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `StatusChangedEvent` | `emit_status_changed()` (private; called by `anchor`, `unanchor`, `online`, `offline`) | `assembly_id: ID`, `assembly_key: TenantItemId`, `status: Status` (NULL/OFFLINE/ONLINE), `action: Action` (ANCHORED/ONLINE/OFFLINE/UNANCHORED) | Derivable (assembly_id → object → location) | Source comment: "only for informing the indexers" |

### Module: `world::inventory` — inventory.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `ItemMintedEvent` | `mint_items()`, `increase_item_quantity()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `character_id: ID`, `character_key: TenantItemId`, `item_id: u64`, `type_id: u64`, `quantity: u32` | assembly_id linkage; **character_id** present | |
| `ItemBurnedEvent` | `burn_items()`, `destroy_item()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `character_id: ID`, `character_key: TenantItemId`, `item_id: u64`, `type_id: u64`, `quantity: u32` | assembly_id linkage; **character_id** present | |
| `ItemDepositedEvent` | `deposit_item()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `character_id: ID`, `character_key: TenantItemId`, `item_id: u64`, `type_id: u64`, `quantity: u32` | assembly_id linkage; **character_id** present | |
| `ItemWithdrawnEvent` | `withdraw_item()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `character_id: ID`, `character_key: TenantItemId`, `item_id: u64`, `type_id: u64`, `quantity: u32` | assembly_id linkage; **character_id** present | |
| `ItemDestroyedEvent` | `delete()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `item_id: u64`, `type_id: u64`, `quantity: u32` | assembly_id only (no character_id — bulk cleanup) | |

### Module: `world::fuel` — fuel.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `FuelEvent` | `deposit()`, `withdraw()`, `start_burning()`, `stop_burning()`, `delete()`, `consume_fuel_units()` | `assembly_id: ID`, `assembly_key: TenantItemId`, `type_id: u64`, `old_quantity: u64`, `new_quantity: u64`, `is_burning: bool`, `action: Action` (DEPOSITED/WITHDRAWN/BURNING_STARTED/BURNING_STOPPED/BURNING_UPDATED/DELETED) | Derivable (assembly_id → object → location) | **6 emit sites** — highest count of any single event type |
| `FuelEfficiencySetEvent` | `set_fuel_efficiency()` | `fuel_type_id: u64`, `efficiency: u64` | None (global config) | |
| `FuelEfficiencyRemovedEvent` | `unset_fuel_efficiency()` | `fuel_type_id: u64` | None (global config) | |

### Module: `world::energy` — energy.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `StartEnergyProductionEvent` | `start_energy_production()` | `energy_source_id: ID`, `current_energy_production: u64` | Derivable (energy_source_id = NetworkNode ID → object → location) | |
| `StopEnergyProductionEvent` | `stop_energy_production()` | `energy_source_id: ID` | Derivable | |
| `EnergyReservedEvent` | `reserve_energy()` | `energy_source_id: ID`, `assembly_type_id: u64`, `energy_reserved: u64`, `total_reserved_energy: u64` | Derivable | |
| `EnergyReleasedEvent` | `release_energy()` | `energy_source_id: ID`, `assembly_type_id: u64`, `energy_released: u64`, `total_reserved_energy: u64` | Derivable | |

### Module: `world::network_node` — network_node.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `NetworkNodeCreatedEvent` | `anchor()` | `network_node_id: ID`, `assembly_key: TenantItemId`, `owner_cap_id: ID`, `type_id: u64`, `fuel_max_capacity: u64`, `fuel_burn_rate_in_ms: u64`, `max_energy_production: u64` | None (location on object, not in event) | |

### Module: `world::killmail` — killmail.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `KillmailCreatedEvent` | `create_killmail()` | `killmail_id: TenantItemId`, `killer_character_id: TenantItemId`, `victim_character_id: TenantItemId`, `solar_system_id: TenantItemId`, `loss_type: LossType` (SHIP/STRUCTURE), `kill_timestamp: u64` | **Direct: `solar_system_id`** — the ONLY event with an explicit solar system identifier | Source comment: "Emits killmail events for indexer-based queries" |

### Module: `world::character` — character.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `CharacterCreatedEvent` | `create_character()` | `character_id: ID`, `key: TenantItemId`, `tribe_id: u32`, `character_address: address` | None; **tribe_id** present | Only event with direct tribe_id field |

### Module: `extension_examples::turret` — extension_examples/turret.move

| Event | Emitted By | Fields | Location Linkage | Notes |
|-------|-----------|--------|-----------------|-------|
| `PriorityListUpdatedEvent` | `get_target_priority_list()` | `turret_id: ID`, `priority_list: vector<u8>` | Derivable (turret_id → object → location) | **Different from `world::turret::PriorityListUpdatedEvent`** — raw BCS bytes, not typed vector |

### Modules with NO Events

| Module | File | Purpose |
|--------|------|---------|
| `world::world` | world.move | Package init only |
| `world::in_game_id` | in_game_id.move | TenantItemId utility |
| `world::location` | location.move | Location attach/verify/proof |
| `world::object_registry` | object_registry.move | Derived object registry |
| `world::sig_verify` | sig_verify.move | Signature verification |
| `assets::EVE` | EVE.move | Fungible token definition |
| `extension_examples::config` | config.move | Extension config setup |
| `extension_examples::tribe_permit` | tribe_permit.move | Tribe-based gate permit logic |
| `extension_examples::corpse_gate_bounty` | corpse_gate_bounty.move | Bounty gate logic |

---

## Spatial Identifier Summary

| Field | Event(s) | Type | Access |
|-------|----------|------|--------|
| `solar_system_id` | `KillmailCreatedEvent` **only** | `TenantItemId` | **Direct** — present in event payload |
| `location_hash` | `GateCreatedEvent`, `StorageUnitCreatedEvent` | `vector<u8>` | **Direct** but hashed — creation-time only |
| *(derivable via object lookup)* | All events with `assembly_id` / `gate_id` / `turret_id` / `energy_source_id` | Indirect | Must read object to get location field |

**Key finding:** There is no universal "system_id" or "location" field on operational events (jumps, inventory, fuel, status). Location anchoring requires maintaining a local cache mapping assembly IDs → locations, populated from creation events or object reads.

---

## Event Consumption Paths

### Implemented in Code (Verified)

| Mechanism | Where | Pattern | Scope |
|-----------|-------|---------|-------|
| **Tx-inline events** | `vendor/world-contracts/ts-scripts/utils/transaction.ts` | `executeTransactionBlock({ showEvents: true })` + `extractEvent()` helper | Your own transactions only |
| **GraphQL (transactions)** | `vendor/evevault/packages/shared/src/sui/graphqlClient.ts` | `SuiGraphQLClient` → transaction history (balance changes, NOT events) | EVE Vault only; cursor-based pagination |
| **gRPC client** | `vendor/evevault/packages/shared/src/sui/suiClient.ts` | `SuiGrpcClient` for standard RPC operations (build tx, get objects) | EVE Vault only; no event-specific gRPC |

### Documented But Unimplemented

| Mechanism | Source | Status |
|-----------|--------|--------|
| **`suix_queryEvents` (JSON-RPC)** | Builder docs (`interfacing-with-the-eve-frontier-world.md`), implementation plans, day-1 checklist | No reference implementation provided here.
Documented with examples showing `MoveEventType` filter and cursor pagination. |
| **GraphQL event queries** | Builder docs list GraphQL as "preferred read path" | No GraphQL event query code exists. EVE Vault GraphQL is for transaction history only. |
| **gRPC checkpoint streaming** | Builder docs mention "higher throughput and streaming (e.g., checkpoints)" | No streaming code. `world-contracts/ts-scripts/utils/helper.ts` has a `// TODO: use grpc` comment. |
| **`suix_subscribeEvent` (WebSocket)** | Referenced in UX architecture spec and read-path validation as stretch goal | Availability on hackathon RPC is **unverified**. Polling is the documented fallback. |

### Not Found

| Mechanism | Notes |
|-----------|-------|
| **CCP event indexing service** | No EVE Frontier / CCP backend provides event indexing or streaming. Only confirmed CCP APIs: sponsored tx API (`api.{tier}.tech.evefrontier.com/transactions/sponsored/...`) and auth server (`auth.evefrontier.com`). |
| **Custom indexer** | Evaluated and rejected for hackathon scope in read-path architecture validation. |
| **RDPC / GRDPC** | No references found in any workspace file. |

### Consumption Path Summary Matrix

| Mechanism | Code Exists | Documented | Hackathon Viable |
|-----------|------------|------------|-----------------|
| Tx-inline events (`showEvents`) | **YES** | YES | Yes — for own transactions |
| `suix_queryEvents` (JSON-RPC) | **NO** | YES | **Yes — recommended MVP path** |
| GraphQL event queries | **NO** | Partially | Maybe — validate March 11 |
| `suix_subscribeEvent` (WS) | **NO** | Stretch | Maybe — validate March 11 |
| gRPC checkpoint stream | **NO** | Mentioned | No — overkill for hackathon |
| CCP event service | **NO** | **NO** | No — does not exist |

---

## Ethereum Assumptions That Do NOT Carry Over

| Ethereum Concept | Sui Reality | Impact |
|-----------------|------------|--------|
| **`eth_getLogs` block-range scanning** | No equivalent. `suix_queryEvents` uses **cursor-based pagination**, not block/time ranges. `TimeRange` filter is deprecated. | Must maintain cursor state between polls. Cannot query "events from block X to Y." |
| **"Logs" with indexed topics** | No "topics." Sui filters events by: event struct type (`MoveEventType`), emitting module (`MoveModule`), sender address (`Sender`), or transaction digest (`Transaction`). | Cannot filter on arbitrary field values (e.g., "all JumpEvents for gate X"). Client-side filtering required. |
| **Reverted tx emits logs** | **MoveAbort discards ALL events.** Only the tx digest + abort code (u64) + module name survive. No "revert log" equivalent. | Cannot use events as proof-of-attempt. Failed toll collections, denied jumps, etc. produce zero events. Must use tx digest + effects for failure observability. |
| **Receipt with cumulative gas** | No receipt object. Gas info is in transaction effects. No per-event gas attribution. | |
| **Events in Merkle trie** | Events are NOT part of any Merkle structure. No cryptographic proof-of-event-inclusion. | Cannot prove to a third party that an event was emitted using only chain data. |
| **Block-based event subscriptions** | Sui uses per-event-type WebSocket subscription (`suix_subscribeEvent`), not block-polling. Availability varies by RPC provider. | Cannot rely on "new block → check events" polling loop. |
| **Shared objects = instant read-after-write** | Shared objects go through consensus (~2-3s latency). Owned objects use fast-path. | After a gate configuration change (shared-object write), reading the updated state has consensus delay. |
| **Post-execution gas metering** | Sui gas is **pre-declared budget**. Under-budget = immediate abort. Over-budget = refund minus storage deposit. | Gas estimation must be generous; under-budget causes silent failure with no events. |
| **Event permanence / full history** | Events are NOT stored as on-chain objects. They are indexed by full nodes and subject to pruning. Retention window depends on RPC provider policy. | Long-term event history may disappear. Critical state must be in objects/dynamic fields, not derived solely from events. |

---

## What We Can Reliably Observe Without an Indexer

### Browser-First Polling (Hackathon MVP)

| Capability | API | Notes |
|-----------|-----|-------|
| **Events by type (historical)** | `suix_queryEvents({ MoveEventType: "pkg::module::EventType" }, cursor, limit, descending)` | Cursor-based. Poll every 5-10s. Track cursor to avoid re-fetching. Subject to node retention window. |
| **Events from a specific tx** | `sui_getEvents(txDigest)` | Only returns events from successful transactions. |
| **Your own tx events (inline)** | `executeTransactionBlock({ showEvents: true, showEffects: true })` | Immediate — no network round-trip for event data. |
| **Object state (current)** | `sui_getObject(id, { showContent: true })` / `sui_multiGetObjects(ids)` | Real-time. Dynamic fields require separate `suix_getDynamicFields(parentId)` call. |
| **Owned objects by type** | `suix_getOwnedObjects(address, { filter: { StructType: "pkg::module::Type" }})` | Used for discovering OwnerCaps, assemblies owned by a player. |
| **Transaction status** | `sui_getTransactionBlock(digest, { showEffects: true })` | Works for both success and failure. Abort code in `effects.status.error`. |
| **Failed tx detection** | `suix_queryTransactionBlocks({ filter: { FromAddress: "..." } })` + client-side filter on `effects.status` | No native "failed-only" filter. Must iterate and check status. |

### Practical Polling Architecture (Recommended)

```
┌─────────────┐     suix_queryEvents        ┌──────────────┐
│  Browser /   │────(MoveEventType filter)──▶│  Sui RPC     │
│  DApp Client │    cursor pagination        │  Full Node   │
│              │◀───(event[], nextCursor)─────│              │
│              │                             │              │
│              │    sui_multiGetObjects      │              │
│              │────(assembly IDs from       │              │
│              │    events for location)────▶│              │
│              │◀───(objects w/ location)─────│              │
└─────────────┘                             └──────────────┘
```

**Rate limit consideration:** Public RPC endpoints typically allow 300-500 req/s. At 10s polling intervals querying 5-10 event types = ~1 req/s baseline. Within limits for hackathon demo. Production would need a dedicated RPC or indexer.

### What You CANNOT Do Without an Indexer

- Query "all events for gate X" natively (no field-level filter in `suix_queryEvents` — must fetch all events of a type and filter client-side)
- Aggregate counts/sums over event history (must paginate through all events)
- Receive real-time push notifications reliably (WebSocket subscription availability is provider-dependent)
- Query events older than the node's retention window
- Get events from failed transactions (they don't exist)

---

## Top 10 Events for Activity Tracking

Ranked by relevance to governance, commerce, and operational awareness:

| Rank | Event | Why |
|------|-------|-----|
| 1 | `gate::JumpEvent` | Core player movement — character, source/destination gates. Highest-signal activity event. |
| 2 | `killmail::KillmailCreatedEvent` | PvP activity with **direct solar_system_id**. Only event with explicit location. |
| 3 | `inventory::ItemDepositedEvent` | Trade/commerce signal — items entering SSUs. Character-linked. |
| 4 | `inventory::ItemWithdrawnEvent` | Trade/commerce signal — items leaving SSUs. Character-linked. |
| 5 | `gate::GateLinkedEvent` | Topology changes — gate network reconfiguration. |
| 6 | `gate::GateUnlinkedEvent` | Topology changes — gate network reconfiguration. |
| 7 | `status::StatusChangedEvent` | Assembly online/offline — structural health monitoring. |
| 8 | `fuel::FuelEvent` | Fuel management — operational sustainability tracking. |
| 9 | `access::OwnerCapTransferred` | Ownership changes — governance/authority shifts. |
| 10 | `character::CharacterCreatedEvent` | New player onboarding — tribe_id linkage. |

---

## Open Questions for March 11 Test Server Validation

| # | Question | Validation Method | Priority |
|---|----------|-------------------|----------|
| 1 | Is `suix_subscribeEvent` (WebSocket) available on the hackathon RPC endpoint? | Attempt WebSocket connection: `ws://<rpc>/websocket` → send `suix_subscribeEvent` JSON-RPC call | HIGH — determines polling vs push architecture |
| 2 | What is the event retention window on the hackathon RPC? | Query oldest available event via cursor pagination on any high-volume event type | MEDIUM — determines whether historical data survives a demo session |
| 3 | Is Sui GraphQL available on the hackathon endpoint? | Attempt `POST https://<graphql-endpoint>/graphql` with a simple query | MEDIUM — alternative read path |
| 4 | Does `location_hash` in `GateCreatedEvent` / `StorageUnitCreatedEvent` use a reversible encoding (to derive system_id)? | Compare event `location_hash` with known gate locations in test data | HIGH — determines whether creation events provide spatial anchoring |
| 5 | Are custom extension events emitted alongside world-contracts events in the same tx? | Deploy a sample extension, execute a custom action, check tx events | HIGH — determines whether extension events coexist |
| 6 | What is the practical latency of `suix_queryEvents` after a transaction is finalized? | Emit event → immediately query → measure first-seen delay | LOW — likely sub-second but worth confirming |
| 7 | Does `suix_queryTransactionBlocks({ filter: { ChangedObject: <gate_id> } })` reliably return txs that interact with a specific gate? | Execute jump_with_permit → query by gate ID → verify hit | MEDIUM — alternative to event-based discovery |

---

## References

### World-Contracts Source (Event Definitions)

- `vendor/world-contracts/contracts/world/sources/access/access_control.move` — OwnerCapCreatedEvent, OwnerCapTransferred
- `vendor/world-contracts/contracts/world/sources/assemblies/assembly.move` — AssemblyCreatedEvent
- `vendor/world-contracts/contracts/world/sources/assemblies/gate.move` — GateCreatedEvent, GateLinkedEvent, GateUnlinkedEvent, JumpEvent
- `vendor/world-contracts/contracts/world/sources/assemblies/turret.move` — TurretCreatedEvent, PriorityListUpdatedEvent
- `vendor/world-contracts/contracts/world/sources/assemblies/storage_unit.move` — StorageUnitCreatedEvent
- `vendor/world-contracts/contracts/world/sources/primitives/metadata.move` — MetadataChangedEvent
- `vendor/world-contracts/contracts/world/sources/primitives/status.move` — StatusChangedEvent
- `vendor/world-contracts/contracts/world/sources/primitives/inventory.move` — ItemMinted/Burned/Deposited/Withdrawn/DestroyedEvent
- `vendor/world-contracts/contracts/world/sources/primitives/fuel.move` — FuelEvent, FuelEfficiencySet/RemovedEvent
- `vendor/world-contracts/contracts/world/sources/primitives/energy.move` — Start/StopEnergyProductionEvent, EnergyReserved/ReleasedEvent
- `vendor/world-contracts/contracts/world/sources/network_node/network_node.move` — NetworkNodeCreatedEvent
- `vendor/world-contracts/contracts/world/sources/killmail/killmail.move` — KillmailCreatedEvent
- `vendor/world-contracts/contracts/world/sources/character/character.move` — CharacterCreatedEvent
- `vendor/world-contracts/contracts/extension_examples/sources/turret.move` — PriorityListUpdatedEvent (raw BCS variant)

### Consumption Path Evidence

- `vendor/world-contracts/ts-scripts/utils/transaction.ts` — inline event extraction pattern
- `vendor/world-contracts/ts-scripts/utils/helper.ts` — `extractEvent<T>()` utility
- `vendor/evevault/packages/shared/src/sui/graphqlClient.ts` — GraphQL client (transactions only)
- `vendor/evevault/packages/shared/src/sui/suiClient.ts` — gRPC client
- `vendor/builder-documentation/smart-contracts/interfacing-with-the-eve-frontier-world.md` — official API docs

---

## Statistics

- **28** unique event struct types (27 in `world` package + 1 in `extension_examples`)
- **37** total `event::emit` call sites
- **9** modules emit no events
- **13** event types include `assembly_key: TenantItemId` for in-game ID linkage
- **6** event types include `character_id` / `character_key`
- **1** event contains direct `solar_system_id` (KillmailCreatedEvent)
- **2** events contain direct `location_hash` (GateCreatedEvent, StorageUnitCreatedEvent)
- **1** event contains direct `tribe_id` (CharacterCreatedEvent)
- **0** implemented event consumers in the workspace (all are documented patterns only)
