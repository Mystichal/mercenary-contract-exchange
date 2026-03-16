"use client";
import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import SystemInput from "./SystemInput";

interface Props { onClose: () => void }

const label: React.CSSProperties = {
  display: "block", fontSize: 9, letterSpacing: "0.2em",
  color: "var(--text-dim)", marginBottom: 5, textTransform: "uppercase",
};
const input: React.CSSProperties = {
  width: "100%", padding: "9px 11px", marginBottom: 16,
  background: "var(--surface-input)", border: "1px solid var(--border-bright)",
  color: "var(--text-bright)", fontSize: 12, borderRadius: 0,
};
const row: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
};

export default function CreateContractModal({ onClose }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [missionType, setMissionType] = useState(2);
  const [systemName, setSystemName] = useState("");
  const [systemId, setSystemId] = useState<number | null>(null);
  const [rewardSui, setRewardSui] = useState("");
  const [bondSui, setBondSui] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [transferable, setTransferable] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit() {
    setError("");
    if (!account) return;
    if (!systemId || !rewardSui || !bondSui) {
      setError(!systemId ? "Select a solar system from the list" : "Fill in all fields");
      return;
    }
    const rewardMist = BigInt(Math.floor(parseFloat(rewardSui) * 1e9));
    const bondMist   = BigInt(Math.floor(parseFloat(bondSui) * 1e9));
    const deadlineMs = BigInt(Date.now() + parseInt(deadlineDays) * 24 * 60 * 60 * 1000);

    const tx = new Transaction();
    const [rewardCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(rewardMist)]);
    const [bondCoin]   = tx.splitCoins(tx.gas, [tx.pure.u64(bondMist)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::contract::create`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [
        tx.pure.u8(missionType), tx.pure.vector("u8", []),
        tx.pure.u64(BigInt(systemId)), tx.pure.u64(deadlineMs),
        tx.pure.bool(transferable), rewardCoin, bondCoin, tx.object(CLOCK_ID),
      ],
    });
    signAndExecute({ transaction: tx }, {
      onSuccess: () => onClose(),
      onError:   (e) => setError(e.message ?? "Transaction failed"),
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border-bright)",
        width: "100%", maxWidth: 460,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Panel header */}
        <div style={{
          background: "var(--panel-header)",
          borderBottom: "1px solid var(--border-bright)",
          padding: "12px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em", marginBottom: 2 }}>CONTRACT</div>
            <div style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 700, letterSpacing: "0.08em" }}>ISSUE CONTRACT</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-dim)",
            fontSize: 16, padding: "2px 6px", letterSpacing: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: "20px 18px 18px" }}>

          {/* Mission type */}
          <span style={label}>Mission Type</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 16 }}>
            {Object.entries(MISSION_TYPES).map(([k, v]) => (
              <button key={k} onClick={() => setMissionType(Number(k))} style={{
                padding: "8px 10px", textAlign: "left",
                background: missionType === Number(k) ? "var(--btn-fill)" : "var(--btn-secondary)",
                border: "none",
                color: "var(--text-bright)",
                opacity: missionType === Number(k) ? 1 : 0.55,
                fontSize: 10, letterSpacing: "0.08em",
              }}>
                {v.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Solar system */}
          <span style={label}>Solar System</span>
          <SystemInput value={systemName} onChange={(n, id) => { setSystemName(n); setSystemId(id); }} />

          {/* Reward + Bond */}
          <div style={row}>
            <div>
              <span style={label}>Reward (SUI)</span>
              <input style={input} type="number" min="0" step="0.1" placeholder="1.0"
                value={rewardSui} onChange={e => setRewardSui(e.target.value)} />
            </div>
            <div>
              <span style={label}>Bond (SUI)</span>
              <input style={input} type="number" min="0" step="0.1" placeholder="0.5"
                value={bondSui} onChange={e => setBondSui(e.target.value)} />
            </div>
          </div>

          {/* Deadline */}
          <span style={label}>Deadline (Days)</span>
          <input style={input} type="number" min="1" max="30"
            value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />

          {/* Transferable */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
            <div onClick={() => setTransferable(!transferable)} style={{
              width: 14, height: 14, flexShrink: 0,
              border: `1px solid ${transferable ? "var(--accent)" : "var(--border-bright)"}`,
              background: transferable ? "var(--btn-fill)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {transferable && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ ...label, marginBottom: 0 }}>TRANSFERABLE EXECUTION RIGHTS</span>
          </label>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border-bright)", marginBottom: 16 }} />

          {error && (
            <div style={{
              fontSize: 10, color: "var(--status-failed)", letterSpacing: "0.05em",
              border: "1px solid rgba(204,68,68,0.3)", padding: "8px 10px", marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isPending} style={{
            width: "100%",
            background: isPending ? "var(--btn-disabled)" : "var(--btn-fill)",
            border: "none",
            color: "var(--text-bright)",
            padding: "11px", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
            opacity: isPending ? 0.7 : 1,
            cursor: isPending ? "not-allowed" : "pointer",
          }}>
            {isPending ? "BROADCASTING..." : "ISSUE CONTRACT"}
          </button>
        </div>
      </div>
    </div>
  );
}
