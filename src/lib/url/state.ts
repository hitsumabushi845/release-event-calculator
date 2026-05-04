import type { CalculatorInput, CdEntry } from '$lib/calculator/types';
import { nanoid } from 'nanoid';

type CompactCd = [name: string, price: number, min?: number, max?: number];
type CompactPayload = {
  u: number;
  t: number;
  c: CompactCd[];
};

export function encodeState(input: CalculatorInput): string {
  const payload: CompactPayload = {
    u: input.ticketUnitPrice,
    t: input.targetTickets,
    c: input.cds.map((cd) => {
      const tuple: CompactCd = [cd.name, cd.price];
      if (cd.minQuantity !== undefined) tuple[2] = cd.minQuantity;
      if (cd.maxQuantity !== undefined) {
        if (tuple[2] === undefined) tuple[2] = 0;
        tuple[3] = cd.maxQuantity;
      }
      return tuple;
    })
  };
  return base64urlEncode(JSON.stringify(payload));
}

export function decodeState(s: string): CalculatorInput | null {
  try {
    const json = base64urlDecode(s);
    const obj = JSON.parse(json) as unknown;
    if (!isCompactPayload(obj)) return null;
    if (!isPosInt(obj.u) || !isPosInt(obj.t)) return null;
    const cds: CdEntry[] = [];
    for (const tuple of obj.c) {
      if (!Array.isArray(tuple) || tuple.length < 2) return null;
      const [name, price, min, max] = tuple;
      if (typeof name !== 'string' || !isPosInt(price)) return null;
      const cd: CdEntry = { id: nanoid(8), name, price };
      if (min !== undefined) {
        if (!Number.isInteger(min) || (min as number) < 0) return null;
        if ((min as number) > 0) cd.minQuantity = min as number;
      }
      if (max !== undefined) {
        if (!Number.isInteger(max) || (max as number) < (cd.minQuantity ?? 0)) return null;
        cd.maxQuantity = max as number;
      }
      cds.push(cd);
    }
    return { ticketUnitPrice: obj.u, targetTickets: obj.t, cds };
  } catch (err) {
    console.warn('[url/state] decode failed', err);
    return null;
  }
}

function isCompactPayload(obj: unknown): obj is CompactPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'u' in obj &&
    't' in obj &&
    'c' in obj &&
    Array.isArray((obj as { c: unknown }).c)
  );
}

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function base64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
