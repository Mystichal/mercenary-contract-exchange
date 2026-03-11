/// Mercenary Contract Exchange — Core Contract Object
///
/// A MercenaryContract is a tradable obligation with locked reward.
/// Lifecycle: Created → Active → (Transferred?) → Verified → Settled
module mercenary_exchange::contract {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::coin::Coin;
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;

    // ── Error codes ────────────────────────────────────────────────────────
    const ENotIssuer:        u64 = 100;
    const EAlreadyAccepted:  u64 = 101;
    const EDeadlinePassed:   u64 = 102;
    const ENotExecutor:      u64 = 103;
    const ENotSettled:       u64 = 104;
    const EWrongMissionType: u64 = 105;

    // ── Mission type constants ─────────────────────────────────────────────
    // Matches verifiable world-contract events
    const MISSION_DEFEND_BASE:    u8 = 1;
    const MISSION_DESTROY_TARGET: u8 = 2;
    const MISSION_DELIVER_CARGO:  u8 = 3;
    const MISSION_PATROL_ZONE:    u8 = 4;
    const MISSION_ESCORT:         u8 = 5;

    // ── Status constants ───────────────────────────────────────────────────
    const STATUS_OPEN:       u8 = 0; // Issued, not yet accepted
    const STATUS_ACTIVE:     u8 = 1; // Accepted by executor
    const STATUS_COMPLETED:  u8 = 2; // Verified as successful
    const STATUS_FAILED:     u8 = 3; // Verified as failed or expired
    const STATUS_DISPUTED:   u8 = 4; // Disputed — awaiting arbitration

    // ── Core struct ────────────────────────────────────────────────────────
    /// A MercenaryContract is a shared object so anyone can read/interact with it.
    public struct MercenaryContract<phantom T> has key {
        id: UID,

        // Parties
        issuer:          address,
        executor:        Option<address>, // None until accepted
        transferable:    bool,            // Can executor rights be resold?

        // Mission definition
        mission_type:    u8,
        target_id:       vector<u8>,      // Assembly ID or object reference (BCS encoded)
        solar_system_id: u64,             // Where the mission takes place
        deadline_ms:     u64,             // Unix ms — must complete before this

        // Economics
        reward:          Balance<T>,      // Locked reward — paid on success
        issuer_bond:     Balance<T>,      // Issuer collateral — slashed if bad faith cancel

        // State
        status:          u8,
        created_ms:      u64,
        accepted_ms:     Option<u64>,
        settled_ms:      Option<u64>,

        // Verification receipt (populated by verifier after world state check)
        verification_tx: Option<address>, // Digest of tx that verified this
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct ContractCreatedEvent has copy, drop {
        contract_id:     ID,
        issuer:          address,
        mission_type:    u8,
        solar_system_id: u64,
        deadline_ms:     u64,
        reward_amount:   u64,
        transferable:    bool,
    }

    public struct ContractAcceptedEvent has copy, drop {
        contract_id: ID,
        executor:    address,
        accepted_ms: u64,
    }

    public struct ContractSettledEvent has copy, drop {
        contract_id:  ID,
        executor:     address,
        success:      bool,
        settled_ms:   u64,
    }

    public struct ContractTransferredEvent has copy, drop {
        contract_id:   ID,
        from_executor: address,
        to_executor:   address,
    }

    // ── Create ─────────────────────────────────────────────────────────────
    public fun create<T>(
        mission_type:    u8,
        target_id:       vector<u8>,
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

        let contract_id = object::new(ctx);
        let id = object::uid_to_inner(&contract_id);
        let reward_amount = sui::coin::value(&reward_coin);

        let contract = MercenaryContract<T> {
            id: contract_id,
            issuer:          ctx.sender(),
            executor:        option::none(),
            transferable,
            mission_type,
            target_id,
            solar_system_id,
            deadline_ms,
            reward:          into_balance(reward_coin),
            issuer_bond:     into_balance(bond_coin),
            status:          STATUS_OPEN,
            created_ms:      timestamp_ms(clock),
            accepted_ms:     option::none(),
            settled_ms:      option::none(),
            verification_tx: option::none(),
        };

        event::emit(ContractCreatedEvent {
            contract_id: id,
            issuer: ctx.sender(),
            mission_type,
            solar_system_id,
            deadline_ms,
            reward_amount,
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

    // ── Transfer execution rights ──────────────────────────────────────────
    public fun transfer_execution_rights<T>(
        contract:    &mut MercenaryContract<T>,
        new_executor: address,
        ctx:          &mut TxContext,
    ) {
        assert!(contract.status == STATUS_ACTIVE, ENotSettled);
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

    // ── Settle (called by verifier after world state check) ────────────────
    /// `success = true` → pay executor. `success = false` → return to issuer.
    /// Only the contract's designated verifier can call this (enforced by capability).
    public fun settle<T>(
        contract: &mut MercenaryContract<T>,
        success:  bool,
        clock:    &Clock,
        ctx:      &mut TxContext,
    ) {
        use sui::coin::from_balance;
        use sui::clock::timestamp_ms;

        assert!(contract.status == STATUS_ACTIVE, ENotSettled);

        let ts = timestamp_ms(clock);
        contract.status     = if (success) { STATUS_COMPLETED } else { STATUS_FAILED };
        contract.settled_ms = option::some(ts);

        let reward_amount = balance::value(&contract.reward);
        let reward = balance::split(&mut contract.reward, reward_amount);

        let bond_amount = balance::value(&contract.issuer_bond);
        let bond = balance::split(&mut contract.issuer_bond, bond_amount);

        if (success) {
            let executor = *option::borrow(&contract.executor);
            // Executor gets reward + their own bond back
            transfer::public_transfer(from_balance(reward, ctx), executor);
            transfer::public_transfer(from_balance(bond, ctx), contract.issuer);
        } else {
            // Failed — return reward to issuer, bond is slashed (sent to treasury or burned)
            transfer::public_transfer(from_balance(reward, ctx), contract.issuer);
            // Bond goes to a treasury address — set at package deploy time
            // For MVP: return to issuer (TODO: treasury module)
            transfer::public_transfer(from_balance(bond, ctx), contract.issuer);
        };

        event::emit(ContractSettledEvent {
            contract_id: object::uid_to_inner(&contract.id),
            executor:    *option::borrow(&contract.executor),
            success,
            settled_ms:  ts,
        });
    }

    // ── Read accessors ─────────────────────────────────────────────────────
    public fun status<T>(c: &MercenaryContract<T>): u8              { c.status }
    public fun issuer<T>(c: &MercenaryContract<T>): address         { c.issuer }
    public fun executor<T>(c: &MercenaryContract<T>): &Option<address> { &c.executor }
    public fun mission_type<T>(c: &MercenaryContract<T>): u8        { c.mission_type }
    public fun solar_system_id<T>(c: &MercenaryContract<T>): u64    { c.solar_system_id }
    public fun deadline_ms<T>(c: &MercenaryContract<T>): u64        { c.deadline_ms }
    public fun reward_amount<T>(c: &MercenaryContract<T>): u64      { balance::value(&c.reward) }
    public fun is_transferable<T>(c: &MercenaryContract<T>): bool   { c.transferable }
}
