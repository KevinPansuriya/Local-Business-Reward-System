// citycircle-backend/migrations/add-category-profiles.js
const db = require('../db');


db.serialize(() => {
    // Create category_profiles table
    db.run(`
        CREATE TABLE IF NOT EXISTS category_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE NOT NULL,
            max_rewarded_visits_per_day INTEGER NOT NULL DEFAULT 1,
            cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
            min_dwell_minutes INTEGER NOT NULL DEFAULT 3,
            base_points INTEGER NOT NULL DEFAULT 10,
            pending_ratio REAL NOT NULL DEFAULT 1.0,
            dvs_expiry_days INTEGER NOT NULL DEFAULT 7,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            process.exit(1);
        }
    });
    
    // Insert default profiles
    const profiles = [
        ['liquor', 3, 60, 1, 8, 0.8, 7],
        ['convenience', 3, 60, 1, 8, 0.8, 7],
        ['gas', 2, 120, 2, 8, 0.8, 7],
        ['grocery', 2, 180, 3, 10, 0.7, 7],
        ['pharmacy', 2, 180, 5, 10, 0.7, 7],
        ['coffee', 2, 120, 3, 10, 0.7, 7],
        ['cafe', 2, 120, 3, 10, 0.7, 7],
        ['barber', 1, 20160, 15, 15, 0.6, 14],  // 14 days = 20160 minutes
        ['nail', 1, 20160, 20, 15, 0.6, 14],
        ['salon', 1, 20160, 30, 15, 0.6, 14],
        ['laundromat', 2, 60, 15, 10, 0.7, 7],
        ['restaurant', 1, 240, 10, 12, 0.7, 7],
        ['food', 1, 240, 10, 12, 0.7, 7],
        ['other', 1, 1440, 3, 10, 0.7, 7]  // Default fallback
    ];
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO category_profiles 
        (category, max_rewarded_visits_per_day, cooldown_minutes, min_dwell_minutes, base_points, pending_ratio, dvs_expiry_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    profiles.forEach((profile, index) => {
        stmt.run(profile, (err) => {
            if (err && !err.message.includes('UNIQUE constraint')) {
            } else if (!err) {
            }
            
            // Finalize on last profile
            if (index === profiles.length - 1) {
                stmt.finalize(() => {
                    // Add check_in_method to check_in_sessions if not exists
                    db.run(`
                        ALTER TABLE check_in_sessions 
                        ADD COLUMN check_in_method TEXT DEFAULT 'qr'
                    `, (err) => {
                        if (err && !err.message.includes('duplicate column')) {
                        } else if (!err) {
                        }
                        
                        // Add NFC fields to stores if not exists
                        db.run(`
                            ALTER TABLE stores 
                            ADD COLUMN nfc_tag_id TEXT
                        `, (err) => {
                            if (err && !err.message.includes('duplicate column')) {
                            } else if (!err) {
                            }
                            
                            db.run(`
                                ALTER TABLE stores 
                                ADD COLUMN nfc_deep_link TEXT
                            `, (err) => {
                                if (err && !err.message.includes('duplicate column')) {
                                } else if (!err) {
                                }
                                
                                // Create index
                                db.run(`
                                    CREATE INDEX IF NOT EXISTS idx_category_profiles_category 
                                    ON category_profiles(category)
                                `, (err) => {
                                    if (err) {
                                    } else {
                                    }
                                    
                                    process.exit(0);
                                });
                            });
                        });
                    });
                });
            }
        });
    });
});


