// Migration script to add physical gift card support
const db = require("./db");


const migrations = [
    // Add card_type and issued_at fields to gift_cards
    `ALTER TABLE gift_cards ADD COLUMN card_type TEXT DEFAULT 'digital'`,
    // 'digital' = QR code in app, 'physical' = physical card issued by store
    
    `ALTER TABLE gift_cards ADD COLUMN issued_at DATETIME`,
    // When physical card was issued
    
    `ALTER TABLE gift_cards ADD COLUMN issued_by_store_id INTEGER`,
    // Store that issued the physical card
    
    `ALTER TABLE gift_cards ADD COLUMN issued_by_user_id INTEGER`,
    // Store user/staff who issued it
    
    `CREATE INDEX IF NOT EXISTS idx_gift_cards_type ON gift_cards(card_type, status)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_cards_store_issued ON gift_cards(issued_by_store_id, card_type)`
];

// Run migrations sequentially
function runMigrations(index) {
    if (index >= migrations.length) {
        process.exit(0);
        return;
    }
    
    const sql = migrations[index];
    db.run(sql, (err) => {
        if (err) {
            // Ignore "duplicate column" errors (column already exists)
            if (err.message.includes("duplicate column")) {
                runMigrations(index + 1);
            } else {
                process.exit(1);
            }
        } else {
            runMigrations(index + 1);
        }
    });
}

// Start migrations
runMigrations(0);


