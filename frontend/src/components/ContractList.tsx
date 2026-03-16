"use client";
import { useState, useEffect } from "react";
import { useSuiClientQuery, useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, REGISTRY_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import { SYSTEMS_API } from "@/lib/systems";

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
  return name || (id ? `#${id}` : "—");
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
const STATUS_COLOR: Record<number, string> = {
  0: "var(--status-open)",
  1: "var(--status-active)",
  2: "var(--status-done)",
  3: "var(--status-failed)",
  4: "#c040f0",
};

// ── Contract Row ───────────────────────────────────────────────────────────────
function ContractRow({ ev, onAccept, isOdd }: {
  ev: { id: { txDigest: string }; parsedJson: unknown };
  onAccept: (contractId: string) => void;
  isOdd: boolean;
}) {
  const account  = useCurrentAccount();
  const p        = ev.parsedJson as Record<string, unknown>;
  const rawId    = p?.contract_id;
  const contractId = typeof rawId === "string" ? rawId : (rawId as Record<string, string>)?.id ?? "";
  const mType    = MISSION_TYPES[(p?.mission_type as number)] ?? MISSION_TYPES[2];
  const reward   = p?.reward_amount ? (Number(p.reward_amount) / 1e9).toFixed(2) : "?";
  const systemName = useSystemName(p?.solar_system_id ? Number(p.solar_system_id) : undefined);
  const liveStatus = useLiveStatus(contractId);
  const issuer   = p?.issuer as string ?? "";

  const statusLabel = liveStatus !== null ? (STATUS_LABEL[liveStatus] ?? "?") : "...";
  const statusColor = liveStatus !== null ? (STATUS_COLOR[liveStatus] ?? "var(--text-dim)") : "var(--text-muted)";
  const isOpen = liveStatus === 0;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr 80px 110px 90px",
      alignItems: "center",
      padding: "12px 20px",
      background: isOdd ? "var(--panel)" : "var(--panel-header)",
      borderBottom: "1px solid var(--border)",
      gap: 16,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = "var(--panel-hover)")}
    onMouseLeave={e => (e.currentTarget.style.background = isOdd ? "var(--panel)" : "var(--panel-header)")}
    >
      {/* Mission type */}
      <div style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: "0.1em" }}>
        {mType.label.toUpperCase()}
      </div>

      {/* Location + issuer */}
      <div>
        <div style={{ color: "var(--text-bright)", fontSize: 13, letterSpacing: "0.05em" }}>
          {systemName}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
          {issuer.slice(0, 8)}...{issuer.slice(-6)}
        </div>
      </div>

      {/* Reward */}
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "var(--text-bright)", fontSize: 13, fontWeight: 700 }}>{reward}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.1em" }}>SUI</div>
      </div>

      {/* Status */}
      <div style={{ textAlign: "center" }}>
        <span style={{
          fontSize: 10, letterSpacing: "0.12em", fontWeight: 700,
          color: statusColor,
          borderBottom: `1px solid ${statusColor}`,
          paddingBottom: 1,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Action */}
      <div style={{ textAlign: "right" }}>
        {account && isOpen ? (
          <button
            onClick={() => onAccept(contractId)}
            style={{
              background: "var(--btn-fill)",
              border: "1px solid var(--btn-border)",
              color: "var(--text-bright)",
              padding: "6px 14px",
              fontSize: 10,
              letterSpacing: "0.1em",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--btn-fill-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--btn-fill)")}
          >
            ACCEPT
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Table header ───────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr 80px 110px 90px",
      padding: "8px 20px",
      borderBottom: "1px solid var(--border-bright)",
      background: "var(--panel-header)",
      gap: 16,
    }}>
      {["MISSION", "LOCATION / ISSUER", "REWARD", "STATUS", ""].map((h, i) => (
        <div key={i} style={{
          fontSize: 9, letterSpacing: "0.18em", color: "var(--text-muted)",
          textAlign: i === 2 ? "right" : i === 3 ? "center" : "left",
        }}>{h}</div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
interface Props { onCreateClick: () => void }

export default function ContractList({ onCreateClick }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const { data: events, refetch, isLoading } = useSuiClientQuery("queryEvents", {
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  // Keep for registry stats (suppress lint by using variable)
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
    <div style={{ padding: "40px 0", color: "var(--text-muted)", letterSpacing: "0.15em", fontSize: 11 }}>
      LOADING...
    </div>
  );

  if (contracts.length === 0) return (
    <div style={{
      padding: "60px 40px", textAlign: "center",
      border: "1px solid var(--border-bright)",
      background: "var(--panel)",
    }}>
      <div style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: "0.15em", marginBottom: 20 }}>
        NO CONTRACTS ON BOARD
      </div>
      {account && (
        <button onClick={onCreateClick} style={{
          background: "var(--btn-fill)", border: "1px solid var(--btn-border)",
          color: "var(--text-bright)", padding: "9px 22px",
          fontSize: 11, letterSpacing: "0.1em",
        }}>
          + ISSUE CONTRACT
        </button>
      )}
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--border-bright)" }}>
      <TableHeader />
      {contracts.map((ev, i) => (
        <ContractRow key={ev.id.txDigest} ev={ev} onAccept={acceptContract} isOdd={i % 2 === 0} />
      ))}
    </div>
  );
}
