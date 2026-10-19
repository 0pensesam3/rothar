// A small fake London: docking stations, searchable places and a router.
// Everything the app fetches from outside is answered from here, so a test run
// gives the same result every day. Tests change `world` mid-run (for example,
// empty a dock) to act out what happens on the street.

export type Station = {
  id: string; commonName: string; lat: number; lon: number;
  bikes: number; ebikes: number; empty: number;
};

export type Place = { name: string; lat: number; lon: number; street?: string; district?: string; postcode?: string; kind?: string };

export type World = {
  stations: Station[];
  places: Place[];
  postcodes: { postcode: string; lat: number; lon: number; ward: string; district: string }[];
  down: { tfl?: boolean; valhalla?: boolean; osrm?: boolean; photon?: boolean };
  delay: { tfl?: number; valhalla?: number;    // ms before a service answers (slow, not down)
           valhallaTo?: { lat: number; lon: number; ms: number } };  // only routes ending within 300 m of here
  streetName?: string;                // if set, every street the router names is this one
  requests: string[];                 // every outside URL the app asked for, in order
};

// Where the tests start and end
export const HOME = { lat: 51.5270, lon: -0.0549, label: 'Bethnal Green' };            // your GPS position
export const LIV_ST = { name: 'Liverpool Street Station', lat: 51.5178, lon: -0.0817 };
export const NEARBY = { name: 'Young V&A', lat: 51.5290, lon: -0.0553 };                // ~225 m away: walking wins
export const FAR_FROM_DOCKS = { name: 'Golden Lane Estate', lat: 51.5225, lon: -0.0950 };  // ~1 km from the nearest dock
export const AT_HOME = { name: 'Bethnal Green Gardens', lat: HOME.lat, lon: HOME.lon };      // exactly where you are
export const COLUMBIA = { name: 'Columbia Road Flower Market', lat: 51.5296, lon: -0.0712 };

export function newWorld(): World {
  return {
    stations: [
      // Around the start
      { id: 'BikePoints_101', commonName: 'Cambridge Heath Road, Bethnal Green', lat: 51.5265, lon: -0.0560, bikes: 6, ebikes: 0, empty: 10 },
      { id: 'BikePoints_102', commonName: 'Victoria Park Road, Hackney',        lat: 51.5300, lon: -0.0540, bikes: 8, ebikes: 2, empty: 7 },
      { id: 'BikePoints_103', commonName: 'Paradise Row, Bethnal Green',        lat: 51.5255, lon: -0.0545, bikes: 0, ebikes: 0, empty: 18 },
      { id: 'BikePoints_104', commonName: 'Mile End Road, Stepney',             lat: 51.5240, lon: -0.0500, bikes: 3, ebikes: 3, empty: 12 },
      { id: 'BikePoints_105', commonName: 'Hollybush Gardens, Bethnal Green',   lat: 51.5280, lon: -0.0575, bikes: 5, ebikes: 1, empty: 9 },
      // Halfway
      { id: 'BikePoints_201', commonName: 'Brick Lane Market, Shoreditch',      lat: 51.5220, lon: -0.0717, bikes: 10, ebikes: 1, empty: 10 },
      // Around Liverpool Street
      { id: 'BikePoints_301', commonName: 'Liverpool Street Station, Liverpool Street', lat: 51.5185, lon: -0.0812, bikes: 4, ebikes: 0, empty: 12 },
      { id: 'BikePoints_302', commonName: 'Bishopsgate, Liverpool Street',      lat: 51.5168, lon: -0.0805, bikes: 2, ebikes: 0, empty: 20 },
      { id: 'BikePoints_303', commonName: 'Wormwood Street, Liverpool Street',  lat: 51.5164, lon: -0.0830, bikes: 25, ebikes: 2, empty: 0 },
    ],
    places: [
      { ...LIV_ST, street: 'Liverpool Street', district: 'City of London', postcode: 'EC2M 7QH', kind: 'station' },
      { ...NEARBY, street: 'Cambridge Heath Road', district: 'Bethnal Green', postcode: 'E2 9PA', kind: 'museum' },
      { name: 'Bethnal Green Library', lat: 51.5262, lon: -0.0569, street: 'Cambridge Heath Road', district: 'Bethnal Green', postcode: 'E2 0HL', kind: 'library' },
      { ...COLUMBIA, street: 'Columbia Road', district: 'Bethnal Green', postcode: 'E2 7RG', kind: 'marketplace' },
      { ...FAR_FROM_DOCKS, street: 'Fann Street', district: 'Barbican', postcode: 'EC1Y 0RN', kind: 'residential' },
      { ...AT_HOME, street: 'Cambridge Heath Road', district: 'Bethnal Green', postcode: 'E2 0ET', kind: 'park' },
    ],
    postcodes: [
      { postcode: 'E2 0ET', lat: 51.5268, lon: -0.0552, ward: 'Bethnal Green West', district: 'Tower Hamlets' },
      { postcode: 'E2 0HL', lat: 51.5262, lon: -0.0569, ward: 'Bethnal Green West', district: 'Tower Hamlets' },
    ],
    down: {},
    delay: {},
    requests: [],
  };
}

export function stationJSON(s: Station) {
  const p = (key: string, value: number) => ({ $type: 'Tfl.Api.Presentation.Entities.AdditionalProperties, Tfl.Api.Presentation.Entities',
    category: 'Description', key, sourceSystemKey: 'BikePoints', value: String(value), modified: new Date().toISOString() });
  return {
    $type: 'Tfl.Api.Presentation.Entities.Place, Tfl.Api.Presentation.Entities',
    id: s.id, url: `/Place/${s.id}`, commonName: s.commonName, placeType: 'BikePoint', lat: s.lat, lon: s.lon,
    additionalProperties: [
      p('NbBikes', s.bikes), p('NbEBikes', s.ebikes), p('NbStandardBikes', s.bikes - s.ebikes),
      p('NbEmptyDocks', s.empty), p('NbDocks', s.bikes + s.empty),
    ],
  };
}

// ─── Router: an L-shaped route (north/south, then east/west) in Valhalla's format ──
const STREETS_NS = ['Cambridge Heath Road', 'Vallance Road', 'Brick Lane', 'Bishopsgate'];
const STREETS_EW = ['Bethnal Green Road', 'Old Bethnal Green Road', 'Sclater Street', 'Worship Street'];
const pick = (list: string[], seed: number) => list[Math.abs(Math.round(seed * 1e4)) % list.length];

function metres(a: [number, number], b: [number, number]) {      // [lat, lon]
  const R = 6371000, r = Math.PI / 180;
  const dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function encode6(points: [number, number][]) {                    // [lat, lon] → polyline, precision 6
  let out = '', pLat = 0, pLon = 0;
  const enc = (v: number) => { v = v < 0 ? ~(v << 1) : v << 1; let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63); };
  for (const [la, lo] of points) {
    const iLa = Math.round(la * 1e6), iLo = Math.round(lo * 1e6);
    out += enc(iLa - pLat) + enc(iLo - pLon); pLat = iLa; pLon = iLo;
  }
  return out;
}

function densify(a: [number, number], b: [number, number], every = 15) {
  const n = Math.max(1, Math.ceil(metres(a, b) / every)), out: [number, number][] = [];
  for (let i = 1; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  return out;
}

// Real Valhalla maneuver types: 1 start, 4 destination, 10 right, 15 left
export function valhallaRoute(from: { lat: number; lon: number }, to: { lat: number; lon: number }, costing: string, street?: string) {
  const speed = costing === 'bicycle' ? 4.5 : 1.25;                 // m/s
  const verb = costing === 'bicycle' ? 'Bike' : 'Walk';
  const A: [number, number] = [from.lat, from.lon], C: [number, number] = [to.lat, from.lon], B: [number, number] = [to.lat, to.lon];
  const d1 = metres(A, C), d2 = metres(C, B);
  const ns = street ?? pick(STREETS_NS, from.lon), ew = street ?? pick(STREETS_EW, to.lat);
  const shape: [number, number][] = [A];
  const maneuvers: any[] = [];
  const m = (type: number, instruction: string, street: string | null, len: number, idx: number) =>
    maneuvers.push({ type, instruction, street_names: street ? [street] : undefined, length: len / 1000, time: len / speed, begin_shape_index: idx, end_shape_index: idx });

  if (d1 >= 5 && d2 >= 5) {
    const h1 = to.lat > from.lat ? 0 : 180, h2 = to.lon > from.lon ? 90 : 270;
    const right = ((h2 - h1 + 360) % 360) === 90;
    m(1, `${verb} ${h1 === 0 ? 'north' : 'south'} on ${ns}.`, ns, d1, 0);
    shape.push(...densify(A, C));
    m(right ? 10 : 15, `Turn ${right ? 'right' : 'left'} onto ${ew}.`, ew, d2, shape.length - 1);
    shape.push(...densify(C, B));
  } else {
    const dir = d1 >= d2 ? (to.lat > from.lat ? 'north' : 'south') : (to.lon > from.lon ? 'east' : 'west');
    m(1, `${verb} ${dir} on ${d1 >= d2 ? ns : ew}.`, d1 >= d2 ? ns : ew, metres(A, B), 0);
    shape.push(...densify(A, B));
  }
  m(4, 'You have arrived at your destination.', null, 0, shape.length - 1);
  const total = d1 + d2;
  return { trip: { status: 0, units: 'kilometers', language: 'en-GB',
    summary: { length: total / 1000, time: total / speed },
    legs: [{ shape: encode6(shape), maneuvers, summary: { length: total / 1000, time: total / speed } }] } };
}

export function photonResults(world: World, q: string) {
  const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean).filter(w => !/^\d+[a-z]?$/.test(w));
  const hit = (p: Place) => words.length > 0 && words.every(w => p.name.toLowerCase().split(/[\s,]+/).some(n => n.startsWith(w))
                                                               || (p.street || '').toLowerCase().split(/\s+/).some(n => n.startsWith(w)));
  return { type: 'FeatureCollection', features: world.places.filter(hit).map(p => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { name: p.name, street: p.street, district: p.district, postcode: p.postcode, city: 'London',
                  osm_key: 'amenity', osm_value: p.kind || 'place', type: 'house' } })) };
}

// The backup router (OSRM) answers in its own format: the same L-shaped route, so a
// fallback plan has real directions rather than estimates.
export function osrmRoute(from: { lat: number; lon: number }, to: { lat: number; lon: number }, profile: string, street?: string) {
  const v = valhallaRoute(from, to, profile === 'foot' ? 'pedestrian' : 'bicycle', street).trip;
  const leg = v.legs[0];
  const coords = decode6(leg.shape);
  const steps = leg.maneuvers.map((m: any) => ({
    maneuver: { type: m.type === 1 ? 'depart' : m.type === 4 ? 'arrive' : 'turn',
                modifier: m.type === 10 ? 'right' : m.type === 15 ? 'left' : undefined,
                location: coords[m.begin_shape_index] },
    name: (m.street_names || []).join(', '), distance: Math.round(m.length * 1000), duration: m.time,
  }));
  return { code: 'Ok', routes: [{ duration: v.summary.time, distance: Math.round(v.summary.length * 1000),
    geometry: { type: 'LineString', coordinates: coords }, legs: [{ steps }] }] };
}

function decode6(str: string): [number, number][] {                // → [lon, lat]
  let lat = 0, lon = 0, i = 0; const out: [number, number][] = [];
  const next = () => { let b, shift = 0, r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < str.length) { lat += next(); lon += next(); out.push([lon / 1e6, lat / 1e6]); }
  return out;
}

// A point `east` and `north` metres away from (lat, lon)
export function offset(lat: number, lon: number, east: number, north: number) {
  return { lat: lat + north / 110540, lon: lon + east / (111320 * Math.cos(lat * Math.PI / 180)) };
}

export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return metres([a.lat, a.lon], [b.lat, b.lon]);
}
