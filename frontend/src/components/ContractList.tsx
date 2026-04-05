"use client";
import { useEffect } from "react";
import { useSuiClientQuery, useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, REGISTRY_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import { systemById } from "@/lib/systems";
import { getCharacterByWallet } from "@/lib/graphql";
import { useState } from "react";

function useSystemName(id: number | undefined): string {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    if (!id) return;
    systemById(id).then(s => { if (s) setName(s.name); });
  }, [id]);
  return name || (id ? `#${id}` : "—");
}

function useCharacter(walletAddress: string | undefined): string {
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    if (!walletAddress) return;
    getCharacterByWallet(walletAddress)
      .then(c => {
        if (!c) return;
        if (c.name) {
          setLabel(c.name);
        } else {
          setLabel(`${c.characterId.slice(0, 8)}…`);
        }
      })
      .catch(() => {});
  }, [walletAddress]);
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

function ContractRow({ ev, onAccept, isAccepting }: {
  ev: { id: { txDigest: string }; parsedJson: unknown };
  onAccept: (contractId: string) => void;
  isAccepting?: boolean;
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
  const isMyContract = !!(account?.address && account.address === issuer);
  // Can't accept your own contract
  const canAccept = isOpen && !isMyContract;

  return (
    <div className={`contract-row${isMyContract ? " is-mine" : ""}`}>
      <div className="contract-type" style={{ color: mType.color }}>{mType.label}</div>
      <div>
        <div className="contract-location">{systemName}</div>
        <div className="contract-issuer">{issuerLabel}</div>
        {isMyContract && <span className="mine-label">Issued by you</span>}
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
        {account && canAccept ? (
          <button
            className="btn-primary"
            onClick={() => onAccept(contractId)}
            disabled={isAccepting}
            style={{ padding: "6px 14px", fontSize: 9 }}
          >
            {isAccepting ? "…" : "Accept"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  onCreateClick: () => void;
  refreshKey?: number;
  filterMine?: boolean;
}

export default function ContractList({ onCreateClick, refreshKey, filterMine }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: events, refetch, isLoading, isError } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
      limit: 50,
      order: "descending",
    },
    {
      // Auto-poll every 10s so new contracts appear without refresh
      refetchInterval: 10_000,
    }
  );

  // Trigger immediate refetch when parent signals a new contract was created
  useEffect(() => {
    if (refreshKey) refetch();
  }, [refreshKey, refetch]);

  void useSuiClientQuery("getObject", { id: REGISTRY_ID, options: { showContent: true } });

  function acceptContract(contractId: string) {
    setAcceptError(null);
    setAcceptingId(contractId);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::contract::accept`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [tx.object(contractId), tx.object(CLOCK_ID)],
    });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setAcceptingId(null);
          refetch();
        },
        onError: (e) => {
          setAcceptingId(null);
          setAcceptError(e.message ?? "Transaction failed. Please try again.");
        },
      }
    );
  }

  const allContracts = events?.data ?? [];
  const contracts = filterMine && account
    ? allContracts.filter(ev => {
        const p = ev.parsedJson as Record<string, unknown>;
        return (p?.issuer as string) === account.address;
      })
    : allContracts;

  if (isLoading) return (
    <div className="loading-state">
      <div className="loading-bar"><span /><span /><span /><span /></div>
      <div className="loading-text">Scanning contracts...</div>
    </div>
  );

  if (isError) return (
    <div className="empty-state">
      <div className="empty-state-icon">⚠</div>
      <div className="empty-state-text">Failed to load contracts</div>
      <button className="btn-secondary" onClick={() => refetch()}
        style={{ padding: "8px 20px", fontSize: 10, marginTop: 4 }}>
        Retry
      </button>
    </div>
  );

  if (contracts.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon">⌂</div>
      <div className="empty-state-text">
        {filterMine ? "No contracts issued by you" : "No contracts found"}
      </div>
      {account && (
        <button className="btn-primary" onClick={onCreateClick}
          style={{ padding: "10px 24px", fontSize: 11 }}>
          + Issue Contract
        </button>
      )}
    </div>
  );

  return (
    <div>
      {acceptError && (
        <div className="error-toast">
          <div className="error-toast-icon">!</div>
          <span>{acceptError}</span>
        </div>
      )}
      <div className="contract-table">
        <div className="contract-table-head">
          <span>Mission</span>
          <span>Location / Issuer</span>
          <span style={{ textAlign: "right" }}>Reward</span>
          <span style={{ textAlign: "center" }}>Status</span>
          <span />
        </div>
        {contracts.map(ev => (
          <ContractRow
            key={ev.id.txDigest}
            ev={ev}
            onAccept={acceptContract}
            isAccepting={acceptingId === ((ev.parsedJson as Record<string, unknown>)?.contract_id as string)}
          />
        ))}
      </div>
    </div>
  );
}
