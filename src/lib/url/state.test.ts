import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from './state';
import type { CalculatorInput } from '$lib/calculator/types';

const input: CalculatorInput = {
  ticketUnitPrice: 1000,
  targetTickets: 10,
  cds: [
    { id: 'a', name: 'Type A', price: 1500 },
    { id: 'b', name: 'Type B', price: 2200, minQuantity: 1, maxQuantity: 5 }
  ]
};

describe('url state', () => {
  it('round-trips an input', () => {
    const encoded = encodeState(input);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.ticketUnitPrice).toBe(input.ticketUnitPrice);
    expect(decoded!.targetTickets).toBe(input.targetTickets);
    expect(decoded!.cds).toHaveLength(2);
    expect(decoded!.cds[0]).toMatchObject({ name: 'Type A', price: 1500 });
    expect(decoded!.cds[1]).toMatchObject({
      name: 'Type B',
      price: 2200,
      minQuantity: 1,
      maxQuantity: 5
    });
  });

  it('returns null for malformed base64', () => {
    expect(decodeState('!!!not-base64')).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    const garbage = btoa('not json').replace(/=+$/, '');
    expect(decodeState(garbage)).toBeNull();
  });

  it('returns null for JSON with wrong shape', () => {
    const wrong = btoa(JSON.stringify({ foo: 'bar' })).replace(/=+$/, '');
    expect(decodeState(wrong)).toBeNull();
  });

  it('rejects non-positive numbers in payload', () => {
    const wrong = btoa(JSON.stringify({ u: 0, t: 10, c: [] })).replace(/=+$/, '');
    expect(decodeState(wrong)).toBeNull();
  });

  it('round-trips multibyte CD names (Japanese, emoji)', () => {
    const multibyte: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [
        { id: 'a', name: '通常盤', price: 1500 },
        { id: 'b', name: '初回限定盤A 🎉', price: 2200, minQuantity: 1, maxQuantity: 5 }
      ]
    };
    const encoded = encodeState(multibyte);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.cds[0].name).toBe('通常盤');
    expect(decoded!.cds[1].name).toBe('初回限定盤A 🎉');
  });
});
