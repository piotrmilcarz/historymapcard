import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Leaflet before the card module is imported — the card imports L at the
// top level.  We only need stubs for the handful of L.* calls made by
// _buildCard / _assignEntityColors (none of which use Leaflet directly).
// ---------------------------------------------------------------------------
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      addLayer: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      invalidateSize: vi.fn(),
      fitBounds: vi.fn(),
      eachLayer: vi.fn(),
      on: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      setLatLng: vi.fn().mockReturnThis(),
      setOpacity: vi.fn().mockReturnThis(),
      bindTooltip: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    divIcon: vi.fn(() => ({})),
    latLng: vi.fn((lat: number, lng: number) => ({ lat, lng })),
    latLngBounds: vi.fn(() => ({})),
    polyline: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      setStyle: vi.fn(),
    })),
  },
}));

// Also stub window.matchMedia used by theme helpers
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  // ResizeObserver and IntersectionObserver are not in jsdom
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  (globalThis as unknown as Record<string, unknown>).IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

import { HistoryMapCard } from '../history-map-card.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(): HistoryMapCard {
  return new HistoryMapCard();
}

// ---------------------------------------------------------------------------
// setConfig — validation
// ---------------------------------------------------------------------------

describe('setConfig — validation', () => {
  it('throws when entities array is missing', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({ type: 'custom:history-map-card', entities: [] })
    ).toThrow(/entities.*required/i);
  });

  it('throws when entities key is absent', () => {
    const card = makeCard();
    expect(() =>
      // @ts-expect-error intentionally invalid config
      card.setConfig({ type: 'custom:history-map-card' })
    ).toThrow(/entities.*required/i);
  });

  it('accepts a valid config with at least one entity', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({
        type: 'custom:history-map-card',
        entities: ['device_tracker.phone'],
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// setConfig — defaults
// ---------------------------------------------------------------------------

describe('setConfig — defaults', () => {
  it('applies default hours_to_show of 24', () => {
    const card = makeCard();
    card.setConfig({ type: 'custom:history-map-card', entities: ['device_tracker.a'] });
    // Access private field via any for test purposes
    expect((card as unknown as Record<string, unknown>)._config).toMatchObject({
      hours_to_show: 24,
    });
  });

  it('applies default default_zoom of 14', () => {
    const card = makeCard();
    card.setConfig({ type: 'custom:history-map-card', entities: ['device_tracker.a'] });
    expect((card as unknown as Record<string, unknown>)._config).toMatchObject({
      default_zoom: 14,
    });
  });

  it('applies default dark_mode of false', () => {
    const card = makeCard();
    card.setConfig({ type: 'custom:history-map-card', entities: ['device_tracker.a'] });
    expect((card as unknown as Record<string, unknown>)._config).toMatchObject({
      dark_mode: false,
    });
  });

  it('allows caller-supplied values to override defaults', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:history-map-card',
      entities: ['device_tracker.a'],
      hours_to_show: 48,
      default_zoom: 10,
    });
    expect((card as unknown as Record<string, unknown>)._config).toMatchObject({
      hours_to_show: 48,
      default_zoom: 10,
    });
  });

  it('preserves entity objects with color and name', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:history-map-card',
      entities: [{ entity: 'device_tracker.a', color: '#ff0000', name: 'Phone' }],
    });
    const config = (card as unknown as Record<string, unknown>)._config as Record<string, unknown>;
    const entities = config.entities as Array<Record<string, unknown>>;
    expect(entities[0]).toMatchObject({ entity: 'device_tracker.a', color: '#ff0000', name: 'Phone' });
  });
});
