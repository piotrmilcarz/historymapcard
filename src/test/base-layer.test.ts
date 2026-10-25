import { describe, it, expect, vi, beforeEach } from 'vitest';

// The base layer only needs Leaflet's tileLayer for the paths tested here;
// MapLibre and its worker are never started (no WebGL in happy-dom).
const { tileLayerMock } = vi.hoisted(() => ({
  tileLayerMock: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn(),
    redraw: vi.fn(),
    options: {},
  })),
}));
vi.mock('leaflet', () => ({ default: { tileLayer: tileLayerMock } }));
vi.mock('@maplibre/maplibre-gl-leaflet', () => ({ maplibreGL: vi.fn() }));
vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?raw', () => ({ default: '' }));

import {
  createBaseLayer,
  getMapTilesToken,
  resetMapTilesToken,
  withMapTilesToken,
  MAP_TILES_PATH,
} from '../base-layer.js';
import type { HomeAssistant } from '../types.js';

function makeHass(callWS?: HomeAssistant['callWS']): HomeAssistant {
  return { states: {}, callApi: vi.fn(), callWS } as unknown as HomeAssistant;
}

function makeMap() {
  return { on: vi.fn() } as unknown as import('leaflet').Map;
}

beforeEach(() => {
  resetMapTilesToken();
  tileLayerMock.mockClear();
});

describe('getMapTilesToken', () => {
  it('asks core for map_tiles/access_token over the websocket', async () => {
    const callWS = vi.fn().mockResolvedValue({ token: 'abc' });
    await expect(getMapTilesToken(makeHass(callWS))).resolves.toBe('abc');
    expect(callWS).toHaveBeenCalledWith({ type: 'map_tiles/access_token' });
  });

  it('caches the token between calls', async () => {
    const callWS = vi.fn().mockResolvedValue({ token: 'abc' });
    await getMapTilesToken(makeHass(callWS));
    await getMapTilesToken(makeHass(callWS));
    expect(callWS).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when core has no map_tiles integration', async () => {
    const callWS = vi.fn().mockRejectedValue(new Error('Unknown command'));
    await expect(getMapTilesToken(makeHass(callWS))).resolves.toBeUndefined();
  });

  it('returns undefined when hass has no callWS', async () => {
    await expect(getMapTilesToken(makeHass())).resolves.toBeUndefined();
  });
});

describe('withMapTilesToken', () => {
  it('makes proxy URLs absolute and adds the token header on same origin', async () => {
    await getMapTilesToken(makeHass(vi.fn().mockResolvedValue({ token: 't1' })));
    const req = withMapTilesToken(`${MAP_TILES_PATH}/tilejson.json`);
    expect(req.url).toBe(`${location.origin}${MAP_TILES_PATH}/tilejson.json`);
    expect(req.headers).toEqual({ 'X-Map-Tiles-Token': 't1' });
  });

  it('uses a query parameter for a cross-origin proxy', async () => {
    await getMapTilesToken(makeHass(vi.fn().mockResolvedValue({ token: 't2' })));
    const req = withMapTilesToken(`https://ha.example.com${MAP_TILES_PATH}/vector/1/2/3.mvt`);
    expect(req.url).toBe(`https://ha.example.com${MAP_TILES_PATH}/vector/1/2/3.mvt?token=t2`);
    expect(req.headers).toBeUndefined();
  });

  it('leaves non-proxy URLs untouched (apart from making them absolute)', async () => {
    await getMapTilesToken(makeHass(vi.fn().mockResolvedValue({ token: 't3' })));
    const req = withMapTilesToken('/static/map/sprites/base.json');
    expect(req.url).toBe(`${location.origin}/static/map/sprites/base.json`);
    expect(req.headers).toBeUndefined();
  });
});

describe('createBaseLayer', () => {
  it('falls back to direct OSM raster tiles without the map_tiles proxy', async () => {
    const layer = await createBaseLayer(makeMap(), {
      getHass: () => makeHass(vi.fn().mockRejectedValue(new Error('unknown'))),
      dark: false,
      isActive: () => true,
    });
    expect(layer.kind).toBe('osm-direct');
    expect(tileLayerMock).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ referrerPolicy: 'origin', maxNativeZoom: 19 })
    );
  });

  it('uses the proxied raster tiles when WebGL2 is unavailable', async () => {
    const layer = await createBaseLayer(makeMap(), {
      getHass: () => makeHass(vi.fn().mockResolvedValue({ token: 'tok' })),
      dark: false,
      isActive: () => true,
    });
    expect(layer.kind).toBe('raster');
    expect(tileLayerMock).toHaveBeenCalledWith(
      `${location.origin}${MAP_TILES_PATH}/raster/{z}/{x}/{y}.png?token={token}`,
      expect.objectContaining({ token: 'tok', maxNativeZoom: 19 })
    );
  });

  it('adds nothing when the map was removed while waiting for the token', async () => {
    const layer = await createBaseLayer(makeMap(), {
      getHass: () => makeHass(vi.fn().mockResolvedValue({ token: 'tok' })),
      dark: false,
      isActive: () => false,
    });
    expect(layer.kind).toBe('none');
    expect(tileLayerMock).not.toHaveBeenCalled();
  });
});
