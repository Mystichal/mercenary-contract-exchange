"use client";
import { useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import ContractList from "@/components/ContractList";
import CreateContractModal from "@/components/CreateContractModal";

export default function Home() {
  const account = useCurrentAccount();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* Top nav — matches EVE Frontier header */}
      <header style={{
        borderBottom: "1px solid var(--border-vis)",
        padding: "0 32px",
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--nav)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text)" }}>
            EVE<span style={{ color: "var(--accent)" }}>⌇</span>MCE
          </span>
          <span style={{ color: "var(--border-vis)", fontSize: 10 }}>|</span>
          <span style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: "0.18em" }}>
            MERCENARY CONTRACT EXCHANGE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ConnectButton />
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>

        {/* Left nav — matches EVE Frontier sidebar */}
        <nav style={{
          width: 180, flexShrink: 0,
          background: "var(--nav)",
          borderRight: "1px solid var(--border-vis)",
          padding: "24px 0",
        }}>
          {[
            { label: "CONTRACT BOARD", active: true },
            { label: "MY CONTRACTS",   active: false },
            { label: "TRANSACTIONS",   active: false },
          ].map(({ label, active }) => (
            <div key={label} style={{
              padding: "10px 20px",
              borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
              background: active ? "var(--panel)" : "transparent",
              color: active ? "var(--text)" : "var(--text-dim)",
              fontSize: 10, letterSpacing: "0.14em",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "var(--accent)", fontSize: 8 }}>◆</span>
              {label}
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: "32px 36px", maxWidth: 960, overflow: "auto" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.22em", marginBottom: 6 }}>
              CONTRACT BOARD
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text)" }}>
                OPEN CONTRACTS
              </h1>
              {account && (
                <button
                  className="btn-primary"
                  onClick={() => setShowCreate(true)}
                  style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 700, padding: "9px 22px" }}
                >
                  + ISSUE CONTRACT
                </button>
              )}
            </div>
          </div>

          <ContractList onCreateClick={() => setShowCreate(true)} />
        </main>
      </div>

      {showCreate && <CreateContractModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
