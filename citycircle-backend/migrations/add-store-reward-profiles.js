// citycircle-backend/migrations/add-store-reward-profiles.js
const db = require("../db");


db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_reward_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL UNIQUE,
            max_rewarded_visits_per_day INTEGER,
            cooldown_minutes INTEGER,
            min_dwell_minutes INTEGER,
            base_points INTEGER,
            pending_ratio REAL,
            dvs_expiry_days INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`,
        (err) => {
            if (err) {
                process.exit(1);
            } else {
            }
        }
    );

    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_reward_profiles_store ON store_reward_profiles(store_id)",
        (err) => {
            if (err) {
            } else {
            }
        }
    );
});



