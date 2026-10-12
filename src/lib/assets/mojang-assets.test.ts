import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMojangAssets, MOJANG_ASSETS_CACHE_NAME } from "./mojang-assets";

const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const VERSION_URL =
  "https://piston-meta.mojang.com/v1/packages/fake/1.21.4.json";
const CLIENT_URL = "https://piston-data.mojang.com/v1/objects/fake/client.jar";

function fakeManifest() {
  return {
    latest: { release: "1.21.4", snapshot: "1.21.4" },
    versions: [
      { id: "1.21.4", type: "release", url: VERSION_URL, sha1: "abc" },
      {
        id: "1.21.3",
        type: "release",
        url: "https://example.com/1.21.3.json",
        sha1: "def",
      },
    ],
  };
}

function fakeVersionDetail() {
  return {
    downloads: {
      client: { url: CLIENT_URL, sha1: "xyz", size: 12345 },
    },
  };
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
  } as Response;
}

function jarBytes(): ArrayBuffer {
  return new Uint8Array([1, 2, 3, 4]).buffer;
}

function jarResponse(bytes: ArrayBuffer, ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? "OK" : "Not Found",
    arrayBuffer: async () => bytes,
    clone() {
      return jarResponse(bytes, ok);
    },
  } as unknown as Response;
}

/** Minimal in-memory fake for the Cache API, backed by a Map keyed by URL. */
function makeFakeCaches() {
  const stores = new Map<string, Map<string, Response>>();

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async match(url: string) {
          return store.get(url);
        },
        async put(url: string, response: Response) {
          store.set(url, response);
        },
      };
    },
  };

  return caches;
}

function mockFetchSequence(handlers: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const handler = handlers[url];
    if (!handler) throw new Error(`Unexpected fetch: ${url}`);
    return handler();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadMojangAssets", () => {
  it("resolves the latest release and returns its client jar bytes", async () => {
    const bytes = jarBytes();
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse(fakeManifest()),
      [VERSION_URL]: () => jsonResponse(fakeVersionDetail()),
      [CLIENT_URL]: () => jarResponse(bytes),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadMojangAssets();

    expect(result.versionId).toBe("1.21.4");
    expect(result.assets).toBe(bytes);
  });

  it("throws a clear error for an unknown requested version without fetching further", async () => {
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse(fakeManifest()),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadMojangAssets({ version: "1.0.0-does-not-exist" })
    ).rejects.toThrow(/unknown.*1\.0\.0-does-not-exist/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when the manifest fetch fails", async () => {
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse({}, false),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadMojangAssets()).rejects.toThrow(/manifest/i);
  });

  it("throws a clear error when the client jar fetch fails", async () => {
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse(fakeManifest()),
      [VERSION_URL]: () => jsonResponse(fakeVersionDetail()),
      [CLIENT_URL]: () => jarResponse(new ArrayBuffer(0), false),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadMojangAssets()).rejects.toThrow(/client jar/i);
  });

  it("caches the client jar so a second load for the same version skips the fetch", async () => {
    const bytes = jarBytes();
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse(fakeManifest()),
      [VERSION_URL]: () => jsonResponse(fakeVersionDetail()),
      [CLIENT_URL]: () => jarResponse(bytes),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("caches", makeFakeCaches());

    await loadMojangAssets();
    await loadMojangAssets();

    const clientJarCalls = fetchMock.mock.calls.filter(([input]) => {
      const url =
        typeof input === "string" ? input : (input as URL | Request).toString();
      return url === CLIENT_URL;
    });
    expect(clientJarCalls).toHaveLength(1);
  });

  it("still works correctly when caches is undefined (jsdom parity)", async () => {
    vi.stubGlobal("caches", undefined);
    const bytes = jarBytes();
    const fetchMock = mockFetchSequence({
      [MANIFEST_URL]: () => jsonResponse(fakeManifest()),
      [VERSION_URL]: () => jsonResponse(fakeVersionDetail()),
      [CLIENT_URL]: () => jarResponse(bytes),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadMojangAssets();

    expect(result.versionId).toBe("1.21.4");
    expect(result.assets).toBe(bytes);
  });

  it("exports the documented cache name", () => {
    expect(MOJANG_ASSETS_CACHE_NAME).toBe("hggp-mojang-assets-v1");
  });
});
