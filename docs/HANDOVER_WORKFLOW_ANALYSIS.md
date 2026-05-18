# การวิเคราะห์ระบบส่งเวร/รับเวร — Navasri Nursing Home

**วันที่บันทึก**: 18 พฤษภาคม 2569 (2026-05-18)
**Status**: 🟡 PENDING — รอ Kasidis ปรึกษากับหน้างานจริงก่อนตัดสินใจ
**Author**: Claude session กับ Kasidis (อ้น)

---

## 📋 บริบทธุรกิจ

**นวศรีเนอร์สซิ่งโฮม**
- ดำเนินงาน 30+ ปี
- คนไข้ ~40 คน
- พนักงานดูแล (caregiver) ~8 คน/กะ
- 1 caregiver : 5 คนไข้ (โดยประมาณ)
- 2 กะ: เช้า (07:00-19:00) + ดึก (19:00-07:00)

---

## 🎯 Flow ที่ Kasidis เสนอ

```
[เริ่มกะ]
  ↓
พนักงาน 8 คนเริ่มทำงาน
  ↓
ทำงานตลอดกะ + บันทึก vital sign, ขับถ่าย, ฯลฯ
  ↓
[ก่อนเลิกงาน]
  ↓
พนักงานแต่ละคนกด "ส่งเวร"   ← ที่ยังไม่มีในระบบ
  ↓
พยาบาล (supervisor) กดอนุมัติการส่งเวร   ← ที่ยังไม่มี
  ↓
[กะถัดไปเริ่ม]
  ↓
พนักงานใหม่กด "รับเวร" → ดูข้อมูลที่ต้องระวัง   ← มีปุ่มแล้ว
```

---

## 🔍 สถานะระบบปัจจุบัน (ที่ตรวจจริง)

### ✅ มีอยู่แล้ว
1. **เมนู "ส่งเวร"** — เห็นได้โดย: admin, manager, nurse, parttime_nurse, caregiver
2. **Auto-aggregation** — สรุปข้อมูลกะอัตโนมัติ:
   - 🩺 Vital signs ผิดเกณฑ์
   - 🚨 Incident (อุบัติเหตุ)
   - 💩 ขับถ่าย/ปัสสาวะ/อาเจียนผิดปกติ (ของใหม่ commit 1bf32c6)
   - 🩹 บันทึกแผล (ต้องติดตาม 24 ชม.)
   - 💊 ยาสำคัญ
   - 📅 นัดหมาย
   - 📝 หมายเหตุพิเศษ (จาก nursing_notes.handover_note)
3. **ปุ่ม "✓ รับเวร"** + ตาราง `shift_handover_acks`
4. **Audit trail record-level** — ทุก record มี `recorded_by` หรือ `created_by`
   - vital_signs, patient_excretions, patient_fluid_records, nursing_notes
   - patient_wounds, patient_appointments, medical_logs, ฯลฯ

### ❌ ยังไม่มี
1. **ปุ่ม "ส่งเวร"** — มีแค่ "รับเวร"
2. **ตาราง `shift_handover_sends`** — สำหรับ track ใครส่งเวร เมื่อไหร่
3. **Approval workflow** — พยาบาลอนุมัติส่งเวร
4. **ตาราง `shift_assignments`** — ใครดูแลคนไข้คนไหน (patient assignment)

---

## 💭 วิเคราะห์ข้อดี/ข้อเสีย ของ Flow ที่เสนอ

### ✅ ข้อดี
1. มี accountability ชัด — รู้ว่าใครรับผิดชอบในช่วงเวลาใด
2. มี checkpoint — พยาบาลอนุมัติ = double check
3. บังคับสรุปงานก่อนเลิก — พนักงานทบทวนตัวเอง
4. Audit trail ชัด — สาวกลับได้

### ⚠️ ข้อเสีย/ความเสี่ยง
1. **เพิ่มภาระงาน** — 8 พนักงาน × 2 กะ × 365 วัน = ~5,840 ครั้ง/ปีที่ต้องกดส่งเวร
2. **Shift overlap deadlock** — พนักงานเก่ายังไม่กดส่ง → พนักงานใหม่กดรับไม่ได้
3. **พยาบาลอนุมัติทันไหม?** — single point of failure
4. **ลืมกด/กลับด่วน** — ผลกระทบลูกโซ่
5. **Friction = error** — ถ้าซับซ้อนเกิน พนักงาน shortcut → กดผ่านๆ ไม่ได้ value

---

## 🎯 ปัญหา "ระบุพนักงานดูแลคนไข้ใคร"

### โจทย์
- พนักงาน 1 คนดูแล 5 คนไข้
- **สลับกันได้ในแต่ละวัน** (วันนี้ 1,2,3,4,5 / พรุ่งนี้ 1,2,3,4,6)
- ป้องกันการบันทึกผิดคน
- รักษา accountability

### Options ที่วิเคราะห์

#### Option 1: ไม่ assign เลย (ปัจจุบัน)
- ✅ ง่าย, flexible
- ❌ ไม่มี accountability ชัด
- ❌ ไม่รู้ใครพลาด

#### Option 2: Daily Assignment Sheet (Manual)
- หัวหน้ากะ assign ก่อนเริ่มกะ
- ✅ accountability สูงสุด
- ❌ ภาระหัวหน้ากะเพิ่ม
- ❌ ต้องสร้าง DB + UI ใหม่

#### Option 3: Soft Assignment + Hard Audit
- ไม่บังคับ assign แต่ track ทุก action
- ✅ มีอยู่แล้ว (recorded_by)
- ❌ ไม่รู้ว่า "ควร" มีใครบันทึก รู้แค่ "มี"

#### Option 4: Hybrid (Daily Assignment + Soft Lock) — **แนะนำ**
```
หัวหน้ากะ assign A→[1,2,3,4,5], B→[6,7,8,9,10]
  ↓
ระหว่างกะ:
  A บันทึก vital ของ #6 → ระบบเตือน "ไม่ใช่ของคุณ บันทึกแทน B?"
  → ยืนยัน → บันทึกได้ + log "A บันทึกแทน B"
  ↓
ก่อนจบกะ Dashboard:
  - A: ครบ 5 คน ✅
  - B: ขาด #8 ⚠️
```

---

## 🗄️ DB Schema ที่เสนอ (ยังไม่ทำ)

```sql
-- ตาราง assign พนักงาน-คนไข้รายกะ
CREATE TABLE shift_assignments (
  id BIGSERIAL PRIMARY KEY,
  shift_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('morning','night')),
  staff_id UUID REFERENCES staff(id),
  patient_id UUID REFERENCES patients(id),
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_date, shift, patient_id)  -- 1 คนไข้/1 ผู้ดูแล/กะ
);

-- ตาราง track การส่งเวร (ของพนักงานแต่ละคน)
CREATE TABLE shift_handover_sends (
  id BIGSERIAL PRIMARY KEY,
  shift_date DATE NOT NULL,
  shift TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_by_role TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT
);
```

---

## 🛡️ มาตรการป้องกันบันทึกผิดคน

### มีอยู่แล้ว
1. ✅ **Visual confirmation** — patient pill ในหัว modal (รูป+ชื่อ+HN+ห้อง+อายุ)
2. ✅ **Audit log** — เมนู Audit Trail

### เสนอเพิ่ม (ถ้าทำ Option 4)
3. **Smart confirmation popup** เมื่อบันทึกคนไข้นอก assignment
4. **Real-time anomaly detection** — value เปลี่ยนผิดปกติ
5. **Mandatory double confirmation** สำหรับ high-stakes (medication, vital เกินเกณฑ์)
6. **QR scan ที่เตียง** (อนาคต) — ป้องกันสแกนผิดคน

---

## 🎯 ข้อแนะนำของ Claude (ก่อนตัดสินใจ)

### ⚠️ ข้อควรระวัง
1. **อย่าทำ workflow ซับซ้อนเกินไป** — culture nursing home 30 ปี + พนักงานต่อต้านได้
2. **Friction = error** — กดเยอะ → shortcut → กดผ่าน → ไม่ได้ value
3. **Single point of failure** — พยาบาลคนเดียวอนุมัติทุกกะ = อันตราย
4. **กรณีฉุกเฉิน** — พนักงานต้องกลับด่วน → ใครรับผิดชอบ?

### 💡 คำถามที่ควรถามหน้างาน
1. "ปัจจุบันส่งเวรกันยังไง?" (กระดาษ? ปาก? Line group?)
2. "เคยมีกรณีบันทึกผิดคนไหม? บ่อยแค่ไหน?"
3. "ถ้าระบบบังคับให้กดส่งเวรก่อนเลิกงาน OK ไหม?"
4. "พยาบาลอนุมัติทันเสมอไหม?"
5. "อยากให้มี assignment ใครดูใครไหม?"
6. "ปัญหาส่งเวรที่เจอบ่อยที่สุดคืออะไร?"

### 🎯 ทางสายกลางที่เสนอ (ถ้าตัดสินใจทำ)

```
Phase 1 (ทำได้เลย, low risk):
  - เปลี่ยนชื่อเมนูเป็น "รับ-ส่งเวร" หรือ "สรุปกะ"
  - เพิ่ม shortcut button "+ เพิ่มหมายเหตุส่งเวร"
  - เพิ่ม section "พนักงานในกะนี้" แสดงใครบันทึกอะไรแล้ว
  - แสดง help text อธิบาย flow ที่หัวหน้า

Phase 2 (ถ้าหน้างานต้องการ):
  - เพิ่มปุ่ม "ส่งเวร" + ตาราง shift_handover_sends
  - ส่งเวรไม่ต้องอนุมัติ (just log) เริ่มจาก simple

Phase 3 (ถ้าหน้างานต้องการ accountability ลึก):
  - เพิ่ม patient assignment system (shift_assignments)
  - เริ่มเป็น optional ก่อน (ไม่บังคับใช้)
  - เพิ่ม approval workflow ทีหลังถ้าจำเป็น
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

## 🔖 Next Action

1. ⏳ **Kasidis ปรึกษากับทีมพยาบาลหน้างาน** — ถามคำถามที่ list ข้างบน
2. ⏳ **ตัดสินใจ Phase 1/2/3** — ทำอันไหน เริ่มเมื่อไหร่
3. ⏳ **ถ้าทำ — กลับมา session ใหม่** — Claude reference ไฟล์นี้เพื่อ continue

---

## 📎 ไฟล์ที่เกี่ยวข้องในระบบปัจจุบัน

- `js/modules/handover.js` — logic หน้าส่งเวร (~822 บรรทัด)
- `js/core/permissions.js` — RBAC
- `html/sidebar.html` line 51 — เมนู
- `html/pages.html` line 2079 — page container
- `html/modals.html` line 376-377 — textarea handover_note ใน nursing modal
- DB tables:
  - `shift_handover_acks` (มี) — รับเวร
  - `nursing_notes.handover_note` (มี) — บันทึกส่งเวรรายผู้ป่วย
  - `patient_excretions` / `patient_fluid_records` (มี) — I/O
  - `vital_signs` / `patient_wounds` / `incident_reports` / `patient_medications` / `patient_appointments` (มี)
  - `shift_assignments` (❌ ยังไม่มี — เสนอเพิ่ม)
  - `shift_handover_sends` (❌ ยังไม่มี — เสนอเพิ่ม)

---

**สำคัญ**: เอกสารนี้คือการวิเคราะห์เพื่อ "คิดต่อ" ไม่ใช่ specification สุดท้าย รอ feedback หน้างานก่อนตัดสินใจ
