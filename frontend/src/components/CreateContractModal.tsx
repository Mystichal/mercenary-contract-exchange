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
    const bondMist = BigInt(Math.floor(parseFloat(bondSui) * 1e9));
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
      onError: (e) => setError(e.message ?? "Transaction failed"),
    });
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-text">
            <div className="modal-header-label">New Contract</div>
            <div className="modal-header-title">Issue Contract</div>
          </div>
          <button className="btn-ghost" onClick={onClose}
            style={{ fontSize: 18, padding: "4px 8px" }}>
            {"\u2715"}
          </button>
        </div>

        <div className="modal-body">

          {/* Mission type */}
          <div className="field">
            <label className="field-label">Mission Type</label>
            <div className="mission-grid">
              {Object.entries(MISSION_TYPES).map(([k, v]) => (
                <button key={k}
                  className={`mission-option${missionType === Number(k) ? " selected" : ""}`}
                  onClick={() => setMissionType(Number(k))}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Solar system */}
          <div className="field">
            <label className="field-label">Solar System</label>
            <SystemInput
              value={systemName}
              onChange={(n, id) => { setSystemName(n); setSystemId(id); }}
            />
          </div>

          {/* Reward + Bond */}
          <div className="field">
            <div className="field-row">
              <div>
                <label className="field-label">Reward (SUI)</label>
                <input type="number" min="0" step="0.1" placeholder="1.0"
                  value={rewardSui} onChange={e => setRewardSui(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Bond (SUI)</label>
                <input type="number" min="0" step="0.1" placeholder="0.5"
                  value={bondSui} onChange={e => setBondSui(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div className="field">
            <label className="field-label">Deadline (Days)</label>
            <input type="number" min="1" max="30"
              value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />
          </div>

          {/* Transferable */}
          <div className={`checkbox-field${transferable ? " checked" : ""}`}
            onClick={() => setTransferable(!transferable)}>
            <div className="checkbox-box">
              {transferable && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>{"\u2713"}</span>}
            </div>
            <span className="checkbox-label">Transferable Execution Rights</span>
          </div>

          <div className="modal-divider" />

          {error && <div className="error-msg">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary"
            style={{ width: "100%", padding: "12px", fontSize: 12, letterSpacing: "0.14em" }}
          >
            {isPending ? "Broadcasting..." : "Issue Contract"}
          </button>
        </div>
      </div>
    </div>
  );
}
