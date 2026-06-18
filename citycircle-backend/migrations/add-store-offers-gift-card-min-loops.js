const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "citycircle.db");
const db = new sqlite3.Database(dbPath);

console.log("Running migration: add-store-offers-gift-card-min-loops...");

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  db.close((closeErr) => {
    if (closeErr) {
      console.error("Failed to close DB:", closeErr.message);
      process.exitCode = 1;
    }
  });
}

db.serialize(() => {
  db.run(
    "ALTER TABLE store_offers ADD COLUMN gift_card_min_loops INTEGER DEFAULT 1000",
    (err) => {
      if (err && !String(err.message || "").includes("duplicate column name")) {
        console.error("Failed to add gift_card_min_loops column:", err.message);
        process.exitCode = 1;
        finish();
        return;
      }

      db.run(
        `UPDATE store_offers
         SET gift_card_min_loops = CASE
           WHEN gift_card_min_loops IS NULL THEN 1000
           WHEN gift_card_min_loops < 500 THEN 500
           WHEN gift_card_min_loops > 1000 THEN 1000
           ELSE gift_card_min_loops
         END`,
        (updateErr) => {
          if (updateErr) {
            console.error("Failed to normalize gift_card_min_loops values:", updateErr.message);
            process.exitCode = 1;
            finish();
            return;
          }
          console.log("Migration complete: gift_card_min_loops is ready.");
          finish();
        }
      );
    }
  );
});
