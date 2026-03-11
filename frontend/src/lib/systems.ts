/**
 * Solar system lookup via EVE Frontier World API.
 * 24,502 systems — fetched live with debounced search.
 */

export const SYSTEMS_API = "https://world-api-stillness.live.tech.evefrontier.com/v2/solarsystems";

export interface SolarSystem {
  id: number;
  name: string;
  constellationId: number;
  regionId: number;
}

// Simple in-memory cache to avoid repeat fetches
const cache = new Map<string, SolarSystem[]>();

export async function searchSystems(query: string): Promise<SolarSystem[]> {
  if (query.length < 2) return [];
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  // Fetch a page and filter client-side (API has no search param)
  // We fetch with offset=0 limit=1000 and search — not ideal but works for demo
  // Better: use offset pagination to find matches. For now: client-side filter on first 5000.
  try {
    const results: SolarSystem[] = [];
    for (let offset = 0; offset < 5000 && results.length < 8; offset += 1000) {
      const r = await fetch(`${SYSTEMS_API}?limit=1000&offset=${offset}`);
      const d = await r.json();
      const matches = (d.data as SolarSystem[]).filter((s: SolarSystem) =>
        s.name.toLowerCase().includes(key)
      );
      results.push(...matches);
      if (matches.length >= 8 || d.data.length < 1000) break;
    }
    const top8 = results.slice(0, 8);
    cache.set(key, top8);
    return top8;
  } catch {
    return [];
  }
}

export async function systemById(id: number): Promise<SolarSystem | null> {
  // Use offset trick: IDs are sequential starting ~30000001
  // Direct lookup by fetching around the known ID range
  try {
    const offset = Math.max(0, id - 30000001);
    const r = await fetch(`${SYSTEMS_API}?limit=10&offset=${offset}`);
    const d = await r.json();
    return (d.data as SolarSystem[]).find((s: SolarSystem) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

export function displayName(id: number | bigint, name?: string): string {
  if (name) return name;
  return `System #${id}`;
}
