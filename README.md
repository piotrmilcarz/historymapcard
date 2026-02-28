# History Map Card

A **Home Assistant custom Lovelace card** that extends the built-in _Map card_ with a history timeline and animated playback.

## Features

- Displays a Leaflet map with the **current positions** of tracked entities – identical to the built-in HA Map card.
- Draws **faded historical paths** (dashed polylines) for the configured time range.
- **Timeline bar** below the map showing the full history period.
- **Play / Pause button** – clicking Play animates entity movements across the map in chronological order, drawing markers and solid path lines as time advances.
- **Scrubbing** – drag the slider to jump to any point in history.
- During playback the slider updates in real-time to reflect the current animation position.

## Screenshot / Demo

```
┌─────────────────────────────────────────────────┐
│              History Map Card                   │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  │              [Leaflet map]                │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│  ● My Phone  ● Another device                   │
│  ┌──────────────────────────────────────────┐   │
│  │ ▶  ─────────●────────────────────  14:32 │   │
│  │    08:00              now                │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Installation

### Manual

1. Copy `history-map-card.js` into your Home Assistant `/config/www/` folder (create it if it doesn't exist).
2. In the **Lovelace resources** settings (Settings → Dashboards → Resources), add:
   - **URL**: `/local/history-map-card.js`
   - **Type**: JavaScript module
3. Reload the browser.

### HACS (optional)

Add this repository as a custom repository in HACS under _Frontend_.

## Configuration

```yaml
type: custom:history-map-card
entities:
  - entity: device_tracker.my_phone
    name: My Phone          # optional, overrides friendly name
    color: "#0288d1"         # optional hex colour
  - entity: device_tracker.my_phone2
    name: My Second Phone          # optional, overrides friendly name
    color: "#d32f2f"         # optional hex colour
  - device_tracker.work_tablet  # simple string form also accepted
hours_to_show: 24            # hours of history to load (default: 24)
default_zoom: 14             # initial map zoom level (default: 14)
title: "Fleet Tracker"       # optional card title
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `entities` | list | **required** | List of entity IDs or objects with `entity`, `name`, `color` keys |
| `hours_to_show` | number | `24` | How many hours of history to display |
| `default_zoom` | number | `14` | Initial zoom level when only one entity is visible |
| `title` | string | — | Optional card title shown above the map |

### Entity object keys

| Key | Type | Description |
|-----|------|-------------|
| `entity` | string | Entity ID (e.g. `device_tracker.my_phone`) |
| `name` | string | Display name (overrides `friendly_name` attribute) |
| `color` | string | CSS colour for this entity's marker and path |

## Development

### Prerequisites

- Node.js ≥ 16 (recommended: ≥ 18 for latest tooling)
- npm

### Build

```bash
npm install
npm run build
# Output: history-map-card.js
```

### Watch mode

```bash
npm run dev
```

## How it works

1. On load the card calls `hass.callApi('GET', 'history/period/...')` with the configured entity list and time range.
2. Historical states with `latitude`/`longitude` attributes are extracted and sorted by timestamp to build a **timeline array**.
3. The slider's range maps to 0 → N-1 timeline points.
4. During **playback**, each frame advances the index by one and re-draws the accumulated path and a position marker for each entity. The delay between frames is proportional to the real elapsed time between history samples, scaled so the full animation takes approximately 30 seconds.
5. The **current real position** (from `hass.states`) is always shown as a larger marker on top.

## License

MIT

## Node Requirements

- This project builds with Node.js 16 and above, but some newer tooling (Rollup v4, terser plugins) require Node ≥18 or Node ≥20. If you see engine warnings like `EBADENGINE` or packages that require `node >=20`, upgrade your local Node.js before running `npm install` or `npm run build`.

Recommended upgrade steps (using `nvm`):

```bash
nvm install 18
nvm use 18
npm install
```

If you cannot upgrade Node on your machine, the repository includes a minimal compatible setup (Rollup v3) and does not require the newer terser plugin; in that case `npm install` should complete without engine warnings.
