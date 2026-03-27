/**
 * Solar system lookup — all 24,502 systems bundled as static JSON.
 * Client-side search, instant results, no API calls needed.
 */

import systemsData from "./systems-data.json";

export interface SolarSystem {
  id: number;
  name: string;
}

const ALL_SYSTEMS: SolarSystem[] = systemsData as SolarSystem[];

export async function searchSystems(query: string): Promise<SolarSystem[]> {
  if (query.length < 2) return [];
  const key = query.toLowerCase();
  return ALL_SYSTEMS.filter(s => s.name.toLowerCase().includes(key)).slice(0, 8);
}

export async function systemById(id: number): Promise<SolarSystem | null> {
  return ALL_SYSTEMS.find(s => s.id === id) ?? null;
}

export function displayName(id: number | bigint, name?: string): string {
  if (name) return name;
  return `System #${id}`;
}
