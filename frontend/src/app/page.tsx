"use client";
import { useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import ContractList from "@/components/ContractList";
import CreateContractModal from "@/components/CreateContractModal";

const NAV_ITEMS = [
  { label: "CONTRACT BOARD", key: "board" },
  { label: "MY CONTRACTS",   key: "mine" },
  { label: "TRANSACTIONS",   key: "tx" },
];

export default function Home() {
  const account = useCurrentAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [activeNav, setActiveNav] = useState("board");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-mark">
            EVE<span style={{ color: "var(--primary)", margin: "0 2px" }}>:</span>MCE
          </span>
          <div className="app-logo-sep" />
          <span className="app-logo-sub">Mercenary Contract Exchange</span>
        </div>
        <ConnectButton />
      </header>

      <div style={{ display: "flex", flex: 1 }}>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <nav className="sidebar">
          {NAV_ITEMS.map(({ label, key }) => (
            <div
              key={key}
              className={`sidebar-item${activeNav === key ? " active" : ""}`}
              onClick={() => setActiveNav(key)}
            >
              <span className="nav-dot" />
              {label}
            </div>
          ))}
        </nav>

        {/* ── Main ─────────────────────────────────────────────────── */}
        <main className="main-content">
          <div className="page-header">
            <div className="page-breadcrumb">Contract Board</div>
            <div className="page-title-row">
              <h1 className="page-title">Open Contracts</h1>
              {account && (
                <button className="btn-primary" onClick={() => setShowCreate(true)}
                  style={{ padding: "9px 20px", fontSize: 10 }}>
                  + Issue Contract
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
