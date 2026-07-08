import { describe, expect, it } from 'vitest';
import { centsToDollarsInput, dollarsToCents, formatDateTime, formatMoney } from './formatters';

describe('formatters', () => {
  it('formats cents as US dollar amounts', () => {
    expect(formatMoney(1234)).toBe('$12.34');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('converts dollar input strings to cents safely', () => {
    expect(dollarsToCents('12.345')).toBe(1235);
    expect(dollarsToCents('not a number')).toBe(0);
  });

  it('formats cents for controlled currency inputs', () => {
    expect(centsToDollarsInput(1234)).toBe('12.34');
  });

  it('formats ISO timestamps for display', () => {
    expect(formatDateTime('2026-01-01T12:00:00.000Z')).toMatch(/2026|Jan|January|1/);
  });
});
