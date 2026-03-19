# js/lib — Local Libraries

ไฟล์ library ที่วางไว้ที่นี่จะถูกโหลดก่อน CDN เสมอ
ถ้าไม่มีไฟล์ ระบบจะ fallback ไป CDN โดยอัตโนมัติ

## ไฟล์ที่ควรดาวน์โหลดมาวางไว้

### 1. JsBarcode (สำหรับพิมพ์บาร์โค้ด)
URL:  https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js
ชื่อ: JsBarcode.all.min.js

### 2. ZXing Browser (สำหรับ camera scan บน mobile)
URL:  https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/umd/index.min.js
ชื่อ: zxing-browser.min.js

## วิธีดาวน์โหลด
1. เปิด URL ด้านบนในเบราว์เซอร์
2. กด Ctrl+S บันทึกเป็นชื่อที่กำหนด
3. วางไว้ใน navasri-system/js/lib/
4. Commit และ Push ขึ้น GitHub

## หลังดาวน์โหลดแล้ว
- ระบบจะใช้ local file ทันที (ไม่ต้องแก้โค้ด)
- พิมพ์บาร์โค้ดและ camera scan ทำงานได้แม้ไม่มีอินเทอร์เน็ต
