// citycircle-backend/migrations/add-stores-place-id.js
const db = require("../db");


db.serialize(() => {
    db.run(
        "ALTER TABLE stores ADD COLUMN place_id TEXT",
        (err) => {
            if (err && !err.message.includes("duplicate column")) {
                process.exit(1);
            } else if (!err) {
            }
        }
    );
});


