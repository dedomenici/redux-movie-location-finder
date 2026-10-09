import { createFileRoute } from "@tanstack/react-router";
import { MoundApp } from "@/components/mound-app";
import { MoundGate } from "@/components/mound-gate";

export const Route = createFileRoute("/themound")({
  head: () => ({
    meta: [
      { title: "The Mound" },
      {
        name: "description",
        content: "A dating app for the Edinburgh Fringe shame spiral. Which bar, what time, what to say.",
      },
      { name: "theme-color", content: "#1a1410" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Outfit:wght@400;600&display=swap",
      },
    ],
  }),
  component: TheMound,
});

function TheMound() {
  return (
    <MoundGate>
      <MoundApp />
    </MoundGate>
  );
}
