import { useState } from "react";
import { Link } from "@tanstack/react-router";

type Project = {
  id: string;
  title: string;
  year: string;
  blurb: string;
  href?: string;
  video?: string;
  stamp: string;
};

const PROJECTS: Project[] = [
  {
    id: "atonement",
    title: "Atonement: Redux",
    year: "BBC Radio 4",
    blurb: "The beach scene, remade, then talked about on the BBC Radio 4 Film Programme.",
    href: "https://thereduxproject.com/atonement",
    video: "rKchcxN0TOE",
    stamp: "REDUX",
  },
  {
    id: "redux",
    title: "The Redux Project",
    year: "Ongoing",
    blurb:
      "Memorable moments from film and television, recreated in meticulous makeshift detail. Richard sends them up and celebrates them, then invites everyone else to make their own.",
    href: "https://thereduxproject.com",
    stamp: "LO-FI",
  },
  {
    id: "palestine",
    title: "Palestinian Song Contest",
    year: "Now",
    blurb: "A song contest with a point. One of the projects sitting at the top of the real site.",
    href: "https://dedomenici.com/palestiniansongcontest",
    stamp: "LIVE",
  },
  {
    id: "well",
    title: "Well Rounded Individual",
    year: "Now",
    blurb: "Currently shouting from the front page of dedomenici.com.",
    href: "https://dedomenici.com/wellroundedindividual",
    stamp: "ROUND",
  },
  {
    id: "fringe",
    title: "Imaginary Edinburgh Fringe",
    year: "Now",
    blurb: "A fringe that does not need the city to agree it is happening.",
    href: "https://dedomenici.com/imaginaryedinburghfringe",
    stamp: "FRINGE",
  },
  {
    id: "anarch",
    title: "Anarchitecture In The UK",
    year: "Now",
    blurb: "Buildings, rules, and the pleasure of getting them slightly wrong.",
    href: "https://dedomenici.com/anarchitectureintheuk",
    stamp: "PLAN",
  },
  {
    id: "fallout",
    title: "Mission: Impossible — City Chase Walk",
    year: "City of London",
    blurb: "A city chase you walk. Commissioned by the City of London, built with Setmaker.",
    href: "https://dedomenici.com/falloutcitychase",
    stamp: "WALK",
  },
  {
    id: "umbrella",
    title: "Social Umbrella",
    year: "Prototype",
    blurb: "A prototype the Wall Street Journal wrote about in the fashion pages. Of course they did.",
    href: "https://dedomenici.com/socialumbrella",
    stamp: "DRIP",
  },
  {
    id: "corona",
    title: "Coronavision",
    year: "The year it wasn’t",
    blurb: "Eurovision may be cancelled, but we have the technology to make our own.",
    href: "https://dedomenici.com/coronavision",
    stamp: "DOUZE",
  },
  {
    id: "rev",
    title: "In Bed With The Rev",
    year: "Ten years",
    blurb: "A feature documentary about Reverend Billy and the Church of Life After Shopping.",
    href: "https://dedomenici.com/inbedwiththerev",
    stamp: "REV",
  },
  {
    id: "shed",
    title: "Shed Your Fears",
    year: "Tate Modern",
    blurb: "An installation at Tate Modern. Fears, shed.",
    href: "https://dedomenici.com/shedyourfears",
    stamp: "SHED",
  },
  {
    id: "cloud",
    title: "Cloud Atlas: Redux",
    year: "Glasgow, 48 hours",
    blurb:
      "The San Francisco 1973 street scenes, which were filmed in Glasgow, reshot in Glasgow. The Scotsman gave it more stars than the actual film.",
    video: "STgLMaK0Xk0",
    stamp: "STARS",
  },
  {
    id: "yen",
    title: "3000 Yen House",
    year: "Yokohama",
    blurb:
      "A lightweight house, carried to Yokohama International Port Terminal dressed as a Japanese construction worker. Pet architecture meets nojuko.",
    video: "_P_LF6PNXTY",
    stamp: "¥3000",
  },
  {
    id: "bangkok",
    title: "Bangkok Traffic Love Story: Redux",
    year: "2013",
    blurb: "Filmed and edited in Bangkok between the 6th and 9th of February, then premiered at the Scala Cinema.",
    href: "https://dedomenici.com/redux",
    video: "V70EV3xlflo",
    stamp: "SCALA",
  },
  {
    id: "torch",
    title: "Torch2012",
    year: "2012",
    blurb:
      "For two months Richard ran ahead of the Olympic torch relay with a homemade torch. Designed to cause the kind of uncertainty that leads to possibility.",
    stamp: "FAKE",
  },
  {
    id: "train",
    title: "How To Disembark A Speeding Train",
    year: "2012",
    blurb:
      "A jump from a 300 km/h Javelin, hoping Essex might get the station High Speed One forgot. Granted the London 2012 Inspire mark. Seb Coe said a sentence about it.",
    stamp: "JUMP",
  },
  {
    id: "godzilla",
    title: "Devastate Modern",
    year: "Tate, 2012",
    blurb:
      "Inspired by Yayoi Kusama, Richard wore a Godzilla suit and destroyed miniature New Yorks that visitors had built that afternoon.",
    stamp: "RAWR",
  },
  {
    id: "hoff",
    title: "Looking For Looking For Freedom",
    year: "Berlin",
    blurb: "Three years later, a check on the David Hasselhoff exhibit covertly installed at Checkpoint Charlie.",
    href: "https://www.youtube.com/watch?v=_3C6TACC8X0",
    video: "_3C6TACC8X0",
    stamp: "HOFF",
  },
  {
    id: "igloo",
    title: "Kendal Mint Cake Igloo",
    year: "Mintfest",
    blurb: "Sixty-four enormous blocks of Kendal Mint Cake, assembled into an igloo, with the last people still making the stuff.",
    stamp: "MINT",
  },
  {
    id: "bomb",
    title: "Bomb Predisposal Unit",
    year: "2012",
    blurb: "The logical conclusion of vigilante justice in a hyper-vigilant world, offered to the regions after the Games.",
    stamp: "SAFE",
  },
  {
    id: "popaganda",
    title: "Popaganda",
    year: "Edinburgh",
    blurb: "Ever wanted to see Popaganda 21 times in a row? Every night except Mondays.",
    href: "https://dedomenici.com/popaganda",
    stamp: "x21",
  },
  {
    id: "fizz",
    title: "Making Your Mind Up",
    year: "Southbank",
    blurb: "A radical feminist Bucks Fizz tribute at Alternative Eurovision. They came third.",
    href: "https://dedomenici.com/FuxBizz",
    stamp: "3RD",
  },
  {
    id: "swivel",
    title: "Swivelympics",
    year: "Office sports",
    blurb: "An international sporting competition played on office chairs, partly to see if anyone would enforce the London 2012 brand rules. Nobody did.",
    href: "https://www.swivelympics.com",
    stamp: "SPIN",
  },
];

const THUMBS = PROJECTS.filter((project) => project.video);

function Logo() {
  return (
    <svg viewBox="0 0 760 210" className="h-auto w-full max-w-3xl" role="img" aria-label="Richard DeDomenici">
      <rect x="18" y="22" width="724" height="168" rx="18" fill="var(--color-yolk)" transform="rotate(-1.4 380 106)" />
      <rect x="34" y="36" width="692" height="140" rx="12" fill="none" stroke="var(--color-ink)" strokeWidth="6" />
      <circle cx="78" cy="70" r="16" fill="var(--color-bubble)" />
      <circle cx="78" cy="148" r="16" fill="var(--color-flare)" />
      <circle cx="682" cy="70" r="16" fill="var(--color-aqua)" />
      <circle cx="682" cy="148" r="16" fill="var(--color-bubble)" />
      <text
        x="380"
        y="118"
        textAnchor="middle"
        fill="var(--color-ink)"
        fontFamily="Bungee, Impact, sans-serif"
        fontSize="68"
      >
        DeDomenici
      </text>
      <text
        x="380"
        y="156"
        textAnchor="middle"
        fill="var(--color-dedo)"
        fontFamily="Outfit, sans-serif"
        fontSize="18"
        letterSpacing="4"
      >
        DANGEROUS TOYS · EST. 1798
      </text>
    </svg>
  );
}

export function DedomeniciSite() {
  const [lit, setLit] = useState(PROJECTS[0]?.id ?? "");
  const [video, setVideo] = useState(PROJECTS[0]?.video ?? "");
  const current = PROJECTS.find((project) => project.id === lit) ?? PROJECTS[0];

  function openProject(project: Project) {
    setLit(project.id);
    if (project.video) setVideo(project.video);
    document.getElementById(project.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function surprise() {
    const pool = PROJECTS.filter((project) => project.id !== lit);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? PROJECTS[0];
    if (pick) openProject(pick);
  }

  const strip = [...THUMBS, ...THUMBS];

  return (
    <div className="dedo min-h-screen overflow-x-hidden">
      <header className="px-4 pt-6 pb-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rounded-full bg-bubble px-3 py-2 text-sm text-ink">Artist · Filmmaker · Raconteur</p>
          <Link
            to="/locations"
            search={{ film: "" }}
            className="inline-flex min-h-11 items-center rounded-full bg-yolk px-4 text-sm text-ink no-underline"
          >
            Movie Location Finder
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-center font-display text-3xl leading-tight text-balance text-yolk md:text-5xl">
          Manufacturer of dangerous toys since 1798.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-pretty text-cream">
          Richard DeDomenici makes lo-fi spectacles, fake torch relays, mint-cake igloos, and film scenes rebuilt by
          whoever turns up. This is the loud version of the work already living on dedomenici.com.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="dedo-wobble min-h-11 rounded-full bg-flare px-6 py-3 text-lg text-ink"
            onClick={surprise}
          >
            Random project
          </button>
          <a
            className="inline-flex min-h-11 items-center rounded-full bg-aqua px-5 text-ink no-underline"
            href="https://www.youtube.com/dedomenici"
            target="_blank"
            rel="noreferrer"
          >
            YouTube channel
          </a>
          <a
            className="inline-flex min-h-11 items-center rounded-full border-2 border-yolk px-5 text-yolk no-underline"
            href="https://dedomenici.com"
            target="_blank"
            rel="noreferrer"
          >
            The original site
          </a>
        </div>
      </header>

      <div className="dedo-mask mt-4">
        <div className="dedo-marquee">
          {strip.map((project, index) => (
            <button
              key={`${project.id}-${index}`}
              type="button"
              className="w-56 shrink-0 text-left"
              onClick={() => openProject(project)}
            >
              <img
                src={`https://i.ytimg.com/vi/${project.video}/hqdefault.jpg`}
                alt=""
                className="h-32 w-full rounded-md object-cover"
              />
              <span className="mt-1 block text-sm text-yolk">{project.title}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <section className="mx-auto mt-8 max-w-5xl px-4 md:px-8">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-md bg-ink">
              {video ? (
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${video}`}
                  title={current.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-bubble p-6 text-center text-2xl text-ink">
                  No trailer. The rumour is the work.
                </div>
              )}
            </div>
            <div className="relative rounded-md bg-yolk p-5 text-ink">
              <span className="absolute -top-3 right-4 rotate-6 rounded-full bg-bubble px-3 py-1 text-sm">{current.stamp}</span>
              <p className="text-sm tracking-widest uppercase">{current.year}</p>
              <h2 className="mt-2 font-display text-3xl leading-none">{current.title}</h2>
              <p className="mt-3 text-base leading-relaxed">{current.blurb}</p>
              {current.href && (
                <a className="mt-4 inline-flex min-h-11 items-center text-dedo underline" href={current.href} target="_blank" rel="noreferrer">
                  More on this one
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto mt-10 max-w-6xl px-4 pb-16 md:px-8">
        <h2 className="font-display text-3xl text-aqua">The pile</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((project, index) => {
            const tilt = index % 2 === 0 ? "dedo-tilt-a" : "dedo-tilt-b";
            const on = project.id === lit;
            return (
              <li key={project.id} id={project.id}>
                <button
                  type="button"
                  onClick={() => openProject(project)}
                  className={
                    "flex h-full min-h-44 w-full flex-col items-start rounded-md p-4 text-left " +
                    tilt +
                    " " +
                    (on ? "bg-bubble text-ink" : index % 3 === 0 ? "bg-flare text-ink" : "bg-cream text-ink")
                  }
                >
                  <span className="rounded-full bg-dedo px-2 py-1 text-xs text-yolk">{project.stamp}</span>
                  <span className="mt-3 font-display text-2xl leading-none">{project.title}</span>
                  <span className="mt-1 text-sm">{project.year}</span>
                  <span className="mt-2 text-sm leading-relaxed">{project.blurb}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="border-t-4 border-yolk px-4 py-8 text-cream md:px-8">
        <p className="max-w-3xl text-lg leading-relaxed">
          For further examples of Richard’s work, visit the{" "}
          <a className="text-yolk underline" href="http://dedomenicitemporarywebsite.blogspot.co.uk" target="_blank" rel="noreferrer">
            temporary website
          </a>
          , the{" "}
          <a className="text-aqua underline" href="https://www.youtube.com/dedomenici" target="_blank" rel="noreferrer">
            YouTube channel
          </a>
          , or, like, just google him.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          <a className="inline-flex min-h-11 items-center text-yolk underline" href="https://thereduxproject.com" target="_blank" rel="noreferrer">
            The Redux Project
          </a>
          <a className="inline-flex min-h-11 items-center text-aqua underline" href="https://dedomenici.com" target="_blank" rel="noreferrer">
            dedomenici.com
          </a>
          <Link to="/locations" search={{ film: "" }} className="inline-flex min-h-11 items-center text-flare underline">
            Movie Location Finder
          </Link>
        </p>
      </footer>
    </div>
  );
}
