import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Explorer } from "@/components/explorer";

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
  component: Locations,
});

function Locations() {
  const { film } = Route.useSearch();
  return <Explorer initialFilm={film} />;
}
