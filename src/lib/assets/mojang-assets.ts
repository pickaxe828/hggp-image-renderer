/**
 * Fetches vanilla Minecraft assets (the client jar, which contains the
 * `assets/minecraft/...` textures/models/blockstates tree) live from
 * Mojang's servers at runtime, for use as block-model-renderer's `assets`
 * input.
 *
 * This is a deliberate, user-confirmed decision: this repo does not ask
 * users to supply a local resource pack. See CLAUDE.md ("Texture
 * sourcing") for the reasoning.
 *
 * block-model-renderer's `AssetsInput` accepts a raw zip's bytes directly
 * (`Uint8Array | ArrayBuffer | Blob`) and reads the asset tree out of it
 * itself, so the client jar's bytes can be passed straight through — no
 * unzipping is done here.
 */

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/** Cache API cache name the fetched client jar bytes are stored under. */
export const MOJANG_ASSETS_CACHE_NAME = "hggp-mojang-assets-v1";

export interface MojangAssetsResult {
  /** Pass straight through as the `assets` arg to block-model-renderer's createScene/prepareAssets. */
  assets: ArrayBuffer;
  /** The resolved Minecraft version id these assets are for, e.g. "1.21.4". */
  versionId: string;
}

interface VersionManifestEntry {
  id: string;
  type: string;
  url: string;
  sha1: string;
}

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionManifestEntry[];
}

interface VersionDetail {
  downloads: {
    client: { url: string; sha1: string; size: number };
  };
}

/**
 * Fetches vanilla Minecraft assets for `options.version` (or the latest
 * release, if omitted) from Mojang's servers, caching the (large) client
 * jar in the browser Cache API so repeat loads don't re-download it.
 *
 * Every network step is wrapped so failures throw an `Error` whose message
 * names which step failed, distinguishing a load failure here from a
 * notation parse error for callers that need to display one or the other.
 */
export async function loadMojangAssets(options?: {
  version?: string;
}): Promise<MojangAssetsResult> {
  const manifest = await fetchVersionManifest();

  const requestedVersion = options?.version;
  const versionId = requestedVersion ?? manifest.latest.release;
  const versionEntry = manifest.versions.find((v) => v.id === versionId);
  if (!versionEntry) {
    throw new Error(
      `Unknown Minecraft version "${versionId}" (not in version manifest)`
    );
  }

  const versionDetail = await fetchVersionDetail(versionEntry);
  const clientUrl = versionDetail.downloads.client.url;
  const assets = await fetchClientJar(clientUrl, versionId);

  return { assets, versionId };
}

async function fetchVersionManifest(): Promise<VersionManifest> {
  let response: Response;
  try {
    response = await fetch(VERSION_MANIFEST_URL);
  } catch (cause) {
    throw new Error(
      `Failed to fetch Minecraft version manifest: ${errorMessage(cause)}`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Minecraft version manifest: ${response.status} ${response.statusText}`
    );
  }
  try {
    return (await response.json()) as VersionManifest;
  } catch (cause) {
    throw new Error(
      `Failed to fetch Minecraft version manifest: ${errorMessage(cause)}`
    );
  }
}

async function fetchVersionDetail(
  entry: VersionManifestEntry
): Promise<VersionDetail> {
  let response: Response;
  try {
    response = await fetch(entry.url);
  } catch (cause) {
    throw new Error(
      `Failed to fetch Minecraft version detail for version ${entry.id}: ${errorMessage(cause)}`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Minecraft version detail for version ${entry.id}: ${response.status} ${response.statusText}`
    );
  }
  try {
    return (await response.json()) as VersionDetail;
  } catch (cause) {
    throw new Error(
      `Failed to fetch Minecraft version detail for version ${entry.id}: ${errorMessage(cause)}`
    );
  }
}

/**
 * Fetches the client jar at `url`, using the Cache API (keyed by `url`) to
 * avoid re-downloading the ~20MB+ jar on repeat loads. Skips caching
 * entirely when `caches` isn't available (jsdom, or any environment
 * without the Cache API), and never lets a caching failure fail the load —
 * it falls back to the bytes it already fetched.
 */
async function fetchClientJar(
  url: string,
  versionId: string
): Promise<ArrayBuffer> {
  const cache =
    typeof caches !== "undefined"
      ? await caches.open(MOJANG_ASSETS_CACHE_NAME).catch(() => null)
      : null;

  if (cache) {
    const cached = await cache.match(url).catch(() => undefined);
    if (cached) {
      return cached.arrayBuffer();
    }
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(
      `Failed to fetch client jar for version ${versionId}: ${errorMessage(cause)}`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch client jar for version ${versionId}: ${response.status} ${response.statusText}`
    );
  }

  if (cache) {
    try {
      await cache.put(url, response.clone());
    } catch {
      // Caching is a best-effort optimization (e.g. quota exceeded on a
      // ~20MB+ entry); fall through to using the already-fetched bytes.
    }
  }

  try {
    return await response.arrayBuffer();
  } catch (cause) {
    throw new Error(
      `Failed to fetch client jar for version ${versionId}: ${errorMessage(cause)}`
    );
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
