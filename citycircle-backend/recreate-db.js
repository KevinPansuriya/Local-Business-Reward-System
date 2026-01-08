// recreate-db.js
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "citycircle.db");
const schemaPath = path.join(__dirname, "schema.sql");

const schema = fs.readFileSync(schemaPath, "utf8");
const db = new sqlite3.Database(dbPath);

db.exec(schema, (err) => {
  if (err) {
    console.error("❌ Schema init failed:", err);
  } else {
    console.log("✅ Database created from schema.sql");
  }
  db.close();
});
