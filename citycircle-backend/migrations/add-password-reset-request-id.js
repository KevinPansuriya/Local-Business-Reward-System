const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE password_reset_tokens ADD COLUMN request_id TEXT;", (err) => {
        if (err && !String(err.message || "").includes("duplicate column")) {
            process.exitCode = 1;
        }
    });
});

db.close();
