"use client";
import { useState, useEffect } from "react";
import { useSuiClientQuery, useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, REGISTRY_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import { SYSTEMS_API } from "@/lib/systems";

// ── System name hook ───────────────────────────────────────────────────────────
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
      })
      .catch(() => {});
  }, [id]);
  return name || (id ? `#${id}` : "—");
}

// ── Live status hook ───────────────────────────────────────────────────────────
function useLiveStatus(contractId: string | undefined): number | null {
  const [status, setStatus] = useState<number | null>(null);
  const client = useSuiClient();
  useEffect(() => {
    if (!contractId) return;
    client.getObject({ id: contractId, options: { showContent: true } })
      .then(obj => {
        const fields = (obj.data?.content as { fields?: Record<string, unknown> })?.fields ?? {};
        setStatus(Number(fields.status ?? 0));
      })
      .catch(() => setStatus(null));
  }, [contractId, client]);
  return status;
}

// ── Status display ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<number, string>  = { 0:"OPEN", 1:"ACTIVE", 2:"COMPLETED", 3:"FAILED", 4:"DISPUTED" };
const STATUS_COLOR: Record<number, string>  = {
  0: "var(--accent)",
  1: "#4aff9e",
  2: "var(--text-dim)",
  3: "#ff4a4a",
  4: "#c040f0",
};

// ── Contract card ──────────────────────────────────────────────────────────────
function ContractCard({ ev, onAccept }: {
  ev: { id: { txDigest: string }; parsedJson: unknown };
  onAccept: (contractId: string, coinType: string) => void;
}) {
  const account  = useCurrentAccount();
  const p        = ev.parsedJson as Record<string, unknown>;
  const rawId    = p?.contract_id;
  const contractId = typeof rawId === "string" ? rawId : (rawId as Record<string, string>)?.id ?? "";
  const mType    = MISSION_TYPES[(p?.mission_type as number)] ?? MISSION_TYPES[2];
  const reward   = p?.reward_amount ? (Number(p.reward_amount) / 1e9).toFixed(2) : "?";
  const systemName = useSystemName(p?.solar_system_id ? Number(p.solar_system_id) : undefined);
  const liveStatus = useLiveStatus(contractId);
  const statusLabel = liveStatus !== null ? (STATUS_LABEL[liveStatus] ?? "UNKNOWN") : "...";
  const statusColor = liveStatus !== null ? (STATUS_COLOR[liveStatus] ?? "var(--text-dim)") : "var(--text-muted)";

  const issuer = p?.issuer as string ?? "";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: `2px solid ${mType.color === "#4a9eff" ? "var(--accent)" : mType.color}`,
      padding: "18px 20px",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto auto",
      alignItems: "center",
      gap: 20,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
    onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
    >
      {/* Mission type */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
        padding: "4px 8px",
        background: "var(--olive-dim)",
        border: "1px solid var(--border-bright)",
        color: "var(--text-dim)",
        whiteSpace: "nowrap",
      }}>
        {mType.label.toUpperCase()}
      </div>

      {/* System + issuer */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text)", textTransform: "uppercase" }}>
          {systemName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
          {issuer.slice(0, 6)}...{issuer.slice(-4)}
        </div>
      </div>

      {/* Reward */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>
          {reward} SUI
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>REWARD</div>
      </div>

      {/* Status badge */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        padding: "4px 10px",
        border: `1px solid ${statusColor}44`,
        color: statusColor,
        whiteSpace: "nowrap",
        minWidth: 90,
        textAlign: "center",
      }}>
        {statusLabel}
      </div>

      {/* Accept */}
      {account && liveStatus === 0 ? (
        <button
          onClick={() => onAccept(contractId, "0x2::sui::SUI")}
          style={{
            background: "transparent",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--accent)"; }}
        >
          ACCEPT
        </button>
      ) : (
        <div style={{ width: 80 }} />
      )}
    </div>
  );
}

// ── Main list ──────────────────────────────────────────────────────────────────
interface Props { onCreateClick: () => void }

export default function ContractList({ onCreateClick }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const { data: events, refetch } = useSuiClientQuery("queryEvents", {
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  // Suppress unused warning — used for loading state
  const { isLoading } = useSuiClientQuery("getObject", {
    id: REGISTRY_ID,
    options: { showContent: true },
  });

  function acceptContract(contractId: string, coinType: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::contract::accept`,
      typeArguments: [coinType],
      arguments: [tx.object(contractId), tx.object(CLOCK_ID)],
    });
    signAndExecute({ transaction: tx }, { onSuccess: () => refetch() });
  }

  const contracts = events?.data ?? [];

  if (isLoading) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
      LOADING...
    </div>
  );

  if (contracts.length === 0) return (
    <div style={{
      textAlign: "center", padding: 80,
      border: "1px dashed var(--border)", margin: "24px 0",
    }}>
      <div style={{ fontSize: 28, marginBottom: 16, color: "var(--accent)" }}>◆</div>
      <p style={{ color: "var(--text-dim)", marginBottom: 24, letterSpacing: "0.05em" }}>
        NO CONTRACTS ISSUED
      </p>
      {account && (
        <button onClick={onCreateClick} style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          padding: "9px 20px",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
        }}>
          + ISSUE CONTRACT
        </button>
      )}
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      {contracts.map((ev, i) => (
        <div key={ev.id.txDigest} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <ContractCard ev={ev} onAccept={acceptContract} />
        </div>
      ))}
    </div>
  );
}
