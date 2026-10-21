@echo off
chcp 65001 >nul
title War Dog In-Game Overlay
echo =======================================================================
echo          THƯỚC NGẮM TRONG SUỐT GHIM LÊN GAME WAR DOG
echo =======================================================================
echo.
echo  Đang khởi động thước ngắm...
echo  - Thước ngắm sẽ hiển thị trong suốt và nổi đè lên trên game.
echo  - Click chuột sẽ tự động xuyên qua thước ngắm vào game (Click-Through).
echo.
echo  [Phím Tắt Khi Đang Trong Game]:
echo    * F8  : Ẩn / Hiện thước ngắm
echo    * F9  : Bật / Tắt chế độ xuyên chuột (để di chuyển/chỉnh thước)
echo    * Mũi tên Lên / Xuống : Tăng / Giảm cự ly ngắm (±5m)
echo    * Mũi tên Trái / Phải : Tăng / Giảm hướng ngắm (±1°)
echo    * Dấu + / - : Phóng to / Thu nhỏ thước ngắm
echo    * Esc / F10 : Thoát thước ngắm
echo.
echo  * Tự động đồng bộ: Khi bạn bấm [🎯 NGẮM] hoặc [📋 Sao Chép] trên Web,
echo    thước ngắm này sẽ tự động cập nhật cự ly và hướng mới ngay lập tức!
echo =======================================================================
echo.
python wardog_overlay.py
if errorlevel 1 (
    echo.
    echo [LỖI] Không thể chạy thước ngắm. Vui lòng đảm bảo máy tính đã cài Python!
    pause
)
