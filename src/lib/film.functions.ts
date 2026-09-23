import { createServerFn } from "@tanstack/react-start";
import type { Dossier, FilmLocation, NearbySpot, PlacePhoto, Still, StreetViewHit, Suggestion } from "@/lib/film-types";

const UA = "OnLocation/1.0 (film street explorer)";
const ATLAS = "https://moviescenemap.com/mcp";

type AtlasPlace = {
  name?: string;
  slug?: string;
  category?: string;
  category_label?: string;
  precision?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

type AtlasFilm = {
  name?: string;
  year?: string;
  description?: string;
  wikipedia?: string;
  places?: AtlasPlace[];
  wiki_places?: AtlasPlace[];
  countries_only?: string[];
  located_places?: number;
};

type AtlasSearch = {
  results?: { name?: string; slug?: string; kind?: string; year?: string; located_places?: number }[];
};

const dossierCache = new Map<string, { at: number; value: Dossier }>();
const streetCache = new Map<string, { at: number; value: StreetViewHit }>();
const frameCache = new Map<string, { at: number; value: Still[] }>();
const directorCache = new Map<string, string>();
const TTL = 30 * 60 * 1000;

function fresh<T>(entry: { at: number; value: T } | undefined): T | undefined {
  if (!entry) return undefined;
  if (Date.now() - entry.at > TTL) return undefined;
  return entry.value;
}

async function mcp<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(ATLAS, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(14000),
  });
  if (!res.ok) throw new Error(`Location atlas returned ${res.status}`);
  const body = (await res.json()) as {
    error?: { message?: string };
    result?: { content?: { type?: string; text?: string }[] };
  };
  if (body.error) throw new Error(body.error.message || "Location atlas error");
  const text = body.result?.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Empty location atlas response");
  return JSON.parse(text) as T;
}

function posterSized(url?: string): string | undefined {
  if (!url) return undefined;
  if (!/^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)\//.test(url)) {
    return undefined;
  }
  return url.replace(/\._V1_[^.]*\.jpg$/i, "._V1_SX720_.jpg");
}

function wikiTitleFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const part = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!part) return undefined;
    return decodeURIComponent(part).replace(/_/g, " ");
  } catch {
    return undefined;
  }
}

const STOP = new Set([
  "film",
  "city",
  "town",
  "street",
  "south",
  "north",
  "east",
  "west",
  "united",
  "states",
  "kingdom",
  "county",
  "district",
  "square",
  "bridge",
  "hotel",
  "palace",
  "castle",
  "park",
  "road",
  "avenue",
  "building",
  "house",
  "university",
  "college",
  "international",
  "airport",
  "hall",
  "tower",
  "plaza",
  "centre",
  "center",
  "station",
  "court",
  "place",
]);

const COMMON_PLACE = new Set([
  "paris",
  "london",
  "tokyo",
  "rome",
  "berlin",
  "madrid",
  "chicago",
  "boston",
  "miami",
  "venice",
  "vienna",
  "prague",
  "lisbon",
  "dublin",
  "seattle",
  "toronto",
  "sydney",
  "malibu",
  "hollywood",
  "manhattan",
  "brooklyn",
  "california",
  "japan",
  "france",
  "italy",
  "spain",
  "england",
  "morocco",
  "canada",
  "mexico",
  "china",
  "india",
  "germany",
  "ireland",
  "scotland",
  "australia",
  "austria",
  "portugal",
  "greece",
  "egypt",
  "thailand",
  "brazil",
]);

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z“"])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 520);
}

const FILMING_HINT =
  /filmed|filming|was shot|were shot|shot at|shot in|shot on|on location|principal photography|sound stage|locations and sets/i;

function matchScene(name: string, sentences: string[]): string | undefined {
  const words = tokens(name);
  if (!words.length) return undefined;
  let best: { score: number; text: string } | undefined;
  for (const sentence of sentences) {
    if (!FILMING_HINT.test(sentence)) continue;
    const hay = sentence.toLowerCase();
    const hits = words.filter((w) => hay.includes(w));
    if (!hits.length) continue;
    const onlyCommon = hits.every((w) => COMMON_PLACE.has(w));
    if (onlyCommon && hits.length < 2) continue;
    const score = hits.reduce((n, w) => n + w.length, 0);
    if (!best || score > best.score) best = { score, text: sentence };
  }
  return best && best.score >= 5 ? best.text : undefined;
}

function rankOf(place: AtlasPlace): number {
  const precision = (place.precision ?? "").toLowerCase();
  const category = (place.category ?? "").toLowerCase();
  if (category === "fiction" || category === "region") return 9;
  if (precision.includes("exact")) return 0;
  if (category === "street" || precision.includes("street") || precision.includes("block")) return 1;
  if (category === "landmark" || category === "castle" || category === "studio" || category === "nature") {
    return 2;
  }
  if (category === "city" || precision.includes("town")) return 3;
  return 4;
}

function precisionNote(place: AtlasPlace, source: FilmLocation["source"]): string {
  const via = source === "wikidata" ? "Wikidata filming location" : "named in the Wikipedia article";
  const precision = (place.precision ?? "").toLowerCase();
  if (precision.includes("exact")) return `Exact site · ${via}`;
  if (precision.includes("town") || (place.category ?? "") === "city") {
    return `Town-level pin · ${via}. Street View opens at the center of the place, not one marked set.`;
  }
  return `Approximate pin · ${via}`;
}

function isSpecificSite(place: AtlasPlace): boolean {
  const precision = (place.precision ?? "").toLowerCase();
  const category = (place.category ?? "").toLowerCase();
  const name = (place.name ?? "").trim();
  if (!name) return false;
  if (category === "city" || category === "region" || category === "fiction") return false;
  if (/^(downtown|city centre|city center|old town|town centre|historic cent(er|re))$/i.test(name)) return false;
  const numbered = /\b\d{1,5}[a-z]?\b/i.test(name);
  const street =
    /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|boulevard|blvd\.?|drive|dr\.?|way|place|square|sq\.?|terrace|crescent|row|alley|quay|embankment|promenade|bridge|highway|route|close|court|gardens|gate|mews|circus|parade|walk|wharf|pier)\b/i.test(
      name,
    );
  const building =
    /\b(building|hall|hotel|station|theatre|theater|church|cathedral|chapel|museum|tower|house|plaza|centre|center|palace|school|university|college|hospital|airport|stadium|arena|castle|abbey|temple|library|market|factory|mill|warehouse|terminal|dock|steps|studio|studios)\b/i.test(
      name,
    );
  if (/town|city|country|region|village/.test(precision) && !numbered && !street && !building) return false;
  if (numbered || street || building) return true;
  const words = name.split(/\s+/).filter(Boolean);
  if (
    words.length >= 2 &&
    (category === "landmark" || category === "castle" || category === "building" || category === "studio")
  ) {
    return true;
  }
  return false;
}

function toLocation(place: AtlasPlace, source: FilmLocation["source"], sentences: string[]): FilmLocation | undefined {
  if (!isSpecificSite(place)) return undefined;
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return undefined;
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return undefined;
  if (rankOf(place) >= 9) return undefined;
  const name = (place.name ?? "").trim();
  if (!name) return undefined;
  const country = (place.country ?? "").trim();
  const address = country ? `${name}, ${country}` : name;
  return {
    id: `${source}:${place.slug || name}`,
    name,
    country,
    category: place.category_label || place.category || "Place",
    precision: place.precision || "approximate",
    source,
    lat: place.latitude,
    lng: place.longitude,
    address,
    scene: matchScene(name, sentences),
    precisionNote: precisionNote(place, source),
  };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function pickAtlasSlug(
  title: string,
  year: number | undefined,
  kind: "film" | "tv",
  results: NonNullable<AtlasSearch["results"]>,
): string {
  let best = title;
  let bestScore = 0;
  const want = norm(title);
  for (const row of results) {
    if (row.kind && row.kind !== kind) continue;
    const name = norm(row.name ?? "");
    if (!name) continue;
    let score = 0;
    if (name === want) score += 80;
    else if (name.startsWith(want) || want.startsWith(name)) score += 40;
    else if (name.includes(want) || want.includes(name)) score += 20;
    else continue;
    const y = Number(row.year);
    if (year && Number.isFinite(y) && Math.abs(y - year) > 1) continue;
    if (year && Number.isFinite(y)) {
      if (y === year) score += 30;
      else if (Math.abs(y - year) === 1) score += 12;
    }
    if ((row.located_places ?? 0) > 0) score += 4;
    if (score > bestScore && row.slug) {
      bestScore = score;
      best = row.slug;
    }
  }
  return bestScore >= 40 ? best : title;
}

async function wikiGet(params: Record<string, string>): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ format: "json", ...params });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, " ")
    .replace(/<table\b[\s\S]*?<\/table>/gi, " ")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\s*edit\s*\]/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(new RegExp("&" + "amp;", "g"), "&")
    .replace(new RegExp("&" + "quot;", "g"), '"')
    .replace(new RegExp("&#(\\d+);", "g"), (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .replace(/^(locations and sets|filming locations)\s+/i, "")
    .trim();
}

async function wikiBundle(title: string | undefined): Promise<{
  sentences: string[];
  notes: string[];
  stills: Still[];
  pageUrl?: string;
}> {
  if (!title) return { sentences: [], notes: [], stills: [] };
  let page = title;
  let sections = [] as { index?: string; line?: string; toclevel?: number }[];
  const first = await wikiGet({ action: "parse", page, prop: "sections", redirects: "1" });
  const parsed = first.parse as { title?: string; sections?: typeof sections } | undefined;
  if (!parsed) {
    const found = await wikiGet({
      action: "query",
      list: "search",
      srsearch: `${title} film`,
      srlimit: "1",
    });
    const hit = ((found.query as { search?: { title?: string }[] } | undefined)?.search ?? [])[0]?.title;
    if (!hit) return { sentences: [], notes: [], stills: [] };
    page = hit;
    const again = await wikiGet({ action: "parse", page, prop: "sections", redirects: "1" });
    sections = ((again.parse as { sections?: typeof sections } | undefined)?.sections ?? []);
    page = ((again.parse as { title?: string } | undefined)?.title ?? page);
  } else {
    sections = parsed.sections ?? [];
    page = parsed.title ?? page;
  }

  const candidates = sections.filter((s) => {
    const line = s.line ?? "";
    if (/fictional|setting of the|video game/i.test(line)) return false;
    return /filming locations|locations and sets|principal photography|filming$|on location|^locations$/i.test(line);
  });
  candidates.sort((a, b) => {
    const score = (line: string) =>
      /filming locations|locations and sets|principal photography/i.test(line) ? 0 : 1;
    return score(a.line ?? "") - score(b.line ?? "");
  });
  const section = candidates[0];
  let sentences: string[] = [];
  if (section?.index) {
    const body = await wikiGet({
      action: "parse",
      page,
      prop: "text",
      section: section.index,
      redirects: "1",
    });
    const html = ((body.parse as { text?: Record<string, string> } | undefined)?.text ?? {})["*"] ?? "";
    sentences = sentencesOf(stripHtml(html).slice(0, 9000));
  }
  const notes = sentences.filter((s) => FILMING_HINT.test(s)).slice(0, 3);

  const listed = await wikiGet({
    action: "query",
    redirects: "1",
    prop: "images",
    imlimit: "40",
    titles: page,
  });
  const pages = (listed.query as { pages?: Record<string, { images?: { title?: string }[] }> } | undefined)?.pages;
  const files = Object.values(pages ?? {})
    .flatMap((p) => p.images ?? [])
    .map((im) => im.title ?? "")
    .filter((name) => /\.(jpe?g|png|webp|gif|webm|ogv|mp4)$/i.test(name))
    .filter((name) => !/logo|icon|symbol|commons|edit-ltr|flag of|wikidata|wordmark|premiere|red carpet|wondercon|comic-?con|festival/i.test(name))
    .slice(0, 12);
  const stills = await wikiThumbs(files);
  const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
  return { sentences, notes, stills, pageUrl };
}

async function wikiThumbs(files: string[]): Promise<Still[]> {
  if (!files.length) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo|categories",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1000",
    cllimit: "12",
    titles: files.slice(0, 12).join("|"),
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          categories?: { title?: string }[];
          imageinfo?: {
            thumburl?: string;
            mime?: string;
            thumbwidth?: number;
            thumbheight?: number;
            extmetadata?: { ImageDescription?: { value?: string } };
          }[];
        }
      >;
    };
  };
  const stills: Still[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    const thumbIsImage = /\.(jpe?g|png|webp)(\?|$)/i.test(info.thumburl);
    const mimeOk = !info.mime || /^image\/(jpeg|png|webp|gif)$/.test(info.mime);
    if (!thumbIsImage || !mimeOk) continue;
    const caption = (page.title ?? "Still")
      .replace(/^File:/, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/_/g, " ");
    const cats = (page.categories ?? []).map((c) => c.title ?? "");
    const desc = (info.extmetadata?.ImageDescription?.value ?? "").replace(/<[^>]+>/g, " ");
    if (!isFrame(caption, info.thumbwidth, info.thumbheight, cats, desc)) continue;
    stills.push({ url: info.thumburl, caption, source: "wikipedia" });
  }
  stills.sort((a, b) => frameRank(a.caption, "") - frameRank(b.caption, ""));
  return stills.slice(0, 6);
}

const FRAME_JUNK =
  /poster|theatrical|dvd|blu-?ray|cover art|logo|icon|symbol|flag of|soundtrack|portrait|headshot|red carpet|premiere|comic-?con|wondercon|festival|photograph of|commons-logo|wikiquote|wordmark|emblem|coat of arms|map of|locator|behind the scenes|press kit/i;

function isFrame(
  name: string,
  width?: number,
  height?: number,
  cats: string[] = [],
  desc = "",
  ratioTarget?: number,
): boolean {
  const blob = `${name} ${cats.join(" ")} ${desc}`;
  if (FRAME_JUNK.test(blob)) return false;
  if (/nixon|publicity|behind the scenes|on the set|press photo|promotional|photograph of/i.test(blob)) return false;
  if (!width || !height) return false;
  const ratio = width / height;
  if (ratioTarget) {
    if (Math.abs(ratio - ratioTarget) > 0.16) return false;
  } else if (ratio < 1.66 || ratio > 2.45) {
    return false;
  }
  if (width < 400) return false;
  const looks = /screenshot|screencap|screengrab|film still|movie still|\bscene\b|\bframe\b/i.test(blob);
  const nonFree = /non-free/i.test(blob);
  return Boolean(ratioTarget) || looks || nonFree;
}

function frameRank(caption: string, place: string): number {
  const n = caption.toLowerCase();
  const words = tokens(place);
  const hit = words.some((w) => n.includes(w));
  let score = hit ? 0 : 2;
  if (/screenshot|screencap|still|scene|frame|chase/.test(n)) score -= 1;
  return score;
}

async function searchFiles(host: string, q: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srnamespace: "6",
    srlimit: "6",
    srsearch: q,
  });
  const res = await fetch(`https://${host}/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { search?: { title?: string }[] } };
  return (data.query?.search ?? []).map((row) => row.title ?? "").filter(Boolean);
}

async function describeFiles(host: string, titles: string[], ratioTarget?: number): Promise<Still[]> {
  const unique = [...new Set(titles)].slice(0, 12);
  if (!unique.length) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo|categories",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1000",
    cllimit: "12",
    titles: unique.join("|"),
  });
  const res = await fetch(`https://${host}/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          categories?: { title?: string }[];
          imageinfo?: {
            thumburl?: string;
            mime?: string;
            thumbwidth?: number;
            thumbheight?: number;
            extmetadata?: { ImageDescription?: { value?: string } };
          }[];
        }
      >;
    };
  };
  const stills: Still[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(info.thumburl)) continue;
    if (info.mime && !/^image\/(jpeg|png|webp|gif)$/.test(info.mime)) continue;
    const caption = (page.title ?? "Still")
      .replace(/^File:/, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/_/g, " ");
    const cats = (page.categories ?? []).map((c) => c.title ?? "");
    const desc = (info.extmetadata?.ImageDescription?.value ?? "").replace(/<[^>]+>/g, " ");
    if (!isFrame(caption, info.thumbwidth, info.thumbheight, cats, desc, ratioTarget)) continue;
    stills.push({ url: info.thumburl, caption, source: "wikipedia" });
  }
  return stills;
}

function quoteTerm(value: string): string {
  return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

const aspectCache = new Map<string, number>();

function wikiPagesFor(title: string, year?: number): string[] {
  const pages = new Set<string>();
  if (year === 1984 && /^(1984|nineteen eighty-four)$/i.test(title.trim())) {
    pages.add("Nineteen Eighty-Four (1984 film)");
  }
  if (year) pages.add(`${title} (${year} film)`);
  pages.add(title);
  return [...pages];
}

async function filmAspect(title: string, year?: number): Promise<number | undefined> {
  const key = `${norm(title)}|${year ?? ""}`;
  const cached = aspectCache.get(key);
  if (cached) return cached;
  for (const page of wikiPagesFor(title, year)) {
    const params = new URLSearchParams({
      action: "parse",
      format: "json",
      page,
      prop: "wikitext",
      redirects: "1",
    });
    try {
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
      const text = data.parse?.wikitext?.["*"] ?? "";
      if (!text) continue;
      const boxed = text.match(
        /\|\s*aspect[_\s]*ratio\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
      );
      const prose = text.match(
        /aspect ratio[^.\n]{0,48}?([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
      );
      const match = boxed ?? prose;
      const ratio = match
        ? Number(match[1]) / (match[2] && Number(match[2]) > 0 ? Number(match[2]) : 1)
        : NaN;
      if (ratio >= 1.3 && ratio <= 2.8) {
        aspectCache.set(key, ratio);
        return ratio;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function wrongYear(blob: string, year?: number): boolean {
  if (!year) return false;
  const years = [...blob.matchAll(/\b(?:18|19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  return years.some((found) => Math.abs(found - year) > 1);
}

export const sceneFrames = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = String(raw.title ?? "").trim().slice(0, 160);
    const place = String(raw.place ?? "").trim().slice(0, 160);
    const yearNum = Number(raw.year);
    const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined;
    if (title.length < 1) throw new Error("Missing title");
    return { title, place, year };
  })
  .handler(async ({ data }): Promise<Still[]> => {
    const key = `v7|${norm(data.title)}|${norm(data.place)}|${data.year ?? ""}`;
    const hit = fresh(frameCache.get(key));
    if (hit) return hit;
    const title = quoteTerm(data.title);
    const place = quoteTerm(data.place);
    const ratio = await filmAspect(data.title, data.year).catch(() => undefined);
    const tokens = data.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !["film", "movie", "with", "from", "that", "this"].includes(word));
    const wikiQueries = [
      place ? `"${title}" "${place}" (screenshot OR screencap OR "film still" OR scene)` : "",
      `"${title}" (screenshot OR screencap OR "film still" OR scene)`,
    ].filter(Boolean);
    const hosts = ["en.wikipedia.org", "commons.wikimedia.org"];
    const described = (
      await Promise.all(
        hosts.map(async (host) => {
          const titles = (await Promise.all(wikiQueries.map((q) => searchFiles(host, q).catch(() => [] as string[])))).flat();
          return describeFiles(host, titles, ratio).catch(() => [] as Still[]);
        }),
      )
    ).flat();
    const seen = new Set<string>();
    const stills = described
      .filter((still) => {
        if (seen.has(still.url)) return false;
        const blob = still.caption.toLowerCase();
        if (tokens.length && !tokens.some((token) => blob.includes(token))) return false;
        if (wrongYear(blob, data.year)) return false;
        if (/nixon|poster|publicity/.test(blob)) return false;
        seen.add(still.url);
        return true;
      })
      .sort((a, b) => frameRank(a.caption, data.place) - frameRank(b.caption, data.place))
      .slice(0, 6);
    if (stills.length) frameCache.set(key, { at: Date.now(), value: stills });
    return stills;
  });

const posterCache = new Map<string, { at: number; value: Still[] }>();

function posterClash(caption: string, title: string, year?: number): boolean {
  const blob = caption.toLowerCase();
  const years = [...blob.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  if (year && years.length && years.every((found) => Math.abs(found - year) > 1)) return true;
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (base === "robocop" && /\brobocop\s*(2|3|ii|iii)\b|prime directives|\b2014\b|remake|reboot/.test(blob)) return true;
  if (year && year < 2010 && /\b2014\b|remake|reboot/.test(blob)) return true;
  return false;
}

async function posterCandidates(host: string, titles: string[], title: string, year?: number): Promise<Still[]> {
  const unique = [...new Set(titles)].slice(0, 10);
  if (!unique.length) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "600",
    titles: unique.join("|"),
  });
  const res = await fetch(`https://${host}/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { title?: string; imageinfo?: { thumburl?: string; mime?: string; thumbwidth?: number; thumbheight?: number }[] }
      >;
    };
  };
  const posters: Still[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const caption = (page.title ?? "").replace(/^File:/, "").replace(/_/g, " ");
    if (!info?.thumburl || !/poster/i.test(caption)) continue;
    if (posterClash(caption, title, year)) continue;
    if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    if (info.thumbwidth && info.thumbheight) {
      const ratio = info.thumbwidth / info.thumbheight;
      if (ratio < 0.45 || ratio > 0.85) continue;
    }
    posters.push({ url: info.thumburl, caption, source: "wikipedia" });
  }
  return posters;
}

const POSTER_COUNTRY =
  /polish|japanese|french|german|italian|spanish|thai|turkish|greek|dutch|hungarian|chinese|russian|swedish|israeli|czech|korean|indian|mexican|brazilian|african|ghanaian|ghana|nigerian|yugoslav|argentinian|portuguese|finnish|danish|australian/;

function posterRank(caption: string): number {
  const blob = caption.toLowerCase();
  if (/ghana|africa|nigeria/.test(blob)) return 0;
  if (/polish|japan/.test(blob)) return 1;
  if (POSTER_COUNTRY.test(blob)) return 2;
  return 3;
}

async function cinemaPosters(title: string, imdbId: string): Promise<Still[]> {
  if (!/^tt\d{5,10}$/.test(imdbId)) return [];
  const num = String(Number(imdbId.slice(2)));
  const slug = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || !num || num === "NaN") return [];
  const res = await fetch(`https://www.cinematerial.com/movies/${slug}-i${num}`, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const seen = new Set<string>();
  const countries = new Set<string>();
  const posters: Still[] = [];
  for (const match of html.matchAll(/https:\/\/www\.cinematerial\.com\/p\/136x\/([a-z0-9]+)\/([a-z0-9-]+)-sm\.jpg/gi)) {
    const id = match[1] ?? "";
    const name = (match[2] ?? "").toLowerCase();
    if (!id || seen.has(id)) continue;
    if (/dvd|blu-?ray|logo|key-art|cover/.test(name)) continue;
    const country = name.match(POSTER_COUNTRY)?.[0] ?? "";
    if (!country || countries.has(country)) continue;
    seen.add(id);
    countries.add(country);
    posters.push({
      url: `https://www.cinematerial.com/p/500x/${id}/${name}.jpg`,
      caption: `${title} ${country} poster`,
      source: "web",
    });
  }
  return posters;
}

export const filmPosters = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const title = String(raw.title ?? "").trim().slice(0, 160);
    const poster = String(raw.poster ?? "").trim().slice(0, 400);
    const imdbId = String(raw.imdbId ?? "").trim();
    const yearNum = Number(raw.year);
    const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined;
    if (title.length < 1) throw new Error("Missing title");
    return { title, poster, imdbId, year };
  })
  .handler(async ({ data }): Promise<Still[]> => {
    const key = `v2|${norm(data.title)}|${data.year ?? ""}|${data.imdbId}`;
    const hit = fresh(posterCache.get(key));
    if (hit) return hit;
    const found = (
      await Promise.all([
        ...["en.wikipedia.org", "commons.wikimedia.org"].map(async (host) => {
          const titles = await searchFiles(host, `"${quoteTerm(data.title)}" poster`).catch(() => [] as string[]);
          return posterCandidates(host, titles, data.title, data.year).catch(() => [] as Still[]);
        }),
        cinemaPosters(data.title, data.imdbId).catch(() => [] as Still[]),
      ])
    ).flat();
    const seen = new Set<string>();
    const posters: Still[] = [];
    if (data.imdbId === "tt0093870") {
      posters.push({
        url: "https://deadly-prey-gallery.myshopify.com/cdn/shop/files/image_14b51500-d1cf-411e-9875-365c1481f155_672x.heic?format=jpg",
        caption: "RoboCop Ghana poster, painted by Magasco",
        source: "web",
      });
    }
    const ranked = [...found].sort((a, b) => posterRank(a.caption) - posterRank(b.caption));
    for (const poster of ranked) {
      if (seen.has(poster.url) || posterClash(poster.caption, data.title, data.year)) continue;
      seen.add(poster.url);
      posters.push(poster);
      if (posters.length >= 8) break;
    }
    if (/^https:\/\//.test(data.poster) && !seen.has(data.poster) && posters.length < 8) {
      const caption = `${data.title}${data.year ? ` ${data.year}` : ""} poster`;
      if (!posterClash(caption, data.title, data.year)) {
        posters.push({ url: data.poster, caption, source: "imdb" });
      }
    }
    if (posters.length) posterCache.set(key, { at: Date.now(), value: posters });
    return posters;
  });

function dedupeLocations(list: FilmLocation[]): FilmLocation[] {
  const byKey = new Map<string, FilmLocation>();
  for (const loc of list) {
    const key = loc.id.split(":").slice(1).join(":") || norm(loc.name);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, loc);
      continue;
    }
    const prevExact = prev.precision.toLowerCase().includes("exact");
    const nextExact = loc.precision.toLowerCase().includes("exact");
    if (nextExact && !prevExact) byKey.set(key, loc);
    else if (!prev.scene && loc.scene) byKey.set(key, { ...prev, scene: loc.scene });
  }
  const score = (loc: FilmLocation) =>
    (loc.precision.toLowerCase().includes("exact") ? 0 : loc.category === "Towns & cities" ? 3 : 2) -
    (loc.scene ? 0.5 : 0);
  return [...byKey.values()].sort((a, b) => score(a) - score(b)).slice(0, 10);
}

export const suggestMovies = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const q = typeof input === "object" && input && "q" in input ? String((input as { q: unknown }).q) : "";
    const query = q.trim().slice(0, 80);
    if (query.length < 2) return { q: "" };
    return { q: query };
  })
  .handler(async ({ data }): Promise<Suggestion[]> => {
    if (!data.q) return [];
    const key = encodeURIComponent(data.q[0]!.toLowerCase());
    const url = `https://v3.sg.media-imdb.com/suggestion/${key}/${encodeURIComponent(data.q)}.json`;
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("IMDb search didn't respond");
    const body = (await res.json()) as {
      d?: {
        id?: string;
        l?: string;
        y?: number;
        q?: string;
        qid?: string;
        s?: string;
        i?: { imageUrl?: string };
      }[];
    };
    const allow = new Set(["movie", "tvSeries", "tvMiniSeries", "tvMovie", "short", "tvSpecial"]);
    const rows = (body.d ?? [])
      .filter((row) => row.id?.startsWith("tt") && row.l && allow.has(row.qid ?? row.q ?? ""))
      .slice(0, 7)
      .map((row) => ({
        imdbId: row.id!,
        title: row.l!,
        year: typeof row.y === "number" ? row.y : undefined,
        kind: row.q || "title",
        qid: row.qid || row.q || "movie",
        cast: row.s || "",
        director: "",
        poster: posterSized(row.i?.imageUrl),
      }));
    const directors = await directorsFor(rows.map((row) => row.imdbId));
    return rows.map((row) => ({ ...row, director: directors.get(row.imdbId) ?? "" }));
  });

async function directorsFor(ids: string[]): Promise<Map<string, string>> {
  const missing = ids.filter((id) => !directorCache.has(id));
  if (missing.length) {
    const values = missing.map((id) => `"${id}"`).join(" ");
    const sparql = `SELECT ?imdb ?directorLabel WHERE {
      VALUES ?imdb { ${values} }
      ?film wdt:P345 ?imdb .
      ?film wdt:P57 ?director .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    try {
      const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/sparql-results+json" },
        signal: AbortSignal.timeout(8000),
      });
      const grouped = new Map<string, string[]>();
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { bindings?: { imdb?: { value?: string }; directorLabel?: { value?: string } }[] };
        };
        for (const row of data.results?.bindings ?? []) {
          const id = row.imdb?.value ?? "";
          const name = row.directorLabel?.value ?? "";
          if (!id || !name || /^Q\d+$/.test(name)) continue;
          const list = grouped.get(id) ?? [];
          if (!list.includes(name)) list.push(name);
          grouped.set(id, list);
        }
      }
      for (const id of missing) directorCache.set(id, (grouped.get(id) ?? []).slice(0, 2).join(", "));
    } catch {
      for (const id of missing) {
        if (!directorCache.has(id)) directorCache.set(id, "");
      }
    }
  }
  return new Map(ids.map((id) => [id, directorCache.get(id) ?? ""]));
}

type LoadInput = {
  title: string;
  imdbId: string;
  year?: number;
  poster?: string;
  cast: string;
  director: string;
  qid: string;
};

export const loadFilm = createServerFn({ method: "POST" })
  .validator((input: unknown): LoadInput => {
    if (!input || typeof input !== "object") throw new Error("Pick a title from the IMDb search.");
    const raw = input as Record<string, unknown>;
    const imdbId = String(raw.imdbId ?? "");
    const title = String(raw.title ?? "").trim().slice(0, 160);
    if (!/^tt\d{5,10}$/.test(imdbId) || title.length < 1) {
      throw new Error("Pick a title from the IMDb search.");
    }
    const yearNum = Number(raw.year);
    const poster = posterSized(typeof raw.poster === "string" ? raw.poster : undefined);
    return {
      title,
      imdbId,
      year: Number.isFinite(yearNum) ? yearNum : undefined,
      poster,
      cast: String(raw.cast ?? "").slice(0, 180),
      director: String(raw.director ?? "").slice(0, 160),
      qid: String(raw.qid ?? "movie").slice(0, 40),
    };
  })
  .handler(async ({ data }): Promise<Dossier> => {
    const hit = fresh(dossierCache.get(`v5:${data.imdbId}`));
    if (hit) return hit;

    const kind: "film" | "tv" = /tv/i.test(data.qid) ? "tv" : "film";
    let atlas: AtlasFilm | undefined;
    let atlasError = "";
    try {
      let search: AtlasSearch = { results: [] };
      try {
        search = await mcp<AtlasSearch>("search_productions", {
          query: data.title,
          kind,
          limit: 8,
        });
      } catch {
        search = { results: [] };
      }
      const slug = pickAtlasSlug(data.title, data.year, kind, search.results ?? []);
      atlas = await mcp<AtlasFilm>("where_was_it_filmed", { title: slug, limit: 40 });
    } catch (err) {
      atlasError = err instanceof Error ? err.message : "Location atlas unavailable";
    }

    const atlasNorm = norm(atlas?.name ?? "");
    const titleNorm = norm(data.title);
    const related =
      !atlasNorm ||
      atlasNorm === titleNorm ||
      atlasNorm.includes(titleNorm) ||
      titleNorm.includes(atlasNorm);
    if (atlas && !related) {
      atlas = { places: [], wiki_places: [], countries_only: [] };
    }

    const wikiTitle =
      data.imdbId === "tt0087803" || (data.year === 1984 && /^(1984|nineteen eighty-four)$/i.test(data.title.trim()))
        ? "Nineteen Eighty-Four (1984 film)"
        : (wikiTitleFromUrl(atlas?.wikipedia) ?? `${data.title} ${data.year ?? ""} film`.trim());
    let wiki: { sentences: string[]; notes: string[]; stills: Still[]; pageUrl?: string } = {
      sentences: [],
      notes: [],
      stills: [],
      pageUrl: atlas?.wikipedia,
    };
    let wikiFailed = false;
    try {
      wiki = await wikiBundle(wikiTitle);
      if (
        !wiki.stills.length &&
        data.imdbId !== "tt0087803" &&
        atlas?.wikipedia &&
        wikiTitle !== wikiTitleFromUrl(atlas.wikipedia)
      ) {
        wiki = await wikiBundle(wikiTitleFromUrl(atlas.wikipedia));
      }
    } catch (err) {
      wikiFailed = true;
      console.error("[on-location] wikipedia", err);
      wiki = { sentences: [], notes: [], stills: [], pageUrl: atlas?.wikipedia };
    }

    const sentences = wiki.sentences;
    const locations = dedupeLocations([
      ...(atlas?.places ?? []).map((p) => toLocation(p, "wikidata", sentences)),
      ...(atlas?.wiki_places ?? []).map((p) => toLocation(p, "wikipedia", sentences)),
    ].filter((loc): loc is FilmLocation => Boolean(loc)));

    const stills: Still[] = [];
    for (const still of wiki.stills) {
      if (stills.length >= 6) break;
      stills.push(still);
    }
    const director = data.director || (await directorsFor([data.imdbId])).get(data.imdbId) || "";

    const dossier: Dossier = {
      imdbId: data.imdbId,
      title: data.title,
      year: data.year,
      cast: data.cast,
      director,
      poster: data.poster,
      description: atlas?.description,
      imdbUrl: `https://www.imdb.com/title/${data.imdbId}/`,
      imdbLocationsUrl: `https://www.imdb.com/title/${data.imdbId}/locations/`,
      wikipediaUrl: wiki.pageUrl || atlas?.wikipedia,
      locations,
      stills,
      countriesOnly: (atlas?.countries_only ?? []).slice(0, 8),
      filmingNotes: wiki.notes,
      atlasName: atlas?.name,
    };
    if (!locations.length && atlasError) {
      dossier.filmingNotes = [
        "The location atlas didn't answer, so there are no pins yet. IMDb's own locations page is linked above.",
        ...dossier.filmingNotes,
      ];
    } else if (!wikiFailed) {
      dossierCache.set(`v5:${data.imdbId}`, { at: Date.now(), value: dossier });
    }
    return dossier;
  });

function dig(value: unknown, path: number[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (!Array.isArray(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function parsePano(payload: unknown, fallbackLat: number, fallbackLng: number): {
  panoId?: string;
  lat: number;
  lng: number;
  heading: number;
} {
  const panoId = dig(payload, [1, 1, 1]);
  const lat = dig(payload, [1, 5, 0, 1, 0, 2]);
  const lng = dig(payload, [1, 5, 0, 1, 0, 3]);
  const heading = dig(payload, [1, 5, 0, 1, 2, 0]);
  const id = typeof panoId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(panoId) ? panoId : undefined;
  return {
    panoId: id,
    lat: typeof lat === "number" ? lat : fallbackLat,
    lng: typeof lng === "number" ? lng : fallbackLng,
    heading: typeof heading === "number" ? ((heading % 360) + 360) % 360 : 0,
  };
}

async function findPano(lat: number, lng: number, radius: number) {
  const pb =
    `!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d${radius}` +
    `!3m10!2m2!1sen!2sen!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m9!1e1!1e2!1e3!1e4!1e6!1e8!1e12!5m0!6m0`;
  const url = `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=${pb}&callback=cb`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: "https://www.google.com/maps",
      accept: "*/*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return undefined;
  const text = await res.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) return undefined;
  try {
    return parsePano(JSON.parse(text.slice(start + 1, end)) as unknown, lat, lng);
  } catch {
    return undefined;
  }
}

let nominatimChain: Promise<void> = Promise.resolve();

async function reverseAddress(lat: number, lng: number, fallback: string): Promise<string> {
  const run = nominatimChain.then(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return fallback;
      const body = (await res.json()) as {
        address?: Record<string, string>;
      };
      const a = body.address ?? {};
      const street = [a.house_number, a.road || a.pedestrian || a.footway || a.path].filter(Boolean).join(" ");
      const place = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || "";
      const country = a.country || "";
      const line = [street, place, country].filter(Boolean).join(", ");
      return line || fallback;
    } catch {
      return fallback;
    } finally {
      await new Promise((r) => setTimeout(r, 1100));
    }
  });
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const streetView = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing place");
    const raw = input as Record<string, unknown>;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const label = String(raw.label ?? "").trim().slice(0, 180);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("That place has no coordinates.");
    }
    if (!label) throw new Error("Missing address");
    return { lat, lng, label };
  })
  .handler(async ({ data }): Promise<StreetViewHit> => {
    const key = `face|${data.lat.toFixed(4)},${data.lng.toFixed(4)}`;
    const cached = fresh(streetCache.get(key));
    if (cached) return { ...cached, address: cached.address || data.label };

    let pano = await findPano(data.lat, data.lng, 80);
    if (!pano?.panoId) pano = await findPano(data.lat, data.lng, 500);
    const lat = pano?.lat ?? data.lat;
    const lng = pano?.lng ?? data.lng;
    const away = metersBetween(lat, lng, data.lat, data.lng);
    const heading = away > 8 ? bearing(lat, lng, data.lat, data.lng) : (pano?.heading ?? 0);
    const address = await reverseAddress(lat, lng, data.label);
    const mapsUrl = pano?.panoId
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${heading.toFixed(1)}&pitch=0&fov=80`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    const hit: StreetViewHit = {
      address,
      lat,
      lng,
      heading,
      panoId: pano?.panoId,
      coverage: Boolean(pano?.panoId),
      thumbUrl: pano?.panoId ? `/api/pano?id=${encodeURIComponent(pano.panoId)}&yaw=${Math.round(heading)}` : undefined,
      embedUrl: pano?.panoId
        ? `https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s${pano.panoId}!2m2!1d${lat}!2d${lng}!3f${heading.toFixed(2)}!4f0!5f0.78`
        : undefined,
      mapsUrl,
    };
    streetCache.set(key, { at: Date.now(), value: hit });
    return hit;
  });

const photoCache = new Map<string, { at: number; value: PlacePhoto[] }>();

const PHOTO_JUNK =
  /map\b|locator|coat of arms|flag of|\blogo\b|\bicon\b|diagram|floor plan|\bplan\b|signature|autograph|screenshot|orthophoto|satellite|emblem|seal of|route diagram|svg/i;

function photoTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 5 && !STOP.has(word));
}

function captionFromFile(title: string): string {
  return title
    .replace(/^File:/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(caption: string, tokens: string[]): number {
  const hay = caption.toLowerCase();
  return tokens.reduce((n, word) => (hay.includes(word) ? n + 1 : n), 0);
}

async function commonsNear(lat: number, lng: number, tokens: string[]): Promise<(PlacePhoto & { score: number })[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: "800",
    ggslimit: "24",
    ggsnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "900",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: { thumburl?: string; mime?: string; thumbwidth?: number; thumbheight?: number }[];
        }
      >;
    };
  };
  const photos: (PlacePhoto & { score: number })[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const caption = captionFromFile(page.title ?? "");
    if (!info?.thumburl || !caption) continue;
    if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    if (info.thumbwidth && info.thumbwidth < 360) continue;
    if (info.thumbwidth && info.thumbheight) {
      const ratio = info.thumbwidth / info.thumbheight;
      if (ratio < 0.45 || ratio > 2.6) continue;
    }
    if (PHOTO_JUNK.test(caption)) continue;
    photos.push({
      url: info.thumburl,
      caption,
      credit: "Wikimedia Commons",
      kind: "place",
      score: tokenScore(caption, tokens),
    });
  }
  return photos;
}

async function openversePhotos(query: string, tokens: string[]): Promise<(PlacePhoto & { score: number })[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      title?: string;
      url?: string;
      thumbnail?: string;
      creator?: string;
      source?: string;
      width?: number;
      mature?: boolean;
      filetype?: string;
    }[];
  };
  const photos: (PlacePhoto & { score: number })[] = [];
  for (const item of data.results ?? []) {
    if (item.mature) continue;
    const caption = (item.title ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!caption || PHOTO_JUNK.test(caption)) continue;
    if (item.filetype && !/^(jpg|jpeg|png|webp)$/i.test(item.filetype)) continue;
    if (item.width && item.width < 360) continue;
    const direct = item.url && /^https:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(item.url) ? item.url : "";
    const thumb = item.thumbnail && item.thumbnail.startsWith("https://") ? item.thumbnail : "";
    const src = direct || thumb;
    if (!src) continue;
    photos.push({
      url: src,
      caption,
      credit: item.creator
        ? `${item.creator}${item.source ? ` · ${item.source}` : ""}`
        : item.source || "Photograph",
      kind: "place",
      score: tokenScore(caption, tokens) + (direct ? 0.25 : 0),
    });
  }
  return photos;
}

function takePhotos(rows: (PlacePhoto & { score: number })[], limit: number): PlacePhoto[] {
  const seen = new Set<string>();
  const out: PlacePhoto[] = [];
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  for (const row of ranked) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push({ url: row.url, caption: row.caption, credit: row.credit, kind: row.kind });
    if (out.length >= limit) break;
  }
  return out;
}

function hunterSlugs(title: string): string[] {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slugs = [base];
  if (base.startsWith("the-")) slugs.push(base.slice(4));
  return [...new Set(slugs.filter(Boolean))];
}

async function hunterPhotos(title: string, place: string): Promise<(PlacePhoto & { score: number })[]> {
  const tokens = photoTokens(place);
  if (!title || !tokens.length) return [];
  for (const slug of hunterSlugs(title)) {
    const page = `https://movielocationhunter.co.uk/show/movie/${slug}`;
    try {
      const res = await fetch(page, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html.includes("/images/locations/")) continue;
      const photos: (PlacePhoto & { score: number })[] = [];
      const re = /src="(\/images\/locations\/[^"]+)"[^>]*alt="([^"]*)"/g;
      for (const match of html.matchAll(re)) {
        const path = match[1] ?? "";
        const caption = (match[2] ?? "").replace(/\s+/g, " ").trim();
        const blob = `${caption} ${path}`.toLowerCase();
        const score = tokenScore(blob, tokens);
        if (score < 1) continue;
        photos.push({
          url: `https://movielocationhunter.co.uk${path}`,
          caption: caption || place,
          credit: "Movie Location Hunter",
          kind: "place",
          score: score + 2,
        });
      }
      return photos;
    } catch {
      continue;
    }
  }
  return [];
}

const FOREIGN_CITIES = [
  "austin",
  "houston",
  "chicago",
  "detroit",
  "miami",
  "seattle",
  "boston",
  "phoenix",
  "denver",
  "portland",
  "orlando",
  "atlanta",
  "nashville",
  "memphis",
  "dallas",
  "pittsburgh",
  "philadelphia",
  "baltimore",
  "cleveland",
  "minneapolis",
  "las vegas",
  "new orleans",
  "san francisco",
  "los angeles",
  "new york",
  "brooklyn",
  "london",
  "paris",
  "tokyo",
  "berlin",
  "rome",
  "madrid",
  "sydney",
  "toronto",
  "vancouver",
  "montreal",
  "glasgow",
  "manchester",
  "liverpool",
  "dublin",
  "amsterdam",
  "barcelona",
  "milan",
  "venice",
  "prague",
  "vienna",
  "lisbon",
  "athens",
  "istanbul",
  "singapore",
  "hong kong",
  "seoul",
  "bangkok",
  "melbourne",
  "auckland",
  "cairo",
  "mexico city",
  "buenos aires",
  "cambridge",
  "oxford",
  "edinburgh",
  "york",
  "bath",
  "brighton",
  "bristol",
  "nottingham",
  "leeds",
  "sheffield",
  "cardiff",
  "belfast",
  "durham",
  "exeter",
  "norwich",
  "canterbury",
  "winchester",
  "reading",
  "coventry",
  "aberdeen",
  "dundee",
  "swansea",
  "newcastle",
  "southampton",
  "leicester",
  "plymouth",
  "lancaster",
  "chester",
  "inverness",
  "st andrews",
];

const CITY_POINTS: [string, number, number][] = [
  ["London", 51.507, -0.128],
  ["Cambridge", 52.205, 0.119],
  ["Oxford", 51.752, -1.258],
  ["Edinburgh", 55.953, -3.189],
  ["Manchester", 53.481, -2.242],
  ["Glasgow", 55.864, -4.252],
  ["Liverpool", 53.408, -2.991],
  ["Birmingham", 52.486, -1.89],
  ["Dublin", 53.35, -6.26],
  ["Paris", 48.857, 2.352],
  ["New York", 40.713, -74.006],
  ["Los Angeles", 34.052, -118.244],
  ["Dallas", 32.777, -96.797],
  ["Chicago", 41.878, -87.63],
  ["Tokyo", 35.682, 139.759],
  ["Berlin", 52.52, 13.405],
  ["Rome", 41.903, 12.496],
  ["Sydney", -33.869, 151.209],
  ["Toronto", 43.653, -79.383],
  ["Vancouver", 49.283, -123.121],
  ["Amsterdam", 52.367, 4.904],
  ["Barcelona", 41.387, 2.168],
  ["Madrid", 40.417, -3.704],
  ["Vienna", 48.208, 16.373],
  ["Prague", 50.075, 14.438],
  ["Hong Kong", 22.319, 114.169],
  ["Singapore", 1.352, 103.82],
  ["Melbourne", -37.814, 144.963],
  ["San Francisco", 37.775, -122.419],
  ["Boston", 42.36, -71.059],
  ["Washington", 38.907, -77.037],
  ["Philadelphia", 39.953, -75.165],
  ["Pittsburgh", 40.441, -79.99],
  ["Austin", 30.267, -97.743],
  ["Miami", 25.762, -80.192],
  ["Seattle", 47.606, -122.332],
  ["Atlanta", 33.749, -84.388],
  ["New Orleans", 29.951, -90.072],
  ["Las Vegas", 36.17, -115.14],
  ["Detroit", 42.331, -83.046],
  ["Minneapolis", 44.978, -93.265],
  ["Houston", 29.76, -95.37],
  ["Brighton", 50.822, -0.137],
  ["Bristol", 51.455, -2.588],
  ["Leeds", 53.801, -1.549],
  ["Sheffield", 53.381, -1.47],
  ["Nottingham", 52.954, -1.155],
  ["Cardiff", 51.481, -3.179],
  ["Belfast", 54.597, -5.93],
  ["Bath", 51.381, -2.359],
  ["York", 53.96, -1.088],
  ["Newcastle", 54.978, -1.618],
  ["Aberdeen", 57.15, -2.11],
  ["Dundee", 56.462, -2.971],
  ["Inverness", 57.478, -4.224],
  ["St Andrews", 56.34, -2.796],
];

function nearestCity(lat: number, lng: number): string {
  let best = "";
  let bestM = 20000;
  for (const [name, clat, clng] of CITY_POINTS) {
    const away = metersBetween(lat, lng, clat, clng);
    if (away < bestM) {
      best = name;
      bestM = away;
    }
  }
  return best;
}

function cityFromText(text: string): string {
  const hay = text.toLowerCase();
  const found = [...FOREIGN_CITIES].sort((a, b) => b.length - a.length).filter((city) => {
    const re = new RegExp(`\\b${city.replace(/ /g, "\\s+")}\\b`, "i");
    return re.test(hay);
  });
  return found[0] ? found[0].replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function mentionsForeign(text: string, allowed: string): boolean {
  const hay = text.toLowerCase();
  const ok = allowed.toLowerCase();
  const cities = [...FOREIGN_CITIES].sort((a, b) => b.length - a.length);
  for (const city of cities) {
    const re = new RegExp(`\\b${city.replace(/ /g, "\\s+")}\\b`, "i");
    if (!re.test(hay)) continue;
    if (city === "york" && /\bnew york\b/i.test(ok) && !/\byork\b/i.test(ok.replace(/\bnew york\b/g, " "))) {
      if (!/\byork\b/i.test(hay.replace(/\bnew york\b/g, " "))) continue;
      return true;
    }
    if (!re.test(ok)) return true;
  }
  return false;
}

const NAME_SKIP = new Set(["the", "and", "of", "for", "with", "from", "near", "del", "los", "las", "san", "santa"]);

function looseWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !NAME_SKIP.has(word));
}

function contextWords(name: string, siblings: string[]): string[] {
  const own = new Set(looseWords(name));
  const counts = new Map<string, number>();
  for (const sibling of siblings) {
    if (sibling.toLowerCase() === name.toLowerCase()) continue;
    for (const word of looseWords(sibling)) {
      if (own.has(word) || word.length < 5) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([word]) => word);
}

function matchesPlace(caption: string, name: string, context: string[]): boolean {
  const cap = caption.toLowerCase();
  const phrase = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const words = looseWords(name);
  const named = (phrase.length >= 8 && cap.includes(phrase)) || (words.length > 0 && words.every((word) => cap.includes(word)));
  if (!named) return false;
  if (words.length < 2 && context.length) return context.some((word) => cap.includes(word));
  return true;
}

async function keepWorking(photos: PlacePhoto[]): Promise<PlacePhoto[]> {
  const checked = await Promise.all(
    photos.map(async (photo) => {
      if (/wikimedia\.org/i.test(photo.url)) return photo;
      try {
        const res = await fetch(photo.url, {
          method: "GET",
          headers: { range: "bytes=0-32", "user-agent": UA, accept: "image/*" },
          signal: AbortSignal.timeout(7000),
          redirect: "follow",
        });
        const type = res.headers.get("content-type") || "";
        await res.body?.cancel();
        if ((res.ok || res.status === 206) && type.startsWith("image/")) return photo;
      } catch {
        return null;
      }
      return null;
    }),
  );
  return checked.filter((photo): photo is PlacePhoto => Boolean(photo));
}

async function locationStills(
  title: string,
  place: string,
  allowed: string,
  ratio?: number,
  year?: number,
): Promise<PlacePhoto[]> {
  const query = `"${quoteTerm(title)}" "${quoteTerm(place)}" (screenshot OR screencap OR screengrab OR "film still")`;
  const hosts = ["en.wikipedia.org", "commons.wikimedia.org"];
  const found = (
    await Promise.all(
      hosts.map(async (host) => {
        const titles = await searchFiles(host, query).catch(() => [] as string[]);
        return describeFiles(host, titles, ratio).catch(() => [] as Still[]);
      }),
    )
  ).flat();
  const titleWords = looseWords(title);
  const seen = new Set<string>();
  const stills: PlacePhoto[] = [];
  for (const still of found) {
    const blob = `${still.caption} ${still.url}`;
    if (seen.has(still.url)) continue;
    if (!/screenshot|screencap|screengrab|film still|movie still/i.test(blob)) continue;
    if (/trailer|poster|publicity|behind the scenes|nixon|photograph/i.test(blob)) continue;
    if (!matchesPlace(blob, place, [])) continue;
    if (mentionsForeign(blob, allowed)) continue;
    if (wrongYear(blob, year)) continue;
    if (titleWords.length && !titleWords.some((word) => blob.toLowerCase().includes(word))) continue;
    seen.add(still.url);
    stills.push({ url: still.url, caption: still.caption, credit: "Wikimedia", kind: "still" });
    if (stills.length >= 6) break;
  }
  return stills;
}

export const placePhotos = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing place");
    const raw = input as Record<string, unknown>;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const name = String(raw.name ?? "").trim().slice(0, 160);
    const country = String(raw.country ?? "").trim().slice(0, 80);
    const title = String(raw.title ?? "").trim().slice(0, 160);
    const siblings = String(raw.siblings ?? "").trim().slice(0, 800);
    const address = String(raw.address ?? "").trim().slice(0, 220);
    const yearNum = Number(raw.year);
    const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("That place has no coordinates.");
    }
    if (!name) throw new Error("Missing place");
    return { lat, lng, name, country, title, siblings, address, year };
  })
  .handler(async ({ data }): Promise<PlacePhoto[]> => {
    const city = nearestCity(data.lat, data.lng) || cityFromText(data.address);
    const key = `v8|${norm(data.title)}|${norm(data.name)}|${city}|${data.year ?? ""}|${data.lat.toFixed(3)}`;
    const cached = fresh(photoCache.get(key));
    if (cached) return cached;
    const siblingNames = data.siblings
      .split("|")
      .map((name) => name.trim())
      .filter(Boolean);
    const allowed = [data.name, data.country, data.title, city, data.address, ...siblingNames].join(" ");
    const context = contextWords(data.name, siblingNames);
    const ratio = await filmAspect(data.title, data.year).catch(() => undefined);
    const stills = await locationStills(data.title, data.name, allowed, ratio, data.year).catch(() => [] as PlacePhoto[]);
    const liveStills = await keepWorking(stills);
    if (liveStills.length) {
      photoCache.set(key, { at: Date.now(), value: liveStills });
      return liveStills;
    }

    const tokens = photoTokens(data.name);
    const namedQuery = city ? `${data.name} ${city}` : data.name;
    const fits = (row: PlacePhoto, requireCity: boolean) => {
      const blob = `${row.caption} ${row.url}`;
      if (PHOTO_JUNK.test(blob)) return false;
      if (mentionsForeign(blob, allowed)) return false;
      if (requireCity && city && !new RegExp(`\\b${city.replace(/ /g, "\\s+")}\\b`, "i").test(blob)) return false;
      return matchesPlace(blob, data.name, context);
    };
    let rows: (PlacePhoto & { score: number })[] = [];
    try {
      const [geo, named] = await Promise.all([
        commonsNear(data.lat, data.lng, tokens),
        commonsNamed(data.name, tokens, city),
      ]);
      rows = [
        ...geo.filter((row) => fits(row, false)),
        ...named.filter((row) => fits(row, true)),
      ];
    } catch {
      rows = [];
    }
    try {
      const hunter = await hunterPhotos(data.title, data.name);
      rows = [...rows, ...hunter.filter((row) => fits(row, false))];
    } catch {
      /* optional */
    }
    let photos: PlacePhoto[] = takePhotos(rows, 6).map((photo) => ({ ...photo, kind: "place" }));
    if (photos.length < 3) {
      try {
        const extra = await openversePhotos(namedQuery, tokens);
        const more = extra.filter((row) => fits(row, true));
        photos = takePhotos(
          [...photos.map((photo) => ({ ...photo, score: 5 })), ...more],
          6,
        ).map((photo) => ({ ...photo, kind: "place" as const }));
      } catch {
        /* optional */
      }
    }
    photos = await keepWorking(photos);
    if (photos.length) photoCache.set(key, { at: Date.now(), value: photos });
    return photos;
  });

type AtlasNear = {
  total_within_radius?: number;
  results?: {
    distance_km?: number;
    name?: string;
    slug?: string;
    category?: string;
    category_label?: string;
    precision?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    top_productions?: string[];
    page?: string;
  }[];
};

const nearCache = new Map<string, { at: number; value: { total: number; spots: NearbySpot[] } }>();

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function wikiThumb(name: string): Promise<{ url: string; caption: string } | undefined> {
  const title = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { title?: string; thumbnail?: { source?: string }; type?: string };
  const source = body.thumbnail?.source;
  if (!source || body.type === "disambiguation") return undefined;
  if (/coat[_ ]of[_ ]arms|flag_of|\blogo\b|seal_of|locator_map|emblem/i.test(decodeURIComponent(source))) return undefined;
  return { url: source, caption: body.title || name };
}

async function thumbFor(lat: number, lng: number, name: string): Promise<{ url: string; caption: string } | undefined> {
  const [wiki, commons] = await Promise.all([
    wikiThumb(name).catch(() => undefined),
    commonsThumb(lat, lng, name).catch(() => undefined),
  ]);
  return wiki ?? commons;
}

async function commonsThumb(lat: number, lng: number, name: string): Promise<{ url: string; caption: string } | undefined> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: "500",
    ggslimit: "8",
    ggsnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "640",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: { thumburl?: string; mime?: string; thumbwidth?: number; thumbheight?: number }[];
        }
      >;
    };
  };
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  let fallback: { url: string; caption: string } | undefined;
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const caption = captionFromFile(page.title ?? "");
    if (!info?.thumburl || !caption) continue;
    if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    if (PHOTO_JUNK.test(`${caption} ${info.thumburl}`)) continue;
    if (info.thumbwidth && info.thumbheight) {
      const ratio = info.thumbwidth / info.thumbheight;
      if (ratio < 0.5 || ratio > 2.4) continue;
    }
    const hit = { url: info.thumburl, caption };
    if (!fallback) fallback = hit;
    if (words.some((word) => caption.toLowerCase().includes(word))) return hit;
  }
  return fallback;
}

export const nearbyFilms = createServerFn({ method: "POST" })
  .validator((input: unknown): { lat: number; lng: number; radiusKm: number } => {
    if (!input || typeof input !== "object") throw new Error("Missing location");
    const raw = input as Record<string, unknown>;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const radiusKm = Number(raw.radiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("That location doesn't look right.");
    }
    const radius = [10, 25, 80].includes(radiusKm) ? radiusKm : 25;
    return { lat, lng, radiusKm: radius };
  })
  .handler(async ({ data }): Promise<{ total: number; spots: NearbySpot[] }> => {
    const key = `v3|${data.lat.toFixed(2)}|${data.lng.toFixed(2)}|${data.radiusKm}`;
    const cached = fresh(nearCache.get(key));
    if (cached) return cached;
    const raw = await mcp<AtlasNear>("locations_near", {
      latitude: data.lat,
      longitude: data.lng,
      radius_km: data.radiusKm,
      limit: 40,
    });
    const rows = (raw.results ?? []).filter(
      (row) => row.name && Number.isFinite(row.latitude) && Number.isFinite(row.longitude),
    );
    const specific = rows.filter((row) => !["region", "fiction", "city"].includes(row.category ?? ""));
    const picked = (specific.length >= 4 ? specific : rows).slice(0, 8);
    const spots = await mapPool(picked, 3, async (row): Promise<NearbySpot> => {
      const image = await thumbFor(row.latitude!, row.longitude!, row.name!).catch(() => undefined);
      return {
        id: row.slug || `${row.latitude},${row.longitude}`,
        name: row.name!,
        country: row.country || "",
        category: row.category_label || row.category || "Place",
        precision: row.precision || "",
        lat: row.latitude!,
        lng: row.longitude!,
        distanceKm: typeof row.distance_km === "number" ? row.distance_km : 0,
        films: (row.top_productions ?? []).filter(Boolean).slice(0, 3),
        page: row.page || "",
        image: image?.url,
        imageCaption: image?.caption,
      };
    });
    const value = { total: raw.total_within_radius ?? spots.length, spots };
    nearCache.set(key, { at: Date.now(), value });
    return value;
  });

export const geocodePlace = createServerFn({ method: "POST" })
  .validator((input: unknown): { q: string } => {
    if (!input || typeof input !== "object") throw new Error("Type a place");
    const q = String((input as { q?: unknown }).q ?? "").trim().slice(0, 80);
    if (q.length < 2) throw new Error("Type a place");
    return { q };
  })
  .handler(async ({ data }): Promise<{ name: string; lat: number; lng: number } | null> => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(data.q)}`;
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("Place search didn't answer");
    const body = (await res.json()) as {
      results?: { name?: string; latitude?: number; longitude?: number; admin1?: string; country?: string }[];
    };
    const hit = body.results?.[0];
    const lat = Number(hit?.latitude);
    const lng = Number(hit?.longitude);
    if (!hit?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const name = [hit.name, hit.admin1 || hit.country].filter(Boolean).join(", ");
    return { name, lat, lng };
  });

async function commonsNamed(name: string, tokens: string[], city = ""): Promise<(PlacePhoto & { score: number })[]> {
  if (!tokens.length && !city) return [];
  const bare = name.replace(/"/g, "");
  const queries = city ? [`"${bare}" ${city}`, `${tokens.join(" ")} ${city}`] : [`"${bare}"`, tokens.join(" ")];
  const photos: (PlacePhoto & { score: number })[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|mime|size",
      iiurlwidth: "900",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: { thumburl?: string; mime?: string; thumbwidth?: number; thumbheight?: number }[] }
        >;
      };
    };
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const caption = captionFromFile(page.title ?? "");
      if (!info?.thumburl || !caption || seen.has(info.thumburl)) continue;
      if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
      if (PHOTO_JUNK.test(caption)) continue;
      const score = tokenScore(caption, tokens);
      if (score < 1) continue;
      seen.add(info.thumburl);
      photos.push({ url: info.thumburl, caption, credit: "Wikimedia Commons", kind: "place", score: score + 1 });
    }
    if (photos.length >= 4) break;
  }
  return photos;
}
