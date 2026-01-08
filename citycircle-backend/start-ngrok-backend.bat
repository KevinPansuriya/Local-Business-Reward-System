@echo off
echo Starting ngrok tunnel for CityCircle backend...
echo.
echo Make sure you have:
echo 1. Installed ngrok (https://ngrok.com/download)
echo 2. Signed up for a free account
echo 3. Configured your authtoken: ngrok config add-authtoken YOUR_TOKEN
echo.
echo Starting tunnel on port 4000 (backend)...
echo.
echo IMPORTANT: Copy the HTTPS URL and update:
echo - Backend .env: ORIGIN=https://YOUR_NGROK_URL
echo - Frontend .env: VITE_API_URL=https://YOUR_NGROK_URL/api
echo.
ngrok http 4000
pause
