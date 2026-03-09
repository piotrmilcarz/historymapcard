import { describe, it, expect } from 'vitest';
import {
  normalizeHistories,
  normalizeEntityConfigs,
  extractTimelinePoints,
} from '../utils.js';
import type { HistoryState, EntityConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  opts: {
    entity_id?: string;
    lat?: number;
    lng?: number;
    last_changed?: string;
    last_updated?: string;
  } = {}
): HistoryState {
  return {
    entity_id: opts.entity_id,
    state: 'home',
    attributes: {
      latitude: opts.lat,
      longitude: opts.lng,
    },
    last_changed: opts.last_changed ?? '2024-01-01T10:00:00Z',
    last_updated: opts.last_updated,
  };
}

// ---------------------------------------------------------------------------
// normalizeEntityConfigs
// ---------------------------------------------------------------------------

describe('normalizeEntityConfigs', () => {
  it('converts plain strings to EntityConfig objects', () => {
    const result = normalizeEntityConfigs(['device_tracker.phone']);
    expect(result).toEqual([{ entity: 'device_tracker.phone' }]);
  });

  it('passes through existing EntityConfig objects unchanged', () => {
    const ec: EntityConfig = { entity: 'person.alice', color: '#ff0000', name: 'Alice' };
    expect(normalizeEntityConfigs([ec])).toEqual([ec]);
  });

  it('handles mixed arrays', () => {
    const result = normalizeEntityConfigs(['device_tracker.a', { entity: 'device_tracker.b', color: '#0f0' }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ entity: 'device_tracker.a' });
    expect(result[1]).toEqual({ entity: 'device_tracker.b', color: '#0f0' });
  });

  it('returns empty array for empty input', () => {
    expect(normalizeEntityConfigs([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeHistories
// ---------------------------------------------------------------------------

describe('normalizeHistories', () => {
  it('returns array-of-arrays as-is', () => {
    const data = [[makeState()], [makeState()]];
    expect(normalizeHistories(data)).toStrictEqual(data);
  });

  it('converts a Record to array-of-arrays', () => {
    const s = makeState({ entity_id: 'device_tracker.phone' });
    const data: Record<string, HistoryState[]> = { 'device_tracker.phone': [s] };
    const result = normalizeHistories(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([s]);
  });
});

// ---------------------------------------------------------------------------
// extractTimelinePoints
// ---------------------------------------------------------------------------

describe('extractTimelinePoints', () => {
  it('extracts states that have lat/lng', () => {
    const data = [[
      makeState({ entity_id: 'device_tracker.a', lat: 52.1, lng: 21.0, last_changed: '2024-01-01T10:00:00Z' }),
    ]];
    const points = extractTimelinePoints(data, [{ entity: 'device_tracker.a' }]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ entityId: 'device_tracker.a', lat: 52.1, lng: 21.0 });
  });

  it('skips states without latitude or longitude', () => {
    const data = [[
      makeState({ entity_id: 'device_tracker.a', last_changed: '2024-01-01T10:00:00Z' }), // no lat/lng
    ]];
    const points = extractTimelinePoints(data, [{ entity: 'device_tracker.a' }]);
    expect(points).toHaveLength(0);
  });

  it('sorts points by timestamp across entities', () => {
    const data = [
      [
        makeState({ entity_id: 'device_tracker.a', lat: 1, lng: 1, last_changed: '2024-01-01T12:00:00Z' }),
        makeState({ entity_id: 'device_tracker.a', lat: 2, lng: 2, last_changed: '2024-01-01T10:00:00Z' }),
      ],
    ];
    const points = extractTimelinePoints(data, [{ entity: 'device_tracker.a' }]);
    expect(points[0].timestamp).toBeLessThan(points[1].timestamp);
    expect(points[0].lat).toBe(2); // earlier state comes first
  });

  it('uses last_updated over last_changed for timestamp when available', () => {
    const state = makeState({
      entity_id: 'device_tracker.a',
      lat: 1,
      lng: 1,
      last_changed: '2024-01-01T10:00:00Z',
      last_updated: '2024-01-01T11:00:00Z',
    });
    const points = extractTimelinePoints([[state]], [{ entity: 'device_tracker.a' }]);
    expect(points[0].timestamp).toBe(new Date('2024-01-01T11:00:00Z').getTime());
  });

  it('falls back to entityConfigs position when entity_id is absent', () => {
    const state = makeState({ lat: 5, lng: 5, last_changed: '2024-01-01T10:00:00Z' });
    // entity_id is undefined — should fall back to entityConfigs[0].entity
    const points = extractTimelinePoints([[state]], [{ entity: 'device_tracker.fallback' }]);
    expect(points[0].entityId).toBe('device_tracker.fallback');
  });

  it('handles multiple entities, merges and sorts all points', () => {
    const data = [
      [makeState({ entity_id: 'a', lat: 1, lng: 1, last_changed: '2024-01-01T09:00:00Z' })],
      [makeState({ entity_id: 'b', lat: 2, lng: 2, last_changed: '2024-01-01T08:00:00Z' })],
    ];
    const points = extractTimelinePoints(data, [{ entity: 'a' }, { entity: 'b' }]);
    expect(points).toHaveLength(2);
    expect(points[0].entityId).toBe('b'); // earlier
    expect(points[1].entityId).toBe('a');
  });

  it('returns empty array when no states have GPS data', () => {
    const data = [[makeState()], [makeState()]]; // no lat/lng
    expect(extractTimelinePoints(data, [])).toEqual([]);
  });

  it('accepts the Record format from the newer HA endpoint', () => {
    const record = {
      'device_tracker.x': [
        makeState({ entity_id: 'device_tracker.x', lat: 10, lng: 20, last_changed: '2024-01-01T10:00:00Z' }),
      ],
    };
    const points = extractTimelinePoints(record, [{ entity: 'device_tracker.x' }]);
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBe(10);
  });
});
