export { getDatabase, closeDatabase } from "./database";
export { CREATE_TABLES_SQL } from "./schema";
export {
  projectRowToModel,
  entryRowToModel,
  reportRowToModel,
  notificationSettingsRowToModel,
  syncQueueItemRowToModel,
} from "./mappers";

import { getDatabase } from "./database";

/**
 * Initialize the database connection and create all tables.
 * This should be called once when the app starts.
 * Tables are created if they don't exist (idempotent).
 */
export async function initDatabase(): Promise<void> {
  await getDatabase();
}
