/**
 * EVE Frontier World — GraphQL queries for the frontend
 * Resolves wallet addresses → character info for display
 */

import { WORLD_PKG } from "./config";

const GRAPHQL_ENDPOINT = "https://sui-testnet.mystenlabs.com/graphql";

async function gql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(", "));
  return json.data as T;
}

export interface CharacterInfo {
  characterId: string;
  name?: string;
}

/**
 * Resolve a Sui wallet address to an EVE Frontier character ID.
 * Returns null if the wallet has no PlayerProfile (not an EVE player).
 */
export async function getCharacterByWallet(walletAddress: string): Promise<CharacterInfo | null> {
  try {
    const profileType = `${WORLD_PKG}::character::PlayerProfile`;

    const data = await gql<{
      address: {
        objects: {
          nodes: Array<{
            asMoveObject: { contents: { json: Record<string, unknown> } } | null;
          }>;
        };
      } | null;
    }>(`
      query GetCharacter($owner: SuiAddress!, $type: String!) {
        address(address: $owner) {
          objects(last: 1, filter: { type: $type }) {
            nodes {
              asMoveObject {
                contents { json }
              }
            }
          }
        }
      }
    `, { owner: walletAddress, type: profileType });

    const node = data?.address?.objects?.nodes?.[0];
    if (!node?.asMoveObject) return null;

    const fields = node.asMoveObject.contents.json;
    return {
      characterId: String(fields.character_id ?? walletAddress),
      name: fields.name ? String(fields.name) : undefined,
    };
  } catch {
    return null;
  }
}
