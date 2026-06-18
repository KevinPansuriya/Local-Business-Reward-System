// Migration script to add gift card tables
const db = require("./db");


const migrations = [
    // Gift Cards table
    `CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      store_id INTEGER,
      original_value REAL NOT NULL,
      current_balance REAL NOT NULL,
      loops_used INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )`,
    
    // Gift Card Transactions
    `CREATE TABLE IF NOT EXISTS gift_card_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gift_card_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      loops_used INTEGER,
      cash_amount REAL,
      description TEXT,
      store_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )`,
    
    // Gift Card Transfers
    `CREATE TABLE IF NOT EXISTS gift_card_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gift_card_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER,
      transfer_code TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME,
      FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_gift_cards_user ON gift_cards(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_card_txns ON gift_card_transactions(gift_card_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_card_transfers ON gift_card_transfers(transfer_code, status)`
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
            process.exit(1);
        } else {
            runMigrations(index + 1);
        }
    });
}

// Start migrations
runMigrations(0);


