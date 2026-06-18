const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

function addColumn(sql) {
    db.run(sql, (err) => {
        if (err && !String(err.message || "").includes("duplicate column")) {
            process.exitCode = 1;
        }
    });
}

db.serialize(() => {
    addColumn("ALTER TABLE store_promotions ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;");
    addColumn("ALTER TABLE store_updates ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
    addColumn("ALTER TABLE store_updates ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;");
    addColumn("ALTER TABLE store_posts ADD COLUMN start_at DATETIME;");
    addColumn("ALTER TABLE store_posts ADD COLUMN end_at DATETIME;");
    addColumn("ALTER TABLE store_posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;");
});

db.close();
