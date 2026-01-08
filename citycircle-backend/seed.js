// seed.js
const bcrypt = require("bcryptjs");
const db = require("./db");

async function seed() {
    try {
        const userHash = await bcrypt.hash("password123", 10);
        const storeHash = await bcrypt.hash("password123", 10);

        db.serialize(() => {
            // Insert test user
            db.run(
                `INSERT OR IGNORE INTO users (
           email, password_hash, name, primary_zone, secondary_zone, plan, loops_balance, total_loops_earned
         ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
                ["user1@test.com", userHash, "Kevin", "ZONE_A", null, "STARTER"],
                function (err) {
                    if (err) console.error("Error inserting user:", err);
                    else console.log("User inserted with id:", this.lastID);
                }
            );

            // Insert test store
            db.run(
                `INSERT OR IGNORE INTO stores (
           email, password_hash, name, zone, category, base_discount_percent
         ) VALUES (?, ?, ?, ?, ?, ?)`,
                ["coffee@grove.com", storeHash, "Grove Coffee", "ZONE_A", "coffee", 5],
                function (err) {
                    if (err) console.error("Error inserting store:", err);
                    else console.log("Store inserted with id:", this.lastID);
                }
            );
        });

        db.close(() => console.log("Seeding done ✅"));
    } catch (e) {
        console.error("Seed error:", e);
        db.close();
    }
}

seed();
