import L from 'leaflet';

/* ------------------------------------------------------------------
 * Type definitions for Home Assistant integration
 * ------------------------------------------------------------------ */

interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    latitude?: number;
    longitude?: number;
    gps_accuracy?: number;
    friendly_name?: string;
    icon?: string;
    source?: string;
    [key: string]: unknown;
  };
}

interface HomeAssistant {
  states: Record<string, HassEntity>;
  callApi: <T>(
    method: 'GET' | 'POST',
    path: string,
    parameters?: Record<string, unknown>
  ) => Promise<T>;
}

interface EntityConfig {
  entity: string;
  name?: string;
  color?: string;
}

interface HistoryMapCardConfig {
  type: string;
  entities: Array<EntityConfig | string>;
  hours_to_show?: number;
  default_zoom?: number;
  dark_mode?: boolean;
  title?: string;
}

interface HistoryState {
  entity_id?: string;
  state: string;
  attributes?: {
    latitude?: number;
    longitude?: number;
    friendly_name?: string;
    [key: string]: unknown;
  };
  last_changed: string;
  last_updated?: string;
}

interface TimelinePoint {
  timestamp: number;
  entityId: string;
  lat: number;
  lng: number;
}

/* ------------------------------------------------------------------
 * Default colours assigned per entity when not set in config
 * ------------------------------------------------------------------ */
const ENTITY_COLORS = [
  '#0288d1',
  '#e53935',
  '#43a047',
  '#8e24aa',
  '#fb8c00',
  '#00acc1',
  '#3949ab',
  '#d81b60',
];

const TILE_URL =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/* ------------------------------------------------------------------
 * Leaflet CSS — injected once into the document head
 * ------------------------------------------------------------------ */
const LEAFLET_CSS = `
.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,
.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,
.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}
.leaflet-container{overflow:hidden}
.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-user-drag:none}
.leaflet-tile::selection{background:transparent}.leaflet-safari .leaflet-tile{image-rendering:-webkit-optimize-contrast}
.leaflet-safari .leaflet-tile-container{width:1600px;height:1600px;-webkit-transform-origin:0 0}
.leaflet-marker-icon,.leaflet-marker-shadow{display:block}
.leaflet-container .leaflet-overlay-pane svg{max-width:none!important;max-height:none!important}
.leaflet-container .leaflet-marker-pane img,.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important;width:auto;padding:0}
.leaflet-container img.leaflet-tile{mix-blend-mode:plus-lighter}
.leaflet-container.leaflet-touch-zoom{-ms-touch-action:pan-x pan-y;touch-action:pan-x pan-y}
.leaflet-container.leaflet-touch-drag{-ms-touch-action:pinch-zoom;touch-action:none;touch-action:pinch-zoom}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom{-ms-touch-action:none;touch-action:none}
.leaflet-container{-webkit-tap-highlight-color:transparent}
.leaflet-container a{-webkit-tap-highlight-color:rgba(51,181,229,0.4)}
.leaflet-tile{filter:inherit;visibility:hidden}
.leaflet-tile-loaded{visibility:inherit}
.leaflet-zoom-box{width:0;height:0;-moz-box-sizing:border-box;box-sizing:border-box;z-index:800}
.leaflet-overlay-pane svg{-moz-user-select:none}
.leaflet-pane{z-index:400}
.leaflet-tile-pane{z-index:200}
.leaflet-overlay-pane{z-index:400}
.leaflet-shadow-pane{z-index:500}
.leaflet-marker-pane{z-index:600}
.leaflet-tooltip-pane{z-index:650}
.leaflet-popup-pane{z-index:700}
.leaflet-map-pane canvas{z-index:100}
.leaflet-map-pane svg{z-index:200}
.leaflet-vml-shape{width:1px;height:1px}
.lvml{behavior:url(#default#VML);display:inline-block;position:absolute}
.leaflet-control{position:relative;z-index:800;pointer-events:visiblePainted;pointer-events:auto}
.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}
.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}
.leaflet-control{float:left;clear:both}
.leaflet-right .leaflet-control{float:right}
.leaflet-top .leaflet-control{margin-top:10px}
.leaflet-bottom .leaflet-control{margin-bottom:10px}
.leaflet-left .leaflet-control{margin-left:10px}
.leaflet-right .leaflet-control{margin-right:10px}
.leaflet-fade-anim .leaflet-popup{opacity:0;-webkit-transition:opacity .2s linear;-moz-transition:opacity .2s linear;transition:opacity .2s linear}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup{opacity:1}
.leaflet-zoom-animated{-webkit-transform-origin:0 0;-ms-transform-origin:0 0;transform-origin:0 0}
svg.leaflet-zoom-animated{will-change:transform}
.leaflet-zoom-anim .leaflet-zoom-animated{-webkit-transition:-webkit-transform .25s cubic-bezier(0,0,.25,1);-moz-transition:-moz-transform .25s cubic-bezier(0,0,.25,1);transition:transform .25s cubic-bezier(0,0,.25,1)}
.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{-webkit-transition:none;-moz-transition:none;transition:none}
.leaflet-zoom-anim .leaflet-zoom-animated{will-change:transform}
.leaflet-interactive{cursor:pointer}
.leaflet-grab{cursor:-webkit-grab;cursor:-moz-grab;cursor:grab}
.leaflet-crosshair,.leaflet-crosshair .leaflet-interactive{cursor:crosshair}
.leaflet-popup-pane,.leaflet-control{cursor:auto}
.leaflet-dragging .leaflet-grab,.leaflet-dragging .leaflet-grab .leaflet-interactive,.leaflet-dragging .leaflet-marker-draggable{cursor:move;cursor:-webkit-grabbing;cursor:-moz-grabbing;cursor:grabbing}
.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-image-layer,.leaflet-pane > svg path,.leaflet-tile-container{pointer-events:none}
.leaflet-marker-icon.leaflet-interactive,.leaflet-image-layer.leaflet-interactive,.leaflet-pane > svg path.leaflet-interactive,svg.leaflet-image-layer.leaflet-interactive path{pointer-events:visiblePainted;pointer-events:auto}
.leaflet-container{background:#ddd;outline-offset:1px}
.leaflet-container a.leaflet-active{outline:2px solid orange}
.leaflet-zoom-box{border:2px dotted #38f;background:rgba(255,255,255,.5)}
.leaflet-container{font-family:Helvetica Neue,Arial,Helvetica,sans-serif;font-size:.75rem;font-size:12px;line-height:1.5}
.leaflet-bar{box-shadow:0 1px 5px rgba(0,0,0,.65);border-radius:4px}
.leaflet-bar a{background-color:#fff;border-bottom:1px solid #ccc;width:26px;height:26px;line-height:26px;display:block;text-align:center;text-decoration:none;color:black}
.leaflet-bar a,.leaflet-control-layers-toggle{background-position:50% 50%;background-repeat:no-repeat;display:block}
.leaflet-bar a:hover,.leaflet-bar a:focus{background-color:#f4f4f4}
.leaflet-bar a:first-child{border-top-left-radius:4px;border-top-right-radius:4px}
.leaflet-bar a:last-child{border-bottom-left-radius:4px;border-bottom-right-radius:4px;border-bottom:none}
.leaflet-bar a.leaflet-disabled{cursor:default;background-color:#f4f4f4;color:#bbb}
.leaflet-touch .leaflet-bar a{width:30px;height:30px;line-height:30px}
.leaflet-touch .leaflet-bar a:first-child{border-top-left-radius:2px;border-top-right-radius:2px}
.leaflet-touch .leaflet-bar a:last-child{border-bottom-left-radius:2px;border-bottom-right-radius:2px}
.leaflet-control-zoom-in,.leaflet-control-zoom-out{font:bold 18px Lucida Console,Monaco,monospace;text-indent:1px}
.leaflet-touch .leaflet-control-zoom-in{font-size:22px}.leaflet-touch .leaflet-control-zoom-out{font-size:20px}
.leaflet-control-layers{box-shadow:0 1px 5px rgba(0,0,0,.4);background:#fff;border-radius:5px}
.leaflet-control-layers-toggle{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAQAAAADQ4RFAAACf0lEQVR4AazQf2zUdR3H8ef3e7/fve8dXUVEwEHLj9qCHbKh4pQiP2JsB4OJLGRgGdFVF2czQMloHU5FRFTknKARTf4xGQlEfxBQHCBQHFDovkGHJGJBwUsH9AfXXu/e5/b5/vze5/shKRnZHOO3vN/JJt/n8/18n0oph9OAzq9xgxVWWLSNUcobfJtHOMIidpTRiZfJfbAVRRX3VjFi+FxYRFJg2JBgyJAgSpElT4iSEP4FJjfTGWwAAAAASUVORK5CYII=);width:36px;height:36px}
.leaflet-retina .leaflet-control-layers-toggle{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAA0CAQAAABvcdNgAAADGElEQVR4Ae3XA2ydURgG4HN723XWpbZZ27Zt27Zt27Zt27Zt27nJuWtjxr777rvPPfkvD2clnAgECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAg8N8J5YEXgfXAO8IxYAXQAqD3KbABmAlA8wVgBXhlmAdgXXgDAfDxgOHAecBU4Ck3cBAA/QDYN+QW/A0gc4SmAZgMTAamAZgMTAbmAeANABg+MxjYDRzqP0GAAoB5GCR3BusriMcGKfgSYBZ48baMeHXxrR7gF/AogGMKuBCmAsgBzpX+DXwHXgBuAuiwGcBjAY6ADmfAE7gVnAD2AJcDswHOA4AfdNugI8Bk4DiwCdgKnAbOA68JZwHJgHOjIDOHDyPRZgNuAVYC6wqv1jgNUA+7FPC7gAMAW4A1y4wDR+Q/G3BWijGlAAAAAElFTkSuQmCC);background-size:26px 26px}
.leaflet-touch .leaflet-control-layers-toggle{width:44px;height:44px;background-size:26px 26px}
.leaflet-control-layers .leaflet-control-layers-list,.leaflet-control-layers-expanded .leaflet-control-layers-toggle{display:none}
.leaflet-control-layers-expanded .leaflet-control-layers-list{display:block;position:relative}
.leaflet-control-layers-expanded{padding:6px 10px 6px 6px;color:#333;background:#fff}
.leaflet-control-layers-scrollbar{overflow-y:scroll;overflow-x:hidden;padding-right:5px}
.leaflet-control-layers-selector{margin-top:2px;position:relative;top:1px}
.leaflet-control-layers label{display:block;font-size:1.08333em}
.leaflet-control-layers-separator{height:0;border-top:1px solid #ddd;margin:5px -10px 5px -6px}
.leaflet-default-icon-path{background-image:url(data:image/png;base64,)}
.leaflet-container .leaflet-control-attribution{background:#fff;background:rgba(255,255,255,.8);margin:0}
.leaflet-control-attribution,.leaflet-control-scale-line{padding:0 5px;color:#333;line-height:1.4}
.leaflet-control-attribution a{text-decoration:none}
.leaflet-control-attribution a:hover,.leaflet-control-attribution a:focus{text-decoration:underline}
.leaflet-attribution-flag{display:inline!important;vertical-align:baseline!important;width:1em;height:.6669em}
.leaflet-left .leaflet-control-scale{margin-left:5px}
.leaflet-bottom .leaflet-control-scale{margin-bottom:5px}
.leaflet-control-scale-line{border:2px solid #777;border-top:none;line-height:1.1;padding:2px 5px 1px;font-size:.7142em;white-space:nowrap;overflow:hidden;-moz-box-sizing:border-box;box-sizing:border-box;background:rgba(255,255,255,.5)}
.leaflet-control-scale-line:not(:first-child){border-top:2px solid #777;border-bottom:none;margin-top:-2px}
.leaflet-control-scale-line:not(:first-child):not(:last-child){border-bottom:2px solid #777}
.leaflet-touch .leaflet-control-attribution,.leaflet-touch .leaflet-control-layers,.leaflet-touch .leaflet-bar{box-shadow:none}
.leaflet-touch .leaflet-control-layers,.leaflet-touch .leaflet-bar{border:2px solid rgba(0,0,0,.2);background-clip:padding-box}
.leaflet-popup{position:absolute;text-align:center;margin-bottom:20px}
.leaflet-popup-content-wrapper{padding:1px;text-align:left;border-radius:12px}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#fff;color:#333;box-shadow:0 3px 14px rgba(0,0,0,.4)}
.leaflet-popup-content{margin:13px 24px 13px 20px;line-height:1.3;font-size:1.08333em}
.leaflet-popup-content p{margin:1.3em 0}
.leaflet-popup-tip-container{width:40px;height:20px;position:absolute;left:50%;margin-left:-20px;overflow:hidden;pointer-events:none}
.leaflet-popup-tip{width:17px;height:17px;padding:1px;margin:-10px auto 0;pointer-events:auto;-webkit-transform:rotate(45deg);-moz-transform:rotate(45deg);-ms-transform:rotate(45deg);transform:rotate(45deg)}
.leaflet-popup-content-wrapper a{color:#0078A8}
.leaflet-popup-scrolled{overflow:auto}
.leaflet-oldie .leaflet-popup-content-wrapper{-ms-filter:"progid:DXImageTransform.Microsoft.dropShadow(OffX=2,OffY=2,Color=#999)";filter:progid:DXImageTransform.Microsoft.dropShadow(OffX=2,OffY=2,Color=#999);padding:6px}
.leaflet-oldie .leaflet-popup-tip{width:24px;filter:progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);margin:0 auto}
.leaflet-oldie .leaflet-control-zoom,.leaflet-oldie .leaflet-control-layers,.leaflet-oldie .leaflet-popup-content-wrapper,.leaflet-oldie .leaflet-popup-tip{border:1px solid #999}
.leaflet-div-icon{background:#fff;border:1px solid #666}
.leaflet-tooltip{position:absolute;padding:6px;background-color:#fff;border:1px solid #fff;border-radius:3px;color:#222;white-space:nowrap;-webkit-user-select:none;-moz-user-select:none;user-select:none;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.leaflet-tooltip.leaflet-interactive{cursor:pointer;pointer-events:auto}
.leaflet-tooltip-top:before,.leaflet-tooltip-bottom:before,.leaflet-tooltip-left:before,.leaflet-tooltip-right:before{position:absolute;pointer-events:none;border:6px solid transparent;background:transparent;content:""}
.leaflet-tooltip-bottom{margin-top:6px}
.leaflet-tooltip-top{margin-top:-6px}
.leaflet-tooltip-bottom:before,.leaflet-tooltip-top:before{left:50%;margin-left:-6px}
.leaflet-tooltip-top:before{bottom:0;margin-bottom:-12px;border-top-color:#fff}
.leaflet-tooltip-bottom:before{top:0;margin-top:-12px;margin-left:-6px;border-bottom-color:#fff}
.leaflet-tooltip-left:before{right:0;margin-right:-12px;top:50%;margin-top:-6px;border-left-color:#fff}
.leaflet-tooltip-right:before{left:0;margin-left:-12px;top:50%;margin-top:-6px;border-right-color:#fff}
.leaflet-oldie .leaflet-tooltip{filter:progid:DXImageTransform.Microsoft.dropShadow(OffX=1,OffY=1,Color=#999)}
`;

/* ------------------------------------------------------------------
 * Card styles
 * ------------------------------------------------------------------ */
const CARD_CSS = `
  :host {
    display: block;
  }
  ha-card {
    overflow: hidden;
  }
  .card-header {
    padding: 12px 16px 0;
    font-weight: 500;
    font-size: 1.1em;
  }
  #map {
    width: 100%;
    height: 400px;
    position: relative;
  }
  .timeline-container {
    padding: 12px 16px;
    background: var(--card-background-color, #fff);
    border-top: 1px solid var(--divider-color, #e0e0e0);
  }
  .timeline-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .play-pause-btn {
    background: var(--primary-color, #03a9f4);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    min-width: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .play-pause-btn:hover {
    background: var(--primary-color, #0288d1);
    filter: brightness(0.9);
  }
  .timeline-slider-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .timeline-slider {
    width: 100%;
    cursor: pointer;
    accent-color: var(--primary-color, #03a9f4);
  }
  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.72em;
    color: var(--secondary-text-color, #727272);
  }
  .timeline-time {
    font-size: 0.8em;
    color: var(--secondary-text-color, #727272);
    white-space: nowrap;
    min-width: 50px;
    text-align: right;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 6px 16px 12px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8em;
    color: var(--primary-text-color, #212121);
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-marker {
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.8);
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  .loading-msg {
    padding: 8px 16px;
    font-size: 0.85em;
    color: var(--secondary-text-color, #727272);
  }
`;

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date: Date): string {
  return (
    date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    formatTime(date)
  );
}

function createDotIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="dot-marker" style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.85);box-shadow:0 1px 4px rgba(0,0,0,0.45);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, 0],
  });
}

/* ------------------------------------------------------------------
 * HistoryMapCard custom element
 * ------------------------------------------------------------------ */

class HistoryMapCard extends HTMLElement {
  private _config: HistoryMapCardConfig | null = null;
  private _hass: HomeAssistant | null = null;
  private _map: L.Map | null = null;
  private _shadow: ShadowRoot;
  private _mapContainer: HTMLDivElement | null = null;

  // Per-entity display layers
  private _currentMarkers: Map<string, L.Marker> = new Map();
  private _historyPathLines: Map<string, L.Polyline> = new Map();

  // Animation state
  private _timelinePoints: TimelinePoint[] = [];
  private _animationIndex = 0;
  private _isPlaying = false;
  private _animationTimer: ReturnType<typeof setTimeout> | null = null;
  private _animationMarkers: Map<string, L.Marker> = new Map();
  private _animationPaths: Map<string, L.Polyline> = new Map();

  // UI elements
  private _sliderEl: HTMLInputElement | null = null;
  private _playBtn: HTMLButtonElement | null = null;
  private _timeLabelEl: HTMLSpanElement | null = null;
  private _loadingEl: HTMLElement | null = null;

  // Entity colour map
  private _entityColors: Map<string, string> = new Map();

  private _initialViewSet = false;
  private _historyFetchedAt = 0;
  private _bounds: L.LatLngBoundsExpression | null = null;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    // When the element is (re-)attached to the DOM, ensure Leaflet
    // recalculates the container size in case layout wasn't ready earlier.
    if (this._map) {
      requestAnimationFrame(() => {
        this._map?.invalidateSize();
      });
    }
  }

  /* ----------------------------------------------------------------
   * HA Lovelace API
   * -------------------------------------------------------------- */

  setConfig(config: HistoryMapCardConfig): void {
    if (!config.entities || config.entities.length === 0) {
      throw new Error('history-map-card: "entities" list is required');
    }
    this._config = {
      hours_to_show: 24,
      default_zoom: 14,
      dark_mode: false,
      ...config,
    };
    this._assignEntityColors();
    this._buildCard();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (!this._config) return;

    // Lazy-initialise map (needs DOM to be ready)
    if (!this._map && this._mapContainer) {
      this._initMap();
    }

    // Refresh static current-position markers
    this._renderCurrentPositions();

    // Fetch history data at most once per 30 s (or on first call)
    const now = Date.now();
    if (now - this._historyFetchedAt > 30_000) {
      this._historyFetchedAt = now;
      this._fetchHistory();
    }
  }

  /* ----------------------------------------------------------------
   * Build shadow-DOM structure
   * -------------------------------------------------------------- */

  private _buildCard(): void {
    if (!this._config) return;

    // Destroy existing Leaflet instance before wiping the shadow DOM so
    // Leaflet can clean up its event listeners properly.
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
    this._initialViewSet = false;

    const card = document.createElement('ha-card');
    card.setAttribute('elevation', '2');

    // Optional title
    if (this._config.title) {
      const header = document.createElement('div');
      header.className = 'card-header';
      header.textContent = this._config.title;
      card.appendChild(header);
    }

    // Map container
    const mapDiv = document.createElement('div');
    mapDiv.id = 'map';
    this._mapContainer = mapDiv;
    card.appendChild(mapDiv);

    // Loading indicator
    const loading = document.createElement('div');
    loading.className = 'loading-msg';
    loading.textContent = 'Loading history…';
    loading.style.display = 'none';
    this._loadingEl = loading;
    card.appendChild(loading);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    this._getEntityConfigs().forEach((ec) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const dot = document.createElement('div');
      dot.className = 'legend-dot';
      dot.style.background = this._getEntityColor(ec.entity);
      const label = document.createElement('span');
      label.textContent = ec.name ?? ec.entity;
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });
    card.appendChild(legend);

    // Timeline
    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'timeline-container';

    const controls = document.createElement('div');
    controls.className = 'timeline-controls';

    // Play/pause button
    const btn = document.createElement('button');
    btn.className = 'play-pause-btn';
    btn.title = 'Play history animation';
    btn.innerHTML = this._playIcon();
    btn.addEventListener('click', () => this._togglePlayPause());
    this._playBtn = btn;
    controls.appendChild(btn);

    // Slider + labels wrapper
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'timeline-slider-wrap';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'timeline-slider';
    slider.min = '0';
    slider.max = '0';
    slider.value = '0';
    slider.addEventListener('input', () => this._onSliderInput());
    this._sliderEl = slider;
    sliderWrap.appendChild(slider);

    const labelsRow = document.createElement('div');
    labelsRow.className = 'timeline-labels';
    const labelStart = document.createElement('span');
    labelStart.id = 'lbl-start';
    const labelEnd = document.createElement('span');
    labelEnd.id = 'lbl-end';
    labelsRow.appendChild(labelStart);
    labelsRow.appendChild(labelEnd);
    sliderWrap.appendChild(labelsRow);

    controls.appendChild(sliderWrap);

    // Current time readout
    const timeLabel = document.createElement('span');
    timeLabel.className = 'timeline-time';
    timeLabel.textContent = '';
    this._timeLabelEl = timeLabel;
    controls.appendChild(timeLabel);

    timelineContainer.appendChild(controls);
    card.appendChild(timelineContainer);

    // Styles — include Leaflet CSS inside shadow root so its pointer-events
    // rules apply to the map container which lives in the shadow DOM.
    const style = document.createElement('style');
    style.textContent = LEAFLET_CSS + CARD_CSS;

    this._shadow.innerHTML = '';
    this._shadow.appendChild(style);
    this._shadow.appendChild(card);
  }

  /* ----------------------------------------------------------------
   * Map initialisation
   * -------------------------------------------------------------- */

  private _initMap(): void {
    if (!this._mapContainer || !this._config) return;

    this._map = L.map(this._mapContainer, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(this._map);

    // Leaflet reads the container dimensions at init time.  Inside a Shadow
    // DOM the layout may not have been computed yet, so explicitly tell
    // Leaflet to recalculate the size once the browser has done layout.
    requestAnimationFrame(() => {
      this._map?.invalidateSize();
    });

    // Render current positions now that map is ready
    this._renderCurrentPositions();
  }

  /* ----------------------------------------------------------------
   * Entity config helpers
   * -------------------------------------------------------------- */

  private _getEntityConfigs(): EntityConfig[] {
    if (!this._config) return [];
    return this._config.entities.map((e) =>
      typeof e === 'string' ? { entity: e } : e
    );
  }

  private _assignEntityColors(): void {
    this._getEntityConfigs().forEach((ec, i) => {
      this._entityColors.set(
        ec.entity,
        ec.color ?? ENTITY_COLORS[i % ENTITY_COLORS.length]
      );
    });
  }

  private _getEntityColor(entityId: string): string {
    return this._entityColors.get(entityId) ?? ENTITY_COLORS[0];
  }

  /* ----------------------------------------------------------------
   * Current-position markers (always shown, like HA map card)
   * -------------------------------------------------------------- */

  private _renderCurrentPositions(): void {
    if (!this._map || !this._hass || !this._config) return;

    const validPoints: L.LatLng[] = [];

    this._getEntityConfigs().forEach((ec) => {
      const state = this._hass!.states[ec.entity];
      if (!state) return;
      const lat = state.attributes.latitude;
      const lng = state.attributes.longitude;
      if (lat == null || lng == null) return;

      const color = this._getEntityColor(ec.entity);
      const latlng = L.latLng(lat, lng);
      validPoints.push(latlng);

      const existing = this._currentMarkers.get(ec.entity);
      if (existing) {
        existing.setLatLng(latlng);
      } else {
        const marker = L.marker(latlng, {
          icon: createDotIcon(color, 16),
          zIndexOffset: 1000,
        })
          .bindTooltip(
            ec.name ?? state.attributes.friendly_name ?? ec.entity,
            { permanent: false, direction: 'top' }
          )
          .addTo(this._map!);
        this._currentMarkers.set(ec.entity, marker);
      }
    });

    // Fit map to current markers only the very first time (before history has
    // been loaded and fitted).  Without this guard the map snaps back to the
    // current position on every `set hass` call, which HA issues frequently.
    if (validPoints.length > 0 && !this._initialViewSet) {
      this._initialViewSet = true;
      if (validPoints.length === 1) {
        this._map.setView(validPoints[0], this._config.default_zoom ?? 14);
      } else {
        this._map.fitBounds(L.latLngBounds(validPoints), { padding: [40, 40] });
      }
    }
  }

  /* ----------------------------------------------------------------
   * History fetching
   * -------------------------------------------------------------- */

  private async _fetchHistory(): Promise<void> {
    if (!this._hass || !this._config) return;

    if (this._loadingEl) this._loadingEl.style.display = '';

    const hoursToShow = this._config.hours_to_show ?? 24;
    const startTime = new Date(Date.now() - hoursToShow * 3600 * 1000);
    const entityIds = this._getEntityConfigs()
      .map((e) => e.entity)
      .join(',');

    try {
      const path =
        `history/period/${startTime.toISOString()}` +
        `?filter_entity_id=${entityIds}&minimal_response=false&no_attributes=false`;

      const data: HistoryState[][] = await this._hass.callApi('GET', path);

      if (this._loadingEl) this._loadingEl.style.display = 'none';

      this._processHistoryData(data, startTime);
    } catch (err) {
      console.warn('history-map-card: failed to fetch history', err);
      if (this._loadingEl) this._loadingEl.style.display = 'none';
    }
  }

  private _processHistoryData(
    data: HistoryState[][],
    startTime: Date
  ): void {
    if (!this._map) return;

    // Remove old static history paths
    this._historyPathLines.forEach((p) => p.remove());
    this._historyPathLines.clear();

    const allPoints: TimelinePoint[] = [];

    (data ?? []).forEach((entityHistory) => {
      if (!entityHistory || entityHistory.length === 0) return;
      const entityId = entityHistory[0].entity_id;
      if (!entityId) return;
      const color = this._getEntityColor(entityId);

      const coords: L.LatLng[] = [];

      entityHistory.forEach((state) => {
        const lat = state.attributes?.latitude;
        const lng = state.attributes?.longitude;
        if (lat == null || lng == null) return;

        const ts = new Date(state.last_updated ?? state.last_changed).getTime();
        allPoints.push({ timestamp: ts, entityId, lat, lng });
        coords.push(L.latLng(lat, lng));
      });

      if (coords.length > 1) {
        const line = L.polyline(coords, {
          color,
          weight: 3,
          opacity: 0.45,
          dashArray: '6 4',
        }).addTo(this._map!);
        this._historyPathLines.set(entityId, line);
      }
    });

    if (allPoints.length === 0) return;

    // Sort all points by time
    allPoints.sort((a, b) => a.timestamp - b.timestamp);
    this._timelinePoints = allPoints;

    // Fit bounds to history
    const latLngs = allPoints.map((p) => L.latLng(p.lat, p.lng));
    this._bounds = L.latLngBounds(latLngs);
    this._map.fitBounds(this._bounds as L.LatLngBounds, { padding: [40, 40] });

    // Setup slider
    this._setupSlider(startTime, new Date());
  }

  /* ----------------------------------------------------------------
   * Timeline / slider setup
   * -------------------------------------------------------------- */

  private _setupSlider(startTime: Date, endTime: Date): void {
    if (!this._sliderEl) return;
    const total = this._timelinePoints.length;
    this._sliderEl.max = String(Math.max(0, total - 1));
    this._sliderEl.value = '0';
    this._animationIndex = 0;

    // Labels
    const startLbl = this._shadow.getElementById('lbl-start');
    const endLbl = this._shadow.getElementById('lbl-end');
    if (startLbl) startLbl.textContent = formatDateTime(startTime);
    if (endLbl) endLbl.textContent = formatDateTime(endTime);

    this._updateTimeLabel();
  }

  private _updateTimeLabel(): void {
    if (!this._timeLabelEl) return;
    const pt = this._timelinePoints[this._animationIndex];
    if (!pt) {
      this._timeLabelEl.textContent = '';
      return;
    }
    this._timeLabelEl.textContent = formatTime(new Date(pt.timestamp));
  }

  private _onSliderInput(): void {
    if (!this._sliderEl) return;
    const idx = parseInt(this._sliderEl.value, 10);
    this._animationIndex = idx;
    this._updateTimeLabel();
    this._renderAnimationFrame(idx);
  }

  /* ----------------------------------------------------------------
   * Play / Pause
   * -------------------------------------------------------------- */

  private _togglePlayPause(): void {
    if (this._timelinePoints.length === 0) return;
    this._isPlaying ? this._pauseAnimation() : this._startAnimation();
  }

  private _startAnimation(): void {
    if (this._timelinePoints.length === 0) return;

    this._isPlaying = true;
    this._updatePlayBtn();

    // Hide static history paths during animation so animation is clear
    this._historyPathLines.forEach((p) => p.setStyle({ opacity: 0.15 }));

    // If we're at the end, restart from beginning
    if (this._animationIndex >= this._timelinePoints.length - 1) {
      this._animationIndex = 0;
      this._clearAnimationLayers();
    }

    this._scheduleNextFrame();
  }

  private _pauseAnimation(): void {
    this._isPlaying = false;
    this._updatePlayBtn();
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
      this._animationTimer = null;
    }
    // Restore static path opacity
    this._historyPathLines.forEach((p) => p.setStyle({ opacity: 0.45 }));
  }

  private _scheduleNextFrame(): void {
    if (!this._isPlaying) return;
    if (this._animationIndex >= this._timelinePoints.length - 1) {
      // Reached end
      this._pauseAnimation();
      return;
    }

    const current = this._timelinePoints[this._animationIndex];
    const next = this._timelinePoints[this._animationIndex + 1];
    // Delay proportional to real elapsed time, scaled to ~30s total animation
    const totalDuration = 30_000; // ms
    const totalTime =
      this._timelinePoints[this._timelinePoints.length - 1].timestamp -
      this._timelinePoints[0].timestamp;
    const interval =
      totalTime > 0
        ? ((next.timestamp - current.timestamp) / totalTime) * totalDuration
        : 200;

    // Clamp between 50ms and 1000ms per step for watchability
    const delay = Math.min(1000, Math.max(50, interval));

    this._animationTimer = setTimeout(() => {
      this._animationIndex++;
      this._renderAnimationFrame(this._animationIndex);
      if (this._sliderEl) {
        this._sliderEl.value = String(this._animationIndex);
      }
      this._updateTimeLabel();
      this._scheduleNextFrame();
    }, delay);
  }

  /* ----------------------------------------------------------------
   * Animation frame rendering
   * -------------------------------------------------------------- */

  private _renderAnimationFrame(upToIndex: number): void {
    if (!this._map) return;

    this._clearAnimationLayers();

    // Collect all points up to upToIndex, grouped by entity
    const entityCoords: Map<string, L.LatLng[]> = new Map();

    for (let i = 0; i <= upToIndex && i < this._timelinePoints.length; i++) {
      const pt = this._timelinePoints[i];
      if (!entityCoords.has(pt.entityId)) {
        entityCoords.set(pt.entityId, []);
      }
      entityCoords.get(pt.entityId)!.push(L.latLng(pt.lat, pt.lng));
    }

    entityCoords.forEach((coords, entityId) => {
      const color = this._getEntityColor(entityId);

      // Draw path (solid line)
      if (coords.length > 1) {
        const line = L.polyline(coords, {
          color,
          weight: 3,
          opacity: 0.9,
        }).addTo(this._map!);
        this._animationPaths.set(entityId, line);
      }

      // Draw current position marker
      const lastCoord = coords[coords.length - 1];
      const ec = this._getEntityConfigs().find(
        (e) => e.entity === entityId
      );
      const marker = L.marker(lastCoord, {
        icon: createDotIcon(color, 14),
        zIndexOffset: 900,
      })
        .bindTooltip(ec?.name ?? entityId, {
          permanent: false,
          direction: 'top',
        })
        .addTo(this._map!);
      this._animationMarkers.set(entityId, marker);
    });
  }

  private _clearAnimationLayers(): void {
    this._animationMarkers.forEach((m) => m.remove());
    this._animationMarkers.clear();
    this._animationPaths.forEach((p) => p.remove());
    this._animationPaths.clear();
  }

  /* ----------------------------------------------------------------
   * UI helpers
   * -------------------------------------------------------------- */

  private _updatePlayBtn(): void {
    if (!this._playBtn) return;
    this._playBtn.innerHTML = this._isPlaying
      ? this._pauseIcon()
      : this._playIcon();
    this._playBtn.title = this._isPlaying
      ? 'Pause animation'
      : 'Play history animation';
  }

  private _playIcon(): string {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  private _pauseIcon(): string {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  }

  /* ----------------------------------------------------------------
   * Lovelace card static helpers
   * -------------------------------------------------------------- */

  static getConfigElement(): HTMLElement {
    return document.createElement('history-map-card-editor');
  }

  static getStubConfig(): Record<string, unknown> {
    return {
      type: 'custom:history-map-card',
      entities: [{ entity: 'device_tracker.example' }],
      hours_to_show: 24,
    };
  }

  getCardSize(): number {
    return 5;
  }
}

/* ------------------------------------------------------------------
 * Register the custom element
 * ------------------------------------------------------------------ */

customElements.define('history-map-card', HistoryMapCard);

// Announce to HA's custom card picker
(window as Window & { customCards?: Array<Record<string, unknown>> })
  .customCards = (
    (window as Window & { customCards?: Array<Record<string, unknown>> })
      .customCards ?? []
  ).concat([
    {
      type: 'history-map-card',
      name: 'History Map Card',
      description:
        'Map card with history timeline and animation playback',
      preview: false,
    },
  ]);
