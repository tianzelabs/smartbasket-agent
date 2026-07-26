import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { generateHypotheticalAnswer } from './hyde.js';

function fakeClient(text: string): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text, citations: null }],
      }),
    },
  } as unknown as Anthropic;
}

describe('generateHypotheticalAnswer', () => {
  it('calls the Haiku model with the question and returns the generated text', async () => {
    const client = fakeClient('A hűtőt 0-5°C között érdemes tartani.');

    const result = await generateHypotheticalAnswer(
      client,
      'Milyen hőmérsékleten tartsam a hűtőt?',
    );

    expect(result).toBe('A hűtőt 0-5°C között érdemes tartani.');
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'Milyen hőmérsékleten tartsam a hűtőt?' }],
      }),
    );
  });

  it('throws a human-readable error when the model returns no text content', async () => {
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
    } as unknown as Anthropic;

    await expect(
      generateHypotheticalAnswer(client, 'kérdés'),
    ).rejects.toThrow(/nem adott vissza/);
  });
});
