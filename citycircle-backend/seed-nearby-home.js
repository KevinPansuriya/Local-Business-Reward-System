// seed-nearby-home.js
const bcrypt = require("bcryptjs");
const db = require("./db");

async function run() {
  const hash = await bcrypt.hash("password123", 10);

  // Home location for Kevin (from DB)
  const homeLat = 40.7443304;
  const homeLng = -74.057613;

  const stores = [
    {
      email: "foodmart@local.test",
      name: "Food Mart",
      zone: "ZONE_HOME",
      category: "grocery",
      base_discount_percent: 5,
      latitude: homeLat + 0.003,
      longitude: homeLng - 0.002,
    },
    {
      email: "whitemanadiner@local.test",
      name: "White Mana Diner",
      zone: "ZONE_HOME",
      category: "restaurant",
      base_discount_percent: 4,
      latitude: homeLat - 0.0025,
      longitude: homeLng + 0.0015,
    },
    {
      email: "ringside@local.test",
      name: "Ringside",
      zone: "ZONE_HOME",
      category: "restaurant",
      base_discount_percent: 4,
      latitude: homeLat - 0.0018,
      longitude: homeLng - 0.0012,
    },
    {
      email: "manhattanliquors@local.test",
      name: "Manhattan Liquors",
      zone: "ZONE_HOME",
      category: "liquor",
      base_discount_percent: 4,
      latitude: homeLat + 0.0012,
      longitude: homeLng + 0.0018,
    },
    {
      email: "avani@local.test",
      name: "Avani Beauty Salon",
      zone: "ZONE_HOME",
      category: "salon",
      base_discount_percent: 6,
      latitude: homeLat - 0.0022,
      longitude: homeLng + 0.0022,
    },
    {
      email: "royaldeli@local.test",
      name: "Royal Deli & Grocery",
      zone: "ZONE_HOME",
      category: "grocery",
      base_discount_percent: 4,
      latitude: homeLat + 0.0021,
      longitude: homeLng - 0.0016,
    },
    {
      email: "barberhouse@local.test",
      name: "Beach Street Barbershop",
      zone: "ZONE_HOME",
      category: "barber",
      base_discount_percent: 5,
      latitude: homeLat + 0.0016,
      longitude: homeLng - 0.0008,
    },
  ];

  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO stores
       (email, password_hash, name, zone, category, base_discount_percent, latitude, longitude, is_local)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
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
          }
        }
      );
    });

    stmt.finalize((err) => {
      db.close();
    });
  });
}

run().catch((e) => {
  process.exit(1);
});


