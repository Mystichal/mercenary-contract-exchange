"use client";
import { useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import ContractList from "@/components/ContractList";
import CreateContractModal from "@/components/CreateContractModal";

export default function Home() {
  const account = useCurrentAccount();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Top nav */}
      <header style={{
        borderBottom: "1px solid var(--border-bright)",
        padding: "0 32px",
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--panel-header)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 700, letterSpacing: "0.15em" }}>
            MCE
          </span>
          <span style={{ color: "var(--border-bright)", fontSize: 10 }}>◆</span>
          <span style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: "0.14em" }}>
            MERCENARY CONTRACT EXCHANGE
          </span>
          <span style={{ color: "var(--border-bright)", fontSize: 10 }}>◆</span>
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.1em" }}>
            TESTNET
          </span>
        </div>
        <ConnectButton />
      </header>

      {/* Page header */}
      <div style={{
        borderBottom: "1px solid var(--border-bright)",
        padding: "20px 32px",
        background: "var(--panel)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.2em", marginBottom: 4 }}>
              CONTRACT BOARD
            </div>
            <div style={{ fontSize: 18, color: "var(--text-bright)", fontWeight: 700, letterSpacing: "0.08em" }}>
              OPEN CONTRACTS
            </div>
          </div>
          {account && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: "var(--btn-fill)",
                border: "1px solid var(--btn-border)",
                color: "var(--text-bright)",
                padding: "9px 22px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--btn-fill-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--btn-fill)")}
            >
              + ISSUE CONTRACT
            </button>
          )}
        </div>
      </div>

      {/* Contract list */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 32px 80px" }}>
        <ContractList onCreateClick={() => setShowCreate(true)} />
      </main>

      {showCreate && <CreateContractModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
