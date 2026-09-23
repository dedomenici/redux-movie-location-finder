import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const z = Number(url.searchParams.get("z"));
        const x = Number(url.searchParams.get("x"));
        const y = Number(url.searchParams.get("y"));
        const ok =
          Number.isInteger(z) &&
          Number.isInteger(x) &&
          Number.isInteger(y) &&
          z >= 0 &&
          z <= 18 &&
          x >= 0 &&
          y >= 0 &&
          x < 2 ** z &&
          y < 2 ** z;
        if (!ok) return new Response("Bad tile", { status: 400 });
        const lyrs = url.searchParams.get("lyrs") === "y" ? "y" : "m";
        const upstream = `https://mt0.google.com/vt/lyrs=${lyrs}&hl=en&x=${x}&y=${y}&z=${z}`;
        const res = await fetch(upstream, {
          headers: { "user-agent": "Mozilla/5.0", accept: "image/png,image/*" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return new Response("No tile", { status: 502 });
        const bytes = await res.arrayBuffer();
        return new Response(bytes, {
          headers: {
            "content-type": res.headers.get("content-type") || "image/png",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
