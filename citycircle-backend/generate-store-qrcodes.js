// Script to generate QR codes for stores that don't have one
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "citycircle.db");
const db = new sqlite3.Database(dbPath);

function generateQRCode(prefix, id) {
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}:${id}:${random}`;
}

console.log("Checking stores without QR codes...");

db.all("SELECT id, email, phone FROM stores WHERE qr_code IS NULL OR qr_code = ''", [], (err, stores) => {
    if (err) {
        console.error("Error fetching stores:", err);
        db.close();
        process.exit(1);
    }
    
    if (stores.length === 0) {
        console.log("✅ All stores already have QR codes!");
        db.close();
        process.exit(0);
    }
    
    console.log(`Found ${stores.length} store(s) without QR codes. Generating...\n`);
    
    let completed = 0;
    let errors = 0;
    
    stores.forEach((store) => {
        // Use phone if available, otherwise email, otherwise store ID
        const cleanedPhone = store.phone ? store.phone.replace(/\D/g, '') : null;
        const qrIdentifier = cleanedPhone || (store.email ? store.email.replace(/[^a-zA-Z0-9]/g, '') : `STORE${store.id}`);
        const qrCode = generateQRCode("STORE", qrIdentifier);
        
        db.run(
            "UPDATE stores SET qr_code = ? WHERE id = ?",
            [qrCode, store.id],
            function(err2) {
                if (err2) {
                    console.error(`❌ Error updating store ${store.id}:`, err2.message);
                    errors++;
                } else {
                    console.log(`✅ Generated QR code for store ${store.id} (${store.name || store.email || store.phone || 'Unknown'})`);
                    console.log(`   QR Code: ${qrCode}`);
                    completed++;
                }
                
                // Close when all done
                if (completed + errors === stores.length) {
                    console.log(`\n✅ Completed! Generated ${completed} QR code(s), ${errors} error(s)`);
                    db.close();
                    process.exit(errors > 0 ? 1 : 0);
                }
            }
        );
    });
});
