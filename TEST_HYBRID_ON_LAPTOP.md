# Testing Hybrid System (CIV + DVS) on Laptop

## ✅ Yes, You Can Test Everything on Laptop!

Testing on laptop is actually **easier** because:
- ✅ No ngrok needed (use localhost)
- ✅ Camera works (with permission)
- ✅ Location works (can simulate)
- ✅ WebAuthn works on localhost
- ✅ Easier debugging

---

## 🚀 Quick Setup

### **Step 1: Start Backend**

```bash
cd citycircle-backend
node server.js
```

Should see:
```
CityCircle backend running at http://localhost:4000
WebSocket server ready for real-time updates
Hybrid system (CIV + DVS) enabled
```

### **Step 2: Start Frontend**

```bash
cd citycircle-frontend
npm run dev
```

Should see:
```
VITE v7.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### **Step 3: Open in Browser**

1. Open browser: `http://localhost:5173`
2. Login as customer
3. Start testing!

---

## 🧪 Testing Scenarios

### **Test 1: Basic Check-In**

**Goal:** Test customer check-in and pending points

**Steps:**
1. Login as customer
2. Go to "Wallet" tab
3. Click "Scan Store QR Code"
4. For QR code, you can either:
   - **Option A:** Use your phone to display a store QR code and scan it with laptop camera
   - **Option B:** Manually enter QR code: `STORE:1:abc123` (if you know a store ID)
   - **Option C:** Create a test QR code image and scan it

5. **Expected Result:**
   - ✅ "✓ Checked In!" modal appears
   - ✅ Shows store name
   - ✅ Shows pending points (e.g., "18 Loops (unlocking...)")
   - ✅ Message: "Points will unlock when you return or engage!"

**Verify in Database:**
```sql
-- Check session
SELECT * FROM check_in_sessions ORDER BY id DESC LIMIT 1;

-- Check pending points
SELECT * FROM pending_points ORDER BY id DESC LIMIT 1;
```

---

### **Test 2: Location Tracking (CIV)**

**Goal:** Test location tracking during check-in

**Steps:**
1. Check in to a store (from Test 1)
2. **Allow location permission** when browser prompts
3. **Move your laptop around** (or simulate movement)
4. Open browser console (F12) → Check for location updates

**Expected:**
- ✅ Location permission granted
- ✅ Location updates logged in console
- ✅ Backend receives location updates

**Verify Location Data:**
```sql
-- Check location history
SELECT * FROM location_history 
WHERE session_id = (SELECT MAX(id) FROM check_in_sessions)
ORDER BY timestamp;
```

**Note:** On laptop, location might be less accurate, but it will still work for testing!

---

### **Test 3: Complete Visit (CIV Score)**

**Goal:** Test CIV score calculation

**Steps:**
1. Check in to a store
2. **Wait 5-10 minutes** (simulate shopping)
3. **Optionally move around** (to simulate browsing)
4. Click "Complete Visit" button in modal
5. **Expected Result:**
   - ✅ Modal closes
   - ✅ Alert: "Session completed! CIV score calculated."
   - ✅ CIV score calculated based on:
     - Visit duration
     - Location data
     - Movement patterns

**Verify CIV Score:**
```sql
-- Check CIV score
SELECT id, loops_pending, civ_score, status 
FROM pending_points 
ORDER BY id DESC LIMIT 1;
```

**Expected CIV Scores:**
- **High (≥0.8)**: If you waited 5+ min and moved around
- **Medium (0.6-0.8)**: If you waited 2-5 min
- **Low (<0.6)**: If you completed immediately

**Points Adjustment:**
- High confidence: 100% of estimated points
- Medium confidence: 70% of estimated points
- Low confidence: 30% of estimated points

---

### **Test 4: Return Visit Trigger (DVS)**

**Goal:** Test that points unlock when customer returns

**Steps:**
1. Check in to Store #1 (get pending points)
2. Complete the visit
3. **Wait a few seconds** (settlement check runs every 5 min)
4. **Check in to Store #1 again** (simulate return visit)
5. **Expected Result:**
   - ✅ Previous pending points unlock automatically
   - ✅ Points added to balance
   - ✅ Notification in console

**Verify Points Unlocked:**
```sql
-- Check if points were unlocked
SELECT * FROM pending_points 
ORDER BY id DESC LIMIT 1;
-- status should be 'unlocked'
-- unlock_trigger should be 'return_visit'

-- Check user balance
SELECT loops_balance, total_loops_earned FROM users WHERE id = 1;
```

**Manual Settlement Check (if needed):**
```bash
# In browser console or Postman
POST http://localhost:4000/api/users/check-settlement
Authorization: Bearer YOUR_TOKEN
Body: { "storeId": 1 }
```

---

### **Test 5: Multiple Stores**

**Goal:** Test related visit trigger

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
WHERE store_id = 1 
ORDER BY id DESC LIMIT 1;
-- unlock_trigger should be 'related_visit'
```

---

### **Test 6: Points Expiration**

**Goal:** Test that points expire if no return

**Steps:**
1. Check in to a store (get pending points)
2. **Manually expire points** (for testing):
   ```sql
   UPDATE pending_points 
   SET expires_at = datetime('now', '-1 day')
   WHERE status = 'pending' AND id = (SELECT MAX(id) FROM pending_points);
   ```
3. Trigger settlement check:
   ```bash
   POST http://localhost:4000/api/users/check-settlement
   ```
4. **Expected Result:**
   - ✅ Points status = 'expired'
   - ✅ Points NOT added to balance

**Verify:**
```sql
SELECT * FROM pending_points 
WHERE status = 'expired'
ORDER BY id DESC LIMIT 1;
```

---

## 🔍 Debugging Tips

### **Check Backend Logs:**

Look for:
- "Unlocked X points for user Y via Z" (settlement)
- Location update requests
- CIV score calculations

### **Check Frontend Console (F12):**

Look for:
- Location permission requests
- API call responses
- Error messages

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

-- Settlement triggers
SELECT * FROM settlement_triggers ORDER BY id DESC LIMIT 5;
```

---

## 📱 Simulating Mobile Behavior

### **Simulate Movement:**

1. **Option 1:** Walk around with laptop
   - Location will update naturally

2. **Option 2:** Use browser DevTools
   - F12 → Console
   - Override geolocation:
   ```javascript
   navigator.geolocation.getCurrentPosition = function(success) {
     success({
       coords: {
         latitude: 40.7128 + (Math.random() * 0.01),
         longitude: -74.0060 + (Math.random() * 0.01),
         accuracy: 10
       }
     });
   };
   ```

3. **Option 3:** Manually insert location data
   ```sql
   INSERT INTO location_history (session_id, latitude, longitude, accuracy)
   VALUES 
     (1, 40.7128, -74.0060, 10),
     (1, 40.7130, -74.0062, 10),
     (1, 40.7132, -74.0064, 10);
   ```

---

## 🎯 Testing Checklist

- [ ] Backend running (`http://localhost:4000`)
- [ ] Frontend running (`http://localhost:5173`)
- [ ] Customer can check in
- [ ] Pending points visible
- [ ] Location tracking works (allow permission)
- [ ] Complete visit calculates CIV score
- [ ] Return visit unlocks points
- [ ] Points expire correctly
- [ ] Multiple stores work

---

## 💡 Tips for Better Testing

1. **Use Multiple Browser Windows:**
   - Window 1: Customer view
   - Window 2: Store view (if testing store side)
   - Window 3: Database viewer

2. **Use Browser DevTools:**
   - Network tab: See API calls
   - Console: See logs and errors
   - Application: Check localStorage/sessionStorage

3. **Create Test Data:**
   - Create multiple stores
   - Create multiple customers
   - Test different scenarios

4. **Use SQLite Browser:**
   - Install DB Browser for SQLite
   - Open `citycircle.db`
   - View/edit data directly

---

## 🚀 Quick Start Command

Create `test-hybrid.bat` (Windows):

```batch
@echo off
echo Starting Hybrid System Test Environment...

start cmd /k "cd citycircle-backend && node server.js"
timeout /t 3
start cmd /k "cd citycircle-frontend && npm run dev"
timeout /t 2

echo.
echo Backend: http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser!
pause
```

---

## ✅ Success Indicators

**System is working if:**
- ✅ Check-in creates session and pending points
- ✅ Location tracking records data
- ✅ CIV score calculated (0.0 to 1.0)
- ✅ Points adjust based on CIV score
- ✅ Return visit unlocks points
- ✅ Points expire if no return

---

## 🎉 You're Ready!

Testing on laptop is actually **easier** than mobile:
- No ngrok needed
- Faster iteration
- Better debugging
- All features work

**Just remember:**
- Allow location permission when prompted
- Wait a few minutes between check-ins for CIV to calculate
- Check database to verify everything is working

Happy testing! 🚀
