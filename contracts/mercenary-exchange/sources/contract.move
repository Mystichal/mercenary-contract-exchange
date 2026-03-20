/// Mercenary Contract Exchange — Core Contract Object
///
/// Lifecycle: Created → Active → Verified → Settled
/// Supports: Battle, Transport, Scout, Bounty, Defend, Patrol, Escort
module mercenary_exchange::contract {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::coin::Coin;
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;

    // ── Error codes ────────────────────────────────────────────────────────
    const ENotIssuer:          u64 = 100;
    const EAlreadyAccepted:    u64 = 101;
    const EDeadlinePassed:     u64 = 102;
    const ENotExecutor:        u64 = 103;
    const ENotActive:          u64 = 104;
    const EWrongMissionType:   u64 = 105;
    const ESharesMismatch:     u64 = 106; // tiered payout arrays unequal length
    const ESharesNotFull:      u64 = 107; // tiered shares don't sum to 10000 bps

    // ── Mission types ──────────────────────────────────────────────────────
    //
    // extra_data encoding per type:
    //   DEFEND_BASE    (1): BCS bytes of assembly_id (u64)
    //   DESTROY_TARGET (2): BCS bytes of target assembly_id (u64)
    //   DELIVER_CARGO  (3): BCS bytes of { origin_psu: u64, dest_psu: u64, cargo_hash: vector<u8> }
    //   PATROL_ZONE    (4): BCS bytes of { min_x: i64, max_x: i64, min_y: i64, max_y: i64 }
    //   ESCORT         (5): BCS bytes of target_address (32 bytes)
    //   SCOUT          (6): BCS bytes of { systems: vector<u64>, intel_types: vector<u8> }
    //   BOUNTY         (7): BCS bytes of target_address (32 bytes); supports tiered payout
    //
    const MISSION_DEFEND_BASE:    u8 = 1;
    const MISSION_DESTROY_TARGET: u8 = 2;
    const MISSION_DELIVER_CARGO:  u8 = 3;
    const MISSION_PATROL_ZONE:    u8 = 4;
    const MISSION_ESCORT:         u8 = 5;
    const MISSION_SCOUT:          u8 = 6;
    const MISSION_BOUNTY:         u8 = 7;

    // ── Status ─────────────────────────────────────────────────────────────
    const STATUS_OPEN:      u8 = 0;
    const STATUS_ACTIVE:    u8 = 1;
    const STATUS_COMPLETED: u8 = 2;
    const STATUS_FAILED:    u8 = 3;
    const STATUS_DISPUTED:  u8 = 4;

    // ── Core struct ────────────────────────────────────────────────────────
    public struct MercenaryContract<phantom T> has key {
        id: UID,

        // Parties
        issuer:       address,
        executor:     Option<address>,
        transferable: bool,

        // Mission definition
        mission_type:    u8,
        extra_data:      vector<u8>,   // BCS-encoded type-specific fields (see above)
        solar_system_id: u64,
        deadline_ms:     u64,

        // Economics
        reward:      Balance<T>,  // locked reward — paid to executor on success
        issuer_bond: Balance<T>,  // issuer collateral — returned on fair resolution

        // State
        status:      u8,
        created_ms:  u64,
        accepted_ms: Option<u64>,
        settled_ms:  Option<u64>,

        // Proof reference set by verifier
        world_tx_proof: Option<vector<u8>>,
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct ContractCreatedEvent has copy, drop {
        contract_id:     ID,
        issuer:          address,
        mission_type:    u8,
        extra_data:      vector<u8>,
        solar_system_id: u64,
        deadline_ms:     u64,
        reward_amount:   u64,
        bond_amount:     u64,
        transferable:    bool,
    }

    public struct ContractAcceptedEvent has copy, drop {
        contract_id: ID,
        executor:    address,
        accepted_ms: u64,
    }

    public struct ContractSettledEvent has copy, drop {
        contract_id: ID,
        executor:    address,
        success:     bool,
        settled_ms:  u64,
    }

    public struct ContractTieredSettledEvent has copy, drop {
        contract_id: ID,
        executors:   vector<address>,
        shares_bps:  vector<u64>,
        settled_ms:  u64,
    }

    public struct ContractTransferredEvent has copy, drop {
        contract_id:   ID,
        from_executor: address,
        to_executor:   address,
    }

    // ── Create ─────────────────────────────────────────────────────────────
    public fun create<T>(
        mission_type:    u8,
        extra_data:      vector<u8>,
        solar_system_id: u64,
        deadline_ms:     u64,
        transferable:    bool,
        reward_coin:     Coin<T>,
        bond_coin:       Coin<T>,
        clock:           &Clock,
        ctx:             &mut TxContext,
    ) {
        use sui::coin::into_balance;
        use sui::clock::timestamp_ms;

        let uid = object::new(ctx);
        let id  = object::uid_to_inner(&uid);
        let reward_amount = sui::coin::value(&reward_coin);
        let bond_amount   = sui::coin::value(&bond_coin);

        let contract = MercenaryContract<T> {
            id: uid,
            issuer:          ctx.sender(),
            executor:        option::none(),
            transferable,
            mission_type,
            extra_data,
            solar_system_id,
            deadline_ms,
            reward:          into_balance(reward_coin),
            issuer_bond:     into_balance(bond_coin),
            status:          STATUS_OPEN,
            created_ms:      timestamp_ms(clock),
            accepted_ms:     option::none(),
            settled_ms:      option::none(),
            world_tx_proof:  option::none(),
        };

        event::emit(ContractCreatedEvent {
            contract_id: id,
            issuer: ctx.sender(),
            mission_type,
            extra_data: contract.extra_data,
            solar_system_id,
            deadline_ms,
            reward_amount,
            bond_amount,
            transferable,
        });

        transfer::share_object(contract);
    }

    // ── Accept ─────────────────────────────────────────────────────────────
    public fun accept<T>(
        contract: &mut MercenaryContract<T>,
        clock:    &Clock,
        ctx:      &mut TxContext,
    ) {
        use sui::clock::timestamp_ms;

        assert!(contract.status == STATUS_OPEN, EAlreadyAccepted);
        assert!(timestamp_ms(clock) < contract.deadline_ms, EDeadlinePassed);

        let ts = timestamp_ms(clock);
        contract.executor    = option::some(ctx.sender());
        contract.status      = STATUS_ACTIVE;
        contract.accepted_ms = option::some(ts);

        event::emit(ContractAcceptedEvent {
            contract_id: object::uid_to_inner(&contract.id),
            executor:    ctx.sender(),
            accepted_ms: ts,
        });
    }

    // ── Settle (standard — single executor) ───────────────────────────────
    public fun settle<T>(
        contract:       &mut MercenaryContract<T>,
        success:        bool,
        world_tx_proof: vector<u8>,
        clock:          &Clock,
        ctx:            &mut TxContext,
    ) {
        use sui::coin::from_balance;
        use sui::clock::timestamp_ms;

        assert!(contract.status == STATUS_ACTIVE, ENotActive);

        let ts = timestamp_ms(clock);
        contract.status        = if (success) { STATUS_COMPLETED } else { STATUS_FAILED };
        contract.settled_ms    = option::some(ts);
        contract.world_tx_proof = option::some(world_tx_proof);

        let reward_amount = balance::value(&contract.reward);
        let reward = balance::split(&mut contract.reward, reward_amount);
        let bond_amount = balance::value(&contract.issuer_bond);
        let bond = balance::split(&mut contract.issuer_bond, bond_amount);

        let executor = *option::borrow(&contract.executor);

        if (success) {
            transfer::public_transfer(from_balance(reward, ctx), executor);
            transfer::public_transfer(from_balance(bond, ctx), contract.issuer);
        } else {
            transfer::public_transfer(from_balance(reward, ctx), contract.issuer);
            // Bond slashed on failure — MVP returns to issuer; treasury module post-launch
            transfer::public_transfer(from_balance(bond, ctx), contract.issuer);
        };

        event::emit(ContractSettledEvent {
            contract_id: object::uid_to_inner(&contract.id),
            executor,
            success,
            settled_ms: ts,
        });
    }

    // ── Settle tiered (bounty/war — multiple contributors) ────────────────
    //
    // Reward is split among `executors` according to `shares_bps` (basis points).
    // shares_bps must sum to exactly 10000 (= 100%).
    //
    // Example bounty split:
    //   executors   = [scout_addr, tackler_addr, killer_addr]
    //   shares_bps  = [1000,       2000,          7000]        // 10+20+70 = 100%
    //
    // Only valid for BOUNTY (7) and PATROL_ZONE (4) contracts.
    //
    public fun settle_tiered<T>(
        contract:       &mut MercenaryContract<T>,
        executors:      vector<address>,
        shares_bps:     vector<u64>,
        world_tx_proof: vector<u8>,
        clock:          &Clock,
        ctx:            &mut TxContext,
    ) {
        use sui::coin::from_balance;
        use sui::clock::timestamp_ms;

        assert!(contract.status == STATUS_ACTIVE, ENotActive);
        assert!(
            contract.mission_type == MISSION_BOUNTY ||
            contract.mission_type == MISSION_PATROL_ZONE,
            EWrongMissionType
        );

        let n = vector::length(&executors);
        assert!(n == vector::length(&shares_bps), ESharesMismatch);

        // Validate shares sum to 10000 bps
        let mut total: u64 = 0;
        let mut i = 0;
        while (i < n) {
            total = total + *vector::borrow(&shares_bps, i);
            i = i + 1;
        };
        assert!(total == 10000, ESharesNotFull);

        let ts = timestamp_ms(clock);
        contract.status        = STATUS_COMPLETED;
        contract.settled_ms    = option::some(ts);
        contract.world_tx_proof = option::some(world_tx_proof);

        // Return issuer bond
        let bond_amount = balance::value(&contract.issuer_bond);
        let bond = balance::split(&mut contract.issuer_bond, bond_amount);
        transfer::public_transfer(from_balance(bond, ctx), contract.issuer);

        // Split reward proportionally
        let total_reward = balance::value(&contract.reward);
        let mut j = 0;
        while (j < n) {
            let addr  = *vector::borrow(&executors, j);
            let share = *vector::borrow(&shares_bps, j);
            let amount = if (j == n - 1) {
                // Last recipient gets remainder to avoid rounding dust
                balance::value(&contract.reward)
            } else {
                (total_reward * share) / 10000
            };
            let payout = balance::split(&mut contract.reward, amount);
            transfer::public_transfer(from_balance(payout, ctx), addr);
            j = j + 1;
        };

        event::emit(ContractTieredSettledEvent {
            contract_id: object::uid_to_inner(&contract.id),
            executors,
            shares_bps,
            settled_ms: ts,
        });
    }

    // ── Transfer execution rights ──────────────────────────────────────────
    public fun transfer_execution_rights<T>(
        contract:     &mut MercenaryContract<T>,
        new_executor: address,
        ctx:          &mut TxContext,
    ) {
        assert!(contract.status == STATUS_ACTIVE, ENotActive);
        assert!(contract.transferable, EWrongMissionType);
        let current = option::extract(&mut contract.executor);
        assert!(current == ctx.sender(), ENotExecutor);

        event::emit(ContractTransferredEvent {
            contract_id:   object::uid_to_inner(&contract.id),
            from_executor: current,
            to_executor:   new_executor,
        });

        contract.executor = option::some(new_executor);
    }

    // ── Read accessors ─────────────────────────────────────────────────────
    public fun status<T>(c: &MercenaryContract<T>): u8                 { c.status }
    public fun issuer<T>(c: &MercenaryContract<T>): address            { c.issuer }
    public fun executor<T>(c: &MercenaryContract<T>): &Option<address> { &c.executor }
    public fun mission_type<T>(c: &MercenaryContract<T>): u8           { c.mission_type }
    public fun extra_data<T>(c: &MercenaryContract<T>): &vector<u8>    { &c.extra_data }
    public fun solar_system_id<T>(c: &MercenaryContract<T>): u64       { c.solar_system_id }
    public fun deadline_ms<T>(c: &MercenaryContract<T>): u64           { c.deadline_ms }
    public fun reward_amount<T>(c: &MercenaryContract<T>): u64         { balance::value(&c.reward) }
    public fun bond_amount<T>(c: &MercenaryContract<T>): u64           { balance::value(&c.issuer_bond) }
    public fun is_transferable<T>(c: &MercenaryContract<T>): bool      { c.transferable }

    // Expose mission type constants for verifier
    public fun mission_defend_base():    u8 { MISSION_DEFEND_BASE }
    public fun mission_destroy_target(): u8 { MISSION_DESTROY_TARGET }
    public fun mission_deliver_cargo():  u8 { MISSION_DELIVER_CARGO }
    public fun mission_patrol_zone():    u8 { MISSION_PATROL_ZONE }
    public fun mission_escort():         u8 { MISSION_ESCORT }
    public fun mission_scout():          u8 { MISSION_SCOUT }
    public fun mission_bounty():         u8 { MISSION_BOUNTY }
}
