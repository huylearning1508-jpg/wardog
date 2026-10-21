@echo off
cd /d "%~dp0"
title War Dog Overlay
python wardog_overlay.py
if errorlevel 1 (
    echo.
    echo [ERROR] Khong the chay wardog_overlay.py
    echo Vui long kiem tra Python da duoc cai dat chua.
    pause
)
