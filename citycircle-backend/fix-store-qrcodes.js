// Script to fix existing store QR codes to use store ID instead of phone/email
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "citycircle.db");
const db = new sqlite3.Database(dbPath);

function generateQRCode(prefix, id) {
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}:${id}:${random}`;
}


db.all("SELECT id, name, qr_code FROM stores", [], (err, stores) => {
    if (err) {
        db.close();
        process.exit(1);
    }
    
    if (stores.length === 0) {
        db.close();
        process.exit(0);
    }
    
    let completed = 0;
    let errors = 0;
    
    stores.forEach((store) => {
        // Check if QR code already uses store ID format
        const parts = store.qr_code ? store.qr_code.split(':') : [];
        if (parts.length >= 2 && parts[1] === store.id.toString()) {
            completed++;
            if (completed + errors === stores.length) {
                finish();
            }
            return;
        }
        
        // Generate new QR code with store ID
        const newQrCode = generateQRCode("STORE", store.id.toString());
        
        db.run(
            "UPDATE stores SET qr_code = ? WHERE id = ?",
            [newQrCode, store.id],
            function(updateErr) {
                if (updateErr) {
                    errors++;
                } else {
                    completed++;
                }
                
                if (completed + errors === stores.length) {
                    finish();
                }
            }
        );
    });
    
    function finish() {
        db.close();
        process.exit(errors > 0 ? 1 : 0);
    }
});


