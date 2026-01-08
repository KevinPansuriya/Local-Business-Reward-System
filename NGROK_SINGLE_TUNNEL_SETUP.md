# Single Ngrok Tunnel Setup (Recommended)

## Why One Tunnel?
The free ngrok plan has limitations on multiple tunnels. Using one tunnel with Vite proxy is simpler and works perfectly!

## Setup Steps

### Step 1: Start Your Servers

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

**Terminal 3 - Ngrok (Frontend Only):**
```bash
ngrok http 5173
```

### Step 2: Copy Your Ngrok URL

After starting ngrok, you'll see something like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5173
```

Copy the domain: `abc123.ngrok-free.app`

### Step 3: Update Backend .env

Create or update `citycircle-backend/.env`:
```env
RP_ID=abc123.ngrok-free.app
ORIGIN=https://abc123.ngrok-free.app
RP_NAME=CityCircle
```

**Important:** 
- `RP_ID` = just the domain (no https://)
- `ORIGIN` = full URL with https://

### Step 4: Restart Backend

After updating `.env`, restart your backend:
```bash
# In Terminal 1, press Ctrl+C, then:
npm start
```

### Step 5: Test on Your Phone

1. Open the ngrok URL on your phone: `https://abc123.ngrok-free.app`
2. The frontend will automatically proxy API calls to the backend
3. Test Face ID login!

## How It Works

- Frontend runs on `localhost:5173`
- Ngrok tunnels `localhost:5173` to `https://abc123.ngrok-free.app`
- Vite proxy forwards `/api/*` requests to `localhost:4000`
- Everything works through the single ngrok tunnel!

## Alternative: Use Pooling (If You Need Two Tunnels)

If you really need two separate tunnels, use the pooling feature:

**Terminal 3 - Frontend:**
```bash
ngrok http 5173 --pooling-enabled
```

**Terminal 4 - Backend:**
```bash
ngrok http 4000 --pooling-enabled
```

Then update both `.env` files with the respective URLs.
