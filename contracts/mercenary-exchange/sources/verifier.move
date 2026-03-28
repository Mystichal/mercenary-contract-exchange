/// Mercenary Contract Exchange — World State Verifier
///
/// Connects on-chain settlement to EVE Frontier world events.
/// Trusted MVP: VerifierCap holder submits proof tx digest.
/// Future: trustless oracle referencing world-contracts events directly.
///
/// World event → contract type mapping:
///   KillmailCreatedEvent   → DESTROY_TARGET (2), BOUNTY (7)
///   StatusChangedEvent     → DEFEND_BASE (1)
///   ItemDepositedEvent     → DELIVER_CARGO (3)
///   ScanResultEvent        → SCOUT (6)
///   PatrolConfirmedEvent   → PATROL_ZONE (4)
///   EscortCompletedEvent   → ESCORT (5)
module mercenary_exchange::verifier {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use sui::clock::Clock;
    use mercenary_exchange::contract::{Self, MercenaryContract};

    // ── VerifierCap ────────────────────────────────────────────────────────
    /// Trusted verifier capability.
    /// MVP: issued to deployer.
    /// Future: multi-sig, DAO, or ZK oracle.
    public struct VerifierCap has key, store { id: UID }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct VerificationSubmittedEvent has copy, drop {
        contract_id:    ID,
        mission_type:   u8,
        success:        bool,
        world_tx_proof: vector<u8>,
    }

    public struct TieredVerificationSubmittedEvent has copy, drop {
        contract_id:    ID,
        mission_type:   u8,
        executors:      vector<address>,
        shares_bps:     vector<u64>,
        world_tx_proof: vector<u8>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(VerifierCap { id: object::new(ctx) }, ctx.sender());
    }

    /// Test-only init: allows tests to bootstrap a VerifierCap without deploying.
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    // ── Standard verify & settle ───────────────────────────────────────────
    //
    // Use for single-executor missions:
    //   DEFEND_BASE, DESTROY_TARGET, DELIVER_CARGO, PATROL_ZONE, ESCORT, SCOUT
    //
    // world_tx_proof: Sui tx digest (as bytes) of the world-contracts event
    //   that proves mission completion.
    //
    public fun verify_and_settle<T>(
        contract:       &mut MercenaryContract<T>,
        success:        bool,
        world_tx_proof: vector<u8>,
        clock:          &Clock,
        _cap:           &VerifierCap,
        ctx:            &mut TxContext,
    ) {
        let mission_type = contract::mission_type(contract);

        event::emit(VerificationSubmittedEvent {
            contract_id:    sui::object::id(contract),
            mission_type,
            success,
            world_tx_proof,
        });

        contract::settle(contract, success, world_tx_proof, clock, ctx);
    }

    // ── Tiered verify & settle ─────────────────────────────────────────────
    //
    // Use for multi-contributor missions: BOUNTY (7), PATROL_ZONE (4).
    //
    // executors:  ordered list of contributor addresses
    //             [scout_addr, tackler_addr, killer_addr]
    // shares_bps: basis-point share per contributor (must sum to 10000)
    //             [1000,       2000,          7000]
    //
    public fun verify_and_settle_tiered<T>(
        contract:       &mut MercenaryContract<T>,
        executors:      vector<address>,
        shares_bps:     vector<u64>,
        world_tx_proof: vector<u8>,
        clock:          &Clock,
        _cap:           &VerifierCap,
        ctx:            &mut TxContext,
    ) {
        let mission_type = contract::mission_type(contract);

        event::emit(TieredVerificationSubmittedEvent {
            contract_id: sui::object::id(contract),
            mission_type,
            executors,
            shares_bps,
            world_tx_proof,
        });

        contract::settle_tiered(
            contract,
            executors,
            shares_bps,
            world_tx_proof,
            clock,
            ctx,
        );
    }
}
