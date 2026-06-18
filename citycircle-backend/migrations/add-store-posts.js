const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            post_type TEXT NOT NULL,
            caption TEXT NOT NULL,
            media_url TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        );`
    );
});

db.close();
