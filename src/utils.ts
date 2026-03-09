/* ------------------------------------------------------------------
 * Pure utility functions — no DOM, no Leaflet, fully unit-testable
 * ------------------------------------------------------------------ */

import type {
  EntityConfig,
  HistoryMapCardConfig,
  HistoryState,
  TimelinePoint,
} from './types.js';

/* ------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------ */

export const ENTITY_COLORS = [
  '#0288d1',
  '#e53935',
  '#43a047',
  '#8e24aa',
  '#fb8c00',
  '#00acc1',
  '#3949ab',
  '#d81b60',
];

/* ------------------------------------------------------------------
 * Date / time formatting
 * ------------------------------------------------------------------ */

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date: Date): string {
  return (
    date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    formatTime(date)
  );
}

/* ------------------------------------------------------------------
 * Theme detection
 * ------------------------------------------------------------------ */

export function isSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getEffectiveTheme(config: HistoryMapCardConfig): 'light' | 'dark' {
  const themeMode = config.theme_mode ?? 'auto';
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  // auto: follow the system preference
  return isSystemDarkMode() ? 'dark' : 'light';
}

export function isDarkMode(config: HistoryMapCardConfig): boolean {
  return getEffectiveTheme(config) === 'dark';
}

/* ------------------------------------------------------------------
 * Zoom clamping
 * ------------------------------------------------------------------ */

/**
 * Clamp a raw zoom value (number, numeric string, or undefined) to a valid
 * integer in [1, 20].  Returns 14 when the value is absent or non-numeric.
 */
export function clampZoom(raw: number | string | undefined): number {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(20, Math.max(1, Math.round(parsed)));
}

/* ------------------------------------------------------------------
 * Entity config normalisation
 * ------------------------------------------------------------------ */

/**
 * Normalise the mixed `entities` array (strings or EntityConfig objects) into
 * a uniform list of EntityConfig objects.
 */
export function normalizeEntityConfigs(
  entities: Array<EntityConfig | string>
): EntityConfig[] {
  return entities.map((e) =>
    typeof e === 'string' ? { entity: e } : e
  );
}

/* ------------------------------------------------------------------
 * History data processing
 * ------------------------------------------------------------------ */

/**
 * The HA history API may return either an Array<Array<HistoryState>> (legacy)
 * or a Record<string, HistoryState[]> (newer recorder endpoint).
 * This normalises both shapes to an array-of-arrays.
 */
export function normalizeHistories(
  data: HistoryState[][] | Record<string, HistoryState[]>
): HistoryState[][] {
  return Array.isArray(data)
    ? data
    : Object.values(data as Record<string, HistoryState[]>);
}

/**
 * Extract all GPS-bearing history states into a flat, time-sorted list of
 * TimelinePoint objects.  This is a pure transformation — no Leaflet required.
 */
export function extractTimelinePoints(
  data: HistoryState[][] | Record<string, HistoryState[]>,
  entityConfigs: EntityConfig[]
): TimelinePoint[] {
  const histories = normalizeHistories(data);
  const points: TimelinePoint[] = [];

  histories.forEach((entityHistory, index) => {
    if (!entityHistory || entityHistory.length === 0) return;

    const entityId =
      entityHistory.find((s) => s.entity_id)?.entity_id ??
      entityConfigs[index]?.entity;
    if (!entityId) return;

    entityHistory.forEach((state) => {
      const lat = state.attributes?.latitude;
      const lng = state.attributes?.longitude;
      if (lat == null || lng == null) return;
      const ts = new Date(state.last_updated ?? state.last_changed).getTime();
      points.push({ timestamp: ts, entityId, lat, lng });
    });
  });

  // Sort chronologically across all entities
  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
}
