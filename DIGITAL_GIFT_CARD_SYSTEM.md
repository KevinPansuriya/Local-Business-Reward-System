# Digital Gift Card System - Implementation Plan

## 🎯 Your Idea: Digital Gift Cards

**Concept:**
- Customer redeems points → Gets digital gift card
- Gift card valid for 90 days
- Can be used at any time within validity period
- Can be topped up (add more value) or gifted

**This is EXCELLENT because:**
- ✅ Creates return visits (customer must come back to use)
- ✅ Guarantees future revenue for store
- ✅ Flexible for customers (use when convenient)
- ✅ Can be gifted to others
- ✅ Better than immediate discount (drives loyalty)
- ✅ Expiry creates urgency (use within 90 days)

---

## 💡 Enhanced Concept: Digital Gift Cards with Top-Up

### **Core Features:**

1. **Redeem Points for Gift Card**
   - Customer: "I want to redeem 500 Loops for $5 gift card"
   - System: Creates digital gift card with unique code
   - Valid for: 90 days

2. **Top-Up Capability**
   - Customer can add more value to existing gift card
   - Example: Start with $5 → Add $10 more → Now $15 total
   - Each top-up extends validity (or keeps original expiry)

3. **Use Gift Card**
   - Customer shows gift card QR/code at store
   - Store scans → Applies discount
   - Can be used partially (e.g., $5 gift card, $3 purchase = $2 remaining)

4. **Gift to Others**
   - Customer can transfer gift card to another user
   - Share gift card code
   - Friend uses at store

---

## 🎨 User Experience Flow

### **Flow 1: Redeem Points for Gift Card**

```
┌─────────────────────────────────────────┐
│ Step 1: Customer Redeems                 │
└─────────────────────────────────────────┘
Customer opens app → "Redeem Loops"
    ↓
Selects: "Digital Gift Card"
    ↓
Enters: "500 Loops" → "Get $5 Gift Card"
    ↓
System creates gift card:
- Unique code: GC-ABC123XYZ
- Value: $5.00
- Valid for: 90 days
- Expires: Jan 22, 2025
    ↓
Customer sees: "✓ Gift Card Created!"

┌─────────────────────────────────────────┐
│ Step 2: Customer Views Gift Card         │
└─────────────────────────────────────────┘
Customer goes to "My Gift Cards"
    ↓
Sees:
- Gift Card #GC-ABC123XYZ
- Balance: $5.00
- Expires: Jan 22, 2025 (87 days left)
- QR Code for store scanning
    ↓
Options:
- [Use at Store]
- [Top Up] (add more value)
- [Gift to Friend]
- [View History]

┌─────────────────────────────────────────┐
│ Step 3: Customer Uses Gift Card          │
└─────────────────────────────────────────┘
Customer at store checkout
    ↓
Opens app → "My Gift Cards"
    ↓
Shows QR code to cashier
    ↓
Cashier scans QR code
    ↓
System shows:
- Gift Card: GC-ABC123XYZ
- Balance: $5.00
- Customer: Kevin Pansuriya
    ↓
Cashier: "Purchase is $7.00, apply $5.00 gift card?"
    ↓
Customer: "Yes"
    ↓
System:
- Applies $5.00 discount
- Remaining balance: $0.00
- Customer pays: $2.00
    ↓
Gift card marked as "used"
```

---

### **Flow 2: Top-Up Gift Card**

```
┌─────────────────────────────────────────┐
│ Customer Tops Up Gift Card               │
└─────────────────────────────────────────┘
Customer has: $5 gift card (expires in 10 days)
    ↓
Customer: "I want to add $10 more"
    ↓
Options:
1. Use points: 1000 Loops = $10
2. Pay with card: $10
3. Combine: 500 Loops + $5 cash = $10
    ↓
Customer: "Use 1000 Loops"
    ↓
System:
- Adds $10 to gift card
- New balance: $15.00
- Expiry: Extended to 90 days from today
  (or keeps original expiry, your choice)
    ↓
Customer: "✓ Gift card topped up!"
```

---

## 📊 Database Schema

### **Gift Cards Table**

```sql
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,              -- GC-ABC123XYZ
  user_id INTEGER NOT NULL,                -- Owner
  store_id INTEGER,                        -- NULL = any store, or specific store
  original_value REAL NOT NULL,            -- Initial value ($5.00)
  current_balance REAL NOT NULL,           -- Current balance ($5.00)
  loops_used INTEGER,                     -- Points used to create (500 Loops)
  status TEXT DEFAULT 'active',           -- 'active', 'used', 'expired', 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,                     -- 90 days from creation
  used_at DATETIME,                        -- When fully used
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Gift card transactions (top-ups, usage)
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_card_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,          -- 'create', 'topup', 'usage', 'refund'
  amount REAL NOT NULL,                    -- +$10 (topup) or -$5 (usage)
  payment_method TEXT,                     -- 'points', 'cash', 'card', 'combined'
  loops_used INTEGER,                      -- If paid with points
  cash_amount REAL,                        -- If paid with cash
  description TEXT,                        -- "Top-up", "Purchase at Grove Coffee"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id)
);

-- Gift card transfers (gifting to others)
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
```

---

## 🔧 Implementation Plan

### **Phase 1: Basic Gift Card Creation** (Week 1)

**Backend:**
1. Add `gift_cards` table
2. Update `/api/users/redeem` endpoint:
   - Add `redemptionType`: 'discount' or 'gift_card'
   - If gift_card: Create gift card record
   - Generate unique code (GC-XXXXX)
   - Set expiry (90 days)

3. Add `/api/users/gift-cards` endpoint:
   - List user's gift cards
   - Show balance, expiry, status

4. Add `/api/users/gift-cards/:id` endpoint:
   - Get gift card details
   - Generate QR code for scanning

**Frontend:**
1. Update redemption UI:
   - Add "Digital Gift Card" option
   - Show exchange rate (100 Loops = $1)
   - Create gift card
   - Show gift card code/QR

2. Add "My Gift Cards" section:
   - List all gift cards
   - Show balance, expiry
   - QR code for each

---

### **Phase 2: Top-Up Feature** (Week 2)

**Backend:**
1. Add `gift_card_transactions` table
2. Add `/api/users/gift-cards/:id/topup` endpoint:
   - Add value to existing gift card
   - Payment methods: points, cash, card
   - Update balance
   - Extend expiry (optional)

**Frontend:**
1. Add "Top Up" button on gift cards
2. Top-up form:
   - Enter amount
   - Select payment method
   - Confirm top-up

---

### **Phase 3: Store Usage** (Week 2-3)

**Backend:**
1. Add `/api/stores/scan-gift-card` endpoint:
   - Store scans gift card QR
   - Validate gift card
   - Show balance
   - Apply discount

2. Add `/api/stores/use-gift-card` endpoint:
   - Apply gift card to purchase
   - Update balance
   - Record transaction

**Store App:**
1. Add "Scan Gift Card" feature
2. Gift card processing screen
3. Apply discount to purchase

---

### **Phase 4: Gift Transfer** (Week 3)

**Backend:**
1. Add `gift_card_transfers` table
2. Add `/api/users/gift-cards/:id/gift` endpoint:
   - Transfer to another user
   - Or generate transfer code

3. Add `/api/users/gift-cards/claim` endpoint:
   - Claim gift card with code

**Frontend:**
1. Add "Gift to Friend" button
2. Transfer form:
   - Enter friend's phone/email
   - Or generate shareable code

---

## 💰 Exchange Rate Options

### **Option 1: Standard Rate**
- 100 Loops = $1 gift card
- Simple, easy to understand
- 1% return rate

### **Option 2: Tier-Based Rate**
- BRONZE: 100 Loops = $1
- SILVER: 95 Loops = $1
- GOLD: 90 Loops = $1
- PLATINUM: 85 Loops = $1

### **Option 3: Store-Specific Rate**
- Each store sets their own rate
- Coffee shop: 50 Loops = $1 (better rate)
- Restaurant: 100 Loops = $1 (standard)

---

## 🎯 Top-Up Payment Methods

### **Method 1: Points Only**
- Customer: "Add $10 using 1000 Loops"
- Simple, no cash involved

### **Method 2: Cash/Card**
- Customer: "Add $10 using credit card"
- Store gets immediate revenue
- Customer gets gift card value

### **Method 3: Combined**
- Customer: "Add $10 using 500 Loops + $5 cash"
- Flexible payment options

---

## 🎁 Gift Card Features

### **1. Partial Usage**
```
Gift Card: $10 balance
Purchase: $7.00
Applied: $7.00
Remaining: $3.00
Status: Still active
```

### **2. Multiple Uses**
```
Gift Card: $10 balance
Use 1: $3.00 → Balance: $7.00
Use 2: $5.00 → Balance: $2.00
Use 3: $2.00 → Balance: $0.00
Status: Used (fully depleted)
```

### **3. Expiry Management**
```
Created: Jan 1, 2025
Expires: Apr 1, 2025 (90 days)
Today: Jan 15, 2025
Days Left: 76 days
```

### **4. Top-Up Extends Expiry**
```
Original: $5, expires Jan 1
Top-up: $10 on Dec 20
New balance: $15
New expiry: Mar 20 (90 days from top-up)
```

---

## 📱 UI/UX Design

### **Customer App - Gift Cards Section**

```
┌─────────────────────────────────────────┐
│ My Gift Cards                            │
├─────────────────────────────────────────┤
│                                         │
│ 🎁 Gift Card #GC-ABC123                 │
│    Balance: $5.00                       │
│    Expires: Jan 22, 2025 (87 days)      │
│    [QR Code]                            │
│    [Use] [Top Up] [Gift]                │
│                                         │
│ 🎁 Gift Card #GC-XYZ789                 │
│    Balance: $10.00                      │
│    Expires: Feb 15, 2025 (111 days)     │
│    [QR Code]                            │
│    [Use] [Top Up] [Gift]                │
│                                         │
│ [+ Create New Gift Card]                │
│                                         │
└─────────────────────────────────────────┘
```

### **Redeem for Gift Card**

```
┌─────────────────────────────────────────┐
│ Redeem for Digital Gift Card             │
├─────────────────────────────────────────┤
│                                         │
│ Your Balance: 500 Loops                 │
│                                         │
│ Gift Card Value:                        │
│ [$5.00] (500 Loops)                     │
│                                         │
│ Exchange Rate:                          │
│ 100 Loops = $1.00                       │
│                                         │
│ Valid for: 90 days                      │
│                                         │
│ [Create Gift Card]                      │
│                                         │
└─────────────────────────────────────────┘
```

### **Top-Up Gift Card**

```
┌─────────────────────────────────────────┐
│ Top Up Gift Card                         │
├─────────────────────────────────────────┤
│                                         │
│ Current Balance: $5.00                  │
│ Expires: Jan 22, 2025                   │
│                                         │
│ Add Amount:                             │
│ [$10.00]                                │
│                                         │
│ Payment Method:                         │
│ ○ Points (1000 Loops)                   │
│ ○ Credit Card                           │
│ ○ Combined (Points + Cash)              │
│                                         │
│ New Balance: $15.00                     │
│ New Expiry: Apr 20, 2025 (90 days)      │
│                                         │
│ [Confirm Top-Up]                        │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Benefits of This Approach

### **For Customers:**
- ✅ Flexibility (use when convenient)
- ✅ Can be gifted to others
- ✅ Can be topped up (add more value)
- ✅ Valid for 90 days (not immediate pressure)
- ✅ Better than instant discount (more value)

### **For Stores:**
- ✅ Guaranteed return visit (customer must come back)
- ✅ Future revenue (gift card = prepaid purchase)
- ✅ Customer loyalty (must use within 90 days)
- ✅ Can be gifted (brings new customers)
- ✅ Top-up feature (increases value)

### **For Business:**
- ✅ Higher engagement (gift cards used more than discounts)
- ✅ Better retention (90-day validity)
- ✅ Viral growth (gifting feature)
- ✅ Revenue guarantee (prepaid)

---

## 🚀 Recommended Implementation

**Start with:**
1. ✅ Basic gift card creation (redeem points → get gift card)
2. ✅ 90-day validity
3. ✅ QR code for store scanning
4. ✅ Store can process gift card

**Then add:**
5. Top-up feature (add more value)
6. Gift transfer (share with friends)
7. Partial usage (use multiple times)
8. Tier-based rates (better rates for higher tiers)

---

## 💡 My Thoughts

**This is an EXCELLENT idea because:**

1. **Better than immediate discount:**
   - Immediate discount = customer might not return
   - Gift card = guaranteed return visit (must use within 90 days)

2. **Creates urgency:**
   - 90-day expiry creates FOMO
   - Customer will prioritize using it

3. **Flexible for customers:**
   - Use when convenient
   - Can be gifted
   - Can be topped up

4. **Revenue guarantee:**
   - Gift card = prepaid purchase
   - Store gets money upfront (if paid with cash)
   - Or guaranteed future visit (if paid with points)

5. **Viral growth:**
   - Gifting feature brings new customers
   - Friend gets gift card → Tries store → Becomes customer

**This is a WIN-WIN-WIN solution!** 🎉

---

## 🎯 Next Steps

**Should I implement this?** I can build:

1. **Gift Card Creation:**
   - Redeem points → Create gift card
   - Unique code generation
   - 90-day expiry
   - QR code for scanning

2. **Gift Card Management:**
   - View all gift cards
   - Check balance & expiry
   - QR code display

3. **Top-Up Feature:**
   - Add value to existing gift card
   - Payment with points or cash
   - Extend expiry

4. **Store Processing:**
   - Scan gift card QR
   - Apply discount
   - Update balance

**This would be a complete digital gift card system!** 🚀

Would you like me to start implementing this? It's a fantastic feature that will really differentiate your loyalty program!
