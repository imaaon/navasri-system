# ZXing Camera Scanner — Local File

## วิธีติดตั้ง (ทำครั้งเดียว)

ดาวน์โหลดไฟล์นี้แล้ววางใน js/lib/:

URL: https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/umd/index.min.js
ชื่อไฟล์: zxing-browser.min.js

## แก้ไข inventory.js (หลัง download)

เปลี่ยนบรรทัด:
  s.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/umd/index.min.js';

เป็น:
  s.src = 'js/lib/zxing-browser.min.js';

หลังแก้แล้ว camera scan จะทำงานได้แม้ไม่มีอินเทอร์เน็ต
