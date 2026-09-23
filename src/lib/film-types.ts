export type Suggestion = {
  imdbId: string;
  title: string;
  year?: number;
  kind: string;
  qid: string;
  cast: string;
  director: string;
  poster?: string;
};

export type FilmLocation = {
  id: string;
  name: string;
  country: string;
  category: string;
  precision: string;
  source: "wikidata" | "wikipedia";
  lat: number;
  lng: number;
  address: string;
  scene?: string;
  precisionNote: string;
};

export type Still = {
  url: string;
  caption: string;
  source: "imdb" | "wikipedia" | "google" | "web";
};

export type Dossier = {
  imdbId: string;
  title: string;
  year?: number;
  cast: string;
  director: string;
  poster?: string;
  description?: string;
  imdbUrl: string;
  imdbLocationsUrl: string;
  wikipediaUrl?: string;
  locations: FilmLocation[];
  stills: Still[];
  countriesOnly: string[];
  filmingNotes: string[];
  atlasName?: string;
};

export type PlacePhoto = {
  url: string;
  caption: string;
  credit: string;
  kind: "still" | "place";
};

export type NearbySpot = {
  id: string;
  name: string;
  country: string;
  category: string;
  precision: string;
  lat: number;
  lng: number;
  distanceKm: number;
  films: string[];
  page: string;
  image?: string;
  imageCaption?: string;
};

export type StreetViewHit = {
  address: string;
  lat: number;
  lng: number;
  heading: number;
  panoId?: string;
  thumbUrl?: string;
  embedUrl?: string;
  mapsUrl: string;
  coverage: boolean;
};
