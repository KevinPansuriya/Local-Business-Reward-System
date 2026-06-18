const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-onboarding-requests-unique-constraint...");

db.serialize(() => {
  // SQLite doesn't support adding UNIQUE constraints to existing tables directly
  // So we'll create a unique index instead, which provides the same protection
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_store_requests_user_store_ref 
     ON store_onboarding_requests(user_id, requested_store_ref) 
     WHERE requested_store_ref IS NOT NULL`,
    (err) => {
      if (err) {
        console.error("Failed to create unique index on user_id + requested_store_ref:", err.message);
        // Don't exit - this is a soft constraint, we'll handle duplicates in application logic
      } else {
        console.log("Unique index 'idx_store_requests_user_store_ref' created or already exists.");
      }

      // Also create a unique index for user_id + store_name (normalized)
      // Note: SQLite doesn't support functional indexes directly, so we'll rely on application-level deduplication
      // But we can create a regular index for faster lookups
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_store_requests_user_name 
         ON store_onboarding_requests(user_id, requested_store_name)`,
        (err2) => {
          if (err2) {
            console.error("Failed to create index idx_store_requests_user_name:", err2.message);
          } else {
            console.log("Index 'idx_store_requests_user_name' created or already exists.");
          }
          db.close();
        }
      );
    }
  );
});
