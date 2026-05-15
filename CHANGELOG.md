# Changelog — Navasri Nursing Home System

บันทึกการเปลี่ยนแปลงสำคัญของระบบ Navasri Nursing Home Management System

รูปแบบอ้างอิง [Keep a Changelog](https://keepachangelog.com/) — วันที่ใช้ พ.ศ.

---


## [R17–R24: R3 Design Alignment] — 15 พ.ค. 2569

ชุดการปรับปรุงเพื่อ align ระบบทั้งหมดกับ R3 design intent — กำจัด legacy code ที่หลงเหลือ และลดความซับซ้อนของ codebase

### R17 — Inline Styles Reduction Batch 2 (Tag `v-r17-complete`)

- เพิ่ม 22 utility classes ใน `style.css` (`.m-0`, `.section-label`, `.fs-13`, `.pos-rel`, `.typeahead-dropdown`, `.grid-2col`, etc.)
- ลด inline styles ใน `html/modals.html`: 589 → 438 (-151)
- ลด inline styles ใน `html/pages.html`: 555 → 379 (-176)
- รวมลด -327 inline styles
- ไม่แตะ `style="display:none"` (JS toggle ใช้)

### BUG-D06 Fix — Physio Package Modal (Tag `bug-d06-fixed`)

- แก้ DOM ID mismatch 9/12 ใน `openAddPhysioPackageModal()` + `savePhysioPackage()`
- เปลี่ยน pattern จาก typeahead → select
- ลบ field ที่ไม่อยู่ใน HTML (`pp-used`, `pp-active`) → stash ค่าเดิมผ่าน `dataset` แทน
- ผู้ใช้สามารถเพิ่ม/แก้ Physio Package ได้แล้ว (เดิมพังเงียบ ๆ)

### R18 — Inline Styles Reduction Batch 3 (Tag `v-r18-complete`)

- เพิ่ม 26 utility classes (chip-toggle 3 sizes, modal max-widths, tab-button, label-mini, etc.)
- ลด -138 inline styles
- รวม R17+R18: -465 inline styles

### R19 — CSS Duplicate Cleanup (Safe) (Tag `v-r19-complete`)

- รวม `.sidebar` legacy (layout) + R3 (visual) เป็น rule เดียว
- ลบ legacy `.toast` backgrounds ที่ทับ R3 redesign (พื้นเขียว/ส้ม/แดงสด → พื้นขาวขอบซ้ายสี)

### R20 — Eliminate All CSS Duplicates (Tag `v-r20-complete`)

- รวม/ลบ 48 selectors ที่ legacy + R3 redesign เขียนซ้อนกัน → เหลือ 1 rule ต่อ selector
- กลยุทธ์: ยึด R3 (override) + เก็บ legacy-only functional properties
- Selectors ที่กระทบ: `.btn` family (6), `.card` family (4), `.modal-*` (7), `.sidebar/nav/topbar` (10), tables (5), `.cat-*` (4), อื่น ๆ
- Verified: brace balance + property-key sets ตรงกัน R19 baseline

### R21 — Replace Non-R3 Colors in JS/HTML (Tag `v-r21-complete`)

- แทน 230 occurrences ของสีสด R2-era ใน 29 ไฟล์
- `#e74c3c` → `var(--danger)` (85 ครั้ง)
- `#3498db` → `var(--info)` (13 ครั้ง)
- `#27ae60` → `var(--success)`
- `#f39c12` → `var(--warning)`
- Alpha versions `#XXXXXX22` → semantic-bg tokens
- **Critical fix:** `vitalsSparkline` SVG attribute → `style=""` (SVG attrs ไม่ resolve CSS var)

### R22 — CSS Hex Hunt (Tag `v-r22-complete`)

- แทน 27 R2-era hex literals ใน `style.css` → R3 tokens
- ค้นพบและหลีกเลี่ยง bug: CSS attribute selectors `[style*="#hex"]` ต้องเก็บ literal hex (match กับ HTML inline)

### R23 — Final Non-R3 Cleanup (Tag `v-r23-complete`)

- เก็บกวาด 90 บรรทัดที่ R21 script ไม่ครอบ
- `#e67e22`, `#2980b9`, `#d4760a`, `#95a5a6`, `#2a7a4f`, `#7a4310`, `#d35400`, `#8e44ad` → R3 tokens

### R24 — Deep Cleanup (Tag `v-r24-complete`)

- ครอบ Tailwind-style colors + tailwind grays (`#fef3c7`, `#15803d`, `#9ca3af`, etc.) → R3 tokens
- ครอบ 100+ unique colors → semantic tokens
- เก็บ legacy hex ใน `billing-print.js` (PDF generation ใช้ literal color)
- เก็บ domain colors (room types, billing doc type variants)

### สรุปสถิติทั้งชุด

- **CSS duplicate selectors:** 48 → 0
- **Inline styles:** -465
- **Non-R3 colors:** ~550 → 0 (เฉพาะที่มี R3 equivalent)
- **ไฟล์ที่กระทบ:** 30+
- **Cache:** style.css v=84 → v=93 (+9 bumps)
- **JS files:** 26 file versions bumped
- **Functional bug fix:** BUG-D06 (Physio Package modal)

### Anchors สำหรับ revert

- `v-r17-complete` — ก่อน BUG-D06 fix
- `v-r18-complete` — หลัง inline batch 3
- `v-r19-complete` — หลัง safe CSS duplicate cleanup
- `v-r20-complete` — หลังกำจัด CSS duplicates ทั้งหมด
- `v-r21-complete` — หลัง JS/HTML color migration
- `v-r22-complete` — หลัง CSS hex hunt
- `v-r23-complete` — หลัง final non-R3 cleanup
- `v-r24-complete` — current HEAD (deep cleanup)

---

## [Final Inspection R2] — 9 พ.ค. 2569

การตรวจสอบและ harden ระบบรอบที่ 2 ครอบคลุม 8 ด้าน เพื่อยกระดับความปลอดภัย ความถูกต้องของข้อมูล และความสามารถในการกู้คืน

### Phase 1 — Security & Auth (HEAD `47257d6`)

**Database**
- REVOKE EXECUTE FROM public + GRANT authenticated 15 SECURITY DEFINER functions
- คงไว้ public บน `has_role()`, `get_my_role()`, `get_my_uid()` (จำเป็นสำหรับ RLS policy)
- Storage `images` bucket: SELECT policy require has_role (เดิมเปิดให้ทุก authenticated)
- ลบ unused indexes 26 ตัว (ลดขนาด WAL + DML overhead)
- เพิ่ม FK covering indexes 19 ตัว (เพิ่มประสิทธิภาพ JOIN)

**Frontend**
- เพิ่ม `escapeHtml()` ใน `js/shared/ui.js` (v=9)
- Apply XSS protection 4 จุดสำคัญ:
  - `billing-core.js:274` — payer name (v=34)
  - `health.js:536` — patient badge (v=18)
  - `billing-clinical.js:543` — dropdown options (v=22)
  - `suppliers.js:871` — staff datalist (v=36)
- ลบ `legacy/` folder (260 KB orphan code)

**Manual pending:**
- Auth → Enable Leaked Password Protection (Supabase Dashboard)
- Edge Functions → Verify JWT for `manage-users` + `backup`

### Phase 2 — Database Integrity

**Constraints เพิ่ม:**
- 3 UNIQUE indexes (partial, exclude empty):
  - `uq_invoices_doc_no`
  - `uq_expenses_doc_no`
  - `uq_beds_room_bedcode`
- 9 Foreign Keys:
  - `fk_patients_current_bed` (SET NULL)
  - `fk_prh_from_bed/to_bed/from_room/to_room` (SET NULL)
  - `fk_return_items_item/req` (RESTRICT)
  - `fk_stmov_lot` (SET NULL)
  - `fk_approval_logs_req` (CASCADE)
- 7 NOT NULL constraints:
  - `patients.status` (DEFAULT 'active')
  - `invoices.doc_no`, `expenses.doc_no`
  - `beds.room_id`, `beds.status` (DEFAULT 'available')
  - `app_users.username`

**Cleanup:**
- Rename `requisitions` → `_legacy_requisitions` (uuid table, 0 references in code, scheduled deletion 23 พ.ค. 2569)
- เพิ่ม COMMENT บน `item_lots.purchase_id` (column name ทำให้เข้าใจผิด แต่ใช้ใน `receive_stock_v2()`)

### Phase 3 — Code Quality (HEAD `88d8fdc`)

- ลบ `js/modules/billing/billing-physio.js` (190 LOC, all functions overridden)
- ลบ `js/modules/billing/billing-physio-packages.js` (145 LOC, orphan, ใช้ DOM ID ผิด)
- ลบ duplicate line ใน `billing-core.js:937` (`renderPhysioPackagesTab` ซ้ำ 2 ครั้ง)
- bump `billing-core` v=35
- รวม **−360 LOC, −2 ไฟล์**

**Discovered (deferred):**
- BUG-D06 (LOW): `openAddPhysioPackageModal` ใน `billing-contract.js` ใช้ DOM IDs ผิด 9/12
  - DB `physio_packages` ว่าง จึงไม่กระทบ runtime
  - รอแก้เมื่อใช้ feature จริง

### Phase 4 — Performance ⏭️ SKIP

วัดผลแล้วระบบไม่ช้า:
- DOM Ready 875ms, Page Load 883ms
- JS bundle 302 KB / 38 files
- `showPage` 1-128ms ทุกหน้า
- Patient Profile 19 tabs โหลดครบใน 2.2s

พบ pattern `select *` 33 จุด + N+1 4 จุด แต่ไม่กระทบเพราะ DB เล็ก
— เก็บไว้ทำเมื่อระบบช้าจริง

### Phase 5 — Error Handling (HEAD `7b55469`)

แก้ silent failures 6 จุด (เพิ่ม error checks + rollback patterns):
- C1) `clinical-nursing.js` `saveDischarge` — `beds.update(status='available')` ตรวจ error + warning toast
- C2) `clinical-mar.js` `deleteMedication` — `patient_medications.update(is_active=false)` ตรวจ error
- C3a) `clinical-profile.js:1764` — contract files insert error + storage rollback ถ้า DB fail
- C3b) `clinical-profile.js:1890` — medical files (pattern เดียวกัน)
- C4) `billing-reset.js` — `payments.delete` + `invoices.update` ตรวจ error
- C5) `clinical-belongings.js` — DNR/Consent update ตรวจ error

**Versions bumped:** clinical-nursing v=18, clinical-mar v=23, clinical-belongings v=7, clinical-profile v=64, billing-reset v=3

### Phase 6 — Data Validation (HEAD `a2cd94c`)

เพิ่ม shared validators ใน `js/shared/utils.js` (v=4):
- `validateThaiIdCard(idcard)` — null=OK, optional, accepts dashes
- `validatePhone(phone)` — 9-10 digits, accepts dashes
- `validateDateOrder(start, end, startLabel, endLabel)`
- `validatePositiveAmount(amount, label)` — no negative

**Apply ใน 4 forms:**
1. `savePatient` — idcard 13 หลัก IF id_type='thai', phone 9-10, emergency 9-10, end_date≥admit_date
2. `saveStaff` — idcard 13 (thai only), phone, end_date≥start_date
3. `saveDischarge` — discharge_date≥admit_date
4. `saveDeposit` — amount≥0

**จงใจไม่ validate:**
- ราคา (item-cost/item-price/room_rate/pt_rate) — 0 บาทอนุญาต (donations/free samples)
- passport/alien/workpermit — ไม่บังคับ format

UI tested ผ่าน 12 test cases

### Phase 7 — Backup & Recovery

Deploy Edge Function `backup` v25 → **v26**

เพิ่ม 5 ตารางใน Excel backup (เดิม 51 → 56 ตาราง):
- `settings` (3 rows config ระบบ)
- `patient_contract_files` (41 rows ดัชนีไฟล์สัญญา)
- `patient_medical_files` (ดัชนีไฟล์ประวัติการรักษา)
- `patient_diets` (แผนโภชนาการรายวัน)
- `patient_incidents` (บันทึกอุบัติเหตุ — เพิ่มเติมจาก `incident_reports`)

**ตารางที่จงใจไม่รวม:**
- `app_users` (sensitive, Supabase Auth จัดการ)
- `document_sequences` (counter, gen ใหม่ได้)
- `physio_packages`, `tube_feeding_logs`, `purchases` (ตอนนี้ว่าง)

Frontend ไม่ต้องแก้ — ใช้ endpoint เดิม

ดูคู่มือกู้คืนใน [`docs/RECOVERY_PROCEDURES.md`](docs/RECOVERY_PROCEDURES.md)

### Phase 8 — Documentation & Versioning (HEAD `8f2dc33`)

- เพิ่ม [`README.md`](README.md) (root) — Quick reference + tech stack + structure
- เพิ่ม [`CHANGELOG.md`](CHANGELOG.md) (root) — เอกสารฉบับนี้
- เพิ่ม [`docs/RECOVERY_PROCEDURES.md`](docs/RECOVERY_PROCEDURES.md) — คู่มือกู้คืนข้อมูลฉุกเฉิน

---

## [Final Inspection R1] — 7-8 พ.ค. 2569

การตรวจสอบรอบที่ 1 ครอบคลุม 4 phases (P1-P4) ปิด bug ทั้งหมด

### P1 — Critical Bugs (5 bugs closed)
- ปัญหา password authentication
- Return-item 4-layer fix (RPC args, items.updated_at, RPC body schema, return_items UUID)
- Expense doc numbering
- Tab state clearing across 3 modals
- FK cascade audit ตาราง 22 ตัว (18 CASCADE + 4 RESTRICT) ลบ orphan records 10 ตัว

### P2 — Form & Backup Bugs (3 + 2 bonus)
- `appt_time` empty → null
- `bsAddBank` 5 sub-fixes (settings.key UNIQUE conflict 3 จุด)
- `backupAllData` ใช้ fetch + auth headers + Blob (เดิม window.location)
- Bonus: ย้าย `expiryWarnDays` ไปอยู่ใน stock settings + เพิ่มปุ่ม Excel/Settings

### P3 — UI Polish (5 bugs + 4 features)
- Bug fixes + เพิ่ม typeahead 4 features

### P4 — Code Cleanup
- P4A: ลบ legacy `billing.js`
- P4B: comment fixes
- P4C: แปลง 74 confirm/alert calls เป็น modals
- P4D: Lab default date
- P4E: รวม Expense Voucher
- P4F: ปิด accessibility work เป็น out-of-scope (internal-use system)

### Phase 2 UI Real-Click Testing — 8 พ.ค. 2569
ทดสอบจริง 10 รอบ ครอบคลุม 28 หน้า + 19 tabs:
- R1 สต็อก: ✅ clean
- R2 เบิกของ: ✅ clean
- R3 ประวัติ: ✅ clean
- R4 Patient Profile 19 tabs: 6 bugs fixed (R4-001 vitals, R4-002 nursing, R4-003 DNR, R4-004 lab, R4-005 excretion, R4-006 fluid — pattern: missing empty-row validation)
- R5 Room/Bed/Staff/Account: 3 bugs fixed
- R6 Billing/Payments/Expense: 5 bugs fixed
- R7 Suppliers/PR/Invoices: ✅ clean
- R8 Reports/Audit/Assets: 5 bugs fixed
- R9 Dashboard/BI: 3 bugs fixed
- R10 Settings/Backup: 1 bug fixed

**รวม 23 bugs fixed ใน session เดียว**

---

## [Pre-Inspection Era] — มีนาคม - เมษายน 2569

### เมษายน 2569 — Webapp Stabilization
- แก้ `billing-contract.js` syntax error (กระทบ 20 functions)
- เพิ่ม 📋 แพ็กเกจ button ใน patient profile sidebar
- ออกแบบ Dashboard upcoming appointments widget ใหม่ (setInterval poller fix)
- สร้าง Git tag `v26`
- แก้ race condition: secondary DB overwrites
  - Phase 1: router await
  - Phase 2: await `ensureSecondaryDB()` ใน 33 functions across 11 files
- Live launch: navasriapp.com (Namecheap + GitHub Pages DNS)

### มีนาคม - เมษายน 2569 — Go-live Preparation
- Domain navasriapp.com purchased
- Supabase data cleared (audit_events + stock data) for go-live
- สร้าง 12-slide PowerPoint + stock_template.xlsx
- ค้นพบ + แก้ missing script tag ใน index.html (fix-features Edge Function)
- Backup zip `navasri_stable_v56_complete.zip`
- เริ่ม rule: pull latest Supabase migrations ก่อน package backup

### ก่อนหน้า — Foundation
- Vanilla JS + Supabase + GitHub Pages full-stack ERP
- Clinical module: nursing shift removal, photo upload, vital signs weight/height, status logs
- UUID bug fixes ใน onclick handlers
- Fixed box-drawing character SyntaxErrors (billing/requisition files)
- Migration: requisition system → `requisition_headers` + `requisition_lines`
- patient_id type corrections (bigint → UUID) ใน 6+ tables

---

## Versioning Strategy

| ระดับ | วิธี | ตัวอย่าง |
|---|---|---|
| Script files | `?v=N` query param ใน `index.html` | `billing-core.js?v=35` |
| Database | Migrations ผ่าน Supabase Dashboard | timestamped SQL files |
| Edge Functions | Auto-versioned by Supabase | `backup` v=26 |
| Releases | Git tags (occasionally) | `v26` |

เมื่อแก้ไฟล์ JS **ต้อง** bump version เพื่อ bypass browser cache
