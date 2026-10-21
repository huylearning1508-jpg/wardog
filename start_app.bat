@echo off
title WARDOGS Tactical Artillery Map
cd /d "%~dp0"
echo ========================================================
echo   WARDOGS TACTICAL MORTAR & ARTILLERY MAP CALCULATOR
echo ========================================================
echo Dang mo trinh duyet tai http://localhost:8080 ...
start "" http://localhost:8080/index.html
python -m http.server 8080
pause
