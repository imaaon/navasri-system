# Phase 2 — Progress & Plan

**Started:** 16 พ.ค. 2569
**Anchor:** `v-pre-phase2` (HEAD before phase 2)
**Current HEAD:** `d83ac0d` (after #6 Recent/Pinned)

---

## ✅ COMPLETED

### #6 Recent / Pinned (tag `v-phase2-recent-pinned`)

**Files changed:**
- `js/modules/recent-pinned.js` (new, 230 lines)
- `html/sidebar.html` (+8 lines for widget)
- `css/style.css` (+95 lines tokens)
- `js/modules/clinical/clinical-profile.js` (+3 lines hook)
- `index.html` (script tag + bump 3 versions)
- `sw.js` (cache v4 → v5)

**DB:**
- Table `user_pins` created with RLS (own pins only via `auth.uid()`)

**Behavior:**
- Recent (auto): localStorage, 5 latest, device-specific
- Pinned (manual): Supabase, per-user via RLS
- Widget renders in sidebar before "หลัก" section

**UAT checklist:**
- [ ] Login → sidebar shows "⭐ ผู้พัก" section
- [ ] Open patient profile → patient appears in "🕐 ดูล่าสุด"
- [ ] (Future) Pin button on profile → patient moves to "📍 ปักหมุด"
- [ ] Switch user → only see own pins
- [ ] localStorage cleared → recent gone but pinned remains

---

## 🔄 PENDING (4 features)

### #5 Global Search (Cmd+K / Mobile icon)

**Effort:** 1-1.5 ชม.

**Architecture:**
```javascript
// js/modules/global-search.js
- Index: db.patients + db.staff + db.items + db.invoices + db.requisitionHeaders + menu items
- Trigger: Cmd+K (desktop) / 🔍 icon on topbar (mobile)
- UI: modal-overlay#modal-global-search
- Results grouped by category
- Arrow keys + Enter navigation
```

**Files to touch:**
- New: `js/modules/global-search.js`
- `html/modals.html` (+30 lines for search modal)
- `index.html` (+ topbar 🔍 button + script tag + bump)
- `css/style.css` (search styles)

**Risk:** LOW — read-only, no DB writes

---

### #1 Quick Action FAB (Mobile only)

**Effort:** 1-2 ชม.

**Architecture:**
```javascript
// Append to features.js or new fab.js
- #fab-main button (fixed, mobile only via media query)
- 5 shortcuts → patient picker (reuse #5 search) → open modal
- Shortcuts:
  - vital → _openVitalModal(null, patId, patId)
  - I/O → _openExcretionModal(null, patId, today)
  - MAR → openModal('modal-mar-entry') + set hidden patId  
  - incident → openModal('modal-incident') + set patient
  - nursing → openModal('modal-add-nursing') + set #nursing-pat-id
```

**Files to touch:**
- New: `js/modules/fab.js`
- `index.html` (HTML at end of body + script + media query)
- `css/style.css` (FAB position + animation)

**Risk:** MEDIUM — calls existing modal functions; needs patient picker UX

**Depends on:** #5 Search (for picker)

---

### #7 Patient Summary PDF

**Effort:** 2-3 ชม.

**Architecture:**
```javascript
// Append to clinical-profile.js or new patient-pdf.js
async function exportPatientSummaryPDF(patId) {
  const html = buildPatientSummaryHTML(patId);  // A4 1 page
  await _exportDocPDF(html, `summary-${patId}`);  // existing function!
}
```

**Reuse:** `_exportDocPDF()` from `billing-print.js` (jsPDF + html2canvas)

**Files to touch:**
- New function in `clinical-profile.js` (or new file)
- Button "🖨 พิมพ์สรุป" on patient profile header
- Mobile bottom sheet for share options

**Risk:** LOW — uses proven pattern

---

### #4 Shift Handover (Big!)

**Effort:** 1-1.5 วัน

**Architecture:**
- New page `#page-handover`
- Query aggregator from 5 tables:
  - `incident_reports` (severity, time range)
  - `vital_signs` (out-of-range)
  - `mar_records` (missed/pending)
  - `patient_appointments` (next shift)
  - `nursing_notes` (handover_note)
- "✓ รับเวร" → localStorage `navasri_handover_ack_{date}_{shift}` for now (no new table)

**Files to touch:**
- New: `js/modules/handover.js`
- `html/pages.html` (+ page-handover section, large)
- `html/sidebar.html` (+ nav-item)
- `index.html` (script tag)
- `css/style.css` (handover styles)

**Risk:** HIGH — biggest scope, touches many query patterns

---

## 🚫 SKIPPED

- **#3 LINE Alerts** — user decision (workflow doesn't match)
- **#2 Barcode Scan** — user decision (skip for now, may add later)

---

## 🛠 Next Session Plan

1. Resume at `v-phase2-recent-pinned`
2. Implement in order: **#5 Search → #1 FAB → #7 PDF → #4 Handover**
3. Each feature gets its own tag (`v-phase2-search`, `v-phase2-fab`, etc.)
4. After all 4: final tag `v-phase2-complete` + CHANGELOG update

---

## 🔄 Rollback

If anything goes wrong:
```bash
git reset --hard v-pre-phase2  # all of phase 2
git reset --hard v-phase2-recent-pinned  # keep #6 only
```

Supabase rollback:
```sql
DROP TABLE public.user_pins CASCADE;
```
