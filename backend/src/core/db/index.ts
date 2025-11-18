import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_FILE_NAME = "filecloud.db";

const dbPath = path.join(process.cwd(), DB_FILE_NAME);

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

export { db };
