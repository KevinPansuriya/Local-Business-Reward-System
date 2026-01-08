// seed-extra-stores.js
const bcrypt = require("bcryptjs");
const db = require("./db");

async function run() {
  const hash = await bcrypt.hash("password123", 10); // same password for all demo stores

  const stores = [
    {
      email: "coffee@grove.com", // already exists, this one will be ignored
      name: "Grove Coffee",
      zone: "ZONE_A",
      category: "coffee",
      base_discount_percent: 5,
      latitude: 40.7195,
      longitude: -74.042,
    },
    {
      email: "grocery@test.com",
      name: "Local Grocery",
      zone: "ZONE_A",
      category: "grocery",
      base_discount_percent: 3,
      latitude: 40.719, // near the existing point
      longitude: -74.041,
    },
    {
      email: "liquor@test.com",
      name: "Corner Liquor",
      zone: "ZONE_A",
      category: "liquor",
      base_discount_percent: 4,
      latitude: 40.7185,
      longitude: -74.043,
    },
    {
      email: "pharmacy@test.com",
      name: "Neighborhood Pharmacy",
      zone: "ZONE_A",
      category: "pharmacy",
      base_discount_percent: 2,
      latitude: 40.7188,
      longitude: -74.0405,
    },
  ];

  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO stores
       (email, password_hash, name, zone, category, base_discount_percent, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    stores.forEach((s) => {
      stmt.run(
        s.email,
        hash,
        s.name,
        s.zone,
        s.category,
        s.base_discount_percent,
        s.latitude,
        s.longitude,
        (err) => {
          if (err) {
            console.error("Insert error for", s.email, err);
          }
        }
      );
    });

    stmt.finalize((err) => {
      if (err) console.error("Finalize error:", err);
      else console.log("Extra stores seeded ✅");
      db.close();
    });
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
