import { z } from 'zod';

const DEFAULT_MODEL = 'claude-sonnet-5';

const AgentConfigSchema = z.object({
  anthropicApiKey: z.string().min(1),
  model: z.string().min(1),
});

const FRIENDLY_MESSAGES: Record<string, string> = {
  anthropicApiKey:
    'ANTHROPIC_API_KEY hiányzik - másold a .env.example-t .env-be és töltsd ki.',
};

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Fail-fast konfiguráció-betöltés: az askAgent hívásának legelső lépése,
// mielőtt bármilyen hálózati hívás történne (konvenciok.md 5. pont).
export function loadAgentConfig(
  env: NodeJS.ProcessEnv = process.env,
): AgentConfig {
  const result = AgentConfigSchema.safeParse({
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model:
      env.ANTHROPIC_MODEL && env.ANTHROPIC_MODEL.length > 0
        ? env.ANTHROPIC_MODEL
        : DEFAULT_MODEL,
  });

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => FRIENDLY_MESSAGES[String(issue.path[0])] ?? issue.message)
      .join('; ');
    throw new Error(`Hibás agent-konfiguráció: ${message}`);
  }

  return result.data;
}
