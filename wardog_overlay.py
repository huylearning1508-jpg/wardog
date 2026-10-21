"""
=============================================================================
 WAR DOG - TRANSPARENT IN-GAME DESKTOP OVERLAY
 Huong dan:
 1. Chay file nay: python wardog_overlay.py
 2. Cua so trong suot (click-through) se de len tren game War Dog
 3. Phim tat:
    - F8: An / Hien thuoc ngam
    - F9: Bat / Tat che do click-through (xuyen chuot)
    - Esc / F10: Thoat
=============================================================================
"""

import sys
import tkinter as tk
import ctypes

# Windows API Constants
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
GWL_EXSTYLE = -20

class WarDogDesktopOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("War Dog Scope Overlay")

        # Fullscreen borderless window
        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()
        self.root.geometry(f"{self.screen_w}x{self.screen_h}+0+0")
        self.root.overrideredirect(True)

        # Transparent color (black is key)
        self.bg_color = "black"
        self.root.configure(bg=self.bg_color)
        self.root.wm_attributes("-transparentcolor", self.bg_color)
        self.root.wm_attributes("-topmost", True)

        self.click_through = True
        self.visible = True

        # Canvas
        self.canvas = tk.Canvas(
            self.root,
            width=self.screen_w,
            height=self.screen_h,
            bg=self.bg_color,
            highlightthickness=0
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Current target solution (default: 187m, 800 MIL, Bearing 201°)
        self.bearing = 201.2
        self.dist_m = 187.0
        self.mil = 800
        self.scale = 1.0

        # Enable click-through on Windows
        self.set_click_through(True)

        # Keybinds
        self.root.bind("<F8>", lambda e: self.toggle_visibility())
        self.root.bind("<F9>", lambda e: self.toggle_click_through())
        self.root.bind("<Escape>", lambda e: self.root.destroy())
        self.root.bind("<F10>", lambda e: self.root.destroy())

        self.draw_reticle()

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

    def toggle_visibility(self):
        self.visible = not self.visible
        if self.visible:
            self.canvas.pack(fill=tk.BOTH, expand=True)
            self.draw_reticle()
        else:
            self.canvas.delete("all")

    def draw_reticle(self):
        self.canvas.delete("all")
        if not self.visible:
            return

        cx = self.screen_w // 2
        cy = self.screen_h // 2
        green = "#4ade80"
        dark_green = "#166534"
        amber = "#f59e0b"

        box_w = int(460 * self.scale)
        box_h = int(380 * self.scale)
        left = cx - box_w // 2
        right = cx + box_w // 2
        top = cy - box_h // 2
        bottom = cy + box_h // 2

        # 4 Corner Brackets ┌ ┐ └ ┘
        c_len = 22
        c_thick = 3
        # Top-Left ┌
        self.canvas.create_line(left, top, left + c_len, top, fill=green, width=c_thick)
        self.canvas.create_line(left, top, left, top + c_len, fill=green, width=c_thick)
        # Top-Right ┐
        self.canvas.create_line(right, top, right - c_len, top, fill=green, width=c_thick)
        self.canvas.create_line(right, top, right, top + c_len, fill=green, width=c_thick)
        # Bottom-Left └
        self.canvas.create_line(left, bottom, left + c_len, bottom, fill=green, width=c_thick)
        self.canvas.create_line(left, bottom, left, bottom - c_len, fill=green, width=c_thick)
        # Bottom-Right ┘
        self.canvas.create_line(right, bottom, right - c_len, bottom, fill=green, width=c_thick)
        self.canvas.create_line(right, bottom, right, bottom - c_len, fill=green, width=c_thick)

        # Top Heading Box [ 201 S ]
        cardinal = "S" if 157.5 <= self.bearing <= 202.5 else "SW"
        heading_text = f" {int(round(self.bearing))} {cardinal} "
        self.canvas.create_rectangle(cx - 50, top - 45, cx + 50, top - 20, outline=green, width=2, fill="#0f172a")
        self.canvas.create_text(cx, top - 32, text=heading_text, fill=green, font=("Consolas", 12, "bold"))
        self.canvas.create_line(cx, top - 20, cx, top, fill=green, width=2)

        # Reticle Box Top scale ticks
        for i in range(-5, 6):
            tx = cx + i * 35
            self.canvas.create_line(tx, top + 4, tx, top + (12 if i % 2 == 0 else 8), fill=green, width=1.5)

        # Dead Center Reticle: [ ⊙ ] with ┴ and ┬
        # Center circle & dot
        self.canvas.create_oval(cx - 6, cy - 6, cx + 6, cy + 6, outline=green, width=2)
        self.canvas.create_oval(cx - 1, cy - 1, cx + 1, cy + 1, fill=green, outline=green)

        # Left bracket [
        self.canvas.create_line(cx - 20, cy - 14, cx - 26, cy - 14, fill=green, width=2)
        self.canvas.create_line(cx - 26, cy - 14, cx - 26, cy + 14, fill=green, width=2)
        self.canvas.create_line(cx - 26, cy + 14, cx - 20, cy + 14, fill=green, width=2)

        # Right bracket ]
        self.canvas.create_line(cx + 20, cy - 14, cx + 26, cy - 14, fill=green, width=2)
        self.canvas.create_line(cx + 26, cy - 14, cx + 26, cy + 14, fill=green, width=2)
        self.canvas.create_line(cx + 26, cy + 14, cx + 20, cy + 14, fill=green, width=2)

        # Top post ┴
        self.canvas.create_line(cx, cy - 42, cx, cy - 22, fill=green, width=2)
        self.canvas.create_line(cx - 10, cy - 22, cx + 10, cy - 22, fill=green, width=2)

        # Bottom post ┬
        self.canvas.create_line(cx, cy + 22, cx, cy + 42, fill=green, width=2)
        self.canvas.create_line(cx - 10, cy + 22, cx + 10, cy + 22, fill=green, width=2)

        # Target Alignment Guide Lines
        self.canvas.create_line(left + 80, cy, cx - 35, cy, fill=green, width=2, dash=(4, 4))
        self.canvas.create_line(cx + 35, cy, right - 80, cy, fill=green, width=2, dash=(4, 4))

        # Target Lock Ladder Marks (at center)
        # Left Range Mark: 187M ├
        lx = left + 70
        self.canvas.create_text(lx - 12, cy, text=f"{int(self.dist_m)}M", fill=green, font=("Consolas", 13, "bold"), anchor="e")
        self.canvas.create_line(lx, cy, lx + 20, cy, fill=green, width=3)
        self.canvas.create_text(lx - 20, top + 25, text="RNG", fill="#94a3b8", font=("Consolas", 10, "bold"))

        # Right MIL Mark: ┤ 800
        rx = right - 70
        self.canvas.create_line(rx - 20, cy, rx, cy, fill=green, width=3)
        self.canvas.create_text(rx + 12, cy, text=f"{int(self.mil)}", fill=green, font=("Consolas", 13, "bold"), anchor="w")
        self.canvas.create_text(rx + 20, top + 25, text="MIL", fill="#94a3b8", font=("Consolas", 10, "bold"))

        # Target Lock Badge
        badge_text = f"TARGET: {int(self.dist_m)}m · {int(self.mil)} MIL · BEARING {self.bearing:.1f}°"
        self.canvas.create_rectangle(cx - 180, bottom + 15, cx + 180, bottom + 42, outline=green, width=1.5, fill="#0f172a")
        self.canvas.create_text(cx, bottom + 28, text=badge_text, fill=green, font=("Consolas", 11, "bold"))

        # Help hint
        hint_text = "[F8: An/Hien] [F9: Click-Through Xuyen Chuot] [Esc/F10: Thoat]"
        self.canvas.create_text(cx, bottom + 55, text=hint_text, fill="#fbbf24", font=("Consolas", 9))

    def run(self):
        print("War Dog Overlay running! Press F8 to hide/show, Esc to exit.")
        self.root.mainloop()

if __name__ == "__main__":
    app = WarDogDesktopOverlay()
    app.run()
