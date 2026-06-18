// Migration: Add missing reward reports table
// Run with: node migrations/add-missing-reward-reports.js

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-missing-reward-reports...");

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS missing_reward_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            store_id INTEGER,
            store_name TEXT NOT NULL,
            store_address TEXT,
            visit_date DATE,
            visit_time TEXT,
            note TEXT,
            receipt_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
            admin_note TEXT,
            reviewed_by_admin_id INTEGER,
            reviewed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
            FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
        )`,
        (err) => {
            if (err) {
                console.error("Failed to create missing_reward_reports table:", err.message);
                process.exitCode = 1;
                return;
            }
            console.log("Table 'missing_reward_reports' created or already exists.");

            db.run(
                "CREATE INDEX IF NOT EXISTS idx_missing_reward_reports_user ON missing_reward_reports(user_id, created_at)",
                (err2) => {
                    if (err2) {
                        console.error("Failed to create index idx_missing_reward_reports_user:", err2.message);
                        process.exitCode = 1;
                        return;
                    }
                    console.log("Index 'idx_missing_reward_reports_user' created or already exists.");

                    db.run(
                        "CREATE INDEX IF NOT EXISTS idx_missing_reward_reports_status ON missing_reward_reports(status, created_at)",
                        (err3) => {
                            if (err3) {
                                console.error("Failed to create index idx_missing_reward_reports_status:", err3.message);
                                process.exitCode = 1;
                                return;
                            }
                            console.log("Index 'idx_missing_reward_reports_status' created or already exists.");
                            console.log("Migration complete: missing reward reports ready.");
                            db.close();
                        }
                    );
                }
            );
        }
    );
});
