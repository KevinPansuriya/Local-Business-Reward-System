// Migration script to add store customer blacklist table
const db = require("./db");


const migrations = [
    // Store customer blacklist table
    `CREATE TABLE IF NOT EXISTS store_customer_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reason TEXT,
      blocked_by_store_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_by_store_id) REFERENCES stores(id),
      UNIQUE(store_id, user_id)
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_blacklist_store ON store_customer_blacklist(store_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blacklist_user ON store_customer_blacklist(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blacklist_store_user ON store_customer_blacklist(store_id, user_id)`
];

// Run migrations sequentially
function runMigrations(index) {
    if (index >= migrations.length) {
        process.exit(0);
        return;
    }
    
    const sql = migrations[index];
    db.run(sql, (err) => {
        if (err) {
            process.exit(1);
        } else {
            runMigrations(index + 1);
        }
    });
}

// Start migrations
runMigrations(0);


