-- Recovery script for Phase 3 Step 3 Sub-step B
-- ใช้เพื่อสร้าง views คืน ถ้าจำเป็นต้อง rollback
-- Generated: 2026-05-08

CREATE OR REPLACE VIEW public.v_physio_monthly AS
 SELECT date_trunc('month'::text, ps.session_date::timestamp with time zone)::date AS month,
    p.id AS patient_id,
    p.name AS patient_name,
    count(ps.id) AS session_count,
    sum(ps.duration_minutes) AS total_minutes,
    sum(ps.amount) AS total_fee
   FROM physio_sessions ps
     JOIN patients p ON p.id = ps.patient_id
  GROUP BY (date_trunc('month'::text, ps.session_date::timestamp with time zone)), p.id, p.name;

CREATE OR REPLACE VIEW public.v_requisitions AS
 SELECT rh.id AS header_id,
    rh.ref_no,
    rh.date,
    rh.patient_id,
    rh.patient_name,
    rh.staff_id,
    rh.staff_name,
    rh.note,
    rh.status AS header_status,
    rh.approved_by,
    rh.approved_at,
    rh.rejected_by,
    rh.reject_reason,
    rh.created_by,
    rh.created_at,
    rl.id AS line_id,
    rl.item_id,
    rl.item_name,
    rl.qty_requested,
    rl.qty_approved,
    rl.unit,
    rl.status AS line_status
   FROM requisition_headers rh
     LEFT JOIN requisition_lines rl ON rl.header_id = rh.id;
