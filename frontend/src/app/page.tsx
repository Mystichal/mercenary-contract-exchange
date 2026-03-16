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
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "var(--accent)", fontSize: 18, fontWeight: 700, letterSpacing: "0.12em" }}>
            ◆ MCE
          </span>
          <span style={{ color: "var(--border-bright)", fontSize: 12 }}>|</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: "0.1em" }}>
            MERCENARY CONTRACT EXCHANGE
          </span>
        </div>
        <ConnectButton />
      </header>

      {/* Hero */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        padding: "28px 32px 20px",
        background: `linear-gradient(180deg, rgba(255,71,0,0.03) 0%, transparent 100%)`,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <p style={{
              fontSize: 10, letterSpacing: "0.25em", color: "var(--accent)",
              textTransform: "uppercase", marginBottom: 6,
            }}>
              EVE FRONTIER — TESTNET
            </p>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--text)", marginBottom: 6,
            }}>
              MERCENARY CONTRACT EXCHANGE
            </h1>
            <p style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.6 }}>
              Issue missions as on-chain instruments. World-state events settle automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Main */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 32px 80px" }}>

        {/* Actions bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24,
        }}>
          <span style={{
            fontSize: 11, letterSpacing: "0.15em", color: "var(--text-dim)",
            textTransform: "uppercase",
          }}>
            ACTIVE CONTRACTS
          </span>
          {account && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}
            >
              + ISSUE CONTRACT
            </button>
          )}
        </div>

        <ContractList onCreateClick={() => setShowCreate(true)} />
      </main>

      {showCreate && <CreateContractModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
