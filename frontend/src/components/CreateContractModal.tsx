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
  const [systemId, setSystemId]   = useState<number | null>(null);
  const [rewardSui, setRewardSui] = useState("");
  const [bondSui,   setBondSui]   = useState("");
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
    const bondMist   = BigInt(Math.floor(parseFloat(bondSui)   * 1e9));
    const deadlineMs = BigInt(Date.now() + parseInt(deadlineDays) * 86_400_000);

    const tx = new Transaction();
    const [rc] = tx.splitCoins(tx.gas, [tx.pure.u64(rewardMist)]);
    const [bc] = tx.splitCoins(tx.gas, [tx.pure.u64(bondMist)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::contract::create`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [
        tx.pure.u8(missionType), tx.pure.vector("u8", []),
        tx.pure.u64(BigInt(systemId)), tx.pure.u64(deadlineMs),
        tx.pure.bool(transferable), rc, bc, tx.object(CLOCK_ID),
      ],
    });
    signAndExecute({ transaction: tx }, {
      onSuccess: () => onClose(),
      onError:   (e) => setError(e.message ?? "Transaction failed"),
    });
  }

  const lbl: React.CSSProperties = {
    display: "block", fontSize: 9, letterSpacing: "0.2em",
    color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border-vis)",
        width: "100%", maxWidth: 460,
        maxHeight: "92vh", overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{
          background: "var(--panel-raised)",
          borderBottom: "1px solid var(--border-vis)",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.22em", marginBottom: 3 }}>NEW CONTRACT</div>
            <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 700, letterSpacing: "0.08em" }}>ISSUE CONTRACT</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            color: "var(--text-dim)", fontSize: 18, padding: "2px 6px",
          }}>✕</button>
        </div>

        <div style={{ padding: "22px 20px 20px" }}>

          {/* Mission type */}
          <label style={lbl}>Mission Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
            {Object.entries(MISSION_TYPES).map(([k, v]) => (
              <button key={k} onClick={() => setMissionType(Number(k))} style={{
                padding: "9px 12px", textAlign: "left",
                background: missionType === Number(k) ? "var(--accent)" : "transparent",
                border: `1px solid ${missionType === Number(k) ? "transparent" : "var(--border-vis)"}`,
                color: missionType === Number(k) ? "#fff" : "var(--text-dim)",
                fontSize: 10, letterSpacing: "0.08em",
                fontFamily: "inherit", textTransform: "uppercase",
              }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Solar system */}
          <label style={lbl}>Solar System</label>
          <SystemInput
            value={systemName}
            onChange={(n, id) => { setSystemName(n); setSystemId(id); }}
          />

          {/* Reward + Bond side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Reward (SUI)</label>
              <input type="number" min="0" step="0.1" placeholder="1.0" style={{ marginBottom: 16 }}
                value={rewardSui} onChange={e => setRewardSui(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Bond (SUI)</label>
              <input type="number" min="0" step="0.1" placeholder="0.5" style={{ marginBottom: 16 }}
                value={bondSui} onChange={e => setBondSui(e.target.value)} />
            </div>
          </div>

          {/* Deadline */}
          <label style={lbl}>Deadline (Days)</label>
          <input type="number" min="1" max="30" style={{ marginBottom: 16 }}
            value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />

          {/* Transferable checkbox */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", marginBottom: 20,
            border: "1px solid var(--border-vis)",
            background: transferable ? "var(--accent-dim)" : "transparent",
            cursor: "pointer",
          }}
          onClick={() => setTransferable(!transferable)}
          >
            <div style={{
              width: 14, height: 14, flexShrink: 0,
              border: `1px solid ${transferable ? "var(--accent)" : "var(--border-vis)"}`,
              background: transferable ? "var(--accent)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {transferable && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 10, color: transferable ? "var(--text)" : "var(--text-dim)", letterSpacing: "0.1em" }}>
              TRANSFERABLE EXECUTION RIGHTS
            </span>
          </div>

          <div style={{ borderTop: "1px solid var(--border-vis)", marginBottom: 18 }} />

          {error && (
            <div style={{
              fontSize: 10, color: "#ff6b6b",
              border: "1px solid rgba(255,107,107,0.35)",
              padding: "9px 12px", marginBottom: 16,
              letterSpacing: "0.05em",
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary"
            style={{ width: "100%", padding: 12, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em" }}
          >
            {isPending ? "BROADCASTING..." : "ISSUE CONTRACT"}
          </button>
        </div>
      </div>
    </div>
  );
}
