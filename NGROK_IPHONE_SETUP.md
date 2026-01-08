# ngrok Setup for iPhone Testing

## 🎯 Problem

- Camera requires HTTPS on iOS Safari
- WebAuthn/Face ID requires HTTPS
- Local IP (`http://10.0.0.244:5173`) doesn't work for these features
- ngrok not working on iPhone but works on laptop

## ✅ Solution: Proper ngrok Setup

### **Step 1: Start Backend with ngrok**

**Terminal 1 - Backend:**
```bash
cd citycircle-backend
node server.js
```

**Terminal 2 - ngrok for Backend:**
```bash
ngrok http 4000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### **Step 2: Update Backend .env**

Edit `citycircle-backend/.env`:
```env
PORT=4000
JWT_SECRET=your_secret_here

# ngrok URLs (update with your actual ngrok URL)
RP_ID=abc123.ngrok-free.app
RP_NAME=CityCircle
ORIGIN=https://abc123.ngrok-free.app

# Frontend URL (will be set in next step)
FRONTEND_URL=https://xyz789.ngrok-free.app
```

**Restart backend** after updating .env

### **Step 3: Start Frontend with ngrok**

**Terminal 3 - Frontend:**
```bash
cd citycircle-frontend
npm run dev
```

**Terminal 4 - ngrok for Frontend:**
```bash
ngrok http 5173
```

Copy the HTTPS URL (e.g., `https://xyz789.ngrok-free.app`)

### **Step 4: Update Frontend Vite Config (if needed)**

The frontend should already be configured, but verify `vite.config.js`:

```javascript
export default {
  server: {
    host: '0.0.0.0', // Allow network access
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    fs: {
      allow: ['.', '..', '.ngrok-free.app', '.ngrok.io', '.ngrok.app']
    }
  }
}
```

### **Step 5: Update API URL (if needed)**

If the frontend can't reach backend through proxy, update `citycircle-frontend/src/api.js`:

```javascript
// For ngrok testing, you might need to set this:
const API_URL = import.meta.env.VITE_API_URL || "https://abc123.ngrok-free.app/api";
```

Or create `citycircle-frontend/.env`:
```env
VITE_API_URL=https://abc123.ngrok-free.app/api
```

### **Step 6: Access on iPhone**

1. **Open Safari on iPhone**
2. **Navigate to:** `https://xyz789.ngrok-free.app`
3. **Accept ngrok warning** (if shown)
4. **Allow camera permission** when prompted
5. **Test WebAuthn/Face ID** (should work now)

---

## 🔧 Troubleshooting

### **Issue: ngrok not working on iPhone**

**Solution 1: Use ngrok's static domain**
```bash
# Sign up for ngrok account (free)
# Get static domain
ngrok config add-authtoken YOUR_TOKEN
ngrok http 5173 --domain=your-static-domain.ngrok-free.app
```

**Solution 2: Check ngrok tunnel status**
```bash
# Check if tunnel is active
curl http://localhost:4040/api/tunnels
```

**Solution 3: Use ngrok's web interface**
- Go to `http://localhost:4040` on your laptop
- Copy the HTTPS URL from there
- Use that URL on iPhone

### **Issue: Camera still not working**

1. **Check HTTPS:** URL must start with `https://`
2. **Check permissions:** Settings → Safari → Camera (must be enabled)
3. **Try different browser:** Chrome on iOS might work better
4. **Check ngrok tunnel:** Make sure it's active

### **Issue: WebAuthn still not working**

1. **Verify backend .env:**
   - `RP_ID` = ngrok domain (no https://)
   - `ORIGIN` = ngrok URL (with https://)
   
2. **Check backend logs:**
   - Should see WebAuthn requests
   - Check for CORS errors

3. **Test on laptop first:**
   - If it works on laptop, it should work on iPhone
   - If not, fix backend first

### **Issue: CORS errors**

Add to `citycircle-backend/server.js`:
```javascript
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://xyz789.ngrok-free.app', // Your frontend ngrok URL
        /\.ngrok-free\.app$/, // Allow all ngrok domains
        /\.ngrok\.io$/,
        /\.ngrok\.app$/
    ],
    credentials: true
}));
```

---

## 🚀 Quick Setup Script

Create `start-ngrok-testing.bat` (Windows):

```batch
@echo off
echo Starting CityCircle with ngrok...

start cmd /k "cd citycircle-backend && node server.js"
timeout /t 3
start cmd /k "ngrok http 4000"
timeout /t 3
start cmd /k "cd citycircle-frontend && npm run dev"
timeout /t 3
start cmd /k "ngrok http 5173"

echo.
echo Backend ngrok: Check http://localhost:4040 for URL
echo Frontend ngrok: Check http://localhost:4040 for URL
echo.
echo Update .env files with ngrok URLs!
pause
```

---

## 📱 Testing Checklist

- [ ] Backend running on port 4000
- [ ] Backend ngrok tunnel active
- [ ] Frontend running on port 5173
- [ ] Frontend ngrok tunnel active
- [ ] Backend .env updated with ngrok URLs
- [ ] Access frontend via HTTPS ngrok URL on iPhone
- [ ] Camera permission granted
- [ ] QR scanner works
- [ ] WebAuthn/Face ID works

---

## 💡 Alternative: Use ngrok's Static Domain

For easier testing, get a free ngrok account and static domain:

1. Sign up: https://dashboard.ngrok.com/signup
2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```
4. Use static domain:
   ```bash
   ngrok http 5173 --domain=your-static.ngrok-free.app
   ```

This way, the URL stays the same every time!

---

## ✅ Success!

Once set up correctly:
- ✅ Camera will work on iPhone
- ✅ WebAuthn/Face ID will work
- ✅ QR scanner will work
- ✅ All HTTPS features will work

**Remember:** Always use the HTTPS ngrok URL on iPhone, not the local IP!
