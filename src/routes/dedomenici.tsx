import { createFileRoute } from "@tanstack/react-router";
import { DedomeniciSite } from "../components/dedomenici-site";

export const Route = createFileRoute("/dedomenici")({
  head: () => ({
    meta: [
      { title: "Richard DeDomenici" },
      {
        name: "description",
        content: "Artist, filmmaker, raconteur, and manufacturer of dangerous toys since 1798.",
      },
    ],
  }),
  component: DedomeniciPage,
});

function DedomeniciPage() {
  return <DedomeniciSite />;
}
