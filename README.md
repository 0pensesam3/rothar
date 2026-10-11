# Rothar

A journey planner for London's public bike-share scheme, built as a single-page web app you can add to your phone's home screen.

Not affiliated with TfL or any sponsor of the scheme.

## What it does

- Plans door-to-door trips: walk to a dock, cycle, walk to your destination
- Picks pickup and dropoff docks by total journey time, using live availability
- Suggests walking when the bike wouldn't save at least a minute (dock time included)
- Route types: Balanced, Fastest, Bike lanes
- Turn-by-turn navigation, with low-availability alerts and rerouting near each dock
- Address search from 3 letters, keeping house numbers
- Activity log of trips navigated in the app, stored on the device

## Data and services

- Live dock data: TfL Unified API (BikePoint)
- Routing: Valhalla (cycling and walking), OSRM fallback
- Address search: Photon, Nominatim fallback
- Map: OpenStreetMap tiles via Leaflet

## Files

- `index.html` is the whole app
- `manifest.json` and `icon-*.png` make it installable as a home-screen app
- `.nojekyll` tells GitHub Pages to serve the files as they are
