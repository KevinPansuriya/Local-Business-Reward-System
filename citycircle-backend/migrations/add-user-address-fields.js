const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

function addColumn(columnSql) {
    return new Promise((resolve) => {
        db.run(columnSql, (err) => {
            if (err && !String(err.message || "").includes("duplicate column")) {
                console.error(err);
            }
            resolve();
        });
    });
}

async function run() {
    await addColumn("ALTER TABLE users ADD COLUMN address_line1 TEXT");
    await addColumn("ALTER TABLE users ADD COLUMN address_line2 TEXT");
    await addColumn("ALTER TABLE users ADD COLUMN city TEXT");
    await addColumn("ALTER TABLE users ADD COLUMN state TEXT");
    await addColumn("ALTER TABLE users ADD COLUMN postal_code TEXT");
    db.close();
}

run();
