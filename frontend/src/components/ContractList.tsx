"use client";
import { useState, useEffect } from "react";
import { useSuiClientQuery, useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, REGISTRY_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import { SYSTEMS_API } from "@/lib/systems";
import { getCharacterByWallet } from "@/lib/graphql";

function useSystemName(id: number | undefined): string {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    if (!id) return;
    const offset = Math.max(0, id - 30000001);
    fetch(`${SYSTEMS_API}?limit=10&offset=${offset}`)
      .then(r => r.json())
      .then(d => {
        const sys = d.data?.find((s: { id: number; name: string }) => s.id === id);
        if (sys) setName(sys.name);
      }).catch(() => {});
  }, [id]);
  return name || (id ? `#${id}` : "\u2014");
}

/** Resolve a wallet address to an EVE character ID for display */
function useCharacter(walletAddress: string | undefined): string {
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    if (!walletAddress) return;
    getCharacterByWallet(walletAddress)
      .then(c => {
        if (c) setLabel(`${c.characterId.slice(0, 8)}…`);
      })
      .catch(() => {});
  }, [walletAddress]);
  // Fallback to shortened wallet if no character found
  return label || (walletAddress ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}` : "—");
}

function useLiveStatus(contractId: string | undefined): number | null {
  const [status, setStatus] = useState<number | null>(null);
  const client = useSuiClient();
  useEffect(() => {
    if (!contractId) return;
    client.getObject({ id: contractId, options: { showContent: true } })
      .then(obj => {
        const fields = (obj.data?.content as { fields?: Record<string, unknown> })?.fields ?? {};
        setStatus(Number(fields.status ?? 0));
      }).catch(() => setStatus(null));
  }, [contractId, client]);
  return status;
}

const STATUS_LABEL: Record<number, string> = { 0: "OPEN", 1: "ACTIVE", 2: "COMPLETED", 3: "FAILED", 4: "DISPUTED" };
const STATUS_CLASS: Record<number, string> = { 0: "open", 1: "active", 2: "completed", 3: "failed", 4: "disputed" };

// ── Contract Row ────────────────────────────────────────────────────────────────
function ContractRow({ ev, onAccept }: {
  ev: { id: { txDigest: string }; parsedJson: unknown };
  onAccept: (contractId: string) => void;
}) {
  const account = useCurrentAccount();
  const p = ev.parsedJson as Record<string, unknown>;
  const rawId = p?.contract_id;
  const contractId = typeof rawId === "string" ? rawId : (rawId as Record<string, string>)?.id ?? "";
  const mType = MISSION_TYPES[(p?.mission_type as number)] ?? MISSION_TYPES[2];
  const reward = p?.reward_amount ? (Number(p.reward_amount) / 1e9).toFixed(2) : "?";
  const systemName = useSystemName(p?.solar_system_id ? Number(p.solar_system_id) : undefined);
  const liveStatus = useLiveStatus(contractId);
  const issuer = p?.issuer as string ?? "";
  const issuerLabel = useCharacter(issuer);

  const statusLabel = liveStatus !== null ? (STATUS_LABEL[liveStatus] ?? "?") : "...";
  const statusClass = liveStatus !== null ? (STATUS_CLASS[liveStatus] ?? "") : "";
  const isOpen = liveStatus === 0;

  return (
    <div className="contract-row">
      <div className="contract-type">{mType.label}</div>

      <div>
        <div className="contract-location">{systemName}</div>
        <div className="contract-issuer">
          {issuerLabel}
        </div>
      </div>

      <div className="contract-reward">
        <div className="contract-reward-value">{reward}</div>
        <div className="contract-reward-unit">SUI</div>
      </div>

      <div className="contract-status">
        <span className={`status-badge ${statusClass}`}>
          <svg className="status-dot" viewBox="0 0 6 6" xmlns="http://www.w3.org/2000/svg">
            <circle cx="3" cy="3" r="3" />
          </svg>
          <span className="status-text">{statusLabel}</span>
        </span>
      </div>

      <div className="contract-action">
        {account && isOpen ? (
          <button className="btn-primary" onClick={() => onAccept(contractId)}
            style={{ padding: "6px 14px", fontSize: 9 }}>
            Accept
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────
interface Props { onCreateClick: () => void }

export default function ContractList({ onCreateClick }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const { data: events, refetch, isLoading } = useSuiClientQuery("queryEvents", {
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  void useSuiClientQuery("getObject", { id: REGISTRY_ID, options: { showContent: true } });

  function acceptContract(contractId: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::contract::accept`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [tx.object(contractId), tx.object(CLOCK_ID)],
    });
    signAndExecute({ transaction: tx }, { onSuccess: () => refetch() });
  }

  const contracts = events?.data ?? [];

  if (isLoading) return (
    <div className="loading-state">
      <div className="loading-bar">
        <span /><span /><span /><span />
      </div>
      <div className="loading-text">Scanning contracts...</div>
    </div>
  );

  if (contracts.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon">{"\u2302"}</div>
      <div className="empty-state-text">No contracts on board</div>
      {account && (
        <button className="btn-primary" onClick={onCreateClick}
          style={{ padding: "10px 24px", fontSize: 11 }}>
          + Issue Contract
        </button>
      )}
    </div>
  );

  return (
    <div className="contract-table">
      <div className="contract-table-head">
        <span>Mission</span>
        <span>Location / Issuer</span>
        <span style={{ textAlign: "right" }}>Reward</span>
        <span style={{ textAlign: "center" }}>Status</span>
        <span />
      </div>
      {contracts.map(ev => (
        <ContractRow key={ev.id.txDigest} ev={ev} onAccept={acceptContract} />
      ))}
    </div>
  );
}
