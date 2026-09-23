# The Redux Project Movie Location Finder

Search an IMDb title, scan the street where it was filmed, and compare a still with the real place.

The finder lives in this app at `/locations`. The homepage is Richard DeDomenici’s site.

## Run it

```bash
npm install
npm run dev
```

Then open the local site and go to `/locations`.

Search, Street View, posters, and location photos are loaded by server functions. They call IMDb, Wikidata, Wikipedia, Wikimedia, and Google’s panorama endpoint from the server, because those services do not allow a browser on GitHub Pages to call them directly.

## GitHub Pages

GitHub Pages only serves static files. It cannot run this app’s server, so the Pages site is a short note, not the working finder. The working app needs Node (this repo’s `npm run dev`, or a host such as Vercel).

Pages address, once the Actions workflow has run: https://dedomenici.github.io/redux-movie-location-finder/

In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions** if it is not already.
