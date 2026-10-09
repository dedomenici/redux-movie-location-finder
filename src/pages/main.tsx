// Entry for the static GitHub Pages build (`npm run build:pages`).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "../routeTree.gen";

const basepath = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "/";

const router = createRouter({ routeTree, basepath, defaultErrorComponent: AppErrorComponent });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
