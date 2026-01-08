@echo off
echo Starting ngrok tunnel for CityCircle frontend...
echo.
echo Make sure you have:
echo 1. Installed ngrok (https://ngrok.com/download)
echo 2. Signed up for a free account
echo 3. Configured your authtoken: ngrok config add-authtoken YOUR_TOKEN
echo.
echo Starting tunnel on port 5173...
echo.
ngrok http 5173
pause
