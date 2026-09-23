import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { geocodePlace, nearbyFilms } from "@/lib/film.functions";
import type { NearbySpot } from "@/lib/film-types";

export const Route = createFileRoute("/near")({
  component: NearPage,
});

const RADII = [10, 25, 80] as const;

function NearPage() {
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready">("idle");
  const [error, setError] = useState("");
  const [you, setYou] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(25);
  const [spots, setSpots] = useState<NearbySpot[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [place, setPlace] = useState("");
  const gen = useRef(0);

  async function load(lat: number, lng: number, nextRadius: number, label: string) {
    const id = ++gen.current;
    setYou({ lat, lng, label });
    setRadius(nextRadius as (typeof RADII)[number]);
    setSpots([]);
    setStatus("loading");
    setError("");
    try {
      const result = await nearbyFilms({ data: { lat, lng, radiusKm: nextRadius } });
      if (gen.current !== id) return;
      setSpots(result.spots);
      setTotal(result.total);
      setSelectedId(result.spots[0]?.id ?? "");
      setStatus("ready");
      if (!result.spots.length) setError("Nothing mapped in that radius. Try a wider one.");
    } catch (err) {
      if (gen.current !== id) return;
      setSpots([]);
      setStatus("ready");
      setError(err instanceof Error ? err.message : "Couldn't load nearby filming locations.");
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("This browser can't share a location. Type a place instead.");
      return;
    }
    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void load(pos.coords.latitude, pos.coords.longitude, radius, "You");
      },
      (err) => {
        setStatus("idle");
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location is blocked. Allow it in the browser, or type a place below.");
        } else if (err.code === err.TIMEOUT) {
          setError("The phone didn't answer with a location. Try again, or type a place.");
        } else {
          setError("No location signal. Type a place instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  }

  async function onPlace(event: FormEvent) {
    event.preventDefault();
    const q = place.trim();
    if (q.length < 2) return;
    setStatus("loading");
    setError("");
    try {
      const hit = await geocodePlace({ data: { q } });
      if (!hit) {
        setStatus(you ? "ready" : "idle");
        setError("That place didn't turn up.");
        return;
      }
      await load(hit.lat, hit.lng, radius, hit.name);
    } catch (err) {
      setStatus(you ? "ready" : "idle");
      setError(err instanceof Error ? err.message : "Place search failed");
    }
  }

  const selected = spots.find((spot) => spot.id === selectedId) ?? spots[0];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-4 md:px-6">
          <a href="/locations" className="flex flex-col items-center no-underline">
            <img src="/redux-logo.jpg" alt="The Redux Project" className="h-16 w-auto sm:h-20 md:h-24" />
            <span className="mt-1 font-display text-xl leading-none tracking-wide whitespace-nowrap text-fg md:text-3xl">
              Movie Location Finder
            </span>
          </a>
          <Link to="/locations" search={{ film: "" }} className="text-xs text-muted underline decoration-line underline-offset-4">
            back to search
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <h1 className="text-center font-display text-2xl leading-none tracking-wide text-balance md:text-3xl">
          Or find movie locations near you!
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-pretty text-muted">
          Press the button and the phone shares where you are. Filming spots near that point are pinned on the map,
          with a photo when one exists.
        </p>
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm text-bg disabled:opacity-60"
            onClick={locate}
            disabled={status === "locating" || status === "loading"}
          >
            {status === "locating" ? "Finding you…" : status === "loading" ? "Plotting locations…" : "Or find movie locations near you!"}
          </button>
        </div>
        <form className="mx-auto mt-4 flex max-w-md gap-2" onSubmit={(event) => void onPlace(event)}>
          <label className="sr-only" htmlFor="near-place">
            Or type a place
          </label>
          <input
            id="near-place"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="OR TYPE A PLACE"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-accent placeholder:text-[#b5b5b5] outline-none"
          />
          <button type="submit" className="min-h-11 rounded-full border border-line px-4 text-sm">
            Go
          </button>
        </form>
        {error && (
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-accent" role="alert">
            {error}
          </p>
        )}
        {you && status !== "idle" && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm text-muted">
                {you.label === "You" ? "Near your location" : you.label}
                {total > spots.length ? ` · ${total} places in range, showing ${spots.length}` : ""}
              </p>
              <div className="flex gap-2">
                {RADII.map((km) => (
                  <button
                    key={km}
                    type="button"
                    className={
                      "min-h-11 rounded-full border px-3 text-xs " +
                      (radius === km ? "border-accent text-accent" : "border-line text-muted")
                    }
                    onClick={() => void load(you.lat, you.lng, km, you.label)}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>
            {spots.length > 0 && (
              <>
                <NearbyMap you={you} spots={spots} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {spots.map((spot) => {
                    const on = spot.id === selected?.id;
                    return (
                      <li key={spot.id}>
                        <article
                          className={
                            "overflow-hidden rounded-md border bg-bg " + (on ? "border-accent" : "border-line")
                          }
                        >
                          <button type="button" className="block w-full text-left" onClick={() => setSelectedId(spot.id)}>
                            {spot.image ? (
                              <img
                                src={spot.image}
                                alt={spot.imageCaption || spot.name}
                                className="h-44 w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-24 items-center justify-center bg-surface text-xs text-muted">
                                No photo yet
                              </div>
                            )}
                            <div className="px-3 py-3">
                              <h2 className="text-sm">{spot.name}</h2>
                              <p className="mt-1 text-xs text-muted">
                                {spot.distanceKm < 0.1 ? "right here" : `${spot.distanceKm.toFixed(1)} km`}
                                {spot.category ? ` · ${spot.category}` : ""}
                              </p>
                            </div>
                          </button>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-3 text-xs">
                            {spot.films.map((film) => (
                              <a
                                key={film}
                                className="text-fg underline decoration-line underline-offset-4"
                                href={`/?film=${encodeURIComponent(film)}`}
                              >
                                {film}
                              </a>
                            ))}
                            <a
                              className="text-muted underline decoration-line underline-offset-4"
                              href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              map
                            </a>
                            {spot.page && (
                              <a
                                className="text-muted underline decoration-line underline-offset-4"
                                href={spot.page}
                                target="_blank"
                                rel="noreferrer"
                              >
                                source
                              </a>
                            )}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function lonTile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}

function latTile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

function NearbyMap({
  you,
  spots,
  selectedId,
  onSelect,
}: {
  you: { lat: number; lng: number };
  spots: NearbySpot[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const points = useMemo(
    () => [{ lat: you.lat, lng: you.lng }, ...spots.map((spot) => ({ lat: spot.lat, lng: spot.lng }))],
    [you.lat, you.lng, spots],
  );
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 640, h: 384 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [you.lat, you.lng, spots]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) setFrame({ w, h });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => {
    let zoom = 15;
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    const minLatPad = minLat - latSpan * 0.28;
    const maxLatPad = maxLat + latSpan * 0.28;
    const minLngPad = minLng - lngSpan * 0.28;
    const maxLngPad = maxLng + lngSpan * 0.28;
    while (zoom > 4) {
      const dx = Math.abs(lonTile(maxLngPad, zoom) - lonTile(minLngPad, zoom));
      const dy = Math.abs(latTile(maxLatPad, zoom) - latTile(minLatPad, zoom));
      if (dx <= 3 && dy <= 2) break;
      zoom -= 1;
    }
    const cx = lonTile((minLng + maxLng) / 2, zoom);
    const cy = latTile((minLat + maxLat) / 2, zoom);
    const spanX = 5;
    const spanY = 4;
    const x0 = Math.floor(cx) - 2;
    const y0 = Math.floor(cy) - 2;
    const tiles: { x: number; y: number }[] = [];
    for (let x = x0; x < x0 + spanX; x += 1) {
      for (let y = y0; y < y0 + spanY; y += 1) {
        if (x >= 0 && y >= 0 && x < 2 ** zoom && y < 2 ** zoom) tiles.push({ x, y });
      }
    }
    const scale = Math.max(frame.w / (spanX * 256), frame.h / (spanY * 256));
    return { zoom, cx, cy, x0, y0, tiles, scale, width: spanX * 256, height: spanY * 256 };
  }, [points, frame.w, frame.h]);

  function place(lat: number, lng: number) {
    const fx = lonTile(lng, view.zoom);
    const fy = latTile(lat, view.zoom);
    return {
      left: frame.w / 2 + pan.x + (fx - view.cx) * 256 * view.scale,
      top: frame.h / 2 + pan.y + (fy - view.cy) * 256 * view.scale,
    };
  }

  const originLeft = (view.x0 - view.cx) * 256;
  const originTop = (view.y0 - view.cy) * 256;

  return (
    <div
      ref={frameRef}
      className="relative mt-3 h-96 cursor-grab touch-none overflow-hidden rounded-md border border-line bg-surface select-none active:cursor-grabbing"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* optional */
        }
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        setPan({ x: current.panX + event.clientX - current.x, y: current.panY + event.clientY - current.y });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: view.width,
          height: view.height,
          transform: `translate(${pan.x + originLeft * view.scale}px, ${pan.y + originTop * view.scale}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {view.tiles.map((tile) => (
          <img
            key={`${tile.x}-${tile.y}`}
            alt=""
            width={256}
            height={256}
            draggable={false}
            className="pointer-events-none absolute"
            style={{ left: (tile.x - view.x0) * 256, top: (tile.y - view.y0) * 256 }}
            src={`/api/tile?z=${view.zoom}&x=${tile.x}&y=${tile.y}`}
          />
        ))}
      </div>
      {spots.map((spot) => {
        const pos = place(spot.lat, spot.lng);
        const on = spot.id === selectedId;
        return (
          <button
            key={spot.id}
            type="button"
            title={spot.name}
            className="absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{ left: pos.left, top: pos.top }}
            onClick={() => onSelect(spot.id)}
          >
            <svg viewBox="0 0 24 36" className={(on ? "pin-flash " : "") + "h-9 w-6 drop-shadow-md"} aria-hidden="true">
              <path
                d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                fill={on ? "#22c55e" : "#15803d"}
              />
              <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
            </svg>
          </button>
        );
      })}
      {(() => {
        const pos = place(you.lat, you.lng);
        return (
          <span
            className="pointer-events-none absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent"
            style={{ left: pos.left, top: pos.top }}
            title="You"
          />
        );
      })()}
      <p className="pointer-events-none absolute right-2 bottom-2 rounded-sm bg-bg/90 px-1.5 py-0.5 text-[10px] text-muted">
        Map data © Google
      </p>
    </div>
  );
}
