// Migration script to add hybrid system tables (CIV + DVS)
const db = require("./db");

console.log("Starting hybrid system migration...");

const migrations = [
    // Check-in sessions
    `CREATE TABLE IF NOT EXISTS check_in_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )`,
    
    // Location history for CIV
    `CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES check_in_sessions(id) ON DELETE CASCADE
    )`,
    
    // Pending points (DVS)
    `CREATE TABLE IF NOT EXISTS pending_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      session_id INTEGER,
      loops_pending INTEGER NOT NULL,
      loops_unlocked INTEGER DEFAULT 0,
      civ_score REAL DEFAULT 0.5,
      status TEXT DEFAULT 'pending',
      unlock_trigger TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      unlocked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (session_id) REFERENCES check_in_sessions(id)
    )`,
    
    // Settlement triggers
    `CREATE TABLE IF NOT EXISTS settlement_triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pending_points_id INTEGER NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pending_points_id) REFERENCES pending_points(id)
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_check_in_active ON check_in_sessions(store_id, status, expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_check_in_user ON check_in_sessions(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_location_session ON location_history(session_id, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_points(user_id, status, expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_pending_store ON pending_points(store_id, status)`
];

// Run migrations sequentially
function runMigrations(index) {
    if (index >= migrations.length) {
        console.log(`\nMigration complete!`);
        console.log(`✅ All migrations successful`);
        process.exit(0);
        return;
    }
    
    const sql = migrations[index];
    db.run(sql, (err) => {
        if (err) {
            console.error(`Migration ${index + 1} failed:`, err.message);
            process.exit(1);
        } else {
            console.log(`Migration ${index + 1} completed`);
            // Run next migration
            runMigrations(index + 1);
        }
    });
}

// Start migrations
runMigrations(0);
