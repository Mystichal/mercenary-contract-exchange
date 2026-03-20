/**
 * EVE Frontier World — GraphQL client
 *
 * Provides direct state queries against Sui's GraphQL endpoint.
 * Used as a complement to event polling — catches cases where events
 * were already emitted before the verifier started watching.
 *
 * Sui testnet GraphQL: https://sui-testnet.mystenlabs.com/graphql
 */

const GRAPHQL_ENDPOINT = "https://sui-testnet.mystenlabs.com/graphql";

async function gql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL error: ${json.errors.map(e => e.message).join(", ")}`);

  return json.data as T;
}

// ── Object state ──────────────────────────────────────────────────────────────

/** Fetch raw JSON fields from any Sui Move object by ID */
export async function getObjectFields(objectId: string): Promise<Record<string, unknown> | null> {
  const data = await gql<{
    object: { asMoveObject: { contents: { json: Record<string, unknown> } } } | null
  }>(`
    query GetObject($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject {
          contents {
            json
          }
        }
      }
    }
  `, { id: objectId });

  return data?.object?.asMoveObject?.contents?.json ?? null;
}

// ── Assembly / DEFEND_BASE ────────────────────────────────────────────────────

export interface AssemblyState {
  objectId: string;
  isOnline: boolean;
  solarSystemId: bigint | null;
  owner: string | null;
}

/**
 * Directly query whether an assembly object is ONLINE.
 * This is the fallback for DEFEND_BASE contracts when no StatusChangedEvent fires
 * because the assembly was already online before the contract was accepted.
 */
export async function getAssemblyState(objectId: string): Promise<AssemblyState | null> {
  try {
    const data = await gql<{
      object: {
        owner: { __typename: string; address?: string } | null;
        asMoveObject: { contents: { json: Record<string, unknown> } } | null;
      } | null;
    }>(`
      query GetAssembly($id: SuiAddress!) {
        object(address: $id) {
          owner {
            __typename
            ... on AddressOwner {
              owner {
                address
              }
            }
          }
          asMoveObject {
            contents {
              json
            }
          }
        }
      }
    `, { id: objectId });

    if (!data?.object?.asMoveObject) return null;

    const fields = data.object.asMoveObject.contents.json;
    const stateStr = String(fields.state ?? fields.status ?? "").toLowerCase();
    const isOnline = stateStr.includes("online") || stateStr === "1" || fields.is_online === true;
    const solarSystemId = fields.solar_system_id
      ? BigInt(fields.solar_system_id as string)
      : null;

    return {
      objectId,
      isOnline,
      solarSystemId,
      owner: null,
    };
  } catch (e) {
    console.warn(`[graphql] getAssemblyState(${objectId}) failed:`, e);
    return null;
  }
}

// ── Character / player lookup ─────────────────────────────────────────────────

export interface CharacterInfo {
  characterId: string;
  walletAddress: string;
}

/**
 * Look up an EVE Frontier character by wallet address.
 * Queries owned objects of type PlayerProfile, extracts character_id.
 */
export async function getCharacterByWallet(
  walletAddress: string,
  worldPackageId: string,
): Promise<CharacterInfo | null> {
  try {
    const profileType = `${worldPackageId}::character::PlayerProfile`;

    const data = await gql<{
      address: {
        objects: {
          nodes: Array<{
            address: string;
            asMoveObject: { contents: { json: Record<string, unknown> } } | null;
          }>;
        };
      } | null;
    }>(`
      query GetCharacter($owner: SuiAddress!, $type: String!) {
        address(address: $owner) {
          objects(last: 10, filter: { type: $type }) {
            nodes {
              address
              asMoveObject {
                contents {
                  json
                }
              }
            }
          }
        }
      }
    `, { owner: walletAddress, type: profileType });

    const nodes = data?.address?.objects?.nodes ?? [];
    if (!nodes.length) return null;

    const profile = nodes[0];
    const fields = profile.asMoveObject?.contents?.json ?? {};
    const characterId = String(fields.character_id ?? profile.address);

    return { characterId, walletAddress };
  } catch (e) {
    console.warn(`[graphql] getCharacterByWallet(${walletAddress}) failed:`, e);
    return null;
  }
}

// ── Objects by type ───────────────────────────────────────────────────────────

export interface WorldObject {
  address: string;
  fields: Record<string, unknown>;
}

/**
 * Fetch all world objects of a given Move type (paginated, up to maxItems).
 * Useful for scanning assemblies, gates, etc.
 */
export async function getObjectsByType(
  moveType: string,
  maxItems = 50,
): Promise<WorldObject[]> {
  const data = await gql<{
    objects: {
      nodes: Array<{
        address: string;
        asMoveObject: { contents: { json: Record<string, unknown> } } | null;
      }>;
    };
  }>(`
    query GetObjectsByType($type: String!, $first: Int!) {
      objects(filter: { type: $type }, first: $first) {
        nodes {
          address
          asMoveObject {
            contents {
              json
            }
          }
        }
      }
    }
  `, { type: moveType, first: maxItems });

  return (data?.objects?.nodes ?? [])
    .filter(n => n.asMoveObject)
    .map(n => ({
      address: n.address,
      fields: n.asMoveObject!.contents.json,
    }));
}
