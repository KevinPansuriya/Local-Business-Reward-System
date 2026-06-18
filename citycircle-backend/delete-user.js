// Script to delete a user by phone number
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "citycircle.db");
const db = new sqlite3.Database(dbPath);

// Get phone number from command line argument
const phoneNumber = process.argv[2];

if (!phoneNumber) {
    process.exit(1);
}

const cleanedPhone = phoneNumber.replace(/\D/g, '');


// First, find the user
db.get("SELECT id, name, phone, email FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
    if (err) {
        db.close();
        process.exit(1);
    }
    
    if (!user) {
        db.close();
        process.exit(0);
    }
    
    
    // Delete WebAuthn credentials first (foreign key constraint)
    db.run("DELETE FROM webauthn_credentials WHERE user_id = ?", [user.id], (err) => {
        if (err) {
        } else {
        }
        
        // Delete password reset tokens (if table exists)
        db.run("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
            
            // Delete loops ledger entries
            db.run("DELETE FROM loops_ledger WHERE user_id = ?", [user.id], (err) => {
                if (err) {
                }
                
                // Delete transactions
                db.run("DELETE FROM transactions WHERE user_id = ?", [user.id], (err) => {
                    if (err) {
                    }
                    
                    // Finally, delete the user
                    db.run("DELETE FROM users WHERE id = ?", [user.id], function(err) {
                        if (err) {
                            db.close();
                            process.exit(1);
                        }
                        
                        db.close();
                        process.exit(0);
                    });
                });
            });
        });
    });
});


