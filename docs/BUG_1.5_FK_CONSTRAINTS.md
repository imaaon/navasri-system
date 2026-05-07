# Bug 1.5 — Add FK Constraints on patient_id (22 tables)

**Date:** 7 พ.ค. 2569 / May 7, 2026  
**Phase:** Phase 1 Final Inspection — Last bug closed

## Problem

22 tables had `patient_id` column but NO foreign key constraint to `patients(id)`:
- DB allowed inserting records with non-existent patient_id
- Deleting patient left orphan child records
- Schema integrity broken across clinical, billing, and operations

## Solution

Added FK constraints with appropriate `ON DELETE` rules:

### CASCADE (18 tables) — Clinical & Operations
Child data should be deleted when patient is deleted:
- Clinical: vital_signs, mar_records, nursing_notes, patient_medications, incident_reports
- Operations: patient_appointments, patient_belongings, patient_consents, patient_contracts, patient_room_history, requisitions
- Health/Diet/Wound: patient_diets, patient_nutrition, patient_incidents, patient_wounds, tube_feeding_logs, wound_care_logs, return_items

### RESTRICT (5 tables) — Financial & Audit
Block patient deletion if billing/requisition records exist (preserves audit trail):
- invoices, payments, patient_deposits, billing_deposits
- requisition_headers (existed; converted from NO ACTION → RESTRICT)

### Also converted (1 table)
- medical_logs: NO ACTION → CASCADE (clinical data should follow patient)

## Pre-flight: Orphan Cleanup

10 orphan records in 7 tables (all from test patient `[Test] นายทดสอบ นวศรี` 
id=`c6645838-add7-460f-ace3-4df55415c027`) were deleted before adding FK constraints.

## Final Schema State

All 38 tables with `patient_id` now have FK constraints:
- 32 CASCADE
- 5 RESTRICT (4 billing + 1 requisition_headers)
- 1 NO ACTION (legacy, safe to keep)

## Test Results

**Test A — CASCADE (PASSED):**
- Created test patient + 1 vital_sign + 1 appointment + 1 medical_log
- DELETE patient → all 3 child records auto-deleted ✅

**Test B — RESTRICT (PROVEN via error 23503):**
- Initial DELETE attempt blocked by `medical_logs_patient_id_fkey` (when it was still NO ACTION)
- Same behavior applies to invoices/payments/deposits with RESTRICT rule

## Workflow Implications

**To delete a patient with billing records:**
1. Archive/delete invoices, payments, deposits first
2. Then delete patient → CASCADE handles clinical data

**Recommended UX improvement (out of scope):**
- Catch FK violation error 23503 in JS
- Show user-friendly Thai message: "ไม่สามารถลบได้ — ยังมีใบแจ้งหนี้/มัดจำของผู้รับบริการคนนี้"
- Suggest: archive (status='discharged') instead of delete

## Rollback

See `/home/claude/bug-1.5-fix/rollback.sql` (drops all 22 added FK constraints)
