/// Contract Registry — shared global index of all active contracts.
/// Lets the TypeScript client discover contracts without an indexer.
module mercenary_exchange::registry {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;

    // ── Structs ────────────────────────────────────────────────────────────

    /// Singleton shared registry. Created once in init().
    public struct Registry has key {
        id:            UID,
        open_count:    u64,
        total_count:   u64,
        /// contract_id → metadata for quick lookup
        entries:       Table<ID, RegistryEntry>,
    }

    public struct RegistryEntry has store, copy, drop {
        contract_id:     ID,
        issuer:          address,
        mission_type:    u8,
        solar_system_id: u64,
        reward_amount:   u64,
        deadline_ms:     u64,
        status:          u8,
        transferable:    bool,
    }

    /// Admin capability — only holder can register/deregister contracts.
    /// Transferred to package deployer in init().
    public struct AdminCap has key, store { id: UID }

    public struct ContractRegisteredEvent has copy, drop {
        contract_id: ID,
        mission_type: u8,
        solar_system_id: u64,
        reward_amount: u64,
    }

    // ── Init ───────────────────────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        let registry = Registry {
            id:          object::new(ctx),
            open_count:  0,
            total_count: 0,
            entries:     table::new(ctx),
        };
        transfer::share_object(registry);

        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, ctx.sender());
    }

    // ── Register / Update ──────────────────────────────────────────────────

    public fun register(
        registry:        &mut Registry,
        contract_id:     ID,
        issuer:          address,
        mission_type:    u8,
        solar_system_id: u64,
        reward_amount:   u64,
        deadline_ms:     u64,
        transferable:    bool,
        _cap:            &AdminCap,
    ) {
        let entry = RegistryEntry {
            contract_id, issuer, mission_type, solar_system_id,
            reward_amount, deadline_ms, status: 0, transferable,
        };
        table::add(&mut registry.entries, contract_id, entry);
        registry.open_count  = registry.open_count + 1;
        registry.total_count = registry.total_count + 1;

        event::emit(ContractRegisteredEvent {
            contract_id, mission_type, solar_system_id, reward_amount,
        });
    }

    public fun update_status(
        registry:    &mut Registry,
        contract_id: ID,
        new_status:  u8,
        _cap:        &AdminCap,
    ) {
        let entry = table::borrow_mut(&mut registry.entries, contract_id);
        entry.status = new_status;
        if (new_status != 0) { // No longer open
            if (registry.open_count > 0) {
                registry.open_count = registry.open_count - 1;
            };
        };
    }

    // ── Read ───────────────────────────────────────────────────────────────
    public fun open_count(r: &Registry): u64   { r.open_count }
    public fun total_count(r: &Registry): u64  { r.total_count }
    public fun contains(r: &Registry, id: &ID): bool { table::contains(&r.entries, *id) }
    public fun entry(r: &Registry, id: &ID): &RegistryEntry { table::borrow(&r.entries, *id) }
}
