// Migration: Add tracking (created_at, UTM) and analytics_events table
// Run with: node migrations/add-tracking-and-events.js

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

function run(sql, msg) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes("duplicate column name") || err.message.includes("already exists")) {
                    console.log("  (skip) " + msg);
                    return resolve();
                }
                return reject(err);
            }
            console.log("✓ " + msg);
            resolve();
        });
    });
}

async function migrate() {
    try {
    // Users: add created_at and UTM/source columns (SQLite ALTER doesn't allow non-constant DEFAULT)
    await run(
        "ALTER TABLE users ADD COLUMN created_at DATETIME",
        "users.created_at"
    );
    await run(
        "UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL",
        "users.created_at backfill"
    ).catch(() => {});
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE users ADD COLUMN signup_source TEXT", "users.signup_source");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE users ADD COLUMN utm_source TEXT", "users.utm_source");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE users ADD COLUMN utm_medium TEXT", "users.utm_medium");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE users ADD COLUMN utm_campaign TEXT", "users.utm_campaign");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }

    // Stores: add created_at (for row creation) and UTM/source for claim
    try {
        await run(
            "ALTER TABLE stores ADD COLUMN created_at DATETIME",
            "stores.created_at"
        );
        await run(
            "UPDATE stores SET created_at = COALESCE(claimed_at, datetime('now')) WHERE created_at IS NULL",
            "stores.created_at backfill"
        ).catch(() => {});
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE stores ADD COLUMN signup_source TEXT", "stores.signup_source");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE stores ADD COLUMN utm_source TEXT", "stores.utm_source");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE stores ADD COLUMN utm_medium TEXT", "stores.utm_medium");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }
    try {
        await run("ALTER TABLE stores ADD COLUMN utm_campaign TEXT", "stores.utm_campaign");
    } catch (e) {
        if (!String(e.message || "").includes("duplicate column name")) throw e;
    }

    // Analytics events table
    await run(
        `CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            actor_type TEXT,
            actor_id INTEGER,
            session_id TEXT,
            payload TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        "analytics_events table"
    );
    await run(
        "CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)",
        "idx_analytics_events_type"
    );
    await run(
        "CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at)",
        "idx_analytics_events_created"
    );
    await run(
        "CREATE INDEX IF NOT EXISTS idx_analytics_events_actor ON analytics_events(actor_type, actor_id)",
        "idx_analytics_events_actor"
    );

    // Admin notification email log (optional: avoid duplicate emails in same minute)
    await run(
        `CREATE TABLE IF NOT EXISTS admin_email_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            subject TEXT,
            recipient_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        "admin_email_log table"
    );
}

migrate()
    .then(() => {
        db.close((err) => {
            if (err) {
                console.error("Error closing database:", err.message);
                process.exit(1);
            }
            console.log("Migration completed successfully.");
        });
    })
    .catch((err) => {
        console.error("Migration failed:", err.message);
        db.close();
        process.exit(1);
    });
