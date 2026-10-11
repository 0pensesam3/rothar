# Rothar

A journey planner for London's public bike-share scheme, built as a single-page web app you can add to your phone's home screen.

Powered by TfL Open Data. Not affiliated with or endorsed by TfL or any sponsor of the scheme.

## What it does

- Plans door-to-door trips: walk to a dock, cycle, walk to your destination
- Picks pickup and dropoff docks by total journey time, using live availability
- Suggests walking when the bike wouldn't save at least a minute (dock time included)
- Route types: Balanced, Fastest, Bike lanes
- Turn-by-turn navigation in a tilted, heading-up view, with a compass check that you're facing the right way
- Low-availability alerts and rerouting near each dock
- Search from 3 letters: places by name (pubs, shops, stations) and addresses with house numbers
- Activity log of trips navigated in the app, stored on the device

## Data and services

- Live dock data: TfL Unified API (BikePoint)
- Routing: Valhalla (cycling and walking), OSRM fallback
- Address search: Photon, Nominatim fallback
- Map: MapLibre GL with OpenFreeMap's Positron style (OpenStreetMap data)
- Compass: device orientation (asks permission on iPhone)

## Privacy

The app counts anonymous usage with GoatCounter (no cookies, no personal data): only action names such as "journey planned" or "navigation started". It never sends locations, addresses or what you searched for. Trip history in Activity stays on your phone.

## Files

- `index.html` is the whole app
- `manifest.json` and `icon-*.png` make it installable as a home-screen app
- `.nojekyll` tells GitHub Pages to serve the files as they are
