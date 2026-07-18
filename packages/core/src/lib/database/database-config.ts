import { z } from 'zod';

const DatabaseConfigSchema = z.object({
  databaseUrl: z.string().min(1),
  databaseUrlReadonly: z.string().min(1),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

const FRIENDLY_MESSAGES: Record<string, string> = {
  databaseUrl:
    'DATABASE_URL hiányzik - másold a .env.example-t .env-be, és indítsd el a lokális Postgrest (docker compose up -d).',
  databaseUrlReadonly:
    'DATABASE_URL_READONLY hiányzik - másold a .env.example-t .env-be, és indítsd el a lokális Postgrest (docker compose up -d).',
};

// Fail-fast konfiguráció-betöltés (agent-config.ts mintájára): a RW/RO
// Postgres-kapcsolat két külön szerepkörön fut (docs/db-migration-rationale.md).
export function loadDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const result = DatabaseConfigSchema.safeParse({
    databaseUrl: env.DATABASE_URL,
    databaseUrlReadonly: env.DATABASE_URL_READONLY,
  });

  if (!result.success) {
    const message = result.error.issues
      .map(
        (issue) => FRIENDLY_MESSAGES[String(issue.path[0])] ?? issue.message,
      )
      .join('; ');
    throw new Error(`Hibás adatbázis-konfiguráció: ${message}`);
  }

  return result.data;
}
