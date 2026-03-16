/**
 * settle-now.ts — Manual settlement trigger for testing
 *
 * Fetches all OPEN/ACTIVE contracts and settles the first one as successful.
 * Simulates what the verifier does after a world event match.
 *
 * Usage:
 *   export VERIFIER_PRIVATE_KEY="<key>"
 *   node --experimental-strip-types settle-now.ts [contract-id]
 *
 * If no contract-id is provided, settles the first active contract found.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID   = "0x2f0acb41d5b24aa14723c9f7b37cdb2d0bbd656b2b33556cc4a86f05d93c3150";
const VERIFIER_CAP = "0x8e169780b1d77fa865c894208577f8cf083f981ad89a4b79d46dfdb939131020";
const CLOCK_ID     = "0x6";
const COIN_TYPE    = "0x2::sui::SUI";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

function loadKeypair(): Ed25519Keypair {
  const key = process.env.VERIFIER_PRIVATE_KEY;
  if (!key) { console.error("Set VERIFIER_PRIVATE_KEY"); process.exit(1); }
  return Ed25519Keypair.fromSecretKey(key);
}

async function findActiveContract(targetId?: string): Promise<string | null> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  for (const ev of events.data) {
    const p = ev.parsedJson as Record<string, unknown>;
    const rawId = p.contract_id;
    const contractId = typeof rawId === "string" ? rawId
      : (rawId as Record<string, string>)?.id ?? "";
    if (!contractId) continue;
    if (targetId && contractId !== targetId) continue;

    // Check status
    try {
      const obj = await client.getObject({ id: contractId, options: { showContent: true } });
      const fields = (obj.data?.content as { fields?: Record<string, unknown> })?.fields ?? {};
      const status = Number(fields.status ?? 99);
      if (status <= 1) {
        console.log(`Found contract: ${contractId} (status=${status})`);
        console.log(`  issuer:   ${p.issuer}`);
        console.log(`  system:   ${p.solar_system_id}`);
        console.log(`  mission:  ${p.mission_type}`);
        console.log(`  executor: ${JSON.stringify(fields.executor)}`);
        return contractId;
      }
    } catch (e) {
      console.warn(`  Could not fetch ${contractId}:`, e);
    }
  }
  return null;
}

async function main() {
  const keypair    = loadKeypair();
  const targetId   = process.argv[2];

  console.log(`Signer: ${keypair.getPublicKey().toSuiAddress()}`);

  const contractId = await findActiveContract(targetId);
  if (!contractId) {
    console.error("No active contract found.");
    process.exit(1);
  }

  // Fake proof: just use 32 zero bytes — this is a trust-based MVP,
  // the VerifierCap holder is trusted to only submit valid proofs
  const fakeProof = new Array(32).fill(0);

  console.log(`\nSettling ${contractId} as SUCCESS...`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::verifier::verify_and_settle`,
    typeArguments: [COIN_TYPE],
    arguments: [
      tx.object(contractId),
      tx.pure.bool(true),        // success = true
      tx.pure.vector("u8", fakeProof),
      tx.object(CLOCK_ID),
      tx.object(VERIFIER_CAP),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showEvents: true },
  });

  console.log(`\nTx digest: ${result.digest}`);
  console.log(`Status:    ${result.effects?.status?.status}`);

  if (result.effects?.status?.status === "success") {
    console.log("\n✅ Contract settled! Executor should have received the reward.");
  } else {
    console.error("\n❌ Settlement failed:", result.effects?.status?.error);
  }
}

main().catch(console.error);
