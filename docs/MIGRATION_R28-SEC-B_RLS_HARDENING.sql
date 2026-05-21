-- ─────────────────────────────────────────────────────────────────
-- R28-SEC-B · Tighten RLS Policy on patient_shift_summary_edits
-- Applied: 21 พ.ค. 2569
-- Author: Kasidis (อ้น) + Claude
-- ─────────────────────────────────────────────────────────────────
--
-- [Context]
-- Supabase Security Advisor flagged warning:
--   "RLS Policy Always True" on public.patient_shift_summary_edits
--   policy "Allow insert for authenticated" with WITH CHECK (true)
--   → effectively bypasses row-level security for authenticated role
--
-- [Before]
--   CREATE POLICY "Allow insert for authenticated"
--     ON public.patient_shift_summary_edits
--     FOR INSERT TO authenticated
--     WITH CHECK (true);  -- ใครก็ตามที่ login → INSERT ได้
--
-- [After]
--   CREATE POLICY "Allow insert for clinical roles"
--     ON public.patient_shift_summary_edits
--     FOR INSERT TO authenticated
--     WITH CHECK (has_role(ARRAY['admin','manager','nurse','caregiver','officer']));
--   -- เฉพาะ role ที่ใช้งาน clinical เท่านั้น (warehouse ถูก block)
--
-- [Roles ทั้งหมดในระบบ]
--   admin, caregiver, manager, nurse, officer, warehouse
--
-- [Roles ที่ allowed INSERT]
--   admin, caregiver, manager, nurse, officer (5/6 roles)
--
-- [Roles ที่ blocked]
--   warehouse (เกี่ยวกับคลังของเท่านั้น ไม่เกี่ยวกับ clinical)
--
-- [Tested]
--   1. admin INSERT → ✅ pass (id=1 returned, then deleted)
--   2. Supabase advisor → warning หายจาก 21 → 20 warnings
--
-- [Risk] Low
--   - Table มี 0 records ตอน apply → ไม่กระทบ existing data
--   - has_role() function ใช้อยู่แล้วในระบบ (SECURITY DEFINER + JWT check)
--   - Rollback ง่าย: DROP + recreate WITH CHECK (true)
--
-- [Rollback Procedure]
--   DROP POLICY "Allow insert for clinical roles" ON public.patient_shift_summary_edits;
--   CREATE POLICY "Allow insert for authenticated"
--     ON public.patient_shift_summary_edits
--     FOR INSERT TO authenticated
--     WITH CHECK (true);
-- ─────────────────────────────────────────────────────────────────

-- 1. ลบ policy เก่า
DROP POLICY IF EXISTS "Allow insert for authenticated"
  ON public.patient_shift_summary_edits;

-- 2. สร้าง policy ใหม่ที่ check role
CREATE POLICY "Allow insert for clinical roles"
  ON public.patient_shift_summary_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(ARRAY['admin', 'manager', 'nurse', 'caregiver', 'officer'])
  );

-- 3. Comment เพื่ออธิบายเหตุผล
COMMENT ON POLICY "Allow insert for clinical roles"
  ON public.patient_shift_summary_edits IS
  'R28-SEC: Restrict INSERT to clinical roles (admin/manager/nurse/caregiver/officer). Warehouse role excluded.';
