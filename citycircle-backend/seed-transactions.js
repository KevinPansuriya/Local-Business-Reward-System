const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./citycircle.db");

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// create realistic timestamps in last 4 months
function randomDateLast4Months() {
  const now = Date.now();
  const fourMonthsMs = 1000 * 60 * 60 * 24 * 120;
  const past = now - fourMonthsMs;
  return new Date(rand(past, now)).toISOString();
}

db.serialize(() => {
  db.get(`SELECT id FROM users LIMIT 1`, (err, user) => {
    if (!user) {
      console.error("❌ No user found");
      process.exit(1);
    }

    db.all(`SELECT id FROM stores`, (err, stores) => {
      if (!stores.length) {
        console.error("❌ No stores found");
        process.exit(1);
      }

      const stmt = db.prepare(`
        INSERT INTO transactions
        (user_id, store_id, amount_cents, loops_earned, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      // 40 transactions across last 4 months
      for (let i = 0; i < 40; i++) {
        const store = stores[rand(0, stores.length - 1)];
        const amount = rand(800, 6500); // $8 – $65
        const loops = Math.floor(amount / 100);
        const createdAt = randomDateLast4Months();

        stmt.run(
          user.id,
          store.id,
          amount,
          loops,
          createdAt
        );
      }

      stmt.finalize(() => {
        console.log("✅ Seeded transactions (last 4 months)");
        db.close();
      });
    });
  });
});
