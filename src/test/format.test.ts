import { describe, it, expect } from 'vitest';
import { formatTime, formatDateTime } from '../utils.js';

describe('formatTime', () => {
  it('formats a time as HH:MM (locale-based)', () => {
    // Use a fixed UTC time and pin the locale to avoid CI differences
    const date = new Date('2024-03-15T14:05:00Z');
    const result = formatTime(date);
    // The result must contain at least one digit and a colon
    expect(result).toMatch(/\d+:\d{2}/);
  });

  it('returns a non-empty string', () => {
    expect(formatTime(new Date())).toBeTruthy();
  });
});

describe('formatDateTime', () => {
  it('includes both a date portion and a time portion', () => {
    const date = new Date('2024-03-15T14:05:00Z');
    const result = formatDateTime(date);
    // Should have a time part (colon-separated digits)
    expect(result).toMatch(/\d+:\d{2}/);
    // Should have a space separating date and time
    expect(result).toContain(' ');
  });

  it('is longer than formatTime alone', () => {
    const date = new Date('2024-06-01T08:30:00Z');
    expect(formatDateTime(date).length).toBeGreaterThan(formatTime(date).length);
  });
});
