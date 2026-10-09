// Browser stand-ins for the server pieces of src/lib/film.functions.ts, used
// only by the static GitHub Pages build (vite.pages.config.ts swaps them in).
//
// - createServerFn(): runs the validator + handler in the page instead of
//   making an RPC call to a server that doesn't exist on Pages.
// - fetch(): the handlers call third-party APIs. Most of them send CORS
//   headers and work from a browser as-is; the rest are handled here:
//     * IMDb's suggestion API has no CORS, so it goes through IMDb's JSONP
//       endpoint (sg.media-imdb.com/suggests) instead.
//     * MediaWiki APIs need `origin=*` for anonymous CORS.
//     * Sites with no CORS and no JSONP (HTML fan guides, Letterboxd,
//       cinematerial, moviescenemap HTML pages, Google's pano lookup) get
//       an immediate 502 so the existing fallbacks in film.functions.ts run.
//     * "Does this image load?" probes use an <img> instead of fetch.

type Validator = (input: unknown) => unknown;
type Handler = (ctx: { data: any }) => Promise<any>;

export function createServerFn(_opts?: unknown) {
  let validate: Validator | undefined;
  const builder = {
    validator(fn: Validator) {
      validate = fn;
      return builder;
    },
    inputValidator(fn: Validator) {
      validate = fn;
      return builder;
    },
    middleware() {
      return builder;
    },
    handler(fn: Handler) {
      return async (arg?: { data?: unknown }) => {
        const raw = arg?.data;
        const data = validate ? validate(raw) : raw;
        return fn({ data });
      };
    },
  };
  return builder;
}

const CORS_HOSTS = [
  /(^|\.)wikipedia\.org$/,
  /^commons\.wikimedia\.org$/,
  /^query\.wikidata\.org$/,
  /^www\.wikidata\.org$/,
  /^nominatim\.openstreetmap\.org$/,
  /^geocoding-api\.open-meteo\.com$/,
  /^api\.openverse\.org$/,
  /^moviescenemap\.com$/,
];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function headersOf(init?: RequestInit): Headers {
  return new Headers(init?.headers ?? {});
}

// ---- IMDb suggestions over JSONP -------------------------------------------

// IMDb names the JSONP callback after the query, but only produces a valid JS
// identifier for one or two plain words joined by "_". So ask for up to two
// word pairs from the query and rank the merged hits against the full query.
function imdbKeys(q: string): string[] {
  const words = q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const body = words.length > 1 && /^(the|a|an)$/.test(words[0]) ? words.slice(1) : words;
  if (!body.length) return [];
  const keys = [body.slice(0, 2).join("_")];
  if (body.length > 2) keys.push(body.slice(-2).join("_"));
  return [...new Set(keys)];
}

const jsonpWaiters = new Map<string, Promise<any>>();

function imdbJsonp(key: string, timeoutMs: number): Promise<any> {
  const existing = jsonpWaiters.get(key);
  if (existing) return existing;
  const name = `imdb$${key}`;
  const run = new Promise<any>((resolve, reject) => {
    const script = document.createElement("script");
    const w = window as unknown as Record<string, unknown>;
    const done = () => {
      clearTimeout(timer);
      script.remove();
      delete w[name];
      jsonpWaiters.delete(key);
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("IMDb search didn't respond"));
    }, timeoutMs);
    w[name] = (body: unknown) => {
      done();
      resolve(body);
    };
    script.onerror = () => {
      done();
      reject(new Error("IMDb search didn't respond"));
    };
    script.src = `https://sg.media-imdb.com/suggests/${key[0]}/${key}.json`;
    script.referrerPolicy = "no-referrer";
    document.head.appendChild(script);
  });
  jsonpWaiters.set(key, run);
  return run;
}

async function imdbSuggest(url: URL): Promise<Response> {
  const q = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/\.json$/, "");
  const keys = imdbKeys(q);
  if (!keys.length) return jsonResponse({ d: [] });
  const bodies = await Promise.all(keys.map((key) => imdbJsonp(key, 8000).catch(() => null)));
  if (bodies.every((body) => !body)) throw new Error("IMDb search didn't respond");
  const want = q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !/^(the|an)$/.test(word));
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const body of bodies) {
    for (const row of body?.d ?? []) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      // The JSONP feed has i = [url, w, h]; the JSON API has i = { imageUrl }.
      const image = Array.isArray(row.i)
        ? { imageUrl: row.i[0], width: row.i[1], height: row.i[2] }
        : row.i;
      rows.push({ ...row, i: image });
    }
  }
  const score = (row: any) => {
    const title = String(row.l || "").toLowerCase();
    return want.filter((word) => title.includes(word)).length;
  };
  rows.sort((a, b) => score(b) - score(a));
  return jsonResponse({ d: rows });
}

// ---- image probe -------------------------------------------------------------

function probeImage(src: string, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("image timed out"));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } }));
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(new Response(null, { status: 404, headers: { "content-type": "text/plain" } }));
    };
    img.src = src;
  });
}

// ---- fetch -------------------------------------------------------------------

export async function staticFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  const headers = headersOf(init);

  if (url.hostname === "v3.sg.media-imdb.com" && url.pathname.startsWith("/suggestion/")) {
    return imdbSuggest(url);
  }

  if (headers.has("range") && /image\//.test(headers.get("accept") || "")) {
    return probeImage(url.href, 7000);
  }

  // moviescenemap.com's API is CORS-enabled; its HTML pages are not.
  const blocked =
    !CORS_HOSTS.some((re) => re.test(url.hostname)) ||
    (url.hostname === "moviescenemap.com" && url.pathname !== "/mcp");
  if (blocked) {
    // Answer like an unavailable upstream so the handlers' existing
    // "source didn't respond" fallbacks run, exactly as on the server.
    return new Response("", { status: 502, statusText: "Not reachable from a static page" });
  }

  if (url.pathname.endsWith("/w/api.php") && !url.searchParams.has("origin")) {
    url.searchParams.set("origin", "*");
  }
  headers.delete("user-agent");
  headers.delete("referer");
  headers.delete("range");
  return fetch(url.href, { ...init, headers });
}
