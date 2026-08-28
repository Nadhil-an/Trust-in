@echo off
echo Starting Sree Lakshmi Trust System...

echo Starting Backend (Django)...
start "Backend Server" cmd /k "cd backend && python manage.py runserver 0.0.0.0:8000"

echo Starting Frontend (Vite)...
start "Frontend Server" cmd /k "cd frontend && npm run dev -- --port 5174"

echo Starting Mobile (Expo)...
start "Mobile Server" cmd /k "cd mobile && if exist .expo rmdir /s /q .expo && set REACT_NATIVE_PACKAGER_HOSTNAME=10.108.62.21 && npx expo start -c"

echo All services are starting up in separate windows!
echo Keep the new command prompt windows open to keep the servers running.
pause
