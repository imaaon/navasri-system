-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Handover Redesign — Phase 2
-- Date: 20 พฤษภาคม 2569 (2026)
-- Apply: Manual via Supabase Studio SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS DOES:
--   1. เพิ่ม column "received_*" ใน patient_shift_summaries (3 columns)
--   2. เพิ่ม column "was_reopened" boolean flag
--   3. สร้างตารางใหม่ patient_shift_summary_edits สำหรับ edit history
--   4. (TWO-STEP DROP) rename shift_handover_acks → _legacy_shift_handover_acks
--      (ยังไม่ลบจริง — รอ 30 วันค่อย DROP)
--
-- SAFETY:
--   - ทุก column ใหม่เป็น NULLABLE → ไม่กระทบ row เดิม
--   - ไม่มี DROP TABLE จริง (Two-step strategy)
--   - Rollback ทั้งหมดอยู่ท้ายไฟล์ (commented out)
--
-- BEFORE APPLY:
--   ✅ Backup ผ่าน Edge Function daily_full_backup
--   ✅ ทดสอบใน dev environment ก่อน
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: เพิ่ม columns สำหรับ "รับเวร" และ "edit history flag"
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE patient_shift_summaries
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by TEXT,
  ADD COLUMN IF NOT EXISTS received_by_role TEXT,
  ADD COLUMN IF NOT EXISTS was_reopened BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN patient_shift_summaries.received_at IS '[Phase 2] เวลาที่กะถัดมารับเวรนี้';
COMMENT ON COLUMN patient_shift_summaries.received_by IS '[Phase 2] ชื่อ user ที่กดรับเวร (caregiver กะถัดมา)';
COMMENT ON COLUMN patient_shift_summaries.received_by_role IS '[Phase 2] role ของผู้รับเวร';
COMMENT ON COLUMN patient_shift_summaries.was_reopened IS '[Phase 2] flag — เคยถูก reopen ไหม (เพื่อ trigger edit history)';


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: สร้างตาราง edit history
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_shift_summary_edits (
  id BIGSERIAL PRIMARY KEY,
  summary_id BIGINT NOT NULL REFERENCES patient_shift_summaries(id) ON DELETE CASCADE,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_by TEXT NOT NULL,
  edited_by_role TEXT,
  old_text TEXT,
  new_text TEXT NOT NULL,
  edit_context TEXT  -- 'after_reopen' | 'close_after_reopen' | 'admin_override'
);

CREATE INDEX IF NOT EXISTS idx_pss_edits_summary
  ON patient_shift_summary_edits(summary_id);

CREATE INDEX IF NOT EXISTS idx_pss_edits_edited_at
  ON patient_shift_summary_edits(edited_at DESC);

COMMENT ON TABLE patient_shift_summary_edits IS '[Phase 2] Edit history สำหรับ patient_shift_summaries — log เฉพาะการแก้หลังเวรถูก reopen';


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: RLS Policies สำหรับตารางใหม่
-- (เหมือนกับ patient_shift_summaries เดิม)
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE patient_shift_summary_edits ENABLE ROW LEVEL SECURITY;

-- อ่านได้: ทุก role ที่เห็น summary ได้ก็เห็น edit history ได้
CREATE POLICY "Allow read for authenticated"
  ON patient_shift_summary_edits
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: ทุก authenticated user (logic guard อยู่ frontend)
CREATE POLICY "Allow insert for authenticated"
  ON patient_shift_summary_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE/DELETE: ไม่อนุญาต — edit history ห้ามแก้ย้อนหลัง
-- (ไม่สร้าง policy = deny by default)


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4: TWO-STEP DROP — rename shift_handover_acks
-- (ยังไม่ DROP จริง — เก็บไว้ 30 วัน ค่อยลบใน migration ถัดไป)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'shift_handover_acks') THEN
    ALTER TABLE shift_handover_acks RENAME TO _legacy_shift_handover_acks;
    RAISE NOTICE 'Renamed shift_handover_acks → _legacy_shift_handover_acks';
  ELSE
    RAISE NOTICE 'shift_handover_acks not found, skipping rename';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (uncomment ถ้าต้องการย้อนกลับ)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- -- 1. ลบ edit history table
-- DROP TABLE IF EXISTS patient_shift_summary_edits;
--
-- -- 2. ลบ columns ที่เพิ่ม
-- ALTER TABLE patient_shift_summaries
--   DROP COLUMN IF EXISTS received_at,
--   DROP COLUMN IF EXISTS received_by,
--   DROP COLUMN IF EXISTS received_by_role,
--   DROP COLUMN IF EXISTS was_reopened;
--
-- -- 3. คืนชื่อ shift_handover_acks
-- ALTER TABLE _legacy_shift_handover_acks RENAME TO shift_handover_acks;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY (รันหลัง apply เพื่อเช็ค)
-- ═══════════════════════════════════════════════════════════════════════════

-- เช็ค columns ใหม่
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'patient_shift_summaries'
--   AND column_name IN ('received_at', 'received_by', 'received_by_role', 'was_reopened')
-- ORDER BY ordinal_position;

-- เช็คตารางใหม่
-- SELECT * FROM patient_shift_summary_edits LIMIT 1;

-- เช็คว่า shift_handover_acks เปลี่ยนชื่อแล้ว
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE '%shift_handover_acks%';
