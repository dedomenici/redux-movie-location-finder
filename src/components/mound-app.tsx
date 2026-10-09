import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ACTS, sortActs, sortByStart, type Act } from "@/lib/mound-data";
import { MOUND, WALKS } from "@/lib/mound-walks";
import { asset } from "@/lib/static-host";

function londonClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hh = parts.find((part) => part.type === "hour")?.value ?? "00";
  const mm = parts.find((part) => part.type === "minute")?.value ?? "00";
  return { label: `${hh}:${mm}`, minutes: Number(hh) * 60 + Number(mm) };
}

let audio: AudioContext | null = null;

function context() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!audio) audio = new Ctx();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function blip(freq: number, when: number, dur: number, type: OscillatorType, gain: number) {
  const ctx = context();
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function playBravo() {
  const ctx = context();
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => blip(freq, t + i * 0.09, 0.28, "triangle", 0.14));
  blip(1318, t + 0.38, 0.35, "sine", 0.08);
}

function playBoo() {
  const ctx = context();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.7);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.08, t + 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.8);
  blip(180, t + 0.05, 0.4, "square", 0.04);
  blip(110, t + 0.28, 0.4, "triangle", 0.06);
}

type Card = { act: Act; day: "tonight" | "tomorrow" };

function buildDeck(now: number): Card[] {
  const tonight = sortActs(ACTS, now).map((act) => ({ act, day: "tonight" as const }));
  const tomorrow = sortByStart(ACTS).map((act) => ({ act, day: "tomorrow" as const }));
  return [...tonight, ...tomorrow];
}

const SHOUTS = {
  right: ["BRAVO!", "BRAVO!", "BRAVO!"],
  left: ["BOOO!", "BOOO!", "BOOO!"],
};

export function MoundApp() {
  const [started, setStarted] = useState(false);
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [opened, setOpened] = useState("");
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  const [view, setView] = useState<"deck" | "bravos" | "about">("deck");
  const [profile, setProfile] = useState<string | null>(null);
  const [bravos, setBravos] = useState<string[]>([]);
  const [stored, setStored] = useState(false);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);

  useEffect(() => {
    const clock = londonClock();
    setOpened(clock.label);
    setDeck(buildDeck(clock.minutes));
    const raw = window.localStorage.getItem("mound-bravos");
    if (!raw) {
      setStored(true);
      return;
    }
    try {
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids)) setBravos(ids.filter((id) => ACTS.some((act) => act.id === id)));
    } catch {
      /* a fresh night */
    }
    setStored(true);
  }, []);

  useEffect(() => {
    if (!stored) return;
    window.localStorage.setItem("mound-bravos", JSON.stringify(bravos));
  }, [bravos, stored]);

  const cycle = deck?.length ? Math.floor(index / deck.length) : 0;
  const card = deck?.length ? deck[index % deck.length] : null;
  const act = card?.act ?? null;
  const saved = bravos.map((id) => ACTS.find((item) => item.id === id)).filter((item): item is Act => Boolean(item));
  const openAct = profile ? ACTS.find((item) => item.id === profile) ?? null : null;

  function fling(dir: "left" | "right") {
    if (flying || !act) return;
    if (dir === "right") {
      playBravo();
      setBravos((ids) => (ids.includes(act.id) ? ids : [...ids, act.id]));
    } else playBoo();
    setFlying(dir);
    window.setTimeout(() => {
      setFlying(null);
      setDrag(0);
      setIndex((n) => n + 1);
    }, 900);
  }

  function down(event: PointerEvent<HTMLElement>) {
    if (flying || (event.target as HTMLElement).closest("a")) return;
    start.current = { x: event.clientX, y: event.clientY, on: true };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!start.current?.on || flying) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 18) return;
    setDrag(dx);
  }

  function up() {
    if (!start.current?.on) return;
    start.current.on = false;
    if (drag > 90) fling("right");
    else if (drag < -90) fling("left");
    else setDrag(0);
  }

  if (!started) {
    return (
      <div className="mound mound-launch">
        <img src={asset("/mound/hill.jpg")} alt="The Mound in Edinburgh at night, rain on the cobbles, a couple walking toward the lit hill." />
        <div className="mound-launch-copy">
          <p className="mound-kicker">Edinburgh Fringe 2026</p>
          <h1 className="display mound-title">The Mound</h1>
          <button type="button" className="solid" onClick={() => setStarted(true)}>
            Start the night
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mound">
      <header className="mound-top">
        <div>
          <p className="mound-kicker">Edinburgh Fringe 2026</p>
          <h1 className="display mound-title">The Mound</h1>
        </div>
        <nav className="mound-nav">
          <button type="button" className={view === "deck" && !profile ? "on" : ""} onClick={() => { setProfile(null); setView("deck"); }}>
            Tonight
          </button>
          <button type="button" className={view === "bravos" ? "on" : ""} onClick={() => { setProfile(null); setView("bravos"); }}>
            Bravos{bravos.length ? ` ${bravos.length}` : ""}
          </button>
          <button type="button" className={view === "about" ? "on" : ""} onClick={() => { setProfile(null); setView("about"); }}>
            Why
          </button>
        </nav>
      </header>

      {view === "about" && (
        <section className="mound-panel">
          <p className="display mound-lead">A dating app for the shame spiral.</p>
          <p>
            These are real shows from the 2026 EdFringe listings. The knock is a published review in The Skinny. Swipe
            the whole card right and the hill shouts bravo. Swipe left and it boos.
          </p>
          <p className="mound-note">
            An age with a source comes from an interview or a listing. An age marked estimated is a guess from the
            listing photo, not a fact. The bars are the venue bars. The line on the map is a walk from the top of the
            Mound.
          </p>
        </section>
      )}

      {view === "bravos" && !openAct && (
        <section className="mound-panel">
          <p className="display mound-lead">Your bravos</p>
          {saved.length === 0 && <p>Nobody yet. Swipe a card right.</p>}
          <ul className="mound-list">
            {saved.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setProfile(item.id)}>
                  <strong>{item.name}</strong>
                  <span>{item.show}</span>
                  <em>Age {item.age}</em>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "bravos" && openAct && (
        <section className="mound-deck">
          <button type="button" className="mound-back" onClick={() => setProfile(null)}>
            Back to your bravos
          </button>
          <Profile act={openAct} />
        </section>
      )}

      {view === "deck" && (
        <section className="mound-deck">
          <p className="mound-kicker">
            {card?.day === "tomorrow"
              ? cycle
                ? "Tomorrow again. Same starts, then the shortest walk."
                : "Tomorrow. Soonest start, then the shortest walk from the top of the Mound."
              : cycle
                ? "Again. Same night, same hill."
                : opened
                  ? `Opened at ${opened}. Soonest curtain, then the shortest walk from the top of the Mound.`
                  : "Checking the clock"}
          </p>
          {!deck && <p className="mound-when">Lining them up.</p>}
          {deck && deck.length === 0 && <p className="display mound-lead">The hill is quiet.</p>}
          {act && (
            <>
              <article
                key={`${cycle}-${card?.day}-${act.id}`}
                className={`mound-card mound-swipable ${flying === "right" ? "out-right" : ""} ${flying === "left" ? "out-left" : ""}`}
                style={flying ? undefined : { transform: `translateX(${drag}px) rotate(${drag / 28}deg)` }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              >
                <Profile act={act} day={card?.day} />
              </article>
              {flying && (
                <div className={`mound-burst ${flying === "left" ? "boo" : "bravo"}`} aria-hidden="true">
                  {SHOUTS[flying].map((word, i) => (
                    <span key={word + i} style={{ animationDelay: `${i * 0.08}s` }}>
                      {word}
                    </span>
                  ))}
                </div>
              )}
              <p className="mound-count">
                {cycle ? "Again. " : ""}
                {card?.day === "tomorrow" ? "Tomorrow, " : ""}
                {((index % (deck?.length || 1)) % ACTS.length) + 1} of {ACTS.length}. It keeps going.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Profile({ act, day = "tonight" }: { act: Act; day?: "tonight" | "tomorrow" }) {
  return (
    <>
      <div className="mound-photo">
        <img src={act.portrait} alt={`Listing image for ${act.show}`} />
      </div>
      <div className="mound-card-body">
        <p className="mound-kicker">
          {act.stars} stars · {day === "tomorrow" ? `tomorrow, on at ${act.starts}` : `off at ${act.ends}`} · {act.walk} min walk
        </p>
        <h2 className="display">{act.name}</h2>
        <p className="mound-show">
          {act.show}
          <span className="mound-age">Age {act.age}</span>
          <span className="mound-age-note">{act.ageNote}</span>
        </p>
        <p className="mound-meta">
          {act.venue}. Then {act.bar}.
        </p>
        <blockquote>
          “{act.review}”
          <cite>{act.paper}</cite>
        </blockquote>
        <p className="mound-stars" aria-label={`${act.stars} out of 5 stars`}>
          {"★".repeat(Number(act.stars))}
          <span>{"☆".repeat(5 - Number(act.stars))}</span>
        </p>
        <p className="mound-tell">Tell them</p>
        <p className="mound-line">{act.line}</p>
        <WalkMap id={act.id} venue={act.bar} />
        <div className="mound-links">
          <a href={act.listingUrl}>EdFringe listing</a>
          <a className="review" href={act.reviewUrl}>
            The review
          </a>
          {act.instagram.map((url, i) => (
            <a key={url} className="ig" href={url}>
              {act.id === "plot" ? (i === 0 ? "Sophie on Instagram" : "Abby on Instagram") : "Instagram"}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * 256;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * 256;
  return { x, y };
}

function WalkMap({ id, venue }: { id: string; venue: string }) {
  const walk = WALKS[id];
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  const zoom = !walk || walk.minutes > 20 ? 15 : 16;
  const points = walk
    ? [project(MOUND.lat, MOUND.lng, zoom), ...walk.path.map(([lat, lng]) => project(lat, lng, zoom))]
    : [];
  const minX = points.length ? Math.min(...points.map((point) => point.x)) - 48 : 0;
  const maxX = points.length ? Math.max(...points.map((point) => point.x)) + 48 : 1;
  const minY = points.length ? Math.min(...points.map((point) => point.y)) - 48 : 0;
  const maxY = points.length ? Math.max(...points.map((point) => point.y)) + 48 : 1;
  const width = maxX - minX;
  const height = maxY - minY;

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / width);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [width]);

  if (!walk) return null;
  const tiles = [];
  for (let tx = Math.floor(minX / 256); tx <= Math.floor(maxX / 256); tx += 1) {
    for (let ty = Math.floor(minY / 256); ty <= Math.floor(maxY / 256); ty += 1) {
      tiles.push({ tx, ty });
    }
  }
  const line = points.map((point) => `${point.x - minX},${point.y - minY}`).join(" ");
  const start = points[0];
  const end = points[points.length - 1];
  return (
    <figure className="mound-route" aria-label={`${walk.minutes} minute walk from the top of the Mound to ${venue}`}>
      <div className="mound-route-frame" ref={frame} style={{ height: Math.max(160, height * scale) }}>
        <div className="mound-route-sheet" style={{ width, height, transform: `scale(${scale})` }}>
          {tiles.map((tile) => (
            <img
              key={`${tile.tx}-${tile.ty}`}
              alt=""
              src={`https://tile.openstreetmap.org/${zoom}/${tile.tx}/${tile.ty}.png`}
              style={{ left: tile.tx * 256 - minX, top: tile.ty * 256 - minY }}
            />
          ))}
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
            <polyline points={line} />
          </svg>
          <span className="mound-pin start" style={{ left: start.x - minX, top: start.y - minY }}>
            The Mound
          </span>
          <span className="mound-pin end" style={{ left: end.x - minX, top: end.y - minY }}>
            {walk.minutes} min
          </span>
        </div>
      </div>
      <figcaption>
        {walk.minutes} min walk to {venue}. © OpenStreetMap
      </figcaption>
    </figure>
  );
}
