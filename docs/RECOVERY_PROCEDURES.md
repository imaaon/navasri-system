# 🆘 Recovery Procedures — Navasri Nursing Home System

คู่มือกู้คืนข้อมูลในกรณีฉุกเฉิน เช่น ข้อมูลถูกลบโดยไม่ตั้งใจ DB เสีย หรือ user ผิดพลาด

> ⚠️ **สำคัญ:** อ่านเอกสารนี้ให้เข้าใจ**ก่อน**เกิดปัญหา — เมื่อปัญหาเกิด เวลาคือสิ่งสำคัญที่สุด

---

## 📋 ระบบกู้คืน 3 ชั้น

ระบบมี 3 layers สำหรับ data protection:

| Layer | ครอบคลุม | ความถี่ | Retention |
|---|---|---|---|
| **1. Manual Excel Backup** | 56 ตาราง user data | ตามที่ admin กดเอง | ขึ้นกับ admin |
| **2. Supabase PITR** | ทุกอย่างใน DB 100% | อัตโนมัติทุกวินาที | 7 วันย้อนหลัง |
| **3. Storage Files** | ไฟล์สัญญา + ประวัติการรักษา | ทันที | 永久 (จนกว่าจะลบ) |

---

## 🚨 Decision Tree — ใช้วิธีไหน?

```
ข้อมูลหาย / เสียหาย?
│
├── เกิดขึ้นภายใน 7 วันที่ผ่านมา? → ✅ ใช้ PITR (Layer 2) ดีที่สุด
│   └── กู้คืนได้ครบ 100% ทุกตาราง
│
├── ต้องการแค่บางตารางหรือ row? → ⚠️ Excel Backup (Layer 1)
│   └── ถ้ามี backup ที่ download ไว้ก่อนหน้า
│
├── ไฟล์อัปโหลด (PDF, รูป) เสียหาย? → 🗂️ Storage (Layer 3)
│   └── path เก็บใน patient_contract_files / patient_medical_files
│
└── เกิน 7 วันแล้ว ไม่มี backup? → 😰 ติดต่อ Supabase Support ทันที
    └── อาจมี emergency backup ที่ Supabase เก็บแยก
```

---

## Layer 1 — Manual Excel Backup

### วิธีสร้าง Backup
1. Login เข้าระบบด้วย role `admin`
2. ไปที่ **Settings & ระบบ** (sidebar) หรือ **💾 Backup ข้อมูล**
3. กดปุ่ม **"💾 Backup ข้อมูลทั้งหมด"**
4. รอประมาณ 10-15 วินาที (ขึ้นกับขนาดข้อมูล)
5. ไฟล์ `navasri_backup_YYYY-MM-DD_HHMM.xlsx` จะ download อัตโนมัติ

### วิธี Restore จาก Excel Backup

> ⚠️ **ไม่มีวิธีอัตโนมัติ** — ต้อง import ทีละตารางผ่าน Supabase Dashboard

ขั้นตอนทั่วไป:
1. เปิดไฟล์ `.xlsx` ตรวจสอบข้อมูลที่ต้องการกู้คืน
2. เปิด Supabase Dashboard → SQL Editor
3. เขียน INSERT statement หรือใช้ Table Editor → Import data
4. **ตรวจสอบ FK constraints ก่อน** — ต้อง insert parent rows ก่อน child

**ตัวอย่าง — กู้คืน 1 patient:**
```sql
-- ตรวจสอบก่อนว่า id ไม่ซ้ำ
SELECT id FROM patients WHERE id = 'xxxxx';

-- Insert จาก Excel
INSERT INTO patients (id, name, hn, dob, ...) VALUES (...);

-- Insert child records (contacts, medications, etc.)
INSERT INTO patient_contacts (patient_id, name, ...) VALUES (...);
```

### ตารางที่อยู่ใน Backup (56 ตาราง)
- **Clinical (28):** patients, patient_contacts, patient_allergies, patient_medications, patient_med_notes, patient_appointments, patient_belongings, patient_consents, patient_contracts, patient_contract_files, patient_deposits, patient_room_history, patient_status_logs, vital_signs, patient_excretions, patient_fluid_records, nursing_notes, medical_logs, patient_medical_files, mar_records, physio_sessions, patient_wounds, wound_care_logs, incident_reports, patient_incidents, tube_feedings, patient_tube_feeds, patient_nutrition, patient_diet_plans, patient_diets, patient_lab_results
- **HR (1):** staff
- **Facility (2):** rooms, beds
- **Inventory (3):** items, item_lots, stock_movements
- **Procurement (8):** suppliers, requisition_headers, requisition_lines, approval_logs, return_items, purchase_requests, purchase_request_lines, supplier_invoices, supplier_invoice_lines, supplier_invoice_links
- **Finance (5):** invoices, payments, expenses, billing_deposits, invoice_reset_logs
- **Assets (2):** assets, asset_maintenance_logs
- **System (2):** settings, audit_events

### ตารางที่ไม่อยู่ใน Backup
- `app_users` (sensitive — Supabase Auth จัดการแยก)
- `document_sequences` (counter — gen ใหม่ได้)
- `physio_packages`, `tube_feeding_logs`, `purchases` (ปัจจุบันว่าง)

---

## Layer 2 — Supabase Point-in-Time Recovery (PITR) ⭐

> **วิธีที่แนะนำที่สุด** สำหรับ disaster recovery — ครอบคลุม 100% และเสียข้อมูลน้อยที่สุด

### ข้อจำกัด
- เก็บ 7 วันย้อนหลัง (Supabase Free tier)
- กู้คืนทั้ง project (ไม่ใช่ทีละตาราง) — ต้องระวัง
- ใช้เวลาประมาณ 5-30 นาที

### วิธีใช้ PITR

1. **Login Supabase Dashboard:** https://supabase.com/dashboard/project/umueucsxowjaurlaubwa
2. ไปที่ **Database → Backups**
3. เลือก timestamp ที่ต้องการกู้คืน (ละเอียดถึงระดับวินาที)
4. กด **"Restore"** — ระบบจะสร้าง snapshot ใหม่
5. **ก่อน restore:** ระบบจะถามให้ยืนยัน (โปรเจคจะถูกแทนที่)

### Best Practice เมื่อใช้ PITR

⚠️ **ก่อน restore ทุกครั้ง:**
1. **Backup ปัจจุบันก่อน** — กด Manual Excel Backup ก่อนทำ PITR
2. **บันทึกเวลาเริ่มเหตุการณ์** — เพื่อเลือก timestamp ก่อนเหตุการณ์ 1 นาที
3. **แจ้งทีม** — ระบบจะ down ระหว่าง restore
4. **Restore ใน "ห้องทดสอบ" ก่อน** ถ้าทำได้ — สร้าง branch ของ project แทน

---

## Layer 3 — Storage Files Recovery

ไฟล์ที่ user upload (PDF สัญญา, รูปประวัติการรักษา) เก็บใน **Supabase Storage** แยกจาก database

### Storage Buckets

| Bucket | เก็บอะไร | RLS |
|---|---|---|
| `images` | รูป patient profile, ทรัพย์สิน | ตรวจ has_role |
| `contracts` | PDF สัญญา | ตรวจ has_role |
| `medical-files` | ประวัติการรักษา (PDF, image) | ตรวจ has_role |

### วิธีกู้คืนไฟล์ที่หาย

**กรณี 1: DB row ถูกลบ แต่ไฟล์ยังอยู่ใน Storage**
1. หา URL ของไฟล์ใน Supabase Dashboard → Storage
2. INSERT row ใหม่ใน `patient_contract_files` หรือ `patient_medical_files` ด้วย URL เดิม

**กรณี 2: Storage file ถูกลบ**
- Supabase ไม่มี trash/recycle bin สำหรับ Storage ⚠️
- ถ้าเป็นไฟล์สำคัญ ต้องติดต่อ Supabase Support ภายใน 24 ชั่วโมง

### Best Practice
- 📁 ผู้ใช้ควร**เก็บสำเนา PDF สัญญาฉบับ original** ที่ตัวเองด้วย ไม่ฝากไว้บน cloud อย่างเดียว
- 🔄 พิจารณา download ไฟล์สำคัญทุกเดือน

---

## 🆘 Disaster Scenarios

### Scenario 1: Admin ลบ patient ผิดคนโดยบังเอิญ
**ทางออก:** PITR ไป timestamp ก่อนเหตุการณ์ 1 นาที (Layer 2)
**Time to Recover:** 5-30 นาที
**Data Loss:** น้อยมาก (1-2 นาทีของกิจกรรมหลังเหตุการณ์)

### Scenario 2: SQL Injection / DROP TABLE
**ทางออก:** PITR ทันที (Layer 2)
**Time to Recover:** 5-30 นาที
**Data Loss:** ขึ้นกับเวลาที่ตรวจพบ

### Scenario 3: เกิน 7 วัน — PITR ไม่ครอบคลุม
**ทางออก:**
1. ใช้ Excel Backup ที่ admin บันทึกไว้ล่าสุด (Layer 1)
2. ติดต่อ Supabase Support — อาจมี backup เก็บแยก
3. Restore ทีละตารางจาก Excel

**Time to Recover:** 1-7 วัน (depending on data volume)
**Data Loss:** ปานกลาง-สูง

### Scenario 4: ไฟล์ PDF สัญญาหาย
**ทางออก:**
1. เช็ค Storage bucket ก่อน
2. ขอ user ส่งไฟล์ original ใหม่
3. Re-upload ผ่านระบบ

---

## 📞 Emergency Contacts

| ปัญหา | ติดต่อ |
|---|---|
| Supabase project down | Supabase Support: https://supabase.com/support |
| GitHub Pages down | ตรวจ status: https://www.githubstatus.com |
| Code rollback | `git revert` หรือ GitHub Pages settings → Rollback |
| Domain navasriapp.com ปัญหา | Namecheap support |

---

## 🔐 Backup Routine แนะนำ

### Daily (อัตโนมัติ — ไม่ต้องทำ)
- ✅ Supabase PITR (อัตโนมัติ)

### Weekly (Manual — แนะนำ)
- 📥 ดาวน์โหลด Excel backup เก็บไว้ที่เครื่อง local
- 💾 บันทึกไปที่ external drive หรือ cloud storage (Google Drive)

### Monthly (Best practice)
- 🔍 ทดสอบ restore — เปิดไฟล์ Excel backup ดูข้อมูลล่าสุด
- 📊 เช็ค Supabase Dashboard → Backups ว่ามี snapshots ครบ
- 🧹 ลบ backup เก่าเกิน 6 เดือนเพื่อประหยัดพื้นที่

---

## 📝 บันทึกการกู้คืน

เมื่อมี recovery event ให้บันทึกที่นี่:

| วันที่ | เหตุการณ์ | วิธีกู้คืน | ผลลัพธ์ | ผู้ดำเนินการ |
|---|---|---|---|---|
| _ตัวอย่าง_ | _ลบ patient ผิด_ | _PITR_ | _สำเร็จ_ | _admin_ |

---

**Last updated:** 9 พ.ค. 2569 (Final Inspection R2 — Phase 8)
