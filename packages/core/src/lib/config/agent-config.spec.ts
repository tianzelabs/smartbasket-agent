import { describe, expect, it } from 'vitest';
import { loadAgentConfig } from './agent-config.js';

describe('loadAgentConfig', () => {
  it('reads the api key and defaults the model when ANTHROPIC_MODEL is unset', () => {
    const config = loadAgentConfig({
      ANTHROPIC_API_KEY: 'sk-test-123',
    } as NodeJS.ProcessEnv);

    expect(config.anthropicApiKey).toBe('sk-test-123');
    expect(config.model).toBe('claude-sonnet-5');
  });

  it('honors an explicit ANTHROPIC_MODEL override', () => {
    const config = loadAgentConfig({
      ANTHROPIC_API_KEY: 'sk-test-123',
      ANTHROPIC_MODEL: 'claude-haiku-4-5',
    } as NodeJS.ProcessEnv);

    expect(config.model).toBe('claude-haiku-4-5');
  });

  it('throws a clear, human-readable error when ANTHROPIC_API_KEY is missing', () => {
    expect(() => loadAgentConfig({} as NodeJS.ProcessEnv)).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
