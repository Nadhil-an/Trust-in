@echo off
:: Sree Lakshmi Trust - WhatsApp Gateway Startup Script
:: Place this in Windows Startup folder to auto-run on login
:: Startup folder: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Wait 15 seconds for the PC to fully boot up first
timeout /t 15 /nobreak >nul

:: Change to the project directory
cd /d "C:\Users\NADIL\OneDrive\Desktop\sree Trust"

:: Start the WhatsApp Gateway under PM2 in background (minimized window)
start /min cmd /c "pm2 start ecosystem.config.js && pm2 save --force"

echo Sree Trust WhatsApp Gateway started!
