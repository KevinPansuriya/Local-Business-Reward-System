# Implementation Steps for Friction Reduction

## 🚀 Quick Start Guide

### Step 1: Run Migration (Required First)

```bash
cd citycircle-backend
node migrations/add-category-profiles.js
```

This will:
- ✅ Create `category_profiles` table
- ✅ Insert default category profiles
- ✅ Add `check_in_method` column to `check_in_sessions`
- ✅ Add NFC fields to `stores` table

### Step 2: Update server.js

**Location**: `citycircle-backend/server.js`

**Changes needed**:

1. **Add import at top**:
```javascript
const { canCheckIn, getCategoryProfile } = require('./services/categoryProfiles');
```

2. **Add helper functions** (after line 855, before check-in endpoint):
```javascript
// Helper functions for loop calculation
function getPlanMultiplier(plan) {
    if (plan === "BASIC") return 1.1;
    if (plan === "PLUS") return 1.15;
    if (plan === "PREMIUM") return 1.2;
    return 1.0; // STARTER
}

function getTierMultiplier(totalLoopsEarned) {
    if (totalLoopsEarned >= 1000) return 1.2; // PLATINUM
    if (totalLoopsEarned >= 500) return 1.1;  // GOLD
    if (totalLoopsEarned >= 200) return 1.05; // SILVER
    return 1.0; // BRONZE
}
```

3. **Update check-in endpoint** (replace lines 858-1063):

See the updated endpoint code in `FRICTION_REDUCTION_IMPLEMENTATION.md` (Phase 1 section).

**Key changes**:
- Support both `qrCode` and `storeId` parameters
- Support `checkInMethod` parameter ('qr' | 'nfc' | 'wallet')
- Use `canCheckIn()` instead of 24-hour cooldown
- Split loops into instant and pending based on category profile
- Return `loopsInstant` and `loopsPending` separately

### Step 3: Update Frontend API

**Location**: `citycircle-frontend/src/api.js`

**Update checkIn function**:
```javascript
export function checkIn(token, qrCode, latitude, longitude, checkInMethod = 'qr', storeId = null) {
    return fetch(`${API_URL}/users/check-in`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
            qrCode, 
            storeId,  // NEW: Support direct storeId for NFC
            latitude, 
            longitude,
            checkInMethod  // NEW: Track check-in method
        }),
    }).then(async (res) => {
        if (res.status === 429) {
            const data = await res.json();
            throw new Error(data.error || "Please wait before checking in again");
        }
        return handle(res);
    });
}
```

### Step 4: Update Frontend UI

**Location**: `citycircle-frontend/src/CustomerApp.jsx`

**Update check-in success handler**:
```javascript
const handleCheckInSuccess = (data) => {
    setActiveSession({
        sessionId: data.sessionId,
        store: data.store,
        expiresAt: data.expiresAt
    });
    
    // Show success message with instant + pending breakdown
    if (data.loopsInstant > 0 && data.loopsPending > 0) {
        setSuccessMsg(`✓ Checked in! You earned ${data.loopsInstant} loops now, ${data.loopsPending} more pending.`);
    } else if (data.loopsInstant > 0) {
        setSuccessMsg(`✓ Checked in! You earned ${data.loopsInstant} loops!`);
    } else if (data.loopsPending > 0) {
        setSuccessMsg(`✓ Checked in! ${data.loopsPending} loops pending (unlocks after your visit is confirmed).`);
    }
    
    // Refresh user data
    fetchUserMe({ token, period, storeId })
        .then((data) => setUser(data.user))
        .catch((e) => console.error("Failed to refresh user:", e));
    
    // Refresh pending points
    getPendingPoints(token)
        .then((data) => setPendingPoints(data.pendingPoints || []))
        .catch((e) => console.error("Failed to load pending points:", e));
};
```

**Update check-in call** (wherever checkIn is called):
```javascript
// OLD:
const data = await checkIn(token, qrCode, user?.latitude, user?.longitude);

// NEW:
const data = await checkIn(token, qrCode, user?.latitude, user?.longitude, 'qr', null);
```

### Step 5: Test

1. **Test laundromat**: Create a store with category 'laundromat', check in twice in one day
2. **Test liquor store**: Create a store with category 'liquor', check in 3 times in one day
3. **Test barber**: Create a store with category 'barber', verify 14-day cooldown
4. **Test instant + pending**: Verify loops are split correctly

---

## 📝 Files Created/Modified

### New Files
- ✅ `citycircle-backend/services/categoryProfiles.js` - Category profile service
- ✅ `citycircle-backend/migrations/add-category-profiles.js` - Migration script
- ✅ `FRICTION_REDUCTION_IMPLEMENTATION.md` - Full implementation guide

### Files to Modify
- ⏳ `citycircle-backend/server.js` - Update check-in endpoint
- ⏳ `citycircle-frontend/src/api.js` - Update checkIn function
- ⏳ `citycircle-frontend/src/CustomerApp.jsx` - Update UI for instant/pending

---

## 🎯 Next Steps After Phase 1

1. **Phase 2**: Add NFC support (when ready)
2. **Phase 3**: Improve DVS UI/UX (can do in parallel)
3. **Phase 4**: Wallet integration (future)

---

*Ready to implement! Start with Step 1 (migration).*
