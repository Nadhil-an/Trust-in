@echo off
REM Checkout Reminder - Sree Lakshmi Trust
REM This script should be called by Windows Task Scheduler every 5 minutes from 5:00 PM onwards

cd /d "C:\Users\NADIL\OneDrive\Desktop\sree Trust\backend"
python manage.py remind_checkout >> "C:\Users\NADIL\OneDrive\Desktop\sree Trust\backend\logs\checkout_reminders.log" 2>&1
