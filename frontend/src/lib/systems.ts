/**
 * Solar system lookup for EVE Frontier / Utopia testnet.
 * solarsystem field in world-contracts is u64 — this maps names ↔ IDs.
 * 
 * EVE Frontier uses the same system IDs as EVE Online's static data.
 * Add more as discovered in Utopia.
 */

export interface SolarSystem {
  id: number;
  name: string;
  security: string; // "highsec" | "lowsec" | "nullsec" | "wormhole"
}

// Known systems — extend as more are confirmed in Utopia/Frontier
export const KNOWN_SYSTEMS: SolarSystem[] = [
  { id: 30000142, name: "Jita",       security: "highsec" },
  { id: 30002187, name: "Amarr",      security: "highsec" },
  { id: 30002659, name: "Dodixie",    security: "highsec" },
  { id: 30002510, name: "Rens",       security: "highsec" },
  { id: 30002053, name: "Hek",        security: "highsec" },
  { id: 30001984, name: "Oursulaert", security: "highsec" },
  { id: 30002086, name: "Tash-Murkon", security: "highsec" },
  { id: 30002411, name: "Anka",       security: "lowsec" },
  { id: 30000049, name: "Hakonen",    security: "lowsec" },
  { id: 30001647, name: "Amamake",    security: "lowsec" },
  { id: 30000206, name: "Tama",       security: "lowsec" },
  { id: 30002797, name: "Rancer",     security: "lowsec" },
  { id: 30000021, name: "G-0Q86",     security: "nullsec" },
  { id: 30001445, name: "Delve",      security: "nullsec" },
];

const ID_TO_NAME = new Map(KNOWN_SYSTEMS.map(s => [s.id, s]));
const NAME_TO_ID = new Map(KNOWN_SYSTEMS.map(s => [s.name.toLowerCase(), s]));

export function systemById(id: number): SolarSystem | undefined {
  return ID_TO_NAME.get(id);
}

export function systemByName(name: string): SolarSystem | undefined {
  return NAME_TO_ID.get(name.toLowerCase());
}

export function searchSystems(query: string): SolarSystem[] {
  const q = query.toLowerCase();
  return KNOWN_SYSTEMS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
}

export function displayName(id: number | bigint): string {
  const sys = systemById(Number(id));
  return sys ? sys.name : `System #${id}`;
}

export const SECURITY_COLORS: Record<string, string> = {
  highsec:  "#4aff9e",
  lowsec:   "#f0c040",
  nullsec:  "#ff4a4a",
  wormhole: "#c040f0",
};
