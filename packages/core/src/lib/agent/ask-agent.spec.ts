import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { askAgent } from './ask-agent.js';

const testConfig = { anthropicApiKey: 'sk-test-123', model: 'claude-sonnet-5' };

function fakeMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    container: null,
    content: [{ type: 'text', text, citations: null }],
    model: 'claude-sonnet-5',
    role: 'assistant',
    stop_details: null,
    stop_reason: 'end_turn',
    stop_sequence: null,
    type: 'message',
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 42,
      output_tokens: 7,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function fakeClient(response: Anthropic.Message): Anthropic {
  return {
    messages: { create: vi.fn().mockResolvedValue(response) },
  } as unknown as Anthropic;
}

describe('askAgent', () => {
  it('sends the question and the no-database-access system prompt, returns the text answer', async () => {
    const client = fakeClient(fakeMessage('Szia! Miben segíthetek?'));

    const result = await askAgent('szia', { client, config: testConfig });

    expect(result.answer).toBe('Szia! Miben segíthetek?');
    expect(result.systemPrompt).toContain('<override>');
    expect(result.systemPrompt).toContain('NINCS adatbázis-hozzáférésed');
    expect(result.messages).toEqual([{ role: 'user', content: 'szia' }]);
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.usage.input_tokens).toBe(42);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createMock = (client as any).messages.create;
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'szia' }],
      }),
    );
  });

  it('joins multiple text blocks into one answer', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          ...fakeMessage(''),
          content: [
            { type: 'text', text: 'első rész', citations: null },
            { type: 'text', text: 'második rész', citations: null },
          ],
        }),
      },
    } as unknown as Anthropic;

    const result = await askAgent('kérdés', { client, config: testConfig });

    expect(result.answer).toBe('első rész\nmásodik rész');
  });
});
