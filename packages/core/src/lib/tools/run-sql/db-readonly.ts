import Database from 'better-sqlite3';
import type { SmartBasketDatabase } from '../../database/connection.js';

// Második védelmi réteg a sql-guard.ts mellett: ez a kapcsolat SQLite-szinten
// is tiltja az írást, függetlenül attól, hogy a guard esetleg átenged-e
// valamit (architektura.md 9. pont, konvenciok.md 7. pont).
export function openReadOnlyConnection(dbPath: string): SmartBasketDatabase {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}
