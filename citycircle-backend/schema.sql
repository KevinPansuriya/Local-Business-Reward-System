-- Users (customers)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,              -- Primary identifier (phone number)
  email TEXT,                               -- Optional email
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,                             -- Customer address
  dob TEXT,                                 -- Date of birth (YYYY-MM-DD)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
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
  phone_verified INTEGER DEFAULT 1,          -- Phone verification status (phone is primary for customers)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  signup_source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
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
  opened_month INTEGER,          -- 1-12
  opened_year INTEGER,           -- YYYY
  latitude REAL,                 -- store latitude (optional for now)
  longitude REAL,                -- store longitude (optional for now)
  address TEXT,                  -- Store address
  profile_image_url TEXT,        -- Store profile image
  place_id TEXT,                 -- Google Place ID (optional)
  claim_code TEXT,               -- One-time claim code (owner verification)
  claimed_at DATETIME,           -- When the store was claimed by an owner
  is_local INTEGER NOT NULL DEFAULT 1,  -- Local-only flag (1 = local, 0 = chain)
  qr_code TEXT UNIQUE,           -- Unique QR code identifier for store
  email_verified INTEGER DEFAULT 0,  -- Email verification status
  phone_verified INTEGER DEFAULT 0,  -- Phone verification status
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  signup_source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

-- Store promotions (discounts/deals)
CREATE TABLE IF NOT EXISTS store_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  media_urls TEXT,              -- JSON array of media URLs
  discount_type TEXT NOT NULL, -- percent | fixed | bogo | free_item
  discount_value REAL,
  start_at DATETIME,
  end_at DATETIME,
  status TEXT NOT NULL DEFAULT 'active', -- active | scheduled | expired
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store updates (major announcements)
CREATE TABLE IF NOT EXISTS store_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_urls TEXT,              -- JSON array of media URLs
  pinned INTEGER NOT NULL DEFAULT 0,
  start_at DATETIME,
  end_at DATETIME,
  status TEXT NOT NULL DEFAULT 'active', -- active | archived
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store posts (local social feed)
CREATE TABLE IF NOT EXISTS store_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  post_type TEXT NOT NULL, -- text | image | video
  caption TEXT NOT NULL,
  media_url TEXT,
  media_urls TEXT,              -- JSON array of media URLs
  start_at DATETIME,
  end_at DATETIME,
  status TEXT NOT NULL DEFAULT 'active', -- active | archived
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_content_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content_type TEXT NOT NULL, -- promotion | update | post
  content_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_type, content_id),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Store slots (plan-based active stores per cycle)
CREATE TABLE IF NOT EXISTS store_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  cycle_month TEXT NOT NULL,        -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'active',
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, store_id, cycle_month),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Store offers (reward tier, lock rules, unlock costs)
CREATE TABLE IF NOT EXISTS store_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL UNIQUE,
  reward_tier TEXT NOT NULL DEFAULT 'standard',
  reward_points INTEGER NOT NULL DEFAULT 0,
  unlock_cost_cents INTEGER NOT NULL DEFAULT 0,
  unlock_cost_loops INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  min_plan TEXT NOT NULL DEFAULT 'STARTER',
  news TEXT NOT NULL DEFAULT 'No updates yet.',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store-specific reward profile overrides (optional)
CREATE TABLE IF NOT EXISTS store_reward_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL UNIQUE,
  max_rewarded_visits_per_day INTEGER,
  cooldown_minutes INTEGER,
  min_dwell_minutes INTEGER,
  base_points INTEGER,
  pending_ratio REAL,
  dvs_expiry_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store reward point schedules (holiday/festival/rush overrides)
CREATE TABLE IF NOT EXISTS store_reward_point_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  reason TEXT,
  mode TEXT NOT NULL DEFAULT 'fixed', -- fixed | multiplier
  fixed_points INTEGER,
  multiplier REAL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store reward automation preferences
CREATE TABLE IF NOT EXISTS store_reward_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL UNIQUE,
  automation_mode TEXT NOT NULL DEFAULT 'auto', -- auto | guided | manual
  weekly_digest_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store owner actions for US holiday reward reminders
CREATE TABLE IF NOT EXISTS store_reward_holiday_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  holiday_id TEXT NOT NULL,
  holiday_date TEXT NOT NULL, -- YYYY-MM-DD
  action TEXT NOT NULL, -- auto_applied | manual_later | skipped | auto_mode_applied
  reminder_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, holiday_id, holiday_date),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Store unlocks (per user + cycle)
CREATE TABLE IF NOT EXISTS store_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  cycle_month TEXT NOT NULL,
  unlock_method TEXT NOT NULL, -- loops | money
  unlock_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, store_id, cycle_month),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Store memberships (customers who added/paid for a store in a cycle)
CREATE TABLE IF NOT EXISTS store_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  cycle_month TEXT NOT NULL,
  join_method TEXT NOT NULL, -- free | paid
  paid_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, store_id, cycle_month),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
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

-- Password reset tokens (SMS codes)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_type TEXT NOT NULL, -- 'user' | 'store'
  user_id INTEGER NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  request_id TEXT,
  expires_at DATETIME NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- Customer requests for stores not yet onboarded
CREATE TABLE IF NOT EXISTS store_onboarding_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  requested_store_ref TEXT,
  requested_store_name TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Missing reward reports (customer expected reward but didn't get it)
CREATE TABLE IF NOT EXISTS missing_reward_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER,
  store_name TEXT NOT NULL,
  store_address TEXT,
  visit_date DATE,
  visit_time TEXT,
  note TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  admin_note TEXT,
  reviewed_by_admin_id INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
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
CREATE INDEX IF NOT EXISTS idx_store_offers_store ON store_offers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_reward_schedules_store_time ON store_reward_point_schedules(store_id, is_active, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_store_reward_preferences_store ON store_reward_preferences(store_id);
CREATE INDEX IF NOT EXISTS idx_store_reward_holiday_actions_store ON store_reward_holiday_actions(store_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_store_onboarding_requests_user ON store_onboarding_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_missing_reward_reports_user ON missing_reward_reports(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_missing_reward_reports_status ON missing_reward_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_store_unlocks_user_cycle ON store_unlocks(user_id, cycle_month);

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

-- Analytics events (tracking: funnel, UTM, signup, first_checkin, store_claimed, store_request)
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  actor_type TEXT,
  actor_id INTEGER,
  session_id TEXT,
  payload TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor ON analytics_events(actor_type, actor_id);

-- Admin email log (optional: audit of admin notification emails)
CREATE TABLE IF NOT EXISTS admin_email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  subject TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
