import Anthropic from '@anthropic-ai/sdk';
import { type AgentConfig, loadAgentConfig } from '../config/agent-config.js';
import { resolveDatabasePath } from '../database/db-path.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import {
  LIST_CATEGORIES_TOOL_DEFINITION,
  listCategories,
} from '../tools/list-categories/list-categories-tool.js';
import {
  RUN_SQL_TOOL_DEFINITION,
  runSql,
} from '../tools/run-sql/run-sql-tool.js';

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 1024;
const TOOLS: Anthropic.Tool[] = [
  RUN_SQL_TOOL_DEFINITION,
  LIST_CATEGORIES_TOOL_DEFINITION,
];

export interface AskAgentOptions {
  client?: Anthropic;
  config?: AgentConfig;
  dbPath?: string;
}

export interface ToolCallLogEntry {
  name: string;
  input: unknown;
  result: unknown;
  isError: boolean;
}

export interface AskAgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AskAgentResult {
  answer: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  model: string;
  usage: AskAgentUsage;
  toolCalls: ToolCallLogEntry[];
  durationMs: number;
}

function isTextBlock(
  block: Anthropic.ContentBlock,
): block is Anthropic.TextBlock {
  return block.type === 'text';
}

function isToolUseBlock(
  block: Anthropic.ContentBlock,
): block is Anthropic.ToolUseBlock {
  return block.type === 'tool_use';
}

function executeTool(
  dbPath: string,
  name: string,
  input: unknown,
): { result: unknown; isError: boolean } {
  try {
    if (name === 'runSql') {
      const query = extractQuery(input);
      return { result: runSql(dbPath, query), isError: false };
    }
    if (name === 'listCategories') {
      return { result: listCategories(dbPath), isError: false };
    }
    return { result: { error: `Ismeretlen tool: ${name}` }, isError: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: { error: message }, isError: true };
  }
}

function extractQuery(input: unknown): string {
  if (
    typeof input === 'object' &&
    input !== null &&
    'query' in input &&
    typeof (input as { query: unknown }).query === 'string'
  ) {
    return (input as { query: string }).query;
  }
  throw new Error(
    'A runSql tool bemenete hiányzik vagy hibás (query mező szükséges).',
  );
}

// 3. fázis: kézzel írt tool-use loop az @anthropic-ai/sdk messages.create
// fölött (nem a SDK toolRunner helpere), hogy a mechanika látható maradjon.
// Amíg a modell tool_use-t kér, lefuttatjuk a toolt és tool_result-ot adunk
// vissza; a végén természetes nyelvű válasz jön (proposal-implementacio.md B3).
export async function askAgent(
  question: string,
  options: AskAgentOptions = {},
): Promise<AskAgentResult> {
  const config = options.config ?? loadAgentConfig();
  const client =
    options.client ?? new Anthropic({ apiKey: config.anthropicApiKey });
  const dbPath = options.dbPath ?? resolveDatabasePath();
  const systemPrompt = buildSystemPrompt({ hasDatabaseAccess: true });

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: question },
  ];
  const toolCalls: ToolCallLogEntry[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const startedAt = Date.now();
  let response = await client.messages.create({
    model: config.model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });
  inputTokens += response.usage.input_tokens;
  outputTokens += response.usage.output_tokens;

  let iterations = 0;
  while (
    response.stop_reason === 'tool_use' &&
    iterations < MAX_TOOL_ITERATIONS
  ) {
    iterations += 1;
    messages.push({
      role: 'assistant',
      content: response.content as unknown as Anthropic.ContentBlockParam[],
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = response.content
      .filter(isToolUseBlock)
      .map((block) => {
        const { result, isError } = executeTool(
          dbPath,
          block.name,
          block.input,
        );
        toolCalls.push({
          name: block.name,
          input: block.input,
          result,
          isError,
        });
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: isError,
        };
      });

    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: config.model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
  }

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
    usage: { inputTokens, outputTokens },
    toolCalls,
    durationMs,
  };
}
