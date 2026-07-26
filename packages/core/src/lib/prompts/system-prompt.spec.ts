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

  it('lists searchKnowledge as an available tool', () => {
    expect(SYSTEM_PROMPT).toContain('searchKnowledge(question)');
  });

  it('requires source attribution for knowledge-base answers', () => {
    expect(SYSTEM_PROMPT).toContain('MINDIG forráshivatkozással');
  });

  it('requires an explicit "no answer" instead of fabricating when below the relevance threshold', () => {
    expect(SYSTEM_PROMPT).toContain('belowThreshold: true');
    expect(SYSTEM_PROMPT).toContain('NE találj ki tanácsot');
  });

  it('tells the agent that runSql/listCategories always win for price or stock questions, even when knowledge is also relevant', () => {
    expect(SYSTEM_PROMPT).toContain(
      'Árra vagy készletre vonatkozó kérdésnél mindig a runSql',
    );
  });
});
