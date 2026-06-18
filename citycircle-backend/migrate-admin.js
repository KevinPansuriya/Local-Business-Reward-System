// Migration script to add admin users table
const db = require("./db");


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


