// Database bootstrap: versioned SQL migrations run before serving requests.
import { db } from "./connection.ts";
import { applySchemaMigrations } from "./migrations.ts";

const initDatabase = () => {
  applySchemaMigrations(db);
};

export { db, initDatabase };
