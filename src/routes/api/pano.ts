import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pano")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        const yaw = Number(url.searchParams.get("yaw") ?? "0");
        const pitchRaw = Number(url.searchParams.get("pitch") ?? "0");
        const fovRaw = Number(url.searchParams.get("fov") ?? "78");
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
          return new Response("Bad panorama", { status: 400 });
        }
        const heading = Number.isFinite(yaw) ? ((yaw % 360) + 360) % 360 : 0;
        const pitch = Number.isFinite(pitchRaw) ? Math.max(-8, Math.min(35, pitchRaw)) : 0;
        const fov = Number.isFinite(fovRaw) ? Math.max(20, Math.min(110, fovRaw)) : 78;
        const upstream =
          `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=${id}` +
          `&cb_client=maps_sv.tactile&w=900&h=560&yaw=${Math.round(heading)}&pitch=${pitch.toFixed(1)}&thumbfov=${fov.toFixed(0)}`;
        const res = await fetch(upstream, {
          headers: {
            "user-agent": "Mozilla/5.0",
            referer: "https://www.google.com/maps",
            accept: "image/avif,image/webp,image/apng,image/jpeg,*/*",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return new Response("No imagery", { status: 502 });
        const bytes = await res.arrayBuffer();
        return new Response(bytes, {
          headers: {
            "content-type": res.headers.get("content-type") || "image/jpeg",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
