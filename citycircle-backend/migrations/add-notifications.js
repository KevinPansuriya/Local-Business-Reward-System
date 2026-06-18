// Migration: Add notifications system
// Run with: node migrations/add-notifications.js

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    }
    console.log("Connected to database");
});

db.serialize(() => {
    // Create notifications table
    db.run(
        `CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            store_id INTEGER,
            type TEXT NOT NULL, -- 'promotion' | 'update' | 'system'
            title TEXT NOT NULL,
            message TEXT,
            content_id INTEGER, -- ID of the promotion/update that triggered this
            content_type TEXT, -- 'promotion' | 'update'
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
        )`,
        (err) => {
            if (err) {
                console.error("Error creating notifications table:", err.message);
            } else {
                console.log("✓ Created notifications table");
            }
        }
    );

    // Create notification preferences table
    db.run(
        `CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id INTEGER PRIMARY KEY,
            promotions_enabled INTEGER NOT NULL DEFAULT 1,
            updates_enabled INTEGER NOT NULL DEFAULT 1,
            sms_enabled INTEGER NOT NULL DEFAULT 0,
            email_enabled INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        (err) => {
            if (err) {
                console.error("Error creating notification_preferences table:", err.message);
            } else {
                console.log("✓ Created notification_preferences table");
            }
        }
    );

    // Create index for faster queries
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`,
        (err) => {
            if (err) {
                console.error("Error creating index:", err.message);
            } else {
                console.log("✓ Created index on notifications");
            }
        }
    );

    db.close((err) => {
        if (err) {
            console.error("Error closing database:", err.message);
            process.exit(1);
        }
        console.log("Migration completed successfully!");
    });
});
