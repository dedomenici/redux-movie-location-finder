import { createFileRoute } from "@tanstack/react-router";
import { DedomeniciSite } from "../components/dedomenici-site";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <DedomeniciSite />;
}
