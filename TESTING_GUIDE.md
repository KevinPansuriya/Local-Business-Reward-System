# Testing Guide: Hybrid System (CIV + DVS)

## 🚀 Quick Start

### **Step 1: Start Backend Server**

```bash
cd citycircle-backend
node server.js
```

You should see:
```
CityCircle backend running at http://localhost:4000
WebSocket server ready for real-time updates
Hybrid system (CIV + DVS) enabled
```

### **Step 2: Start Frontend Server**

In a **new terminal**:

```bash
cd citycircle-frontend
npm run dev
```

You should see:
```
VITE v7.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## 🧪 Testing Scenarios

### **Test 1: Customer Check-In (Basic Flow)**

**Goal:** Test that customer can check in and receive pending points.

**Steps:**
1. Open browser: `http://localhost:5173`
2. Login as a customer (or sign up if new)
3. Go to "Wallet" tab
4. Click "Scan Store QR Code"
5. Scan a store's QR code (or manually enter: `STORE:1:abc123`)
6. **Expected Result:**
   - ✅ Modal shows: "✓ Checked In!"
   - ✅ Shows store name
   - ✅ Shows pending points (e.g., "18 Loops (unlocking...)")
   - ✅ Message: "Points will unlock when you return or engage!"

**Verify in Database:**
```sql
-- Check if session was created
SELECT * FROM check_in_sessions WHERE user_id = 1 ORDER BY id DESC LIMIT 1;

-- Check if pending points were created
SELECT * FROM pending_points WHERE user_id = 1 ORDER BY id DESC LIMIT 1;
```

---

### **Test 2: Location Tracking (CIV)**

**Goal:** Test that location is tracked during check-in session.

**Steps:**
1. Check in to a store (from Test 1)
2. **Allow location permission** when browser prompts
3. Move around (if on mobile) or simulate movement
4. **Expected Result:**
   - ✅ Location permission granted
   - ✅ Location updates sent to backend every 5-10 seconds
   - ✅ Check browser console for location updates

**Verify in Database:**
```sql
-- Check location history
SELECT * FROM location_history 
WHERE session_id = (SELECT id FROM check_in_sessions WHERE user_id = 1 ORDER BY id DESC LIMIT 1)
ORDER BY timestamp;
```

**Check Backend Logs:**
- Should see location update requests in console

---

### **Test 3: Complete Visit (CIV Score Calculation)**

**Goal:** Test that completing a visit calculates CIV score and adjusts points.

**Steps:**
1. Check in to a store
2. Wait a few minutes (simulate shopping)
3. Click "Complete Visit" button in the modal
4. **Expected Result:**
   - ✅ Modal closes
   - ✅ Alert: "Session completed! CIV score calculated."
   - ✅ Pending points adjusted based on CIV score
   - ✅ Location tracking stops

**Verify in Database:**
```sql
-- Check CIV score
SELECT id, loops_pending, civ_score, status 
FROM pending_points 
WHERE user_id = 1 
ORDER BY id DESC LIMIT 1;

-- Check session status
SELECT id, status FROM check_in_sessions 
WHERE user_id = 1 
ORDER BY id DESC LIMIT 1;
-- Should be 'completed'
```

**Expected CIV Scores:**
- **High (≥0.8)**: If you moved around, stayed 3+ minutes, near store
- **Medium (0.6-0.8)**: If you stayed briefly
- **Low (<0.6)**: If you just checked in and completed immediately

---

### **Test 4: Pending Points Display**

**Goal:** Test that pending points are shown in wallet.

**Steps:**
1. Check in to a store (get pending points)
2. Go to "Wallet" tab
3. **Expected Result:**
   - ✅ See "X Loops Pending" section
   - ✅ Shows total pending points
   - ✅ Message: "Unlocking when you return..."

**Verify via API:**
```bash
GET http://localhost:4000/api/users/pending-points
Authorization: Bearer <your-token>
```

**Expected Response:**
```json
{
  "pendingPoints": [
    {
      "id": 1,
      "user_id": 1,
      "store_id": 1,
      "loops_pending": 18,
      "civ_score": 0.75,
      "status": "pending",
      "expires_at": "2024-01-22T12:00:00.000Z",
      "store_name": "Grove Coffee",
      "store_category": "coffee"
    }
  ]
}
```

---

### **Test 5: Return Visit Trigger (DVS Settlement)**

**Goal:** Test that points unlock when customer returns to store.

**Steps:**
1. Check in to Store #1 (get pending points)
2. Complete the visit
3. **Wait a few seconds** (settlement check runs every 5 minutes, or triggers on check-in)
4. Check in to Store #1 **again** (return visit)
5. **Expected Result:**
   - ✅ Previous pending points unlock automatically
   - ✅ Points added to balance
   - ✅ Notification (if WebSocket enabled)

**Verify in Database:**
```sql
-- Check if points were unlocked
SELECT * FROM pending_points 
WHERE user_id = 1 AND store_id = 1 
ORDER BY id DESC LIMIT 1;
-- status should be 'unlocked'
-- unlock_trigger should be 'return_visit'

-- Check settlement trigger
SELECT * FROM settlement_triggers 
WHERE pending_points_id = (SELECT id FROM pending_points WHERE user_id = 1 ORDER BY id DESC LIMIT 1);

-- Check user balance
SELECT loops_balance, total_loops_earned FROM users WHERE id = 1;
```

**Verify via API:**
```bash
GET http://localhost:4000/api/users/me?period=30
Authorization: Bearer <your-token>
```

**Expected:**
- `loops_balance` increased by pending amount
- `total_loops_earned` increased

---

### **Test 6: Manual Settlement Check**

**Goal:** Test manual settlement trigger (for debugging).

**Steps:**
1. Check in to a store (get pending points)
2. Complete the visit
3. **Manually trigger settlement check:**
   ```bash
   POST http://localhost:4000/api/users/check-settlement
   Authorization: Bearer <your-token>
   Body: { "storeId": 1 }
   ```
4. **Expected Result:**
   - ✅ Response: `{ "success": true, "message": "Settlement check completed" }`
   - ✅ If return visit exists, points unlock

---

### **Test 7: Points Expiration**

**Goal:** Test that points expire if no settlement trigger within 7 days.

**Steps:**
1. Check in to a store (get pending points)
2. **Manually expire points** (for testing):
   ```sql
   UPDATE pending_points 
   SET expires_at = datetime('now', '-1 day')
   WHERE user_id = 1 AND status = 'pending';
   ```
3. Wait for settlement check (runs every 5 minutes) or trigger manually
4. **Expected Result:**
   - ✅ Points status changes to 'expired'
   - ✅ Points NOT added to balance

**Verify:**
```sql
SELECT * FROM pending_points 
WHERE user_id = 1 
ORDER BY id DESC LIMIT 1;
-- status should be 'expired'
```

---

### **Test 8: Multiple Stores (Related Visit Trigger)**

**Goal:** Test that visiting a related category store unlocks points.

**Steps:**
1. Check in to Store #1 (Coffee shop, get pending points)
2. Complete the visit
3. Check in to Store #2 (Another coffee shop - same category)
4. **Expected Result:**
   - ✅ Points from Store #1 unlock
   - ✅ `unlock_trigger` = 'related_visit'

**Verify:**
```sql
SELECT * FROM pending_points 
WHERE user_id = 1 AND store_id = 1 
ORDER BY id DESC LIMIT 1;
-- unlock_trigger should be 'related_visit'
```

---

## 🔍 Debugging Tips

### **Check Backend Logs:**
- Settlement checks: Look for "Unlocked X points for user Y via Z"
- Location updates: Check for location_history inserts
- CIV calculations: Check for civ_score updates

### **Check Database:**
```sql
-- Active sessions
SELECT * FROM check_in_sessions WHERE status = 'active';

-- Pending points
SELECT * FROM pending_points WHERE status = 'pending';

-- Location history (last session)
SELECT * FROM location_history 
WHERE session_id = (SELECT MAX(id) FROM check_in_sessions)
ORDER BY timestamp;
```

### **Check Frontend Console:**
- Location permission errors
- API call errors
- WebSocket connection status

### **Common Issues:**

1. **Location not tracking:**
   - Check browser permission
   - Check HTTPS (required for geolocation on some browsers)
   - Check console for errors

2. **Points not unlocking:**
   - Check settlement check interval (5 minutes)
   - Manually trigger: `POST /api/users/check-settlement`
   - Check database for settlement triggers

3. **CIV score always 0.5:**
   - Need location data (move around during session)
   - Need to complete visit (not just check in)
   - Check location_history table has data

---

## 📱 Mobile Testing (Recommended)

For best results, test on a mobile device:

1. **Start ngrok** (for HTTPS):
   ```bash
   ngrok http 5173
   ```

2. **Update backend .env:**
   ```
   ORIGIN=https://your-ngrok-url.ngrok-free.app
   RP_ID=your-ngrok-url.ngrok-free.app
   ```

3. **Access frontend via ngrok URL** on mobile
4. **Test location tracking** (works better on mobile)

---

## ✅ Success Criteria

**System is working correctly if:**
- ✅ Customer can check in and see pending points
- ✅ Location is tracked during session
- ✅ CIV score calculated on complete visit
- ✅ Points unlock when customer returns
- ✅ Points expire if no return within 7 days
- ✅ Multiple settlement triggers work

---

## 🎯 Quick Test Checklist

- [ ] Backend server running
- [ ] Frontend server running
- [ ] Customer can check in
- [ ] Pending points visible
- [ ] Location tracking works
- [ ] Complete visit calculates CIV
- [ ] Return visit unlocks points
- [ ] Points expire correctly

---

**Ready to test!** Start with Test 1 and work through each scenario. 🚀
