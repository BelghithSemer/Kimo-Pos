@echo off
echo Starting POS Application...

:: Start the server
start cmd /k "node backend/server.js"

:: Wait for the server to start
timeout /t 3 /nobreak >nul

:: Open the frontend in default browser
start http://localhost:3000/

echo POS Application started.
echo.
echo Access the POS at: http://localhost:3000/
echo Access the Backoffice at: http://localhost:3000/backoffice
echo.
pause