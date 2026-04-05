"use client";
import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { PACKAGE_ID, MISSION_TYPES } from "@/lib/config";

/** Format a millisecond timestamp into a human-readable string */
function formatTs(tsMs: string | number | undefined): string {
  if (!tsMs) return "—";
  const d = new Date(Number(tsMs));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Shorten a hex ID like a contract or tx digest */
function shortId(id: string | undefined): string {
  if (!id) return "—";
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Extract contract_id from parsedJson — handles both string and {id:string} forms */
function extractContractId(p: Record<string, unknown>): string {
  const raw = p?.contract_id;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") return (raw as Record<string, string>).id ?? "";
  return "";
}

type TxRow = {
  key: string;
  eventType: "Created" | "Accepted" | "Settled";
  contractId: string;
  missionType: number;
  timestampMs: string | number | undefined;
};

interface EventItem {
  id: { txDigest: string; eventSeq: string };
  timestampMs?: string | null;
  parsedJson: unknown;
}

function useEventRows(
  eventType: "Created" | "Accepted" | "Settled",
  moveEventType: string,
  walletAddress: string | undefined,
  filterField: string | null,
): { rows: TxRow[]; isLoading: boolean; isError: boolean } {
  const { data, isLoading, isError } = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: moveEventType },
      limit: 50,
      order: "descending",
    },
    { enabled: !!walletAddress }
  );

  const events: EventItem[] = (data?.data ?? []) as EventItem[];

  const rows: TxRow[] = events
    .filter(ev => {
      if (!walletAddress) return false;
      const p = ev.parsedJson as Record<string, unknown>;
      if (filterField) {
        // filter to only events involving this wallet in the specified field
        return (p?.[filterField] as string) === walletAddress;
      }
      // For Settled — include if issuer OR executor matches
      return (
        (p?.issuer as string) === walletAddress ||
        (p?.executor as string) === walletAddress
      );
    })
    .map(ev => {
      const p = ev.parsedJson as Record<string, unknown>;
      return {
        key: `${ev.id.txDigest}-${ev.id.eventSeq}`,
        eventType,
        contractId: extractContractId(p),
        missionType: Number(p?.mission_type ?? 0),
        timestampMs: ev.timestampMs ?? undefined,
      };
    });

  return { rows, isLoading, isError };
}

const EVENT_COLORS: Record<string, string> = {
  Created: "var(--primary)",
  Accepted: "#4aff9e",
  Settled: "#f0c040",
};

const EVENT_ICONS: Record<string, string> = {
  Created: "⊕",
  Accepted: "⊙",
  Settled: "⊗",
};

export default function TransactionHistory() {
  const account = useCurrentAccount();
  const walletAddress = account?.address;

  const created = useEventRows(
    "Created",
    `${PACKAGE_ID}::contract::ContractCreatedEvent`,
    walletAddress,
    "issuer"
  );

  const accepted = useEventRows(
    "Accepted",
    `${PACKAGE_ID}::contract::ContractAcceptedEvent`,
    walletAddress,
    "executor"
  );

  const settled = useEventRows(
    "Settled",
    `${PACKAGE_ID}::contract::ContractSettledEvent`,
    walletAddress,
    null // match issuer OR executor
  );

  if (!walletAddress) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⧌</div>
        <div className="empty-state-text">Connect a wallet to view transaction history</div>
      </div>
    );
  }

  const isLoading = created.isLoading || accepted.isLoading || settled.isLoading;
  const isError = created.isError || accepted.isError || settled.isError;

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-bar"><span /><span /><span /><span /></div>
        <div className="loading-text">Fetching transaction history...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠</div>
        <div className="empty-state-text">Failed to load transaction history</div>
      </div>
    );
  }

  // Merge and sort descending by timestamp
  const allRows: TxRow[] = [
    ...created.rows,
    ...accepted.rows,
    ...settled.rows,
  ].sort((a, b) => {
    const ta = Number(a.timestampMs ?? 0);
    const tb = Number(b.timestampMs ?? 0);
    return tb - ta;
  });

  if (allRows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⧖</div>
        <div className="empty-state-text">No transactions found for this wallet</div>
      </div>
    );
  }

  return (
    <div>
      <div className="contract-table">
        <div className="contract-table-head">
          <span>Event</span>
          <span>Mission</span>
          <span>Contract ID</span>
          <span style={{ textAlign: "right" }}>Time</span>
        </div>
        {allRows.map(row => {
          const mType = MISSION_TYPES[row.missionType] ?? MISSION_TYPES[2];
          const color = EVENT_COLORS[row.eventType] ?? "var(--primary)";
          const icon = EVENT_ICONS[row.eventType] ?? "○";
          return (
            <div
              key={row.key}
              className="contract-row"
              style={{ gridTemplateColumns: "140px 1fr 1fr 120px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                  {row.eventType.toUpperCase()}
                </span>
              </div>
              <div className="contract-type" style={{ color: mType.color }}>
                {mType.label}
              </div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.04em",
              }}>
                {shortId(row.contractId)}
              </div>
              <div style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-dim)",
              }}>
                {formatTs(row.timestampMs)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
