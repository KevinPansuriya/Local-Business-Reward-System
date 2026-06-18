// citycircle-backend/migrations/add-store-profile-image.js
const db = require("../db");

db.serialize(() => {
    db.run(
        "ALTER TABLE stores ADD COLUMN profile_image_url TEXT",
        (err) => {
            if (err) {
                if (String(err.message || "").includes("duplicate column")) {
                    process.exit(0);
                }
                process.exit(1);
            } else {
                process.exit(0);
            }
        }
    );
});
