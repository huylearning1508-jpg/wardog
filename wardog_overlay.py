"""
=============================================================================
 WAR DOG - TRANSPARENT IN-GAME DESKTOP OVERLAY
 100% Trong Suốt - Không Viền Đen - Khớp 1:1 Với Thước Ngắm Trong Game
=============================================================================
 Phím Tắt Tiện Lợi:
   * F8          : Ẩn / Hiện nhanh thước ngắm
   * F9          : Bật / Tắt chế độ xuyên chuột (Click-Through)
   * Dấu + / -   : Tăng / Giảm tỷ lệ thu phóng (Zoom 1%)
   * W / S / A / D : Tinh chỉnh dịch chuyển tâm (Lên/Xuống/Trái/Phải 2px)
   * Phím 0      : Đặt lại tỷ lệ và vị trí chuẩn 1:1
   * Esc / F10   : Thoát
=============================================================================
"""

import sys
import tkinter as tk
import ctypes
import re
import json

# Windows API Constants
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
GWL_EXSTYLE = -20

# 17 Verified in-game mortar graduations (50 MIL decrements)
LADDER_MARKS = [
    (80, 950), (110, 900), (132, 850), (187, 800),
    (240, 750), (290, 700), (340, 650), (385, 600),
    (430, 550), (470, 500), (510, 450), (545, 400),
    (578, 350), (609, 300), (637, 250), (661, 200),
    (684, 150)
]

# EXACT PIXEL MEASUREMENTS FROM IN-GAME SCREENSHOT (1080p Baseline)
# Box dimensions between the 4 corner brackets
BASE_BOX_WIDTH = 723.0    # Exact width between ┌ and ┐
BASE_BOX_HEIGHT = 539.0   # Exact height between ┌ and └
BASE_PX_PER_MIL = 2.051   # Exact 102.55 px per 50 MIL step
BASE_LADDER_OFFSET_X = 264.5 # Distance from center to left/right ladder tracks

class WarDogDesktopOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("War Dog Transparent Overlay")

        # Fullscreen borderless window over primary screen
        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()
        self.root.geometry(f"{self.screen_w}x{self.screen_h}+0+0")
        self.root.overrideredirect(True)

        # Pure transparent background via colorkey black
        self.bg_color = "black"
        self.root.configure(bg=self.bg_color)
        self.root.wm_attributes("-transparentcolor", self.bg_color)
        self.root.wm_attributes("-topmost", True)

        self.click_through = True
        self.visible = True

        # Target parameters
        self.bearing = 208.0
        self.dist_m = 519.0
        self.mil = 437.0
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0

        # Canvas for HUD rendering
        self.canvas = tk.Canvas(
            self.root,
            width=self.screen_w,
            height=self.screen_h,
            bg=self.bg_color,
            highlightthickness=0
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Enable click-through on Windows
        self.set_click_through(True)

        # Bind hotkeys
        self.root.bind("<F8>", lambda e: self.toggle_visibility())
        self.root.bind("<F9>", lambda e: self.toggle_click_through())
        self.root.bind("<plus>", lambda e: self.adjust_scale(0.01))
        self.root.bind("<equal>", lambda e: self.adjust_scale(0.01))
        self.root.bind("<minus>", lambda e: self.adjust_scale(-0.01))
        self.root.bind("<underscore>", lambda e: self.adjust_scale(-0.01))
        self.root.bind("<w>", lambda e: self.adjust_offset(0, -2))
        self.root.bind("<s>", lambda e: self.adjust_offset(0, 2))
        self.root.bind("<a>", lambda e: self.adjust_offset(-2, 0))
        self.root.bind("<d>", lambda e: self.adjust_offset(2, 0))
        self.root.bind("<Up>", lambda e: self.adjust_range(5))
        self.root.bind("<Down>", lambda e: self.adjust_range(-5))
        self.root.bind("<Left>", lambda e: self.adjust_bearing(-1))
        self.root.bind("<Right>", lambda e: self.adjust_bearing(1))
        self.root.bind("<0>", lambda e: self.reset_transform())
        self.root.bind("<Escape>", lambda e: self.root.destroy())
        self.root.bind("<F10>", lambda e: self.root.destroy())

        self.last_clipboard = ""
        self.draw_reticle()

        # Start clipboard polling to auto-sync with web app
        self.root.after(300, self.check_clipboard_loop)

    def set_click_through(self, enable):
        try:
            hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
            if not hwnd:
                hwnd = self.root.winfo_id()
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            if enable:
                style = style | WS_EX_LAYERED | WS_EX_TRANSPARENT
            else:
                style = (style | WS_EX_LAYERED) & ~WS_EX_TRANSPARENT
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
            self.click_through = enable
        except Exception as e:
            print("Windows API Error:", e)

    def toggle_click_through(self):
        self.set_click_through(not self.click_through)
        self.draw_reticle()

    def toggle_visibility(self):
        self.visible = not self.visible
        if self.visible:
            self.draw_reticle()
        else:
            self.canvas.delete("all")

    def adjust_scale(self, delta):
        self.scale = max(0.5, min(2.5, round(self.scale + delta, 3)))
        self.draw_reticle()

    def adjust_offset(self, dx, dy):
        self.offset_x += dx
        self.offset_y += dy
        self.draw_reticle()

    def reset_transform(self):
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0
        self.draw_reticle()

    def adjust_range(self, delta):
        self.dist_m = max(80, min(684, self.dist_m + delta))
        for i in range(len(LADDER_MARKS) - 1):
            r1, m1 = LADDER_MARKS[i]
            r2, m2 = LADDER_MARKS[i+1]
            if r1 <= self.dist_m <= r2:
                fact = (self.dist_m - r1) / (r2 - r1)
                self.mil = round(m1 + fact * (m2 - m1))
                break
        self.draw_reticle()

    def adjust_bearing(self, delta):
        self.bearing = (self.bearing + delta + 360) % 360
        self.draw_reticle()

    def check_clipboard_loop(self):
        try:
            clip = self.root.clipboard_get()
            if clip and clip != self.last_clipboard:
                self.last_clipboard = clip
                if "WARDOG:" in clip:
                    m_b = re.search(r"B([\d.]+)", clip)
                    m_r = re.search(r"R([\d.]+)", clip)
                    m_m = re.search(r"M([\d.]+)", clip)
                    if m_b and m_r and m_m:
                        self.bearing = float(m_b.group(1))
                        self.dist_m = float(m_r.group(1))
                        self.mil = float(m_m.group(1))
                        self.draw_reticle()
                elif "{" in clip and "bearing" in clip:
                    data = json.loads(clip)
                    if "bearing" in data:
                        self.bearing = float(data["bearing"])
                    if "dist" in data:
                        self.dist_m = float(data["dist"])
                    if "mil" in data:
                        self.mil = float(data["mil"])
                    self.draw_reticle()
        except Exception:
            pass
        self.root.after(350, self.check_clipboard_loop)

    def draw_reticle(self):
        self.canvas.delete("all")
        if not self.visible:
            return

        # Center of screen (with custom offset adjustments)
        cx = (self.screen_w // 2) + self.offset_x
        cy = (self.screen_h // 2) + self.offset_y

        neon_green = "#4ade80"
        dim_gray = "#64748b"
        amber = "#f59e0b"

        # EXACT 1:1 CORNER BRACKET COORDINATES
        box_w = BASE_BOX_WIDTH * self.scale
        box_h = BASE_BOX_HEIGHT * self.scale
        half_w = box_w / 2.0
        half_h = box_h / 2.0

        left = cx - half_w
        right = cx + half_w
        top = cy - half_h
        bottom = cy + half_h

        # 4 CORNER BRACKETS ┌ ┐ └ ┘ (EXACT MATCH FOR ALIGNMENT)
        arm_x = 26.0 * self.scale
        arm_y = 20.0 * self.scale
        thick = 2.5

        # Top-Left ┌
        self.canvas.create_line(left, top, left + arm_x, top, fill=neon_green, width=thick)
        self.canvas.create_line(left, top, left, top + arm_y, fill=neon_green, width=thick)

        # Top-Right ┐
        self.canvas.create_line(right, top, right - arm_x, top, fill=neon_green, width=thick)
        self.canvas.create_line(right, top, right, top + arm_y, fill=neon_green, width=thick)

        # Bottom-Left └
        self.canvas.create_line(left, bottom, left + arm_x, bottom, fill=neon_green, width=thick)
        self.canvas.create_line(left, bottom, left, bottom - arm_y, fill=neon_green, width=thick)

        # Bottom-Right ┘
        self.canvas.create_line(right, bottom, right - arm_x, bottom, fill=neon_green, width=thick)
        self.canvas.create_line(right, bottom, right, bottom - arm_y, fill=neon_green, width=thick)

        # TOP HEADING BOX [ 208 SSW ]
        cardinal_short = "S" if 168 <= self.bearing <= 192 else ("SW" if 192 < self.bearing <= 248 else "N")
        heading_text = f" {int(round(self.bearing))} {cardinal_short} "
        h_box_w = 48.0 * self.scale
        h_box_h = 24.0 * self.scale
        self.canvas.create_rectangle(cx - h_box_w, top - h_box_h - 8, cx + h_box_w, top - 8, outline=neon_green, width=2)
        font_head = ("Consolas", max(9, int(11 * self.scale)), "bold")
        self.canvas.create_text(cx, top - (h_box_h / 2.0) - 8, text=heading_text, fill=neon_green, font=font_head)
        self.canvas.create_line(cx, top - 8, cx, top, fill=neon_green, width=2)

        # Top ruler ticks at y = top + 8
        for i in range(-5, 6):
            tx = cx + (i * 35.0 * self.scale)
            t_len = 10 if i % 2 == 0 else 6
            self.canvas.create_line(tx, top + 4, tx, top + t_len, fill=neon_green, width=1.5)

        # DEAD CENTER RETICLE: [ ⊙ ] with ┴ and ┬
        r_circ = 6.0 * self.scale
        self.canvas.create_oval(cx - r_circ, cy - r_circ, cx + r_circ, cy + r_circ, outline=neon_green, width=2)
        self.canvas.create_oval(cx - 1, cy - 1, cx + 1, cy + 1, fill=neon_green, outline=neon_green)

        # Left bracket [ at cx - 61px
        b_x = 61.0 * self.scale
        b_h = 20.0 * self.scale
        b_tab = 10.0 * self.scale
        self.canvas.create_line(cx - b_x, cy - b_h, cx - b_x, cy + b_h, fill=neon_green, width=2)
        self.canvas.create_line(cx - b_x, cy - b_h, cx - b_x + b_tab, cy - b_h, fill=neon_green, width=2)
        self.canvas.create_line(cx - b_x, cy + b_h, cx - b_x + b_tab, cy + b_h, fill=neon_green, width=2)

        # Right bracket ] at cx + 61px
        self.canvas.create_line(cx + b_x, cy - b_h, cx + b_x, cy + b_h, fill=neon_green, width=2)
        self.canvas.create_line(cx + b_x, cy - b_h, cx + b_x - b_tab, cy - b_h, fill=neon_green, width=2)
        self.canvas.create_line(cx + b_x, cy + b_h, cx + b_x - b_tab, cy + b_h, fill=neon_green, width=2)

        # Top post ┴
        tp_top = cy - (85.0 * self.scale)
        tp_base = cy - (57.0 * self.scale)
        tp_bar = 20.0 * self.scale
        self.canvas.create_line(cx, tp_top, cx, tp_base, fill=neon_green, width=2)
        self.canvas.create_line(cx - tp_bar, tp_base, cx + tp_bar, tp_base, fill=neon_green, width=2)

        # Bottom post ┬
        bp_top = cy + (57.0 * self.scale)
        bp_bot = cy + (85.0 * self.scale)
        self.canvas.create_line(cx, bp_top, cx, bp_bot, fill=neon_green, width=2)
        self.canvas.create_line(cx - tp_bar, bp_top, cx + tp_bar, bp_top, fill=neon_green, width=2)

        # Target Elevation Guideline (Horizontal line from left track to right track)
        lx = cx - (BASE_LADDER_OFFSET_X * self.scale)
        rx = cx + (BASE_LADDER_OFFSET_X * self.scale)
        tick_len = 18.0 * self.scale

        # Green glowing guideline right across center
        self.canvas.create_line(lx + tick_len, cy, cx - b_x - 4, cy, fill=neon_green, width=2)
        self.canvas.create_line(cx + b_x + 4, cy, rx - tick_len, cy, fill=neon_green, width=2)

        # RANGE LADDERS (EXACT PIXEL SPACING: 102.55 px per 50 MIL)
        px_per_mil = BASE_PX_PER_MIL * self.scale
        target_mil = self.mil

        ladder_font = ("Consolas", max(8, int(10 * self.scale)), "bold")
        active_font = ("Consolas", max(10, int(13 * self.scale)), "bold")

        self.canvas.create_text(lx - 45, top + 25, text="RNG", fill="#94a3b8", font=("Consolas", max(9, int(11 * self.scale)), "bold"))
        self.canvas.create_text(rx + 45, top + 25, text="MIL", fill="#94a3b8", font=("Consolas", max(9, int(11 * self.scale)), "bold"))

        for r, m in LADDER_MARKS:
            # Vertical position relative to center
            y = cy + (target_mil - m) * px_per_mil

            # Skip if outside the 4 corner box
            if y < top + 15 or y > bottom - 15:
                continue

            is_active = abs(m - target_mil) <= 25
            color = neon_green if is_active else dim_gray
            f = active_font if is_active else ladder_font
            t_w = (tick_len * 1.3) if is_active else tick_len
            t_h = 2.5 if is_active else 1.5

            # Left Range Mark: 187M ├
            self.canvas.create_text(lx - 12, y, text=f"{r}M", fill=color, font=f, anchor="e")
            self.canvas.create_line(lx, y, lx + t_w, y, fill=color, width=t_h)

            # Right MIL Mark: ┤ 800
            self.canvas.create_line(rx - t_w, y, rx, y, fill=color, width=t_h)
            self.canvas.create_text(rx + 12, y, text=f"{m}", fill=color, font=f, anchor="w")

        # Center target lock badge below crosshair
        badge_text = f"{int(round(self.dist_m))}M · {int(round(self.mil))} MIL"
        badge_y = cy + (44.0 * self.scale)
        self.canvas.create_rectangle(cx - 65, badge_y - 12, cx + 65, badge_y + 12, outline=neon_green, width=1.5)
        self.canvas.create_text(cx, badge_y, text=badge_text, fill=neon_green, font=("Consolas", max(9, int(11 * self.scale)), "bold"))

        # Status text at bottom
        scale_pct = int(round(self.scale * 100))
        status_text = f"🎯 ĐÍCH: {int(round(self.dist_m))}m · {int(round(self.mil))} MIL · HƯỚNG {self.bearing:.1f}° | [Zoom +/-: {scale_pct}%] [W/S/A/D: Dịch vị trí] [0: Reset 1:1] [F8: Ẩn/Hiện] [F9: Xuyên Chuột]"
        self.canvas.create_text(cx, bottom + 25, text=status_text, fill=amber, font=("Consolas", 10, "bold"))

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = WarDogDesktopOverlay()
    app.run()
