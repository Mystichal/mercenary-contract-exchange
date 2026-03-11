"use client";
import { useState, useEffect } from "react";
import { useSuiClientQuery, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
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
  return name || (id ? `#${id}` : "Unknown");
}

// ── Single contract card (hooks at top level) ──────────────────────────────────
function ContractCard({ ev, onAccept }: {
  ev: { id: { txDigest: string }; parsedJson: unknown };
  onAccept: (contractId: string, coinType: string) => void;
}) {
  const account = useCurrentAccount();
  const p = ev.parsedJson as Record<string, unknown>;
  const mType = MISSION_TYPES[(p?.mission_type as number)] ?? MISSION_TYPES[2];
  const reward = p?.reward_amount ? (Number(p.reward_amount) / 1e9).toFixed(2) : "?";
  const systemName = useSystemName(p?.solar_system_id ? Number(p.solar_system_id) : undefined);

  return (
    <div style={{
      background: "rgba(74,158,255,0.05)",
      border: `1px solid rgba(74,158,255,0.15)`,
      borderLeft: `3px solid ${mType.color}`,
      borderRadius: 10, padding: "20px 24px",
      display: "flex", alignItems: "center", gap: 24,
    }}>
      {/* Mission type badge */}
      <div style={{
        background: `${mType.color}18`, border: `1px solid ${mType.color}44`,
        borderRadius: 6, padding: "6px 12px", whiteSpace: "nowrap",
        fontSize: 12, color: mType.color, fontWeight: 600,
      }}>
        {mType.label}
      </div>

      {/* Details */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
          {systemName}
        </div>
        <div style={{ fontSize: 12, color: "#8aafd4", fontFamily: "monospace" }}>
          {(p?.issuer as string)?.slice(0, 8)}...{(p?.issuer as string)?.slice(-6)}
        </div>
      </div>

      {/* Reward */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f0c040" }}>{reward} SUI</div>
        <div style={{ fontSize: 11, color: "#8aafd4" }}>reward</div>
      </div>

      {/* Accept button */}
      {account && p?.issuer !== account.address && (
        <button
          onClick={() => onAccept(ev.id.txDigest, "0x2::sui::SUI")}
          style={{
            background: "rgba(74,158,255,0.12)",
            border: "1px solid rgba(74,158,255,0.3)",
            color: "#4a9eff", borderRadius: 8, padding: "8px 20px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
          }}
        >
          Accept
        </button>
      )}
    </div>
  );
}

// ── Main list component ────────────────────────────────────────────────────────
interface Props { onCreateClick: () => void }

export default function ContractList({ onCreateClick }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const { data: events, refetch } = useSuiClientQuery("queryEvents", {
    query: { MoveEventType: `${PACKAGE_ID}::contract::ContractCreatedEvent` },
    limit: 50,
    order: "descending",
  });

  // Keep registry object for stats
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
    <div style={{ textAlign: "center", padding: 60, color: "#8aafd4" }}>Loading contracts...</div>
  );

  if (contracts.length === 0) return (
    <div style={{
      textAlign: "center", padding: 80,
      border: "1px dashed rgba(74,158,255,0.2)", borderRadius: 12, margin: "24px 0"
    }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚔️</div>
      <p style={{ color: "#8aafd4", marginBottom: 24 }}>No contracts yet. Be the first to issue one.</p>
      {account && (
        <button onClick={onCreateClick} style={{
          background: "rgba(74,158,255,0.12)", border: "1px solid rgba(74,158,255,0.3)",
          color: "#4a9eff", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14,
        }}>
          + Issue Contract
        </button>
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: "#8aafd4", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>
          Open Contracts ({contracts.length})
        </h3>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {contracts.map(ev => (
          <ContractCard key={ev.id.txDigest} ev={ev} onAccept={acceptContract} />
        ))}
      </div>
    </div>
  );
}
