/// World State Verifier — reads EVE Frontier world events to verify mission completion.
///
/// This is the critical piece that connects smart contract settlement
/// to actual in-game events (KillmailCreatedEvent, StatusChangedEvent, etc.)
///
/// For hackathon MVP: a trusted VerifierCap holder submits proof.
/// Future: trustless verification via world-contracts event references.
module mercenary_exchange::verifier {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use sui::clock::Clock;
    use mercenary_exchange::contract::{Self, MercenaryContract};

    // ── Mission type constants (must match contract.move) ──────────────────
    const MISSION_DEFEND_BASE:    u8 = 1;
    const MISSION_DESTROY_TARGET: u8 = 2;
    const MISSION_DELIVER_CARGO:  u8 = 3;

    // ── Structs ────────────────────────────────────────────────────────────

    /// Trusted verifier capability.
    /// Holder can submit verification results.
    /// For MVP: issued to the hackathon deployer.
    /// Future: issued to a multi-sig or DAO.
    public struct VerifierCap has key, store { id: UID }

    public struct VerificationSubmittedEvent has copy, drop {
        contract_id:    ID,
        mission_type:   u8,
        success:        bool,
        /// The EVE world transaction that proves the outcome
        world_tx_proof: vector<u8>,
    }

    fun init(ctx: &mut TxContext) {
        let cap = VerifierCap { id: object::new(ctx) };
        transfer::transfer(cap, ctx.sender());
    }

    // ── Verify & Settle ────────────────────────────────────────────────────

    /// Submit a verification result for a mission.
    /// `world_tx_proof` is the Sui tx digest that contains the relevant
    /// world-contracts event (KillmailCreatedEvent, StatusChangedEvent, etc.)
    ///
    /// For MISSION_DESTROY_TARGET: proof must be a KillmailCreatedEvent tx.
    /// For MISSION_DEFEND_BASE:    proof must be a StatusChangedEvent tx showing base online.
    /// For MISSION_DELIVER_CARGO:  proof must be an ItemDepositedEvent tx.
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

        // Trigger settlement — moves funds to executor or returns to issuer
        contract::settle(contract, success, clock, ctx);
    }
}
