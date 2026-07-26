import { z } from 'zod';

const CohereConfigSchema = z.object({
  cohereApiKey: z.string().min(1),
});

const FRIENDLY_MESSAGES: Record<string, string> = {
  cohereApiKey:
    'COHERE_API_KEY hiányzik - másold a .env.example-t .env-be és töltsd ki (a searchKnowledge tool embeddinghez/rerankhez használja).',
};

export type CohereConfig = z.infer<typeof CohereConfigSchema>;

// agent-config.ts mintájára: fail-fast konfiguráció-betöltés, mielőtt bármilyen
// hálózati hívás történne.
export function loadCohereConfig(
  env: NodeJS.ProcessEnv = process.env,
): CohereConfig {
  const result = CohereConfigSchema.safeParse({
    cohereApiKey: env.COHERE_API_KEY,
  });

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => FRIENDLY_MESSAGES[String(issue.path[0])] ?? issue.message)
      .join('; ');
    throw new Error(`Hibás Cohere-konfiguráció: ${message}`);
  }

  return result.data;
}
