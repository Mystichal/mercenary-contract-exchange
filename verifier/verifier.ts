/**
 * Mercenary Contract Exchange — Auto-Verifier
 *
 * Polls EVE Frontier world events on Sui testnet.
 * When a world event matches an active contract's mission,
 * calls verify_and_settle to pay out the executor automatically.
 *
 * Run: node --experimental-strip-types verifier.ts
 *
 * Requires: VERIFIER_PRIVATE_KEY env var (base64 or bech32 Sui private key)
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { getAssemblyState } from "./graphql.ts";

// ── Config ────────────────────────────────────────────────────────────────────
const PACKAGE_ID    = "0x2f0acb41d5b24aa14723c9f7b37cdb2d0bbd656b2b33556cc4a86f05d93c3150";
const VERIFIER_CAP  = "0x8e169780b1d77fa865c894208577f8cf083f981ad89a4b79d46dfdb939131020";
const CLOCK_ID      = "0x6";
const WORLD_PKG     = "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75";
const COIN_TYPE     = "0x2::sui::SUI";
const POLL_MS       = 8_000;

// Mission type constants — must match contract.move
const MISSION_DESTROY = 2;
const MISSION_DEFEND  = 1;
const MISSION_DELIVER = 3;

// ── World event type strings ───────────────────────────────────────────────────
const EVENT_KILLMAIL  = `${WORLD_PKG}::killmail::KillmailCreatedEvent`;
const EVENT_STATUS    = `${WORLD_PKG}::status::StatusChangedEvent`;
const EVENT_DEPOSIT   = `${WORLD_PKG}::inventory::ItemDepositedEvent`;

// ── Setup ─────────────────────────────────────────────────────────────────────
const client = new SuiClient({ url: getFullnodeUrl("testnet") });

function loadKeypair(): Ed25519Keypair {
  const key = process.env.VERIFIER_PRIVATE_KEY;
  if (!key) {
    console.error("ERROR: Set VERIFIER_PRIVATE_KEY env var");
    process.exit(1);
  }
  return Ed25519Keypair.fromSecretKey(key);
}

// ── Contract discovery ─────────────────────────────────────────────────────────
interface ActiveContract {
  contractId: string;
  missionType: number;
  solarSystemId: bigint;
  executor: string | null;
  issuer: string;
  deadline: bigint;
}

async function fetchActiveContracts(): Promise<ActiveContract[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  const contracts: ActiveContract[] = [];
  for (const ev of events.data) {
    const p = ev.parsedJson as Record<string, unknown>;
    // contract_id comes from Move ID type — may be hex string or nested object
    const rawId = p.contract_id;
    const contractId = typeof rawId === "string" ? rawId
      : (rawId as Record<string, string>)?.id ?? "";
    if (!contractId) { console.log("[verifier] No contract_id in event:", p); continue; }

    // Fetch the live object to get current status + executor
    try {
      const obj = await client.getObject({ id: contractId, options: { showContent: true } });
      const fields = (obj.data?.content as { fields?: Record<string, unknown> })?.fields ?? {};
      const status = Number(fields.status ?? 0);

      // Watch OPEN (0) and ACTIVE (1) — skip settled/failed
      if (status > 1) continue;

      contracts.push({
        contractId,
        missionType:   Number(p.mission_type ?? 0),
        solarSystemId: BigInt(p.solar_system_id as string ?? "0"),
        executor:      (fields.executor as { fields?: { vec?: string[] } })?.fields?.vec?.[0] ?? null,
        issuer:        p.issuer as string,
        deadline:      BigInt(p.deadline_ms as string ?? "0"),
      });
    } catch {
      // Object might not exist yet, skip
    }
  }

  console.log(`[verifier] ${contracts.length} active contract(s) being watched`);
  return contracts;
}

// ── Event matching ─────────────────────────────────────────────────────────────
function matchesContract(
  eventType: string,
  eventData: Record<string, unknown>,
  contract: ActiveContract,
): boolean {
  // DESTROY_TARGET: KillmailCreatedEvent in same solar system
  if (contract.missionType === MISSION_DESTROY && eventType === EVENT_KILLMAIL) {
    const evSystem = BigInt((eventData.solar_system_id as string) ?? "0");
    return evSystem === contract.solarSystemId;
  }

  // DEFEND_BASE: StatusChangedEvent showing assembly is ONLINE in correct system
  if (contract.missionType === MISSION_DEFEND && eventType === EVENT_STATUS) {
    const evSystem = BigInt((eventData.solar_system_id as string) ?? "0");
    const status   = String(eventData.status ?? "");
    return evSystem === contract.solarSystemId && status.toLowerCase().includes("online");
  }

  // DELIVER_CARGO: ItemDepositedEvent — match by assembly/solar_system
  if (contract.missionType === MISSION_DELIVER && eventType === EVENT_DEPOSIT) {
    const evSystem = BigInt((eventData.solar_system_id as string) ?? "0");
    return evSystem === contract.solarSystemId;
  }

  return false;
}

// ── Settlement ────────────────────────────────────────────────────────────────
async function settle(
  contract: ActiveContract,
  proofTxDigest: string,
  success: boolean,
  keypair: Ed25519Keypair,
) {
  console.log(`[verifier] Settling contract ${contract.contractId} success=${success} proof=${proofTxDigest}`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::verifier::verify_and_settle`,
    typeArguments: [COIN_TYPE],
    arguments: [
      tx.object(contract.contractId),
      tx.pure.bool(success),
      tx.pure.vector("u8", Array.from(Buffer.from(proofTxDigest, "base64").slice(0, 32).padEnd(32, 0))),
      tx.object(CLOCK_ID),
      tx.object(VERIFIER_CAP),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  console.log(`[verifier] Settlement tx: ${result.digest} status: ${result.effects?.status?.status}`);
  return result;
}

// ── Direct state polling (DEFEND_BASE fallback) ───────────────────────────────
/**
 * For DEFEND_BASE contracts, the StatusChangedEvent may have fired before the
 * verifier started watching (e.g. assembly was already online when contract was
 * accepted). This polls the assembly object's live state via GraphQL as a fallback.
 *
 * Requires the contract's target_assembly_id field to be set.
 */
async function pollAssemblyState(
  contracts: ActiveContract[],
  keypair: Ed25519Keypair,
): Promise<void> {
  const defendContracts = contracts.filter(c => c.missionType === MISSION_DEFEND);
  if (!defendContracts.length) return;

  for (const contract of defendContracts) {
    const assemblyId = (contract as ActiveContract & { assemblyId?: string }).assemblyId;
    if (!assemblyId) continue;

    try {
      const state = await getAssemblyState(assemblyId);
      if (!state) continue;

      const systemMatch = state.solarSystemId === contract.solarSystemId;
      if (state.isOnline && systemMatch) {
        console.log(`[verifier] DEFEND_BASE match via GraphQL state poll — assembly ${assemblyId} is ONLINE`);
        await settle(contract, assemblyId, true, keypair);
        contracts.splice(contracts.indexOf(contract), 1);
      }
    } catch (e) {
      console.warn(`[verifier] Assembly state poll failed for ${assemblyId}:`, e);
    }
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────
async function poll(
  cursors: Map<string, string | null>,
  contracts: ActiveContract[],
  keypair: Ed25519Keypair,
) {
  const eventTypes = [EVENT_KILLMAIL, EVENT_STATUS, EVENT_DEPOSIT];

  for (const eventType of eventTypes) {
    const cursor = cursors.get(eventType) ?? null;
    let response;
    try {
      response = await client.queryEvents({
        query: { MoveEventType: eventType },
        cursor: cursor ? { txDigest: cursor, eventSeq: "0" } : null,
        limit: 50,
        order: "ascending",
      });
    } catch {
      continue;
    }

    if (response.nextCursor) {
      cursors.set(eventType, response.nextCursor.txDigest);
    }

    for (const ev of response.data) {
      const data = ev.parsedJson as Record<string, unknown>;
      for (const contract of contracts) {
        if (matchesContract(eventType, data, contract)) {
          console.log(`[verifier] MATCH: ${eventType} → contract ${contract.contractId}`);
          try {
            await settle(contract, ev.id.txDigest, true, keypair);
            // Remove from watch list after settlement
            contracts.splice(contracts.indexOf(contract), 1);
          } catch (e) {
            console.error(`[verifier] Settlement failed:`, e);
          }
        }
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Mercenary Contract Verifier ===");
  console.log(`Package:      ${PACKAGE_ID}`);
  console.log(`VerifierCap:  ${VERIFIER_CAP}`);
  console.log(`Poll interval: ${POLL_MS}ms`);

  const keypair  = loadKeypair();
  console.log(`Signer: ${keypair.getPublicKey().toSuiAddress()}`);

  const cursors: Map<string, string | null> = new Map();
  let contracts = await fetchActiveContracts();

  // Refresh contract list every 60 seconds
  let lastRefresh = Date.now();

  console.log("\nWatching for world events...\n");

  while (true) {
    try {
      // Event-based polling (all mission types)
      await poll(cursors, contracts, keypair);

      // Direct GraphQL state poll for DEFEND_BASE (catches already-online assemblies)
      await pollAssemblyState(contracts, keypair);

      // Refresh contract list every 15s to catch newly accepted contracts
      if (Date.now() - lastRefresh > 15_000) {
        contracts = await fetchActiveContracts();
        lastRefresh = Date.now();
      }
    } catch (e) {
      console.error("[verifier] Poll error:", e);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

main().catch(console.error);
