import { test as base, expect, Page, Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { newWorld, stationJSON, valhallaRoute, photonResults, World, HOME } from './world';

// The app's own top-level state, reachable from page.evaluate
declare const S: any; declare const NAV: any;

const ROOT = path.resolve(__dirname, '../..');
const NM = path.join(ROOT, 'node_modules');
export const SCREENS = path.join(ROOT, 'ux-run', 'screens');

// Runs before the app's own scripts: a fake GPS you can move, a fake compass,
// and a stand-in for the GoatCounter script that records what would be sent.
function fakeDevice(start: { lat: number; lon: number } | null) {
  const watchers = new Map<number, any>(); let next = 0; let pos: any = start; let denied = false;
  const fix = (p: any) => ({ coords: { latitude: p.lat, longitude: p.lon, accuracy: p.acc ?? 8, heading: p.heading ?? null,
    speed: p.speed ?? null, altitude: null, altitudeAccuracy: null }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition(ok: any, err: any) { setTimeout(() => (denied || !pos) ? err?.({ code: denied ? 1 : 2, message: denied ? 'User denied Geolocation' : 'No fix' }) : ok(fix(pos)), 40); },
    watchPosition(ok: any, err: any) { const i = ++next; watchers.set(i, { ok, err }); if (pos && !denied) setTimeout(() => watchers.has(i) && ok(fix(pos)), 40); return i; },
    clearWatch(i: number) { watchers.delete(i); },
  };
  Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
  (window as any).__geo = {
    move(p: any) { pos = p; watchers.forEach(w => w.ok(fix(p))); },
    deny(v = true) { denied = v; },
    watching: () => watchers.size,
  };
  (window as any).__compass = (h: number) => {
    const e: any = new Event('deviceorientation'); e.webkitCompassHeading = h; e.alpha = null; e.absolute = false;
    window.dispatchEvent(e);
  };
  (window as any).__gc = [];
}

const GOATCOUNTER_STUB = `window.goatcounter = { count: o => window.__gc.push(o.path) };`;
const OFFLINE_STYLE = JSON.stringify({ version: 8, name: 'offline', sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f6f4ef' } }] });

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function wire(page: Page, world: World, live: boolean) {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async route => {
    const url = new URL(route.request().url());
    const host = url.hostname;
    if (host !== 'unpkg.com' && host !== 'tiles.openfreemap.org') world.requests.push(url.href);

    // Libraries: the same versions as the app asks for, from node_modules
    if (host === 'unpkg.com') {
      const m = url.pathname.match(/^\/(maplibre-gl|three)@[^/]+\/(.+)$/);
      const file = m && path.join(NM, m[1], m[2]);
      if (file && fs.existsSync(file)) return route.fulfill({ path: file, headers: { 'access-control-allow-origin': '*' } });
      return live ? route.continue() : route.abort();
    }
    if (host === 'gc.zgo.at') return route.fulfill({ contentType: 'text/javascript', body: GOATCOUNTER_STUB });
    if (host.endsWith('goatcounter.com')) return route.fulfill({ status: 204 });
    if (host === 'tiles.openfreemap.org') {
      if (live || process.env.REAL_TILES) return route.continue();
      return url.pathname.startsWith('/styles/') ? json(route, JSON.parse(OFFLINE_STYLE)) : route.abort();
    }
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') return live || process.env.REAL_TILES ? route.continue() : route.abort();
    if (live) return route.continue();

    if (host === 'api.tfl.gov.uk') {
      if (world.down.tfl) return json(route, { message: 'down' }, 503);
      const id = url.pathname.match(/^\/BikePoint\/([^/]+)$/)?.[1];
      if (id) { const s = world.stations.find(x => x.id === id); return s ? json(route, stationJSON(s)) : json(route, {}, 404); }
      return json(route, world.stations.map(stationJSON));
    }
    if (host === 'valhalla1.openstreetmap.de') {
      if (world.down.valhalla) return json(route, { error: 'down' }, 503);
      const q = JSON.parse(url.searchParams.get('json') || '{}');
      const [a, b] = q.locations;
      return json(route, valhallaRoute(a, b, q.costing));
    }
    if (host === 'routing.openstreetmap.de') return json(route, { code: 'NoRoute', routes: [] }, world.down.osrm ? 503 : 200);
    if (host === 'photon.komoot.io') {
      if (world.down.photon) return json(route, {}, 503);
      return json(route, photonResults(world, url.searchParams.get('q') || ''));
    }
    if (host === 'api.postcodes.io') {
      const q = (url.searchParams.get('q') || '').toUpperCase().replace(/\s+/g, '');
      return json(route, { status: 200, result: world.postcodes.filter(p => p.postcode.replace(/\s+/g, '').startsWith(q))
        .map(p => ({ postcode: p.postcode, latitude: p.lat, longitude: p.lon, admin_ward: p.ward, admin_district: p.district })) });
    }
    if (host === 'nominatim.openstreetmap.org') return json(route, []);
    return route.abort();
  });
}

type Fixtures = { world: World; app: App };

export class App {
  constructor(public page: Page, public world: World) {}

  async open(opts: { gps?: { lat: number; lon: number } | null; deny?: boolean; waitForStations?: boolean } = {}) {
    const gps = opts.gps === undefined ? HOME : opts.gps;
    await this.page.addInitScript(fakeDevice, gps);
    if (opts.deny) await this.page.addInitScript(() => (window as any).__geo.deny(true));
    await this.page.goto('/');
    if (opts.waitForStations !== false) await expect(this.page.locator('#refresh-badge')).not.toHaveText('Loading…');
  }

  async waitForGpsStart() { await expect(this.page.locator('#from-input')).toHaveValue('Your location'); }

  // Type in a box and tap the suggestion that matches
  async search(box: 'from' | 'to', text: string, pickText?: string | RegExp) {
    const input = this.page.locator(`#${box}-input`);
    await input.click();
    await input.fill('');
    await input.pressSequentially(text, { delay: 30 });
    const item = this.page.locator(`#${box}-ac .ac-item`).filter({ hasText: pickText ?? text }).first();
    await expect(item).toBeVisible();
    await item.click();
  }

  async planTo(text: string, pickText?: string | RegExp) {
    await this.waitForGpsStart();
    await this.search('to', text, pickText);
    await expect(this.page.locator('#start-nav-btn')).toBeVisible();
  }

  async startNav() {
    await this.page.locator('#start-nav-btn').click();
    await expect(this.page.locator('#nav-overlay')).toHaveClass(/active/);
  }

  // The route the app is showing, leg by leg, as [lon, lat] points
  routeLegs() {
    return this.page.evaluate(() => {
      if (S.walkOnly) return [{ type: 'walk', coords: S.walkOnly.geometry.coordinates }];
      return [{ type: 'walk', coords: S.walkIn?.geometry.coordinates || [] },
              { type: 'cycle', coords: S.cycle?.geometry.coordinates || [] },
              { type: 'walk', coords: S.walkOut?.geometry.coordinates || [] }];
    });
  }

  async moveTo(lat: number, lon: number, extra: { heading?: number; speed?: number; acc?: number } = {}) {
    await this.page.evaluate(p => (window as any).__geo.move(p), { lat, lon, ...extra });
  }

  async compass(h: number) { await this.page.evaluate(x => (window as any).__compass(x), h); }

  // Replay the planned route as GPS fixes. `each` runs after every fix.
  async travel(opts: { stepMs?: number; legs?: number[]; each?: (i: number, leg: string) => Promise<void> | void } = {}) {
    const legs = await this.routeLegs();
    const stepMs = opts.stepMs ?? 60;
    for (const [li, leg] of legs.entries()) {
      if (opts.legs && !opts.legs.includes(li)) continue;
      const c = leg.coords as [number, number][];
      for (let i = 0; i < c.length; i++) {
        const [lon, lat] = c[i], nx = c[Math.min(i + 1, c.length - 1)];
        const heading = bearing(lat, lon, nx[1], nx[0]);
        await this.moveTo(lat, lon, leg.type === 'cycle' ? { heading, speed: 4.5 } : { speed: 1.2, heading });
        await this.page.waitForTimeout(stepMs);
        if (opts.each) await opts.each(i, leg.type);
        if (!(await this.page.evaluate(() => NAV.active))) return;
      }
    }
  }

  setStation(id: string, change: Partial<{ bikes: number; ebikes: number; empty: number }>) {
    const s = this.world.stations.find(x => x.id === id); if (!s) throw new Error(`No station ${id}`);
    Object.assign(s, change);
  }

  state<T>(fn: () => T) { return this.page.evaluate(fn); }

  async shot(name: string) {
    fs.mkdirSync(SCREENS, { recursive: true });
    const safe = name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    await this.page.waitForTimeout(400);                       // let the map settle
    await this.page.screenshot({ path: path.join(SCREENS, `${safe}.png`) });
  }
}

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180, y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

export const test = base.extend<Fixtures>({
  world: async ({}, use) => { await use(newWorld()); },
  app: async ({ page, world }, use, info) => {
    const live = info.project.name === 'live';
    await wire(page, world, live);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await use(new App(page, world));
    // R3: an uncaught error fails the test, whatever else it was checking
    if (errors.length) {
      fs.mkdirSync(path.join(ROOT, 'ux-run'), { recursive: true });
      fs.appendFileSync(path.join(ROOT, 'ux-run', 'page-errors.log'), errors.map(e => `${info.title}: ${e}\n`).join(''));
      expect(errors, 'R3 uncaught JavaScript errors').toEqual([]);
    }
  },
});

export { expect };
