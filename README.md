# 🎯 WARDOGS Tactical Artillery & Mortar Map Calculator

Bản đồ tương tác chiến thuật và công cụ tính toán đạn đạo bắn cối / pháo binh dành cho game **WARDOGS** (Unreal Engine 5). Hỗ trợ tra cứu độ cao địa hình 3D thực tế và tự động bù trừ độ cao để bắn trúng mục tiêu 100%.

---

## ✨ Tính Năng Nổi Bật

1. **Hỗ trợ đầy đủ 3 Bản đồ chính thức của WARDOGS:**
   * 🏔️ **Bakurani** (*Kavkazi*): Thung lũng & Dãy núi tuyết Caucasus ($Z$: `-1008.3m` $\rightarrow$ `+106.5m`)
   * 🏰 **Ozeti** (*Europe*): Đồi thảo nguyên & Pháo đài ($Z$: `-1044.8m` $\rightarrow$ `+0.04m`)
   * 🌲 **Zestafona** (*North America*): Rừng thông & Cao nguyên ($Z$: `0.0m` $\rightarrow$ `1225.0m`)

2. **Bản đồ tương tác mượt mà như Google Maps (Leaflet.js):**
   * Kéo thả, phóng to, thu nhỏ mượt mà trên nền ảnh vệ tinh quân sự độ phân giải cao.
   * Lưới tọa độ chuẩn xác từng mét theo hệ tọa độ thế giới trong game.
   * Hiển thị các cứ điểm chiếm đóng (**Objectives / Control Zones**) có thể click để khóa nhanh mục tiêu.

3. **Kéo thả vị trí Súng cối (Mortar) & Mục tiêu (Target) tự do:**
   * **Súng cối (Icon xanh lá 💥):** Kèm vòng tròn bán kính bắn tối thiểu (50m) và tối đa (1200m).
   * **Mục tiêu (Icon tâm ngắm đỏ 🎯):** Có thể kéo thả tới bất kỳ đâu trên bản đồ hoặc nhập tọa độ $X, Y$ bằng tay.
   * Khi kéo thả, toàn bộ cự ly, góc ngắm và độ cao **nhảy số tức thì theo thời gian thực (Real-time 60 FPS)**.

4. **Độ cao 3D ($Z$) & Bù trừ đạn đạo chuẩn xác:**
   * Tự động tra cứu độ cao mặt đất thực tế $Z_{\text{súng}}$ và $Z_{\text{mục tiêu}}$ từ ma trận địa hình 16-bit của game.
   * Tính chênh lệch độ cao $\Delta Z = Z_{\text{mục tiêu}} - Z_{\text{súng}}$.
   * **Bù trừ cự ly thước ngắm cho súng cối:**
     * Ví dụ: Mục tiêu ở cách $200\text{ m}$ nhưng nằm ở trên đồi cao hơn súng $+10\text{ m}$, đạn cối rơi theo góc dốc sẽ chạm sườn đồi trước khi tới đích.
     * Công cụ tự động tính ra **Cự ly cần đặt thước ngắm**: $\approx 205.3\text{ m}$ (chỉnh thêm $+5.3\text{ m}$ để đạn rơi chính xác vào đầu mục tiêu).
   * Hiển thị góc xoay hướng (**Bearing / Azimuth**), góc nâng nòng (**Elevation Mils & Độ**), thời gian đạn bay (**Time of Flight**) và đỉnh đạn cao nhất (**Apex**).

5. **Mặt cắt địa hình & Quỹ đạo đạn (Cross-Section & Trajectory Canvas):**
   * Vẽ biểu đồ mặt đất thực tế cắt ngang giữa súng và mục tiêu.
   * Mô phỏng đường đạn parabol bay qua đỉnh đồi hoặc thung lũng để kiểm tra tầm nhìn có bị che khuất không.

---

## 🚀 Cách Cài Đặt & Sử Dụng

### 1. Khởi chạy trực tiếp trên máy tính:
Chỉ cần nhấp đúp vào tệp:
👉 [**`start_app.bat`**](start_app.bat)  
*(Trình duyệt sẽ tự động mở trang web tại `http://localhost:8080`)*.

Hoặc nếu bạn dùng dòng lệnh:
```bash
# Bằng Python
python -m http.server 8080

# Hoặc bằng Node.js / npx
npx serve .
```

---

## 📤 Hướng Dẫn Đẩy Lên GitHub (Push to Git)

1. Mở PowerShell hoặc Terminal tại thư mục `e:\wardog`:
```bash
git init
git add .
git commit -m "feat: initial commit of wardogs tactical artillery map calculator"
```

2. Tạo một repository mới trên GitHub (ví dụ đặt tên là `wardogs-artillery-map`).

3. Liên kết và đẩy code lên:
```bash
git branch -M main
git remote add origin https://github.com/<tên-tài-khoản-của-bạn>/<tên-repo>.git
git push -u origin main
```

4. **Bật GitHub Pages để dùng online miễn phí:**
   * Vào **Settings** trên repo GitHub $\rightarrow$ **Pages** $\rightarrow$ chọn branch **`main`** $\rightarrow$ bấm **Save**.
   * Sau 1 phút, bạn sẽ có link web online để chia sẻ cho đồng đội hoặc mở trên điện thoại!

---

## 📐 Công Thức Tính Toán

* **Khoảng cách hình chiếu bằng (2D):**
  $$D_{2D} = \sqrt{(X_2 - X_1)^2 + (Y_2 - Y_1)^2}$$
* **Khoảng cách không gian (3D):**
  $$D_{3D} = \sqrt{(X_2 - X_1)^2 + (Y_2 - Y_1)^2 + (Z_2 - Z_1)^2}$$
* **Góc la bàn (Azimuth / Bearing):**
  $$\theta = \left(\text{atan2}(X_2 - X_1, Y_2 - Y_1) \times \frac{180}{\pi} + 360\right) \pmod{360}$$
* **Cự ly thước ngắm bù độ cao (Mortar Elevation Compensation):**
  $$D_{\text{adj}} = D_{2D} + \frac{\Delta Z}{\tan(62^\circ)} \approx D_{2D} + 0.532 \times \Delta Z$$
