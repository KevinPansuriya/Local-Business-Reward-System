// citycircle-backend/migrations/add-store-slots-local.js
const db = require("../db");


db.serialize(() => {
    // Add is_local column to stores
    db.run(
        "ALTER TABLE stores ADD COLUMN is_local INTEGER NOT NULL DEFAULT 1",
        (err) => {
            if (err && !err.message.includes("duplicate column")) {
                process.exit(1);
            } else if (!err) {
            }
        }
    );

    // Create store_slots table
    db.run(
        `CREATE TABLE IF NOT EXISTS store_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            store_id INTEGER NOT NULL,
            cycle_month TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, store_id, cycle_month),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (store_id) REFERENCES stores(id)
        )`,
        (err) => {
            if (err) {
                process.exit(1);
            } else {
            }
        }
    );

    // Indexes
    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_slots_user_cycle ON store_slots(user_id, cycle_month)",
        (err) => {
            if (err) {
            } else {
            }
        }
    );

    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_slots_store_cycle ON store_slots(store_id, cycle_month)",
        (err) => {
            if (err) {
            } else {
            }
        }
    );

});


