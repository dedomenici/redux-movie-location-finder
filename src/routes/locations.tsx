import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Explorer } from "@/components/explorer";
import { freshPicks } from "@/lib/film.functions";

const defaultSearch = { film: "" };

export const Route = createFileRoute("/locations")({
  validateSearch: (search: Record<string, unknown>) => ({
    film: typeof search.film === "string" ? search.film.slice(0, 160) : "",
  }),
  search: {
    middlewares: [stripSearchParams(defaultSearch)],
  },
  head: () => ({
    meta: [
      { title: "The Redux Project Movie Location Finder" },
      {
        name: "description",
        content: "Search a movie and look at the street where it was filmed.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
  }),
  loader: () => freshPicks(),
  staleTime: 0,
  preloadStaleTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  component: Locations,
});

function Locations() {
  const picks = Route.useLoaderData();
  const { film } = Route.useSearch();
  return <Explorer initialFilm={film} picks={picks} />;
}
