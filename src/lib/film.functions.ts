// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { GOOD_FAVES, shuffleNine } from "@/lib/good-faves";
var UA = "OnLocation/1.0 (film street explorer)";
var ATLAS = "https://moviescenemap.com/mcp";
var dossierCache = /* @__PURE__ */ new Map();
var streetCache = /* @__PURE__ */ new Map();
var frameCache = /* @__PURE__ */ new Map();
var directorCache = /* @__PURE__ */ new Map();
var TTL = 18e5;
function fresh(entry) {
	if (!entry) return void 0;
	if (Date.now() - entry.at > TTL) return void 0;
	return entry.value;
}
async function mcp(name, args) {
	const res = await fetch(ATLAS, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream"
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name,
				arguments: args
			}
		}),
		signal: AbortSignal.timeout(14e3)
	});
	if (!res.ok) throw new Error(`Location atlas returned ${res.status}`);
	const body = await res.json();
	if (body.error) throw new Error(body.error.message || "Location atlas error");
	const text = body.result?.content?.find((c) => c.type === "text")?.text;
	if (!text) throw new Error("Empty location atlas response");
	return JSON.parse(text);
}
function posterSized(url) {
	if (!url) return void 0;
	if (!/^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)\//.test(url)) return;
	return url.replace(/\._V1_[^.]*\.jpg$/i, "._V1_SX720_.jpg");
}
function wikiTitleFromUrl(url) {
	if (!url) return void 0;
	try {
		const part = new URL(url).pathname.split("/").filter(Boolean).pop();
		if (!part) return void 0;
		return decodeURIComponent(part).replace(/_/g, " ");
	} catch {
		return;
	}
}
var STOP = /* @__PURE__ */ new Set([
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
	"place"
]);
var COMMON_PLACE = /* @__PURE__ */ new Set([
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
	"brazil"
]);
function tokens(name) {
	return name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
}
function sentencesOf(text) {
	return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z“"])/).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 520);
}
var FILMING_HINT = /filmed|filming|was shot|were shot|shot at|shot in|shot on|on location|principal photography|sound stage|locations and sets/i;
function matchScene(name, sentences) {
	const words = tokens(name);
	if (!words.length) return void 0;
	let best;
	for (const sentence of sentences) {
		if (!FILMING_HINT.test(sentence)) continue;
		const hay = sentence.toLowerCase();
		const hits = words.filter((w) => hay.includes(w));
		if (!hits.length) continue;
		if (hits.every((w) => COMMON_PLACE.has(w)) && hits.length < 2) continue;
		const score = hits.reduce((n, w) => n + w.length, 0);
		if (!best || score > best.score) best = {
			score,
			text: sentence
		};
	}
	return best && best.score >= 5 ? best.text : void 0;
}
function rankOf(place) {
	const precision = (place.precision ?? "").toLowerCase();
	const category = (place.category ?? "").toLowerCase();
	if (category === "fiction" || category === "region") return 9;
	if (precision.includes("exact")) return 0;
	if (category === "street" || precision.includes("street") || precision.includes("block")) return 1;
	if (category === "landmark" || category === "castle" || category === "studio" || category === "nature") return 2;
	if (category === "city" || precision.includes("town")) return 3;
	return 4;
}
function precisionNote(place, source) {
	const via = source === "wikidata" ? "Wikidata filming location" : "named in the Wikipedia article";
	const precision = (place.precision ?? "").toLowerCase();
	if (precision.includes("exact")) return `Exact site · ${via}`;
	if (precision.includes("town") || (place.category ?? "") === "city") return `Town-level pin · ${via}. Street View opens at the center of the place, not one marked set.`;
	return `Approximate pin · ${via}`;
}
function isSpecificSite(place) {
	const precision = (place.precision ?? "").toLowerCase();
	const category = (place.category ?? "").toLowerCase();
	const name = (place.name ?? "").trim();
	if (!name) return false;
	if (category === "city" || category === "region" || category === "fiction") return false;
	if (/^(downtown|city centre|city center|old town|town centre|historic cent(er|re))$/i.test(name)) return false;
	const numbered = /\b\d{1,5}[a-z]?\b/i.test(name);
	const street = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|boulevard|blvd\.?|drive|dr\.?|way|place|square|sq\.?|terrace|crescent|row|alley|quay|embankment|promenade|bridge|highway|route|close|court|gardens|gate|mews|circus|parade|walk|wharf|pier)\b/i.test(name);
	const building = /\b(building|hall|hotel|station|theatre|theater|church|cathedral|chapel|museum|tower|house|plaza|centre|center|palace|school|university|college|hospital|airport|stadium|arena|castle|abbey|temple|library|market|factory|mill|warehouse|terminal|dock|steps|studio|studios)\b/i.test(name);
	if (/town|city|country|region|village/.test(precision) && !numbered && !street && !building) return false;
	if (numbered || street || building) return true;
	if (name.split(/\s+/).filter(Boolean).length >= 2 && (category === "landmark" || category === "castle" || category === "building" || category === "studio")) return true;
	return false;
}
function toLocation(place, source, sentences) {
	if (!isSpecificSite(place)) return void 0;
	if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return void 0;
	if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return void 0;
	if (rankOf(place) >= 9) return void 0;
	const name = (place.name ?? "").trim();
	if (!name) return void 0;
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
		precisionNote: precisionNote(place, source)
	};
}
function norm(s) {
	return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function pickAtlasSlug(title, year, kind, results) {
	let best = title;
	let bestScore = 0;
	const want = norm(title);
	for (const row of results) {
		if (row.kind && row.kind !== kind && row.kind !== "anime") continue;
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
async function wikiGet(params) {
	const query = new URLSearchParams({
		format: "json",
		...params
	});
	const res = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
	return await res.json();
}
function stripHtml(html) {
	return html.replace(/<figure\b[\s\S]*?<\/figure>/gi, " ").replace(/<table\b[\s\S]*?<\/table>/gi, " ").replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\[\s*edit\s*\]/gi, " ").replace(/&nbsp;/g, " ").replace(/* @__PURE__ */ new RegExp("&amp;", "g"), "&").replace(/* @__PURE__ */ new RegExp("&quot;", "g"), "\"").replace(/* @__PURE__ */ new RegExp("&#(\\d+);", "g"), (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").replace(/^(locations and sets|filming locations)\s+/i, "").trim();
}
async function wikiBundle(title) {
	if (!title) return {
		sentences: [],
		notes: [],
		stills: []
	};
	let page = title;
	let sections = [];
	const parsed = (await wikiGet({
		action: "parse",
		page,
		prop: "sections",
		redirects: "1"
	})).parse;
	if (!parsed) {
		const hit = ((await wikiGet({
			action: "query",
			list: "search",
			srsearch: `${title} film`,
			srlimit: "1"
		})).query?.search ?? [])[0]?.title;
		if (!hit) return {
			sentences: [],
			notes: [],
			stills: []
		};
		page = hit;
		const again = await wikiGet({
			action: "parse",
			page,
			prop: "sections",
			redirects: "1"
		});
		sections = again.parse?.sections ?? [];
		page = again.parse?.title ?? page;
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
		const score = (line) => /filming locations|locations and sets|principal photography/i.test(line) ? 0 : 1;
		return score(a.line ?? "") - score(b.line ?? "");
	});
	const section = candidates[0];
	let sentences = [];
	if (section?.index) sentences = sentencesOf(stripHtml(((await wikiGet({
		action: "parse",
		page,
		prop: "text",
		section: section.index,
		redirects: "1"
	})).parse?.text ?? {})["*"] ?? "").slice(0, 9e3));
	const notes = sentences.filter((s) => FILMING_HINT.test(s)).slice(0, 3);
	const pages = (await wikiGet({
		action: "query",
		redirects: "1",
		prop: "images",
		imlimit: "40",
		titles: page
	})).query?.pages;
	const stills = await wikiThumbs(Object.values(pages ?? {}).flatMap((p) => p.images ?? []).map((im) => im.title ?? "").filter((name) => /\.(jpe?g|png|webp|gif|webm|ogv|mp4)$/i.test(name)).filter((name) => !/logo|icon|symbol|commons|edit-ltr|flag of|wikidata|wordmark|premiere|red carpet|wondercon|comic-?con|festival/i.test(name)).slice(0, 12));
	const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
	return {
		sentences,
		notes,
		stills,
		pageUrl
	};
}
async function wikiThumbs(files) {
	if (!files.length) return [];
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		prop: "imageinfo|categories",
		iiprop: "url|mime|size|extmetadata",
		iiurlwidth: "1000",
		cllimit: "12",
		titles: files.slice(0, 12).join("|")
	});
	const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!res.ok) return [];
	const data = await res.json();
	const stills = [];
	for (const page of Object.values(data.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		if (!info?.thumburl) continue;
		const thumbIsImage = /\.(jpe?g|png|webp)(\?|$)/i.test(info.thumburl);
		const mimeOk = !info.mime || /^image\/(jpeg|png|webp|gif)$/.test(info.mime);
		if (!thumbIsImage || !mimeOk) continue;
		const caption = (page.title ?? "Still").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
		const cats = (page.categories ?? []).map((c) => c.title ?? "");
		const desc = (info.extmetadata?.ImageDescription?.value ?? "").replace(/<[^>]+>/g, " ");
		if (!isFrame(caption, info.thumbwidth, info.thumbheight, cats, desc)) continue;
		stills.push({
			url: info.thumburl,
			caption,
			source: "wikipedia"
		});
	}
	stills.sort((a, b) => frameRank(a.caption, "") - frameRank(b.caption, ""));
	return stills.slice(0, 6);
}
var FRAME_JUNK = /poster|theatrical|dvd|blu-?ray|cover art|logo|icon|symbol|flag of|soundtrack|portrait|headshot|red carpet|premiere|comic-?con|wondercon|festival|photograph of|commons-logo|wikiquote|wordmark|emblem|coat of arms|map of|locator|behind the scenes|press kit/i;
function isFrame(name, width, height, cats = [], desc = "", ratioTarget) {
	const blob = `${name} ${cats.join(" ")} ${desc}`;
	if (FRAME_JUNK.test(blob)) return false;
	if (/nixon|publicity|behind the scenes|on the set|press photo|promotional|photograph of/i.test(blob)) return false;
	if (!width || !height) return false;
	const ratio = width / height;
	if (ratioTarget) {
		if (Math.abs(ratio - ratioTarget) > .16) return false;
	} else if (ratio < 1.66 || ratio > 2.45) return false;
	if (width < 400) return false;
	const looks = /screenshot|screencap|screengrab|film still|movie still|\bscene\b|\bframe\b/i.test(blob);
	const nonFree = /non-free/i.test(blob);
	return Boolean(ratioTarget) || looks || nonFree;
}
function frameRank(caption, place) {
	const n = caption.toLowerCase();
	let score = tokens(place).some((w) => n.includes(w)) ? 0 : 2;
	if (/screenshot|screencap|still|scene|frame|chase/.test(n)) score -= 1;
	return score;
}
async function searchFiles(host, q) {
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		list: "search",
		srnamespace: "6",
		srlimit: "6",
		srsearch: q
	});
	const res = await fetch(`https://${host}/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) return [];
	return ((await res.json()).query?.search ?? []).map((row) => row.title ?? "").filter(Boolean);
}
async function describeFiles(host, titles, ratioTarget) {
	const unique = [...new Set(titles)].slice(0, 12);
	if (!unique.length) return [];
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		prop: "imageinfo|categories",
		iiprop: "url|mime|size|extmetadata",
		iiurlwidth: "1000",
		cllimit: "12",
		titles: unique.join("|")
	});
	const res = await fetch(`https://${host}/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(1e4)
	});
	if (!res.ok) return [];
	const data = await res.json();
	const stills = [];
	for (const page of Object.values(data.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		if (!info?.thumburl) continue;
		if (!/\.(jpe?g|png|webp)(\?|$)/i.test(info.thumburl)) continue;
		if (info.mime && !/^image\/(jpeg|png|webp|gif)$/.test(info.mime)) continue;
		const caption = (page.title ?? "Still").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
		const cats = (page.categories ?? []).map((c) => c.title ?? "");
		const desc = (info.extmetadata?.ImageDescription?.value ?? "").replace(/<[^>]+>/g, " ");
		if (!isFrame(caption, info.thumbwidth, info.thumbheight, cats, desc, ratioTarget)) continue;
		stills.push({
			url: info.thumburl,
			caption,
			source: "wikipedia"
		});
	}
	return stills;
}
function quoteTerm(value) {
	return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}
var aspectCache = /* @__PURE__ */ new Map();
function wikiPagesFor(title, year) {
	const pages = /* @__PURE__ */ new Set();
	if (year === 1984 && /^(1984|nineteen eighty-four)$/i.test(title.trim())) pages.add("Nineteen Eighty-Four (1984 film)");
	if (year) pages.add(`${title} (${year} film)`);
	pages.add(title);
	return [...pages];
}
async function filmAspect(title, year) {
	const key = `${norm(title)}|${year ?? ""}`;
	const cached = aspectCache.get(key);
	if (cached) return cached;
	for (const page of wikiPagesFor(title, year)) {
		const params = new URLSearchParams({
			action: "parse",
			format: "json",
			page,
			prop: "wikitext",
			redirects: "1"
		});
		try {
			const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
				headers: {
					"user-agent": UA,
					accept: "application/json"
				},
				signal: AbortSignal.timeout(8e3)
			});
			if (!res.ok) continue;
			const text = (await res.json()).parse?.wikitext?.["*"] ?? "";
			if (!text) continue;
			const boxed = text.match(/\|\s*aspect[_\s]*ratio\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
			const prose = text.match(/aspect ratio[^.\n]{0,48}?([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
			const match = boxed ?? prose;
			const ratio = match ? Number(match[1]) / (match[2] && Number(match[2]) > 0 ? Number(match[2]) : 1) : NaN;
			if (ratio >= 1.3 && ratio <= 2.8) {
				aspectCache.set(key, ratio);
				return ratio;
			}
		} catch {
			continue;
		}
	}
}
function wrongYear(blob, year) {
	if (!year) return false;
	return [...blob.matchAll(/\b(?:18|19|20)\d{2}\b/g)].map((match) => Number(match[0])).some((found) => Math.abs(found - year) > 1);
}
export const sceneFrames = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	const title = String(raw.title ?? "").trim().slice(0, 160);
	const place = String(raw.place ?? "").trim().slice(0, 160);
	const yearNum = Number(raw.year);
	const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : void 0;
	if (title.length < 1) throw new Error("Missing title");
	return {
		title,
		place,
		year
	};
}).handler(async ({ data }) => {
	const key = `v7|${norm(data.title)}|${norm(data.place)}|${data.year ?? ""}`;
	const hit = fresh(frameCache.get(key));
	if (hit) return hit;
	const title = quoteTerm(data.title);
	const place = quoteTerm(data.place);
	const ratio = await filmAspect(data.title, data.year).catch(() => void 0);
	const tokens = data.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && ![
		"film",
		"movie",
		"with",
		"from",
		"that",
		"this"
	].includes(word));
	const wikiQueries = [place ? `"${title}" "${place}" (screenshot OR screencap OR "film still" OR scene)` : "", `"${title}" (screenshot OR screencap OR "film still" OR scene)`].filter(Boolean);
	const described = (await Promise.all(["en.wikipedia.org", "commons.wikimedia.org"].map(async (host) => {
		return describeFiles(host, (await Promise.all(wikiQueries.map((q) => searchFiles(host, q).catch(() => [])))).flat(), ratio).catch(() => []);
	}))).flat();
	const seen = /* @__PURE__ */ new Set();
	const stills = described.filter((still) => {
		if (seen.has(still.url)) return false;
		const blob = still.caption.toLowerCase();
		if (tokens.length && !tokens.some((token) => blob.includes(token))) return false;
		if (wrongYear(blob, data.year)) return false;
		if (/nixon|poster|publicity/.test(blob)) return false;
		seen.add(still.url);
		return true;
	}).sort((a, b) => frameRank(a.caption, data.place) - frameRank(b.caption, data.place)).slice(0, 6);
	if (stills.length) frameCache.set(key, {
		at: Date.now(),
		value: stills
	});
	return stills;
});
var posterCache = /* @__PURE__ */ new Map();
function posterClash(caption, title, year) {
	const blob = caption.toLowerCase();
	const years = [...blob.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
	if (year && years.length && years.every((found) => Math.abs(found - year) > 1)) return true;
	if (title.toLowerCase().replace(/[^a-z0-9]+/g, "") === "robocop" && /\brobocop\s*(2|3|ii|iii)\b|prime directives|\b2014\b|remake|reboot/.test(blob)) return true;
	if (year && year < 2010 && /\b2014\b|remake|reboot/.test(blob)) return true;
	return false;
}
async function posterCandidates(host, titles, title, year) {
	const unique = [...new Set(titles)].slice(0, 10);
	if (!unique.length) return [];
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		prop: "imageinfo",
		iiprop: "url|mime|size",
		iiurlwidth: "600",
		titles: unique.join("|")
	});
	const res = await fetch(`https://${host}/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) return [];
	const data = await res.json();
	const posters = [];
	for (const page of Object.values(data.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		const caption = (page.title ?? "").replace(/^File:/, "").replace(/_/g, " ");
		if (!info?.thumburl || !/poster/i.test(caption)) continue;
		if (posterClash(caption, title, year)) continue;
		if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
		if (info.thumbwidth && info.thumbheight) {
			const ratio = info.thumbwidth / info.thumbheight;
			if (ratio < .45 || ratio > .85) continue;
		}
		posters.push({
			url: info.thumburl,
			caption,
			source: "wikipedia"
		});
	}
	return posters;
}
var POSTER_COUNTRY = /polish|japanese|french|german|italian|spanish|thai|turkish|greek|dutch|hungarian|chinese|russian|swedish|israeli|czech|korean|indian|mexican|brazilian|african|ghanaian|ghana|nigerian|yugoslav|argentinian|portuguese|finnish|danish|australian/;
function posterRank(caption) {
	const blob = caption.toLowerCase();
	if (/ghana|africa|nigeria/.test(blob)) return 0;
	if (/polish|japan/.test(blob)) return 1;
	if (POSTER_COUNTRY.test(blob)) return 2;
	return 3;
}
async function cinemaPosters(title, imdbId) {
	if (!/^tt\d{5,10}$/.test(imdbId)) return [];
	const num = String(Number(imdbId.slice(2)));
	const slug = title.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	if (!slug || !num || num === "NaN") return [];
	const res = await fetch(`https://www.cinematerial.com/movies/${slug}-i${num}`, {
		headers: {
			"user-agent": "Mozilla/5.0",
			accept: "text/html"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) return [];
	const html = await res.text();
	const seen = /* @__PURE__ */ new Set();
	const countries = /* @__PURE__ */ new Set();
	const posters = [];
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
			source: "web"
		});
	}
	return posters;
}
export const filmPosters = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	const title = String(raw.title ?? "").trim().slice(0, 160);
	const poster = String(raw.poster ?? "").trim().slice(0, 400);
	const imdbId = String(raw.imdbId ?? "").trim();
	const yearNum = Number(raw.year);
	const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : void 0;
	if (title.length < 1) throw new Error("Missing title");
	return {
		title,
		poster,
		imdbId,
		year
	};
}).handler(async ({ data }) => {
	const key = `v2|${norm(data.title)}|${data.year ?? ""}|${data.imdbId}`;
	const hit = fresh(posterCache.get(key));
	if (hit) return hit;
	const found = (await Promise.all([...["en.wikipedia.org", "commons.wikimedia.org"].map(async (host) => {
		return posterCandidates(host, await searchFiles(host, `"${quoteTerm(data.title)}" poster`).catch(() => []), data.title, data.year).catch(() => []);
	}), cinemaPosters(data.title, data.imdbId).catch(() => [])])).flat();
	const seen = /* @__PURE__ */ new Set();
	const posters = [];
	if (data.imdbId === "tt0093870") posters.push({
		url: "https://deadly-prey-gallery.myshopify.com/cdn/shop/files/image_14b51500-d1cf-411e-9875-365c1481f155_672x.heic?format=jpg",
		caption: "RoboCop Ghana poster, painted by Magasco",
		source: "web"
	});
	const ranked = [...found].sort((a, b) => posterRank(a.caption) - posterRank(b.caption));
	for (const poster of ranked) {
		if (seen.has(poster.url) || posterClash(poster.caption, data.title, data.year)) continue;
		seen.add(poster.url);
		posters.push(poster);
		if (posters.length >= 8) break;
	}
	if (/^https:\/\//.test(data.poster) && !seen.has(data.poster) && posters.length < 8) {
		const caption = `${data.title}${data.year ? ` ${data.year}` : ""} poster`;
		if (!posterClash(caption, data.title, data.year)) posters.push({
			url: data.poster,
			caption,
			source: "imdb"
		});
	}
	if (posters.length) posterCache.set(key, {
		at: Date.now(),
		value: posters
	});
	return posters;
});
function dedupeLocations(list) {
	const byKey = /* @__PURE__ */ new Map();
	for (const loc of list) {
		const key = loc.id.split(":").slice(1).join(":") || norm(loc.name);
		const prev = byKey.get(key);
		if (!prev) {
			byKey.set(key, loc);
			continue;
		}
		const prevExact = prev.precision.toLowerCase().includes("exact");
		if (loc.precision.toLowerCase().includes("exact") && !prevExact) byKey.set(key, loc);
		else if (!prev.scene && loc.scene) byKey.set(key, {
			...prev,
			scene: loc.scene
		});
	}
	const score = (loc) => (loc.precision.toLowerCase().includes("exact") ? 0 : loc.category === "Towns & cities" ? 3 : 2) - (loc.scene ? .5 : 0);
	return [...byKey.values()].sort((a, b) => score(a) - score(b)).slice(0, 10);
}
export const suggestMovies = createServerFn({ method: "POST" }).validator((input) => {
	const query = (typeof input === "object" && input && "q" in input ? String(input.q) : "").trim().slice(0, 80);
	if (query.length < 2) return { q: "" };
	return { q: query };
}).handler(async ({ data }) => {
	if (!data.q) return [];
	const url = `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(data.q[0].toLowerCase())}/${encodeURIComponent(data.q)}.json`;
	const res = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": UA
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) throw new Error("IMDb search didn't respond");
	const body = await res.json();
	const allow = /* @__PURE__ */ new Set([
		"movie",
		"tvSeries",
		"tvMiniSeries",
		"tvMovie",
		"short",
		"tvSpecial"
	]);
	const rows = (body.d ?? []).filter((row) => row.id?.startsWith("tt") && row.l && allow.has(row.qid ?? row.q ?? "")).slice(0, 7).map((row) => ({
		imdbId: row.id,
		title: row.l,
		year: typeof row.y === "number" ? row.y : void 0,
		kind: row.q || "title",
		qid: row.qid || row.q || "movie",
		cast: row.s || "",
		director: "",
		poster: posterSized(row.i?.imageUrl)
	}));
	return rows;
});
async function directorsFor(ids) {
	const missing = ids.filter((id) => !directorCache.has(id));
	if (missing.length) {
		const sparql = `SELECT ?imdb ?directorLabel WHERE {
      VALUES ?imdb { ${missing.map((id) => `"${id}"`).join(" ")} }
      ?film wdt:P345 ?imdb .
      ?film wdt:P57 ?director .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
		try {
			const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
			const res = await fetch(url, {
				headers: {
					"user-agent": UA,
					accept: "application/sparql-results+json"
				},
				signal: AbortSignal.timeout(8e3)
			});
			const grouped = /* @__PURE__ */ new Map();
			if (res.ok) {
				const data = await res.json();
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
			for (const id of missing) if (!directorCache.has(id)) directorCache.set(id, "");
		}
	}
	return new Map(ids.map((id) => [id, directorCache.get(id) ?? ""]));
}
async function fetchGuide(url) {
	const res = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0 (compatible; OnLocation/1.0)",
			accept: "text/html"
		},
		signal: AbortSignal.timeout(12000),
		redirect: "follow"
	});
	if (!res.ok) throw new Error(String(res.status));
	return await res.text();
}
function movieMapRows(page) {
	const at = page.indexOf("moviemaps.loadPublic('MovieDetail'");
	const start = at < 0 ? -1 : page.indexOf("[", at);
	if (start < 0) return [];
	let depth = 0;
	let end = -1;
	for (let i = start; i < page.length; i += 1) {
		if (page[i] === "[") depth += 1;
		else if (page[i] === "]") {
			depth -= 1;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (end < 0) return [];
	let rows = [];
	try {
		rows = JSON.parse(page.slice(start, end + 1));
	} catch {
		return [];
	}
	const places = [];
	for (const row of rows) {
		const lat = Number(row.llat);
		const lng = Number(row.llng);
		const name = String(row.lname || "").trim();
		const city = String(row.lcityName || "").trim();
		if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
		if (norm(name) === norm(city) && name.split(/\s+/).length < 3) continue;
		const scene = Array.isArray(row.lmloc) ? String(row.lmloc.find(Boolean) || "") : "";
		const country = String(row.lcountry || "").trim();
		places.push({
			id: `imdb:${row.lid || norm(name)}`,
			name,
			country,
			category: "Filming location",
			precision: "exact",
			source: "imdb",
			lat,
			lng,
			address: [name, city, country].filter(Boolean).join(", "),
			scene: scene || void 0,
			precisionNote: "Exact site listed on IMDb, via MovieMaps"
		});
	}
	return places;
}
async function movieMapPlaces(data) {
	const q = data.title.replace(/^(the|a|an)\s+/i, "").trim() || data.title;
	const html = await fetchGuide(`https://moviemaps.org/search?q=${encodeURIComponent(q)}`);
	const want = norm(data.title).replace(/^(the|a|an) /, "");
	const ids = [];
	for (const hit of html.matchAll(/<h4><a href="\/movies\/([^"]+)">([^<]+)<\/a>/g)) {
		const name = norm(hit[2]).replace(/^(the|a|an) /, "");
		if (name === want || name.startsWith(want) || want.startsWith(name)) ids.push(hit[1]);
	}
	let best = [];
	for (const id of [...new Set(ids)].slice(0, 4)) {
		const page = await fetchGuide(`https://moviemaps.org/movies/${id}`);
		const imdb = page.match(/imdb\.com\/title\/(tt\d+)/);
		if (data.imdbId && imdb && imdb[1] !== data.imdbId) continue;
		const rows = movieMapRows(page);
		if (data.imdbId && imdb && imdb[1] === data.imdbId) return rows;
		if (rows.length > best.length) best = rows;
	}
	return best;
}
async function movieLocationGuidePlaces(data) {
	const bare = data.title.replace(/^(the|a|an)\s+/i, "").trim();
	const letter = (bare[0] || "").toLowerCase();
	if (!/[a-z]/.test(letter)) return [];
	const indexUrl = `https://www.movie-locations.com/movies/${letter}/${letter}-movies.php`;
	const index = await fetchGuide(indexUrl);
	const want = norm(data.title).replace(/^(the|a|an) /, "");
	const year = data.year ? String(data.year) : "";
	let href = "";
	let best = 0;
	for (const match of index.matchAll(/<a href="([^"]+\.php)">([^<]+)<\/a>/gi)) {
		const text = decodeEntities(match[2]).replace(/\s+/g, " ").trim();
		const key = norm(text.replace(/\s*\(\d{4}\)\s*$/, "").replace(/\s*\(aka[^)]*\)/i, "")).replace(/^(the|a|an) /, "");
		if (!key) continue;
		let score = 0;
		if (key === want) score = 80;
		else if (key.startsWith(want) || want.startsWith(key)) score = 40;
		else continue;
		if (year && text.includes(`(${year})`)) score += 30;
		else if (year && /\(\d{4}\)/.test(text)) score -= 20;
		if (score > best) {
			best = score;
			href = match[1];
		}
	}
	if (best < 40 || !href || /-movies\.php$/i.test(href)) return [];
	const page = await fetchGuide(new URL(href, indexUrl).toString());
	const seen = /* @__PURE__ */ new Set();
	const queries = [];
	for (const match of page.matchAll(/alt="([^"]*film location:\s*[^"]+)"/gi)) {
		const place = decodeEntities(match[1]).split(/film location:\s*/i)[1]?.trim();
		const key = norm(place || "");
		if (!place || seen.has(key)) continue;
		seen.add(key);
		queries.push(place);
	}
	return queries.slice(0, 6);
}
function addressPhrases(text) {
	const clean = text.replace(/\s+/g, " ").trim();
	const out = [];
	const re = /([A-Z0-9][^,.;]{0,70}\b(?:Street|Road|Rd|Avenue|Ave|Lane|Square|Place|Terrace|Crescent|Mews|Circus|Wharf|Gardens|Row|Walk|Bridge|Gate|Court|Close|Way|Drive|Boulevard)\b[^,.;]{0,40})/g;
	for (const match of clean.matchAll(re)) {
		let phrase = match[1].trim();
		const tail = clean.slice(match.index + match[0].length).match(/^\s*,\s*([^,.;]{2,48})/);
		if (tail) phrase = `${phrase}, ${tail[1].trim()}`;
		if (phrase.length > 8) out.push(phrase);
	}
	return out.slice(0, 2);
}
async function reelStreetQueries(data) {
	const q = data.title.replace(/^(the|a|an)\s+/i, "").trim() || data.title;
	const html = await fetchGuide(`https://www.reelstreets.com/?s=${encodeURIComponent(q)}`);
	const words = norm(data.title).replace(/^(the|a|an) /, "").split(" ").filter((word) => word.length > 2);
	let bestHref = "";
	let best = 0;
	for (const match of html.matchAll(/href="(https:\/\/www\.reelstreets\.com\/films\/[^"#?]+)"/g)) {
		const slug = norm(match[1].split("/films/")[1] || "");
		const hits = words.filter((word) => slug.includes(word)).length;
		const score = hits / Math.max(words.length, 1);
		if (score > best) {
			best = score;
			bestHref = match[1].replace(/\/$/, "") + "/";
		}
	}
	if (best < 0.6 || !bestHref) return [];
	const page = await fetchGuide(bestHref);
	const seen = /* @__PURE__ */ new Set();
	const queries = [];
	for (const match of page.matchAll(/<p class="capdesc">([\s\S]*?)<\/p>/g)) {
		const text = decodeEntities(match[1].replace(/<[^>]+>/g, " "));
		for (const phrase of addressPhrases(text)) {
			const key = norm(phrase);
			if (seen.has(key)) continue;
			seen.add(key);
			queries.push(phrase);
			if (queries.length >= 4) return queries;
		}
	}
	return queries;
}
const geoCache = /* @__PURE__ */ new Map();
async function geocodeQuery(q) {
	const key = norm(q);
	if (geoCache.has(key)) return geoCache.get(key);
	const run = nominatimChain.then(async () => {
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
		const res = await fetch(url, {
			headers: {
				"user-agent": UA,
				accept: "application/json"
			},
			signal: AbortSignal.timeout(8000)
		});
		if (!res.ok) return null;
		const row = (await res.json())?.[0];
		if (!row) return null;
		const lat = Number(row.lat);
		const lng = Number(row.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		return { lat, lng, label: row.display_name || q };
	});
	nominatimChain = run.then(() => void 0, () => void 0);
	const value = await run.catch(() => null);
	geoCache.set(key, value);
	return value;
}
function samePin(a, b) {
	return norm(a.name) === norm(b.name) || Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lng - b.lng) < 0.002;
}
async function guidePlaces(data) {
	const [maps, guideQs, reelQs] = await Promise.all([
		movieMapPlaces(data).catch(() => []),
		movieLocationGuidePlaces(data).catch(() => []),
		reelStreetQueries(data).catch(() => [])
	]);
	const located = maps.slice(0, 8);
	const queries = [
		...guideQs.map((q) => ({ q, source: "guide", note: "From The Worldwide Guide to Movie Locations" })),
		...reelQs.map((q) => ({ q, source: "reelstreets", note: "From ReelStreets" }))
	];
	for (const item of queries) {
		if (located.length >= 12) break;
		if (located.some((loc) => norm(loc.address).includes(norm(item.q).slice(0, 18)))) continue;
		const geo = await geocodeQuery(item.q);
		if (!geo) continue;
		const place = {
			id: `${item.source}:${norm(item.q)}`,
			name: item.q.split(",")[0].trim() || item.q,
			country: "",
			category: "Filming location",
			precision: "exact",
			source: item.source,
			lat: geo.lat,
			lng: geo.lng,
			address: geo.label || item.q,
			precisionNote: item.note
		};
		if (located.some((loc) => samePin(loc, place))) continue;
		located.push(place);
	}
	return located.slice(0, 12);
}
function preferPlaces(guides, rest) {
	const out = [];
	for (const loc of [...guides, ...rest]) {
		if (!loc) continue;
		const twin = out.find((other) => samePin(other, loc));
		if (!twin) out.push(loc);
		else if (!twin.scene && loc.scene) twin.scene = loc.scene;
	}
	return out.slice(0, 12);
}
export const loadFilm = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Pick a title from the IMDb search.");
	const raw = input;
	const imdbId = String(raw.imdbId ?? "");
	const title = String(raw.title ?? "").trim().slice(0, 160);
	if (!/^tt\d{5,10}$/.test(imdbId) || title.length < 1) throw new Error("Pick a title from the IMDb search.");
	const yearNum = Number(raw.year);
	const poster = posterSized(typeof raw.poster === "string" ? raw.poster : void 0);
	return {
		title,
		imdbId,
		year: Number.isFinite(yearNum) ? yearNum : void 0,
		poster,
		cast: String(raw.cast ?? "").slice(0, 180),
		director: String(raw.director ?? "").slice(0, 160),
		qid: String(raw.qid ?? "movie").slice(0, 40)
	};
}).handler(async ({ data }) => {
	const hit = fresh(dossierCache.get(`v9:${data.imdbId}`));
	if (hit) return hit;
	const guidesTask = guidePlaces(data).catch(() => []);
	const kind = /tv/i.test(data.qid) ? "tv" : "film";
	const queryTitle = atlasQueryTitle(data);
	const wikiGuess = data.imdbId === "tt0087803" || data.year === 1984 && /^(1984|nineteen eighty-four)$/i.test(data.title.trim()) ? "Nineteen Eighty-Four (1984 film)" : `${data.title} ${data.year ?? ""} film`.trim();
	const wikiTask = wikiBundle(wikiGuess).catch((err) => {
		console.error("[on-location] wikipedia", err);
		return null;
	});
	let atlas;
	let atlasError = "";
	let trusted = false;
	try {
		const search = await findProductions(queryTitle, kind);
		const slug = pickAtlasSlug(queryTitle, data.year, kind, search.results ?? []);
		trusted = slug !== queryTitle;
		atlas = await mcp("where_was_it_filmed", {
			title: slug,
			limit: 40
		});
	} catch (err) {
		atlasError = err instanceof Error ? err.message : "Location atlas unavailable";
	}
	const related = titlesRelated(atlas?.name ?? "", queryTitle) || titlesRelated(atlas?.name ?? "", data.title);
	if (atlas && !trusted && !related) atlas = {
		places: [],
		wiki_places: [],
		countries_only: []
	};
	const wikiTitle = data.imdbId === "tt0087803" || data.year === 1984 && /^(1984|nineteen eighty-four)$/i.test(data.title.trim()) ? "Nineteen Eighty-Four (1984 film)" : wikiTitleFromUrl(atlas?.wikipedia) ?? wikiGuess;
	let wiki = await wikiTask;
	let wikiFailed = !wiki;
	if (!wiki) wiki = {
		sentences: [],
		notes: [],
		stills: [],
		pageUrl: atlas?.wikipedia
	};
	try {
		if (!wiki.stills.length && wikiTitle !== wikiGuess) {
			wiki = await wikiBundle(wikiTitle);
			wikiFailed = false;
		}
	} catch (err) {
		wikiFailed = true;
		console.error("[on-location] wikipedia", err);
	}
	const sentences = wiki.sentences;
	const rawPlaces = [...(atlas?.places ?? []), ...(atlas?.wiki_places ?? [])];
	let locations = dedupeLocations(rawPlaces.map((p) => toLocation(p, "wikidata", sentences)).filter((loc) => Boolean(loc)));
	if (!locations.length) locations = dedupeLocations(rawPlaces.map((p) => toTown(p)).filter((loc) => Boolean(loc)));
	if (!locations.length) locations = await wikiLinkedPlaces(wiki.pageUrl ? wikiTitleFromUrl(wiki.pageUrl) : wikiTitle).catch(() => []);
	locations = preferPlaces(await guidesTask, locations);
	const stills = [];
	for (const still of wiki.stills) {
		if (stills.length >= 6) break;
		stills.push(still);
	}
	const director = data.director || (await directorsFor([data.imdbId])).get(data.imdbId) || "";
	const dossier = {
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
		atlasName: atlas?.name
	};
	if (!locations.length && atlasError) dossier.filmingNotes = ["The location atlas didn't answer, so there are no pins yet. IMDb's own locations page is linked above.", ...dossier.filmingNotes];
	else if (!wikiFailed) dossierCache.set(`v9:${data.imdbId}`, {
		at: Date.now(),
		value: dossier
	});
	return dossier;
});

function atlasQueryTitle(data) {
	const title = data.title.trim();
	if (data.imdbId === "tt0087803" || data.year === 1984 && /^(1984|nineteen eighty-four)$/i.test(title)) return "Nineteen Eighty-Four";
	return title;
}
function titlesRelated(atlasName, title) {
	const left = norm(atlasName);
	const right = norm(title);
	if (!left || !right) return false;
	if (left === right) return true;
	if (right.length <= 6) return false;
	return left.includes(right) || right.includes(left);
}
async function findProductions(query, kind) {
	const attempts = kind === "film" ? [{ kind }, { kind: "anime" }, {}] : [{ kind }, {}];
	let search = { results: [] };
	for (const extra of attempts) {
		try {
			search = await mcp("search_productions", { query, limit: 8, ...extra });
		} catch {
			search = { results: [] };
		}
		if ((search.results ?? []).length) return search;
	}
	return search;
}
function toTown(place) {
	const category = (place.category ?? "").toLowerCase();
	const precision = (place.precision ?? "").toLowerCase();
	const name = (place.name ?? "").trim();
	if (!name || category === "fiction" || category === "region") return void 0;
	if (category !== "city" && !precision.includes("town")) return void 0;
	if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return void 0;
	if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return void 0;
	const country = (place.country ?? "").trim();
	return {
		id: `town:${place.slug || name}`,
		name,
		country,
		category: place.category_label || "Town",
		precision: place.precision || "town level",
		source: "wikipedia",
		lat: place.latitude,
		lng: place.longitude,
		address: country ? `${name}, ${country}` : name,
		precisionNote: "Town-level pin. No street address is on record, so Street View opens at the centre of the place."
	};
}
function namedSite(name) {
	const numbered = /\b\d{1,5}[a-z]?\b/i.test(name);
	const street = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|boulevard|blvd\.?|drive|dr\.?|way|place|square|sq\.?|terrace|crescent|row|alley|quay|embankment|promenade|bridge|highway|route|close|court|gardens|gate|mews|circus|parade|walk|wharf|pier)\b/i.test(name);
	const building = /\b(building|hall|hotel|station|theatre|theater|church|cathedral|chapel|museum|tower|house|plaza|centre|center|palace|school|university|college|hospital|airport|stadium|arena|castle|abbey|temple|library|market|factory|mill|warehouse|terminal|dock|steps|studio|studios|mansion|mansions)\b/i.test(name);
	return numbered || street || building || name.split(/\s+/).filter(Boolean).length >= 2;
}
async function wikiLinkedPlaces(title) {
	if (!title) return [];
	let page = title;
	const first = await wikiGet({ action: "parse", page, prop: "sections", redirects: "1" });
	let parsed = first.parse;
	if (!parsed) {
		const found = await wikiGet({ action: "query", list: "search", srsearch: `${title} film`, srlimit: "1" });
		const hit = found.query?.search?.[0]?.title;
		if (!hit) return [];
		page = hit;
		const again = await wikiGet({ action: "parse", page, prop: "sections", redirects: "1" });
		parsed = again.parse;
		page = parsed?.title ?? page;
	} else page = parsed.title ?? page;
	const sections = parsed?.sections ?? [];
	const section = sections.find((s) => /filming locations|locations and sets|principal photography|filming$|^production$|development and production/i.test(s.line ?? "") && !/fictional/i.test(s.line ?? ""));
	const indexes = [section?.index, "0"].filter(Boolean);
	const titles = [];
	const seen = new Set();
	for (const index of indexes) {
		const body = await wikiGet({ action: "parse", page, prop: "text", section: String(index), redirects: "1" });
		const html = body.parse?.text?.["*"] ?? "";
		for (const match of html.matchAll(/href="\/wiki\/([^":#]+)"/g)) {
			const name = decodeURIComponent(match[1]).replace(/_/g, " ");
			const key = name.toLowerCase();
			if (seen.has(key) || /^(file|category|help|template|wikipedia|portal):/i.test(name)) continue;
			if (/\b(identifier|language|script|company|album|song|novel|award|classification|characters)\b/i.test(name)) continue;
			if (/\(\d{4} film\)|\(film\)$/i.test(name)) continue;
			seen.add(key);
			titles.push(name);
			if (titles.length >= 18) break;
		}
		if (titles.length >= 18) break;
	}
	if (!titles.length) return [];
	const params = new URLSearchParams({ action: "query", format: "json", prop: "coordinates", redirects: "1", titles: titles.join("|") });
	const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(12000) });
	if (!res.ok) return [];
	const data = await res.json();
	const pins = [];
	for (const item of Object.values(data.query?.pages ?? {})) {
		const coord = item.coordinates?.[0];
		const name = item.title;
		if (!name || !coord || !Number.isFinite(coord.lat) || !Number.isFinite(coord.lon)) continue;
		if (Math.abs(coord.lat) > 90 || Math.abs(coord.lon) > 180) continue;
		pins.push({ name, lat: coord.lat, lng: coord.lon, specific: namedSite(name) });
	}
	const chosen = pins.some((pin) => pin.specific) ? pins.filter((pin) => pin.specific) : pins;
	return chosen.slice(0, 8).map((pin) => ({
		id: `wiki:${pin.name}`,
		name: pin.name,
		country: "",
		category: pin.specific ? "Landmark" : "Town",
		precision: pin.specific ? "approximate" : "town level",
		source: "wikipedia",
		lat: pin.lat,
		lng: pin.lng,
		address: pin.name,
		precisionNote: pin.specific ? "Named in the Wikipedia article" : "Town-level pin from the Wikipedia article. No street address is on record."
	}));
}

function dig(value, path) {
	let cur = value;
	for (const key of path) {
		if (!Array.isArray(cur)) return void 0;
		cur = cur[key];
	}
	return cur;
}
function parsePano(payload, fallbackLat, fallbackLng) {
	const panoId = dig(payload, [
		1,
		1,
		1
	]);
	const lat = dig(payload, [
		1,
		5,
		0,
		1,
		0,
		2
	]);
	const lng = dig(payload, [
		1,
		5,
		0,
		1,
		0,
		3
	]);
	const heading = dig(payload, [
		1,
		5,
		0,
		1,
		2,
		0
	]);
	return {
		panoId: typeof panoId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(panoId) ? panoId : void 0,
		lat: typeof lat === "number" ? lat : fallbackLat,
		lng: typeof lng === "number" ? lng : fallbackLng,
		heading: typeof heading === "number" ? (heading % 360 + 360) % 360 : 0
	};
}
async function findPano(lat, lng, radius) {
	const url = `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=${`!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d${radius}!3m10!2m2!1sen!2sen!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m9!1e1!1e2!1e3!1e4!1e6!1e8!1e12!5m0!6m0`}&callback=cb`;
	const res = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			referer: "https://www.google.com/maps",
			accept: "*/*"
		},
		signal: AbortSignal.timeout(1e4)
	});
	if (!res.ok) return void 0;
	const text = await res.text();
	const start = text.indexOf("(");
	const end = text.lastIndexOf(")");
	if (start < 0 || end <= start) return void 0;
	try {
		return parsePano(JSON.parse(text.slice(start + 1, end)), lat, lng);
	} catch {
		return;
	}
}
var nominatimChain = Promise.resolve();
async function reverseAddress(lat, lng, fallback) {
	const run = nominatimChain.then(async () => {
		try {
			const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
			const res = await fetch(url, {
				headers: {
					"user-agent": UA,
					accept: "application/json"
				},
				signal: AbortSignal.timeout(7e3)
			});
			if (!res.ok) return fallback;
			const a = (await res.json()).address ?? {};
			return [
				[a.house_number, a.road || a.pedestrian || a.footway || a.path].filter(Boolean).join(" "),
				a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || "",
				a.country || ""
			].filter(Boolean).join(", ") || fallback;
		} catch {
			return fallback;
		} finally {
			await new Promise((r) => setTimeout(r, 1100));
		}
	});
	nominatimChain = run.then(() => void 0, () => void 0);
	return run;
}
function bearing(lat1, lng1, lat2, lng2) {
	const rad = Math.PI / 180;
	const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad);
	const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad);
	return (Math.atan2(y, x) / rad + 360) % 360;
}
function metersBetween(lat1, lng1, lat2, lng2) {
	const rad = Math.PI / 180;
	const dLat = (lat2 - lat1) * rad;
	const dLng = (lng2 - lng1) * rad;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
	return 12742e3 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const streetView = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Missing place");
	const raw = input;
	const lat = Number(raw.lat);
	const lng = Number(raw.lng);
	const label = String(raw.label ?? "").trim().slice(0, 180);
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("That place has no coordinates.");
	if (!label) throw new Error("Missing address");
	return {
		lat,
		lng,
		label
	};
}).handler(async ({ data }) => {
	const key = `face|${data.lat.toFixed(4)},${data.lng.toFixed(4)}`;
	const cached = fresh(streetCache.get(key));
	if (cached) return {
		...cached,
		address: cached.address || data.label
	};
	let pano = await findPano(data.lat, data.lng, 80);
	if (!pano?.panoId) pano = await findPano(data.lat, data.lng, 500);
	const lat = pano?.lat ?? data.lat;
	const lng = pano?.lng ?? data.lng;
	const heading = metersBetween(lat, lng, data.lat, data.lng) > 8 ? bearing(lat, lng, data.lat, data.lng) : pano?.heading ?? 0;
	const address = await reverseAddress(lat, lng, data.label);
	const mapsUrl = pano?.panoId ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${heading.toFixed(1)}&pitch=0&fov=80` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
	const hit = {
		address,
		lat,
		lng,
		heading,
		panoId: pano?.panoId,
		coverage: Boolean(pano?.panoId),
		thumbUrl: pano?.panoId ? `/api/pano?id=${encodeURIComponent(pano.panoId)}&yaw=${Math.round(heading)}` : void 0,
		embedUrl: pano?.panoId ? `https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s${pano.panoId}!2m2!1d${lat}!2d${lng}!3f${heading.toFixed(2)}!4f0!5f0.78` : void 0,
		mapsUrl
	};
	streetCache.set(key, {
		at: Date.now(),
		value: hit
	});
	return hit;
});
var photoCache = /* @__PURE__ */ new Map();
var PHOTO_JUNK = /map\b|locator|coat of arms|flag of|\blogo\b|\bicon\b|diagram|floor plan|\bplan\b|signature|autograph|screenshot|orthophoto|satellite|emblem|seal of|route diagram|svg/i;
function photoTokens(name) {
	return name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !STOP.has(word));
}
function captionFromFile(title) {
	return title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
function tokenScore(caption, tokens) {
	const hay = caption.toLowerCase();
	return tokens.reduce((n, word) => hay.includes(word) ? n + 1 : n, 0);
}
async function commonsNear(lat, lng, tokens) {
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
		iiurlwidth: "900"
	});
	const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!res.ok) return [];
	const data = await res.json();
	const photos = [];
	for (const page of Object.values(data.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		const caption = captionFromFile(page.title ?? "");
		if (!info?.thumburl || !caption) continue;
		if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
		if (info.thumbwidth && info.thumbwidth < 360) continue;
		if (info.thumbwidth && info.thumbheight) {
			const ratio = info.thumbwidth / info.thumbheight;
			if (ratio < .45 || ratio > 2.6) continue;
		}
		if (PHOTO_JUNK.test(caption)) continue;
		photos.push({
			url: info.thumburl,
			caption,
			credit: "Wikimedia Commons",
			kind: "place",
			score: tokenScore(caption, tokens)
		});
	}
	return photos;
}
async function openversePhotos(query, tokens) {
	const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12`;
	const res = await fetch(url, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!res.ok) return [];
	const data = await res.json();
	const photos = [];
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
			credit: item.creator ? `${item.creator}${item.source ? ` · ${item.source}` : ""}` : item.source || "Photograph",
			kind: "place",
			score: tokenScore(caption, tokens) + (direct ? .25 : 0)
		});
	}
	return photos;
}
function takePhotos(rows, limit) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const ranked = [...rows].sort((a, b) => b.score - a.score);
	for (const row of ranked) {
		if (seen.has(row.url)) continue;
		seen.add(row.url);
		out.push({
			url: row.url,
			caption: row.caption,
			credit: row.credit,
			kind: row.kind
		});
		if (out.length >= limit) break;
	}
	return out;
}
function hunterSlugs(title) {
	const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	const slugs = [base];
	if (base.startsWith("the-")) slugs.push(base.slice(4));
	return [...new Set(slugs.filter(Boolean))];
}
async function hunterPhotos(title, place) {
	const tokens = photoTokens(place);
	if (!title || !tokens.length) return [];
	for (const slug of hunterSlugs(title)) {
		const page = `https://movielocationhunter.co.uk/show/movie/${slug}`;
		try {
			const res = await fetch(page, {
				headers: {
					"user-agent": UA,
					accept: "text/html"
				},
				signal: AbortSignal.timeout(8e3)
			});
			if (!res.ok) continue;
			const html = await res.text();
			if (!html.includes("/images/locations/")) continue;
			const photos = [];
			for (const match of html.matchAll(/src="(\/images\/locations\/[^"]+)"[^>]*alt="([^"]*)"/g)) {
				const path = match[1] ?? "";
				const caption = (match[2] ?? "").replace(/\s+/g, " ").trim();
				const score = tokenScore(`${caption} ${path}`.toLowerCase(), tokens);
				if (score < 1) continue;
				photos.push({
					url: `https://movielocationhunter.co.uk${path}`,
					caption: caption || place,
					credit: "Movie Location Hunter",
					kind: "place",
					score: score + 2
				});
			}
			return photos;
		} catch {
			continue;
		}
	}
	return [];
}
var FOREIGN_CITIES = [
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
	"st andrews"
];
var CITY_POINTS = [
	[
		"London",
		51.507,
		-.128
	],
	[
		"Cambridge",
		52.205,
		.119
	],
	[
		"Oxford",
		51.752,
		-1.258
	],
	[
		"Edinburgh",
		55.953,
		-3.189
	],
	[
		"Manchester",
		53.481,
		-2.242
	],
	[
		"Glasgow",
		55.864,
		-4.252
	],
	[
		"Liverpool",
		53.408,
		-2.991
	],
	[
		"Birmingham",
		52.486,
		-1.89
	],
	[
		"Dublin",
		53.35,
		-6.26
	],
	[
		"Paris",
		48.857,
		2.352
	],
	[
		"New York",
		40.713,
		-74.006
	],
	[
		"Los Angeles",
		34.052,
		-118.244
	],
	[
		"Dallas",
		32.777,
		-96.797
	],
	[
		"Chicago",
		41.878,
		-87.63
	],
	[
		"Tokyo",
		35.682,
		139.759
	],
	[
		"Berlin",
		52.52,
		13.405
	],
	[
		"Rome",
		41.903,
		12.496
	],
	[
		"Sydney",
		-33.869,
		151.209
	],
	[
		"Toronto",
		43.653,
		-79.383
	],
	[
		"Vancouver",
		49.283,
		-123.121
	],
	[
		"Amsterdam",
		52.367,
		4.904
	],
	[
		"Barcelona",
		41.387,
		2.168
	],
	[
		"Madrid",
		40.417,
		-3.704
	],
	[
		"Vienna",
		48.208,
		16.373
	],
	[
		"Prague",
		50.075,
		14.438
	],
	[
		"Hong Kong",
		22.319,
		114.169
	],
	[
		"Singapore",
		1.352,
		103.82
	],
	[
		"Melbourne",
		-37.814,
		144.963
	],
	[
		"San Francisco",
		37.775,
		-122.419
	],
	[
		"Boston",
		42.36,
		-71.059
	],
	[
		"Washington",
		38.907,
		-77.037
	],
	[
		"Philadelphia",
		39.953,
		-75.165
	],
	[
		"Pittsburgh",
		40.441,
		-79.99
	],
	[
		"Austin",
		30.267,
		-97.743
	],
	[
		"Miami",
		25.762,
		-80.192
	],
	[
		"Seattle",
		47.606,
		-122.332
	],
	[
		"Atlanta",
		33.749,
		-84.388
	],
	[
		"New Orleans",
		29.951,
		-90.072
	],
	[
		"Las Vegas",
		36.17,
		-115.14
	],
	[
		"Detroit",
		42.331,
		-83.046
	],
	[
		"Minneapolis",
		44.978,
		-93.265
	],
	[
		"Houston",
		29.76,
		-95.37
	],
	[
		"Brighton",
		50.822,
		-.137
	],
	[
		"Bristol",
		51.455,
		-2.588
	],
	[
		"Leeds",
		53.801,
		-1.549
	],
	[
		"Sheffield",
		53.381,
		-1.47
	],
	[
		"Nottingham",
		52.954,
		-1.155
	],
	[
		"Cardiff",
		51.481,
		-3.179
	],
	[
		"Belfast",
		54.597,
		-5.93
	],
	[
		"Bath",
		51.381,
		-2.359
	],
	[
		"York",
		53.96,
		-1.088
	],
	[
		"Newcastle",
		54.978,
		-1.618
	],
	[
		"Aberdeen",
		57.15,
		-2.11
	],
	[
		"Dundee",
		56.462,
		-2.971
	],
	[
		"Inverness",
		57.478,
		-4.224
	],
	[
		"St Andrews",
		56.34,
		-2.796
	]
];
function nearestCity(lat, lng) {
	let best = "";
	let bestM = 2e4;
	for (const [name, clat, clng] of CITY_POINTS) {
		const away = metersBetween(lat, lng, clat, clng);
		if (away < bestM) {
			best = name;
			bestM = away;
		}
	}
	return best;
}
function cityFromText(text) {
	const hay = text.toLowerCase();
	const found = [...FOREIGN_CITIES].sort((a, b) => b.length - a.length).filter((city) => {
		return new RegExp(`\\b${city.replace(/ /g, "\\s+")}\\b`, "i").test(hay);
	});
	return found[0] ? found[0].replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}
function mentionsForeign(text, allowed) {
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
var NAME_SKIP = /* @__PURE__ */ new Set([
	"the",
	"and",
	"of",
	"for",
	"with",
	"from",
	"near",
	"del",
	"los",
	"las",
	"san",
	"santa"
]);
function looseWords(name) {
	return name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !NAME_SKIP.has(word));
}
function contextWords(name, siblings) {
	const own = new Set(looseWords(name));
	const counts = /* @__PURE__ */ new Map();
	for (const sibling of siblings) {
		if (sibling.toLowerCase() === name.toLowerCase()) continue;
		for (const word of looseWords(sibling)) {
			if (own.has(word) || word.length < 5) continue;
			counts.set(word, (counts.get(word) ?? 0) + 1);
		}
	}
	return [...counts.entries()].filter(([, n]) => n >= 2).map(([word]) => word);
}
function matchesPlace(caption, name, context) {
	const cap = caption.toLowerCase();
	const phrase = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
	const words = looseWords(name);
	if (!(phrase.length >= 8 && cap.includes(phrase) || words.length > 0 && words.every((word) => cap.includes(word)))) return false;
	if (words.length < 2 && context.length) return context.some((word) => cap.includes(word));
	return true;
}
async function keepWorking(photos) {
	return (await Promise.all(photos.map(async (photo) => {
		if (/wikimedia\.org/i.test(photo.url)) return photo;
		try {
			const res = await fetch(photo.url, {
				method: "GET",
				headers: {
					range: "bytes=0-32",
					"user-agent": UA,
					accept: "image/*"
				},
				signal: AbortSignal.timeout(7e3),
				redirect: "follow"
			});
			const type = res.headers.get("content-type") || "";
			await res.body?.cancel();
			if ((res.ok || res.status === 206) && type.startsWith("image/")) return photo;
		} catch {
			return null;
		}
		return null;
	}))).filter((photo) => Boolean(photo));
}
async function locationStills(title, place, allowed, ratio, year) {
	const query = `"${quoteTerm(title)}" "${quoteTerm(place)}" (screenshot OR screencap OR screengrab OR "film still")`;
	const found = (await Promise.all(["en.wikipedia.org", "commons.wikimedia.org"].map(async (host) => {
		return describeFiles(host, await searchFiles(host, query).catch(() => []), ratio).catch(() => []);
	}))).flat();
	const titleWords = looseWords(title);
	const seen = /* @__PURE__ */ new Set();
	const stills = [];
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
		stills.push({
			url: still.url,
			caption: still.caption,
			credit: "Wikimedia",
			kind: "still"
		});
		if (stills.length >= 6) break;
	}
	return stills;
}
export const placePhotos = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Missing place");
	const raw = input;
	const lat = Number(raw.lat);
	const lng = Number(raw.lng);
	const name = String(raw.name ?? "").trim().slice(0, 160);
	const country = String(raw.country ?? "").trim().slice(0, 80);
	const title = String(raw.title ?? "").trim().slice(0, 160);
	const siblings = String(raw.siblings ?? "").trim().slice(0, 800);
	const address = String(raw.address ?? "").trim().slice(0, 220);
	const yearNum = Number(raw.year);
	const year = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : void 0;
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("That place has no coordinates.");
	if (!name) throw new Error("Missing place");
	return {
		lat,
		lng,
		name,
		country,
		title,
		siblings,
		address,
		year
	};
}).handler(async ({ data }) => {
	const city = nearestCity(data.lat, data.lng) || cityFromText(data.address);
	const key = `v8|${norm(data.title)}|${norm(data.name)}|${city}|${data.year ?? ""}|${data.lat.toFixed(3)}`;
	const cached = fresh(photoCache.get(key));
	if (cached) return cached;
	const siblingNames = data.siblings.split("|").map((name) => name.trim()).filter(Boolean);
	const allowed = [
		data.name,
		data.country,
		data.title,
		city,
		data.address,
		...siblingNames
	].join(" ");
	const context = contextWords(data.name, siblingNames);
	const ratio = await filmAspect(data.title, data.year).catch(() => void 0);
	const liveStills = await keepWorking(await locationStills(data.title, data.name, allowed, ratio, data.year).catch(() => []));
	if (liveStills.length) {
		photoCache.set(key, {
			at: Date.now(),
			value: liveStills
		});
		return liveStills;
	}
	const tokens = photoTokens(data.name);
	const namedQuery = city ? `${data.name} ${city}` : data.name;
	const fits = (row, requireCity) => {
		const blob = `${row.caption} ${row.url}`;
		if (PHOTO_JUNK.test(blob)) return false;
		if (mentionsForeign(blob, allowed)) return false;
		if (requireCity && city && !new RegExp(`\\b${city.replace(/ /g, "\\s+")}\\b`, "i").test(blob)) return false;
		return matchesPlace(blob, data.name, context);
	};
	let rows = [];
	try {
		const [geo, named] = await Promise.all([commonsNear(data.lat, data.lng, tokens), commonsNamed(data.name, tokens, city)]);
		rows = [...geo.filter((row) => fits(row, false)), ...named.filter((row) => fits(row, true))];
	} catch {
		rows = [];
	}
	try {
		const hunter = await hunterPhotos(data.title, data.name);
		rows = [...rows, ...hunter.filter((row) => fits(row, false))];
	} catch {}
	let photos = takePhotos(rows, 6).map((photo) => ({
		...photo,
		kind: "place"
	}));
	if (photos.length < 3) try {
		const more = (await openversePhotos(namedQuery, tokens)).filter((row) => fits(row, true));
		photos = takePhotos([...photos.map((photo) => ({
			...photo,
			score: 5
		})), ...more], 6).map((photo) => ({
			...photo,
			kind: "place"
		}));
	} catch {}
	photos = await keepWorking(photos);
	if (photos.length) photoCache.set(key, {
		at: Date.now(),
		value: photos
	});
	return photos;
});
function parseLocationPage(html) {
	const quoteMatch = html.match(/&ldquo;([\s\S]{20,520}?)&rdquo;/);
	const quote = quoteMatch ? decodeEntities(quoteMatch[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
	const description = decodeEntities(html.match(/<meta name="description" content="([^"]+)"/)?.[1] || "");
	const answers = [...html.matchAll(/"acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"/g)].map((match) => decodeEntities(match[1]));
	const films = [];
	const seen = new Set();
	for (const blob of [...answers, description]) {
		for (const match of blob.matchAll(/([^\n,][^()]{1,70}?)\s*\(((?:19|20)\d{2})\)/g)) {
			let title = match[1].replace(/^.*\bincluding\s+/i, "").replace(/^.*\bfor\s+/i, "").trim();
			title = title.replace(/^(a|an|the)\s+/i, (full) => full);
			if (!title || title.length < 2 || /production|recorded|filming location|photograph/i.test(title)) continue;
			const key = title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			films.push({ title, year: match[2] });
			if (films.length >= 3) break;
		}
		if (films.length >= 3) break;
	}
	const image = html.match(/"contentUrl":"(https:[^"]+)"/)?.[1]?.replace(/\\u0026/g, "&");
	return { quote, films, image };
}
const WIKI_LANG = {
	Taiwan: "zh",
	China: "zh",
	"Hong Kong": "zh",
	Macau: "zh",
	Japan: "ja",
	"South Korea": "ko",
	Korea: "ko",
	Thailand: "th",
	Vietnam: "vi",
	Indonesia: "id",
	France: "fr",
	Germany: "de",
	Italy: "it",
	Spain: "es",
	Mexico: "es",
	Brazil: "pt",
	Poland: "pl",
	Sweden: "sv",
	Netherlands: "nl",
	Turkey: "tr"
};
const SHOT_WORD = /拍攝|取景|外景|ロケ|撮影|촬영|filmed|filming|was shot|shot at|on location|gedreht|tourné|rodad/i;
async function localScene(country, title, place) {
	const lang = WIKI_LANG[country];
	if (!lang || !title) return "";
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		prop: "extracts",
		generator: "search",
		gsrsearch: `${title} ${place}`,
		gsrlimit: "1",
		explaintext: "1",
		exchars: "1400"
	});
	const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
		headers: { "user-agent": UA, accept: "application/json" },
		signal: AbortSignal.timeout(3200)
	});
	if (!res.ok) return "";
	const data = await res.json();
	const page = Object.values(data.query?.pages ?? {})[0];
	const extract = page?.extract || "";
	if (!extract) return "";
	const sentences = extract.split(/(?<=[。．.!?])\s+/).map((sentence) => sentence.replace(/\s+/g, " ").trim()).filter((sentence) => sentence.length > 30);
	const hint = place.replace(/\s*\(.*$/, "").slice(0, 16);
	const hit = sentences.find((sentence) => SHOT_WORD.test(sentence) && sentence.toLowerCase().includes(hint.toLowerCase())) || sentences.find((sentence) => SHOT_WORD.test(sentence));
	return hit ? hit.slice(0, 280) : "";
}
async function readPlacePage(url) {
	if (!url) return null;
	const res = await fetch(url, {
		headers: { "user-agent": UA, accept: "text/html" },
		signal: AbortSignal.timeout(4000)
	});
	if (!res.ok) return null;
	return parseLocationPage(await res.text());
}
// Every production the atlas records at a place: Wikidata's "filmed at" list
// first, then the ones Wikipedia articles name. The atlas API is CORS-enabled,
// so this is the same on the server and on the static GitHub Pages build.
async function atlasPlace(slug, url) {
	const place = slug || String(url || "").match(/\/locations\/([^/?#]+)/)?.[1];
	if (!place) return null;
	const raw = await mcp("what_was_filmed_here", { place: decodeURIComponent(place), limit: 100 });
	const seen = new Set();
	const films = [];
	for (const film of [...(raw.filmed_here ?? []), ...(raw.filmed_here_per_wikipedia ?? [])]) {
		const title = String(film?.name ?? "").trim();
		const key = film?.slug || title.toLowerCase();
		if (!title || seen.has(key)) continue;
		// Games and anime can be "set in" a place rather than filmed there.
		if (film.relation && !/filmed/i.test(String(film.relation))) continue;
		seen.add(key);
		films.push({ title, year: film.year ? String(film.year) : "" });
	}
	const image = typeof raw.image === "string" && raw.image.startsWith("https://") ? raw.image : void 0;
	return { films, image };
}
async function mapPool(items, limit, fn) {
	const out = new Array(items.length);
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			out[index] = await fn(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
	return out;
}
async function wikiThumb(name) {
	const title = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
	const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(6e3)
	});
	if (!res.ok) return void 0;
	const body = await res.json();
	const source = body.thumbnail?.source;
	if (!source || body.type === "disambiguation") return void 0;
	if (/coat[_ ]of[_ ]arms|flag_of|\blogo\b|seal_of|locator_map|emblem/i.test(decodeURIComponent(source))) return void 0;
	return {
		url: source,
		caption: body.title || name
	};
}
async function thumbFor(lat, lng, name) {
	const [wiki, commons] = await Promise.all([wikiThumb(name).catch(() => void 0), commonsThumb(lat, lng, name).catch(() => void 0)]);
	return wiki ?? commons;
}
async function commonsThumb(lat, lng, name) {
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
		iiurlwidth: "640"
	});
	const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(7e3)
	});
	if (!res.ok) return void 0;
	const data = await res.json();
	const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
	let fallback;
	for (const page of Object.values(data.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		const caption = captionFromFile(page.title ?? "");
		if (!info?.thumburl || !caption) continue;
		if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
		if (PHOTO_JUNK.test(`${caption} ${info.thumburl}`)) continue;
		if (info.thumbwidth && info.thumbheight) {
			const ratio = info.thumbwidth / info.thumbheight;
			if (ratio < .5 || ratio > 2.4) continue;
		}
		const hit = {
			url: info.thumburl,
			caption
		};
		if (!fallback) fallback = hit;
		if (words.some((word) => caption.toLowerCase().includes(word))) return hit;
	}
	return fallback;
}

const favesCache = new Map();
function decodeEntities(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}
async function readLetterboxd() {
	const cached = favesCache.get("faves");
	if (cached && Date.now() - cached.at < 60000) return cached.value;
	const pages = ["https://letterboxd.com/dedomenici/list/faves/", "https://letterboxd.com/dedomenici/list/faves/page/2/"];
	const htmls = await Promise.all(pages.map(async (url) => {
		const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(8000) });
		return res.ok ? await res.text() : "";
	}));
	const seen = new Set();
	const titles = [];
	for (const html of htmls) {
		for (const match of html.matchAll(/data-item-name="([^"]+)"/g)) {
			const title = decodeEntities(match[1] ?? "").replace(/\s+\(\d{4}\)\s*$/, "").trim();
			const key = title.toLowerCase();
			if (!title || seen.has(key)) continue;
			seen.add(key);
			titles.push(title);
		}
	}
	if (titles.length < 9) throw new Error("Letterboxd list was short");
	favesCache.set("faves", { at: Date.now(), value: titles });
	return titles;
}
export const letterboxdFaves = createServerFn({ method: "POST" }).handler(async () => readLetterboxd());
export const freshPicks = createServerFn({ method: "POST" }).handler(async () => {
	let pool = GOOD_FAVES;
	try {
		const live = await readLetterboxd();
		const allow = new Set(GOOD_FAVES.map((title) => title.toLowerCase()));
		const matched = live.filter((title) => allow.has(title.toLowerCase()));
		if (matched.length >= 9) pool = matched;
	} catch {}
	return shuffleNine(pool);
});

var nearCache = new Map();
export const nearbyFilms = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Missing location");
	const raw = input;
	const lat = Number(raw.lat);
	const lng = Number(raw.lng);
	const miles = Number(raw.radiusMiles);
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("That location doesn't look right.");
	if (!Number.isFinite(miles) || miles < 0 || miles > 100) throw new Error("Pick a distance from 0 to 100 miles.");
	return { lat, lng, radiusKm: Math.max(1, miles * 1.609344) };
}).handler(async ({ data }) => {
	const key = `v7|${data.lat.toFixed(2)}|${data.lng.toFixed(2)}|${data.radiusKm.toFixed(1)}`;
	const cached = fresh(nearCache.get(key));
	if (cached) return cached;
	const raw = await mcp("locations_near", {
		latitude: data.lat,
		longitude: data.lng,
		radius_km: data.radiusKm,
		limit: 40
	});
	const rows = (raw.results ?? []).filter((row) => row.name && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)).sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
	const specific = rows.filter((row) => !["region", "fiction", "city"].includes(row.category ?? ""));
	const ranked = (specific.length >= 4 ? specific : rows).slice(0, 16);
	const [pages, atlases] = await Promise.all([
		mapPool(ranked, 6, async (row) => readPlacePage(row.page).catch(() => null)),
		mapPool(ranked, 6, async (row) => atlasPlace(row.slug, row.page).catch(() => null))
	]);
	const needWiki = ranked.map((row, index) => ({ row, index, page: pages[index] })).filter((item) => item.index < 6 && !(item.page?.quote));
	const wikiNotes = new Map();
	await mapPool(needWiki, 4, async (item) => {
		const title = atlases[item.index]?.films?.[0]?.title || item.page?.films?.[0]?.title || item.row.top_productions?.[0];
		const scene = await localScene(item.row.country, title, item.row.name).catch(() => "");
		if (scene) wikiNotes.set(item.index, scene);
	});
	const spots = ranked.map((row, index) => {
		const page = pages[index];
		const atlas = atlases[index];
		const filmed = (atlas?.films?.length ? atlas.films : page?.films?.length ? page.films : (row.top_productions ?? []).filter(Boolean).map((title) => ({ title, year: "" })));
		const scene = page?.quote || wikiNotes.get(index) || "";
		const filmCredits = filmed.map((film) => film.year ? `${film.title} (${film.year})` : film.title).filter(Boolean);
		const credits = filmCredits.slice(0, 4).join(", ");
		return {
			id: row.slug || `${row.latitude},${row.longitude}`,
			name: row.name,
			country: row.country || "",
			category: row.category_label || row.category || "Place",
			precision: row.precision || "",
			lat: row.latitude,
			lng: row.longitude,
			distanceKm: typeof row.distance_km === "number" ? row.distance_km : 0,
			films: filmed.map((film) => film.title).filter(Boolean),
			credits,
			filmCredits,
			scene,
			page: row.page || "",
			image: page?.image || atlas?.image,
			imageCaption: filmed[0]?.title || row.name
		};
	});
	const value = {
		total: raw.total_within_radius ?? spots.length,
		spots
	};
	nearCache.set(key, {
		at: Date.now(),
		value
	});
	return value;
});
export const geocodePlace = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Type a place");
	const q = String(input.q ?? "").trim().slice(0, 80);
	if (q.length < 2) throw new Error("Type a place");
	return { q };
}).handler(async ({ data }) => {
	const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(data.q)}`;
	const res = await fetch(url, {
		headers: {
			"user-agent": UA,
			accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) throw new Error("Place search didn't answer");
	const hit = (await res.json()).results?.[0];
	const lat = Number(hit?.latitude);
	const lng = Number(hit?.longitude);
	if (!hit?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return {
		name: [hit.name, hit.admin1 || hit.country].filter(Boolean).join(", "),
		lat,
		lng
	};
});
async function commonsNamed(name, tokens, city = "") {
	if (!tokens.length && !city) return [];
	const bare = name.replace(/"/g, "");
	const queries = city ? [`"${bare}" ${city}`, `${tokens.join(" ")} ${city}`] : [`"${bare}"`, tokens.join(" ")];
	const photos = [];
	const seen = /* @__PURE__ */ new Set();
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
			iiurlwidth: "900"
		});
		const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
			headers: {
				"user-agent": UA,
				accept: "application/json"
			},
			signal: AbortSignal.timeout(1e4)
		});
		if (!res.ok) continue;
		const data = await res.json();
		for (const page of Object.values(data.query?.pages ?? {})) {
			const info = page.imageinfo?.[0];
			const caption = captionFromFile(page.title ?? "");
			if (!info?.thumburl || !caption || seen.has(info.thumburl)) continue;
			if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
			if (PHOTO_JUNK.test(caption)) continue;
			const score = tokenScore(caption, tokens);
			if (score < 1) continue;
			seen.add(info.thumburl);
			photos.push({
				url: info.thumburl,
				caption,
				credit: "Wikimedia Commons",
				kind: "place",
				score: score + 1
			});
		}
		if (photos.length >= 4) break;
	}
	return photos;
}
