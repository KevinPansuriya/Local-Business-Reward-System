# CityCircle System Design Document

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagrams](#architecture-diagrams)
3. [Database Design](#database-design)
4. [API Architecture](#api-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Component Interactions](#component-interactions)
7. [Current Implementation Status](#current-implementation-status)
8. [Future Roadmap](#future-roadmap)

---

## 🏗️ System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CityCircle Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Customer   │  │    Store     │  │    Admin     │         │
│  │     App      │  │     App      │  │    Dashboard │         │
│  │  (React PWA) │  │  (React PWA) │  │  (React PWA) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                     │
│                    ┌───────▼────────┐                           │
│                    │   REST API      │                           │
│                    │  (Express.js)   │                           │
│                    └───────┬────────┘                           │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                  │                 │
│  ┌──────▼──────┐  ┌───────▼───────┐  ┌──────▼──────┐          │
│  │   SQLite    │  │  Socket.io    │  │  WebAuthn   │          │
│  │  Database   │  │  (Real-time)  │  │  (Auth)     │          │
│  └─────────────┘  └────────────────┘  └─────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React.js (Component-based UI)
- Progressive Web App (PWA)
- HTML5 QR Scanner
- Geolocation API
- Socket.io Client

**Backend:**
- Node.js + Express.js
- SQLite Database
- Socket.io (WebSocket)
- WebAuthn (@simplewebauthn/server)
- JWT Authentication
- bcrypt (Password Hashing)

**Infrastructure:**
- Single-server deployment
- SQLite file-based database
- Real-time WebSocket connections

---

## 📊 Architecture Diagrams

### 1. System Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Customer App   │  │   Store App     │  │   Admin App     │     │
│  │  (React PWA)    │  │   (React PWA)   │  │   (React PWA)   │     │
│  │                 │  │                 │  │                 │     │
│  │ - QR Scanner    │  │ - QR Scanner    │  │ - User Mgmt     │     │
│  │ - Wallet        │  │ - Dashboard     │  │ - Store Mgmt    │     │
│  │ - Analytics     │  │ - Analytics     │  │ - Analytics     │     │
│  │ - Settings      │  │ - Gift Cards    │  │ - Reports       │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                     │                     │              │
│           └─────────────────────┼─────────────────────┘              │
│                                 │                                    │
│                    ┌─────────────▼─────────────┐                   │
│                    │    HTTP/WebSocket          │                   │
│                    │    Communication Layer     │                   │
│                    └─────────────┬─────────────┘                   │
└──────────────────────────────────┼─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                         API LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Express.js REST API Server                      │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │   Auth       │  │   Business   │  │   Real-time  │      │   │
│  │  │  Middleware  │  │    Logic     │  │   Events     │      │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │   │
│  │         │                 │                  │                │   │
│  │  ┌──────▼─────────────────▼──────────────────▼──────┐      │   │
│  │  │            Route Handlers                          │      │   │
│  │  │  - /api/users/*      (Customer endpoints)          │      │   │
│  │  │  - /api/stores/*     (Store endpoints)             │      │   │
│  │  │  - /api/admins/*     (Admin endpoints)            │      │   │
│  │  │  - /api/analytics/*  (Analytics endpoints)        │      │   │
│  │  └────────────────────────────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                         DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SQLite Database                           │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │   Core       │  │   Loyalty    │  │   Gift       │      │   │
│  │  │   Tables     │  │   System     │  │   Cards      │      │   │
│  │  │              │  │              │  │             │      │   │
│  │  │ - users      │  │ - check_in   │  │ - gift_cards │      │   │
│  │  │ - stores     │  │   _sessions  │  │ - gift_card  │      │   │
│  │  │ - admins     │  │ - location   │  │   _trans     │      │   │
│  │  │              │  │   _history   │  │              │      │   │
│  │  │              │  │ - pending    │  │              │      │   │
│  │  │              │  │   _points    │  │              │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Design

### Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│    users    │
├─────────────┤
│ id (PK)     │◄─────┐
│ phone (UK)  │      │
│ email       │      │
│ password    │      │
│ name        │      │
│ plan        │      │
│ loops_bal   │      │
│ total_loops │      │
│ qr_code (UK)│      │
│ zone        │      │
│ location    │      │
└─────────────┘      │
                     │
        ┌────────────┼────────────┐
        │            │            │
        │            │            │
┌───────▼──────┐ ┌──▼──────────┐  │ ┌──────────────┐
│check_in_     │ │pending_      │ │ │webauthn_     │
│sessions      │ │points        │ │ │credentials   │
├──────────────┤ ├──────────────┤ │ ├──────────────┤
│id (PK)       │ │id (PK)       │ │ │id (PK)       │
│user_id (FK)──┼─┤user_id (FK)──┼─┼─┤user_id (FK)──┘
│store_id (FK)─┼─┤store_id (FK)─┼─┼─┤credential_id │
│checked_in_at │ │session_id    │ │ │public_key    │
│expires_at    │ │loops_pending │ │ │counter       │
│status        │ │civ_score     │ │ │device_name   │
└──────┬───────┘ │status        │ │ └──────────────┘
       │         │expires_at    │ │
       │         └──────────────┘ │
       │                          │
       │         ┌────────────────┘
       │         │
┌──────▼─────────▼──────┐
│location_history       │
├───────────────────────┤
│id (PK)                │
│session_id (FK)────────┘
│latitude               │
│longitude              │
│timestamp              │
└───────────────────────┘

┌─────────────┐
│   stores    │
├─────────────┤
│ id (PK)     │◄─────┐
│ email       │      │
│ phone       │      │
│ password    │      │
│ name        │      │
│ zone        │      │
│ category    │      │
│ qr_code (UK)│      │
│ location    │      │
└─────────────┘      │
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────────┐  │ ┌──────────────┐
│check_in_     │ │pending_      │ │ │store_        │
│sessions      │ │points        │ │ │customer_     │
├──────────────┤ ├──────────────┤ │ │blacklist     │
│store_id (FK)─┘ │store_id (FK)─┘ │ ├──────────────┤
└───────────────┘ └───────────────┘ │ id (PK)      │
                                    │ store_id (FK)│──┘
┌─────────────┐                    ││user_id (FK)──┐
│   admins    │                    ││reason        │
├─────────────┤                    │└──────────────┘
│ id (PK)     │                    │
│ email (UK)  │                    │
│ password    │                    │
│ name        │                    │
│ role        │                    │
└─────────────┘                    │
                                    │
┌───────────────────────────────────┘
│
│  ┌──────────────┐
│  │gift_cards    │
│  ├──────────────┤
│  │id (PK)       │◄─────┐
│  │code (UK)     │      │
│  │user_id (FK)──┼──────┘
│  │store_id (FK) │
│  │balance       │
│  │status        │
│  │expires_at    │
│  └──────┬───────┘
│         │
│  ┌──────▼──────────────┐
│  │gift_card_           │
│  │transactions         │
│  ├─────────────────────┤
│  │id (PK)              │
│  │gift_card_id (FK)────┘
│  │type                 │
│  │amount               │
│  │store_id (FK)        │
│  └─────────────────────┘
│
│  ┌──────────────┐
│  │loops_ledger  │
│  ├──────────────┤
│  │id (PK)       │
│  │user_id (FK)──┼──────┐
│  │change_type   │      │
│  │amount        │      │
│  │meta          │      │
│  └──────────────┘      │
│                         │
│  ┌──────────────────────┘
│  │
│  ┌──────────────┐
│  │settlement_   │
│  │triggers      │
│  ├──────────────┤
│  │id (PK)       │
│  │pending_pts   │
│  │  _id (FK)    │
│  │trigger_type  │
│  │trigger_data  │
│  └──────────────┘
│
└─────────────────────────────────────
```

### Database Tables Overview

#### Core Tables

**users** (Customers)
- Primary Key: `id`
- Unique: `phone`, `qr_code`
- Key Fields: `loops_balance`, `total_loops_earned`, `plan`, `zone`
- Relationships: One-to-many with check_in_sessions, pending_points, gift_cards

**stores** (Businesses)
- Primary Key: `id`
- Unique: `qr_code`
- Key Fields: `zone`, `category`, `base_discount_percent`
- Relationships: One-to-many with check_in_sessions, pending_points

**admins** (Platform Administrators)
- Primary Key: `id`
- Unique: `email`
- Key Fields: `role`, `last_login_at`
- Relationships: None (management only)

#### Loyalty System Tables

**check_in_sessions** (Check-In Tracking)
- Primary Key: `id`
- Foreign Keys: `user_id` → users, `store_id` → stores
- Key Fields: `status`, `checked_in_at`, `expires_at`
- Relationships: One-to-many with location_history, pending_points

**location_history** (CIV Data)
- Primary Key: `id`
- Foreign Key: `session_id` → check_in_sessions
- Key Fields: `latitude`, `longitude`, `timestamp`
- Purpose: Track customer movement for CIV analysis

**pending_points** (DVS System)
- Primary Key: `id`
- Foreign Keys: `user_id` → users, `store_id` → stores, `session_id` → check_in_sessions
- Key Fields: `loops_pending`, `civ_score`, `status`, `expires_at`
- Purpose: Delayed value settlement (7-day pending period)

**settlement_triggers** (Point Unlocking)
- Primary Key: `id`
- Foreign Key: `pending_points_id` → pending_points
- Key Fields: `trigger_type`, `trigger_data`
- Purpose: Track what unlocked pending points

**loops_ledger** (Transaction History)
- Primary Key: `id`
- Foreign Key: `user_id` → users
- Key Fields: `change_type` (EARN/REDEEM), `amount`, `meta`
- Purpose: Audit trail of all loop transactions

#### Gift Card Tables

**gift_cards** (Gift Cards)
- Primary Key: `id`
- Unique: `code`
- Foreign Keys: `user_id` → users, `store_id` → stores
- Key Fields: `current_balance`, `status`, `expires_at`, `card_type`
- Purpose: Digital and physical gift cards

**gift_card_transactions** (Gift Card Activity)
- Primary Key: `id`
- Foreign Keys: `gift_card_id` → gift_cards, `store_id` → stores
- Key Fields: `transaction_type`, `amount`, `payment_method`
- Purpose: Track all gift card operations

**gift_card_transfers** (Gifting)
- Primary Key: `id`
- Foreign Keys: `gift_card_id` → gift_cards, `from_user_id` → users, `to_user_id` → users
- Key Fields: `transfer_code`, `status`
- Purpose: Gift card transfers between users

#### Management Tables

**store_customer_blacklist** (Customer Blocking)
- Primary Key: `id`
- Foreign Keys: `store_id` → stores, `user_id` → users
- Unique: `(store_id, user_id)`
- Key Fields: `reason`, `blocked_by_store_id`
- Purpose: Stores can block customers

**webauthn_credentials** (Biometric Auth)
- Primary Key: `id`
- Unique: `credential_id`
- Foreign Key: `user_id` → users
- Key Fields: `public_key`, `counter`, `device_name`
- Purpose: WebAuthn facial recognition credentials

---

## 🔌 API Architecture

### API Endpoint Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    API ENDPOINT MAP                              │
└─────────────────────────────────────────────────────────────────┘

/api/users/*
├── POST   /signup                    (Customer registration)
├── POST   /login                     (Customer login)
├── GET    /me                        (Get user profile)
├── PUT    /profile                   (Update profile)
├── POST   /location                  (Update location)
├── GET    /plan-tier                 (Get subscription plan)
│
├── POST   /check-in                  (Check in at store)
├── POST   /check-in/location         (Update location during session)
├── POST   /check-in/complete         (Complete visit, calculate CIV)
├── GET    /pending-points            (Get pending points)
├── POST   /check-settlement          (Manually trigger settlement)
│
├── POST   /scan-store                (Scan store QR code)
├── POST   /redeem                   (Redeem loops for discount)
│
├── POST   /webauthn/register/start   (Start WebAuthn registration)
├── POST   /webauthn/register/finish  (Complete WebAuthn registration)
├── POST   /webauthn/authenticate/start  (Start WebAuthn auth)
├── POST   /webauthn/authenticate/finish (Complete WebAuthn auth)
├── GET    /webauthn/status          (List WebAuthn credentials)
├── DELETE /webauthn/credentials/:id (Delete credential)
│
├── GET    /gift-cards/eligibility    (Check gift card eligibility)
├── POST   /gift-cards/create         (Create gift card)
├── GET    /gift-cards                (List gift cards)
├── GET    /gift-cards/:id           (Get gift card details)
└── POST   /gift-cards/:id/topup     (Top-up gift card)

/api/stores/*
├── POST   /signup                    (Store registration)
├── POST   /login                     (Store login)
├── GET    /me                        (Get store profile)
├── PUT    /location                 (Update store location)
│
├── GET    /customers-today           (Get today's check-ins)
├── GET    /customer/:userId          (Get customer details)
├── POST   /scan-customer             (Scan customer QR)
│
├── POST   /scan-gift-card            (Scan gift card QR)
├── POST   /use-gift-card             (Apply gift card to purchase)
├── GET    /pending-physical-gift-cards  (Get pending physical cards)
├── POST   /issue-physical-gift-card/:id  (Issue physical card)
│
├── GET    /blacklist                 (Get blacklisted customers)
├── POST   /blacklist                 (Add to blacklist)
└── DELETE /blacklist/:userId         (Remove from blacklist)

/api/admins/*
├── POST   /signup                    (Admin registration)
├── POST   /login                     (Admin login)
├── GET    /me                        (Get admin profile)
│
├── GET    /users                     (List all users)
├── GET    /users/:id                 (Get user details)
├── PUT    /users/:id                 (Update user)
├── DELETE /users/:id                 (Delete user)
├── GET    /users/:id/stores          (Get user's stores)
│
├── GET    /stores                    (List all stores)
├── GET    /stores/:id                (Get store details)
├── PUT    /stores/:id                (Update store)
├── DELETE /stores/:id                (Delete store)
├── GET    /stores/:id/customers      (Get store's customers)

/api/analytics/*
├── GET    /customer/:userId           (Customer analytics)
├── GET    /store                     (Store analytics)
└── GET    /system                    (System-wide analytics)

/api/stores/*
├── GET    /list                      (Public store list)
└── GET    /nearby                    (Nearby stores by location)
```

### API Request Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP Request
       │ (with JWT token)
       │
┌──────▼─────────────────────────────────────┐
│         Express.js Server                  │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  1. CORS Middleware                │   │
│  └──────────────┬─────────────────────┘   │
│                 │                          │
│  ┌──────────────▼─────────────────────┐   │
│  │  2. JSON Parser                     │   │
│  └──────────────┬─────────────────────┘   │
│                 │                          │
│  ┌──────────────▼─────────────────────┐   │
│  │  3. Auth Middleware                │   │
│  │     - Extract JWT token            │   │
│  │     - Verify signature              │   │
│  │     - Check expiry                  │   │
│  │     - Attach user to req.user       │   │
│  └──────────────┬─────────────────────┘   │
│                 │                          │
│  ┌──────────────▼─────────────────────┐   │
│  │  4. Route Handler                  │   │
│  │     - Validate input               │   │
│  │     - Business logic               │   │
│  │     - Database queries             │   │
│  └──────────────┬─────────────────────┘   │
│                 │                          │
│  ┌──────────────▼─────────────────────┐   │
│  │  5. Database Query                 │   │
│  │     - SQLite connection            │   │
│  │     - Execute query                 │   │
│  │     - Return results                │   │
│  └──────────────┬─────────────────────┘   │
│                 │                          │
│  ┌──────────────▼─────────────────────┐   │
│  │  6. Response                       │   │
│  │     - Format data                  │   │
│  │     - Send JSON response           │   │
│  └──────────────┬─────────────────────┘   │
└─────────────────┼─────────────────────────┘
                  │
                  │ HTTP Response
                  │ (JSON data)
                  │
         ┌────────▼────────┐
         │     Client      │
         │   (Browser)    │
         └─────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. Check-In Flow

```
┌──────────┐
│ Customer │
└────┬─────┘
     │
     │ 1. Opens app, scans store QR
     │
┌────▼─────────────────────────────────────┐
│         Customer App (Frontend)          │
│  - QR Scanner captures code             │
│  - Parses: "STORE:123:abc"              │
│  - Extracts store_id: 123               │
└────┬────────────────────────────────────┘
     │
     │ 2. POST /api/users/check-in
     │    { qrCode: "STORE:123:abc" }
     │
┌────▼─────────────────────────────────────┐
│         Backend API                     │
│  1. Validate QR code format             │
│  2. Extract store_id                    │
│  3. Check store exists                  │
│  4. Check 24-hour cooldown              │
│  5. Create check_in_session            │
│  6. Award pending points                │
│  7. Start location tracking             │
└────┬────────────────────────────────────┘
     │
     │ 3. Database Operations
     │
┌────▼─────────────────────────────────────┐
│         SQLite Database                 │
│  INSERT INTO check_in_sessions          │
│  INSERT INTO pending_points            │
│  UPDATE users (if needed)               │
└────┬────────────────────────────────────┘
     │
     │ 4. Response
     │    { sessionId, storeName, loopsPending }
     │
┌────▼─────────────────────────────────────┐
│         Customer App (Frontend)          │
│  - Display "Checked in!" message        │
│  - Show pending points                  │
│  - Start location tracking              │
│  - Show "Complete Visit" button        │
└──────────────────────────────────────────┘
     │
     │ 5. Real-time Update (Socket.io)
     │
┌────▼─────────────────────────────────────┐
│         Store App (Frontend)             │
│  - Show new customer in "Customers Today"│
│  - Display check-in time                 │
│  - Show customer info                    │
└──────────────────────────────────────────┘
```

### 2. Loop Earning & Settlement Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    LOOP EARNING FLOW                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Check-In
┌──────────┐
│ Customer │ → Scans QR → Creates check_in_session
└──────────┘
     │
     ▼
┌──────────────────┐
│ pending_points   │
│ - loops_pending: 10
│ - status: 'pending'
│ - expires_at: +7 days
└──────────────────┘

Step 2: Location Tracking (CIV)
┌──────────┐
│ Customer │ → Moves around store → location_history updated
└──────────┘
     │
     ▼
┌──────────────────┐
│ location_history │
│ - Multiple GPS points
│ - Timestamps
└──────────────────┘

Step 3: Complete Visit (Optional)
┌──────────┐
│ Customer │ → Clicks "Complete Visit"
└──────────┘
     │
     ▼
┌──────────────────┐
│ CIV Calculation  │
│ - Dwell curve: 0.8
│ - Proximity: 0.9
│ - Duration: 0.7
│ - Movement: 0.8
│ - Final score: 0.8 (High)
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ pending_points   │
│ - civ_score: 0.8
│ - Points adjusted: 10 * 1.0 = 10 loops
└──────────────────┘

Step 4: Settlement Check (Automatic, every 5 min)
┌──────────────────┐
│ Settlement Job   │
│ Checks triggers: │
│ - Return visit?  │
│ - Redemption?    │
│ - Related visit? │
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Settlement Found │
│ - Return visit detected
│ - Unlock points
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Database Update  │
│ 1. UPDATE pending_points
│    SET status='unlocked', loops_unlocked=10
│ 2. UPDATE users
│    SET loops_balance += 10
│    SET total_loops_earned += 10
│ 3. INSERT INTO loops_ledger
│    (EARN, +10)
│ 4. INSERT INTO settlement_triggers
│    (trigger_type='return_visit')
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Real-time Update │
│ Socket.io emits: │
│ 'points-unlocked'
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Customer App     │
│ - Notification: │
│   "10 Loops unlocked!"
│ - Balance updated
└──────────────────┘
```

### 3. Gift Card Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  GIFT CARD CREATION FLOW                    │
└─────────────────────────────────────────────────────────────┘

┌──────────┐
│ Customer │
└────┬─────┘
     │
     │ 1. Checks eligibility
     │    GET /api/users/gift-cards/eligibility
     │
┌────▼─────────────────────────────────────┐
│         Backend Check                    │
│  - Get user.loops_balance                │
│  - Check if >= 1000 loops                │
│  - Return eligibility status             │
└────┬─────────────────────────────────────┘
     │
     │ Response: { eligible: true, balance: 1500 }
     │
┌────▼─────────────────────────────────────┐
│         Customer App                     │
│  - Show "Create Gift Card" button        │
│  - Display: "You have 1500 loops"       │
└────┬─────────────────────────────────────┘
     │
     │ 2. Customer clicks "Create Gift Card"
     │    POST /api/users/gift-cards/create
     │    { amount: 10.00 }  // $10 gift card
     │
┌────▼─────────────────────────────────────┐
│         Backend Processing               │
│  1. Validate: loops_balance >= 1000      │
│  2. Calculate: 1000 loops = $10          │
│  3. Generate unique code: "GC-ABC123"    │
│  4. Create gift card record              │
│  5. Deduct loops from user               │
│  6. Create transaction record            │
└────┬─────────────────────────────────────┘
     │
     │ 3. Database Operations
     │
┌────▼─────────────────────────────────────┐
│         SQLite Database                  │
│  INSERT INTO gift_cards                  │
│    (code, user_id, original_value,       │
│     current_balance, loops_used,          │
│     expires_at)                          │
│  UPDATE users                            │
│    SET loops_balance -= 1000             │
│  INSERT INTO gift_card_transactions     │
│    (type='create', amount=10.00,         │
│     loops_used=1000)                     │
│  INSERT INTO loops_ledger                │
│    (change_type='REDEEM', amount=-1000)  │
└────┬─────────────────────────────────────┘
     │
     │ 4. Response
     │    { giftCard: { id, code, balance, qrCode } }
     │
┌────▼─────────────────────────────────────┐
│         Customer App                     │
│  - Display gift card                     │
│  - Show QR code                          │
│  - Show balance: $10.00                  │
│  - Show expiry: 90 days                  │
└──────────────────────────────────────────┘
```

---

## 🔗 Component Interactions

### Real-Time Communication (Socket.io)

```
┌─────────────────────────────────────────────────────────────┐
│              REAL-TIME EVENT FLOW                           │
└─────────────────────────────────────────────────────────────┘

Event: Customer Checks In
┌──────────┐
│ Customer │ → POST /api/users/check-in
└──────────┘
     │
     ▼
┌──────────────────┐
│  Backend API     │ → io.emit('transaction', {
│  (Express.js)    │     type: 'check-in',
│                  │     storeId: 123,
│                  │     customerName: 'John'
│                  │   })
└──────────────────┘
     │
     │ Socket.io Broadcast
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Store 1  │    │ Store 2  │    │ Store 3  │
│  App     │    │  App     │    │  App     │
│          │    │          │    │          │
│ Updates  │    │ No update│    │ No update│
│ dashboard│    │ (different│   │ (different│
│          │    │  store)  │    │  store)  │
└──────────┘    └──────────┘    └──────────┘

Event: Points Unlocked
┌──────────────────┐
│ Settlement Job   │ → Detects return visit
└──────────────────┘
     │
     ▼
┌──────────────────┐
│  Backend API     │ → io.emit('points-unlocked', {
│                  │     userId: 456,
│                  │     loops: 10,
│                  │     storeId: 123
│                  │   })
└──────────────────┘
     │
     │ Socket.io Broadcast
     │
     ▼
┌──────────┐
│ Customer │ → Receives notification
│  App     │   "10 Loops unlocked!"
└──────────┘
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION FLOW                         │
└─────────────────────────────────────────────────────────────┘

┌──────────┐
│ Customer │
└────┬─────┘
     │
     │ 1. POST /api/users/login
     │    { phone: "5551234567", password: "***" }
     │
┌────▼─────────────────────────────────────┐
│         Backend API                      │
│  1. Find user by phone                   │
│  2. Compare password with bcrypt          │
│  3. If match: Generate JWT token         │
│     - Payload: { userId, role, phone }   │
│     - Expiry: 7 days                     │
│  4. Return token                          │
└────┬─────────────────────────────────────┘
     │
     │ Response: { token: "eyJhbGc..." }
     │
┌────▼─────────────────────────────────────┐
│         Customer App                     │
│  - Store token in localStorage           │
│  - Include in Authorization header       │
│    for all future requests               │
└──────────────────────────────────────────┘
     │
     │ 2. Subsequent Requests
     │    GET /api/users/me
     │    Authorization: Bearer eyJhbGc...
     │
┌────▼─────────────────────────────────────┐
│         Auth Middleware                 │
│  1. Extract token from header            │
│  2. Verify JWT signature                 │
│  3. Check expiry                         │
│  4. Attach user to req.user              │
│  5. Continue to route handler            │
└────┬────────────────────────────────────┘
     │
     ▼
┌──────────────────┐
│  Route Handler   │ → Has access to req.user
└──────────────────┘
```

---

## ✅ Current Implementation Status

### Implemented Components

```
┌─────────────────────────────────────────────────────────────┐
│              CURRENT SYSTEM STATUS                          │
└─────────────────────────────────────────────────────────────┘

✅ COMPLETE
├── Authentication System
│   ├── Phone-based auth (users)
│   ├── Email/Phone auth (stores)
│   ├── Email auth (admins)
│   ├── JWT token system
│   ├── Password hashing (bcrypt)
│   └── WebAuthn (facial recognition)
│
├── Check-In System
│   ├── QR code scanning
│   ├── Check-in sessions
│   ├── 24-hour cooldown
│   ├── Location tracking
│   └── Session expiry (30 min)
│
├── Loyalty System
│   ├── Loop earning (visit-based)
│   ├── Loop redemption
│   ├── Tier system (Bronze/Silver/Gold/Platinum)
│   ├── Plan multipliers (STARTER/BASIC/PLUS/PREMIUM)
│   └── Loops ledger (audit trail)
│
├── CIV + DVS System
│   ├── Consumption-Intent Verification
│   ├── Delayed Value Settlement
│   ├── Pending points (7-day expiry)
│   ├── Settlement triggers
│   └── Automatic settlement (every 5 min)
│
├── Gift Card System
│   ├── Digital gift cards
│   ├── Physical gift cards
│   ├── Gift card creation (1000 loops min)
│   ├── Gift card top-up
│   ├── Gift card usage
│   └── Gift card transfers (database ready)
│
├── Analytics System
│   ├── Customer analytics
│   ├── Store analytics
│   ├── System analytics (admin)
│   ├── Visit tracking
│   └── Loop tracking
│
├── Store Management
│   ├── Customer blacklist
│   ├── Customer lookup
│   ├── Customers today view
│   └── Store profile management
│
├── Real-Time Features
│   ├── Socket.io integration
│   ├── Real-time updates
│   └── WebSocket connections
│
└── Frontend Applications
    ├── Customer App (React PWA)
    ├── Store App (React PWA)
    └── Admin App (React PWA)

⏳ IN PROGRESS
├── Subscription System
│   ├── Customer subscription tiers
│   ├── Store subscription tiers
│   └── Payment integration (Stripe)

📅 PLANNED
├── Network Features
│   ├── Cross-store rewards
│   ├── Zone-wide promotions
│   └── Multi-store challenges
│
├── AI Features
│   ├── Smart recommendations
│   ├── Predictive analytics
│   └── Churn prediction
│
├── Social Features
│   ├── Customer social feed
│   ├── Store stories
│   └── Friend connections
│
├── Integrations
│   ├── POS systems (Square, Clover)
│   ├── Apple/Google Wallet
│   └── Payment processing
│
└── Mobile Apps
    ├── iOS native app
    └── Android native app
```

---

## 🗺️ Future Roadmap

### Phase 1: Foundation ✅ COMPLETE
- Core authentication
- Check-in system
- Loop earning/redemption
- Gift cards
- Analytics
- CIV + DVS

### Phase 2: Subscriptions ⏳ IN PROGRESS
```
┌─────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION SYSTEM DESIGN                      │
└─────────────────────────────────────────────────────────────┘

Database Schema (To Add):
┌──────────────────┐
│ subscriptions    │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ store_id (FK)    │──→ stores (nullable)
│ tier             │ (BASIC/PLUS/PREMIUM/ESSENTIAL/PROFESSIONAL)
│ status           │ (active/cancelled/expired)
│ billing_cycle    │ (monthly/annual)
│ stripe_sub_id    │
│ current_period_start│
│ current_period_end│
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ subscription_    │
│ payments         │
├──────────────────┤
│ id (PK)          │
│ subscription_id  │──→ subscriptions
│ amount           │
│ currency         │
│ status           │ (pending/succeeded/failed)
│ stripe_payment_id│
│ created_at       │
└──────────────────┘

API Endpoints (To Add):
├── POST   /api/users/subscriptions/create
├── GET    /api/users/subscriptions
├── PUT    /api/users/subscriptions/:id
├── DELETE /api/users/subscriptions/:id
├── POST   /api/users/subscriptions/webhook (Stripe)
│
├── POST   /api/stores/subscriptions/create
├── GET    /api/stores/subscriptions
└── PUT    /api/stores/subscriptions/:id

Integration Points:
├── Stripe API (payment processing)
├── Webhook handler (subscription events)
└── Cron job (check expirations)
```

### Phase 3: Network Features 📅 PLANNED
```
┌─────────────────────────────────────────────────────────────┐
│              NETWORK FEATURES DESIGN                        │
└─────────────────────────────────────────────────────────────┘

Database Schema (To Add):
┌──────────────────┐
│ zone_promotions  │
├──────────────────┤
│ id (PK)          │
│ zone             │
│ title            │
│ description      │
│ bonus_loops      │
│ requirement      │ (visit X stores)
│ start_date       │
│ end_date         │
│ status           │
└──────────────────┘

┌──────────────────┐
│ cross_store_     │
│ rewards          │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ promotion_id (FK)│──→ zone_promotions
│ stores_visited   │ (JSON array of store_ids)
│ bonus_loops      │
│ status           │
└──────────────────┘

┌──────────────────┐
│ network_         │
│ leaderboards     │
├──────────────────┤
│ id (PK)          │
│ zone             │
│ user_id (FK)     │──→ users
│ metric           │ (visits/loops/stores)
│ rank             │
│ period           │ (daily/weekly/monthly)
└──────────────────┘
```

### Phase 4: AI Features 📅 PLANNED
```
┌─────────────────────────────────────────────────────────────┐
│              AI FEATURES DESIGN                             │
└─────────────────────────────────────────────────────────────┘

Database Schema (To Add):
┌──────────────────┐
│ ai_recommendations│
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ store_id (FK)    │──→ stores
│ score            │ (0.0 to 1.0)
│ reason           │ (why recommended)
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ churn_predictions│
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ store_id (FK)    │──→ stores
│ churn_probability│ (0.0 to 1.0)
│ risk_level       │ (low/medium/high)
│ last_visit       │
│ predicted_churn_date│
└──────────────────┘

External Services:
├── Machine Learning Model (Python service)
├── Recommendation Engine
└── Prediction API
```

### Phase 5: Social Features 📅 PLANNED
```
┌─────────────────────────────────────────────────────────────┐
│              SOCIAL FEATURES DESIGN                         │
└─────────────────────────────────────────────────────────────┘

Database Schema (To Add):
┌──────────────────┐
│ social_posts     │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ store_id (FK)    │──→ stores (nullable)
│ content          │ (text)
│ photos           │ (JSON array of URLs)
│ type             │ (visit/review/photo)
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ user_follows     │
├──────────────────┤
│ id (PK)          │
│ follower_id (FK) │──→ users
│ following_id (FK)│──→ users
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ store_reviews    │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │──→ users
│ store_id (FK)    │──→ stores
│ rating           │ (1-5 stars)
│ comment          │
│ photos           │ (JSON array)
│ created_at       │
└──────────────────┘
```

### Phase 6: Integrations 📅 PLANNED
```
┌─────────────────────────────────────────────────────────────┐
│              INTEGRATION DESIGN                             │
└─────────────────────────────────────────────────────────────┘

Database Schema (To Add):
┌──────────────────┐
│ pos_integrations │
├──────────────────┤
│ id (PK)          │
│ store_id (FK)    │──→ stores
│ pos_type         │ (square/clover/generic)
│ api_key          │ (encrypted)
│ api_secret       │ (encrypted)
│ status           │ (active/inactive)
│ last_sync        │
└──────────────────┘

┌──────────────────┐
│ pos_transactions │
├──────────────────┤
│ id (PK)          │
│ store_id (FK)    │──→ stores
│ user_id (FK)     │──→ users (nullable)
│ pos_transaction_id│
│ amount           │
│ synced_at        │
└──────────────────┘

External APIs:
├── Square API
├── Clover API
├── Apple Wallet API
├── Google Wallet API
└── Stripe API (already planned)
```

---

## 🔧 System Blueprint

### Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM BLUEPRINT                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Customer    │  │    Store     │  │    Admin     │     │
│  │    UI        │  │      UI      │  │      UI      │     │
│  │              │  │              │  │              │     │
│  │ React PWA    │  │ React PWA    │  │ React PWA    │     │
│  │              │  │              │  │              │     │
│  │ Components:  │  │ Components:  │  │ Components:  │     │
│  │ - QRScanner  │  │ - QRScanner  │  │ - Dashboard  │     │
│  │ - Wallet     │  │ - Dashboard  │  │ - UserMgmt   │     │
│  │ - Analytics  │  │ - Analytics  │  │ - StoreMgmt   │     │
│  │ - Settings   │  │ - GiftCards  │  │ - Analytics   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      API LAYER                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │            Express.js REST API                       │     │
│  │                                                       │     │
│  │  Routes:                                             │     │
│  │  /api/users/*    → UserController                    │     │
│  │  /api/stores/*   → StoreController                   │     │
│  │  /api/admins/*   → AdminController                    │     │
│  │  /api/analytics/* → AnalyticsController               │     │
│  │                                                       │     │
│  │  Middleware:                                         │     │
│  │  - CORS                                              │     │
│  │  - JSON Parser                                       │     │
│  │  - Auth (JWT)                                        │     │
│  │  - Error Handler                                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │            Socket.io Server                          │     │
│  │  - Real-time events                                  │     │
│  │  - WebSocket connections                             │     │
│  │  - Broadcast updates                                 │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Check-In    │  │   Loyalty    │  │   Gift Card  │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  │              │  │              │  │              │     │
│  │ - QR parsing │  │ - Loop calc  │  │ - Creation   │     │
│  │ - Cooldown   │  │ - Tier calc  │  │ - Top-up     │     │
│  │ - Session mgmt│  │ - Redemption │  │ - Usage      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  CIV Service │  │   DVS        │  │  Analytics   │     │
│  │              │  │   Service    │  │   Service    │     │
│  │ - Location   │  │ - Settlement │  │ - Reports    │     │
│  │   analysis   │  │ - Triggers   │  │ - Metrics    │     │
│  │ - Score calc │  │ - Expiry     │  │ - Charts     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │            SQLite Database                           │     │
│  │                                                       │     │
│  │  Tables:                                            │     │
│  │  - users, stores, admins                           │     │
│  │  - check_in_sessions, location_history              │     │
│  │  - pending_points, settlement_triggers              │     │
│  │  - gift_cards, gift_card_transactions              │     │
│  │  - loops_ledger                                     │     │
│  │  - store_customer_blacklist                         │     │
│  │  - webauthn_credentials                             │     │
│  │                                                       │     │
│  │  Indexes:                                           │     │
│  │  - Performance optimization                         │     │
│  │  - Foreign key indexes                              │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Future System Architecture (Planned)

```
┌─────────────────────────────────────────────────────────────┐
│              FUTURE SYSTEM BLUEPRINT                        │
└─────────────────────────────────────────────────────────────┘

Additional Components (To Add):

┌─────────────────────────────────────────────────────────────┐
│                    NEW SERVICES                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Subscription │  │   Network    │  │      AI      │     │
│  │   Service     │  │   Service    │  │   Service    │     │
│  │              │  │              │  │              │     │
│  │ - Billing    │  │ - Cross-store │  │ - ML Models  │     │
│  │ - Stripe     │  │   rewards     │  │ - Predictions│     │
│  │ - Webhooks   │  │ - Promotions  │  │ - Recommends │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Social     │  │ Integration  │  │  Mobile      │     │
│  │   Service    │  │   Service    │  │  Service     │     │
│  │              │  │              │  │              │     │
│  │ - Feed       │  │ - POS APIs    │  │ - iOS App    │     │
│  │ - Reviews    │  │ - Wallets     │  │ - Android App│     │
│  │ - Friends    │  │ - Payments    │  │ - Push Notif │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

External Services (To Integrate):
├── Stripe (Payment processing)
├── Square API (POS integration)
├── Clover API (POS integration)
├── Apple Wallet API
├── Google Wallet API
├── Twilio (SMS)
├── SendGrid/Mailchimp (Email)
└── ML Service (Python microservice)
```

---

## 📋 Implementation Checklist

### ✅ Completed
- [x] Database schema design
- [x] Core API endpoints
- [x] Authentication system
- [x] Check-in system
- [x] Loop earning/redemption
- [x] CIV + DVS system
- [x] Gift card system
- [x] Analytics system
- [x] Real-time updates
- [x] Frontend applications

### ⏳ In Progress
- [ ] Subscription system
- [ ] Payment integration
- [ ] Subscription management UI

### 📅 Planned
- [ ] Network features database
- [ ] AI features database
- [ ] Social features database
- [ ] POS integration database
- [ ] Native mobile apps
- [ ] External service integrations

---

*Document Version: 1.0*  
*Last Updated: January 2025*  
*System Status: 80+ Features Implemented, Subscriptions In Progress*
