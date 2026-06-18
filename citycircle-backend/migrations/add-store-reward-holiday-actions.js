const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-reward-holiday-actions...");

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_reward_holiday_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            holiday_id TEXT NOT NULL,
            holiday_date TEXT NOT NULL,
            action TEXT NOT NULL,
            reminder_sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(store_id, holiday_id, holiday_date),
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`,
        (err) => {
            if (err) {
                console.error("Failed to create store_reward_holiday_actions:", err.message);
                process.exitCode = 1;
                return db.close();
            }

            db.run(
                "CREATE INDEX IF NOT EXISTS idx_store_reward_holiday_actions_store ON store_reward_holiday_actions(store_id, holiday_date)",
                (idxErr) => {
                    if (idxErr) {
                        console.error("Failed to create holiday actions index:", idxErr.message);
                        process.exitCode = 1;
                    } else {
                        console.log("Migration complete: store reward holiday actions ready.");
                    }
                    db.close();
                }
            );
        }
    );
});
