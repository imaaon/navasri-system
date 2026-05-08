# Known Issues — Phase 3 Pending

## 📷 Camera Barcode Scanner — บางส่วนใช้งาน

**Status:** 🟡 Partial — กล้องเปิดได้, แต่สแกนบาร์โค้ดยังไม่ทำงาน

**Tested:** 2026-05-08 (Kasidis บน Desktop)

### สถานการณ์ปัจจุบัน
- ✅ ไฟล์ `js/lib/zxing-browser.min.js` (1.3MB) อยู่ใน repo
- ✅ `loadZXing()` โหลดสำเร็จ → return true
- ✅ `window.ZXingBrowser` พร้อมใช้
- ✅ Camera overlay เปิดได้ + browser ขอ permission ได้
- ❌ Video stream เปิดได้ แต่ decode ไม่เห็นผล

### สาเหตุที่เป็นไปได้
1. Desktop webcam ความละเอียดไม่พอสำหรับบาร์โค้ดขนาดเล็ก
2. ZXing decoder อ่านไม่ทันใน video frame
3. `decodeFromVideoDevice` callback อาจไม่ trigger เพราะ format ไม่ supported
4. Lighting condition ไม่พอ
5. Mobile ยังไม่ทดสอบ — อาจทำงานได้

### Priority
🟢 **Low** — ฟีเจอร์นี้ user ยังไม่ใช้บ่อย
- พิมพ์บาร์โค้ดเอง (Test 2 ผ่าน) ใช้งานได้แล้ว
- USB scanner ต่อก็ทำงานเหมือน keyboard

### แผนแก้ภายหลัง
1. ทดสอบ Mobile (กล้องหลังโทรศัพท์ — น่าจะดีกว่า webcam)
2. Add console.log ใน decode callback เพื่อ debug
3. ลอง alternative library: `html5-qrcode` หรือ `quagga2`
4. หรือใช้ external USB scanner เป็นหลัก

### ไฟล์ที่เกี่ยวข้อง
- `js/lib/zxing-browser.min.js` (library)
- `js/modules/inventory.js` line 838-940 (loadZXing + openCameraScanner + closeCameraScanner)
- `html/modals.html` line ~1645 (ปุ่ม 📷 สแกนกล้อง)

### Commit history
- `f225ed4` Add zxing-browser library
- `eb13878` Fix namespace ZXing → ZXingBrowser
