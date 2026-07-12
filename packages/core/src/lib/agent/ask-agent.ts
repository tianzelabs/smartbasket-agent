import Anthropic from '@anthropic-ai/sdk';
import { type AgentConfig, loadAgentConfig } from '../config/agent-config.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';

export interface AskAgentOptions {
  client?: Anthropic;
  config?: AgentConfig;
}

export interface AskAgentResult {
  answer: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  model: string;
  usage: Anthropic.Usage;
  durationMs: number;
}

function isTextBlock(
  block: Anthropic.ContentBlock,
): block is Anthropic.TextBlock {
  return block.type === 'text';
}

// 2. fázis: egyetlen messages.create hívás, tool nélkül. Az agent NEM éri
// el az adatbázist - a system prompt explicit override-ja mondja ezt meg a
// modellnek (proposal-implementacio.md B2).
export async function askAgent(
  question: string,
  options: AskAgentOptions = {},
): Promise<AskAgentResult> {
  const config = options.config ?? loadAgentConfig();
  const client =
    options.client ?? new Anthropic({ apiKey: config.anthropicApiKey });
  const systemPrompt = buildSystemPrompt({ hasDatabaseAccess: false });
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: question },
  ];

  const startedAt = Date.now();
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  const durationMs = Date.now() - startedAt;

  const answer = response.content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join('\n');

  return {
    answer,
    systemPrompt,
    messages,
    model: config.model,
    usage: response.usage,
    durationMs,
  };
}
