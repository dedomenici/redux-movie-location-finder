// Static build for GitHub Pages: `npm run build:pages` → dist-pages/.
//
// The normal build (vite.config.ts) is a TanStack Start app with a Node
// server. Pages can only serve files, so this config builds the same routes
// and components as a client-only SPA:
//   - src/pages/main.tsx mounts the generated route tree with a client-only
//     root (src/pages/root.tsx) in place of src/routes/__root.tsx;
//   - src/lib/film.functions.ts runs in the browser, with createServerFn and
//     fetch swapped for src/pages/static-server-fn.ts;
//   - every route gets its own index.html (so deep links return 200) and
//     404.html is the same shell as a catch-all SPA fallback.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "dist-pages");
// Project pages live under /<repo>/. Override with PAGES_BASE=/ for a custom domain.
const base = process.env.PAGES_BASE ?? "/redux-movie-location-finder/";
const ROUTES = ["locations", "near", "themound", "mound", "dedomenici", "dedomenici2"];

function staticServerFunctions(): Plugin {
  const from = 'import { createServerFn } from "@tanstack/react-start";';
  const to = 'import { createServerFn, staticFetch as fetch } from "@/pages/static-server-fn";';
  return {
    name: "pages:static-server-functions",
    enforce: "pre",
    transform(code, id) {
      if (!id.split("?")[0].endsWith("/src/lib/film.functions.ts")) return;
      if (!code.includes(from))
        throw new Error("film.functions.ts import changed; update vite.pages.config.ts");
      return { code: code.replace(from, to), map: null };
    },
    resolveId(source, importer) {
      // Swap the server-rendered root (owns <html>, auth, preview chrome).
      if (source === "./routes/__root" && importer?.endsWith("/src/routeTree.gen.ts")) {
        return resolve(here, "src/pages/root.tsx");
      }
    },
  };
}

function spaFallbacks(): Plugin {
  return {
    name: "pages:spa-fallbacks",
    apply: "build",
    closeBundle() {
      const shell = resolve(outDir, "index.html");
      copyFileSync(shell, resolve(outDir, "404.html"));
      for (const route of ROUTES) {
        mkdirSync(resolve(outDir, route), { recursive: true });
        copyFileSync(shell, resolve(outDir, route, "index.html"));
      }
      // Platform-only assets (install tutorial for the hosted preview).
      rmSync(resolve(outDir, "__grok"), { recursive: true, force: true });
      // Let Pages serve files/folders as-is (no Jekyll processing).
      copyFileSync(resolve(here, "pages/.nojekyll"), resolve(outDir, ".nojekyll"));
    },
  };
}

export default defineConfig({
  root: resolve(here, "pages"),
  base,
  publicDir: resolve(here, "public"),
  envDir: here,
  define: {
    "import.meta.env.VITE_STATIC_HOST": JSON.stringify("1"),
  },
  resolve: {
    alias: { "@": resolve(here, "src") },
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: resolve(here, "pages/index.html") },
  },
  preview: { host: "127.0.0.1", port: 8082, strictPort: true },
  plugins: [staticServerFunctions(), tailwindcss(), viteReact(), spaFallbacks()],
});
