import { createFileRoute } from "@tanstack/react-router";
import { DedomeniciSite } from "../components/dedomenici-site";

export const Route = createFileRoute("/dedomenici2")({
  head: () => ({
    meta: [
      { title: "Richard DeDomenici" },
      {
        name: "description",
        content: "Artist, filmmaker, raconteur, and manufacturer of dangerous toys since 1798.",
      },
    ],
  }),
  component: DedomeniciTwo,
});

function DedomeniciTwo() {
  return <DedomeniciSite />;
}
