# การวิเคราะห์ระบบส่งเวร/รับเวร — Navasri Nursing Home

**Project**: นวศรีเนอร์สซิ่งโฮม (Navasri Nursing Home, รามคำแหง)
**Author**: Claude session กับ Kasidis (อ้น)
**Status**: 🟡 PENDING — รอ Kasidis ปรึกษากับหน้างานจริงก่อนตัดสินใจ

---

## 📅 Sessions Log

- **Session 1** (18 พ.ค. 2569 ตอนเช้า) — วิเคราะห์ Flow + ปัญหา patient assignment
- **Session 2** (18 พ.ค. 2569 ตอนเย็น) — วิเคราะห์ Information Overload + ค้นพบระบบ "ปิดเวร" ที่มีอยู่
- **Implementation**: แก้ bug 2 จุดในระบบส่งเวร (filter consistency + slice cap)

---

## 📋 บริบทธุรกิจ

**นวศรีเนอร์สซิ่งโฮม**
- ดำเนินงาน 30+ ปี
- คนไข้ **43 คน** (อาจขยายเป็น 50-60 คนในอนาคต)
- พนักงานดูแล (caregiver) ~8 คน/กะ
- 1 caregiver : 5 คนไข้ (โดยประมาณ)
- 2 กะ: เช้า (07:00-19:00) + ดึก (19:00-07:00)

**Device usage**:
- พยาบาล (nurse/parttime_nurse) = ใช้คอม
- พนักงาน (caregiver) = ใช้มือถือเท่านั้น (อาจซื้อ tablet 1 เครื่อง/ward)
- Internet ครอบคลุมทุก ward
- การ training ทำเองได้

**Current Workflow (จริงๆ ที่ใช้อยู่)**:
- caregiver กรอกข้อมูลใส่กระดาษก่อน → แล้วค่อยลงระบบเอง (double entry)
- หน้าส่งเวรในระบบ **ยังไม่มีคนใช้** (0 adoption ตอนนี้)
- เปิดส่งเวรเป็นกระดาษ

---

## 🎯 Flow ที่ Kasidis เสนอ (Session 1)

```
[เริ่มกะ]
  พนักงาน 8 คนเริ่มทำงาน
  ↓
ทำงานตลอดกะ + บันทึก vital sign, ขับถ่าย, ฯลฯ
  ↓
[ก่อนเลิกงาน]
  พนักงานแต่ละคนกด "ส่งเวร"   ← ที่ยังไม่มีในระบบ (เห็นชัดเจน)
  ↓
พยาบาล (supervisor) กดอนุมัติการส่งเวร   ← ที่ยังไม่มี (เห็นชัดเจน)
  ↓
[กะถัดไปเริ่ม]
  พนักงานใหม่กด "รับเวร" → ดูข้อมูลที่ต้องระวัง   ← มีปุ่มแล้ว
```

---

## 🔍 สถานะระบบปัจจุบัน (ที่ตรวจจริง)

### ✅ มีอยู่แล้ว — Section A: หน้า "ส่งเวร" (handover dashboard)
1. **เมนู "ส่งเวร"** — เห็นได้โดย: admin, manager, nurse, parttime_nurse, caregiver
2. **Auto-aggregation** — สรุปข้อมูลกะอัตโนมัติจาก raw data:
   - 🩺 Vital signs ผิดเกณฑ์ (BP, HR, Temp, SpO2, DTX)
   - 🚨 Incident (อุบัติเหตุ)
   - 💩 ขับถ่าย/ปัสสาวะ/อาเจียนผิดปกติ
   - 🩹 บันทึกแผล (ต้องติดตาม 24 ชม.)
   - 💊 ยาสำคัญ
   - 📅 นัดหมาย
   - 📝 หมายเหตุพิเศษ (จาก nursing_notes.handover_note)
3. **ปุ่ม "✓ รับเวร"** + ตาราง `shift_handover_acks` — แต่เป็นแค่ audit log
4. **Audit trail record-level** — ทุก record มี `recorded_by` หรือ `created_by`

### ⭐ มีอยู่แล้ว — Section B: ระบบ "ปิดเวร / สรุปส่งเวร" (พบใน Session 2)
**Location**: Profile ผู้รับบริการ → tab Vital Signs → scroll ลงล่าง → card "📋 สรุปอาการรวมต่อเวร"

**DB Table**: `patient_shift_summaries`

**Features ครบ**:
- ✏️ พิมพ์สรุปต่อเวร (`summary_text`) — auto-generate + แก้ไขได้
- 🔒 **ปิดเวร** (`is_closed=true`, `closed_at`, `closed_by`) — เทียบเท่า "ส่งเวร"
- 🔁 ขอเปิดเวรใหม่ (`reopen_requested=true`, reason) — สำหรับ caregiver
- ✅ อนุมัติ/ปฏิเสธ reopen — สำหรับ admin/manager/nurse

**Scope ของ "ปิดเวร"** (สำคัญ — รวมแค่ 3 ประเภท):
| ข้อมูล | รวมไหม |
|--------|--------|
| 🩺 Vital signs | ✅ |
| 💧 น้ำเข้า-ออก (excretions) | ✅ |
| 🤢 อาเจียน + fluid records | ✅ |
| 🚨 อุบัติเหตุ (incidents) | ❌ ไม่รวม |
| 🩹 แผล (wounds) | ❌ ไม่รวม |
| 💊 ให้ยา (medications) | ❌ ไม่รวม |
| 📅 นัดหมาย | ❌ ไม่รวม |
| 🍽️ โภชนาการ | ❌ ไม่รวม |

**Adoption ปัจจุบัน**: 0 records (ไม่มีใครใช้เลย)

### ❌ ยังไม่มี
1. ปุ่ม "ส่งเวร" ใน dashboard (หน้าส่งเวรหลัก) — มีแค่ "รับเวร"
2. Workflow approval แบบที่ Kasidis เสนอ (caregiver ส่ง → พยาบาลอนุมัติ)
3. ตาราง `shift_handover_sends` (ถ้าจะทำใหม่)
4. ตาราง `shift_assignments` (ใครดูแลคนไข้คนไหน)
5. Link ระหว่าง "ปิดเวร" (per-patient) ↔ "ส่งเวร" (dashboard)
6. Dashboard "สถานะปิดเวร" — ไม่รู้ว่า 43 คน ปิดแล้วกี่คน
7. Notification reopen request

---

## 🐛 Bugs ที่แก้ในระหว่างวิเคราะห์ (Session 2)

### Bug Fix 1: Incident filter inconsistent (commit 751a5e6)
**ปัญหา**:
- vital/excretion/fluid ใช้ time range filter (`recorded_at` ในช่วงเวลากะ) ✅
- แต่ incident ใช้ date filter (วันที่ทั้งวัน) — เด้งข้ามกะได้
- ผล: เวรดึก 18 พ.ค. ยังเห็น incident ของเวรเช้า 14:36 ค้างอยู่

**Fix**: เปลี่ยน incident query [2] ให้ใช้ `created_at` + time range
**ผลหลังแก้**: ถ้าเหตุการณ์เกิด 14:36 (กะเช้า) จะหายไปเมื่อเปิดเวรดึก

### Bug Fix 2: slice() cap ตัดข้อมูลทิ้งเงียบๆ (commit 0c66885)
**ปัญหา**: 3 sections มี `slice(0, N)` ตัด items ทิ้งโดย user ไม่รู้
- 🚨 เร่งด่วน: cap 20 → ถ้า 25 events ตัดทิ้ง 5
- 🩹 ต้องติดตาม: cap 15
- 📅 นัดหมาย: cap 20

**ผลในระบบ 43+ คน**: เป็น "ระเบิดเวลา" ที่เมื่อ adoption สูงขึ้น critical events จะหายไปโดย user ไม่รู้

**Fix**: ลบ `.slice(0, N)` ออกทั้ง 3 จุด → render items ทั้งหมด
**Performance**: 43 คน × ~3 events = ~130 DOM elements — browser render ได้สบาย

---

## 💭 Mental Models — เข้าใจระบบให้ตรง

### Mental Model 1: หน้าส่งเวร = "Smart Dashboard ที่ render real-time"
- **ไม่ใช่** snapshot ที่ "save" ไว้
- ทุกครั้งที่เปิด → query raw data + filter ตาม time range ของ shift+date ที่ user เลือก
- ไม่ track ตาม user — ทุกคนเห็นข้อมูลเดียวกัน (เลือก dropdown เดียวกัน)

### Mental Model 2: "Active Handover" (Kasidis เสนอ Session 2)
- ระบบไม่ "ส่งเวร" ให้อัตโนมัติ
- พยาบาลกะใหม่ต้อง "ขอดู" เอง (เลื่อน dropdown ไปดูกะก่อน)
- Logic: "วันนี้ทำกะนี้ → ดูข้อมูลกะตัวเอง + เลื่อนดูกะก่อนเพื่อรับทราบ"

### Mental Model 3: 2 ระบบส่งเวรไม่เชื่อมกัน
- ระบบ A (ปิดเวร per-patient) — per profile
- ระบบ B (ส่งเวร dashboard) — overview
- ไม่มี link ระหว่างกัน → user สับสน

---

## ❓ คำถามสำคัญที่ค้นพบจาก Session 2

### Q1: ค่าวิกฤตเท่านั้นที่ขึ้นหรือ? — ✅ ใช่
ระบบมี threshold ตายตัว:
- 🔴 HIGH: BP ≥160/≤90, Temp ≥39/≤35, SpO2 ≤88, HR ≤50, DTX ≥250/≤70, เลือดปน, เหลวเป็นน้ำ
- 🟠 MEDIUM: BP_dia ≥100/≤50, Temp 38-39, SpO2 89-92, HR ≥120, เหลืองเข้ม/น้ำตาล/ขุ่น (urine), เหลว (stool), น้ำดี (vomit)

### Q2: ข้อมูลค้างถาวรไหม? — ❌ ไม่
- ผูกกับ time range ของกะ
- เปลี่ยน shift+date → ดู range ใหม่
- "ลืม" ทันทีเมื่อเลื่อนไปกะถัดไป

### Q3: เมื่อไหร่ค่าเป็น 0? — เมื่อ time range ใหม่ไม่มี records (ไม่เกี่ยวกับเวลาผ่านไป)

### Q4: ปุ่ม "รับเวร" คืออะไร? — แค่ audit log "user X รับทราบ" ไม่ผูกกับ "ปิดเวร"

### Q5: ถ้าไม่กดส่งเวร (ปิดเวร) จะเป็นอย่างไร?
- summary_text ยังแก้ได้
- ไม่มี indicator
- ไม่กระทบหน้าส่งเวร (เพราะ 2 ระบบไม่เชื่อม)

### Q6: ถ้าไม่กดอนุมัติ (reopen) จะเป็นอย่างไร?
- pending ค้าง
- caregiver แก้ไม่ได้
- ไม่มี notification

---

## 🔴 ปัญหาสำคัญที่ค้นพบ (Session 2)

### Problem 1: ระบบ "ปิดเวร" ที่มีอยู่ — Scope ไม่ครบ
รวมแค่ 3 จาก ~10 data types → ใบสรุปไม่ครอบคลุม:
- ผู้ป่วยพลัดตก ❌ ไม่อยู่ในสรุป
- ให้ยาผิด ❌ ไม่อยู่
- ถ่ายเป็นเลือด ✅ อยู่
- แต่ "ถ่ายเป็นเลือดเพราะแผลในกระเพาะ" (เป็น incident) ❌ ไม่อยู่

### Problem 2: ภาระสูงมาก
- ต้องปิดเวร**ทีละผู้ป่วย** × 43 คน × 2 กะ = **86 actions/วัน**
- ไม่มีใครใช้เลย (DB = 0 records)

### Problem 3: 2 ระบบไม่เชื่อมกัน
- หน้าส่งเวร (dashboard) ไม่รู้ว่าใครปิดเวรแล้ว
- ไม่มี progress indicator
- ไม่มี link

### Problem 4: ไม่มี Notification ของ reopen
- caregiver ขอเปิดเวร → pending ไม่มีใครรู้
- ค้างไม่อนุมัติได้นาน

### Problem 5: User สับสน
- "ส่งเวร" (menu) = dashboard ดูภาพรวม
- "ปิดเวร / สรุปส่งเวร" (in profile) = ส่งเวรจริง
- ชื่อใกล้กัน — user งงเป็นปกติ

### Problem 6: Hidden feature
- "ปิดเวร" ซ่อนใต้ tab Vital ใน Profile
- User หาไม่เจอ → ไม่ใช้

### Problem 7: Information Overload (Potential)
- 43 คน × ค่าวิกฤต = อาจเจอ 40-75 events/กะ
- บนมือถือ scroll ยาวมาก
- (แต่ในความเป็นจริง Kasidis ประเมินว่าจะไม่มี critical event 40 คนพร้อมกัน — น่าจะ manageable)

### Problem 8: Double-entry burden
- caregiver เขียนกระดาษ → ลงระบบ
- ภาระ 2 รอบ → adoption ต่ำ

---

## 🎯 Strategic Options ที่อภิปราย

### สำหรับระบบ Workflow (Session 1)

#### Option 1: Phase 1A-C ทีละขั้น (Pragmatic)
- 1A: Quick win (rename menu, add help text, shortcut button)
- 1B: Add ปุ่มส่งเวร + ตาราง shift_handover_sends
- 1C: Patient assignment + smart confirmation

#### Option 2: ไม่ทำอะไร เพราะระบบที่มีก็ใช้ได้ (Passive)
- Auto-aggregation ดีอยู่แล้ว
- ไม่บังคับ workflow → flexible

#### Option 3: Full Redesign (High risk)
- Overhaul ทั้ง handover system
- Approval workflow + assignment

### สำหรับระบบ "ปิดเวร" (Session 2)

#### Path A: ทำให้ "ปิดเวร" ใช้งานได้จริง (Improve current)
- เพิ่ม scope (incident, wounds, meds)
- ลด friction (bulk close, hotkey)
- ทำให้เห็นในหน้าส่งเวร (progress indicator)
- เพิ่ม notification reopen

#### Path B: ลบ "ปิดเวร" — ใช้ระบบใหม่ (Simpler)
- ลบ feature นี้ทิ้ง (0 adoption อยู่แล้ว)
- เพิ่ม "Shift handover note" ในหน้าส่งเวร (overall, ไม่ per-patient)
- 1 note/กะ ไม่ใช่ 43 notes/กะ

#### Path C: เก็บไว้ใช้สำหรับ "ผู้ป่วยพิเศษ" (Selective)
- ใช้ "ปิดเวร" เฉพาะคนที่มี critical event
- ไม่บังคับทุกผู้ป่วย
- หน้าส่งเวรไฮไลท์คนที่ปิดเวรแล้ว

#### Path D: เก็บไว้ก่อน — ไปคุยหน้างาน
- ปรึกษาทีมพยาบาลก่อน
- หาว่าทำไมไม่ใช้
- แก้ตาม pain ที่แท้จริง

---

## 🗄️ DB Schema ที่เกี่ยวข้อง

### ตารางที่มีอยู่
```sql
-- 1. shift_handover_acks (มี) — รับเวร (audit log)
CREATE TABLE shift_handover_acks (
  id, shift_date, shift, acked_by, acked_by_role, acked_at
);

-- 2. patient_shift_summaries (มี) — ปิดเวร per-patient
CREATE TABLE patient_shift_summaries (
  id, patient_id, shift_date, shift, summary_text, recorded_by,
  created_at, updated_at,
  is_closed BOOLEAN, closed_at, closed_by,
  reopen_requested BOOLEAN, reopen_requested_at, reopen_requested_by, reopen_reason
);

-- 3. nursing_notes (มี) — handover_note ผูกกับ nursing note
-- 4. patient_excretions / patient_fluid_records / patient_wounds / patient_medications
--    incident_reports / patient_appointments — raw data tables
```

### ตารางที่เสนอเพิ่ม (ยังไม่ทำ)
```sql
-- A. shift_assignments — ใครดูแลคนไข้คนไหนรายกะ
CREATE TABLE shift_assignments (
  id, shift_date, shift, staff_id, patient_id,
  assigned_by, assigned_at,
  UNIQUE(shift_date, shift, patient_id)
);

-- B. shift_handover_sends — track ส่งเวรของพนักงาน
CREATE TABLE shift_handover_sends (
  id, shift_date, shift, sent_by, sent_by_role, sent_at, note,
  status TEXT CHECK (status IN ('pending','approved','rejected')),
  approved_by, approved_at, reject_reason
);
```

---

## 📊 Permission Matrix — เมนู "ส่งเวร"

| Role | เห็นเมนู? |
|------|-----------|
| admin | ✅ |
| manager | ✅ |
| nurse (พยาบาลวิชาชีพ) | ✅ |
| parttime_nurse (พยาบาลพาร์ทไทม์) | ✅ |
| caregiver (พนักงานดูแล) | ✅ |
| officer (ธุรการ) | ❌ |
| doctor | ❌ |
| physical_therapist | ❌ |
| dietitian | ❌ |
| warehouse | ❌ |

อ้างอิง: `js/core/permissions.js` lines 4-50

---

## ❓ Open Questions (รอตอบกับหน้างาน)

### กลุ่ม Workflow
1. ปัจจุบันส่งเวรกันยังไง? (กระดาษ? ปาก? Line group?)
2. เคยมีกรณีบันทึกผิดคนไหม? บ่อยแค่ไหน?
3. ถ้าระบบบังคับให้กดส่งเวรก่อนเลิกงาน OK ไหม?
4. พยาบาลอนุมัติทันเสมอไหม?
5. อยากให้มี assignment ใครดูใครไหม?
6. ปัญหาส่งเวรที่เจอบ่อยที่สุดคืออะไร?

### กลุ่ม "ปิดเวร" (พบใหม่ Session 2)
7. ทำไม caregiver ถึงต้องเขียนกระดาษก่อน?
8. รู้จัก feature "ปิดเวร" ใน profile ไหม?
9. ถ้ารู้ — ทำไมไม่ใช้?
10. "สรุปอาการต่อเวร" ควรเป็น per-patient หรือ overall?
11. ใครควรปิดเวรได้บ้าง? (caregiver / nurse / both)
12. Scope ควรครอบคลุมแค่ vital+I/O หรือรวม incident/wounds/meds ด้วย?

### กลุ่ม Adoption
13. caregiver กรอกข้อมูลใส่กระดาษเพราะอะไร? (Hypothesis A-E)
   - A. หน้ากรอกในระบบใช้ยากบนมือถือ
   - B. ระบบช้า → ไม่ปฏิบัติได้ที่ bedside
   - C. นโยบาย/วัฒนธรรม — กระดาษเป็นหลักฐาน
   - D. caregiver ไม่ trust ระบบ
   - E. กระดาษเป็น checklist ระหว่างทำงาน

---

## 🎯 ทางสายกลางที่เสนอ (Pragmatic 3 Phase)

### Phase 1 (ทำได้เลย, low risk)
- เปลี่ยนชื่อเมนูเป็น "รับ-ส่งเวร" หรือ "สรุปกะ"
- เพิ่ม shortcut button "+ เพิ่มหมายเหตุส่งเวร"
- เพิ่ม section "พนักงานในกะนี้" แสดงใครบันทึกอะไรแล้ว
- แสดง help text อธิบาย flow ที่หัวหน้า

### Phase 2 (ถ้าหน้างานต้องการ)
- เพิ่มปุ่ม "ส่งเวร" + ตาราง shift_handover_sends
- ส่งเวรไม่ต้องอนุมัติ (just log) เริ่มจาก simple

### Phase 3 (ถ้าหน้างานต้องการ accountability ลึก)
- เพิ่ม patient assignment system (shift_assignments)
- เริ่มเป็น optional ก่อน (ไม่บังคับใช้)
- เพิ่ม approval workflow ทีหลังถ้าจำเป็น

---

## 🛡️ มาตรการป้องกันบันทึกผิดคน

### มีอยู่แล้ว
1. ✅ **Visual confirmation** — patient pill ในหัว modal (รูป+ชื่อ+HN+ห้อง+อายุ)
2. ✅ **Audit log** — เมนู Audit Trail

### เสนอเพิ่ม (ถ้าทำ assignment system)
3. **Smart confirmation popup** เมื่อบันทึกคนไข้นอก assignment
4. **Real-time anomaly detection** — value เปลี่ยนผิดปกติ
5. **Mandatory double confirmation** สำหรับ high-stakes (medication, vital เกินเกณฑ์)
6. **QR scan ที่เตียง** (อนาคต) — ป้องกันสแกนผิดคน

---

## ⚠️ ข้อควรระวัง (Lessons Learned)

1. **อย่าทำ workflow ซับซ้อนเกินไป** — culture nursing home 30 ปี + พนักงานต่อต้านได้
2. **Friction = error** — กดเยอะ → shortcut → กดผ่าน → ไม่ได้ value
3. **Single point of failure** — พยาบาลคนเดียวอนุมัติทุกกะ = อันตราย
4. **กรณีฉุกเฉิน** — พนักงานต้องกลับด่วน → ใครรับผิดชอบ?
5. **Adoption first** — สวยขนาดไหนถ้าไม่มีคนใช้ก็เปล่าประโยชน์
6. **Hidden features** — feature ที่ซ่อนใต้ tab/menu = ไม่ถูกใช้

---

## 📎 ไฟล์ที่เกี่ยวข้องในระบบปัจจุบัน

### Frontend
- `js/modules/handover.js` (~830 บรรทัด) — หน้าส่งเวร dashboard
- `js/modules/clinical/clinical-vitals.js` lines 700-1500 — ระบบปิดเวร per-patient
- `js/modules/clinical/clinical-nursing.js` — nursing note (handover_note field)
- `js/core/permissions.js` lines 4-50 — RBAC

### HTML
- `html/sidebar.html` line 51 — เมนู "ส่งเวร"
- `html/pages.html` line 2079 — page container
- `html/modals.html` line 376-377 — textarea handover_note ใน nursing modal

### DB Tables (existing)
- `shift_handover_acks` — รับเวร (audit)
- `patient_shift_summaries` — ปิดเวร per-patient (0 records used)
- `nursing_notes.handover_note` — บันทึกส่งเวรรายผู้ป่วย
- `vital_signs`, `patient_excretions`, `patient_fluid_records`
- `patient_wounds`, `patient_medications`
- `incident_reports`, `patient_appointments`

### DB Tables (proposed, not built)
- `shift_assignments` — ใครดูแลคนไหน
- `shift_handover_sends` — ส่งเวรของพนักงาน

---

## 🔖 Next Action

1. ⏳ **Kasidis ปรึกษาทีมพยาบาล** — ถาม 13 คำถามใน Open Questions
2. ⏳ **ตัดสินใจ Strategy**:
   - Workflow: Phase 1/2/3 หรือไม่ทำ
   - "ปิดเวร" current: Path A/B/C/D
3. ⏳ **ถ้าจะทำ → กลับมา session ใหม่** — Claude reference ไฟล์นี้เพื่อ continue

---

## 📊 Bug Fixes ที่ทำในระหว่างวิเคราะห์ (เก็บไว้แล้ว)

| # | Issue | Commit | Status |
|---|-------|--------|--------|
| 1 | Incident filter ใช้ date ไม่ใช่ time range — inconsistent | 751a5e6 | ✅ |
| 2 | slice cap ตัด urgent/follow-up/appointments items ทิ้ง | 0c66885 | ✅ |

---

## 💡 Key Insights (สิ่งที่เรียนรู้จาก 2 sessions)

1. **ระบบส่งเวรปัจจุบัน = "Smart Dashboard"** ไม่ใช่ Workflow System
2. **มีระบบ "ปิดเวร" ที่ Kasidis จำไม่ได้** — ทำไว้ใน profile แต่ไม่ adopt
3. **2 ระบบไม่เชื่อมกัน** — เป็น root cause ของความสับสน
4. **Adoption = 0** — ปัญหาใหญ่กว่า design quality
5. **caregiver = mobile primary** — ต้องคำนึงถึง mobile UX
6. **Volume ที่คาดการณ์**: 40-75 events/กะ ในระบบเต็ม
7. **Risk จาก slice cap**: ระเบิดเวลาที่จะระเบิดเมื่อ adoption สูง
8. **ตามที่ Kasidis ประเมิน**: 43 คนวิกฤตพร้อมกันแทบเป็นไปไม่ได้ — ปัญหาเล็กกว่าที่คาด

---

**สำคัญ**: เอกสารนี้คือการวิเคราะห์เพื่อ "คิดต่อ" — ไม่ใช่ specification สุดท้าย
รอ feedback หน้างานก่อนตัดสินใจ implementation
