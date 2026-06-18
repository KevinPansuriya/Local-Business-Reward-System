const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-reward-point-schedules...");

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_reward_point_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            reason TEXT,
            mode TEXT NOT NULL DEFAULT 'fixed',
            fixed_points INTEGER,
            multiplier REAL,
            start_at DATETIME NOT NULL,
            end_at DATETIME NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`,
        (err) => {
            if (err) {
                console.error("Failed to create store_reward_point_schedules:", err.message);
                process.exitCode = 1;
                return db.close();
            }

            db.run(
                "CREATE INDEX IF NOT EXISTS idx_store_reward_schedules_store_time ON store_reward_point_schedules(store_id, is_active, start_at, end_at)",
                (idxErr) => {
                    if (idxErr) {
                        console.error("Failed to create schedule index:", idxErr.message);
                        process.exitCode = 1;
                    } else {
                        console.log("Migration complete: store reward point schedules ready.");
                    }
                    db.close();
                }
            );
        }
    );
});
