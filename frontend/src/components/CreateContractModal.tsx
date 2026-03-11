"use client";
import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
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

  // Get user's SUI coins for splitting
  const { data: coins } = useSuiClientQuery("getCoins", {
    owner: account?.address ?? "",
    coinType: "0x2::sui::SUI",
  }, { enabled: !!account });

  function handleCreate() {
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

    // Split reward and bond coins from gas
    const [rewardCoin] = tx.splitCoins(tx.gas, [rewardMist]);
    const [bondCoin]   = tx.splitCoins(tx.gas, [bondMist]);

    tx.moveCall({
      target: `${PACKAGE_ID}::contract::create`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [
        tx.pure.u8(missionType),
        tx.pure.vector("u8", []),        // target_id (empty for now)
        tx.pure.u64(BigInt(systemId ?? 0)),
        tx.pure.u64(deadlineMs),
        tx.pure.bool(transferable),
        rewardCoin,
        bondCoin,
        tx.object(CLOCK_ID),
      ],
    });

    signAndExecute({ transaction: tx }, {
      onSuccess: () => onClose(),
      onError: (e) => setError(e.message),
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0a1520", border: "1px solid rgba(74,158,255,0.3)",
        borderRadius: 16, padding: 36, width: "100%", maxWidth: 500,
      }}>
        <h2 style={{ color: "#fff", marginBottom: 8, fontSize: 22 }}>Issue Contract</h2>
        <p style={{ color: "#8aafd4", marginBottom: 28, fontSize: 14 }}>
          Reward is locked in escrow on-chain until mission is verified.
        </p>

        {/* Mission type */}
        <label style={labelStyle}>Mission Type</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.entries(MISSION_TYPES).map(([k, v]) => (
            <button key={k}
              onClick={() => setMissionType(Number(k))}
              style={{
                background: missionType === Number(k) ? `${v.color}22` : "transparent",
                border: `1px solid ${missionType === Number(k) ? v.color : "rgba(255,255,255,0.1)"}`,
                color: missionType === Number(k) ? v.color : "#8aafd4",
                borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13,
              }}
            >{v.label}</button>
          ))}
        </div>

        {/* Solar system */}
        <label style={labelStyle}>Solar System</label>
        <SystemInput value={systemName} onChange={(name, id) => { setSystemName(name); setSystemId(id); }} />

        {/* Reward */}
        <label style={labelStyle}>Reward (SUI)</label>
        <input style={inputStyle} placeholder="e.g. 10.0" type="number"
          value={rewardSui} onChange={e => setRewardSui(e.target.value)} />

        {/* Bond */}
        <label style={labelStyle}>Issuer Bond (SUI)</label>
        <input style={inputStyle} placeholder="e.g. 2.0" type="number"
          value={bondSui} onChange={e => setBondSui(e.target.value)} />

        {/* Deadline */}
        <label style={labelStyle}>Deadline (days)</label>
        <input style={inputStyle} placeholder="7" type="number"
          value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />

        {/* Transferable */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#8aafd4", fontSize: 14, marginBottom: 24, cursor: "pointer" }}>
          <input type="checkbox" checked={transferable} onChange={e => setTransferable(e.target.checked)} />
          Allow execution rights to be resold
        </label>

        {error && (
          <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#8aafd4", borderRadius: 8, padding: 14, cursor: "pointer", fontSize: 14,
          }}>Cancel</button>
          <button onClick={handleCreate} disabled={isPending} style={{
            flex: 2, background: isPending ? "rgba(74,158,255,0.3)" : "#4a9eff",
            border: "none", color: "#050a12", borderRadius: 8, padding: 14,
            cursor: isPending ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700,
          }}>
            {isPending ? "Signing..." : "Lock Reward & Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, letterSpacing: 1,
  color: "#8aafd4", textTransform: "uppercase", marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(74,158,255,0.2)", borderRadius: 8,
  color: "#e0eaf8", padding: "12px 14px", fontSize: 14,
  outline: "none", marginBottom: 20,
};
