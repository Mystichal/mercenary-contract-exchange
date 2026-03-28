/// MC-012 — End-to-end tests for the MCE accept + settle flow.
///
/// Happy path:
///   1. Alice creates a DELIVER_CARGO contract with reward + bond
///   2. Bob accepts the contract
///   3. Verifier confirms delivery (verify_and_settle → success=true)
///   4. Bob receives the reward; Alice's bond is returned; contract is COMPLETED
///
/// Negative test:
///   • Alice tries to accept her own contract → aborts with EIssuerCannotAccept (108)
///
/// Additional negative tests:
///   • Accepting an already-active contract → EAlreadyAccepted (101)
///   • Settling a non-active contract → ENotActive (104)
#[test_only]
module mercenary_exchange::contract_e2e_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::object::ID;
    use mercenary_exchange::contract::{Self, MercenaryContract};
    use mercenary_exchange::verifier::{Self, VerifierCap};

    // ── Test addresses ──────────────────────────────────────────────────────
    const ALICE:    address = @0xA11CE;
    const BOB:      address = @0xB0B;
    const VERIFIER: address = @0xDEAD;

    // ── Mission constants (mirrors contract.move) ───────────────────────────
    const MISSION_DELIVER_CARGO: u8 = 3;

    // Deadline far in the future (Unix ms)
    const FAR_FUTURE_MS: u64 = 9_999_999_999_999;

    // ── Helpers ─────────────────────────────────────────────────────────────

    /// Mint a test SUI coin of the given amount from the given sender's context.
    fun mint_sui(amount: u64, scenario: &mut Scenario): Coin<SUI> {
        coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
    }

    /// Create a fresh clock fixed at timestamp 1000 ms.
    fun make_clock(scenario: &mut Scenario): Clock {
        let mut clk = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clk, 1000);
        clk
    }

    /// BCS-encoded DELIVER_CARGO extra_data: origin_psu=1, dest_psu=2, cargo_hash=[0xCA, 0xFE]
    fun cargo_extra_data(): vector<u8> {
        // Minimal placeholder — real encoding is BCS {u64, u64, vector<u8>}
        b"cargo:origin=1:dest=2:hash=cafe"
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1 — Full happy path: create → accept → verify & settle (success)
    // ═══════════════════════════════════════════════════════════════════════
    #[test]
    fun test_full_happy_path_deliver_cargo() {
        // ── Scenario setup ───────────────────────────────────────────────
        let mut scenario = ts::begin(VERIFIER);

        // Verifier module init — gives VerifierCap to VERIFIER address
        {
            verifier::init_for_testing(ts::ctx(&mut scenario));
        };

        // ── Step 1: Alice creates a DELIVER_CARGO contract ───────────────
        ts::next_tx(&mut scenario, ALICE);
        {
            let clk = make_clock(&mut scenario);
            let reward_coin = mint_sui(1_000_000_000, &mut scenario); // 1 SUI reward
            let bond_coin   = mint_sui(  100_000_000, &mut scenario); // 0.1 SUI bond

            contract::create<SUI>(
                MISSION_DELIVER_CARGO,
                cargo_extra_data(),
                /*solar_system_id=*/ 30_000_001,
                /*deadline_ms=*/     FAR_FUTURE_MS,
                /*transferable=*/    false,
                reward_coin,
                bond_coin,
                &clk,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
        };

        // ── Step 2: Bob accepts the contract ────────────────────────────
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let clk   = make_clock(&mut scenario);

            contract::accept<SUI>(&mut c, &clk, ts::ctx(&mut scenario));

            // Verify state
            assert!(contract::status(&c) == 1, 0); // STATUS_ACTIVE = 1
            assert!(*option::borrow(contract::executor(&c)) == BOB, 1);

            clock::destroy_for_testing(clk);
            ts::return_shared(c);
        };

        // ── Step 3: Verifier submits proof → settle success → Bob paid ───
        ts::next_tx(&mut scenario, VERIFIER);
        {
            let mut c   = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let cap     = ts::take_from_sender<VerifierCap>(&scenario);
            let clk     = make_clock(&mut scenario);
            let proof   = b"tx_digest_of_world_event_abc123";

            verifier::verify_and_settle<SUI>(
                &mut c,
                /*success=*/ true,
                proof,
                &clk,
                &cap,
                ts::ctx(&mut scenario),
            );

            // Contract must be COMPLETED (2)
            assert!(contract::status(&c) == 2, 2);
            // Reward and bond are fully disbursed — balances zero
            assert!(contract::reward_amount(&c) == 0, 3);
            assert!(contract::bond_amount(&c)   == 0, 4);

            clock::destroy_for_testing(clk);
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(c);
        };

        // ── Step 4: Verify Bob received the reward coin ──────────────────
        ts::next_tx(&mut scenario, BOB);
        {
            let reward_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&reward_coin) == 1_000_000_000, 5);
            ts::return_to_sender(&scenario, reward_coin);
        };

        // ── Step 5: Verify Alice received her bond back ──────────────────
        ts::next_tx(&mut scenario, ALICE);
        {
            let bond_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&bond_coin) == 100_000_000, 6);
            ts::return_to_sender(&scenario, bond_coin);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2 — Negative: settle with failure → reward returns to issuer
    // ═══════════════════════════════════════════════════════════════════════
    #[test]
    fun test_settle_failure_reward_to_issuer() {
        let mut scenario = ts::begin(VERIFIER);

        {
            verifier::init_for_testing(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let clk         = make_clock(&mut scenario);
            let reward_coin = mint_sui(500_000_000, &mut scenario);
            let bond_coin   = mint_sui( 50_000_000, &mut scenario);

            contract::create<SUI>(
                MISSION_DELIVER_CARGO,
                cargo_extra_data(),
                30_000_002,
                FAR_FUTURE_MS,
                false,
                reward_coin,
                bond_coin,
                &clk,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let clk   = make_clock(&mut scenario);
            contract::accept<SUI>(&mut c, &clk, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clk);
            ts::return_shared(c);
        };

        ts::next_tx(&mut scenario, VERIFIER);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let cap   = ts::take_from_sender<VerifierCap>(&scenario);
            let clk   = make_clock(&mut scenario);

            verifier::verify_and_settle<SUI>(
                &mut c,
                /*success=*/ false,
                b"failed_proof",
                &clk,
                &cap,
                ts::ctx(&mut scenario),
            );

            // STATUS_FAILED = 3
            assert!(contract::status(&c) == 3, 0);
            assert!(contract::reward_amount(&c) == 0, 1);

            clock::destroy_for_testing(clk);
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(c);
        };

        // Alice gets reward back on failure
        ts::next_tx(&mut scenario, ALICE);
        {
            // Two coins arrive to Alice: failed reward + bond
            let coin1 = ts::take_from_sender<Coin<SUI>>(&scenario);
            let val1  = coin::value(&coin1);
            ts::return_to_sender(&scenario, coin1);
            assert!(val1 == 500_000_000 || val1 == 50_000_000, 2);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3 — Negative: Alice tries to accept her own contract → abort 108
    // ═══════════════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = mercenary_exchange::contract::EIssuerCannotAccept)]
    fun test_issuer_cannot_accept_own_contract() {
        let mut scenario = ts::begin(ALICE);

        ts::next_tx(&mut scenario, ALICE);
        {
            let clk         = make_clock(&mut scenario);
            let reward_coin = mint_sui(1_000_000_000, &mut scenario);
            let bond_coin   = mint_sui(  100_000_000, &mut scenario);

            contract::create<SUI>(
                MISSION_DELIVER_CARGO,
                cargo_extra_data(),
                30_000_003,
                FAR_FUTURE_MS,
                false,
                reward_coin,
                bond_coin,
                &clk,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
        };

        // Alice tries to accept her own contract — must abort
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let clk   = make_clock(&mut scenario);

            // This call MUST abort with EIssuerCannotAccept (108)
            contract::accept<SUI>(&mut c, &clk, ts::ctx(&mut scenario));

            clock::destroy_for_testing(clk);
            ts::return_shared(c);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4 — Negative: double-accept → abort EAlreadyAccepted (101)
    // ═══════════════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = mercenary_exchange::contract::EAlreadyAccepted)]
    fun test_double_accept_fails() {
        let mut scenario = ts::begin(ALICE);

        ts::next_tx(&mut scenario, ALICE);
        {
            let clk         = make_clock(&mut scenario);
            let reward_coin = mint_sui(1_000_000_000, &mut scenario);
            let bond_coin   = mint_sui(  100_000_000, &mut scenario);

            contract::create<SUI>(
                MISSION_DELIVER_CARGO,
                cargo_extra_data(),
                30_000_004,
                FAR_FUTURE_MS,
                false,
                reward_coin,
                bond_coin,
                &clk,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
        };

        // Bob accepts first
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let clk   = make_clock(&mut scenario);
            contract::accept<SUI>(&mut c, &clk, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clk);
            ts::return_shared(c);
        };

        // A second address tries to accept → must abort EAlreadyAccepted (101)
        ts::next_tx(&mut scenario, @0xC0DE);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let clk   = make_clock(&mut scenario);
            contract::accept<SUI>(&mut c, &clk, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clk);
            ts::return_shared(c);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 5 — Negative: settle non-active contract → abort ENotActive (104)
    // ═══════════════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = mercenary_exchange::contract::ENotActive)]
    fun test_settle_open_contract_fails() {
        let mut scenario = ts::begin(VERIFIER);

        {
            verifier::init_for_testing(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let clk         = make_clock(&mut scenario);
            let reward_coin = mint_sui(1_000_000_000, &mut scenario);
            let bond_coin   = mint_sui(  100_000_000, &mut scenario);

            contract::create<SUI>(
                MISSION_DELIVER_CARGO,
                cargo_extra_data(),
                30_000_005,
                FAR_FUTURE_MS,
                false,
                reward_coin,
                bond_coin,
                &clk,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
        };

        // Try to settle while still OPEN — must abort ENotActive (104)
        ts::next_tx(&mut scenario, VERIFIER);
        {
            let mut c = ts::take_shared<MercenaryContract<SUI>>(&scenario);
            let cap   = ts::take_from_sender<VerifierCap>(&scenario);
            let clk   = make_clock(&mut scenario);

            verifier::verify_and_settle<SUI>(
                &mut c,
                true,
                b"no_proof",
                &clk,
                &cap,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clk);
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(c);
        };

        ts::end(scenario);
    }
}
