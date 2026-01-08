# Point Redemption System - Ideas & Implementation

## 🎯 Current System

**What exists now:**
- Basic redemption: Enter amount → Redeem
- Points deducted from balance
- No specific redemption item/benefit
- Just a simple point deduction

**What's missing:**
- What can customers redeem?
- Where can they redeem?
- How do they redeem at stores?
- What's the value/exchange rate?

---

## 💡 Redemption Ideas & Models

### **Model 1: Discount Redemption (Most Common)** ⭐⭐⭐⭐⭐

**How it works:**
- Customer earns points (Loops) → Can redeem for discounts
- Exchange rate: Example - 100 Loops = $1 discount

**Redemption options:**

#### **A. Percentage Discount**
- 50 Loops = 5% off
- 100 Loops = 10% off
- 200 Loops = 20% off

#### **B. Fixed Dollar Discount**
- 100 Loops = $1 off
- 200 Loops = $2 off
- 500 Loops = $5 off

#### **C. Store-Specific Discounts**
- Each store sets their own redemption rates
- Store can offer better rates to attract customers
- Example: Coffee shop offers 50 Loops = $1 off (better rate)

**Implementation:**
```
Customer: "I want to redeem 100 Loops for $1 discount"
Store: Scans customer QR → Enters discount amount
System: Deducts 100 Loops → Applies $1 discount to purchase
```

---

### **Model 2: Free Item Redemption** ⭐⭐⭐⭐

**How it works:**
- Customer redeems points for free items
- Store defines redemption items and prices

**Examples:**

#### **Coffee Shop:**
- 50 Loops = Free small coffee
- 100 Loops = Free medium coffee
- 150 Loops = Free large coffee
- 200 Loops = Free coffee + pastry

#### **Restaurant:**
- 300 Loops = Free appetizer
- 500 Loops = Free dessert
- 800 Loops = Free main course

#### **Grocery Store:**
- 200 Loops = $2 off any item
- 500 Loops = Free bread
- 1000 Loops = Free rotisserie chicken

**Implementation:**
```
Store creates redemption catalog:
- Item: "Free Small Coffee"
- Price: 50 Loops
- Description: "Redeemable at any Grove Coffee location"

Customer: Scans store QR → Views redemption catalog → Selects item → Redeems
Store: Processes redemption → Gives free item
```

---

### **Model 3: Tier-Based Redemption** ⭐⭐⭐⭐

**How it works:**
- Higher tiers get better redemption rates
- Encourages loyalty and spending

**Example:**
- **BRONZE:** 100 Loops = $1 (1%)
- **SILVER:** 95 Loops = $1 (1.05%)
- **GOLD:** 90 Loops = $1 (1.11%)
- **PLATINUM:** 85 Loops = $1 (1.18%)

**Benefits:**
- Rewards loyal customers
- Encourages more spending
- Higher value for higher tiers

---

### **Model 4: Cashback Redemption** ⭐⭐⭐

**How it works:**
- Redeem points for cash/credit
- Store can choose to offer this

**Example:**
- 100 Loops = $1 cashback
- Redeemable via store credit or payment method

**Use cases:**
- Large stores (grocery, retail)
- High-value redemptions
- Store credit system

---

### **Model 5: Digital Vouchers/Coupons** ⭐⭐⭐⭐

**How it works:**
- Redeem points for digital vouchers
- Vouchers can be used later or gifted

**Examples:**
- 200 Loops = $5 voucher (valid 30 days)
- 500 Loops = $10 voucher (valid 60 days)
- 1000 Loops = $20 voucher (valid 90 days)

**Benefits:**
- Flexibility for customers
- Can be gifted
- Store gets return visits
- Expiry creates urgency

---

## 🏪 Redemption at Store - User Flow

### **Flow 1: Customer-Initiated (Recommended)** ⭐⭐⭐⭐⭐

**Step 1: Customer Redeems in App**
```
Customer opens app → "Wallet" tab → "Redeem Loops"
Customer selects store → Views redemption options → Selects item
Customer confirms: "Redeem 100 Loops for $1 discount"
System: Creates redemption QR code with:
- User ID
- Redemption ID
- Amount/Item
- Expiry (30 minutes)
```

**Step 2: Customer Shows QR at Store**
```
Customer: Shows redemption QR code at checkout
Cashier: Scans QR code
System: Validates redemption → Applies discount/free item
Store: Processes payment with discount
Customer: Purchase completed with discount
```

**Step 3: Store Processes Redemption**
```
Store scans redemption QR
System shows:
- Customer name
- Redemption item: "$1 discount"
- Points to deduct: 100 Loops
Store clicks "Apply Redemption"
Points deducted from customer
Discount applied to purchase
Done!
```

---

### **Flow 2: Store-Initiated (Alternative)**

**Step 1: Customer Shows QR at Store**
```
Customer: Shows membership QR at checkout
Cashier: Scans QR → Sees customer balance
Cashier: Asks "Would you like to redeem points?"
Customer: "Yes, redeem 100 Loops"
```

**Step 2: Store Processes Redemption**
```
Cashier: Opens redemption screen → Selects "$1 discount"
System: Validates → Deducts 100 Loops
Discount applied to purchase
Done!
```

---

## 🎨 UI/UX Ideas

### **Customer App - Redemption Screen**

```
┌─────────────────────────────────────────┐
│ Redeem Loops                             │
├─────────────────────────────────────────┤
│                                         │
│ Your Balance: 211 Loops                 │
│                                         │
│ Select Store:                           │
│ [Grove Coffee ▼]                        │
│                                         │
│ Available Redemptions:                  │
│                                         │
│ ☕ Free Small Coffee                     │
│    50 Loops                              │
│    [Redeem]                              │
│                                         │
│ 🍰 $1 Discount                           │
│    100 Loops                             │
│    [Redeem]                              │
│                                         │
│ ☕ Free Large Coffee                     │
│    150 Loops                             │
│    [Redeem]                              │
│                                         │
│ 🎁 $5 Gift Voucher                      │
│    500 Loops                             │
│    [Redeem]                              │
│                                         │
└─────────────────────────────────────────┘
```

### **Redemption Confirmation**

```
┌─────────────────────────────────────────┐
│ ✓ Redemption Created                    │
├─────────────────────────────────────────┤
│                                         │
│ Item: $1 Discount                       │
│ Points Used: 100 Loops                  │
│ New Balance: 111 Loops                  │
│                                         │
│ Show this QR code at checkout:          │
│                                         │
│    [QR CODE]                            │
│                                         │
│ Valid for: 30 minutes                  │
│                                         │
│ [Show QR Code] [Cancel]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📊 Database Schema Additions

### **Redemption Catalog (Store-Defined Items)**

```sql
CREATE TABLE IF NOT EXISTS redemption_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  name TEXT NOT NULL,                    -- "Free Small Coffee"
  description TEXT,                       -- "Redeemable at any location"
  loops_cost INTEGER NOT NULL,            -- 50 Loops
  discount_type TEXT,                     -- 'percentage', 'fixed', 'free_item'
  discount_value REAL,                    -- 5 (for 5% or $5)
  is_active BOOLEAN DEFAULT 1,
  expires_at DATETIME,                    -- Optional expiry
  max_redemptions_per_day INTEGER,        -- Limit per customer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

### **Redemptions (Customer Redemption Records)**

```sql
CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  redemption_item_id INTEGER,             -- Which item was redeemed
  loops_used INTEGER NOT NULL,
  discount_amount REAL,                   -- Actual discount applied
  redemption_code TEXT UNIQUE,            -- QR code identifier
  status TEXT DEFAULT 'pending',          -- 'pending', 'used', 'expired', 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,                    -- 30 minutes from creation
  used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (redemption_item_id) REFERENCES redemption_items(id)
);
```

---

## 🔧 Implementation Plan

### **Phase 1: Basic Discount Redemption** (Week 1)

**Backend:**
1. Update `/api/users/redeem` endpoint:
   - Add `storeId` parameter
   - Add `discountType` (percentage/fixed)
   - Add `discountValue`
   - Create redemption record
   - Generate redemption QR code

2. Add `/api/stores/redeem-items` endpoint:
   - Store can create/edit redemption items
   - List available redemptions

3. Add `/api/stores/process-redemption` endpoint:
   - Store scans redemption QR
   - Validates redemption
   - Applies discount
   - Marks as used

**Frontend:**
1. Update redemption UI:
   - Show store selection
   - Show available redemptions
   - Generate redemption QR code
   - Show confirmation

2. Store app:
   - Redemption processing screen
   - Scan redemption QR
   - Apply discount

---

### **Phase 2: Redemption Catalog** (Week 2)

**Backend:**
1. Add `redemption_items` table
2. CRUD endpoints for redemption items
3. Store can manage catalog

**Frontend:**
1. Store dashboard: Manage redemption catalog
2. Customer app: Browse redemption options

---

### **Phase 3: Advanced Features** (Week 3)

1. Tier-based redemption rates
2. Digital vouchers
3. Gift redemption
4. Redemption analytics
5. Expiry management

---

## 💰 Exchange Rate Recommendations

### **Standard Rates:**

**Basic (BRONZE tier):**
- 100 Loops = $1 discount (1% return)
- 50 Loops = 5% off (up to $5 purchase)
- 200 Loops = 10% off (up to $20 purchase)

**Premium (PLATINUM tier):**
- 85 Loops = $1 discount (1.18% return)
- Better rates for loyal customers

### **Store-Specific Examples:**

**Coffee Shop:**
- 50 Loops = Free small coffee (typically $3-4)
- 100 Loops = Free large coffee (typically $5-6)
- Better value encourages redemption

**Restaurant:**
- 300 Loops = $3 discount (1% return)
- 500 Loops = Free appetizer (value: $8-12)
- 800 Loops = Free main course (value: $15-20)

**Grocery Store:**
- 100 Loops = $1 off (standard)
- 500 Loops = 10% off (up to $50)
- Volume discounts encourage larger purchases

---

## 🎯 Recommended Approach

**Start with: Simple Discount Redemption**

1. **Customer Flow:**
   - Customer enters amount to redeem (e.g., 100 Loops)
   - System generates redemption QR code
   - Customer shows QR at store
   - Store scans → Applies discount

2. **Exchange Rate:**
   - 100 Loops = $1 discount
   - Simple, easy to understand

3. **Store Flow:**
   - Store scans customer QR (membership)
   - Store can see: "Customer has 211 Loops"
   - Store asks: "Would you like to redeem?"
   - Customer: "Yes, redeem 100 Loops for $1 off"
   - Store: Processes redemption → Applies discount

---

## 🚀 Next Steps

1. **Implement basic discount redemption**
2. **Add store redemption processing**
3. **Create redemption QR codes**
4. **Test redemption flow**
5. **Add redemption catalog (later)**

**Should I implement the basic discount redemption system?** It would include:
- Redeem points for discounts
- Generate redemption QR codes
- Store can process redemptions
- Simple exchange rate (100 Loops = $1)

Let me know if you want me to implement this! 🎉
