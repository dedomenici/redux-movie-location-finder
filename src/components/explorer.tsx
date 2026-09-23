import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, MapPin, Search } from "lucide-react";
import { filmPosters, loadFilm, placePhotos, sceneFrames, streetView, suggestMovies } from "@/lib/film.functions";
import type { Dossier, FilmLocation, PlacePhoto, Still, StreetViewHit, Suggestion } from "@/lib/film-types";

let sharedAudio: AudioContext | null = null;

function unlockAudio() {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!sharedAudio) sharedAudio = new Ctx();
  void sharedAudio.resume();
}

function blip(freq: number, ms = 60, type: OscillatorType = "square", level = 0.03) {
  const ctx = sharedAudio;
  if (!ctx || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const t = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(level, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

const FAVES = [
  "Tampopo",
  "Koyaanisqatsi",
  "The Life Aquatic with Steve Zissou",
  "The Blues Brothers",
  "My Life as a Dog",
  "Akira",
  "An American Werewolf in London",
  "Fallen Angels",
  "Dream Agency",
  "Assault on Precinct 13",
  "Clerks",
  "Das Boot",
  "Madonna: Truth or Dare",
  "Full Metal Jacket",
  "Total Recall",
  "Contact",
  "The Departed",
  "Basic Instinct",
  "The Iron Giant",
  "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
  "The Taking of Pelham One Two Three",
  "The Terminator",
  "WarGames",
  "Chungking Express",
  "Terminator 2: Judgment Day",
  "Trading Places",
  "Clueless",
  "Children of Men",
  "Alien",
  "Lost in Translation",
  "2001: A Space Odyssey",
  "Fight Club",
  "A Clockwork Orange",
  "E.T. the Extra-Terrestrial",
  "Delicatessen",
  "The Devil Wears Prada",
  "After Hours",
  "Nineteen Eighty-Four",
  "Amélie",
  "Beau Travail",
  "Blade Runner",
  "Die Hard",
  "The Adventures of Buckaroo Banzai Across the 8th Dimension",
  "Her",
  "Catch Me If You Can",
  "Léon: The Professional",
  "Mon Oncle",
  "Songs from the Second Floor",
  "Mad Max 2",
  "Mission: Impossible – Fallout",
  "Eastern Promises",
  "Jurassic Park",
  "Bridesmaids",
  "The Arbor",
  "Birdman or (The Unexpected Virtue of Ignorance)",
  "Flight of the Navigator",
  "Triangle of Sadness",
  "Predator",
  "Election",
  "The Fifth Element",
  "In the Line of Fire",
  "Time Bandits",
  "Darkman",
  "Animal Crackers",
  "Romy and Michele's High School Reunion",
  "Reservoir Dogs",
  "Me and You and Everyone We Know",
  "Working Girl",
  "L.A. Confidential",
  "Silkwood",
  "The Heat",
  "Nikita",
  "Romance & Cigarettes",
  "Demolition Man",
  "L.A. Story",
  "Duck Soup",
  "Falling Down",
  "London",
  "The Rock",
  "Tangerine",
  "Robinson in Space",
  "Class of 1999",
  "Airplane!",
  "The Truman Show",
  "Little Shop of Horrors",
  "Step Brothers",
  "Amazon Women on the Moon",
  "The Truth About Cats & Dogs",
  "Thor: Ragnarok",
  "Due Date",
  "Gravity",
  "Shame",
  "Dredd",
  "Big Trouble in Little China",
  "Short Circuit",
  "Gattaca",
  "The Town",
  "The Accountant",
  "Asteroid City",
  "Get Hard",
  "Something Wild",
  "The Bourne Identity",
  "The Abyss",
  "The Silence of the Lambs",
  "*batteries not included",
  "Indiana Jones and the Last Crusade",
  "The Wackness",
  "Jack Reacher",
  "Police Academy",
  "All Over Me",
  "Gremlins 2: The New Batch",
  "Beverly Hills Cop",
  "Crank: High Voltage",
  "Drive",
  "Cold Pursuit",
  "M3GAN",
  "Black Rain",
  "Michael Clayton",
  "The Bronze",
  "The Libertine",
  "Wayne's World",
  "A View to a Kill",
  "Earth Girls Are Easy",
  "Superman III",
  "Central Intelligence",
  "Bangkok Traffic (Love) Story",
  "R.O.T.O.R.",
  "Dirty Rotten Scoundrels",
];

function pickToday() {
  const day = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (const ch of day) seed = (Math.imul(seed, 33) + ch.charCodeAt(0)) | 0;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = FAVES.filter((title) => title.toLowerCase() !== "robocop");
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return ["RoboCop", ...pool.slice(0, 9)];
}

const REEL: { src: string; caption: string; href: string; pos?: string }[] = [
  {
    src: "/reel/atonement-run.jpg",
    caption: "Atonement: Redux — the beach at Redcar",
    href: "https://thereduxproject.com/atonement",
  },
  {
    src: "/reel/get-carter-slate.jpg",
    caption: "Get Carter: Redux — slate on the steps",
    href: "https://thereduxproject.com/getcarter",
  },
  {
    src: "/reel/get-carter-bridge.jpg",
    caption: "Get Carter: Redux by the Tyne Bridge",
    href: "https://thereduxproject.com/getcarter",
  },
  {
    src: "/reel/get-carter-steps.jpg",
    caption: "Get Carter: Redux — down the stone steps",
    href: "https://thereduxproject.com/getcarter",
  },
  {
    src: "/reel/ddlj-escalator.jpg",
    caption: "DDLJ: Redux on the station escalator",
    href: "https://thereduxproject.com/ddlj",
  },
  {
    src: "/reel/last-christmas-strand.jpg",
    caption: "Last Christmas: Redux outside the Strand Palace",
    href: "https://thereduxproject.com/lastchristmas",
  },
  {
    src: "/reel/last-chance-harvey.jpg",
    caption: "Last Chance Harvey: Redux, London",
    href: "https://thereduxproject.com/lastchanceharvey",
    pos: "object-[center_18%]",
  },
  {
    src: "/reel/all-of-us-strangers.jpg",
    caption: "All of Us Strangers: Redux crew",
    href: "https://thereduxproject.com/allofusstrangers",
  },
  {
    src: "/reel/clockwork-orange.jpg",
    caption: "A Clockwork Orange: Redux",
    href: "https://thereduxproject.com/clockworkorange",
  },
  {
    src: "/reel/doctor-who.jpg",
    caption: "Doctor Who: Redux",
    href: "https://thereduxproject.com/doctorwho",
  },
  {
    src: "/reel/withnail.jpg",
    caption: "Withnail & I: Redux",
    href: "https://thereduxproject.com/withnail",
  },
  {
    src: "/reel/american-assassin.jpg",
    caption: "American Assassin: Redux",
    href: "https://thereduxproject.com/americanassassin",
  },
  {
    src: "/reel/brighton-rock.jpg",
    caption: "Brighton Rock: Redux",
    href: "https://thereduxproject.com/brightonrock",
    pos: "object-[center_15%]",
  },
];

function shuffleReel<T>(items: readonly T[]) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}

function pickSuggestion(rows: Suggestion[], query: string): Suggestion | undefined {
  if (!rows.length) return undefined;
  const q = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const eightyFour = q === "1984" || q === "nineteen eighty four";
  if (eightyFour) {
    const feature = rows.find(
      (row) => row.imdbId === "tt0087803" || (row.year === 1984 && (row.qid === "movie" || row.kind === "feature")),
    );
    if (feature) return feature;
  }
  const movies = rows.filter(
    (row) => row.title.toLowerCase() === query.toLowerCase() && (row.qid === "movie" || row.kind === "feature"),
  );
  if (movies.length) return [...movies].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
  return rows.find((row) => row.title.toLowerCase() === query.toLowerCase()) ?? rows[0];
}

function tidyProse(text: string) {
  return text
    .replace(/^(locations and sets|filming locations)\s+/i, "")
    .replace(/^filming\s+(?=[A-Z])/i, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sameNote(a: string, b: string) {
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const words = (text: string) => text.split(" ").filter((word) => word.length > 3);
  const aWords = words(left);
  const bWords = words(right);
  if (aWords.length < 6 || bWords.length < 6) return false;
  const bag = new Set(bWords);
  const shared = aWords.filter((word) => bag.has(word)).length;
  return shared / Math.min(aWords.length, bWords.length) >= 0.7;
}

export function Explorer({ initialFilm = "" }: { initialFilm?: string }) {
  const [today] = useState(pickToday);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const [busy, setBusy] = useState<"suggest" | "film" | null>(null);
  const [error, setError] = useState("");
  const [film, setFilm] = useState<Dossier | null>(null);
  const [pending, setPending] = useState<Suggestion | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [street, setStreet] = useState<StreetViewHit | null>(null);
  const [streetLoading, setStreetLoading] = useState(false);
  const [streetError, setStreetError] = useState("");
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [photosReady, setPhotosReady] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState<string | null>(null);
  const suggestGen = useRef(0);
  const streetGen = useRef(0);
  const holdList = useRef(false);

  useEffect(() => {
    document.title = film
      ? `${film.title} — The Redux Project Movie Location Finder`
      : "The Redux Project Movie Location Finder";
  }, [film]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const gen = ++suggestGen.current;
    const timer = window.setTimeout(() => {
      setBusy((b) => (b === "film" ? b : "suggest"));
      suggestMovies({ data: { q } })
        .then((rows) => {
          if (suggestGen.current !== gen) return;
          setSuggestions(rows);
          if (!holdList.current) setOpenList(true);
        })
        .catch((err: unknown) => {
          if (suggestGen.current !== gen) return;
          setError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (suggestGen.current === gen) setBusy((b) => (b === "suggest" ? null : b));
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const active = film?.locations.find((loc) => loc.id === activeId) ?? film?.locations[0];

  useEffect(() => {
    setMatchedId(null);
    if (!active) {
      setStreet(null);
      return;
    }
    const gen = ++streetGen.current;
    setStreet(null);
    setStreetError("");
    setStreetLoading(true);
    streetView({ data: { lat: active.lat, lng: active.lng, label: active.address } })
      .then((hit) => {
        if (streetGen.current !== gen) return;
        setStreet(hit);
      })
      .catch((err: unknown) => {
        if (streetGen.current !== gen) return;
        setStreetError(err instanceof Error ? err.message : "Street View lookup failed");
      })
      .finally(() => {
        if (streetGen.current === gen) setStreetLoading(false);
      });
  }, [active]);

  async function openSuggestion(hit: Suggestion) {
    holdList.current = true;
    setOpenList(false);
    setQuery(hit.title);
    setError("");
    setPending(hit);
    setFilm(null);
    setBusy("film");
    try {
      const dossier = await loadFilm({
        data: {
          title: hit.title,
          imdbId: hit.imdbId,
          year: hit.year,
          poster: hit.poster,
          cast: hit.cast,
          director: hit.director,
          qid: hit.qid,
        },
      });
      setFilm(dossier);
      setActiveId(dossier.locations[0]?.id ?? null);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that title");
      setPending(null);
    } finally {
      setBusy((b) => (b === "film" ? null : b));
    }
  }

  async function onSubmit() {
    const q = query.trim();
    if (q.length < 2) return;
    holdList.current = true;
    setOpenList(false);
    setBusy("film");
    setError("");
    try {
      const rows = suggestions.length ? suggestions : await suggestMovies({ data: { q } });
      const hit = pickSuggestion(rows, q);
      if (!hit) {
        setError("No IMDb movie or series matched that.");
        setBusy(null);
        return;
      }
      await openSuggestion(hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setBusy(null);
    }
  }

  async function openExample(title: string) {
    holdList.current = true;
    setOpenList(false);
    setQuery(title);
    setBusy("film");
    setError("");
    try {
      const rows = await suggestMovies({ data: { q: title } });
      const hit = pickSuggestion(rows, title);
      if (!hit) {
        setError("No IMDb match.");
        setBusy(null);
        return;
      }
      await openSuggestion(hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setBusy(null);
    }
  }

  const bootFilm = useRef(false);
  useEffect(() => {
    const title = initialFilm.trim();
    if (!title || bootFilm.current) return;
    bootFilm.current = true;
    void openExample(title);
  }, [initialFilm]);

  const shown = film;
  const filmingCopy = (() => {
    const bits = [active?.scene, ...(shown?.filmingNotes ?? [])].filter((note): note is string => Boolean(note?.trim()));
    const unique: string[] = [];
    for (const note of bits) {
      if (unique.some((other) => sameNote(other, note))) continue;
      unique.push(note);
    }
    return unique.slice(0, 4);
  })();
  const headerTitle = shown?.title ?? pending?.title;
  const headerYear = shown?.year ?? pending?.year;
  const headerDirector = shown?.director ?? pending?.director;
  const headerPoster = shown?.poster ?? pending?.poster;
  const extrasReady = !headerTitle
    ? true
    : !shown
      ? false
      : shown.locations.length === 0
        ? true
        : matchedId === active?.id && photosReady === active?.id && mapReady === active?.id;

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
          <form
            className="relative w-full"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <label className="sr-only" htmlFor="movie-search">
              Search movie
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
            <input
              id="movie-search"
              value={query}
              autoComplete="off"
              placeholder="SEARCH MOVIE"
              role="combobox"
              aria-expanded={openList && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              onChange={(e) => {
                holdList.current = false;
                setQuery(e.target.value);
                setOpenList(true);
              }}
              onFocus={() => {
                if (!holdList.current) setOpenList(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setOpenList(false), 160);
              }}
              className="h-14 w-full rounded-md border border-line bg-surface pr-4 pl-11 font-display text-xl leading-none tracking-wide text-accent outline-none placeholder:text-[#b5b5b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lamp md:h-16 md:text-3xl"
            />
            {openList && suggestions.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-line bg-surface"
              >
                {suggestions.map((hit) => (
                  <li key={hit.imdbId} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2"
                      onClick={() => void openSuggestion(hit)}
                    >
                      {hit.poster ? (
                        <img src={hit.poster} alt="" className="h-12 w-8 rounded-sm object-cover" />
                      ) : (
                        <span className="h-12 w-8 rounded-sm bg-surface-2" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{hit.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {[hit.director, hit.year].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {!headerTitle && (
          <section className="mx-auto max-w-3xl py-8 md:py-12">
            <h1 className="font-display text-xl leading-none tracking-wide whitespace-nowrap md:text-3xl">
              Richard’s top movies today:
            </h1>
            <ul className="mt-6 flex flex-wrap gap-2">
              {today.map((title) => (
                <li key={title}>
                  <button
                    type="button"
                    className="min-h-11 rounded-full border border-line bg-surface px-3 text-xs hover:border-lamp hover:text-lamp"
                    onClick={() => void openExample(title)}
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-center">
              <Link
                to="/near"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-center text-sm text-bg no-underline"
              >
                Or find movie locations near you!
              </Link>
            </div>
            <LocationReel />
          </section>
        )}
        {error && (
          <p className="mb-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-accent" role="alert">
            {error}
          </p>
        )}
        {headerTitle && (
          <article>
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-tight font-semibold text-balance md:text-4xl">{headerTitle}</h1>
              {(headerDirector || headerYear) && (
                <p className="mt-1 text-sm text-muted">{[headerDirector, headerYear].filter(Boolean).join(" · ")}</p>
              )}
              {busy === "film" && <p className="mt-2 text-sm text-muted">Pulling places…</p>}
            </div>
            {shown && (
              <>
                {shown.locations.length === 0 ? (
                  <p className="mt-6 rounded-md border border-line bg-surface px-4 py-6 text-pretty">
                    No mapped filming places turned up for this title. The IMDb locations page may still list sets the
                    open records missed.
                  </p>
                ) : (
                  <>
                    <ul className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {shown.locations.map((loc) => (
                        <li key={loc.id} className="shrink-0">
                          <LocationButton loc={loc} active={loc.id === active?.id} onPick={() => setActiveId(loc.id)} />
                        </li>
                      ))}
                    </ul>
                    {active && (
                      <div className="mt-4 space-y-6">
                        <StreetPane
                          key={active.id}
                          location={active}
                          street={street}
                          loading={streetLoading}
                          error={streetError}
                          title={shown.title}
                          siblings={shown.locations.map((loc) => loc.name).join("|")}
                          year={shown.year}
                          onMatch={() => setMatchedId(active.id)}
                        />
                        {matchedId === active.id && (
                          <>
                            <LocationImages
                              location={active}
                              title={shown.title}
                              year={shown.year}
                              address={street?.address || active.address}
                              siblings={shown.locations.map((loc) => loc.name).join("|")}
                              onReady={() => setPhotosReady(active.id)}
                            />
                            <LocationMap
                              locations={[active]}
                              places={shown.locations}
                              onPick={(id) => setActiveId(id)}
                              onReady={() => setMapReady(active.id)}
                            />
                          </>
                        )}
                        <PosterStrip
                          title={shown.title}
                          poster={headerPoster}
                          year={shown.year}
                          imdbId={shown.imdbId}
                        />
                        {extrasReady && filmingCopy.length > 0 && (
                          <div className="max-w-3xl">
                            <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Filming notes</h2>
                            <div className="mt-2 space-y-2 text-xs text-pretty text-muted">
                              {filmingCopy.map((note) => (
                                <p key={note}>{tidyProse(note)}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {extrasReady && shown.countriesOnly.length > 0 && (
                  <p className="mt-6 text-sm text-muted">Also named, too broad to pin: {shown.countriesOnly.join(", ")}.</p>
                )}
              </>
            )}
          </article>
        )}

        {extrasReady && (
        <footer className="mt-12 border-t border-line pt-4 text-xs leading-relaxed text-pretty text-muted">
          <p className="max-w-3xl text-sm text-muted">
            The redux project is artist richard DeDomenici’s increasingly ambitious series of lo-fi site-specific
            participatory movie remakes. Richard has made over a hundred with communities around the world, and this
            free tool is intended to help you make your own Reduxes! Send your finished masterpieces to{" "}
            <a className="underline decoration-line underline-offset-4" href="mailto:yourreduxes@dedomenici.com">
              yourreduxes@dedomenici.com
            </a>{" "}
            for inclusion{" "}
            <a
              className="underline decoration-line underline-offset-4"
              href="https://thereduxproject.com/yourreduxes"
              target="_blank"
              rel="noreferrer"
            >
              here!
            </a>
          </p>
          <p className="mt-4 text-sm text-fg">
            watch all the Reduxes at{" "}
            <a className="underline decoration-line underline-offset-4" href="https://thereduxproject.com" target="_blank" rel="noreferrer">
              TheReduxProject.com
            </a>
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a className="inline-flex min-h-11 items-center text-fg underline decoration-line underline-offset-4" href="https://www.instagram.com/thereduxproject/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a className="inline-flex min-h-11 items-center text-fg underline decoration-line underline-offset-4" href="https://x.com/TheReduxProject" target="_blank" rel="noreferrer">
              X
            </a>
            <a
              className="inline-flex min-h-11 items-center text-fg underline decoration-line underline-offset-4"
              href="https://www.facebook.com/share/g/1bzmNASS3H/?mibextid=wwXIfr"
              target="_blank"
              rel="noreferrer"
            >
              Facebook
            </a>
          </p>
          <div className="mt-4 max-w-3xl">
            <iframe
              className="aspect-video w-full"
              src="https://www.youtube-nocookie.com/embed/oYRxy9LTHl0"
              title="The Redux Project explainer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-sm text-fg">
            take part in{" "}
            <a
              className="underline decoration-line underline-offset-4"
              href="https://thereduxproject.com/headsofstate"
              target="_blank"
              rel="noreferrer"
            >
              Heads Of State: Redux
            </a>
            !
          </p>
          <p className="mt-4 text-sm text-fg">
            Vibecoded by{" "}
            <a className="underline decoration-line underline-offset-4" href="https://dedomenici.com" target="_blank" rel="noreferrer">
              DeDomenici
            </a>
          </p>
        </footer>
        )}
      </main>
    </div>
  );
}

function LocationReel() {
  const [shots, setShots] = useState(REEL);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setShots(shuffleReel(REEL));
    setIndex(0);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setIndex((n) => (n + 1) % shots.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [shots]);
  const shot = shots[index] ?? shots[0];
  return (
    <figure className="mt-8 overflow-hidden rounded-md border border-line">
      <div className="relative h-64 bg-surface md:h-80">
        {shots.map((item, i) => (
          <img
            key={item.src}
            src={item.src}
            alt={i === index ? item.caption : ""}
            aria-hidden={i === index ? undefined : true}
            className={
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 " +
              (item.pos ?? "object-center") +
              " " +
              (i === index ? "opacity-100" : "opacity-0")
            }
          />
        ))}
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-xs text-muted">
        <span className="text-fg">{shot.caption}</span>
        <a className="underline decoration-line underline-offset-4" href={shot.href} target="_blank" rel="noreferrer">
          The Redux Project
        </a>
      </figcaption>
    </figure>
  );
}

function lonTile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}

function latTile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

function googlePinHref(place: FilmLocation) {
  const label = encodeURIComponent(place.name || "Filming location");
  return `https://www.google.com/maps?q=${place.lat},${place.lng}+(${label})`;
}

function placeBlurb(place: FilmLocation) {
  return [place.category, place.country].filter(Boolean).join(" · ");
}

function LocationMap({
  locations,
  places,
  onPick,
  onReady,
}: {
  locations: FilmLocation[];
  places: FilmLocation[];
  onPick?: (id: string) => void;
  onReady?: () => void;
}) {
  const loc = locations[0];
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const told = useRef("");
  useEffect(() => {
    if (!loc) return;
    const id = loc.id;
    const timer = window.setTimeout(() => {
      if (told.current === id) return;
      told.current = id;
      readyRef.current?.();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [loc]);
  const [satellite, setSatellite] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const placeKey = places.map((place) => place.id).join("|");
  useEffect(() => {
    setShowAll(false);
  }, [placeKey]);

  const zoom = 16;
  const box = useMemo(() => {
    if (!loc || showAll) return null;
    const fx = lonTile(loc.lng, zoom);
    const fy = latTile(loc.lat, zoom);
    const span = 5;
    const x0 = Math.floor(fx) - 2;
    const y0 = Math.floor(fy) - 2;
    const tiles: { x: number; y: number }[] = [];
    for (let x = x0; x < x0 + span; x += 1) {
      for (let y = y0; y < y0 + span; y += 1) {
        if (x >= 0 && y >= 0 && x < 2 ** zoom && y < 2 ** zoom) tiles.push({ x, y });
      }
    }
    const size = span * 256;
    return {
      tiles,
      x0,
      y0,
      size,
      pinLeft: (fx - x0) * 256,
      pinTop: (fy - y0) * 256,
    };
  }, [loc, showAll]);

  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [frame, setFrame] = useState({ w: 1, h: 1 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const allView = useMemo(() => {
    if (!showAll || places.length === 0) return null;
    let z = 15;
    const lats = places.map((place) => place.lat);
    const lngs = places.map((place) => place.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    const minLatPad = minLat - latSpan * 0.35;
    const maxLatPad = maxLat + latSpan * 0.35;
    const minLngPad = minLng - lngSpan * 0.35;
    const maxLngPad = maxLng + lngSpan * 0.35;
    while (z > 3) {
      const dx = Math.abs(lonTile(maxLngPad, z) - lonTile(minLngPad, z));
      const dy = Math.abs(latTile(maxLatPad, z) - latTile(minLatPad, z));
      if (dx <= 3.2 && dy <= 2.4) break;
      z -= 1;
    }
    const cx = lonTile((minLng + maxLng) / 2, z);
    const cy = latTile((minLat + maxLat) / 2, z);
    const spanX = 5;
    const spanY = 4;
    const x0 = Math.floor(cx) - 2;
    const y0 = Math.floor(cy) - 2;
    const tiles: { x: number; y: number }[] = [];
    for (let x = x0; x < x0 + spanX; x += 1) {
      for (let y = y0; y < y0 + spanY; y += 1) {
        if (x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z) tiles.push({ x, y });
      }
    }
    const fit = Math.max(frame.w / (spanX * 256), frame.h / (spanY * 256));
    return { zoom: z, cx, cy, x0, y0, tiles, scale: fit, width: spanX * 256, height: spanY * 256 };
  }, [showAll, places, frame.w, frame.h]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [showAll, placeKey]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setFrame({ w, h });
      if (!showAll) setScale(w / (2.6 * 256));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [box, showAll]);

  function clampPan(next: { x: number; y: number }) {
    if (!box || showAll) return next;
    const minX = frame.w / 2 - (box.size - box.pinLeft) * scale;
    const maxX = box.pinLeft * scale - frame.w / 2;
    const minY = frame.h / 2 - (box.size - box.pinTop) * scale;
    const maxY = box.pinTop * scale - frame.h / 2;
    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
    };
  }

  function placePoint(lat: number, lng: number) {
    if (!allView) return { left: 0, top: 0 };
    const fx = lonTile(lng, allView.zoom);
    const fy = latTile(lat, allView.zoom);
    return {
      left: frame.w / 2 + pan.x + (fx - allView.cx) * 256 * allView.scale,
      top: frame.h / 2 + pan.y + (fy - allView.cy) * 256 * allView.scale,
    };
  }

  if (!loc || (!showAll && !box)) return null;
  const lyrs = satellite ? "y" : "m";
  const pinLink = googlePinHref(loc);

  return (
    <section aria-labelledby="location-map">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="location-map" className="text-xs font-medium tracking-widest text-muted uppercase">
          Map
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={satellite}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-xs"
            onClick={() => setSatellite((on) => !on)}
          >
            {satellite ? "Map" : "Satellite"}
          </button>
          <a
            className="inline-flex min-h-11 items-center gap-1 text-xs text-fg underline decoration-line underline-offset-4"
            href={pinLink}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div
        ref={frameRef}
        role="application"
        aria-label={
          showAll
            ? `Pins for every filmed spot in this movie. Drag to move. The larger pin is ${loc.name}.`
            : `Map of ${loc.name}. Drag to move around. Click to open this pin in Google Maps.`
        }
        className="relative mt-3 h-80 cursor-grab touch-none overflow-hidden rounded-md border border-line bg-surface select-none active:cursor-grabbing md:h-96"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture is optional */
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (Math.hypot(dx, dy) > 5) current.moved = true;
          setPan(showAll ? { x: current.panX + dx, y: current.panY + dy } : clampPan({ x: current.panX + dx, y: current.panY + dy }));
        }}
        onPointerUp={() => {
          const moved = drag.current?.moved;
          drag.current = null;
          if (!moved && !showAll) window.open(pinLink, "_blank", "noopener,noreferrer");
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {!showAll && box && (
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: box.size,
              height: box.size,
              transform: `translate(${pan.x - box.pinLeft * scale}px, ${pan.y - box.pinTop * scale}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {box.tiles.map((tile) => (
              <img
                key={`${lyrs}-${tile.x}-${tile.y}`}
                alt=""
                width={256}
                height={256}
                draggable={false}
                className="pointer-events-none absolute"
                referrerPolicy="no-referrer"
                style={{ left: (tile.x - box.x0) * 256, top: (tile.y - box.y0) * 256 }}
                src={`/api/tile?z=${zoom}&x=${tile.x}&y=${tile.y}&lyrs=${lyrs}`}
              />
            ))}
          </div>
        )}
        {showAll && allView && (
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: allView.width,
              height: allView.height,
              transform: `translate(${pan.x + (allView.x0 - allView.cx) * 256 * allView.scale}px, ${pan.y + (allView.y0 - allView.cy) * 256 * allView.scale}px) scale(${allView.scale})`,
              transformOrigin: "0 0",
            }}
          >
            {allView.tiles.map((tile) => (
              <img
                key={`${lyrs}-${tile.x}-${tile.y}`}
                alt=""
                width={256}
                height={256}
                draggable={false}
                className="pointer-events-none absolute"
                referrerPolicy="no-referrer"
                style={{ left: (tile.x - allView.x0) * 256, top: (tile.y - allView.y0) * 256 }}
                src={`/api/tile?z=${allView.zoom}&x=${tile.x}&y=${tile.y}&lyrs=${lyrs}`}
              />
            ))}
          </div>
        )}
        {showAll
          ? places.map((place) => {
              const pos = placePoint(place.lat, place.lng);
              const on = place.id === loc.id;
              return (
                <button
                  key={place.id}
                  type="button"
                  title={place.name}
                  className={"absolute flex -translate-x-1/2 -translate-y-full flex-col items-center " + (on ? "z-20" : "z-10")}
                  style={{ left: pos.left, top: pos.top }}
                  onClick={() => onPick?.(place.id)}
                >
                  {on && (
                    <span className="mb-1 max-w-40 truncate rounded-sm bg-bg/90 px-1 text-xs text-fg">{place.name}</span>
                  )}
                  <svg
                    viewBox="0 0 24 36"
                    className={(on ? "h-14 w-10" : "h-8 w-6") + " drop-shadow-md"}
                    aria-hidden="true"
                  >
                    <path
                      d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                      fill={on ? "#22c55e" : "#15803d"}
                    />
                    <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
                  </svg>
                </button>
              );
            })
          : (
            <span
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
              style={{ left: `calc(50% + ${pan.x}px)`, top: `calc(50% + ${pan.y}px)` }}
            >
              <svg viewBox="0 0 24 36" className="h-14 w-10 drop-shadow-md" aria-hidden="true">
                <path
                  d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                  fill="#22c55e"
                />
                <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
              </svg>
            </span>
          )}
        <p className="pointer-events-none absolute right-2 bottom-2 rounded-sm bg-bg/90 px-1.5 py-0.5 text-xs text-muted">
          Map data © Google
        </p>
      </div>
      <p className="mt-2">
        <button
          type="button"
          className="min-h-11 text-left text-xs text-muted underline decoration-line underline-offset-4"
          onClick={() => {
            setShowAll((on) => !on);
            frameRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        >
          {showAll ? "just this location" : "see all locations from this movie on a map"}
        </button>
      </p>
      {places.length > 1 && (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {places.map((place) => {
            const on = place.id === loc.id;
            return (
              <li key={place.id} className="flex items-start gap-3">
                <button
                  type="button"
                  className="min-h-11 flex-1 py-2 text-left hover:text-accent"
                  onClick={() => {
                    onPick?.(place.id);
                    setShowAll(false);
                  }}
                >
                  <span className={on ? "text-accent" : "text-fg"}>{place.name}</span>
                  <span className="mt-0.5 block text-xs text-pretty text-muted">{placeBlurb(place)}</span>
                </button>
                <a
                  className="inline-flex min-h-11 items-center text-xs text-muted underline decoration-line underline-offset-4"
                  href={googlePinHref(place)}
                  target="_blank"
                  rel="noreferrer"
                >
                  pin
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LocationImages({
  location,
  title,
  siblings,
  year,
  address,
  onReady,
}: {
  location: FilmLocation;
  title: string;
  siblings: string;
  year?: number;
  address: string;
  onReady?: () => void;
}) {
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const gen = useRef(0);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    const id = ++gen.current;
    setPhotos([]);
    void placePhotos({
      data: {
        lat: location.lat,
        lng: location.lng,
        name: location.name,
        country: location.country,
        title,
        siblings,
        address,
        year,
      },
    })
      .then((rows) => {
        if (gen.current !== id) return;
        setPhotos(rows);
        readyRef.current?.();
      })
      .catch(() => {
        if (gen.current !== id) return;
        setPhotos([]);
        readyRef.current?.();
      });
  }, [location.id, location.lat, location.lng, location.name, location.country, title, siblings, address, year]);
  if (!photos.length) return null;
  const stills = photos.every((photo) => photo.kind === "still");
  return (
    <section aria-labelledby="place-images">
      <h2 id="place-images" className="text-xs font-medium tracking-widest text-muted uppercase">
        {stills ? "From the movie" : "The location"}
      </h2>
      <p className="mt-1 text-xs text-pretty text-muted">
        {stills ? `Screengrabs of ${location.name} in ${title}.` : `Photographs of ${location.name}.`}
      </p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => (
          <li key={photo.url} className="w-64 shrink-0">
            <figure className="overflow-hidden rounded-md border border-line bg-bg">
              <img
                src={photo.url}
                alt={photo.caption}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-40 w-full object-cover"
                onError={() => setPhotos((rows) => rows.filter((row) => row.url !== photo.url))}
              />
              <figcaption className="px-2 py-2 text-xs text-pretty text-muted">
                <span className="line-clamp-2 text-fg">{photo.caption}</span>
                <span className="mt-1 block">{photo.credit}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LocationButton({ loc, active, onPick }: { loc: FilmLocation; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={
        "flex h-full min-h-11 w-56 flex-col items-start rounded-md border px-3 py-2 text-left md:w-full " +
        (active ? "border-lamp bg-surface-2" : "border-line bg-surface hover:border-muted")
      }
    >
      <span className="flex items-start gap-2">
        <MapPin className={"mt-0.5 size-4 shrink-0 " + (active ? "text-lamp" : "text-muted")} aria-hidden="true" />
        <span className="font-medium text-pretty">{loc.name}</span>
      </span>
      <span className="mt-1 pl-6 text-xs text-muted">
        {loc.country ? `${loc.country} · ` : ""}
        {loc.category}
      </span>
    </button>
  );
}

function PosterStrip({
  title,
  poster,
  year,
  imdbId,
}: {
  title: string;
  poster?: string;
  year?: number;
  imdbId: string;
}) {
  const [posters, setPosters] = useState<Still[]>(
    poster ? [{ url: poster, caption: `${title} poster`, source: "imdb" }] : [],
  );
  useEffect(() => {
    let live = true;
    void filmPosters({ data: { title, poster: poster ?? "", year: year ?? 0, imdbId } })
      .then((rows) => {
        if (live && rows.length) setPosters(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [title, poster, year, imdbId]);
  if (!posters.length) return null;
  return (
    <section aria-labelledby="posters">
      <h2 id="posters" className="text-xs font-medium tracking-widest text-muted uppercase">
        Posters
      </h2>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {posters.map((item) => (
          <li key={item.url} className="w-36 shrink-0">
            <figure className="overflow-hidden rounded-md border border-line bg-bg">
              <img
                src={item.url}
                alt={item.caption}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-52 w-full object-cover"
              />
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

function panoSrc(id: string, yaw: number, pitch: number, fov: number) {
  const heading = Math.round(((yaw % 360) + 360) % 360);
  const zoom = Math.round(Math.max(20, Math.min(110, fov)));
  return `/api/pano?id=${encodeURIComponent(id)}&yaw=${heading}&pitch=${pitch}&fov=${zoom}`;
}

type SweepFrame = { yaw: number; pitch: number; fov: number; status: string };

function sweepFrames(face: number): SweepFrame[] {
  return [
    { yaw: face - 120, pitch: 2, fov: 100, status: "ACQUIRING SIGNAL" },
    { yaw: face - 20, pitch: 6, fov: 86, status: "SCANNING HORIZON" },
    { yaw: face + 70, pitch: 4, fov: 64, status: "PANNING" },
    { yaw: face + 8, pitch: 10, fov: 42, status: "ANALYSING" },
    { yaw: face, pitch: 8, fov: 30, status: "ENHANCING" },
    { yaw: face, pitch: 8, fov: 22, status: "LOCKING" },
  ];
}

function StreetPane({
  location,
  street,
  loading,
  error,
  title,
  siblings,
  year,
  onMatch,
}: {
  location: FilmLocation;
  street: StreetViewHit | null;
  loading: boolean;
  error: string;
  title: string;
  siblings: string;
  year?: number;
  onMatch?: () => void;
}) {
  const face = street?.heading ?? 0;
  const [settled, setSettled] = useState(false);
  const [shown, setShown] = useState("");
  const [status, setStatus] = useState("ACQUIRING SIGNAL");
  const [thumbBroken, setThumbBroken] = useState(false);
  const [still, setStill] = useState<PlacePhoto | null>(null);
  const [stillBroken, setStillBroken] = useState(false);
  const hasFrame = useRef(false);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    let live = true;
    setStill(null);
    setStillBroken(false);
    void Promise.all([
      placePhotos({
        data: {
          lat: location.lat,
          lng: location.lng,
          name: location.name,
          country: location.country,
          title,
          siblings,
          address: street?.address || location.address,
          year,
        },
      }).catch(() => [] as PlacePhoto[]),
      sceneFrames({ data: { title, place: location.name, year } }).catch(() => [] as Still[]),
    ])
      .then(([rows, frames]) => {
        if (!live) return;
        const movie = rows.find((row) => row.kind === "still");
        const frame = frames[0];
        const picked =
          movie ??
          (frame
            ? { url: frame.url, caption: frame.caption, credit: "Screengrab", kind: "still" as const }
            : null);
        setStill(picked);
      })
      .catch(() => {
        if (!live) return;
        setStill(null);
      });
    return () => {
      live = false;
    };
  }, [location.id, location.lat, location.lng, location.name, location.country, title, siblings, year, street?.address]);

  useEffect(() => {
    hasFrame.current = false;
    setThumbBroken(false);
    setShown("");
    setSettled(false);
    setStatus("SCANNING HORIZON");
    const panoId = street?.panoId;
    if (!panoId) return;
    let cancelled = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames = reduce ? [{ yaw: face, pitch: 8, fov: 36, status: "LOCKING" }] : sweepFrames(face);
    const srcs = frames.map((frame) => panoSrc(panoId, frame.yaw, frame.pitch, frame.fov));
    const ready = new Set<number>();
    srcs.forEach((src, index) => {
      const img = new Image();
      img.onload = () => ready.add(index);
      img.src = src;
    });
    void (async () => {
      const step = 420;
      const started = Date.now();
      let last = "";
      for (let index = 0; index < frames.length; index += 1) {
        if (cancelled) return;
        const frame = frames[index];
        if (!frame) continue;
        const deadline = started + step * (index + 1);
        while (!ready.has(index) && Date.now() < deadline) {
          if (cancelled) return;
          await new Promise((resolve) => window.setTimeout(resolve, 40));
        }
        if (cancelled) return;
        if (ready.has(index)) {
          last = srcs[index] ?? last;
          hasFrame.current = true;
          setShown(last);
          setThumbBroken(false);
        }
        setStatus(frame.status);
        if (!reduce && hasFrame.current) blip(520 + index * 70, 40, "square", 0.028);
        const wait = deadline - Date.now();
        if (!reduce && index < frames.length - 1 && wait > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, wait));
        }
      }
      if (cancelled) return;
      if (!hasFrame.current) setThumbBroken(true);
      setSettled(true);
      setStatus("MATCH");
      onMatchRef.current?.();
      if (!reduce) {
        blip(880, 90, "sine", 0.05);
        window.setTimeout(() => blip(1320, 160, "sine", 0.045), 90);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [street?.panoId, face]);

  useEffect(() => {
    if (loading || street?.panoId) return;
    if (error || street) onMatchRef.current?.();
  }, [loading, error, street]);

  const showPano = Boolean(street?.coverage && street.panoId && !thumbBroken);
  const showEmbed = Boolean(street?.coverage && thumbBroken && street.embedUrl);
  const mapsPin = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  const address = street?.address || location.address;
  const movieStill = settled && still && !stillBroken ? still : null;

  return (
    <section className="overflow-hidden rounded-md border border-line bg-bg">
      <div className="border-b border-line bg-surface px-3 py-2">
        <div className="flex min-h-11 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-lamp" aria-hidden="true" />
          <p className="min-w-0 flex-1 font-display text-xl leading-none tracking-wide text-pretty" aria-live="polite">
            {loading && <span className="text-muted">ACQUIRING SIGNAL</span>}
            {error && <span className="font-sans text-sm tracking-normal text-accent">{error}</span>}
            {!loading && !error && <span>{settled ? "MOVIE LOCATION FOUND!" : status}</span>}
          </p>
        </div>
      </div>
      <div className="relative h-72 bg-surface md:h-stage">
        {showPano && shown && (
          <img
            src={shown}
            alt={settled ? `Street View of ${location.name}` : `Street View scanning toward ${location.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {((settled && street?.embedUrl) || showEmbed) && street?.embedUrl && (
          <iframe
            title={`Street View of ${street.address || location.name}`}
            src={street.embedUrl}
            className="absolute inset-0 z-10 h-full w-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
            allow="fullscreen"
          />
        )}
        {showPano && shown && !settled && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="hud-scan absolute inset-0" />
            <span className="absolute top-3 left-3 h-7 w-7 border-t-2 border-l-2 border-white" />
            <span className="absolute top-3 right-3 h-7 w-7 border-t-2 border-r-2 border-white" />
            <span className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-white" />
            <span className="absolute right-3 bottom-3 h-7 w-7 border-r-2 border-b-2 border-white" />
            <p className="absolute top-3 left-1/2 -translate-x-1/2 bg-fg/80 px-2 py-1 font-display text-lg leading-none tracking-widest text-white">
              {status}
            </p>
          </div>
        )}
        {!(showPano && shown) && !showEmbed && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-pretty text-muted">
            {loading
              ? "The address is going into Street View."
              : street && !street.coverage
                ? "No Street View panorama near this pin."
                : showPano
                  ? status
                  : "Pick a place."}
          </div>
        )}
      </div>
      {movieStill && (
        <figure className="border-t border-line">
          <img
            src={movieStill.url}
            alt={movieStill.caption || `Still of ${location.name} in ${title}`}
            className="max-h-80 w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setStillBroken(true)}
          />
          <figcaption className="px-3 py-2 text-xs text-pretty text-muted">
            <span className="font-display text-lg tracking-wide text-fg">From the movie</span>
            {movieStill.caption && <span className="mt-1 block">{movieStill.caption}</span>}
            {movieStill.credit && <span className="mt-1 block">{movieStill.credit}</span>}
          </figcaption>
        </figure>
      )}
      <div className="space-y-2 px-3 py-3 text-sm">
        {settled && <p className="font-display text-2xl leading-none tracking-wide text-accent">Movie location found!</p>}
        <p className="text-pretty text-fg">{location.name}</p>
        <p className="text-pretty text-fg">{address}</p>
        <p className="text-pretty text-muted">{location.precisionNote}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            className="inline-flex min-h-11 items-center gap-1 text-fg underline decoration-line underline-offset-4"
            href={mapsPin}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <a
            className="inline-flex min-h-11 items-center gap-1 text-fg underline decoration-line underline-offset-4"
            href={street?.mapsUrl ?? mapsPin}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Street View <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <p className="text-xs text-muted">Imagery © Google</p>
      </div>
    </section>
  );
}
