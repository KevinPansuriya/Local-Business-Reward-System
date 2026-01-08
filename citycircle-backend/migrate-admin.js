// Migration script to add admin users table
const db = require("./db");

console.log("Starting admin migration...");

const migrations = [
    // Admins table
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)`
];

// Run migrations sequentially
function runMigrations(index) {
    if (index >= migrations.length) {
        console.log(`\nAdmin migration complete!`);
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
            runMigrations(index + 1);
        }
    });
}

// Start migrations
runMigrations(0);
