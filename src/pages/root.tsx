// Root route for the static GitHub Pages build. Same head as
// src/routes/__root.tsx, but rendered into #root of pages/index.html instead
// of owning <html>, and without the platform auth / preview chrome.
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import "./pages.css";

const APP_NAME = "The Redux Project Movie Location Finder";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: APP_NAME },
      {
        name: "description",
        content: "Search a movie and look at the street where it was filmed.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
});
