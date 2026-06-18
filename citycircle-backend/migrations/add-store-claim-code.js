// citycircle-backend/migrations/add-store-claim-code.js
const db = require("../db");


db.serialize(() => {
    db.run(
        "ALTER TABLE stores ADD COLUMN claim_code TEXT",
        (err) => {
            if (err && !err.message.includes("duplicate column")) {
                process.exit(1);
            } else if (!err) {
            }
        }
    );

    db.run(
        "ALTER TABLE stores ADD COLUMN claimed_at DATETIME",
        (err) => {
            if (err && !err.message.includes("duplicate column")) {
                process.exit(1);
            } else if (!err) {
            }
        }
    );
});




