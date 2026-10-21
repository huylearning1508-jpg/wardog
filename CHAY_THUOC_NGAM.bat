@echo off
chcp 65001 >nul
title War Dog In-Game Transparent Overlay
cls
echo =======================================================================
echo          THƯỚC NGẮM TRONG SUỐT CHO GAME WAR DOG
echo          (100%% TRONG SUỐT - KHÔNG VIỀN ĐEN - NỔI ĐÈ LÊN GAME)
echo =======================================================================
echo.
echo  [Cơ chế hoạt động]:
echo    1. Thước ngắm sẽ hiển thị 100%% TRONG SUỐT, loại bỏ hoàn toàn viền đen.
echo    2. Chỉ có thanh Range Ladder và tâm ngắm màu xanh neon nổi lơ lửng trên game.
echo    3. Chuột tự động XUYÊN QUA thước ngắm (Click-Through) để bạn bắn bình thường.
echo.
echo  [Phím Tắt Tiện Lợi Trong Game]:
echo    * Phím + / -       : Phóng to / Thu nhỏ thước ngắm để khớp khít với game
echo    * Phím W / S / A / D : Dịch chuyển tâm ngắm (Lên / Xuống / Trái / Phải)
echo    * Mũi tên Lên/Xuống: Tăng / Giảm cự ly ngắm (±5m)
echo    * Mũi tên Trái/Phải: Tăng / Giảm hướng ngắm (±1°)
echo    * Phím 0           : Đặt lại tỷ lệ và vị trí mặc định (Reset)
echo    * Phím F8          : Ẩn / Hiện nhanh thước ngắm
echo    * Phím F9          : Bật / Tắt chế độ xuyên chuột
echo    * Phím Esc / F10   : Thoát thước ngắm
echo.
echo  [Tự động đồng bộ với Web]:
echo    Mỗi khi bạn bấm nút [🎯 NGẮM] trên web, thước ngắm này sẽ tự động
echo    nhận diện cự ly và hướng mới để căn chỉnh ngay lập tức!
echo =======================================================================
echo.
echo Đang chạy... Bạn có thể thu nhỏ cửa sổ này xuống thanh Taskbar.
echo.
python wardog_overlay.py
if errorlevel 1 (
    echo.
    echo [LỖI] Không thể khởi chạy. Vui lòng đảm bảo máy tính đã cài đặt Python.
    pause
)
