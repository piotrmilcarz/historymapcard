/* ------------------------------------------------------------------
 * Base map layer — mirrors the current Home Assistant frontend
 * (src/common/map/base-layer.ts + src/data/map_tiles.ts in
 * home-assistant/frontend, served by the `map_tiles` integration in core).
 *
 *  • Vector map: MapLibre GL rendered inside Leaflet via
 *    @maplibre/maplibre-gl-leaflet, using the styles HA ships at
 *    /static/map/{light,dark}.json and the tiles/glyphs proxied by core at
 *    /api/map_tiles/*.
 *  • Raster fallback (no WebGL2 / vector failure): OSM raster tiles through
 *    the same proxy.
 *  • Last resort (HA without the `map_tiles` integration, < 2026.10):
 *    OSM raster tiles fetched directly from tile.openstreetmap.org.
 * ------------------------------------------------------------------ */

import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import {
  setWorkerUrl,
  type RequestParameters,
  type StyleSpecification,
} from 'maplibre-gl';
// Bundled as a string so the card stays a single file (HACS / www friendly)
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import type { HomeAssistant } from './types.js';

/* ------------------------------------------------------------------
 * Constants (kept in sync with the HA frontend / core map_tiles)
 * ------------------------------------------------------------------ */

export const MAP_TILES_PATH = '/api/map_tiles';
/** Mirrors TOKEN_HEADER in homeassistant/components/map_tiles/const.py */
const TOKEN_HEADER = 'X-Map-Tiles-Token';
/** Core rotates every 30 min and keeps two tokens live */
const TOKEN_REFRESH_MS = 20 * 60 * 1000;
const RECOVERY_THROTTLE_MS = 30_000;
const CONTEXT_RESTORE_GRACE_MS = 2000;

const SHIPPED_STYLES = {
  light: '/static/map/light.json',
  dark: '/static/map/dark.json',
} as const;

const RASTER_TILE_URL = `${MAP_TILES_PATH}/raster/{z}/{x}/{y}.png?token={token}`;
const DIRECT_OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** On the Leaflet map; the adapter drives MapLibre at zoom - 1 */
export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 20;
/** OSM raster stops at 19 and the proxy refuses higher */
const RASTER_MAX_NATIVE_ZOOM = 19;

type TokenTileLayerOptions = L.TileLayerOptions & { token?: string };

export type BaseLayerKind = 'vector' | 'raster' | 'osm-direct' | 'none';

export interface MapBaseLayer {
  readonly kind: BaseLayerKind;
  /** Switch between the light and dark cartography (vector only) */
  setDark(dark: boolean): void;
}

export interface BaseLayerOptions {
  /** Current hass object (it is replaced on every state change) */
  getHass: () => HomeAssistant | null;
  dark: boolean;
  /** False once the map was removed while we were awaiting */
  isActive: () => boolean;
}

const NO_LAYER: MapBaseLayer = { kind: 'none', setDark: () => undefined };

/* ------------------------------------------------------------------
 * Access token (shared by every card on the page)
 * ------------------------------------------------------------------ */

let token: string | undefined;
let tokenFetchedAt = 0;
let pendingToken: Promise<string | undefined> | undefined;
const tokenListeners = new Set<(newToken: string) => void>();

async function fetchToken(
  hass: HomeAssistant | null
): Promise<string | undefined> {
  if (!hass?.callWS) return token;
  try {
    const result = await hass.callWS<{ token: string }>({
      type: 'map_tiles/access_token',
    });
    tokenFetchedAt = Date.now();
    if (result?.token && result.token !== token) {
      token = result.token;
      tokenListeners.forEach((listener) => listener(result.token));
    }
  } catch {
    // Backend without the map_tiles proxy, or not ready yet — keep the old one
  }
  return token;
}

export function getMapTilesToken(
  hass: HomeAssistant | null,
  force = false
): Promise<string | undefined> {
  if (!force && token && Date.now() - tokenFetchedAt < TOKEN_REFRESH_MS) {
    return Promise.resolve(token);
  }
  if (!pendingToken) {
    pendingToken = fetchToken(hass).finally(() => {
      pendingToken = undefined;
    });
  }
  return pendingToken;
}

/** Test helper: forget the cached token */
export function resetMapTilesToken(): void {
  token = undefined;
  tokenFetchedAt = 0;
  pendingToken = undefined;
}

/**
 * Authenticates requests to the core proxy. Same origin: header (keeps the
 * browser cache key stable). Cross origin: query parameter (avoids a CORS
 * preflight per tile). Always absolute — MapLibre's worker cannot resolve
 * relative URLs.
 */
export function withMapTilesToken(url: string): RequestParameters {
  let parsed: URL;
  try {
    parsed = new URL(url, location.origin);
  } catch {
    return { url };
  }
  if (!parsed.pathname.startsWith(`${MAP_TILES_PATH}/`) || !token) {
    return { url: parsed.href };
  }
  if (parsed.origin === location.origin) {
    return { url: parsed.href, headers: { [TOKEN_HEADER]: token } };
  }
  parsed.searchParams.set('token', token);
  return { url: parsed.href };
}

/* ------------------------------------------------------------------
 * MapLibre helpers
 * ------------------------------------------------------------------ */

let webGL2Supported: boolean | undefined;

export function supportsWebGL2(): boolean {
  if (webGL2Supported === undefined) {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      webGL2Supported = Boolean(context);
      // Contexts are scarce; the probe must not keep one
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webGL2Supported = false;
    }
  }
  return webGL2Supported;
}

let workerUrlSet = false;
function ensureWorkerUrl(): void {
  if (workerUrlSet) return;
  workerUrlSet = true;
  // The worker is an ES module; a blob: URL keeps the card a single file.
  const blob = new Blob([workerSource], { type: 'text/javascript' });
  setWorkerUrl(URL.createObjectURL(blob));
}

// Shared only while in flight, so a failed fetch is retried next time.
// Text, not a parsed object: MapLibre mutates the style it is given.
const pendingStyles = new Map<string, Promise<string>>();

function fetchStyleText(url: string): Promise<string> {
  let pending = pendingStyles.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Map style ${url}: HTTP ${response.status}`);
        }
        return response.text();
      })
      .finally(() => pendingStyles.delete(url));
    pendingStyles.set(url, pending);
  }
  return pending;
}

const absolute = (url: string): string => new URL(url, location.href).href;

export async function loadStyle(dark: boolean): Promise<StyleSpecification> {
  const style = JSON.parse(
    await fetchStyleText(dark ? SHIPPED_STYLES.dark : SHIPPED_STYLES.light)
  ) as StyleSpecification;
  // MapLibre rejects relative sprite URLs
  if (typeof style.sprite === 'string') {
    style.sprite = absolute(style.sprite);
  } else if (Array.isArray(style.sprite)) {
    style.sprite = style.sprite.map((sprite) => ({
      ...sprite,
      url: absolute(sprite.url),
    }));
  }
  return style;
}

/* ------------------------------------------------------------------
 * Raster layers
 * ------------------------------------------------------------------ */

function createRasterLayer(
  map: L.Map,
  getHass: () => HomeAssistant | null
): MapBaseLayer {
  const layer = L.tileLayer(`${location.origin}${RASTER_TILE_URL}`, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: RASTER_MAX_NATIVE_ZOOM,
    // Leaflet throws on an undefined template variable
    token: token ?? '',
  } as TokenTileLayerOptions).addTo(map);

  let refused = false;
  let lastRecovery = 0;
  layer.on('tileerror', () => {
    refused = true;
    if (Date.now() - lastRecovery < RECOVERY_THROTTLE_MS) return;
    lastRecovery = Date.now();
    getMapTilesToken(getHass(), true);
  });

  // Substituted per request; only tiles cached as failures need a redraw
  const onToken = (newToken: string) => {
    (layer.options as TokenTileLayerOptions).token = newToken;
    if (refused) {
      refused = false;
      layer.redraw();
    }
  };
  tokenListeners.add(onToken);
  map.on('unload', () => tokenListeners.delete(onToken));

  return { kind: 'raster', setDark: () => undefined };
}

function createDirectOsmLayer(map: L.Map): MapBaseLayer {
  // No proxy to identify us; OSM serves a browser that sends a referrer,
  // which HA's `same-origin` referrer policy would otherwise strip.
  L.tileLayer(DIRECT_OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: RASTER_MAX_NATIVE_ZOOM,
    referrerPolicy: 'origin',
  }).addTo(map);
  return { kind: 'osm-direct', setDark: () => undefined };
}


/* ------------------------------------------------------------------
 * Vector layer (MapLibre inside Leaflet)
 * ------------------------------------------------------------------ */

async function createVectorLayer(
  map: L.Map,
  options: BaseLayerOptions
): Promise<MapBaseLayer | undefined> {
  const style = await loadStyle(options.dark);
  if (!options.isActive()) return undefined;

  ensureWorkerUrl();
  let layer: L.MaplibreGL | undefined;
  try {
    layer = maplibreGL({
      style,
      transformRequest: (url: string) => withMapTilesToken(url),
    });
    // The adapter builds the MapLibre map in onAdd — a refused WebGL
    // context throws here.
    layer.addTo(map);
  } catch {
    try {
      layer?.remove();
    } catch {
      // never finished being added
    }
    return undefined;
  }

  const glLayer = layer;
  const glMap = glLayer.getMaplibreMap();
  let vector = true;
  let dark = options.dark;
  let latestRequest = 0;
  let refused = false;

  const applyStyle = () => {
    const request = ++latestRequest;
    loadStyle(dark)
      .then((newStyle) => {
        if (vector && request === latestRequest) {
          glLayer.getMaplibreMap()?.setStyle(newStyle);
        }
      })
      .catch(() => undefined);
  };

  // Stale token (403), proxy not registered yet (404) or a network error:
  // get a new token, then re-apply the style (the TileJSON is not retried).
  let lastRecovery = 0;
  glMap.on('error', (event) => {
    const status = (event.error as { status?: number } | undefined)?.status;
    if (status !== undefined && status !== 403 && status !== 404) return;
    if (Date.now() - lastRecovery < RECOVERY_THROTTLE_MS) return;
    lastRecovery = Date.now();
    refused = true;
    getMapTilesToken(options.getHass(), true);
  });
  const onToken = () => {
    if (vector && refused) {
      refused = false;
      applyStyle();
    }
  };
  tokenListeners.add(onToken);

  // Browsers keep ~16 live WebGL contexts; when ours is dropped for good,
  // fall back to raster tiles.
  let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
  const swapToRaster = () => {
    if (!vector || !options.isActive()) return;
    vector = false;
    try {
      glLayer.remove();
    } catch {
      // nothing left to detach
    }
    createRasterLayer(map, options.getHass);
  };
  glMap.on('webglcontextlost', () => {
    clearTimeout(fallbackTimeout);
    fallbackTimeout = setTimeout(swapToRaster, CONTEXT_RESTORE_GRACE_MS);
  });
  glMap.on('webglcontextrestored', () => clearTimeout(fallbackTimeout));

  map.on('unload', () => {
    vector = false;
    clearTimeout(fallbackTimeout);
    tokenListeners.delete(onToken);
  });

  return {
    get kind(): BaseLayerKind {
      return vector ? 'vector' : 'raster';
    },
    setDark: (newDark: boolean) => {
      if (!vector || newDark === dark) return;
      dark = newDark;
      applyStyle();
    },
  };
}

/* ------------------------------------------------------------------
 * Entry point
 * ------------------------------------------------------------------ */

/**
 * Adds the Home Assistant base map to a Leaflet map: vector when possible,
 * raster through the core proxy otherwise, and direct OSM tiles on Home
 * Assistant versions without the `map_tiles` integration.
 */
export async function createBaseLayer(
  map: L.Map,
  options: BaseLayerOptions
): Promise<MapBaseLayer> {
  const accessToken = await getMapTilesToken(options.getHass());
  if (!options.isActive()) return NO_LAYER;

  if (!accessToken) {
    return createDirectOsmLayer(map);
  }

  // Keep the token fresh while this map lives (two tokens live, 30 min each)
  const interval = setInterval(() => {
    getMapTilesToken(options.getHass(), true);
  }, TOKEN_REFRESH_MS);
  map.on('unload', () => clearInterval(interval));

  if (supportsWebGL2()) {
    try {
      const vectorLayer = await createVectorLayer(map, options);
      if (vectorLayer) return vectorLayer;
    } catch {
      // No style, no vector map — but still a map
    }
    if (!options.isActive()) return NO_LAYER;
  }
  return createRasterLayer(map, options.getHass);
}

