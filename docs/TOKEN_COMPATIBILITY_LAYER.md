# Token Compatibility Layer

> Reference doc for R3 Path B (Hybrid) — Token mapping
> Implementation: `css/style.css` line ~1-220
> Last updated: 15 พ.ค. 2569

## Purpose

Drop-in CSS variable layer ที่ map ทั้ง **new R3 tokens (sage + cream)** และ **legacy aliases** — รองรับ CSS rules 2,500+ บรรทัดของเดิมโดยไม่ต้องแก้ทันที

## Why Path B (Hybrid) instead of Pure New Tokens?

**Path A (rip & replace)**: ลบ legacy vars หมด, แก้ทุก rule ที่อ้างถึง
- ❌ ต้องแก้ CSS 2,500+ บรรทัด + HTML/JS 884+ references
- ❌ Risk สูง — refactor หลายไฟล์พร้อมกัน
- ❌ Token budget เกินงบ session เดียว

**Path B (Hybrid — chosen)**: เพิ่ม new tokens + retain legacy aliases ที่ map ไปยัง new tokens
- ✅ ไม่ต้องแก้ HTML/JS ที่ใช้ `var(--accent)`, `var(--green)`, etc.
- ✅ Reduce risk — change ใน CSS file เดียว
- ✅ Future-proof — legacy aliases สามารถลบทีหลังได้เมื่อพร้อม
- ⚠️ Trade-off: CSS file ใหญ่ขึ้น ~200 บรรทัด (acceptable)

## Structure

### Layer 1: New R3 Canonical Tokens (`:root`)

```css
:root {
  /* Brand (sage green) */
  --brand:       #2e6b4f;
  --brand-dark:  #1f4d38;
  --brand-light: #5e9479;

  /* Sage scale */
  --sage-50:  #f4f8f5;
  --sage-100: #e8f2ec;
  ...
  --sage-900: #0a201a;

  /* Warm neutrals */
  --bg:            #faf8f3;
  --surface:       #ffffff;
  --surface-2:     #f4f1ea;
  --surface-3:     #ebe7da;
  --border:        #e5e0d1;
  --border-strong: #d2cab5;
  --divider:       #ede9dc;

  /* Ink (text colors) */
  --ink:        #1a221c;
  --ink-2:      #3d4640;
  --ink-3:      #6f7770;
  --ink-4:      #9ca29c;
  --ink-on-brand: #e8f2ec;

  /* Semantic — 4 muted earthy tones */
  --success:      #3d8862;
  --success-bg:   #e6efe8;
  --success-text: #1f4d38;
  --warning:      #b88240;
  --warning-bg:   #f5e9d4;
  --warning-text: #6e4715;
  --danger:       #a8554d;
  --danger-bg:    #f3e1dc;
  --danger-text:  #6b2820;
  --info:         #5a7d9e;
  --info-bg:      #e2eaf2;
  --info-text:    #2a3f57;

  /* Extra tones for stat-card variety */
  --purple:      #7c6da4;
  --purple-bg:   #e9e4f0;
  --purple-text: #3e3360;
  --amber:       #c89e3a;
  --amber-bg:    #f5e9c4;
  --amber-text:  #6b4d10;

  /* Radius */
  --r-xs: 4px;  --r-sm: 6px;  --r-md: 8px;
  --r-lg: 12px; --r-xl: 16px; --r-pill: 999px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.10);

  /* Typography */
  --font: 'IBM Plex Sans Thai', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', monospace;
}
```

### Layer 2: Legacy Aliases (also in `:root`)

Map legacy var names → new R3 tokens:

```css
:root {
  /* Legacy → R3 */
  --accent:        var(--brand);
  --accent-dark:   var(--brand-dark);
  --accent-light:  var(--brand-light);

  --green:         var(--success);
  --green-light:   var(--success-bg);
  --green-dark:    var(--success-text);

  --red:           var(--danger);
  --red-light:     var(--danger-bg);
  --red-dark:      var(--danger-text);

  --orange:        var(--warning);
  --orange-light:  var(--warning-bg);

  --blue:          var(--info);
  --blue-light:    var(--info-bg);

  --text:          var(--ink);
  --text1:         var(--ink);
  --text2:         var(--ink-2);
  --text3:         var(--ink-3);
  --text4:         var(--ink-4);
  --muted:         var(--ink-3);

  --bg2:           var(--bg);
  --background:    var(--bg);
  --surface3:      var(--surface-3);
  --border-color:  var(--border);
  --radius:        var(--r-md);
  --shadow:        var(--shadow-sm);
  --primary:       var(--brand);
}
```

### Layer 3: Stat Card Color Remap

See `STAT_CARD_MAPPING.md` for details on 8-variant remap to 6 semantic tones.

## Important Rules

### ✅ DO

- Use **R3 canonical names** in new code (`var(--brand)`, `var(--success)`, `var(--ink)`)
- Use **legacy aliases** in old code where appropriate (it works because they map to R3)
- Add new tokens to `:root` block (alphabetize-ish within section)

### ❌ DON'T

- Don't hardcode hex values in CSS rules — use tokens
- Don't redefine R3 canonical tokens (will break entire app)
- Don't add new legacy aliases — use R3 canonical for new code

## R3 Design Intent

Tones are **muted earthy** (sage, cream, terracotta), not bright (saturated red/blue/green). This is intentional:
- Targets nursing home users (50+ age group) — soft palette reduces eye strain
- Professional medical context — bright colors feel toy-like
- Print-friendly — earthy tones reproduce well on receipts/forms

If you see hex colors like `#e74c3c`, `#3498db`, `#27ae60` (bright R2-era), they are R2 holdovers and have all been replaced (R21-R24). Do not add them back.

## Migration Notes (R3 → R24)

- **R3**: Original token compat layer (May 14, 2026)
- **R21**: Replaced 230 non-R3 colors in JS/HTML → R3 tokens
- **R22**: Replaced 27 hex literals in style.css → R3 tokens
- **R23**: Mopped up 90 more hex (Tailwind-style + R2 era)
- **R24**: Deep cleanup — 216 more occurrences across 26 files
- **Total cleanup**: 583+ non-R3 colors eliminated

## How to Remove Legacy Aliases (Future)

When ready to fully migrate off legacy:

1. Use search tool (e.g. ripgrep) to find all references to a legacy var:
   ```bash
   rg 'var\(--accent\)' --type css --type html --type js
   ```
2. Replace with R3 canonical (`--brand`)
3. Once all references gone, remove the alias from `:root`
4. Repeat for next legacy var

Estimated effort: ~500-700 references across codebase. Recommend batching by alias.

## Related Docs

- `MIGRATION_MAP.md` — full class/token mapping
- `STAT_CARD_MAPPING.md` — 8 → 6 stat card variant mapping
- `MOBILE_MODAL_CSS.md` — Session D mobile modal CSS
- `PRINT_MODE.md` — print color treatment
