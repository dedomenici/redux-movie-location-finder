// Helpers that let the same components run on the Node host (Vercel / dev)
// and as a static GitHub Pages build (`npm run build:pages`).
//
// On the Node host BASE_URL is "/" and tiles / Street View thumbnails go
// through the app's own /api/tile and /api/pano routes. On Pages there is no
// server, so they point straight at Google's public image hosts instead.

export const IS_STATIC_HOST = import.meta.env.VITE_STATIC_HOST === "1";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

/** Prefix a root-relative public asset or page path with the deploy base. */
export function asset(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE}${path}`;
}

export function tileUrl(z: number, x: number, y: number, lyrs: "m" | "y" = "m"): string {
  if (IS_STATIC_HOST) return `https://mt0.google.com/vt/lyrs=${lyrs}&hl=en&x=${x}&y=${y}&z=${z}`;
  return `/api/tile?z=${z}&x=${x}&y=${y}&lyrs=${lyrs}`;
}

export function panoUrl(id: string, heading: number, pitch: number, fov: number): string {
  if (IS_STATIC_HOST) {
    const p = Math.max(-8, Math.min(35, pitch));
    const f = Math.max(20, Math.min(110, fov));
    return (
      `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=${encodeURIComponent(id)}` +
      `&cb_client=maps_sv.tactile&w=900&h=560&yaw=${Math.round(((heading % 360) + 360) % 360)}` +
      `&pitch=${p.toFixed(1)}&thumbfov=${f.toFixed(0)}`
    );
  }
  return `/api/pano?id=${encodeURIComponent(id)}&yaw=${heading}&pitch=${pitch}&fov=${fov}`;
}
