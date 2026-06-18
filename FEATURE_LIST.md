# CityCircle Feature List - Complete Documentation with Detailed Specifications
**The Trusted Circle for Local Shops.**

## 📋 Table of Contents
1. [Currently Implemented Features](#currently-implemented-features)
2. [Planned Future Features](#planned-future-features)
3. [Feature Roadmap Timeline](#feature-roadmap-timeline)
4. [Feature Details & Specifications](#feature-details--specifications)

---

## 📖 How to Use This Document

This document provides:
- **Feature Overview**: What the feature does
- **How It Works**: Technical implementation details
- **Use Cases**: Real-world scenarios
- **Business Value**: Why it matters
- **User Experience**: How users interact with it
- **Technical Details**: Implementation considerations

---

## ✅ Currently Implemented Features

### 🔐 Authentication & User Management

#### Customer (User) Features

##### ✅ Phone-Based Authentication (Primary Identifier)
**Overview**: Phone number is the primary identifier for customers, making it easy to sign up and login.

**How It Works**:
- Customer enters phone number (10 digits max)
- System validates format and uniqueness
- Password is hashed with bcrypt before storage
- Phone number stored as unique identifier in database
- Phone verification status tracked (phone_verified = 1 by default)

**Use Cases**:
- Quick signup: Customer enters phone + password, no email required
- Easy login: Remember phone number, enter password
- Account recovery: Reset password via phone number

**Business Value**:
- Lower barrier to entry (no email required)
- Faster signup process
- Better for local customers who prefer phone

**Technical Details**:
- Phone stored as TEXT in database
- UNIQUE constraint prevents duplicates
- Validation: Max 10 digits, numeric only
- Indexed for fast lookups

---

##### ✅ Email Authentication (Optional)
**Overview**: Email is optional secondary identifier for account recovery and notifications.

**How It Works**:
- Customer can add email during signup or later
- Email stored separately from phone
- Email verification status tracked (email_verified = 0 by default)
- Can be used for password reset if provided

**Use Cases**:
- Account recovery: Reset password via email
- Notifications: Receive promotional emails
- Account linking: Link multiple devices

**Business Value**:
- Additional account recovery option
- Marketing channel (email campaigns)
- Better user experience (multiple recovery methods)

**Technical Details**:
- Email stored as TEXT (nullable)
- No UNIQUE constraint (optional field)
- Email validation regex pattern
- Verification status tracked separately

---

##### ✅ Password-Based Login/Signup
**Overview**: Standard password authentication with secure hashing.

**How It Works**:
- Signup: Customer provides phone, password, name
- Password hashed with bcrypt (10 rounds)
- Login: Verify phone + password combination
- JWT token issued on successful login
- Token stored in browser localStorage

**Use Cases**:
- Daily login: Customer opens app, enters credentials
- Secure access: Password protects account
- Multi-device: Login from phone, tablet, computer

**Business Value**:
- Secure authentication
- Industry-standard security
- User-friendly (familiar pattern)

**Technical Details**:
- bcrypt hashing (10 salt rounds)
- Password never stored in plain text
- JWT token expires in 7 days
- Token refresh mechanism available

---

##### ✅ JWT Token Authentication (7-Day Expiry)
**Overview**: JSON Web Tokens provide stateless authentication with automatic expiry.

**How It Works**:
- Token generated on login (contains user_id, role, phone)
- Token signed with JWT_SECRET
- Token sent in Authorization header: `Bearer <token>`
- Middleware validates token on each request
- Token expires after 7 days, requires re-login

**Use Cases**:
- API requests: All authenticated requests include token
- Session management: Token represents user session
- Security: Token can be revoked if compromised

**Business Value**:
- Stateless authentication (no server-side sessions)
- Scalable (works across multiple servers)
- Secure (signed tokens prevent tampering)

**Technical Details**:
- JWT library: jsonwebtoken
- Secret key: JWT_SECRET from environment
- Expiry: 7 days (configurable)
- Token payload: { userId, role, phone, iat, exp }

---

##### ✅ User Profile Management
**Overview**: Customers can view and edit their profile information.

**How It Works**:
- Profile fields: name, email, address
- GET /api/users/me: Fetch current user profile
- PUT /api/users/profile: Update profile fields
- Changes saved to database immediately
- Profile displayed in Settings tab

**Use Cases**:
- Update name: Customer changes name after marriage
- Add email: Customer adds email for notifications
- Change address: Customer moves to new location

**Business Value**:
- Better customer data (accurate information)
- Improved personalization (use name in communications)
- Marketing opportunities (email for campaigns)

**Technical Details**:
- Profile stored in `users` table
- Updates validated before saving
- Address can include full address string
- Changes logged for audit trail

---

##### ✅ Location-Based User Registration
**Overview**: User location (latitude/longitude) captured during registration for nearby store discovery.

**How It Works**:
- Browser requests location permission
- Geolocation API gets coordinates
- Location stored in `users` table (latitude, longitude)
- `location_set` flag tracks if location provided
- Location used for nearby stores API

**Use Cases**:
- Nearby stores: Show stores within 5 miles
- Zone assignment: Auto-assign zone based on location
- Personalized experience: Show relevant local stores

**Business Value**:
- Better store discovery (show nearby stores)
- Zone targeting (assign to correct zone)
- Local relevance (show neighborhood businesses)

**Technical Details**:
- Browser Geolocation API
- Coordinates stored as REAL (floating point)
- Location permission requested on first use
- Fallback: Manual address entry if permission denied

---

##### ✅ Zone Assignment (Primary & Secondary Zones)
**Overview**: Users assigned to geographic zones for localized experiences and promotions.

**How It Works**:
- Zone determined from user location or address
- `primary_zone`: Main zone (e.g., "Downtown")
- `secondary_zone`: Adjacent zone (e.g., "Midtown")
- Zones used for store filtering and promotions
- Zone-based analytics and leaderboards

**Use Cases**:
- Zone promotions: "Visit 3 stores in Downtown, get bonus"
- Store discovery: Show stores in user's zone first
- Community building: Connect users in same zone

**Business Value**:
- Local targeting (relevant promotions)
- Community building (zone-based features)
- Better engagement (local relevance)

**Technical Details**:
- Zones stored as TEXT in database
- Zone names: "Downtown", "Midtown", "Uptown", etc.
- Zone assignment: Automatic from location or manual
- Zone-based queries for filtering

---

##### ✅ User QR Code Generation
**Overview**: Each user gets unique QR code for checkout at stores.

**How It Works**:
- QR code generated on user creation: `USER:{userId}:{random}`
- Code stored in `users.qr_code` (UNIQUE)
- QR code displayed in Wallet tab
- Store scans code to identify customer
- Code never changes (permanent identifier)

**Use Cases**:
- Checkout: Customer shows QR at store
- Quick identification: Store scans to find customer
- Account linking: Link visit to customer account

**Business Value**:
- Fast checkout (scan vs. manual entry)
- Accurate identification (unique code)
- Better UX (no typing required)

**Technical Details**:
- Format: `USER:{id}:{8-byte hex}`
- Generated with crypto.randomBytes
- UNIQUE constraint prevents duplicates
- Displayed using qrcode.react library

---

##### ✅ Plan Tier System (STARTER, BASIC, PLUS, PREMIUM)
**Overview**: Customer subscription tiers determine loop multipliers and benefits.

**How It Works**:
- Default plan: STARTER (free tier)
- Plans: STARTER, BASIC, PLUS, PREMIUM
- Plan stored in `users.plan` field
- Plan determines loop multiplier (1.0x - 1.2x)
- GET /api/users/plan-tier: Fetch current plan

**Use Cases**:
- Free tier: STARTER (1.0x multiplier)
- Paid tiers: BASIC/PLUS/PREMIUM (higher multipliers)
- Upgrade path: Customer upgrades for more benefits

**Business Value**:
- Revenue generation (paid tiers)
- Customer segmentation (tier-based features)
- Upsell opportunities (upgrade prompts)

**Technical Details**:
- Plan enum: STARTER, BASIC, PLUS, PREMIUM
- Multipliers: 1.0x, 1.1x, 1.15x, 1.2x
- Plan checked on loop earning
- Future: Stripe integration for paid plans

---

##### ✅ WebAuthn Facial Recognition
**Overview**: Biometric authentication using WebAuthn standard for passwordless login.

**How It Works**:
- Registration: User registers face/device
- Challenge-response: Server sends challenge, device responds
- Public key cryptography: Private key on device, public key on server
- Authentication: User authenticates with face/Touch ID
- Credentials stored in `webauthn_credentials` table

**Use Cases**:
- Passwordless login: Authenticate with face/Touch ID
- Quick access: No password typing required
- Security: Biometric is more secure than password

**Business Value**:
- Better UX (faster login)
- Higher security (biometric)
- Modern authentication (industry standard)

**Technical Details**:
- Library: @simplewebauthn/server
- Credential storage: Base64 encoded
- Counter tracking: Prevents replay attacks
- Device name: User can name device
- Multiple devices: User can register multiple devices

---

##### ✅ WebAuthn Credential Management
**Overview**: Users can view and delete registered WebAuthn credentials.

**How It Works**:
- GET /api/users/webauthn/status: List all credentials
- DELETE /api/users/webauthn/credentials/:id: Remove credential
- Credentials shown with device name and last used date
- User can remove lost/stolen devices

**Use Cases**:
- Lost device: Remove credential from lost phone
- New device: Register new device, remove old
- Security: Remove suspicious device

**Business Value**:
- Security (remove compromised devices)
- User control (manage own devices)
- Better UX (clear device list)

**Technical Details**:
- Credentials linked to user_id
- Cascade delete: Removed when user deleted
- Last used tracking: Shows when last authenticated
- Device name: User-friendly identifier

---

##### ✅ Password Reset Functionality
**Overview**: Customers can reset forgotten passwords via email or phone.

**How It Works**:
- Forgot password: User requests reset
- Reset token generated (time-limited)
- Token sent via email/SMS
- User clicks link, enters new password
- Token validated, password updated

**Use Cases**:
- Forgotten password: Customer can't remember password
- Account recovery: Regain access to account
- Security: Change password after suspected breach

**Business Value**:
- Reduced support tickets (self-service)
- Better UX (easy recovery)
- Security (password reset capability)

**Technical Details**:
- Reset token: Crypto random string
- Token expiry: 1 hour (configurable)
- Token stored in database temporarily
- Password hashed before saving

#### Store Features
- ✅ **Email or phone-based authentication**
- ✅ **Store signup/login**
- ✅ **Store profile management** (name, category, zone, address)
- ✅ **Store QR code generation** (unique per store)
- ✅ **Store location management** (latitude/longitude, address)
- ✅ **Store discount configuration** (base_discount_percent)
- ✅ **Password reset functionality**

#### Admin Features
- ✅ **Admin authentication** (email-based)
- ✅ **Admin signup/login**
- ✅ **Admin dashboard**
- ✅ **User management** (view, edit, delete users)
- ✅ **Store management** (view, edit, delete stores)
- ✅ **System-wide analytics**

---

### 📍 Location & Check-In System

#### Check-In Features
- ✅ **QR code scanning** (scan store QR to check in)
- ✅ **Check-in session management** (active, completed, expired, cancelled)
- ✅ **24-hour cooldown** (one check-in per day per store)
- ✅ **Location tracking during check-in** (latitude/longitude)
- ✅ **Real-time location updates** (during active session)
- ✅ **Session expiry** (30-minute active sessions)
- ✅ **Check-in completion** (manual completion with CIV calculation)

#### Location Features
- ✅ **Geolocation API integration** (browser-based)
- ✅ **Location permission handling**
- ✅ **Location history tracking** (for CIV analysis)
- ✅ **Nearby stores discovery** (based on user location)
- ✅ **Store location display** (on map/list view)
- ✅ **Zone-based store organization**

---

### 🎁 Reward System (Loops)

#### Loop Earning
- ✅ **Visit-based loop earning** (not purchase-based)
- ✅ **Base loop calculation** (10 loops per check-in)
- ✅ **Plan tier multipliers** (1.0x - 1.2x based on plan)
- ✅ **Tier-based multipliers** (Bronze/Silver/Gold/Platinum)
- ✅ **Pending points system** (DVS - Delayed Value Settlement)
- ✅ **Point unlocking triggers**:
  - ✅ Return visit (within 7 days)
  - ✅ Reward redemption
  - ✅ Related visit (same category)
  - ✅ Offer engagement
- ✅ **Point expiration** (7-day expiry if not unlocked)
- ✅ **Automatic settlement** (checked every 5 minutes)
- ✅ **Manual settlement check** (API endpoint)

#### CIV (Consumption-Intent Verification)
- ✅ **Behavioral analysis** (location dwell curve, proximity, duration)
- ✅ **CIV score calculation** (0.0 to 1.0 confidence)
- ✅ **Point adjustment based on CIV**:
  - High confidence (≥0.8): Full points
  - Medium confidence (0.6-0.8): 70% of points
  - Low confidence (<0.6): 30% of points
- ✅ **Location pattern analysis** (movement, stops, shopping behavior)
- ✅ **Visit duration matching** (category-based patterns)

#### Loop Redemption
- ✅ **Loop redemption at stores** (redeem loops for discounts)
- ✅ **Redemption amount validation**
- ✅ **Balance checking** (before redemption)
- ✅ **Redemption history** (transaction log)
- ✅ **Real-time balance updates**

#### Loop Management
- ✅ **Loop balance tracking** (current balance)
- ✅ **Total loops earned** (lifetime tracking)
- ✅ **Loops ledger** (earn & redeem history)
- ✅ **Tier calculation** (based on total_loops_earned):
  - BRONZE: 0-199 loops (1.0x multiplier)
  - SILVER: 200-499 loops (1.05x multiplier)
  - GOLD: 500-999 loops (1.1x multiplier)
  - PLATINUM: 1000+ loops (1.2x multiplier)

---

### 💳 Gift Card System

#### Digital Gift Cards
- ✅ **Gift card creation** (from loops)
- ✅ **Minimum requirement** (1000 loops to create)
- ✅ **Gift card QR codes** (unique per card)
- ✅ **Gift card balance tracking**
- ✅ **Gift card top-up** (add more value)
- ✅ **90-day validity** (automatic expiry)
- ✅ **Gift card status** (active, used, expired, cancelled)
- ✅ **Gift card eligibility check** (shows if eligible)
- ✅ **Gift card details view** (balance, expiry, days remaining)
- ✅ **Gift card transaction history**

#### Physical Gift Cards
- ✅ **Physical gift card issuance** (by stores)
- ✅ **Pending physical gift cards** (awaiting issuance)
- ✅ **Store can issue physical cards** (from pending list)
- ✅ **Physical card tracking** (issued_by_store, issued_at)

#### Gift Card Usage
- ✅ **Gift card scanning** (store scans customer's gift card QR)
- ✅ **Gift card application** (apply to purchase)
- ✅ **Partial usage** (use part of gift card balance)
- ✅ **Gift card transfers** (gifting to others - database ready)
- ✅ **Transfer codes** (for claiming gifted cards)

---

### 📊 Analytics & Reporting

#### Customer Analytics
- ✅ **Personal dashboard** (loops balance, visit history)
- ✅ **Transaction history** (date & time, store, loops earned)
- ✅ **Store performance view** (visits, loops earned per store)
- ✅ **Visit frequency tracking** (daily, weekly, monthly, yearly)
- ✅ **Store visit history** (detailed per-store breakdown)
- ✅ **Analytics dashboard** (KPIs, charts, trends)

#### Store Analytics
- ✅ **Store dashboard** (customers today, stats)
- ✅ **Customers today view** (date & time, customer info, visits, loops)
- ✅ **Visit metrics**:
  - ✅ Total visits
  - ✅ Visits today
  - ✅ Visits this week
  - ✅ Visits this month
  - ✅ Visits this year
- ✅ **Customer visit count** (per customer)
- ✅ **Loops given tracking** (total loops awarded)
- ✅ **Daily performance charts** (visits, loops given)
- ✅ **Top customers** (by visits, loops earned)
- ✅ **Customer details** (visit history, loops earned per store)

#### Admin Analytics
- ✅ **System overview** (total users, stores, visits, loops)
- ✅ **System-wide analytics**:
  - ✅ Total users
  - ✅ Total stores
  - ✅ Total visits
  - ✅ Total loops in circulation
  - ✅ Total loops ever earned
  - ✅ Gift card metrics (issued, active, value)
  - ✅ Active customers (30-day)
- ✅ **Visit growth tracking** (visits, loops given over time)
- ✅ **Store performance comparison** (visits, loops given)
- ✅ **User management analytics** (visit counts, loops earned)
- ✅ **Store management analytics** (customer counts, performance)

---

### 🏪 Store Management

#### Store Operations
- ✅ **Customer QR scanning** (scan customer QR at checkout)
- ✅ **Customer lookup** (view customer details)
- ✅ **Customer blacklist** (block customers)
- ✅ **Blacklist management** (add/remove from blacklist)
- ✅ **Store location updates** (update address/coordinates)
- ✅ **Store profile editing**

#### Store Customer Management
- ✅ **Customers today list** (all check-ins today)
- ✅ **Customer visit history** (per customer)
- ✅ **Customer visit count** (total visits per customer)
- ✅ **Customer contact info** (name, phone, email)

---

### 🔔 Real-Time Features

#### Socket.io Integration
- ✅ **Real-time transaction updates** (broadcast to stores)
- ✅ **Real-time redemption updates** (broadcast to stores)
- ✅ **Real-time points unlocking** (broadcast to customers)
- ✅ **WebSocket connection** (for live updates)

---

### 🎨 User Interface Features

#### Customer App
- ✅ **Responsive web app** (React-based)
- ✅ **Tab navigation** (Home, Nearby, Wallet, Analytics, Settings)
- ✅ **QR scanner** (scan store QR codes)
- ✅ **QR code display** (customer QR for checkout)
- ✅ **Location prompt** (request location permission)
- ✅ **Check-in status display** (active session indicator)
- ✅ **Pending points display** (unlocking status)
- ✅ **Gift card management UI** (create, view, top-up)
- ✅ **Transaction history table** (date & time, store, loops)
- ✅ **Nearby stores discovery** (cards + list view, filters, search)
- ✅ **Settings page** (profile, WebAuthn, logout)

#### Store App
- ✅ **Responsive web app** (React-based)
- ✅ **Tab navigation** (Dashboard, Analytics, Gift Cards)
- ✅ **QR scanner** (scan customer QR, scan gift card QR)
- ✅ **Store QR code display** (for customers to scan)
- ✅ **Customers today table** (date & time, customer, visits, loops)
- ✅ **Analytics dashboard** (KPIs, charts, trends)
- ✅ **Gift card processing UI** (scan, apply to purchase)
- ✅ **Blacklist management UI** (view, add, remove)
- ✅ **Store location prompt** (set store location)
- ✅ **Store memberships view** (joined/purchased customers)

#### Admin App
- ✅ **Responsive web app** (React-based)
- ✅ **Tab navigation** (Dashboard, Analytics, Users, Stores)
- ✅ **User management UI** (list, search, pagination)
- ✅ **User details modal** (view, edit, delete)
- ✅ **Store management UI** (list, search, pagination)
- ✅ **Store details modal** (view, edit, delete)
- ✅ **Store claim-code management** (owner verification)
- ✅ **System analytics dashboard** (overview, trends)
- ✅ **Recent activity table** (last 30 days)

---

### 🛡️ Security & Fraud Prevention

#### Security Features
- ✅ **Password hashing** (bcrypt)
- ✅ **JWT token security** (signed tokens)
- ✅ **Role-based access control** (user, store, admin)
- ✅ **Authentication middleware** (protect routes)
- ✅ **Phone number validation** (max 10 digits)
- ✅ **Email validation**
- ✅ **SQL injection prevention** (parameterized queries)
- ✅ **CORS configuration**

#### Fraud Prevention
- ✅ **24-hour cooldown** (prevent duplicate check-ins)
- ✅ **Session expiry** (30-minute active sessions)
- ✅ **CIV score validation** (behavioral verification)
- ✅ **Pending points system** (delayed settlement)
- ✅ **Point expiration** (7-day expiry)
- ✅ **Blacklist system** (store can block customers)
- ✅ **Location verification** (geolocation tracking)

---

### 📱 Mobile & Device Features

#### Mobile Support
- ✅ **Responsive design** (mobile-friendly)
- ✅ **QR code scanning** (camera-based)
- ✅ **Geolocation API** (mobile browser support)
- ✅ **Touch-friendly UI** (mobile-optimized)
- ✅ **WebAuthn support** (mobile facial recognition)

---

### 🔧 Technical Features

#### Backend
- ✅ **Express.js REST API**
- ✅ **SQLite database** (with migrations)
- ✅ **Socket.io real-time** (WebSocket support)
- ✅ **JWT authentication**
- ✅ **bcrypt password hashing**
- ✅ **WebAuthn integration** (@simplewebauthn/server)
- ✅ **CORS middleware**
- ✅ **Error handling**
- ✅ **Database indexes** (performance optimization)

#### Frontend
- ✅ **React.js** (component-based)
- ✅ **React Hooks** (useState, useEffect, useRef)
- ✅ **QR code library** (qrcode.react, html5-qrcode)
- ✅ **Socket.io client** (real-time updates)
- ✅ **Geolocation API** (browser-based)
- ✅ **Responsive CSS** (mobile-first)

---

## 🚀 Planned Future Features

### 💰 Subscription System

#### Customer Subscriptions
- **Next Task (MVP)**: Implement paid tier logic + upgrade flow
  - Add backend plan pricing constants + plan-change endpoint
  - Add customer UI: upgrade modal + plan comparison (Starter/BASIC/PLUS/PREMIUM)
  - Enforce plan benefits in check-in rules (cooldown overrides, multipliers)
  - Add audit trail in `loops_ledger` for plan upgrades
  - Add admin view for subscription status + plan changes
  - MVP scope: BASIC only (PLUS/PREMIUM marked “coming soon”)

- **Business Logic & MVP Definition (end-to-end)**
  - **Plans & Pricing**: STARTER (free), BASIC, PLUS, PREMIUM with monthly/annual pricing.
  - **Entitlements**: Plan multipliers, cooldown overrides, gift-card eligibility thresholds, bonus schedules.
  - **Lifecycle**:
    - Upgrade: immediate entitlement changes.
    - Downgrade/cancel: take effect end of billing period.
    - Grace period: 3–7 days for failed payments before downgrade to STARTER.
  - **Bonuses**:
    - Monthly bonus: automated job that credits loops to `loops_ledger`.
    - Birthday bonus: 1x yearly credit based on profile date.
  - **Enforcement Points**:
    - Check-in rules: cooldown + max visits/day use plan overrides.
    - Loop calculation: plan multiplier + tier multiplier.
    - Gift card eligibility: plan-specific thresholds.
  - **Auditability**:
    - All plan changes and bonuses logged in `loops_ledger`.
    - Admin visibility into plan status and change history.
  - **MVP UI**:
    - Upgrade modal + plan comparison table.
    - Status pill in Customer Settings.
    - “Benefits this month” summary card.

- **Pros / Cons**
  - **Pros**: predictable revenue, higher visit frequency, easier forecasting, stronger retention.
  - **Cons**: added product complexity, potential churn if value feels low, higher support load, perceived paywall risk.

- **Market Fit & Adoption Reality**
  - **Common Pattern**: paid memberships are common in retail/food/warehouse models.
  - **Comparable Models**: Amazon Prime, Walmart+, Costco/Sam’s Club, Panera Sip Club, Pret Coffee Subscription.
  - **Usage Reality**: adoption depends on visit frequency and clear, easy-to-understand benefits.

- **Research Checklist (before build)**
  - Target customer visit frequency (weekly vs monthly).
  - Will multipliers + cooldown overrides feel valuable at current loop economics?
  - Price sensitivity testing for BASIC/PLUS/PREMIUM.
  - Churn risk at renewal and “benefits clarity” user testing.

- **Research Summary (US-focused, assumptions noted)**
  - Paid loyalty is common in US retail/QSR; success correlates with high visit frequency and a simple, obvious benefit.
  - Coffee/QSR subscriptions typically sit in low monthly ranges; higher tiers must bundle meaningful perks beyond multipliers.
  - Profitability hinges on: frequency thresholds, margins, promo liability, and churn at renewal.
  - Recommendation: launch with a low-friction BASIC tier, tightly scoped benefits, and clear monthly value tracking.

- ⏳ **BASIC Tier** ($30/year or $2.99/month)
  - **UI hints**:
    - “Best for weekly shoppers”
    - “10% bonus on every visit”
    - “Low monthly price”
  - 1.1x loop multiplier
  - Priority customer support
  - Early access to new stores (7 days)
  - Exclusive monthly bonus (50 loops/month)
  - Birthday bonus (100 loops)
  - No cooldown period (multiple stores per day)

- ⏳ **PLUS Tier** ($60/year or $4.99/month)
  - **UI hints**:
    - “Power users save more”
    - “Faster gift card eligibility”
    - “Coming soon”
  - 1.15x loop multiplier
  - All BASIC benefits
  - Double loops on first visit to new stores
  - Exclusive store promotions (extra 5% discount)
  - Gift card eligibility at 750 loops (vs 1000)
  - Monthly store spotlight (extra 100 loops)
  - Referral bonus (100 loops per referral)
  - Can check in twice per day at same store

- ⏳ **PREMIUM Tier** ($99/year or $9.99/month)
  - **UI hints**:
    - “Maximum benefits”
    - “Unlimited check-ins”
    - “Coming soon”
  - 1.2x loop multiplier
  - All PLUS benefits
  - Unlimited check-ins (no cooldown)
  - Gift card eligibility at 500 loops (vs 1000)
  - VIP store access (exclusive events)
  - Personalized store recommendations
  - Monthly premium bonus (200 loops/month)
  - Priority gift card processing
  - Dedicated support line
  - Annual gift card bonus (1 free $10 gift card)

#### Store Subscriptions
- ⏳ **ESSENTIAL Tier** ($199/year or $19/month)
  - Advanced analytics dashboard
  - Customer segmentation tools
  - Email marketing integration
  - Priority support (24-hour response)
  - Custom discount campaigns
  - Full customer visit history
  - CSV data export

- ⏳ **PROFESSIONAL Tier** ($499/year or $49/month)
  - All ESSENTIAL features
  - Predictive analytics
  - Churn prediction
  - Customer lifetime value forecasting
  - Multi-location support
  - Custom loyalty campaigns
  - API access (POS integration)
  - White-label options
  - Dedicated account manager
  - Advanced reporting
  - Bulk customer management

- ⏳ **ENTERPRISE Tier** (Custom pricing, ~$150/month)
  - All PROFESSIONAL features
  - Custom integrations (POS, CRM)
  - Dedicated support team
  - Custom feature development
  - Multi-brand management
  - Advanced security (SSO, custom permissions)
  - SLA guarantees
  - Training and onboarding

#### Subscription Management
- ⏳ **Stripe integration** (payment processing)
- ⏳ **Subscription billing** (monthly/annual)
- ⏳ **Subscription management UI** (upgrade/downgrade)
- ⏳ **Subscription analytics** (conversion, churn, ARPU)
- ⏳ **Trial periods** (free trials for paid tiers)
- ⏳ **Cancellation handling** (graceful downgrade)

---

### 🌐 Network & Community Features

#### Multi-Store Network
- ⏳ **Cross-store rewards** (bonus loops for visiting multiple stores)
- ⏳ **Zone-wide promotions** (collaborative marketing)
- ⏳ **Multi-store challenges** (visit 3 stores, get bonus)
- ⏳ **Network leaderboards** (top customers by zone)
- ⏳ **Store collaboration tools** (joint promotions, events)

#### Social Features
- ⏳ **Customer social feed** (share visits, reviews, photos)
- ⏳ **Store stories** (updates, promotions, behind-the-scenes)
- ⏳ **Community challenges** (zone-wide challenges)
- ⏳ **Customer reviews** (rate stores, leave feedback)
- ⏳ **Photo sharing** (share visit photos)
- ⏳ **Friend connections** (follow friends, see their visits)

---

### 🤖 AI & Personalization

#### AI-Powered Features
- ⏳ **Smart store recommendations** (AI suggests based on patterns)
- ⏳ **Predictive visit timing** (best time to visit predictions)
- ⏳ **Personalized loop offers** (custom rewards based on behavior)
- ⏳ **Predictive churn analysis** (identify at-risk customers)
- ⏳ **Customer lifetime value prediction** (future value forecasting)
- ⏳ **Competitive benchmarking** (compare to zone averages)

#### Personalization
- ⏳ **Personalized dashboard** (customized for each user)
- ⏳ **Custom notifications** (personalized alerts)
- ⏳ **Behavior-based rewards** (rewards match preferences)
- ⏳ **Smart promotions** (targeted offers)

---

### 📧 Communication & Marketing

#### Customer Communication
- ⏳ **Push notifications** (check-in reminders, rewards, promotions)
- ⏳ **SMS notifications** (Twilio integration)
- ⏳ **Email marketing** (promotional emails)
- ⏳ **In-app messaging** (store-to-customer messages)
- ⏳ **Notification preferences** (user controls)

#### Store Marketing Tools
- ⏳ **Email campaign builder** (create, send campaigns)
- ⏳ **SMS campaign builder** (text marketing)
- ⏳ **Push notification campaigns** (targeted notifications)
- ⏳ **Promotion builder** (create discounts, offers)
- ⏳ **Referral program** (track referrals, rewards)
- ⏳ **Birthday rewards** (automatic birthday bonuses)

---

### 🔗 Integrations

#### POS System Integration
- ⏳ **Square integration** (connect Square POS)
- ⏳ **Clover integration** (connect Clover POS)
- ⏳ **Generic POS API** (REST API for any POS)
- ⏳ **Transaction sync** (automatic transaction import)
- ⏳ **Inventory sync** (product catalog sync)

#### Payment Integration
- ⏳ **Stripe integration** (subscription payments)
- ⏳ **Payment processing** (gift card top-ups)
- ⏳ **Refund handling** (gift card refunds)

#### Third-Party Integrations
- ⏳ **Apple Wallet** (add gift cards to Apple Wallet)
- ⏳ **Google Wallet** (add gift cards to Google Wallet)
- ⏳ **Calendar integration** (sync events, promotions)
- ⏳ **Social media integration** (share visits, reviews)

---

### 📊 Advanced Analytics

#### Predictive Analytics
- ⏳ **Churn prediction** (identify customers likely to churn)
- ⏳ **Visit prediction** (predict next visit date)
- ⏳ **Revenue forecasting** (predict future revenue)
- ⏳ **Customer segmentation** (AI-powered segments)

#### Advanced Reporting
- ⏳ **Custom date ranges** (flexible reporting periods)
- ⏳ **Comparative analytics** (compare periods, stores)
- ⏳ **Export to Excel/CSV** (data export)
- ⏳ **Scheduled reports** (automated email reports)
- ⏳ **Custom dashboards** (build custom views)

---

### 🎨 Design & Customization

#### Design Features
- ⏳ **Extensive design templates** (more card designs)
- ⏳ **Custom branding** (store logos, colors)
- ⏳ **White-label options** (remove CityCircle branding)
- ⏳ **Theme customization** (dark mode, custom themes)
- ⏳ **Card designer** (drag-and-drop design tool)

---

### 🔍 Discovery & Search

#### Store Discovery
- ⏳ **AR store discovery** (augmented reality finder)
- ⏳ **Voice commands** ("Hey CityCircle, find coffee shops")
- ⏳ **Advanced search** (filter by category, zone, rating)
- ⏳ **Store recommendations** (AI-powered suggestions)
- ⏳ **Nearby stores map** (interactive map view)

---

### 🎮 Gamification

#### Gamification Features
- ⏳ **Achievement badges** (unlock achievements)
- ⏳ **Leaderboards** (top customers, stores)
- ⏳ **Challenges** (complete challenges, earn rewards)
- ⏳ **Streaks** (visit streaks, bonus rewards)
- ⏳ **Levels** (level up, unlock features)

---

### 🔐 Advanced Security

#### Security Enhancements
- ⏳ **Two-factor authentication** (2FA)
- ⏳ **SSO integration** (single sign-on)
- ⏳ **Advanced fraud detection** (ML-based)
- ⏳ **Audit logs** (track all actions)
- ⏳ **IP whitelisting** (restrict access)

---

### 📱 Mobile App

#### Native Mobile Apps
- ⏳ **iOS app** (native iPhone app)
- ⏳ **Android app** (native Android app)
- ⏳ **Push notifications** (native push)
- ⏳ **Offline mode** (work without internet)
- ⏳ **Biometric authentication** (Face ID, Touch ID)

---

### 🌍 Internationalization

#### Multi-Language Support
- ⏳ **Multi-language support** (translate UI)
- ⏳ **Currency support** (multiple currencies)
- ⏳ **Timezone handling** (automatic timezone detection)
- ⏳ **Regional customization** (local features)

---

## 📅 Feature Roadmap Timeline

### Phase 1: Foundation (Months 1-2) ✅ **COMPLETE**
- ✅ User authentication
- ✅ Store management
- ✅ Check-in system
- ✅ Loop earning/redemption
- ✅ Basic analytics
- ✅ Gift card system
- ✅ CIV + DVS hybrid system

### Phase 2: Subscriptions (Months 3-4) ⏳ **IN PROGRESS**
- ⏳ Customer subscription tiers (BASIC, PLUS, PREMIUM)
- ⏳ Store subscription tiers (ESSENTIAL, PROFESSIONAL, ENTERPRISE)
- ⏳ Stripe payment integration
- ⏳ Subscription management UI
- ⏳ Subscription analytics

### Phase 3: Network Features (Months 5-6) ⏳ **PLANNED**
- ⏳ Cross-store rewards
- ⏳ Zone-wide promotions
- ⏳ Multi-store challenges
- ⏳ Network leaderboards
- ⏳ Store collaboration tools

### Phase 4: AI & Personalization (Months 7-8) ⏳ **PLANNED**
- ⏳ Smart store recommendations
- ⏳ Predictive analytics
- ⏳ Personalized offers
- ⏳ Churn prediction
- ⏳ Customer lifetime value

### Phase 5: Social & Community (Months 9-10) ⏳ **PLANNED**
- ⏳ Customer social feed
- ⏳ Store stories
- ⏳ Community challenges
- ⏳ Reviews & ratings
- ⏳ Friend connections

### Phase 6: Integrations (Months 11-12) ⏳ **PLANNED**
- ⏳ POS system integrations (Square, Clover)
- ⏳ Apple/Google Wallet
- ⏳ Payment processing
- ⏳ API access for stores
- ⏳ Third-party integrations

### Phase 7: Advanced Features (Months 13+) ⏳ **PLANNED**
- ⏳ Native mobile apps (iOS, Android)
- ⏳ AR store discovery
- ⏳ Voice commands
- ⏳ Advanced gamification
- ⏳ Multi-language support

---

## 📊 Feature Status Summary

### ✅ Implemented: 80+ Features
- Authentication & User Management: 25+ features
- Location & Check-In: 10+ features
- Reward System: 15+ features
- Gift Cards: 12+ features
- Analytics: 15+ features
- Store Management: 8+ features
- Real-Time: 4+ features
- UI/UX: 10+ features
- Security: 8+ features

### ⏳ Planned: 100+ Features
- Subscriptions: 20+ features
- Network & Community: 10+ features
- AI & Personalization: 10+ features
- Communication: 10+ features
- Integrations: 10+ features
- Advanced Analytics: 10+ features
- Design & Customization: 5+ features
- Discovery & Search: 5+ features
- Gamification: 5+ features
- Security: 5+ features
- Mobile Apps: 5+ features
- Internationalization: 5+ features

---

## 🎯 Key Differentiators

### What Makes CityCircle Unique:

1. **Multi-Store Network** ⭐
   - Customers can use one subscription across all stores
   - Network effects benefit everyone
   - Cross-store promotions possible

2. **Visit-Based Rewards** ⭐
   - Rewards frequency, not just spending
   - Encourages repeat visits
   - Different from purchase-based systems

3. **Hybrid CIV + DVS System** ⭐
   - Behavioral verification (CIV)
   - Delayed value settlement (DVS)
   - Fraud prevention built-in

4. **Zone-Based Organization** ⭐
   - Geographic targeting
   - Local community building
   - Neighborhood focus

5. **Dual Revenue Model** ⭐
   - Customer subscriptions
   - Store subscriptions
   - More sustainable business model

---

## 📖 Feature Details & Specifications

This section provides comprehensive details, use cases, and implementation ideas for all features.

---

### 🔐 Authentication & User Management - Detailed Specifications

#### Phone-Based Authentication
**Technical Implementation**:
- Database: `users.phone TEXT UNIQUE NOT NULL`
- Validation: 10-digit numeric string
- Index: Primary lookup field
- Verification: `phone_verified INTEGER DEFAULT 1`

**User Flow**:
1. User enters phone number (e.g., "5551234567")
2. System validates format (10 digits, numeric)
3. Checks uniqueness (no duplicate phones)
4. Password hashed with bcrypt
5. Account created with phone as primary identifier

**Edge Cases**:
- Duplicate phone: Error "Phone already registered"
- Invalid format: Error "Phone must be 10 digits"
- Missing phone: Error "Phone required"

**Business Logic**:
- Phone is primary identifier (not email)
- Phone verification assumed (phone_verified = 1)
- Phone can't be changed (permanent identifier)

---

#### Email Authentication (Optional)
**Technical Implementation**:
- Database: `users.email TEXT` (nullable)
- Validation: Email regex pattern
- Verification: `email_verified INTEGER DEFAULT 0`
- Optional: Can be NULL

**User Flow**:
1. User optionally provides email during signup
2. Email stored (can be NULL)
3. Email verification sent (if provided)
4. User clicks verification link
5. `email_verified` set to 1

**Use Cases**:
- Account recovery: Reset password via email
- Notifications: Receive promotional emails
- Marketing: Email campaigns to verified emails

**Edge Cases**:
- No email: Account works without email
- Invalid email: Validation error
- Duplicate email: Allowed (not unique constraint)

---

#### Password-Based Login/Signup
**Technical Implementation**:
- Hashing: bcrypt with 10 salt rounds
- Storage: `users.password_hash TEXT NOT NULL`
- Validation: Minimum length, complexity rules
- JWT: Token issued on successful login

**User Flow - Signup**:
1. User enters phone, password, name
2. Password validated (length, complexity)
3. Password hashed: `bcrypt.hash(password, 10)`
4. Hash stored in database
5. User account created

**User Flow - Login**:
1. User enters phone + password
2. System finds user by phone
3. Password verified: `bcrypt.compare(password, hash)`
4. If match: JWT token generated
5. Token returned to client

**Security**:
- Password never stored in plain text
- bcrypt prevents rainbow table attacks
- Salt rounds: 10 (balance security/performance)
- JWT token: 7-day expiry

---

#### JWT Token Authentication
**Technical Implementation**:
- Library: jsonwebtoken
- Secret: `JWT_SECRET` from environment
- Payload: `{ userId, role, phone, iat, exp }`
- Expiry: 7 days
- Header: `Authorization: Bearer <token>`

**Token Generation**:
```javascript
const token = jwt.sign(
  { userId: user.id, role: 'user', phone: user.phone },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

**Token Validation**:
- Middleware checks Authorization header
- Extracts token from "Bearer <token>"
- Verifies signature with JWT_SECRET
- Checks expiry (exp claim)
- Attaches user to request (req.user)

**Security**:
- Signed tokens prevent tampering
- Expiry prevents indefinite access
- Secret key: Never exposed to client
- Stateless: No server-side session storage

---

#### User Profile Management
**Technical Implementation**:
- Endpoint: `PUT /api/users/profile`
- Fields: name, email, address
- Validation: Required fields, format checks
- Update: Direct database update

**User Flow**:
1. User navigates to Settings tab
2. Profile form pre-filled with current data
3. User edits fields (name, email, address)
4. Form submitted to API
5. Database updated
6. Success message shown

**Validation Rules**:
- Name: Required, max 100 characters
- Email: Optional, valid email format
- Address: Optional, free text

**Business Value**:
- Accurate customer data
- Personalization (use name in communications)
- Marketing (email for campaigns)

---

#### Location-Based Registration
**Technical Implementation**:
- API: Browser Geolocation API
- Storage: `users.latitude REAL, longitude REAL`
- Flag: `users.location_set BOOLEAN DEFAULT 0`
- Permission: Requested on first use

**User Flow**:
1. App requests location permission
2. User grants permission
3. Browser gets coordinates
4. Coordinates sent to backend
5. Location stored in database
6. `location_set` flag set to 1

**Fallback**:
- If permission denied: Manual address entry
- Address geocoded to coordinates
- Location set from address

**Use Cases**:
- Nearby stores: Show stores within radius
- Zone assignment: Auto-assign zone
- Personalized: Show local businesses

---

#### Zone Assignment
**Technical Implementation**:
- Fields: `users.primary_zone TEXT, secondary_zone TEXT`
- Assignment: Automatic from location or manual
- Zones: "Downtown", "Midtown", "Uptown", etc.
- Usage: Filtering, promotions, analytics

**Zone Logic**:
1. User location determined
2. Zone boundaries checked
3. Primary zone assigned (closest zone)
4. Secondary zone assigned (adjacent zone)
5. Zones stored in database

**Use Cases**:
- Zone promotions: "Visit 3 stores in Downtown"
- Store discovery: Show zone stores first
- Community: Connect users in same zone

**Business Value**:
- Local targeting (relevant promotions)
- Community building (zone-based features)
- Better engagement (local relevance)

---

#### User QR Code Generation
**Technical Implementation**:
- Format: `USER:{userId}:{8-byte hex}`
- Generation: `crypto.randomBytes(8).toString('hex')`
- Storage: `users.qr_code TEXT UNIQUE`
- Display: qrcode.react library

**QR Code Structure**:
- Prefix: "USER:"
- ID: User's database ID
- Random: 8-byte hex string (16 chars)
- Example: `USER:123:abc123def456`

**User Flow**:
1. User account created
2. QR code generated on signup
3. Code stored in database
4. QR displayed in Wallet tab
5. Store scans code at checkout

**Use Cases**:
- Checkout: Customer shows QR
- Identification: Store finds customer
- Linking: Link visit to account

---

#### Plan Tier System
**Technical Implementation**:
- Field: `users.plan TEXT DEFAULT 'STARTER'`
- Values: STARTER, BASIC, PLUS, PREMIUM
- Multipliers: 1.0x, 1.1x, 1.15x, 1.2x
- Endpoint: `GET /api/users/plan-tier`

**Tier Benefits**:
- **STARTER** (Free):
  - 1.0x multiplier
  - Basic features
  - Standard support

- **BASIC** ($30/year):
  - 1.1x multiplier
  - Priority support
  - Early store access
  - Monthly bonus (50 loops)

- **PLUS** ($60/year):
  - 1.15x multiplier
  - All BASIC benefits
  - Double loops on first visit
  - Gift card at 750 loops

- **PREMIUM** ($99/year):
  - 1.2x multiplier
  - All PLUS benefits
  - Unlimited check-ins
  - Gift card at 500 loops

**Loop Calculation**:
```javascript
baseLoops = 10;
planMultiplier = getPlanMultiplier(user.plan); // 1.0x - 1.2x
tierMultiplier = getTierMultiplier(user.total_loops_earned); // 1.0x - 1.2x
finalLoops = baseLoops * planMultiplier * tierMultiplier;
```

---

#### WebAuthn Facial Recognition
**Technical Implementation**:
- Library: @simplewebauthn/server
- Storage: `webauthn_credentials` table
- Flow: Challenge-response authentication
- Security: Public key cryptography

**Registration Flow**:
1. User clicks "Register Face ID"
2. Server generates registration options
3. Device creates credential (face/Touch ID)
4. Public key sent to server
5. Credential stored in database

**Authentication Flow**:
1. User clicks "Login with Face ID"
2. Server generates authentication challenge
3. Device signs challenge with private key
4. Server verifies signature with public key
5. If valid: User authenticated

**Security**:
- Private key never leaves device
- Public key stored on server
- Counter prevents replay attacks
- Multiple devices supported

---

### 📍 Location & Check-In System - Detailed Specifications

#### QR Code Scanning
**Technical Implementation**:
- Library: html5-qrcode
- Camera: Browser camera API
- Format: `STORE:{storeId}:{random}`
- Validation: Verify store exists

**User Flow**:
1. User opens QR scanner
2. Camera permission requested
3. Camera shows live feed
4. QR code detected
5. Code parsed: `STORE:123:abc`
6. Store ID extracted: 123
7. Check-in initiated

**Error Handling**:
- No camera: Error message
- Invalid QR: "Invalid QR code"
- Store not found: "Store not found"
- Already checked in: "Already checked in today"

---

#### Check-In Session Management
**Technical Implementation**:
- Table: `check_in_sessions`
- Status: active, completed, expired, cancelled
- Expiry: 30 minutes from check-in
- Tracking: Session ID linked to pending points

**Session Lifecycle**:
1. **Active**: Customer checked in, shopping
2. **Completed**: Customer completed visit (CIV calculated)
3. **Expired**: 30 minutes passed, no completion
4. **Cancelled**: Customer cancelled check-in

**Session Data**:
- `user_id`: Customer ID
- `store_id`: Store ID
- `checked_in_at`: Timestamp
- `expires_at`: 30 minutes from check-in
- `status`: Current status

**Use Cases**:
- Active session: Show "Checked in" indicator
- Session expiry: Auto-expire after 30 min
- Multiple sessions: One active session at a time

---

#### 24-Hour Cooldown
**Technical Implementation**:
- Check: Last check-in time per store
- Calculation: Hours since last check-in
- Rule: Must be ≥ 24 hours
- Error: 429 Too Many Requests

**Cooldown Logic**:
```javascript
const lastCheckIn = getLastCheckIn(userId, storeId);
const hoursSince = (now - lastCheckIn) / (1000 * 60 * 60);
if (hoursSince < 24) {
  return error("Thank you! Please visit again tomorrow.");
}
```

**User Experience**:
- Friendly message: "Thank you! Please visit again tomorrow."
- No technical jargon
- Clear expectation (24 hours)

**Business Value**:
- Prevents abuse (multiple check-ins)
- Encourages return visits (next day)
- Fair system (one per day)

---

#### Location Tracking During Check-In
**Technical Implementation**:
- Table: `location_history`
- Updates: Every 5-10 seconds during session
- Storage: Latitude, longitude, accuracy, timestamp
- Purpose: CIV (Consumption-Intent Verification)

**Tracking Flow**:
1. User checks in
2. Location permission granted
3. `watchPosition` starts tracking
4. Location updates every 5 seconds
5. Coordinates stored in `location_history`
6. Tracking stops on session completion/expiry

**Location Data**:
- `session_id`: Links to check-in session
- `latitude`: GPS latitude
- `longitude`: GPS longitude
- `accuracy`: GPS accuracy in meters
- `timestamp`: When location captured

**Use Cases**:
- CIV analysis: Verify customer was at store
- Fraud prevention: Detect fake check-ins
- Analytics: Track visit patterns

---

#### CIV (Consumption-Intent Verification)
**Technical Implementation**:
- Score: 0.0 to 1.0 (confidence level)
- Factors: Location dwell, proximity, duration, movement
- Calculation: Weighted average of factors
- Adjustment: Points adjusted based on score

**CIV Factors**:
1. **Location Dwell Curve** (30% weight):
   - Tracks movement patterns
   - Detects browsing → checkout → exit
   - Higher score if movement matches shopping pattern

2. **Proximity to Store** (20% weight):
   - Average distance from store location
   - Lower distance = higher score
   - Verifies customer stayed near store

3. **Visit Duration** (20% weight):
   - Time spent at store
   - Matches category patterns (coffee: 5-15 min, grocery: 15-60 min)
   - Higher score if duration matches category

4. **Movement Pattern** (10% weight):
   - Multiple stops detected (browsing)
   - Shopping vs. walk-in patterns
   - Higher score for shopping behavior

5. **Return Probability** (20% weight):
   - Calculated when checking for return visits
   - Real buyers return within 7 days
   - Higher score if return visit detected

**Score Calculation**:
```javascript
const civScore = (
  dwellScore * 0.30 +
  proximityScore * 0.20 +
  durationScore * 0.20 +
  movementScore * 0.10 +
  returnScore * 0.20
);
```

**Point Adjustment**:
- High confidence (≥0.8): 100% of points
- Medium confidence (0.6-0.8): 70% of points
- Low confidence (<0.6): 30% of points

---

#### DVS (Delayed Value Settlement)
**Technical Implementation**:
- Table: `pending_points`
- Status: pending, unlocked, expired, downgraded
- Expiry: 7 days from creation
- Triggers: Return visit, redemption, related visit

**Settlement Triggers**:
1. **Return Visit**: Customer checks in again at same store within 7 days
2. **Reward Redemption**: Customer redeems loops at store
3. **Related Visit**: Customer visits related category store
4. **Offer Engagement**: Customer engages with follow-up offer
5. **Another Purchase**: Customer makes another transaction

**Settlement Flow**:
1. Points awarded (status: pending)
2. Points visible but marked "unlocking..."
3. Settlement check runs every 5 minutes
4. If trigger detected: Points unlocked
5. Points added to user balance
6. Status changed to "unlocked"

**Expiry Logic**:
- If no trigger within 7 days: Points expire
- Status changed to "expired"
- Points removed from pending
- User notified of expiry

---

### 🎁 Reward System (Loops) - Detailed Specifications

#### Visit-Based Loop Earning
**Technical Implementation**:
- Base: 10 loops per check-in
- Multipliers: Plan tier + customer tier
- Calculation: `base * planMultiplier * tierMultiplier`
- Storage: `users.loops_balance`, `users.total_loops_earned`

**Loop Calculation Example**:
```javascript
// Base loops
const baseLoops = 10;

// Plan multiplier (STARTER=1.0x, BASIC=1.1x, PLUS=1.15x, PREMIUM=1.2x)
const planMultiplier = getPlanMultiplier(user.plan);

// Tier multiplier (Bronze=1.0x, Silver=1.05x, Gold=1.1x, Platinum=1.2x)
const tierMultiplier = getTierMultiplier(user.total_loops_earned);

// Final calculation
const loopsEarned = Math.round(baseLoops * planMultiplier * tierMultiplier);
```

**Example Scenarios**:
- STARTER + Bronze: 10 * 1.0 * 1.0 = 10 loops
- BASIC + Silver: 10 * 1.1 * 1.05 = 11.55 → 12 loops
- PREMIUM + Platinum: 10 * 1.2 * 1.2 = 14.4 → 14 loops

**Business Value**:
- Rewards frequency (not spending)
- Encourages repeat visits
- Different from purchase-based systems

---

#### Tier System (Bronze/Silver/Gold/Platinum)
**Technical Implementation**:
- Based on: `users.total_loops_earned` (lifetime)
- Tiers: Bronze (0-199), Silver (200-499), Gold (500-999), Platinum (1000+)
- Multipliers: 1.0x, 1.05x, 1.1x, 1.2x
- Calculation: Automatic on each loop earning

**Tier Benefits**:
- **Bronze** (0-199 loops):
  - Multiplier: 1.0x
  - Status: Entry level
  - Benefits: Basic rewards

- **Silver** (200-499 loops):
  - Multiplier: 1.05x
  - Status: Regular customer
  - Benefits: 5% bonus loops

- **Gold** (500-999 loops):
  - Multiplier: 1.1x
  - Status: Loyal customer
  - Benefits: 10% bonus loops

- **Platinum** (1000+ loops):
  - Multiplier: 1.2x
  - Status: VIP customer
  - Benefits: 20% bonus loops, gift card eligibility

**Tier Progression**:
- Automatic: Tier calculated on each visit
- Display: Tier shown in user profile
- Benefits: Higher tier = more loops per visit

---

#### Loop Redemption
**Technical Implementation**:
- Endpoint: `POST /api/users/redeem`
- Validation: Check balance before redemption
- Amount: User specifies redemption amount
- Store: Redemption linked to store
- Ledger: Transaction logged in `loops_ledger`

**Redemption Flow**:
1. User selects store
2. Enters redemption amount (e.g., 50 loops)
3. System checks balance (must have ≥ 50 loops)
4. If sufficient: Loops deducted
5. Transaction logged
6. Store notified (real-time)
7. Discount applied at store

**Validation**:
- Balance check: Must have enough loops
- Amount validation: Positive number
- Store validation: Store must exist
- Error handling: Clear error messages

**Business Value**:
- Customer value: Loops have real value
- Store benefit: Encourages visits
- Engagement: Redemption drives return visits

---

### 💳 Gift Card System - Detailed Specifications

#### Digital Gift Card Creation
**Technical Implementation**:
- Minimum: 1000 loops required
- Conversion: 1000 loops = $10 gift card
- Code: `GC-{random}` format
- Storage: `gift_cards` table
- Validity: 90 days from creation

**Creation Flow**:
1. User checks eligibility (≥ 1000 loops)
2. User clicks "Create Gift Card"
3. System validates balance (≥ 1000 loops)
4. Gift card created: 1000 loops → $10 gift card
5. Loops deducted from balance
6. QR code generated
7. Gift card displayed in app

**Gift Card Data**:
- `code`: Unique gift card code (GC-ABC123XYZ)
- `user_id`: Owner
- `store_id`: NULL (any store) or specific store
- `original_value`: $10.00
- `current_balance`: $10.00 (decreases with usage)
- `loops_used`: 1000 (points used to create)
- `status`: active, used, expired, cancelled
- `expires_at`: 90 days from creation

**Use Cases**:
- Convert loops: Turn points into spendable money
- Gift to others: Transfer gift card to friend
- Store-specific: Create gift card for specific store
- Any store: Create gift card usable anywhere

---

#### Gift Card Top-Up
**Technical Implementation**:
- Endpoint: `POST /api/users/gift-cards/:id/topup`
- Method: Add more value to existing card
- Payment: Loops or cash
- Storage: Transaction logged in `gift_card_transactions`

**Top-Up Flow**:
1. User selects gift card
2. Clicks "Top-Up"
3. Enters amount (e.g., add $20)
4. Chooses payment: Loops or cash
5. If loops: Validates balance (2000 loops = $20)
6. If cash: Processes payment
7. Gift card balance increased
8. Transaction logged

**Top-Up Options**:
- **With Loops**: Convert more loops to gift card value
  - Example: Add $20 = 2000 loops deducted
- **With Cash**: Add cash value to gift card
  - Example: Add $20 = $20 charged to payment method

**Business Value**:
- Customer retention: Keep value in system
- Revenue: Cash top-ups generate revenue
- Flexibility: Multiple payment options

---

#### Gift Card Usage at Store
**Technical Implementation**:
- Endpoint: `POST /api/stores/use-gift-card`
- Flow: Store scans QR, enters purchase amount, applies gift card
- Partial usage: Can use part of balance
- Transaction: Logged in `gift_card_transactions`

**Usage Flow**:
1. Customer shows gift card QR at checkout
2. Store scans QR code
3. Store enters purchase amount (e.g., $15.00)
4. System calculates: Use $10 from gift card, $5 remaining
5. Gift card balance reduced: $10.00 → $0.00
6. Transaction logged
7. Customer pays remaining $5 with other method

**Partial Usage**:
- If purchase < balance: Use full purchase amount
- If purchase > balance: Use full balance, pay difference
- Balance tracking: Current balance always accurate

**Business Value**:
- Real value: Gift cards have monetary value
- Customer retention: Encourages return visits
- Store benefit: Gift cards drive sales

---

### 📊 Analytics & Reporting - Detailed Specifications

#### Customer Analytics Dashboard
**Technical Implementation**:
- Endpoint: `GET /api/analytics/customer/:userId`
- Data: Visits, loops earned, store performance
- Period: Last 30 days (default), customizable
- Display: KPIs, charts, tables

**Dashboard Components**:
1. **KPIs** (Key Performance Indicators):
   - Total Visits: Count of check-ins
   - Total Loops Earned: Lifetime loops
   - Current Balance: Available loops
   - Favorite Store: Most visited store

2. **Store Performance Table**:
   - Store name
   - Visit count
   - Loops earned
   - Last visit date
   - Average loops per visit

3. **Visit History**:
   - Date & time
   - Store name
   - Loops earned
   - Status (unlocked, pending, expired)

**Use Cases**:
- Track progress: See visit history
- Compare stores: Which stores give most loops
- Plan visits: See where to visit next

---

#### Store Analytics Dashboard
**Technical Implementation**:
- Endpoint: `GET /api/analytics/store`
- Data: Customers, visits, loops given
- Period: Today, this week, this month, this year
- Display: KPIs, charts, customer lists

**Dashboard Components**:
1. **KPIs**:
   - Total Visits: All-time visit count
   - Visits Today: Today's check-ins
   - Visits This Week: Week-to-date
   - Visits This Month: Month-to-date
   - Visits This Year: Year-to-date
   - Total Loops Given: Lifetime loops awarded

2. **Daily Performance Chart**:
   - X-axis: Date
   - Y-axis: Visits, Loops Given
   - Trend: Shows growth/decline

3. **Top Customers**:
   - Customer name
   - Visit count
   - Total loops earned
   - Last visit date

**Use Cases**:
- Track performance: See visit trends
- Identify top customers: Reward loyal customers
- Plan promotions: Target high-value customers

---

#### Admin System Analytics
**Technical Implementation**:
- Endpoint: `GET /api/analytics/system`
- Data: System-wide metrics
- Scope: All users, stores, visits
- Display: Overview, trends, comparisons

**Dashboard Components**:
1. **System Overview**:
   - Total Users: All registered customers
   - Total Stores: All registered stores
   - Total Visits: All-time check-ins
   - Total Loops in Circulation: Current balances
   - Total Loops Ever Earned: Lifetime loops
   - Gift Card Metrics: Issued, active, value

2. **Visit Growth**:
   - Period: Daily, weekly, monthly
   - Metrics: Visits, loops given
   - Trend: Growth rate

3. **Store Performance**:
   - Store name
   - Visit count
   - Loops given
   - Customer count
   - Ranking

**Use Cases**:
- Platform health: Monitor system growth
- Identify trends: See what's working
- Support stores: Help underperforming stores

---

### 🚀 Planned Features - Detailed Specifications

#### Customer Subscription Tiers

##### BASIC Tier ($30/year or $2.99/month)
**Features**:
- **1.1x Loop Multiplier**: Earn 10% more loops per visit
  - Example: 10 loops → 11 loops per visit
- **Priority Customer Support**: Faster response times
- **Early Access to New Stores**: See new stores 7 days before free users
- **Exclusive Monthly Bonus**: 50 loops added monthly
- **Birthday Bonus**: 100 loops on birthday
- **No Cooldown Period**: Check in at multiple stores per day

**Value Proposition**:
- Break-even: ~$2.50/month in extra loops
- For frequent visitors: Clear value
- Predictable monthly benefit

**Implementation**:
- Stripe subscription: Monthly/annual billing
- Plan stored in `users.plan = 'BASIC'`
- Multiplier applied on loop earning
- Monthly bonus: Cron job adds 50 loops
- Birthday bonus: Check date, add 100 loops

---

##### PLUS Tier ($60/year or $4.99/month)
**Features**:
- **1.15x Loop Multiplier**: Earn 15% more loops
- **All BASIC Benefits**: Everything from BASIC tier
- **Double Loops on First Visit**: 2x loops for new stores
- **Exclusive Store Promotions**: Extra 5% discount at select stores
- **Gift Card Eligibility at 750 Loops**: Lower threshold (vs 1000)
- **Monthly Store Spotlight**: Extra 100 loops at featured store
- **Referral Bonus**: 100 loops per referral
- **Two Check-Ins Per Day**: Can check in twice at same store

**Value Proposition**:
- For power users: Frequent shoppers
- Faster gift card access: 750 vs 1000 loops
- Exclusive perks: Justify cost

**Implementation**:
- Plan: `users.plan = 'PLUS'`
- First visit tracking: Flag new stores
- Referral system: Track referrals, award bonuses
- Cooldown override: Allow 2 check-ins per day

---

##### PREMIUM Tier ($99/year or $9.99/month)
**Features**:
- **1.2x Loop Multiplier**: Earn 20% more loops
- **All PLUS Benefits**: Everything from PLUS tier
- **Unlimited Check-Ins**: No cooldown, multiple per day
- **Gift Card Eligibility at 500 Loops**: Lowest threshold
- **VIP Store Access**: Exclusive events, early access
- **Personalized Store Recommendations**: AI-powered suggestions
- **Monthly Premium Bonus**: 200 loops/month
- **Priority Gift Card Processing**: Faster processing
- **Dedicated Support Line**: Direct support channel
- **Annual Gift Card Bonus**: 1 free $10 gift card per year

**Value Proposition**:
- For super users: Maximum value
- Exclusive experiences: VIP access
- Best value: Highest tier benefits

**Implementation**:
- Plan: `users.plan = 'PREMIUM'`
- Cooldown bypass: No 24-hour limit
- AI recommendations: Machine learning model
- Annual bonus: Cron job on anniversary

---

#### Store Subscription Tiers

##### ESSENTIAL Tier ($199/year or $19/month)
**Features**:
- **Advanced Analytics Dashboard**: Detailed insights
- **Customer Segmentation Tools**: Group customers by behavior
- **Email Marketing Integration**: Send promotional emails
- **Priority Support**: 24-hour response time
- **Custom Discount Campaigns**: Create targeted promotions
- **Full Customer Visit History**: Complete visit records
- **CSV Data Export**: Export data for analysis

**Value Proposition**:
- Affordable: $19/month for small businesses
- Better insights: Understand customers
- Marketing tools: Reach customers directly

**Implementation**:
- Subscription: Stripe billing
- Analytics: Enhanced queries
- Email: Integration with SendGrid/Mailchimp
- Export: CSV generation endpoint

---

##### PROFESSIONAL Tier ($499/year or $49/month)
**Features**:
- **All ESSENTIAL Features**: Everything from ESSENTIAL
- **Predictive Analytics**: Forecast future visits
- **Churn Prediction**: Identify at-risk customers
- **Customer Lifetime Value Forecasting**: Predict future value
- **Multi-Location Support**: Manage multiple stores
- **Custom Loyalty Campaigns**: Build custom programs
- **API Access**: Integrate with POS systems
- **White-Label Options**: Remove CityCircle branding
- **Dedicated Account Manager**: Personal support
- **Advanced Reporting**: Custom reports
- **Bulk Customer Management**: Manage multiple customers

**Value Proposition**:
- For established businesses: Advanced tools
- Growth tools: Predictive analytics
- Professional support: Account manager

**Implementation**:
- ML models: Churn prediction, LTV forecasting
- API: REST API for POS integration
- White-label: Custom branding options
- Multi-location: Store grouping feature

---

##### ENTERPRISE Tier (Custom pricing, ~$150/month)
**Features**:
- **All PROFESSIONAL Features**: Everything from PROFESSIONAL
- **Custom Integrations**: POS, CRM, etc.
- **Dedicated Support Team**: 24/7 support
- **Custom Feature Development**: Build custom features
- **Multi-Brand Management**: Manage multiple brands
- **Advanced Security**: SSO, custom permissions
- **SLA Guarantees**: Uptime guarantees
- **Training and Onboarding**: Staff training

**Value Proposition**:
- For large chains: Enterprise features
- Custom solutions: Tailored to needs
- Enterprise support: Dedicated team

**Implementation**:
- Custom development: Feature requests
- SSO: Single sign-on integration
- SLA: Service level agreements
- Training: Onboarding programs

---

#### Network & Community Features

##### Cross-Store Rewards
**Concept**: Customers earn bonus loops when visiting multiple stores in the same zone.

**Implementation**:
- Track: Visits to different stores in zone
- Bonus: Visit 3 different stores = 50 bonus loops
- Display: Progress indicator (2/3 stores visited)
- Reset: Monthly or weekly reset

**Use Cases**:
- Zone exploration: Encourage trying new stores
- Network effect: Benefits all stores
- Community building: Connect local businesses

---

##### Zone-Wide Promotions
**Concept**: Stores collaborate on zone-wide promotions.

**Implementation**:
- Creation: Store creates promotion, invites others
- Participation: Multiple stores join promotion
- Display: Promotion shown to zone customers
- Tracking: Track participation, redemption

**Use Cases**:
- "Visit 5 stores in Downtown, get 200 bonus loops"
- "Coffee shop + bakery combo: Extra 50 loops"
- "Zone-wide sale: All stores participate"

---

##### Multi-Store Challenges
**Concept**: Zone-wide challenges that encourage exploration.

**Implementation**:
- Challenge types: Visit X stores, earn Y loops
- Progress tracking: Show completion status
- Rewards: Bonus loops on completion
- Leaderboards: Top customers by zone

**Use Cases**:
- "Visit 10 stores this month: 500 bonus loops"
- "Try 3 new stores: 100 bonus loops"
- "Zone champion: Most visits this month"

---

#### AI & Personalization Features

##### Smart Store Recommendations
**Concept**: AI suggests stores based on visit patterns, preferences, location.

**Implementation**:
- Data: Visit history, location, preferences
- Model: Machine learning recommendation engine
- Factors: Past visits, category preferences, distance, time
- Display: "Recommended for you" section

**Use Cases**:
- "You might like: Coffee Shop B (similar to Coffee Shop A)"
- "Nearby: Bakery (0.5 miles away)"
- "Popular in your zone: New restaurant"

---

##### Predictive Visit Timing
**Concept**: Predict best time to visit based on crowd data.

**Implementation**:
- Data: Historical visit patterns, time of day
- Model: Predict busy vs. quiet times
- Display: "Best time to visit: 2-4 PM (less crowded)"
- Real-time: Update based on current activity

**Use Cases**:
- Avoid crowds: Visit during quiet times
- Better experience: Less wait time
- Store benefit: Distribute traffic

---

##### Personalized Loop Offers
**Concept**: AI creates custom loop offers based on customer behavior.

**Implementation**:
- Analysis: Customer visit patterns, preferences
- Offers: Custom loop bonuses
- Targeting: Right offer to right customer
- Display: Personalized offers in app

**Use Cases**:
- "Extra 20 loops at Coffee Shop A (your favorite)"
- "First visit bonus: 50 loops at new bakery"
- "Return visit bonus: 30 loops (haven't visited in 2 weeks)"

---

#### Communication & Marketing Features

##### Push Notifications
**Concept**: Real-time notifications for check-ins, rewards, promotions.

**Implementation**:
- Service: Firebase Cloud Messaging (FCM)
- Types: Check-in reminders, reward notifications, promotions
- Targeting: Segment customers
- Preferences: User controls notification types

**Use Cases**:
- "You earned 12 loops at Coffee Shop A!"
- "New store nearby: Bakery B (0.3 miles)"
- "Special offer: 50 bonus loops at Store X today"

---

##### Email Marketing
**Concept**: Stores send promotional emails to customers.

**Implementation**:
- Service: SendGrid or Mailchimp integration
- Builder: Drag-and-drop email builder
- Segmentation: Target by visit frequency, preferences
- Analytics: Open rates, click rates, conversions

**Use Cases**:
- Weekly newsletter: Store updates, promotions
- Birthday emails: Special birthday offers
- Re-engagement: "We miss you!" emails

---

##### SMS Notifications
**Concept**: Text message notifications for important updates.

**Implementation**:
- Service: Twilio integration
- Types: Check-in confirmations, reward notifications
- Opt-in: User must opt in
- Preferences: User controls SMS frequency

**Use Cases**:
- "You checked in at Coffee Shop A"
- "Your loops unlocked: 12 loops added"
- "Special offer: 50 bonus loops today only"

---

#### Integration Features

##### POS System Integration
**Concept**: Connect CityCircle with POS systems for automatic transaction sync.

**Implementation**:
- APIs: Square API, Clover API, generic REST API
- Sync: Automatic transaction import
- Mapping: Map POS transactions to CityCircle visits
- Real-time: Transactions sync immediately

**Use Cases**:
- Automatic check-in: Transaction = check-in
- Transaction sync: Import purchase history
- Inventory sync: Sync product catalog

---

##### Apple/Google Wallet
**Concept**: Add gift cards to mobile wallets.

**Implementation**:
- Format: PKPass for Apple Wallet, Google Pay passes
- Generation: Create wallet-compatible files
- Display: Gift card in wallet app
- Updates: Balance updates in wallet

**Use Cases**:
- Easy access: Gift card in wallet
- Quick checkout: Pay with wallet
- Balance tracking: See balance in wallet

---

### 🎯 Implementation Priorities

#### ✅ Recommended next steps (current workstream)
1. **Finalize UI consistency across portals**
   - Replace remaining inline styles with shared `ui/` components
   - Align typography, spacing, and color tokens across Customer/Store/Admin
2. **Customer analytics refresh**
   - Add richer KPIs and clean chart styling (no emoji/placeholder icons)
   - Replace basic cards with consistent dashboards + summaries
3. **Nearby experience polish**
   - Continue dedupe + ranking consistency
   - Improve card layout and CTA clarity
4. **Data accuracy + performance**
   - Validate Google Places results import + cache policy
   - Review store offer tiers and paid unlock pricing

**High Priority** (Next 3 months):
1. Customer subscription tiers (BASIC, PLUS, PREMIUM)
2. Store subscription tiers (ESSENTIAL, PROFESSIONAL)
3. Stripe payment integration
4. Subscription management UI
5. Enhanced analytics for stores

**Medium Priority** (Months 4-6):
1. Network features (cross-store rewards, zone promotions)
2. Communication tools (email, SMS, push notifications)
3. POS integrations (Square, Clover)
4. Advanced analytics (predictive, churn)

**Low Priority** (Months 7+):
1. AI features (recommendations, personalization)
2. Social features (feed, reviews, friends)
3. Native mobile apps
4. AR/voice features

---

*Document Version: 2.0*  
*Last Updated: January 2025*  
*Total Features: 180+ (80+ implemented, 100+ planned)*  
*Detailed Specifications: Complete*
