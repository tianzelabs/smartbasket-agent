import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, SYSTEM_PROMPT } from './system-prompt.js';

describe('buildSystemPrompt', () => {
  it('returns the base prompt unchanged when the agent has database access', () => {
    expect(buildSystemPrompt({ hasDatabaseAccess: true })).toBe(SYSTEM_PROMPT);
  });

  it('appends an explicit no-database-access override otherwise', () => {
    const prompt = buildSystemPrompt({ hasDatabaseAccess: false });

    expect(prompt.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain('<override>');
    expect(prompt).toContain('NINCS adatbázis-hozzáférésed');
  });
});
