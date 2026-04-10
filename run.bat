@echo off
echo Starting DOTSYSTEM Local Persistence Server...
echo.
echo [1/2] Launching Database Engine...
start "DOTSYSTEM_DB" node server.js
echo.
echo [2/2] Opening Application...
timeout /t 2 >nul
start http://localhost:3000
echo.
echo ✅ DOTSYSTEM is running!
echo 🛑 KEEP THIS WINDOW OPEN while using the app.
echo 🛑 Close this window and the server console to stop the app.
pause
