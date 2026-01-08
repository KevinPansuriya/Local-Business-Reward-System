-- Users (customers)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,              -- Primary identifier (phone number)
  email TEXT,                               -- Optional email
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,                             -- Customer address
  latitude REAL,                            -- Customer location (for nearby stores)
  longitude REAL,
  primary_zone TEXT,
  secondary_zone TEXT,
  plan TEXT NOT NULL DEFAULT 'STARTER',
  loops_balance INTEGER NOT NULL DEFAULT 0,      -- current Loops wallet
  total_loops_earned INTEGER NOT NULL DEFAULT 0,  -- for tier calculation
  qr_code TEXT UNIQUE,                      -- Unique QR code identifier
  location_set BOOLEAN NOT NULL DEFAULT 0,   -- Whether location has been set
  email_verified INTEGER DEFAULT 0,          -- Email verification status
  phone_verified INTEGER DEFAULT 1           -- Phone verification status (phone is primary for customers)
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,                               -- Store email (optional - email OR phone required)
  phone TEXT,                               -- Store phone number (optional - email OR phone required)
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  category TEXT NOT NULL,        -- coffee, grocery, etc.
  base_discount_percent INTEGER NOT NULL DEFAULT 0,
  latitude REAL,                 -- store latitude (optional for now)
  longitude REAL,                -- store longitude (optional for now)
  address TEXT,                  -- Store address
  qr_code TEXT UNIQUE,           -- Unique QR code identifier for store
  email_verified INTEGER DEFAULT 0,  -- Email verification status
  phone_verified INTEGER DEFAULT 0   -- Phone verification status
);

-- Admins (for platform management)
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- Transactions (per purchase)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  loops_earned INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Loops ledger (earn & redeem)
CREATE TABLE IF NOT EXISTS loops_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  change_type TEXT NOT NULL,      -- 'EARN' or 'REDEEM'
  amount INTEGER NOT NULL,        -- Loops +/- change
  meta TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- WebAuthn credentials for facial recognition (customers only)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,  -- Base64 encoded credential ID
  public_key TEXT NOT NULL,            -- JSON string of public key
  counter INTEGER NOT NULL DEFAULT 0,  -- Signature counter
  device_name TEXT,                    -- Optional: device name for user reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Check-in sessions (for CIV + DVS hybrid system)
CREATE TABLE IF NOT EXISTS check_in_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired', 'cancelled'
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Location history for CIV (Consumption-Intent Verification)
CREATE TABLE IF NOT EXISTS location_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES check_in_sessions(id) ON DELETE CASCADE
);

-- Pending points (DVS - Delayed Value Settlement)
CREATE TABLE IF NOT EXISTS pending_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  session_id INTEGER, -- Link to check-in session
  loops_pending INTEGER NOT NULL,
  loops_unlocked INTEGER DEFAULT 0,
  civ_score REAL DEFAULT 0.5, -- CIV confidence score (0.0 to 1.0)
  status TEXT DEFAULT 'pending', -- 'pending', 'unlocked', 'expired', 'downgraded'
  unlock_trigger TEXT, -- 'return_visit', 'reward_redemption', 'offer_engagement', 'related_visit', 'another_purchase'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- 7 days from creation
  unlocked_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (session_id) REFERENCES check_in_sessions(id)
);

-- Settlement triggers (track what unlocked points)
CREATE TABLE IF NOT EXISTS settlement_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pending_points_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL, -- 'return_visit', 'reward_redemption', 'offer_engagement', 'related_visit', 'another_purchase'
  trigger_data TEXT, -- JSON with details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pending_points_id) REFERENCES pending_points(id)
);

-- Gift Cards (Digital and Physical Gift Cards with 90-day validity)
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,              -- GC-ABC123XYZ
  user_id INTEGER NOT NULL,                -- Owner
  store_id INTEGER,                        -- NULL = any store, or specific store
  original_value REAL NOT NULL,            -- Initial value ($5.00)
  current_balance REAL NOT NULL,           -- Current balance ($5.00)
  loops_used INTEGER,                     -- Points used to create (1000 Loops)
  status TEXT DEFAULT 'active',           -- 'active', 'used', 'expired', 'cancelled'
  card_type TEXT DEFAULT 'digital',       -- 'digital' = QR code in app, 'physical' = physical card issued by store
  issued_at DATETIME,                     -- When physical card was issued (NULL = not issued yet)
  issued_by_store_id INTEGER,             -- Store that issued the physical card
  issued_by_user_id INTEGER,              -- Store user/staff who issued it
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,                     -- 90 days from creation
  used_at DATETIME,                        -- When fully used
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (issued_by_store_id) REFERENCES stores(id),
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
);

-- Gift Card Transactions (top-ups, usage, refunds)
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_card_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,          -- 'create', 'topup', 'usage', 'refund'
  amount REAL NOT NULL,                    -- +$10 (topup) or -$5 (usage)
  payment_method TEXT,                     -- 'points', 'cash', 'card', 'combined'
  loops_used INTEGER,                      -- If paid with points
  cash_amount REAL,                        -- If paid with cash
  description TEXT,                        -- "Top-up", "Purchase at Grove Coffee"
  store_id INTEGER,                        -- Store where used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Gift Card Transfers (gifting to others)
CREATE TABLE IF NOT EXISTS gift_card_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_card_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER,                      -- NULL if transferred via code
  transfer_code TEXT UNIQUE,                -- Code to claim gift card
  status TEXT DEFAULT 'pending',           -- 'pending', 'claimed', 'expired'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at DATETIME,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_in_active ON check_in_sessions(store_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_check_in_user ON check_in_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_location_session ON location_history(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_points(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_store ON pending_points(store_id, status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_user ON gift_cards(user_id, status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_card_txns ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transfers ON gift_card_transfers(transfer_code, status);

-- Store Customer Blacklist (stores can block customers)
CREATE TABLE IF NOT EXISTS store_customer_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reason TEXT,
  blocked_by_store_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_by_store_id) REFERENCES stores(id),
  UNIQUE(store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_store ON store_customer_blacklist(store_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_user ON store_customer_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_store_user ON store_customer_blacklist(store_id, user_id);
