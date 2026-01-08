const db = require("./db");

db.serialize(() => {
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, store_id, amount_cents, loops_earned, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  stmt.run(1, 1, 1299, 22, "-1 days");
  stmt.run(1, 2, 4973, 38, "-3 days");
  stmt.run(1, 3, 5046, 26, "-6 days");

  stmt.finalize(() => {
    console.log("✅ Inserted 3 recent transactions");
    db.close();
  });
});
