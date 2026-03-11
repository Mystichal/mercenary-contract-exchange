"use client";
import { useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import ContractList from "@/components/ContractList";
import CreateContractModal from "@/components/CreateContractModal";

export default function Home() {
  const account = useCurrentAccount();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>

      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 0", borderBottom: "1px solid rgba(74,158,255,0.15)"
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#4a9eff", textTransform: "uppercase", marginBottom: 4 }}>
            EVE Frontier · Testnet
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
            Mercenary Contract Exchange
          </h1>
        </div>
        <ConnectButton style={{
          background: "rgba(74,158,255,0.12)",
          border: "1px solid rgba(74,158,255,0.3)",
          color: "#4a9eff",
          borderRadius: 8,
          padding: "10px 20px",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
        }} />
      </header>

      {/* Hero */}
      <section style={{ padding: "48px 0 32px", textAlign: "center" }}>
        <p style={{ fontSize: 13, letterSpacing: 3, color: "#4a9eff", textTransform: "uppercase", marginBottom: 16 }}>
          Missions as Financial Instruments
        </p>
        <h2 style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
          Issue. Execute. Settle.
        </h2>
        <p style={{ fontSize: 18, color: "#8aafd4", maxWidth: 560, margin: "0 auto 32px" }}>
          Pre-funded contracts verified by world state.
          No trust required.
        </p>
        {account && (
          <button onClick={() => setShowCreate(true)} style={{
            background: "#4a9eff",
            border: "none",
            color: "#050a12",
            borderRadius: 8,
            padding: "14px 32px",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            + Issue Contract
          </button>
        )}
      </section>

      {/* Contract list */}
      <ContractList onCreateClick={() => setShowCreate(true)} />

      {/* Create modal */}
      {showCreate && <CreateContractModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
