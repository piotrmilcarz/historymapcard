import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSystemDarkMode, getEffectiveTheme, isDarkMode } from '../utils.js';
import type { HistoryMapCardConfig } from '../types.js';

// Minimal valid config factory
const makeConfig = (overrides: Partial<HistoryMapCardConfig> = {}): HistoryMapCardConfig => ({
  type: 'custom:history-map-card',
  entities: ['device_tracker.phone'],
  ...overrides,
});

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('isSystemDarkMode', () => {
  it('returns true when system prefers dark', () => {
    mockMatchMedia(true);
    expect(isSystemDarkMode()).toBe(true);
  });

  it('returns false when system prefers light', () => {
    mockMatchMedia(false);
    expect(isSystemDarkMode()).toBe(false);
  });
});

describe('getEffectiveTheme', () => {
  beforeEach(() => mockMatchMedia(false));

  it('returns "light" when theme_mode is "light"', () => {
    expect(getEffectiveTheme(makeConfig({ theme_mode: 'light' }))).toBe('light');
  });

  it('returns "dark" when theme_mode is "dark"', () => {
    expect(getEffectiveTheme(makeConfig({ theme_mode: 'dark' }))).toBe('dark');
  });

  it('follows system preference in auto mode — light system', () => {
    mockMatchMedia(false);
    expect(getEffectiveTheme(makeConfig({ theme_mode: 'auto' }))).toBe('light');
  });

  it('follows system preference in auto mode — dark system', () => {
    mockMatchMedia(true);
    expect(getEffectiveTheme(makeConfig({ theme_mode: 'auto' }))).toBe('dark');
  });

  it('defaults to auto when theme_mode is omitted', () => {
    mockMatchMedia(true);
    const config = makeConfig();
    delete config.theme_mode;
    expect(getEffectiveTheme(config)).toBe('dark');
  });
});

describe('isDarkMode', () => {
  it('returns true for explicit dark', () => {
    expect(isDarkMode(makeConfig({ theme_mode: 'dark' }))).toBe(true);
  });

  it('returns false for explicit light', () => {
    expect(isDarkMode(makeConfig({ theme_mode: 'light' }))).toBe(false);
  });

  it('returns true for auto + dark system', () => {
    mockMatchMedia(true);
    expect(isDarkMode(makeConfig({ theme_mode: 'auto' }))).toBe(true);
  });

  it('returns false for auto + light system', () => {
    mockMatchMedia(false);
    expect(isDarkMode(makeConfig({ theme_mode: 'auto' }))).toBe(false);
  });
});
