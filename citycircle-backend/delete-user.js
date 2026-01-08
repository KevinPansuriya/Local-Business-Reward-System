// Script to delete a user by phone number
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "citycircle.db");
const db = new sqlite3.Database(dbPath);

// Get phone number from command line argument
const phoneNumber = process.argv[2];

if (!phoneNumber) {
    console.error("Usage: node delete-user.js <phone-number>");
    console.error("Example: node delete-user.js 5513238806");
    process.exit(1);
}

const cleanedPhone = phoneNumber.replace(/\D/g, '');

console.log(`Looking for user with phone number: ${cleanedPhone}`);

// First, find the user
db.get("SELECT id, name, phone, email FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
    if (err) {
        console.error("Error finding user:", err);
        db.close();
        process.exit(1);
    }
    
    if (!user) {
        console.log(`No user found with phone number: ${cleanedPhone}`);
        db.close();
        process.exit(0);
    }
    
    console.log("\nFound user:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Phone: ${user.phone}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    
    // Delete WebAuthn credentials first (foreign key constraint)
    db.run("DELETE FROM webauthn_credentials WHERE user_id = ?", [user.id], (err) => {
        if (err) {
            console.error("Error deleting WebAuthn credentials:", err);
        } else {
            console.log("\nDeleted WebAuthn credentials (if any)");
        }
        
        // Delete password reset tokens (if table exists)
        db.run("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting password reset tokens:", err);
            }
            
            // Delete loops ledger entries
            db.run("DELETE FROM loops_ledger WHERE user_id = ?", [user.id], (err) => {
                if (err) {
                    console.error("Error deleting loops ledger:", err);
                }
                
                // Delete transactions
                db.run("DELETE FROM transactions WHERE user_id = ?", [user.id], (err) => {
                    if (err) {
                        console.error("Error deleting transactions:", err);
                    }
                    
                    // Finally, delete the user
                    db.run("DELETE FROM users WHERE id = ?", [user.id], function(err) {
                        if (err) {
                            console.error("Error deleting user:", err);
                            db.close();
                            process.exit(1);
                        }
                        
                        console.log(`\n✅ Successfully deleted user with phone number: ${cleanedPhone}`);
                        console.log(`   Deleted ${this.changes} user record(s)`);
                        db.close();
                        process.exit(0);
                    });
                });
            });
        });
    });
});
