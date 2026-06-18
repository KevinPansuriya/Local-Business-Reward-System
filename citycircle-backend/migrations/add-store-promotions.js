const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS store_promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            discount_type TEXT NOT NULL,
            discount_value REAL,
            start_at DATETIME,
            end_at DATETIME,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        );`
    );
});

db.close();
