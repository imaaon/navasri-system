# 🏥 Navasri Nursing Home — Management System

ระบบบริหารจัดการเนิร์สซิ่งโฮม **นวศรีเนอร์สซิ่งโฮม** (รามคำแหง 21, บางกะปิ)

🌐 **Live:** [navasriapp.com](https://www.navasriapp.com)
🏢 **Website:** [navasrinursinghome.com](https://www.navasrinursinghome.com)
📞 **Tel:** 086-306-3018 | LINE: @navasri

---

## 📦 Tech Stack

| Layer | เทคโนโลยี |
|---|---|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Backend | Supabase (PostgreSQL 17 + Edge Functions Deno) |
| Hosting | GitHub Pages (auto-deploy from `main`) |
| Auth | Supabase Auth + Custom RBAC (11 roles) |

---

## 🗂️ โครงสร้างระบบ

```
navasri-system/
├── index.html              # Entry point + script loader
├── css/                    # Stylesheets
├── html/
│   ├── pages.html          # 28 page templates
│   ├── modals.html         # Modal components
│   └── sidebar.html        # Navigation
├── js/
│   ├── core/               # Authentication, permissions, router
│   ├── shared/             # ui.js, utils.js, common helpers
│   ├── modules/
│   │   ├── billing/        # Invoice, payment, contract, physio
│   │   ├── clinical/       # Patient profile (19 tabs)
│   │   ├── inventory.js    # Stock management
│   │   ├── requisition.js  # Stock requisition flow
│   │   ├── suppliers.js    # PO, supplier invoices
│   │   └── ...             # 28 modules total
│   └── fix-features.js     # Runtime patches
├── docs/                   # Technical documentation
│   ├── RECOVERY_PROCEDURES.md
│   └── ...
├── CHANGELOG.md            # Version history
└── README.md               # This file
```

---

## 🎯 ฟีเจอร์หลัก

### 👥 ผู้รับบริการ (45 คน ปัจจุบัน)
- โปรไฟล์ผู้ป่วย 19 tabs: ข้อมูลทั่วไป, ติดต่อ, แพ้ยา, ยาประจำ, นัดหมาย, ทรัพย์สิน, สัญญา, ฯลฯ
- บันทึกพยาบาล (Nursing Notes) + Vital Signs + MAR
- Wound Care, Tube Feeding, Excretions, Fluid Records
- Lab Results, DNR/Consent, Patient Status Logs

### 🏠 ห้องและเตียง
- 16 ห้อง 5 ประเภท (วอร์ดรวม, 2-4 เตียง, ห้องเดี่ยว) — รวม 56 เตียง
- ประวัติการย้ายห้อง

### 💰 ระบบบัญชี
- ใบแจ้งหนี้ + รับชำระ + เอกสารทั่วไป
- แพ็กเกจรายเดือน, กายภาพบำบัด
- เงินมัดจำ, Reset bill (มี audit log)

### 📦 คลังสต็อก
- Items + Lots + Stock Movements
- ใบเบิก (requisition) 2-level approval workflow
- ผู้จำหน่าย + Purchase Requests + Supplier Invoices
- คืนสินค้า (return items + credit notes)

### 🔧 ครุภัณฑ์ + 📊 BI Dashboard + 🔍 Audit Log

---

## 🔐 Roles (11 ระดับ)

`admin`, `manager`, `nurse`, `doctor`, `dietitian`, `pharmacist`,
`physiotherapist`, `caretaker`, `accountant`, `staff`, `viewer`

---

## 🚀 Development Workflow

### Local Setup
```bash
# Clone repo
git clone https://github.com/imaaon/navasri-system.git
cd navasri-system

# เปิดใน browser ผ่าน live-server หรือ http-server ใดก็ได้
npx http-server . -p 8080
# → http://localhost:8080
```

### Deploy
- **Frontend:** push to `main` → GitHub Pages auto-deploys ใน ~30-60 วินาที
- **Edge Functions:** deploy ผ่าน Supabase Dashboard หรือ CLI
- **DB Migrations:** ใช้ Supabase Dashboard SQL Editor

### Versioning
- Script tags ใน `index.html` ใช้ query param `?v=N`
- เมื่อแก้ไฟล์ JS ต้อง bump version เพื่อ bypass browser cache
- ดู version ปัจจุบันที่ HEAD ของแต่ละ commit

---

## 🛡️ Security Posture

- ✅ RLS เปิดทุกตาราง (61 tables ใน public schema)
- ✅ SECURITY DEFINER functions: REVOKE EXECUTE FROM public + GRANT authenticated only
- ✅ Storage buckets: tightened SELECT policies (require has_role)
- ✅ XSS protection: `escapeHtml()` ที่ทุก dynamic content sink
- ✅ Input validation: Thai idcard 13 หลัก, phone 9-10 หลัก, date order, positive amounts

---

## 💾 Backup Strategy

3 layers:
1. **Manual Excel backup** (Edge Function `backup` v26) — 56 ตาราง
2. **Supabase PITR** — 7 วันย้อนหลังอัตโนมัติ (Free tier)
3. **Storage uploads** — ไฟล์สัญญา/ประวัติการรักษา คงอยู่ใน Supabase Storage

ดูรายละเอียดและขั้นตอนกู้คืนใน [`docs/RECOVERY_PROCEDURES.md`](docs/RECOVERY_PROCEDURES.md)

---

## 📋 Final Inspection Status

ดู [`CHANGELOG.md`](CHANGELOG.md) สำหรับประวัติการตรวจสอบและแก้ไขทั้งหมด

**Latest:** Final Inspection R2 (9 พ.ค. 69) — 7/8 phases complete

---

## 📝 License & Attribution

ระบบนี้พัฒนาขึ้นเพื่อใช้ภายใน นวศรีเนอร์สซิ่งโฮม เท่านั้น
ไม่อนุญาตให้ทำซ้ำหรือเผยแพร่โดยไม่ได้รับอนุญาต

**Owner:** กษิดิศ อุดมภาพ (อ้น)
**Repository:** github.com/imaaon/navasri-system
