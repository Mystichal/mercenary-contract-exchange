/**
 * Mercenary Contract Exchange — Auto-Verifier
 *
 * Polls EVE Frontier world events on Sui testnet.
 * When a world event matches an active contract's mission,
 * calls verify_and_settle to pay out the executor automatically.
 *
 * Run: npx tsx verifier.ts
 *
 * Requires: VERIFIER_PRIVATE_KEY env var (base64 or bech32 Sui private key)
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// ── Config ────────────────────────────────────────────────────────────────────
// v2 — world-contracts v0.0.21
const PACKAGE_ID    = "0x769f425fddcdefa4877532aa773b23f4abcbd9f1abbd09183e8a972da609c781";
const VERIFIER_CAP  = "0xa28a34ee2c05af1ca92618b5ae58001c4c296672d152c9e8f7cd1eee818c3438";
const CLOCK_ID      = "0x6";
// v0.0.21 Utopia published-at (use this for event type strings)
const WORLD_PKG     = "0x07e6b810c2dff6df56ea7fbad9ff32f4d84cbee53e496267515887b712924bd1";
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
const EVENT_JUMP      = `${WORLD_PKG}::gate::JumpEvent`;

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
  assemblyId?: string; // hex object ID, decoded from extra_data for DEFEND_BASE / DESTROY_TARGET
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

      const missionType = Number(p.mission_type ?? 0);

      // Decode extra_data: for DEFEND_BASE (1) and DESTROY_TARGET (2),
      // extra_data is BCS bytes of a u64 assembly_id → interpret as a Sui object address (hex)
      let assemblyId: string | undefined;
      const extraDataRaw = fields.extra_data ?? p.extra_data;
      if ((missionType === MISSION_DEFEND || missionType === MISSION_DESTROY) && extraDataRaw) {
        try {
          // extra_data arrives as array of numbers (bytes)
          const bytes = Array.isArray(extraDataRaw)
            ? (extraDataRaw as number[])
            : Object.values(extraDataRaw as Record<string, number>);
          if (bytes.length >= 8) {
            // BCS u64 is little-endian 8 bytes — but Sui object IDs are 32-byte hex addresses
            // If extra_data is 32 bytes it's a raw Sui address; if 8 bytes it's a u64 object ID
            const hex = bytes.length === 32
              ? '0x' + bytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
              : '0x' + [...bytes].reverse().map((b: number) => b.toString(16).padStart(2, '0')).join('').padStart(64, '0');
            assemblyId = hex;
          }
        } catch {
          // ignore decode errors
        }
      }

      contracts.push({
        contractId,
        missionType,
        solarSystemId: BigInt(p.solar_system_id as string ?? "0"),
        executor:      (fields.executor as { fields?: { vec?: string[] } })?.fields?.vec?.[0] ?? null,
        issuer:        p.issuer as string,
        deadline:      BigInt(p.deadline_ms as string ?? "0"),
        assemblyId,
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
    const evAssemblyId = String(
      (eventData.assembly_id as Record<string, string>)?.id ?? eventData.assembly_id ?? ""
    );
    if (contract.assemblyId) {
      return evAssemblyId.toLowerCase() === contract.assemblyId.toLowerCase();
    }
    const status = String(eventData.status ?? "");
    return status.toLowerCase().includes("online");
  }

  // DELIVER_CARGO: ItemDepositedEvent — match by assembly_id from extra_data
  if (contract.missionType === MISSION_DELIVER && eventType === EVENT_DEPOSIT) {
    if (contract.assemblyId) {
      const evAssemblyId = String(
        (eventData.assembly_id as Record<string, string>)?.id ?? eventData.assembly_id ?? ""
      );
      return evAssemblyId.toLowerCase() === contract.assemblyId.toLowerCase();
    }
    // Fallback: match by solar system (less precise)
    const evSystem = BigInt((eventData.solar_system_id as string) ?? "0");
    return evSystem === contract.solarSystemId;
  }

  // JumpEvent — currently not used for auto-settlement but logged
  if (eventType === EVENT_JUMP) {
    return false;
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

  // Convert tx digest (base58/base64) to 32-byte vector for on-chain proof
  let proofBytes: number[];
  try {
    // Sui tx digests are base58-encoded 32-byte hashes
    const buf = Buffer.from(proofTxDigest, "base64");
    proofBytes = Array.from(buf.subarray(0, 32));
    while (proofBytes.length < 32) proofBytes.push(0);
  } catch {
    proofBytes = new Array(32).fill(0);
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::verifier::verify_and_settle`,
    typeArguments: [COIN_TYPE],
    arguments: [
      tx.object(contract.contractId),
      tx.pure.bool(success),
      tx.pure.vector("u8", proofBytes),
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

// ── Polling loop ──────────────────────────────────────────────────────────────
async function poll(
  cursors: Map<string, string | null>,
  contracts: ActiveContract[],
  keypair: Ed25519Keypair,
) {
  const eventTypes = [EVENT_KILLMAIL, EVENT_STATUS, EVENT_DEPOSIT, EVENT_JUMP];

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
            const idx = contracts.indexOf(contract);
            if (idx !== -1) contracts.splice(idx, 1);
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
  console.log(`Package:       ${PACKAGE_ID}`);
  console.log(`VerifierCap:   ${VERIFIER_CAP}`);
  console.log(`Poll interval: ${POLL_MS}ms`);

  const keypair  = loadKeypair();
  console.log(`Signer: ${keypair.getPublicKey().toSuiAddress()}`);

  const cursors: Map<string, string | null> = new Map();
  let contracts = await fetchActiveContracts();

  let lastRefresh = Date.now();

  console.log("\nWatching for world events...\n");

  while (true) {
    try {
      await poll(cursors, contracts, keypair);

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
