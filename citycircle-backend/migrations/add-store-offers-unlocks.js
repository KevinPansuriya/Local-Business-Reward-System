// citycircle-backend/migrations/add-store-offers-unlocks.js
const db = require("../db");


db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_offers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL UNIQUE,
            reward_tier TEXT NOT NULL DEFAULT 'standard',
            reward_points INTEGER NOT NULL DEFAULT 0,
            unlock_cost_cents INTEGER NOT NULL DEFAULT 0,
            unlock_cost_loops INTEGER NOT NULL DEFAULT 0,
            is_locked INTEGER NOT NULL DEFAULT 0,
            min_plan TEXT NOT NULL DEFAULT 'STARTER',
            news TEXT NOT NULL DEFAULT 'No updates yet.',
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
        `CREATE TABLE IF NOT EXISTS store_unlocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            store_id INTEGER NOT NULL,
            cycle_month TEXT NOT NULL,
            unlock_method TEXT NOT NULL,
            unlock_amount INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        "CREATE INDEX IF NOT EXISTS idx_store_offers_store ON store_offers(store_id)",
        (err) => {
            if (err) {
            } else {
            }
        }
    );

    db.run(
        "CREATE INDEX IF NOT EXISTS idx_store_unlocks_user_cycle ON store_unlocks(user_id, cycle_month)",
        (err) => {
            if (err) {
            } else {
            }
        }
    );

    db.run(
        `INSERT INTO store_offers (store_id, reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan, news)
         SELECT id,
                CASE
                    WHEN COALESCE(base_discount_percent, 0) >= 20 THEN 'premium'
                    WHEN COALESCE(base_discount_percent, 0) >= 10 THEN 'boosted'
                    ELSE 'standard'
                END,
                COALESCE(base_discount_percent, 0),
                CASE
                    WHEN COALESCE(base_discount_percent, 0) >= 20 THEN 299
                    WHEN COALESCE(base_discount_percent, 0) >= 10 THEN 199
                    ELSE 0
                END,
                CASE
                    WHEN COALESCE(base_discount_percent, 0) >= 20 THEN 300
                    WHEN COALESCE(base_discount_percent, 0) >= 10 THEN 200
                    ELSE 0
                END,
                CASE
                    WHEN COALESCE(base_discount_percent, 0) >= 10 THEN 1
                    ELSE 0
                END,
                CASE
                    WHEN COALESCE(base_discount_percent, 0) >= 20 THEN 'PREMIUM'
                    WHEN COALESCE(base_discount_percent, 0) >= 10 THEN 'PLUS'
                    ELSE 'STARTER'
                END,
                'No updates yet.'
         FROM stores
         WHERE id NOT IN (SELECT store_id FROM store_offers)`,
        (err) => {
            if (err) {
            } else {
            }
        }
    );
});


