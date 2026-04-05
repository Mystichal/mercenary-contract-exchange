"use client";
import { useState, useCallback } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import ContractList from "@/components/ContractList";
import CreateContractModal from "@/components/CreateContractModal";
import TransactionHistory from "@/components/TransactionHistory";

const NAV_ITEMS = [
  { label: "Contract Board", key: "board", breadcrumb: "Contract Board", title: "Open Contracts" },
  { label: "My Contracts",   key: "mine",  breadcrumb: "My Contracts",   title: "Issued by Me" },
  { label: "Transactions",   key: "tx",    breadcrumb: "Transactions",   title: "TX History" },
];

export default function Home() {
  const account = useCurrentAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [activeNav, setActiveNav] = useState("board");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setShowCreate(false);
    // Delay slightly to allow Sui indexer to process the event
    setTimeout(() => setRefreshKey(k => k + 1), 2000);
  }, []);

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
            <div className="page-breadcrumb">
              {NAV_ITEMS.find(n => n.key === activeNav)?.breadcrumb ?? "Contract Board"}
            </div>
            <div className="page-title-row">
              <h1 className="page-title">
                {NAV_ITEMS.find(n => n.key === activeNav)?.title ?? "Open Contracts"}
              </h1>
              {account && activeNav !== "tx" && (
                <button className="btn-primary" onClick={() => setShowCreate(true)}
                  style={{ padding: "9px 20px", fontSize: 10 }}>
                  + Issue Contract
                </button>
              )}
            </div>
          </div>

          {activeNav === "tx" ? (
            <TransactionHistory />
          ) : (
            <ContractList
              onCreateClick={() => setShowCreate(true)}
              refreshKey={refreshKey}
              filterMine={activeNav === "mine"}
            />
          )}
        </main>
      </div>

      {showCreate && (
        <CreateContractModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
}
