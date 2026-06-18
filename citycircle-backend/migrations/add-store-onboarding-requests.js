const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-onboarding-requests...");

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS store_onboarding_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_store_ref TEXT,
      requested_store_name TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) {
        console.error("Failed to create store_onboarding_requests table:", err.message);
        process.exitCode = 1;
        return;
      }
      console.log("Table 'store_onboarding_requests' created or already exists.");

      db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_requests_user ON store_onboarding_requests(user_id)",
        (err2) => {
          if (err2) {
            console.error("Failed to create index idx_store_requests_user:", err2.message);
            process.exitCode = 1;
            return;
          }
          console.log("Index 'idx_store_requests_user' created or already exists.");

          db.run(
            "CREATE INDEX IF NOT EXISTS idx_store_requests_status ON store_onboarding_requests(status)",
            (err3) => {
              if (err3) {
                console.error("Failed to create index idx_store_requests_status:", err3.message);
                process.exitCode = 1;
                return;
              }
              console.log("Index 'idx_store_requests_status' created or already exists.");
              db.close();
            }
          );
        }
      );
    }
  );
});
