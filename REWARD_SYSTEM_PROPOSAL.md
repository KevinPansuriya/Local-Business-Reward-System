# CityCircle Reward System - Current State & Proposed Flow

## 📊 Current Reward System (How It Works Now)

### Current Flow:
1. **Store scans customer QR code** → Identifies customer
2. **Store enters purchase amount** → e.g., $25.00
3. **System calculates Loops earned:**
   - **Base Loops:** 1 Loop per $1 spent
   - **Visit Bonus:** +10 Loops per visit
   - **Plan Multiplier:**
     - STARTER: 1.0x
     - BASIC: 1.05x (5% bonus)
     - PLUS: 1.1x (10% bonus)
     - PREMIUM: 1.2x (20% bonus)
   - **Tier Multiplier** (based on lifetime Loops earned):
     - BRONZE (0-199): 1.0x
     - SILVER (200-499): 1.05x
     - GOLD (500-999): 1.1x
     - PLATINUM (1000+): 1.2x

### Example Calculation:
- Purchase: $25.00
- Base: 25 Loops
- Visit Bonus: +10 Loops
- Subtotal: 35 Loops
- Plan (PREMIUM): 35 × 1.2 = 42 Loops
- Tier (GOLD): 42 × 1.1 = **46 Loops earned**

### Current Limitations:
- Store must scan customer QR code (one-way interaction)
- Customer is passive in the process
- No "check-in" or session management

---

## 🎯 Proposed Flow (Your Vision)

### New Customer-Initiated Flow:

#### **Step 1: Customer Scans Store QR Code** 📱
- Customer opens app and scans store's QR code
- This creates a "check-in" or "active session"
- Customer is now "checked in" to that store
- Store can see customer is ready to make a purchase

#### **Step 2: Customer Makes Purchase** 💰
- Customer shops and selects items
- At checkout, customer shows their QR code to store
- Store scans customer QR code (or customer is already identified from check-in)

#### **Step 3: Store Processes Transaction** ✅
- Store enters purchase amount
- System automatically links transaction to the checked-in customer
- Loops are calculated and awarded
- Customer receives notification of Loops earned

---

## 🏗️ Implementation Options

### **Option A: Check-In Session System** (Recommended)
**How it works:**
1. Customer scans store QR → Creates a "session" record
2. Session is active for X minutes (e.g., 30 minutes)
3. Store can see active sessions/customers
4. When processing transaction, store selects from active sessions OR scans customer QR

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS check_in_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired'
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

**Benefits:**
- Customer-initiated interaction
- Store can see who's shopping
- Prevents accidental wrong customer selection
- Can track visit patterns

---

### **Option B: Simplified Flow** (Easier to implement)
**How it works:**
1. Customer scans store QR → Just shows store info (current behavior)
2. Customer shops normally
3. At checkout: Customer shows their QR code
4. Store scans customer QR → Processes transaction

**No database changes needed** - Just improve UX flow

**Benefits:**
- Simpler implementation
- Customer still initiates by scanning store QR
- Familiar checkout flow

---

### **Option C: Hybrid Approach** (Best UX)
**How it works:**
1. Customer scans store QR → Creates check-in session
2. Customer shops
3. At checkout:
   - **Option 1:** Store sees customer in "active sessions" list
   - **Option 2:** Customer shows QR code, store scans it
   - Both methods work!

**Benefits:**
- Flexible for stores
- Better customer experience
- Reduces errors

---

## 💡 Recommended Implementation: Option C (Hybrid)

### **Phase 1: Check-In System**
1. Add `check_in_sessions` table
2. When customer scans store QR:
   - Create check-in session (expires in 30 minutes)
   - Show customer: "You're checked in at [Store Name]"
   - Show store: "New customer checked in: [Customer Name]"

### **Phase 2: Store Dashboard Enhancement**
1. Add "Active Customers" section showing:
   - Customer name
   - Check-in time
   - Phone number
   - "Process Transaction" button
2. Keep existing "Scan Customer QR" functionality

### **Phase 3: Transaction Processing**
1. When store clicks "Process Transaction" from active session:
   - Pre-fill customer ID
   - Store enters amount
   - Transaction processed
   - Session marked as "completed"

### **Phase 4: Notifications** (Future)
- Real-time updates when customer checks in
- Customer notification when Loops are earned
- Store notification when transaction completes

---

## 🔄 Current vs Proposed Flow Comparison

### **Current Flow:**
```
Store → Scans Customer QR → Enters Amount → Transaction Created
```

### **Proposed Flow:**
```
Customer → Scans Store QR → Checks In
    ↓
Customer Shops
    ↓
Checkout: Customer shows QR OR Store selects from active sessions
    ↓
Store → Enters Amount → Transaction Created
```

---

## 📱 UI/UX Changes Needed

### **Customer App:**
1. **After scanning store QR:**
   - Show: "✓ Checked in at [Store Name]"
   - Show: "Show this QR code at checkout"
   - Add timer: "Session expires in 29:45"

2. **Wallet Tab:**
   - Keep QR code display
   - Add "Active Check-In" indicator if checked in

### **Store App:**
1. **Dashboard:**
   - Add "Active Customers" section
   - Show list of checked-in customers
   - Each customer has "Process Transaction" button

2. **Transaction Flow:**
   - Option 1: Click customer from active list
   - Option 2: Scan customer QR (existing flow)
   - Both lead to same transaction form

---

## 🎁 Reward System Details (Keep Current)

### **Loops Calculation:**
- Base: 1 Loop per $1
- Visit Bonus: +10 Loops
- Plan Multiplier: 1.0x - 1.2x
- Tier Multiplier: 1.0x - 1.2x

### **Tier System:**
- **BRONZE:** 0-199 Loops (1.0x multiplier)
- **SILVER:** 200-499 Loops (1.05x multiplier)
- **GOLD:** 500-999 Loops (1.1x multiplier)
- **PLATINUM:** 1000+ Loops (1.2x multiplier)

### **Plan System:**
- **STARTER:** Free (1.0x multiplier)
- **BASIC:** Paid (1.05x multiplier)
- **PLUS:** Paid (1.1x multiplier)
- **PREMIUM:** Paid (1.2x multiplier)

---

## 🚀 Next Steps

1. **Decide on approach:** Option A, B, or C?
2. **Implement check-in system** (if Option A or C)
3. **Update store dashboard** to show active customers
4. **Enhance customer app** with check-in confirmation
5. **Test end-to-end flow**
6. **Add real-time notifications** (optional)

---

## ❓ Questions to Consider

1. **Session Duration:** How long should a check-in session last? (30 min? 1 hour?)
2. **Multiple Stores:** Can customer check in to multiple stores simultaneously?
3. **Auto-Expire:** Should sessions auto-expire or require manual completion?
4. **Notifications:** Real-time push notifications or in-app only?
5. **Analytics:** Track check-ins vs actual purchases for conversion metrics?

---

Would you like me to implement **Option C (Hybrid Approach)**? It provides the best balance of features and user experience!
