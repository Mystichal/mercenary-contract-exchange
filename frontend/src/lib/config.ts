export const PACKAGE_ID   = "0x2f0acb41d5b24aa14723c9f7b37cdb2d0bbd656b2b33556cc4a86f05d93c3150";
export const REGISTRY_ID  = "0xcd3f021b4714ce7c4d462deb1579434c711fe914a12eecbb31a224ac75990bf1";
export const CLOCK_ID     = "0x6";
export const NETWORK      = "testnet";
export const WORLD_PKG    = "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75";

export const MISSION_TYPES: Record<number, { label: string; event: string; color: string }> = {
  1: { label: "Defend Base",    event: "StatusChangedEvent",  color: "#4a9eff" },
  2: { label: "Destroy Target", event: "KillmailCreatedEvent",color: "#ff4a4a" },
  3: { label: "Deliver Cargo",  event: "ItemDepositedEvent",  color: "#4aff9e" },
  4: { label: "Patrol Zone",    event: "JumpEvent",           color: "#f0c040" },
  5: { label: "Escort",         event: "JumpEvent",           color: "#c040f0" },
};

export const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Active",
  2: "Completed",
  3: "Failed",
  4: "Disputed",
};
