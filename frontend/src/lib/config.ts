// v2 deployment — world-contracts v0.0.21, Utopia UAT
// Values are read from environment variables with hardcoded fallbacks.
// Set NEXT_PUBLIC_* vars in .env.local (local dev) or .env (Docker).
export const PACKAGE_ID   = process.env.NEXT_PUBLIC_PACKAGE_ID   ?? "0x769f425fddcdefa4877532aa773b23f4abcbd9f1abbd09183e8a972da609c781";
export const REGISTRY_ID  = process.env.NEXT_PUBLIC_REGISTRY_ID  ?? "0x5bfe76bddf93f27668e999863ff9f10d2cbc69b1d7881c3305bbc407a23e087b";
export const CLOCK_ID     = process.env.NEXT_PUBLIC_CLOCK_ID      ?? "0x6";
export const NETWORK      = (process.env.NEXT_PUBLIC_NETWORK      ?? "testnet") as "testnet" | "mainnet" | "devnet" | "localnet";
export const WORLD_PKG    = process.env.NEXT_PUBLIC_WORLD_PKG     ?? "0x07e6b810c2dff6df56ea7fbad9ff32f4d84cbee53e496267515887b712924bd1";

export const MISSION_TYPES: Record<number, { label: string; event: string; color: string }> = {
  1: { label: "Defend Base",    event: "StatusChangedEvent",   color: "#4a9eff" },
  2: { label: "Destroy Target", event: "KillmailCreatedEvent", color: "#ff4a4a" },
  3: { label: "Deliver Cargo",  event: "ItemDepositedEvent",   color: "#4aff9e" },
  4: { label: "Patrol Zone",    event: "PatrolConfirmedEvent", color: "#f0c040" },
  5: { label: "Escort",         event: "EscortCompletedEvent", color: "#c040f0" },
  6: { label: "Scout",          event: "ScanResultEvent",      color: "#40f0c0" },
  7: { label: "Bounty",         event: "KillmailCreatedEvent", color: "#ff8c00" },
};

export const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Active",
  2: "Completed",
  3: "Failed",
  4: "Disputed",
};
