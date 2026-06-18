// citycircle-backend/migrations/add-store-offers-news.js
const db = require("../db");


db.serialize(() => {
    db.run(
        "ALTER TABLE store_offers ADD COLUMN news TEXT NOT NULL DEFAULT 'No updates yet.'",
        (err) => {
            if (err && !err.message.includes("duplicate column")) {
                process.exit(1);
            } else if (!err) {
            }
        }
    );

    db.run(
        "UPDATE store_offers SET news = 'No updates yet.' WHERE news IS NULL OR news = ''",
        (err) => {
            if (err) {
            } else {
            }
        }
    );
});


