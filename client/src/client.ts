/**
 * Mercenary Contract Exchange — TypeScript Client
 *
 * Handles:
 *  - Reading contracts from chain (suix_queryEvents + object reads)
 *  - Creating / accepting / transferring contracts
 *  - Polling for world-contracts events to auto-verify missions
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiEvent } from "@mysten/sui/client";

// ── Config ─────────────────────────────────────────────────────────────────

// TODO: update these after deploying to hackathon network on March 11
export const CONFIG = {
    network:      "testnet" as const,
    packageId:    "0x2f0acb41d5b24aa14723c9f7b37cdb2d0bbd656b2b33556cc4a86f05d93c3150",
    registryId:   "0xcd3f021b4714ce7c4d462deb1579434c711fe914a12eecbb31a224ac75990bf1", // Shared
    verifierCapId: "0x8e169780b1d77fa865c894208577f8cf083f981ad89a4b79d46dfdb939131020",
    adminCapId:   "0x9faaee563c089942e75d48d12b30f1e08ebc638d3002b9bbea32b7bcf908fe2a",
    upgradeCap:   "0x55c965b220da6d2021c1600e5ba108de5c70fad0ad67d9f9e17f9d47fad53ec0",
    deployerAddress: "0x40589886ff1c4b7750ea8fa3df2bee8114dfeb7edf4aa6d86f7d20916c34fc85",
    deployTxDigest: "HtEo2BmHtBxQZs52TLvf9RtMWj1qaYW2QF823XwvHGhn",

    // EVE Frontier world-contracts — testnet_utopia deployment
    worldContractsPackage: "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75",

    // Poll interval for world event monitoring
    pollIntervalMs: 8_000,
};

// ── Client setup ───────────────────────────────────────────────────────────

export function createClient(): SuiClient {
    return new SuiClient({ url: getFullnodeUrl(CONFIG.network) });
}

// ── World Events Polling ───────────────────────────────────────────────────

/**
 * Poll suix_queryEvents for EVE Frontier world-contracts events.
 * Uses cursor-based pagination — maintains cursor between calls.
 *
 * Key events to monitor:
 *  - world::killmail::KillmailCreatedEvent   → proof of target destroyed
 *  - world::status::StatusChangedEvent       → proof of base status
 *  - world::inventory::ItemDepositedEvent    → proof of cargo delivered
 *  - world::gate::JumpEvent                  → player movement tracking
 */
export class WorldEventPoller {
    private client: SuiClient;
    private cursors: Map<string, string | null> = new Map();

    constructor(client: SuiClient) {
        this.client = client;
    }

    async pollEventType(eventType: string): Promise<SuiEvent[]> {
        const cursor = this.cursors.get(eventType) ?? null;
        const response = await this.client.queryEvents({
            query: { MoveEventType: `${CONFIG.worldContractsPackage}::${eventType}` },
            cursor: cursor ? { txDigest: cursor, eventSeq: "0" } : null,
            limit: 50,
            order: "ascending",
        });

        if (response.nextCursor) {
            this.cursors.set(eventType, response.nextCursor.txDigest);
        }

        return response.data;
    }

    async pollAllRelevantEvents(): Promise<{
        killmails: SuiEvent[];
        statusChanges: SuiEvent[];
        itemDeposits: SuiEvent[];
        jumps: SuiEvent[];
    }> {
        const [killmails, statusChanges, itemDeposits, jumps] = await Promise.all([
            this.pollEventType("killmail::KillmailCreatedEvent"),
            this.pollEventType("status::StatusChangedEvent"),
            this.pollEventType("inventory::ItemDepositedEvent"),
            this.pollEventType("gate::JumpEvent"),
        ]);
        return { killmails, statusChanges, itemDeposits, jumps };
    }
}

// ── Contract Interactions ──────────────────────────────────────────────────

/**
 * Create a new mercenary contract on-chain.
 *
 * @param missionType - Mission type constant (1=Defend, 2=Destroy, 3=Deliver, etc.)
 * @param targetId    - BCS-encoded assembly/object ID that is the mission target
 * @param solarSystemId - In-game solar system ID
 * @param deadlineMs  - Unix timestamp in ms when contract expires
 * @param transferable - Whether execution rights can be resold
 * @param rewardCoinId - Object ID of Coin<EVE> for reward
 * @param bondCoinId   - Object ID of Coin<EVE> for issuer bond
 * @param clockId      - Sui system clock (always 0x6)
 */
export function buildCreateContractTx(params: {
    missionType:    number;
    targetId:       Uint8Array;
    solarSystemId:  bigint;
    deadlineMs:     bigint;
    transferable:   boolean;
    rewardCoinId:   string;
    bondCoinId:     string;
    coinType:       string; // e.g. "0x2::sui::SUI" or EVE token type
}): Transaction {
    const tx = new Transaction();

    tx.moveCall({
        target: `${CONFIG.packageId}::contract::create`,
        typeArguments: [params.coinType],
        arguments: [
            tx.pure.u8(params.missionType),
            tx.pure.vector("u8", Array.from(params.targetId)),
            tx.pure.u64(params.solarSystemId),
            tx.pure.u64(params.deadlineMs),
            tx.pure.bool(params.transferable),
            tx.object(params.rewardCoinId),
            tx.object(params.bondCoinId),
            tx.object("0x6"), // Sui Clock
        ],
    });

    return tx;
}

export function buildAcceptContractTx(contractId: string, coinType: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
        target: `${CONFIG.packageId}::contract::accept`,
        typeArguments: [coinType],
        arguments: [
            tx.object(contractId),
            tx.object("0x6"),
        ],
    });
    return tx;
}

export function buildTransferExecutionRightsTx(
    contractId:   string,
    newExecutor:  string,
    coinType:     string,
): Transaction {
    const tx = new Transaction();
    tx.moveCall({
        target: `${CONFIG.packageId}::contract::transfer_execution_rights`,
        typeArguments: [coinType],
        arguments: [
            tx.object(contractId),
            tx.pure.address(newExecutor),
        ],
    });
    return tx;
}

// ── Event → Verification matching ─────────────────────────────────────────

/**
 * Given a world event, check if it proves that a specific contract's mission is complete.
 * Returns the Sui tx digest to submit as proof, or null if no match.
 */
export function matchEventToContract(
    event: SuiEvent,
    contract: {
        id: string;
        missionType: number;
        targetId: string;
        solarSystemId: bigint;
    },
): string | null {
    const data = event.parsedJson as Record<string, unknown>;

    // MISSION_DESTROY_TARGET (2): look for KillmailCreatedEvent with matching solar_system
    if (contract.missionType === 2 && event.type.includes("KillmailCreatedEvent")) {
        if (BigInt(data["solar_system_id"] as string) === contract.solarSystemId) {
            return event.id.txDigest;
        }
    }

    // MISSION_DEFEND_BASE (1): StatusChangedEvent where status=ONLINE for matching assembly
    if (contract.missionType === 1 && event.type.includes("StatusChangedEvent")) {
        // assembly_id in event matches our targetId and status is ONLINE
        // TODO: compare assembly_id bytes
        return event.id.txDigest;
    }

    // MISSION_DELIVER_CARGO (3): ItemDepositedEvent with matching assembly_id
    if (contract.missionType === 3 && event.type.includes("ItemDepositedEvent")) {
        // TODO: compare assembly_id bytes
        return event.id.txDigest;
    }

    return null;
}

// ── Read contracts from chain ──────────────────────────────────────────────

export async function getContractObject(client: SuiClient, contractId: string) {
    const obj = await client.getObject({
        id: contractId,
        options: { showContent: true },
    });
    return obj;
}

// ── Polling loop (auto-verification) ──────────────────────────────────────

/**
 * Start a polling loop that monitors world events and auto-verifies contracts.
 * In production this would run as a backend service.
 * For hackathon demo: run in the browser tab.
 */
export async function startAutoVerifier(
    client: SuiClient,
    activeContracts: Array<{ id: string; missionType: number; targetId: string; solarSystemId: bigint }>,
    onMatch: (contractId: string, proofTxDigest: string) => void,
): Promise<void> {
    const poller = new WorldEventPoller(client);

    const poll = async () => {
        try {
            const events = await poller.pollAllRelevantEvents();
            const allEvents = [
                ...events.killmails,
                ...events.statusChanges,
                ...events.itemDeposits,
                ...events.jumps,
            ];

            for (const event of allEvents) {
                for (const contract of activeContracts) {
                    const proof = matchEventToContract(event, contract);
                    if (proof) {
                        console.log(`Contract ${contract.id} verified by tx ${proof}`);
                        onMatch(contract.id, proof);
                    }
                }
            }
        } catch (err) {
            console.error("Poll error:", err);
        }
        setTimeout(poll, CONFIG.pollIntervalMs);
    };

    poll();
}
