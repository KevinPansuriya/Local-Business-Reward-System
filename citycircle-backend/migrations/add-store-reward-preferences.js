const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-reward-preferences...");

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_reward_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL UNIQUE,
            automation_mode TEXT NOT NULL DEFAULT 'auto',
            weekly_digest_enabled INTEGER NOT NULL DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`,
        (err) => {
            if (err) {
                console.error("Failed to create store_reward_preferences:", err.message);
                process.exitCode = 1;
                return db.close();
            }

            db.run(
                "CREATE INDEX IF NOT EXISTS idx_store_reward_preferences_store ON store_reward_preferences(store_id)",
                (idxErr) => {
                    if (idxErr) {
                        console.error("Failed to create reward preferences index:", idxErr.message);
                        process.exitCode = 1;
                        return db.close();
                    }

                    db.run(
                        `INSERT OR IGNORE INTO store_reward_preferences (store_id, automation_mode, weekly_digest_enabled)
                         SELECT id, 'auto', 1 FROM stores`,
                        (seedErr) => {
                            if (seedErr) {
                                console.error("Failed to seed reward preferences:", seedErr.message);
                                process.exitCode = 1;
                            } else {
                                console.log("Migration complete: store reward preferences ready.");
                            }
                            db.close();
                        }
                    );
                }
            );
        }
    );
});
