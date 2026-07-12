import { describe, expect, it } from 'vitest';
import { echo } from './echo.js';

describe('echo', () => {
  it('prefixes the input with "echo: "', () => {
    expect(echo('szia')).toBe('echo: szia');
  });

  it('passes through Hungarian accented characters unchanged', () => {
    expect(echo('Hol a legolcsóbb a Dove testápoló?')).toBe(
      'echo: Hol a legolcsóbb a Dove testápoló?',
    );
  });

  it('echoes an empty string as-is', () => {
    expect(echo('')).toBe('echo: ');
  });
});
