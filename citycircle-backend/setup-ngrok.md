# Ngrok Setup for Mobile Testing

## Step 1: Download and Install Ngrok

1. Go to https://ngrok.com/download
2. Download ngrok for Windows
3. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok\`)
4. Add ngrok to your PATH, OR place it in your project folder

## Step 2: Sign Up and Get Auth Token

1. Sign up for a free account at https://dashboard.ngrok.com/signup
2. After signing up, go to https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your authtoken

## Step 3: Configure Ngrok

Run this command (replace YOUR_AUTH_TOKEN with your actual token):
```
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Step 4: Start Ngrok

In a separate terminal, run:
```
ngrok http 5173
```

This will give you an HTTPS URL like: `https://abc123.ngrok-free.app`

## Step 5: Update Environment Variables

Create or update `.env` file in `citycircle-backend` folder:
```
RP_ID=abc123.ngrok-free.app
ORIGIN=https://abc123.ngrok-free.app
```

**Important:** Replace `abc123.ngrok-free.app` with your actual ngrok URL!

## Step 6: Restart Backend

Restart your backend server after updating the .env file.

## Step 7: Access from Phone

Open the ngrok HTTPS URL on your phone's browser to test Face ID!
