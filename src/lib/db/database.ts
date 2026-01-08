import * as SQLite from "expo-sqlite";
import { DATABASE_NAME } from "@/constants";
import { CREATE_TABLES_SQL } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(CREATE_TABLES_SQL);
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
