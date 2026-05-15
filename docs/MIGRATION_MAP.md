# Migration Map — Navasri Webapp R3 Design System

> Reference doc for R3 design migration (R3 → R24 + R25)
> Last updated: 15 พ.ค. 2569

## Purpose

เอกสารนี้ map **legacy class/token** → **R3 canonical** ที่ใช้อยู่จริงใน codebase ปัจจุบัน เพื่อให้:
1. นักพัฒนาในอนาคตเข้าใจว่าระบบเดิมใช้อะไร, ระบบใหม่ใช้อะไร, และ map กันยังไง
2. เวลา debug หรือเขียน feature ใหม่ ใช้ R3 canonical names ได้ทันที
3. รู้ว่า legacy aliases ตัวไหนยังต้องรักษาไว้ (เพราะ HTML/JS เก่าใช้อยู่)

---

## 1. CSS Variables (Color Tokens)

### Brand Colors

| Legacy alias | R3 Canonical | Hex | ใช้ที่ไหน |
|---|---|---|---|
| `--accent` | `--brand` | `#2e6b4f` | ปุ่ม primary, link, sidebar topbar |
| `--accent-dark` | `--brand-dark` | `#1f4d38` | hover state of brand |
| `--accent-light` | `--brand-light` | `#5e9479` | (used in stat-card R10) |
| `--green` | `--success` | `#3d8862` | success states |
| `--green-light` | `--success-bg` | `#e6efe8` | success background |
| `--green-dark` | `--success-text` | `#1f4d38` | success text on bg |
| `--red` | `--danger` | `#a8554d` | error/delete buttons |
| `--red-light` | `--danger-bg` | `#f3e1dc` | danger background |
| `--red-dark` | `--danger-text` | `#6b2820` | danger text on bg |
| `--orange` | `--warning` | `#b88240` | warning states |
| `--orange-light` | `--warning-bg` | `#f5e9d4` | warning background |
| `--blue` | `--info` | `#5a7d9e` | info states |
| `--blue-light` | `--info-bg` | `#e2eaf2` | info background |

### Neutrals (Warm cream palette)

| Legacy | R3 Canonical | Hex |
|---|---|---|
| `--bg2` | `--bg` | `#faf8f3` |
| `--surface3` | `--surface-3` | `#ebe7da` |
| `--text` | `--ink` | `#1a221c` |
| `--text1` | `--ink` | `#1a221c` |
| `--text2` | `--ink-2` | `#3d4640` |
| `--text3` | `--ink-3` | `#6f7770` |
| `--text4` | `--ink-4` | `#9ca29c` |
| `--muted` | `--ink-3` | `#6f7770` |
| `--background` | `--bg` | `#faf8f3` |
| `--border-color` | `--border` | `#e5e0d1` |

### Sage Scale (50–900)

`--sage-50` → `--sage-900` ใช้สำหรับ stat-card.teal, accent gradients

### Radius / Shadow

| Legacy | R3 Canonical |
|---|---|
| `--radius` | `--r-md` (8px) |
| `--shadow` | `--shadow-sm` |

---

## 2. CSS Component Classes

### Stat Cards (8 legacy → 8 mapped to 4 + 2 semantic tones)

| Legacy class | R3 token mapping |
|---|---|
| `.stat-card.teal` | `--sage-100` bg + `--sage-800` text |
| `.stat-card.red` | `--danger-bg` + `--danger-text` |
| `.stat-card.green` | `--success-bg` + `--success-text` |
| `.stat-card.orange` | `--warning-bg` + `--warning-text` |
| `.stat-card.blue` | `--info-bg` + `--info-text` |
| `.stat-card.yellow` | `--amber-bg` + `--amber-text` (extra) |
| `.stat-card.purple` | `--purple-bg` + `--purple-text` (extra) |
| `.stat-card.powder` | `--info-bg` + `--info-text` (alias for blue) |

Defined in: `css/style.css` line ~224-280 (STAT-CARD COLOR REMAP section)

### Buttons

| R3 canonical | Variant |
|---|---|
| `.btn .btn-primary` | brand color (green) |
| `.btn .btn-secondary` | neutral surface-2 |
| `.btn .btn-ghost` | transparent + border |
| `.btn .btn-danger` | danger color |
| `.btn .btn-success` | success color |
| `.btn .btn-sm` | size modifier (small) |
| `.btn.chip-brand` | chip variant — text-only with brand color (R10+) |

### Page Header Patterns

| Pattern | Usage | Found in |
|---|---|---|
| `.page-redesign-header .section-header-row` | **canonical** (R10+) | All pages from R10-R25 |
| `.billing-page-header` | R7 specific | page-billing |
| `.patient-page-header` | R9 specific | page-patients |
| `.stock-page-header` | R8 specific | page-stock |
| `.page-header` | **legacy** (R2 era) | (deprecated — no longer used) |

### Filter Bars

| Pattern | Usage |
|---|---|
| `.page-redesign-filter-bar.filter-chip-row` | R10+ canonical |

### Modals

Single canonical pattern:
```html
<div class="modal-overlay" id="modal-xxx">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">...</div>
      <button class="modal-close" onclick="closeModal('modal-xxx')">✕</button>
    </div>
    <div class="modal-body">...</div>
    <div class="modal-footer">...</div>
  </div>
</div>
```

Mobile (`≤768px`): Auto-convert to full-screen via R3 Session D CSS (line ~3445).

### States

| Class | Purpose | Added |
|---|---|---|
| `.empty-state` | No data found | R3 |
| `.skeleton-row` | Skeleton loading | R3 |
| `.loading-state` | Async loading | R25 |
| `.error-state` | Failed fetch + retry button | R25 |

Sub-elements: `.ico`, `.h`, `.body` (consistent across all 4 states)

---

## 3. JS Module Files (current architecture)

| Module | Responsibility |
|---|---|
| `js/core/router.js` | `showPage()` — page navigation |
| `js/core/db.js` | Supabase client + db.* in-memory cache |
| `js/core/auth.js` | Login + session restore |
| `js/core/permissions.js` | `ROLE_PAGES` + `updateSidebarForRole()` |
| `js/core/bottom-tab-bar.js` | Mobile bottom navigation |
| `js/shared/ui.js` | `toast()`, `openModal()`, `closeModal()`, `customConfirm()` |
| `js/shared/utils.js` | Validators (Thai ID, phone, date order, amounts) |
| `js/modules/dashboard.js` | Dashboard widgets |
| `js/modules/clinical/clinical-profile.js` | Patient Profile + 19 tabs orchestrator |
| `js/modules/clinical/clinical-*.js` | Each tab implementation |
| `js/modules/billing/billing-*.js` | Billing module (split 6 files) |
| ... |

---

## 4. Body Class Markers (R25 addition)

For role-based CSS variants:
```css
body.role-admin { /* admin-specific */ }
body.role-nurse { /* nurse-specific */ }
body.role-caregiver { /* caregiver-specific */ }
```

Set automatically by `updateSidebarForRole()` in `js/core/permissions.js` on login.

Available roles: `admin`, `manager`, `nurse`, `caregiver`, `clerk`, `physio`, `accounting`, `viewer`, etc. (see `ROLE_PAGES` for full list)

---

## 5. Deprecated / Removed (R16-R24 cleanup)

| Removed | Replaced by |
|---|---|
| Tailwind-style colors (`#fef3c7`, `#15803d`, etc.) | R3 semantic tokens |
| Bright R2-era hex (`#e74c3c`, `#3498db`, etc.) | R3 semantic tokens |
| Duplicate CSS rules (48 selectors) | Single rule (R3 takes precedence) |
| Inline styles for utilities | `.m-0`, `.fs-13`, `.pos-rel`, etc. utility classes |
| `--orange-light`, `--red-light` (some) | Replaced with semantic `*-bg` tokens |

---

## 6. Pages Without Custom R-Design (post R25)

After R25, all 27 main pages have R3 design pattern. No more legacy holdouts.
