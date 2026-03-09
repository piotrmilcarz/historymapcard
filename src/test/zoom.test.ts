import { describe, it, expect } from 'vitest';
import { clampZoom } from '../utils.js';

describe('clampZoom', () => {
  it('returns the value unchanged when it is a valid integer in [1, 20]', () => {
    expect(clampZoom(10)).toBe(10);
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(20)).toBe(20);
  });

  it('returns 14 when value is undefined', () => {
    expect(clampZoom(undefined)).toBe(14);
  });

  it('returns 14 for NaN string', () => {
    expect(clampZoom('abc')).toBe(14);
  });

  it('parses numeric strings', () => {
    expect(clampZoom('16')).toBe(16);
    expect(clampZoom('  8 ')).toBe(8);
  });

  it('clamps values below 1 to 1', () => {
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(-5)).toBe(1);
  });

  it('clamps values above 20 to 20', () => {
    expect(clampZoom(25)).toBe(20);
    expect(clampZoom(100)).toBe(20);
  });

  it('rounds fractional values', () => {
    expect(clampZoom(14.7)).toBe(15);
    expect(clampZoom(14.2)).toBe(14);
  });
});
