import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mound")({
  beforeLoad: () => {
    throw redirect({ to: "/themound" });
  },
});
