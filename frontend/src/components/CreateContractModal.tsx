"use client";
import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, CLOCK_ID, MISSION_TYPES } from "@/lib/config";
import SystemInput from "./SystemInput";

interface Props { onClose: () => void }

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
        tx.pure.u8(missionType),
        tx.pure.vector("u8", []),
        tx.pure.u64(BigInt(systemId ?? 0)),
        tx.pure.u64(deadlineMs),
        tx.pure.bool(transferable),
        rewardCoin,
        bondCoin,
        tx.object(CLOCK_ID),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => onClose(),
        onError:   (e) => setError(e.message ?? "Transaction failed"),
      }
    );
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    letterSpacing: "0.15em",
    color: "var(--text-dim)",
    marginBottom: 6,
    textTransform: "uppercase",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 18,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 13,
    borderRadius: 2,
  };

  const missionTypes = Object.entries(MISSION_TYPES).map(([k, v]) => ({ k: Number(k), ...v }));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border-bright)",
        width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em" }}>
            ◆ ISSUE CONTRACT
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-dim)",
            fontSize: 18, padding: "0 4px", letterSpacing: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 24px 20px" }}>

          {/* Mission type */}
          <label style={labelStyle}>Mission Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}>
            {missionTypes.map(({ k, label }) => (
              <button key={k} onClick={() => setMissionType(k)} style={{
                padding: "9px 12px",
                background: missionType === k ? "var(--accent-dim)" : "var(--surface-2)",
                border: missionType === k ? "1px solid var(--accent)" : "1px solid var(--border)",
                color: missionType === k ? "var(--accent)" : "var(--text-dim)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textAlign: "left",
              }}>
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Solar system */}
          <label style={labelStyle}>Solar System</label>
          <SystemInput value={systemName} onChange={(name, id) => { setSystemName(name); setSystemId(id); }} />

          {/* Reward */}
          <label style={labelStyle}>Reward (SUI)</label>
          <input style={inputStyle} type="number" min="0" step="0.1"
            placeholder="e.g. 1.0"
            value={rewardSui} onChange={e => setRewardSui(e.target.value)} />

          {/* Bond */}
          <label style={labelStyle}>Bond (SUI)</label>
          <input style={inputStyle} type="number" min="0" step="0.1"
            placeholder="e.g. 0.5"
            value={bondSui} onChange={e => setBondSui(e.target.value)} />

          {/* Deadline */}
          <label style={labelStyle}>Deadline (Days)</label>
          <input style={inputStyle} type="number" min="1" max="30"
            value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />

          {/* Transferable */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer" }}>
            <div
              onClick={() => setTransferable(!transferable)}
              style={{
                width: 16, height: 16,
                border: `1px solid ${transferable ? "var(--accent)" : "var(--border-bright)"}`,
                background: transferable ? "var(--accent)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {transferable && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
              TRANSFERABLE EXECUTION RIGHTS
            </span>
          </label>

          {error && (
            <div style={{
              fontSize: 11, color: "#ff4a4a",
              border: "1px solid rgba(255,74,74,0.3)",
              padding: "8px 12px", marginBottom: 16,
              letterSpacing: "0.05em",
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              width: "100%",
              background: isPending ? "var(--olive)" : "var(--accent)",
              border: "none",
              color: "#fff",
              padding: "12px",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.12em",
              opacity: isPending ? 0.7 : 1,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "BROADCASTING..." : "ISSUE CONTRACT"}
          </button>
        </div>
      </div>
    </div>
  );
}
