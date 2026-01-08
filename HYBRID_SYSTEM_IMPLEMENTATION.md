# Hybrid System Implementation (CIV + DVS) - Complete ✅

## 🎉 Implementation Status: COMPLETE

The hybrid reward system combining **Consumption-Intent Verification (CIV)** and **Delayed Value Settlement (DVS)** has been fully implemented!

---

## 📊 What Was Implemented

### **1. Database Schema** ✅
- `check_in_sessions` - Tracks customer check-ins
- `location_history` - Stores location data for CIV analysis
- `pending_points` - Manages pending points (DVS)
- `settlement_triggers` - Tracks what unlocked points

### **2. Backend API Endpoints** ✅

#### **Check-In System:**
- `POST /api/users/check-in` - Customer checks in by scanning store QR
- `POST /api/users/check-in/location` - Update location during session (for CIV)
- `POST /api/users/check-in/complete` - Complete session and calculate CIV score

#### **Pending Points:**
- `GET /api/users/pending-points` - Get all pending points for user
- `POST /api/users/check-settlement` - Manually trigger settlement check

### **3. CIV (Consumption-Intent Verification)** ✅

**Analyzes behavioral signals:**
1. **Location Dwell Curve** (30% weight)
   - Tracks movement patterns (browsing → checkout → exit)
   - Detects if customer moved around (shopping behavior)

2. **Proximity to Store** (20% weight)
   - Verifies customer stayed near store location
   - Checks average distance from store

3. **Visit Duration** (20% weight)
   - Matches visit duration to category patterns
   - Typical visits: 3-60 minutes

4. **Movement Pattern** (10% weight)
   - Detects multiple stops (browsing behavior)
   - Identifies shopping vs walk-in patterns

5. **Return Probability** (20% weight)
   - Calculated when checking for return visits
   - Real buyers return within 7 days

**CIV Score Calculation:**
- **High confidence (≥0.8)**: Full points awarded
- **Medium confidence (0.6-0.8)**: 70% of points
- **Low confidence (<0.6)**: 30% of points

### **4. DVS (Delayed Value Settlement)** ✅

**How It Works:**
1. Customer checks in → Points awarded (pending)
2. Points visible but marked "unlocking..."
3. Points unlock when ONE of these happens:
   - ✅ **Return visit** - Customer checks in again at same store
   - ✅ **Reward redemption** - Customer redeems at store
   - ✅ **Another purchase** - Customer makes another transaction
   - ✅ **Related visit** - Customer visits related category store
   - ✅ **Offer engagement** - Customer engages with follow-up offer

4. If none happen within 7 days → Points expire

**Settlement Triggers:**
- Automatically checked every 5 minutes
- Checked when customer checks in (potential return visit)
- Manual trigger available via API

### **5. Frontend Integration** ✅

**Customer App Updates:**
- ✅ Check-in flow with QR scanner
- ✅ Location tracking during session
- ✅ Active session display
- ✅ Pending points display in wallet
- ✅ Complete visit button (calculates CIV score)
- ✅ Real-time updates

---

## 🚀 How to Use

### **For Customers:**

1. **Check In:**
   - Open app → Scan store QR code
   - App requests location permission (for CIV)
   - See: "✓ Checked in! X Loops (unlocking...)"

2. **Shop Normally:**
   - Location tracked automatically in background
   - No action needed

3. **Complete Visit (Optional):**
   - Click "Complete Visit" button
   - CIV score calculated based on behavior
   - Points adjusted based on confidence

4. **Unlock Points:**
   - Return to store within 7 days → Points unlock automatically
   - Or redeem reward → Points unlock
   - Or make another purchase → Points unlock

### **For Developers:**

**Run Migration:**
```bash
cd citycircle-backend
node migrate-hybrid-system.js
```

**Test Check-In:**
```bash
POST /api/users/check-in
{
  "qrCode": "STORE:1:abc123",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Get Pending Points:**
```bash
GET /api/users/pending-points
Authorization: Bearer <token>
```

**Check Settlement:**
```bash
POST /api/users/check-settlement
{
  "storeId": 1
}
```

---

## 📈 System Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Customer Checks In                            │
└─────────────────────────────────────────────────┘
Customer scans store QR
    ↓
System creates check-in session
    ↓
System awards pending points (estimated amount)
    ↓
Location tracking starts (for CIV)

┌─────────────────────────────────────────────────┐
│ 2. Customer Shops                                │
└─────────────────────────────────────────────────┘
Location tracked every 5-10 seconds
    ↓
Movement patterns analyzed
    ↓
Dwell curve calculated

┌─────────────────────────────────────────────────┐
│ 3. Customer Completes Visit (Optional)            │
└─────────────────────────────────────────────────┘
Customer clicks "Complete Visit"
    ↓
CIV score calculated:
    - Location dwell curve
    - Proximity to store
    - Visit duration
    - Movement patterns
    ↓
Points adjusted based on CIV score
    ↓
Points remain pending (DVS)

┌─────────────────────────────────────────────────┐
│ 4. Settlement (Automatic)                        │
└─────────────────────────────────────────────────┘
System checks every 5 minutes:
    - Return visit?
    - Reward redemption?
    - Another purchase?
    - Related visit?
    ↓
IF trigger found:
    → Points unlocked
    → Added to balance
    → Notification sent
    ↓
IF no trigger within 7 days:
    → Points expire
```

---

## 🎯 Key Features

### **Zero Cashier Time** ✅
- Customer does everything themselves
- No manual entry needed
- Fully automated

### **Works for Any Amount** ✅
- No pre-generated QR codes
- Estimates based on store/user history
- Adjusts based on CIV score

### **Smart Validation** ✅
- CIV analyzes behavior patterns
- DVS verifies through return visits
- Multiple validation layers

### **Fraud Prevention** ✅
- Must check in to earn points
- CIV detects non-purchase patterns
- DVS requires return visit (real buyers return)
- Points expire if no engagement

### **User-Friendly** ✅
- Points visible immediately
- Clear messaging about unlocking
- Automatic settlement
- No complex UI

---

## 📊 Database Tables

### **check_in_sessions**
- Tracks active check-in sessions
- Expires after 30 minutes
- Links to user and store

### **location_history**
- Stores location points during session
- Used for CIV analysis
- Tracks movement patterns

### **pending_points**
- Stores pending points
- Includes CIV score
- Tracks unlock trigger
- Expires after 7 days

### **settlement_triggers**
- Records what unlocked points
- For analytics and debugging
- Links to pending_points

---

## 🔧 Configuration

**Session Expiry:** 30 minutes (check-in)
**Pending Points Expiry:** 7 days
**Settlement Check Interval:** 5 minutes
**Location Update Interval:** 5-10 seconds

**CIV Score Weights:**
- Location Dwell Curve: 30%
- Proximity to Store: 20%
- Visit Duration: 20%
- Movement Pattern: 10%
- Return Probability: 20%

**Point Adjustment:**
- High confidence (≥0.8): 100% of estimated
- Medium confidence (0.6-0.8): 70% of estimated
- Low confidence (<0.6): 30% of estimated

---

## 🎉 Success!

The hybrid system is now fully operational! Customers can:
1. ✅ Check in by scanning store QR
2. ✅ Earn pending points automatically
3. ✅ See points unlocking when they return
4. ✅ Get validated through behavioral analysis

**No cashier time required!** 🚀
