import { asset } from "@/lib/static-host";

export type Act = {
  id: string;
  name: string;
  age: string;
  ageNote: string;
  show: string;
  venue: string;
  bar: string;
  walk: number;
  ends: string;
  starts: string;
  stars: string;
  paper: string;
  review: string;
  reviewUrl: string;
  listingUrl: string;
  instagram: string[];
  line: string;
  portrait: string;
};

/** 2026 EdFringe listings, with the knock from The Skinny's published review. */
export const ACTS: Act[] = [
  {
    id: "raj",
    instagram: ["https://www.instagram.com/lord_rajj/"],
    name: "Raj Poojara",
    age: "30s",
    ageNote: "Casting listing",
    show: "Dice",
    venue: "Pleasance Courtyard, Bunker Three",
    bar: "Pleasance Courtyard bar",
    walk: 16,
    ends: "17:35",
    starts: "16:35",
    stars: "2",
    paper: "The Skinny",
    review: "Many of the jokes hit familiar beats, and cracks begin to show as Poojara loses confidence, and the room.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/raj-poojara-pleasance-courtyard",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/raj-poojara-dice",
    line: "The Skinny said the jokes were familiar and you lost the room. The Standard said the Ugandan-Indian home stories were yours, not the well-trodden ones, and that the crowd-work line was the best off the cuff at the Fringe. I was in Bunker Three. What are you drinking?",
    portrait: asset("/mound/2026/raj.jpg"),
  },
  {
    id: "freya",
    instagram: ["https://www.instagram.com/iamfreyaparker/"],
    name: "Freya Parker",
    age: "Past 30",
    ageNote: "Her own line, in The Skinny",
    show: "An Hour Of Decay!",
    venue: "Underbelly, Bristo Square",
    bar: "Underbelly Bristo Square bar",
    walk: 17,
    ends: "15:45",
    starts: "14:45",
    stars: "3",
    paper: "The Skinny",
    review: "Where it falls down is in the jokes. You can feel her struggling to turn smart thoughts into them.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/freya-parker-underbelly-bristo-square",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/freya-parker-an-hour-of-decay",
    line: "They said the thoughts were smarter than the jokes. The Visibly Over 25 bit is the joke, and it landed. Stay. I'll get this.",
    portrait: asset("/mound/2026/freya.jpg"),
  },
  {
    id: "abbie",
    instagram: ["https://www.instagram.com/abbieedwards98/"],
    name: "Abbie Edwards",
    age: "Late 20s",
    ageNote: "The Skinny called her a twenty-something",
    show: "Knee Touch",
    venue: "Just the Tonic at the Mash House",
    bar: "Mash House bar",
    walk: 13,
    ends: "17:50",
    starts: "16:50",
    stars: "3",
    paper: "The Skinny",
    review: "Still funny, but the show works best when it sticks on the crush and stops wandering off into the monologues.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/abbie-edwards-just-the-tonic-at-the-mash-house",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/abbie-edwards-knee-touch",
    line: "The Skinny wanted you to stay on the crush and drop the monologues. Setting them up with someone else is the hour I came for. Drink?",
    portrait: asset("/mound/2026/abbie.jpg"),
  },
  {
    id: "bella",
    instagram: ["https://www.instagram.com/bellabellahull/"],
    name: "Bella Hull",
    age: "28",
    ageNote: "Guardian interview, August 2026",
    show: "Mad Cow Disease",
    venue: "Monkey Barrel Comedy",
    bar: "Monkey Barrel bar",
    walk: 16,
    ends: "13:25",
    starts: "12:30",
    stars: "3",
    paper: "The Skinny",
    review: "Once the fakeout is exposed, the stakes drop. The rest pales next to the first ten minutes.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/bella-hull-monkey-barrel-2026",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/bella-hull-mad-cow-disease",
    line: "They said it peaked in the first ten minutes. Chortle wouldn't spoil that opening, which is the point. The dating-app bit and the ant-infested flat are why the rest isn't a comedown. I knew. What are you having?",
    portrait: asset("/mound/2026/bella.jpg"),
  },
  {
    id: "card",
    instagram: ["https://www.instagram.com/milescalderon/"],
    name: "Miles Calderon",
    age: "About 30",
    ageNote: "Estimated from the listing photo",
    show: "The Passion of Mr Cardboard",
    venue: "Underbelly, George Square",
    bar: "Underbelly George Square bar",
    walk: 21,
    ends: "20:20",
    starts: "19:20",
    stars: "3",
    paper: "The Skinny",
    review: "The issue is never the passion, nor Mr Cardboard. The flaws are in the marriage of the two, and the ending feels anticlimactic.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/the-passion-of-mr-cardboard-underbelly-george-square",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/the-passion-of-mr-cardboard",
    line: "They said the clown and the story didn't marry, and the ending was anticlimactic. I stayed for Mr Cardboard, not a bigger finish. I'll buy.",
    portrait: asset("/mound/2026/card.jpg"),
  },
  {
    id: "plot",
    instagram: ["https://www.instagram.com/sophiekean_/", "https://www.instagram.com/_abbymccann_/"],
    name: "Sophie Kean & Abby McCann",
    age: "Early 20s",
    ageNote: "Estimated from the listing photo",
    show: "The Plot",
    venue: "Summerhall, Main Hall",
    bar: "The Royal Dick",
    walk: 24,
    ends: "20:40",
    starts: "19:30",
    stars: "3",
    paper: "The Skinny",
    review: "A dense text that doesn't quite hit or connect in the way it aims to by the end.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/theatre/the-plot-summerhall",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/the-plot",
    line: "The Skinny said the ending didn't connect. The Guardian wanted last year's lightness and called the text a history lesson. You two, in doublet and hose, in the middle of that floor, were the plot. Come to the Dick. I'm buying.",
    portrait: asset("/mound/2026/plot.jpg"),
  },
  {
    id: "chris",
    instagram: ["https://www.instagram.com/chrxstopher.hall/"],
    name: "Christopher Hall",
    age: "Early-mid 30s",
    ageNote: "His own words, on the show page",
    show: "Pizazz",
    venue: "Gilded Balloon at Teviot",
    bar: "Teviot garden bar",
    walk: 18,
    ends: "21:20",
    starts: "20:20",
    stars: "3",
    paper: "The Skinny",
    review: "At times it feels as though there is almost too much content packed into the hour.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/christopher-hall-gilded-balloon-teviot",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/christopher-hall-pizazz",
    line: "They said there was too much in the hour. EdFestMag called it brilliantly relatable and Broadway Baby gave it five. That's the pizazz. Don't go home. First round is mine.",
    portrait: asset("/mound/2026/chris.jpg"),
  },
  {
    id: "ifrah",
    instagram: ["https://www.instagram.com/ifrah.qureshi1/"],
    name: "Ifrah Qureshi",
    age: "About 27",
    ageNote: "Estimated from the listing photo",
    show: "48 Flaws of Power",
    venue: "The Stand Comedy Club",
    bar: "The Stand bar",
    walk: 17,
    ends: "21:15",
    starts: "20:15",
    stars: "3",
    paper: "The Skinny",
    review: "The structural choice weighs the hour down, so she never quite gets the flow of laughs the material deserves. It needs stripping back.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/ifrah-qureshi-the-stand-2026",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/ifrah-qureshi-48-flaws-of-power",
    line: "They wanted it stripped back so the laughs could flow. Edinburgh Reviews said the family power stuff is the show. The argument with your mum doesn't need less of you in it. I'm at the Stand bar.",
    portrait: asset("/mound/2026/ifrah.jpg"),
  },
  {
    id: "otto",
    instagram: ["https://www.instagram.com/ottoandastrid/"],
    name: "Otto & Astrid",
    age: "Mid-40s",
    ageNote: "Estimated. Clare Bartholomew and Daniel Tobias have played them since 2006",
    show: "The Stages Tour",
    venue: "Assembly Roxy",
    bar: "Assembly Roxy bar",
    walk: 15,
    ends: "22:30",
    starts: "21:20",
    stars: "3",
    paper: "The Skinny",
    review: "Between the repetitive lyrics and faltering sound, the songs work better as backdrop. The jokes might be old hat.",
    reviewUrl: "https://www.theskinny.co.uk/festivals/edinburgh-fringe/comedy/otto-astrid-assembly-roxy",
    listingUrl: "https://www.edfringe.com/tickets/whats-on/otto-astrid-the-stages-tour",
    line: "They called the lyrics repetitive and the jokes old hat. The Scotsman had a righteous time, and the room left in kitten jumpers. I Want To Be Your Kitten still counts. Drink?",
    portrait: asset("/mound/2026/otto.jpg"),
  },
];

export function minutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function sortByStart(acts: Act[]) {
  return [...acts].sort((a, b) => minutes(a.starts) - minutes(b.starts) || a.walk - b.walk);
}

export function sortActs(acts: Act[], now: number) {
  const until = (ends: string) => {
    const wait = minutes(ends) - now;
    return wait >= 0 ? wait : wait + 24 * 60;
  };
  return [...acts].sort((a, b) => until(a.ends) - until(b.ends) || a.walk - b.walk);
}
