# Ngrok Setup Guide for Mobile Testing

## Quick Start (5 minutes)

### Step 1: Download Ngrok
1. Go to https://ngrok.com/download
2. Download ngrok for Windows
3. Extract `ngrok.exe` to `C:\ngrok\` (or any folder you prefer)

### Step 2: Sign Up & Get Token
1. Sign up at https://dashboard.ngrok.com/signup (free account)
2. Go to https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your authtoken

### Step 3: Configure Ngrok
Open Command Prompt and run:
```bash
C:\ngrok\ngrok.exe config add-authtoken YOUR_AUTH_TOKEN
```
(Replace `YOUR_AUTH_TOKEN` with the token you copied)

### Step 4: Start Your Servers

**Terminal 1 - Backend:**
```bash
cd citycircle-backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd citycircle-frontend
npm run dev
```

**Terminal 3 - Ngrok (Frontend):**
```bash
C:\ngrok\ngrok.exe http 5173
```

**Terminal 4 - Ngrok (Backend):**
```bash
C:\ngrok\ngrok.exe http 4000
```

### Step 5: Update Configuration

After starting ngrok, you'll get two HTTPS URLs:
- Frontend: `https://abc123.ngrok-free.app` (from port 5173)
- Backend: `https://xyz789.ngrok-free.app` (from port 4000)

**Update Backend `.env` file** (`citycircle-backend/.env`):
```env
RP_ID=abc123.ngrok-free.app
ORIGIN=https://abc123.ngrok-free.app
```

**Update Frontend `.env` file** (`citycircle-frontend/.env`):
```env
VITE_API_URL=https://xyz789.ngrok-free.app/api
```

**Important:** 
- Replace `abc123.ngrok-free.app` with your actual frontend ngrok URL
- Replace `xyz789.ngrok-free.app` with your actual backend ngrok URL
- Extract only the domain for `RP_ID` (without `https://`)

### Step 6: Restart Servers

After updating `.env` files:
1. Restart backend server (Ctrl+C, then `npm start`)
2. Restart frontend server (Ctrl+C, then `npm run dev`)

### Step 7: Test on Your Phone

1. Open the frontend ngrok URL on your phone: `https://abc123.ngrok-free.app`
2. Enter your phone number
3. Click "Login with Face ID"
4. Use Face ID/Touch ID (iOS) or Face Unlock/Fingerprint (Android)

## Troubleshooting

**Issue: "Invalid RP_ID" error**
- Make sure `RP_ID` in backend `.env` is just the domain (no `https://`)
- Example: `RP_ID=abc123.ngrok-free.app` ✅
- Wrong: `RP_ID=https://abc123.ngrok-free.app` ❌

**Issue: CORS errors**
- Make sure both frontend and backend ngrok URLs are correct
- Restart both servers after updating `.env` files

**Issue: Face ID not working**
- Make sure you're using the HTTPS ngrok URL (not HTTP)
- Check that `ORIGIN` in backend matches the frontend ngrok URL exactly

## Alternative: Use Batch Files

I've created helper batch files:
- `citycircle-backend/start-ngrok.bat` - Starts ngrok for frontend
- `citycircle-backend/start-ngrok-backend.bat` - Starts ngrok for backend

Just double-click them after configuring your authtoken!
