# Sui & Move - Complete Concept Reference

A comprehensive reference of all Sui blockchain and Move programming concepts, patterns, and techniques.

---

## Sui & Blockchain Fundamentals

- Blockchain architecture, distributed ledger technology, consensus mechanisms
- Sui network: object-centric model, parallel execution, Move language
- Sui ecosystem components, tools, and platforms
- Development workflow: `sui move build`, `sui client publish`, faucet, explorers (SuiScan, Suivision)

---

## Move Language Fundamentals

### Package & Module Structure
- `Move.toml` (manifest), `sources/`, `Move.lock`, `Published.toml`
- Edition: `"2024"`, dependencies: git, local, MVR (`r.mvr`), system
- `modes = ["test"]` for test-only dependencies
- `implicit-dependencies = false` to control auto-inclusion of std/sui

### Abilities System
- `key` — makes struct an on-chain object (requires `UID` field)
- `store` — makes struct composable/transferable
- `drop` — allows implicit discarding of values
- `copy` — allows value duplication
- Types without `drop` must be explicitly consumed (resource safety)

### Primitive Types
- **Integers**: `u8`, `u16`, `u32`, `u64`, `u128`, `u256` with arithmetic and overflow behavior
- **Boolean**: comparisons, conditional `if-else`
- **Control flow**: `while` loops, `if-else` expressions
- **String**: `b"text".to_string()`, character indexing, ASCII comparison, `.append()`

### Structs & Objects
- Struct definition with fields and ability annotations
- `UID` field via `object::new(ctx)` for unique on-chain identity
- Object composition: nesting structs inside other structs
- Object destruction: destructuring `let MyStruct { id, field: _ } = obj;` + `object::delete(id)`

### Object Ownership & Transfer
- `transfer::transfer()` — transfer to specific address
- `transfer::public_transfer()` — public transfer (requires `store`)
- `transfer::share_object()` — make object shared (concurrent mutable access)
- `transfer::freeze_object()` — make object permanently immutable
- `transfer::public_freeze_object()` — public freeze (requires `store`)
- `tx_context::sender()` — get transaction sender address

### Generics & Type Bounds
- Generic functions: `fn do_something<T: key + store>(obj: T)`
- `phantom` type parameters for unused generics: `struct Store<phantom T: store>`
- Type-based routing with `std::type_name::get<T>()`

### Error Handling
- Custom error constants: `const EInvalidPayment: u64 = 100;`
- `assert!(condition, error_code)` for validation
- `abort(error_code)` for unconditional failure

---

## Collections & Data Structures

| Collection | Use Case | Key Operations |
|-----------|----------|----------------|
| **Vector** | Ordered, homogeneous | `push_back()`, `pop_back()`, `length()`, `is_empty()`, `map!()`, `filter!()` |
| **VecMap** | Small key-value pairs | `insert()`, `get()`, `get_mut()`, `contains()`, `keys()` |
| **Bag** | Heterogeneous (mixed types) | `add<K,V>()`, `borrow<K,V>()`, `borrow_mut<K,V>()`, `contains_with_type<K,V>()` |
| **Table** | Large key-value storage | `table::new()`, `add()`, `borrow()`, `borrow_mut()`, `remove()`, `contains()`, `length()` |
| **Option** | Nullable values | `some()`, `none()`, `is_none()`, `is_some()`, `fill()`, `extract()` |

- **Bag type-safe keys**: zero-size marker structs as singleton keys
- **Table key strategies**: enum keys (fixed range) or `TypeName` keys (open range)
- **ID management**: `object::uid_to_inner()` for soft pointers/references to objects
- **UID lifecycle**: explicit deletion with `id.delete()`, destructure to access

---

## Dynamic Fields & Dynamic Object Fields

### Dynamic Fields (`dynamic_field`)
- `df::add(&mut obj.id, key, value)` — attach data at runtime
- `df::borrow()`, `df::borrow_mut()` — read/write access
- `df::remove()` — detach and return value
- `df::exists_()` — check existence
- Attached values become **inaccessible off-chain** (only via parent query)

### Dynamic Object Fields (`dynamic_object_field`)
- `dof::add()`, `dof::borrow()`, `dof::remove()`, `dof::exists_()`
- Attached objects **remain accessible off-chain** (queryable with parent ID)
- Better for integration scenarios where SDK needs to discover children

### Orphan Risk
- If parent object is deleted, attached DF/DOF children become orphaned
- Must implement explicit cleanup logic in deletion functions

---

## Access Control Patterns

### Capability Pattern
- `AdminCap` struct with `key` ability for object-based access control
- Functions require `&AdminCap` reference parameter for authorization
- `init()` function creates and transfers capability to deployer
- **Delegation**: existing admins create new capabilities for others
- **ID-linked capabilities**: `StoreAdminCap { store: ID }` for per-object access control
- Admin of Store A cannot modify Store B (different IDs)

### Publisher / One-Time Witness (OTW)
- OTW: module-named uppercase struct with `drop` (e.g., `MY_MODULE`)
- Instantiated only once per module at publish time
- `package::claim()` / `package::claim_and_keep()` creates Publisher from OTW
- `publisher.from_module<T>()` verifies module origin
- Publisher is singleton; Capability is delegatable

### Witness Pattern
- Struct with `drop` that can only be instantiated inside its declaring module
- Type-based authorization: `mint_item<W: drop>(_witness: W, ...)`
- Move compiler ensures only authorized modules can call
- **Dynamic AllowList**: `Table<String, bool>` of witness type names checked at runtime
- **Two-party flow**: target module controls AllowList, caller module provides witness
- Whitelist/blacklist management: `whitelist_witness<T>()`, `blacklist_witness<T>()`

### Hot Potato Pattern
- Struct **without** `key`, `store`, or `drop` — must be consumed in same transaction
- Enforces function call ordering via the type system
- Creates mandatory multi-step flows (e.g., borrow → process → return)
- Cannot be stored, transferred, or discarded — only destructured

---

## Coin & Balance Handling

### Coin Types
- `Coin<T>` — typed currency object with `key, store`
- `Balance<T>` — internal balance without object overhead
- `TreasuryCap<T>` — authority to mint/burn coins
- `CoinMetadata` — decimals, name, symbol, description, icon URL

### Coin Creation
- OTW struct for currency identity (e.g., `SILVER`)
- `coin::create_currency()` returns `TreasuryCap` + `CoinMetadata`
- `transfer::public_freeze_object()` to make metadata immutable

### Fixed Supply Pattern
- Mint entire supply in `init()`, transfer to sender
- Lock `TreasuryCap` in frozen object via DOF to prevent further minting

### Coin Operations
- `coin::mint_for_testing()` — test coins
- `coin::value()` / `Coin::value()` — get amount
- `coin::into_balance()` — convert Coin to Balance
- `balance::zero()` — empty balance
- `balance::join()` — combine balances

---

## Display Standard

- `display::new_with_fields<T>(&publisher, keys, values, ctx)` — create Display metadata
- Template syntax: `{field_name}` interpolated with actual object field values
- `display::update_version()` — apply/activate display changes
- Requires Publisher object (proof of deployment via OTW)
- Common fields: `name`, `description`, `image_url`
- Off-chain resource linking (e.g., Walrus blob storage URLs)
- Wallets and explorers use Display for object rendering

---

## Events

- Event struct with `copy, drop` abilities
- `event::emit(event_instance)` — broadcast on-chain
- Events are indexed and queryable by clients, indexers, and SDKs
- Used for off-chain monitoring, indexing, and analytics

---

## Shared Objects & Global State

- `transfer::share_object()` — make object shared (concurrent access)
- Accessed via `&mut SharedObj` mutable reference in function parameters
- **Registry pattern**: shared object with `vector<ID>` and counters for tracking global state
- **UsersCounter pattern**: shared mutable counter for concurrent modification
- Shared objects with `key` but not `store` cannot be transferred after sharing

---

## Programmable Transaction Blocks (PTBs)

- Atomic multi-step transactions composed client-side
- Multiple operations succeed or fail together
- **CLI operations**: `--move-call`, `--assign`, `--transfer-objects`, `--split-coins`
- Variable system for chaining call results between steps
- String operations: `std::string::utf8`, `std::string::append`
- Coin splitting and transfer in single atomic transaction
- Lower gas than multi-transaction approach
- No contract deployment needed — dynamic client-side composition

---

## Clock & Time

- `sui::clock::Clock` — on-chain timestamp (shared system object at `0x6`)
- `clock.timestamp_ms()` — current timestamp in milliseconds
- Used for time-based calculations, pseudo-random data generation

---

## Package Upgrades

### Upgrade Flow
1. **Authorize**: present `UpgradeCap` → get `UpgradeTicket`
2. **Publish**: submit new bytecode with ticket
3. **Commit**: receive `UpgradeReceipt`

### Compatibility Rules
- **Allowed**: add modules/functions/structs, change private/`public(package)` bodies
- **Not allowed**: remove modules/functions, change public signatures, change struct layouts
- `init()` does NOT re-run on upgrade

### Upgrade Policies (most → least permissive)
1. `compatible` (default) — backward-compatible changes
2. `additive` — only add functionality
3. `dependency-only` — only change dependencies
4. `immutable` — no upgrades ever
- Policies can only become MORE restrictive, never less

### Versioned Shared Objects Pattern
- Shared object tracks `version` constant matching package `VERSION`
- Public functions call `check_is_valid()` to verify version match
- `migrate()` function updates shared object version after upgrade
- Old package functions fail version check after migration

---

## Testing in Move

### Test Scenario Framework
- `test_scenario::begin(@ADDR)` — start multi-transaction simulation
- `scenario.next_tx(@ADDR)` — advance to next transaction with new sender
- `scenario.end()` — complete scenario

### Object Management in Tests
- `scenario.take_from_sender<T>()` — retrieve owned object
- `scenario.take_shared<T>()` — retrieve shared object
- `scenario.take_immutable<T>()` — retrieve frozen object
- `scenario.return_to_sender(obj)` — return owned object
- `test_scenario::return_shared(obj)` — return shared object

### Effects Validation
- `effects.transferred_to_account()` — objects transferred
- `effects.created()` — objects created
- `effects.shared()` — objects made shared

### Test Attributes & Utilities
- `#[test]` — mark test functions
- `#[test_only]` — test-exclusive code (modules, functions, imports)
- `#[expected_failure]` — negative test cases
- `test_utils::destroy()` — clean up test objects
- `coin::mint_for_testing()` — create test coins

---

## TypeScript SDK

### Client Connection
- `SuiClient` / `SuiGrpcClient` initialization with `getFullnodeUrl()`
- Network selection: devnet, testnet, localnet, mainnet
- Balance queries: `getBalance({ owner })`, MIST to SUI conversion
- Faucet: `requestSuiFromFaucetV2()`, `getFaucetHost()`

### Read Operations
- `getObject({ id, options })` — fetch object with content/display/BCS
- `listOwnedObjects({ owner, type })` — list objects by type
- `listDynamicFields({ parentId })` — query dynamic fields
- `getDynamicObjectField()` — fetch specific dynamic field content
- Object parsing: casting response to TypeScript interfaces
- Type filtering by fully-qualified type string: `{packageId}::module::Struct`

### Transaction Building
- `new Transaction()` — create transaction
- `tx.moveCall({ target, arguments, typeArguments })` — call Move function
- `tx.pure.u64()`, `tx.pure.string()` — pure value arguments
- `tx.object(objectId)` — object reference arguments
- `tx.transferObjects([objects], recipient)` — transfer objects
- `tx.splitCoins(coin, [amounts])` — split coins
- `tx.pure.vector()` — pass array arguments

### Signing & Execution
- `Ed25519Keypair.fromSecretKey()` — create signer from private key
- `signAndExecuteTransaction({ transaction, signer })` — sign and execute
- `waitForTransaction({ digest })` — await confirmation
- Response includes `effects`, `objectChanges`, `changedObjects`

### BCS Decoding
- `bcs.struct()` for struct schema definition
- `bcs.Address`, `bcs.string()`, `bcs.u64()` for field types
- `.parse()` method for decoding bytes from events

---

## dApp Kit (React Integration)

### Setup
- `createDAppKit()` factory with network config and client creation callback
- `DAppKitProvider` + `QueryClientProvider` wrapping the app
- Module augmentation for TypeScript type safety

### Hooks
- `useCurrentAccount()` — connected wallet account or null
- `useCurrentClient()` — active SuiClient/SuiGrpcClient
- `useCurrentNetwork()` — current network name
- `useDAppKit()` — dAppKit instance for transaction operations

### UI Components
- `ConnectButton` — pre-built wallet connection component
- Conditional rendering based on wallet connection state
- Query caching with `useQuery()` (TanStack React Query)
- Cache invalidation with `useQueryClient().invalidateQueries()`

### Transaction Flow in React
- Build transaction with `new Transaction()`
- Execute via `signAndExecuteTransaction()` from dAppKit
- Await with `waitForTransaction({ digest })`
- Invalidate queries to refresh UI

---

## Indexing & Data Ingestion

### Event-Based Indexing
- Move events emitted with `event::emit()` → indexed by external services
- Custom indexer: checkpoint-level data processing, real-time monitoring
- Event-based indexer: auto TypeScript type generation from Move events
- Infrastructure: PostgreSQL + Docker Compose, Prisma ORM
- Express API: REST endpoints for querying indexed events

### gRPC Real-Time Indexing
- `SuiGrpcClient.subscribeCheckpoints()` with read masks
- Checkpoint processing: async iteration, event filtering by fully-qualified type
- BCS decoding for event data transformation
- Infrastructure: PostgreSQL + Docker Compose

---

## ZKLogin (Zero-Knowledge Authentication)

### Ephemeral Key Generation
- Ed25519 keypair per session
- `generateRandomness()` for nonce derivation
- Nonce = f(public key, max epoch, randomness)

### OAuth Integration
- Provider support: Google, Apple, Facebook
- JWT token capture and parsing (`aud`, `iss`, `sub` claims)
- Nonce included in OAuth URL for security binding

### ZK Proof & Address Derivation
- Extended ephemeral public key derivation
- Integration with Mysten Labs proving service
- `jwtToAddress()` — derive blockchain address from JWT + salt
- `genAddressSeed()` — generate address seed from salt and JWT claims
- Deterministic address derivation from OAuth identity

### Transaction Signing
- `getZkLoginSignature()` — create signature using ZK proof
- Transaction execution without traditional private keys
- Full transaction capabilities (transfers, move calls, etc.)

---

## Key Patterns Summary

| Pattern | Purpose | Key Mechanism |
|---------|---------|---------------|
| **Capability** | Access control | Object ownership gates function access |
| **Publisher/OTW** | Module identity | Singleton proof of deployment |
| **Hot Potato** | Transaction ordering | No-ability struct must be consumed |
| **Witness** | Cross-module auth | Drop-only type proves module identity |
| **Display** | Object rendering | Template metadata for wallets/explorers |
| **Versioned Shared Object** | Upgrade safety | Version check prevents stale access |
| **Registry** | Global state tracking | Shared object with ID vectors/counters |
| **Treasury Lock** | Fixed supply | Freeze TreasuryCap in immutable object |

## Testing Quick Reference

| Tool | Purpose |
|------|---------|
| `test_scenario` | Multi-transaction simulation |
| `#[test]` | Mark test functions |
| `#[test_only]` | Test-exclusive code |
| `#[expected_failure]` | Negative test cases |
| `test_utils::destroy()` | Clean up test objects |
| `ts::take_from_sender<T>()` | Retrieve owned objects in tests |
| `ts::take_shared<T>()` | Retrieve shared objects in tests |
| `ts::take_immutable<T>()` | Retrieve frozen objects in tests |

## TypeScript SDK Quick Reference

| Operation | Method |
|-----------|--------|
| Connect | `SuiClient` / `SuiGrpcClient` with `getFullnodeUrl()` |
| Read object | `getObject({ id, options })` |
| List owned | `listOwnedObjects({ owner, type })` |
| Dynamic fields | `listDynamicFields({ parentId })` |
| Build TX | `new Transaction()`, `tx.moveCall()`, `tx.transferObjects()` |
| Sign & execute | `signAndExecuteTransaction({ transaction, signer })` |
| Events | `event::emit()` (Move) → query via indexer or SDK |
| BCS decode | `bcs.struct()` with field definitions, `.parse()` |
| gRPC stream | `subscribeCheckpoints()` with read masks |
