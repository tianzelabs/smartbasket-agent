import { resolve } from 'node:path';

const DEFAULT_DB_PATH = 'data/smartbasket.db';

export function resolveDatabasePath(): string {
  const configured = process.env.SMARTBASKET_DB_PATH;
  return configured && configured.length > 0
    ? resolve(configured)
    : resolve(DEFAULT_DB_PATH);
}
