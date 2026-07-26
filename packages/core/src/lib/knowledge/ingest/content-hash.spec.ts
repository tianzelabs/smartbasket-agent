import { describe, expect, it } from 'vitest';
import { sha256Hex } from './content-hash.js';

describe('sha256Hex', () => {
  it('is deterministic for the same input', () => {
    expect(sha256Hex('teszt tartalom')).toBe(sha256Hex('teszt tartalom'));
  });

  it('differs for different input', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('accepts a Buffer', () => {
    expect(sha256Hex(Buffer.from('teszt'))).toBe(sha256Hex('teszt'));
  });
});
