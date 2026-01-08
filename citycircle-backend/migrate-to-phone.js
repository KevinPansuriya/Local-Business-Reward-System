// Migration script to add phone, address, qr_code, and location_set to users
// and phone, qr_code to stores
const db = require("./db");
const crypto = require("crypto");

function generateQRCode(prefix, id) {
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}:${id}:${random}`;
}

console.log("Starting migration...");

// Add new columns to users table
db.run(`
    ALTER TABLE users ADD COLUMN phone TEXT;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding phone to users:", err);
    } else {
        console.log("Added phone column to users");
    }
});

db.run(`
    ALTER TABLE users ADD COLUMN address TEXT;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding address to users:", err);
    } else {
        console.log("Added address column to users");
    }
});

db.run(`
    ALTER TABLE users ADD COLUMN latitude REAL;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding latitude to users:", err);
    } else {
        console.log("Added latitude column to users");
    }
});

db.run(`
    ALTER TABLE users ADD COLUMN longitude REAL;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding longitude to users:", err);
    } else {
        console.log("Added longitude column to users");
    }
});

db.run(`
    ALTER TABLE users ADD COLUMN qr_code TEXT;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding qr_code to users:", err);
    } else {
        console.log("Added qr_code column to users");
    }
});

db.run(`
    ALTER TABLE users ADD COLUMN location_set INTEGER NOT NULL DEFAULT 0;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding location_set to users:", err);
    } else {
        console.log("Added location_set column to users");
    }
});

// Add new columns to stores table
db.run(`
    ALTER TABLE stores ADD COLUMN phone TEXT;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding phone to stores:", err);
    } else {
        console.log("Added phone column to stores");
    }
});

db.run(`
    ALTER TABLE stores ADD COLUMN qr_code TEXT;
`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding qr_code to stores:", err);
    } else {
        console.log("Added qr_code column to stores");
    }
});

// Generate QR codes for existing users
setTimeout(() => {
    db.all("SELECT id, email FROM users WHERE qr_code IS NULL", [], (err, users) => {
        if (err) {
            console.error("Error fetching users:", err);
            return;
        }
        
        users.forEach((user) => {
            const phone = user.email ? user.email.replace(/[^0-9]/g, '').substring(0, 10) || `user${user.id}` : `user${user.id}`;
            const qrCode = generateQRCode("USER", phone);
            db.run("UPDATE users SET qr_code = ?, phone = ? WHERE id = ?", [qrCode, phone, user.id], (err2) => {
                if (err2) {
                    console.error(`Error updating user ${user.id}:`, err2);
                } else {
                    console.log(`Generated QR code for user ${user.id}`);
                }
            });
        });
    });
}, 1000);

// Generate QR codes for existing stores
setTimeout(() => {
    db.all("SELECT id, email FROM stores WHERE qr_code IS NULL", [], (err, stores) => {
        if (err) {
            console.error("Error fetching stores:", err);
            return;
        }
        
        stores.forEach((store) => {
            const phone = store.email ? store.email.replace(/[^0-9]/g, '').substring(0, 10) || `store${store.id}` : `store${store.id}`;
            const qrCode = generateQRCode("STORE", phone);
            db.run("UPDATE stores SET qr_code = ?, phone = ? WHERE id = ?", [qrCode, phone, store.id], (err2) => {
                if (err2) {
                    console.error(`Error updating store ${store.id}:`, err2);
                } else {
                    console.log(`Generated QR code for store ${store.id}`);
                }
            });
        });
    });
}, 2000);

setTimeout(() => {
    console.log("Migration completed!");
    db.close();
}, 5000);
