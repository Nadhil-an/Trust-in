@echo off
REM Daily Morning Greeting - Sree Lakshmi Trust
REM This script is called by Windows Task Scheduler every day at 8:00 AM

cd /d "C:\Users\NADIL\OneDrive\Desktop\sree Trust\backend"
python manage.py send_morning_greetings >> "C:\Users\NADIL\OneDrive\Desktop\sree Trust\backend\logs\morning_greetings.log" 2>&1
