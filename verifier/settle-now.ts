/**
 * settle-now.ts — Manual settlement trigger for testing
 *
 * Fetches all OPEN/ACTIVE contracts and settles the specified one as successful.
 * Simulates what the verifier does after a world event match.
 *
 * Usage:
 *   export VERIFIER_PRIVATE_KEY="<key>"
 *   npx tsx settle-now.ts <contract-id>
 *
 * If no contract-id is provided, settles the first active contract found.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// v2 — world-contracts v0.0.21
const PACKAGE_ID   = "0x769f425fddcdefa4877532aa773b23f4abcbd9f1abbd09183e8a972da609c781";
const VERIFIER_CAP = "0xa28a34ee2c05af1ca92618b5ae58001c4c296672d152c9e8f7cd1eee818c3438";
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

  if (targetId) {
    console.log(`Looking for contract: ${targetId}`);
  } else {
    console.log("No contract ID specified — finding first active contract...");
  }

  const contractId = await findActiveContract(targetId);
  if (!contractId) {
    console.error("No active contract found.");
    process.exit(1);
  }

  // Fake proof: 32 zero bytes — trust-based MVP, VerifierCap holder is trusted
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
