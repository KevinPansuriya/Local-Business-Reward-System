const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-onboarding-requests-ref-column...");

db.serialize(() => {
  // Check if column already exists
  db.all("PRAGMA table_info(store_onboarding_requests)", (err, columns) => {
    if (err) {
      console.error("Failed to check table info:", err.message);
      process.exitCode = 1;
      db.close();
      return;
    }

    const hasRefColumn = columns.some(col => col.name === "requested_store_ref");
    
    if (hasRefColumn) {
      console.log("Column 'requested_store_ref' already exists. Skipping migration.");
      db.close();
      return;
    }

    // Add the missing column
    db.run(
      "ALTER TABLE store_onboarding_requests ADD COLUMN requested_store_ref TEXT",
      (err2) => {
        if (err2) {
          console.error("Failed to add requested_store_ref column:", err2.message);
          process.exitCode = 1;
          db.close();
          return;
        }
        console.log("Column 'requested_store_ref' added successfully.");
        db.close();
      }
    );
  });
});
