// citycircle-backend/migrations/add-store-memberships.js
const db = require("../db");


db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_memberships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            store_id INTEGER NOT NULL,
            cycle_month TEXT NOT NULL,
            join_method TEXT NOT NULL,
            paid_cents INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_memberships_store_cycle ON store_memberships(store_id, cycle_month)",
        (err) => {
        }
    );

    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_memberships_user_cycle ON store_memberships(user_id, cycle_month)",
        (err) => {
        }
    );

    // Backfill from store_slots (free)
    db.run(
        `INSERT OR IGNORE INTO store_memberships (user_id, store_id, cycle_month, join_method, paid_cents, status, joined_at)
         SELECT user_id, store_id, cycle_month, 'free', 0, status, activated_at
         FROM store_slots`,
        (err) => {
        }
    );

    // Backfill from store_unlocks (paid)
    db.run(
        `INSERT OR IGNORE INTO store_memberships (user_id, store_id, cycle_month, join_method, paid_cents, status, joined_at)
         SELECT user_id, store_id, cycle_month, 'paid',
                CASE WHEN unlock_method = 'money' THEN unlock_amount ELSE 0 END,
                status, created_at
         FROM store_unlocks`,
        (err) => {
        }
    );
});




