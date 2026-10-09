# The Redux Project Movie Location Finder

Search an IMDb title, scan the street where it was filmed, and compare a still with the real place.

Live on GitHub Pages: https://dedomenici.github.io/redux-movie-location-finder/

- `/` and `/locations`: the finder
- `/near`: movie locations near you (or near a place you type)
- `/themound`: The Mound

## Run it

```bash
npm install
npm run dev
```

Then open the local site.

## Two builds

- `npm run build` builds the full app (TanStack Start with a Node server, deployed to Vercel). Search, Street View, posters, and location photos are loaded by server functions in `src/lib/film.functions.ts`.
- `npm run build:pages` builds a static copy into `dist-pages/` for GitHub Pages (`vite.pages.config.ts`). The same routes and components run as a single-page app, and the same `film.functions.ts` handlers run in the browser. `.github/workflows/pages.yml` builds and deploys it on every push to `main`.

In the static build, sources that send CORS headers are called straight from the browser: the moviescenemap.com location atlas, Wikipedia, Wikidata, Wikimedia Commons, Openverse, OpenStreetMap Nominatim, and Open-Meteo geocoding. IMDb search uses IMDb's JSONP suggestion feed, and map tiles load directly from Google.

Sites that block browser requests from other origins can only be read by the server, so the Pages build does without them:

- extra pins from MovieMaps, The Worldwide Guide to Movie Locations, and ReelStreets
- foreign posters from CineMaterial and photos from Movie Location Hunter
- the live Letterboxd faves list (the built-in list of picks is used instead)
- the quotes on moviescenemap.com location pages (`/near` uses the atlas API for films and photos instead)

Google's Street View lookup (`GeoPhotoService.SingleImageSearch`) has been turned off by Google, so neither build finds panoramas at the moment. Both show "No Street View panorama" and link out to Google Maps.

Deep links work on Pages because every route has its own `index.html`, and `404.html` is the same app shell as a fallback.
