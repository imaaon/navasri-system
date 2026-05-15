# Print Mode Strategy

> Reference doc for R3 print color treatment
> Implementation: `css/style.css` line ~312 (token override), ~806 (component), ~3506 (sidebar/topbar hiding)
> Last updated: 15 พ.ค. 2569

## Purpose

Print mode is **required** for nursing home operations:
- Invoices, receipts, tax invoices, contracts
- Requisition forms (paper trail required by Thai healthcare regulations)
- Health reports for patients/family/hospitals
- Maintenance/repair logs

Browser print must produce **clean, ink-efficient, professional** documents.

## Strategy: Three-layer Print Override

### Layer 1: Token override (line ~312)

Override R3 design tokens to neutral when printing:

```css
@media print {
  :root {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-2: #ffffff;
    --border: #cccccc;
    --ink: #000000;
    --ink-2: #222222;
    --ink-3: #444444;
  }
  /* Force key components to flat white-black */
  .stat-card,
  .card,
  .modal {
    background: #ffffff !important;
    color: #000000 !important;
    box-shadow: none !important;
    border: 1px solid #cccccc !important;
  }
}
```

**Why?** R3 earthy tones (sage cream, terracotta) waste color ink and don't reproduce well on cheap office printers. Black-on-white is universally readable.

### Layer 2: Component-specific overrides (line ~806)

For specialized print contexts:

```css
@media print {
  .no-print { display: none !important; }
}
.rq-print {  /* Requisition form print styling */
  ...
}
.rq-print-header {  /* Form header on printed page */
  ...
}
```

`.no-print` class is sprinkled on toolbars, action buttons, filter bars — anything user-interactive that has no value on paper.

### Layer 3: Hide app chrome (line ~3506)

```css
@media print {
  .sidebar, .topbar, .bottom-tab-bar, #notif-bell-wrap {
    display: none !important;
  }
  .main {
    margin-left: 0 !important;
  }
}
```

Hides app navigation. Document content fills the page.

## Print-Specific Components

### `.rq-print` (Requisition form)

Custom print template for requisition forms. Renders A4-friendly layout with:
- Logo + clinic info (top-right)
- Requisition number + date (top-left)
- Item table with quantities, units, prices
- Signature blocks (approver + receiver)
- Page break protection (avoids cutting through table rows)

### `.billing-print-*` (Invoices, Receipts, Tax Invoices, Quotations)

Implemented in `js/modules/billing/billing-print.js`. Generates separate print template with:
- Doc type label (color-coded — uses literal hex, see below)
- Customer info block
- Line items table
- Total + amount in words (Thai)
- Two signature blocks
- "ต้นฉบับ / สำเนา" (original / copy) markers

### Hardcoded Hex in `billing-print.js`

The print module **intentionally keeps hardcoded hex colors** for doc type accents:
- invoice: `#2d4a38` (deep green)
- receipt: `#1a5276` (deep blue)
- quotation: `#b94000` (terracotta)
- tax_invoice: `#6c3483` (purple)

**Why exception?** Print generation in this module uses `window.open()` with isolated HTML — CSS variables from main page don't carry over. Using literal hex is the pragmatic choice.

This is **the only file** allowed to use bright/saturated hex literals in the entire codebase. Documented in R24 audit (`docs/R24_AUDIT_REPORTS.md`).

## How to Make a New Page Print-friendly

1. Add `.no-print` to all toolbars, buttons, filters
   ```html
   <div class="page-redesign-header section-header-row no-print">...</div>
   ```

2. If page has print-specific layout, create a custom CSS class:
   ```css
   .my-page-print { /* print-only styling */ }
   ```

3. Wrap content user wants on paper:
   ```html
   <div class="my-page-print">
     <!-- printable content -->
   </div>
   ```

4. Test using browser print preview (Cmd/Ctrl + P)
5. Test on actual printer if possible (color reproduction varies)

## Page Break Strategy

Avoid mid-row table breaks:

```css
@media print {
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }  /* repeat header on each page */
  tfoot { display: table-footer-group; }
}
```

For section breaks:

```css
.page-break-before { page-break-before: always; }
.page-break-after { page-break-after: always; }
```

## Browser Compatibility

- ✅ Chrome/Edge: full support
- ✅ Firefox: full support
- ⚠️ Safari: `page-break-*` works but quirky on table rows
- ⚠️ Safari mobile: print preview limited — recommend desktop for print testing
- ❌ Older IE: not supported (not a target)

## Testing Checklist

When adding new printable content:
- [ ] All interactive elements have `.no-print`
- [ ] Tokens override to B&W in print preview
- [ ] No page-break mid-row in tables
- [ ] Background colors removed (saves ink)
- [ ] Logo + clinic info present
- [ ] Date/timestamp present
- [ ] Signature block (if business document)
- [ ] Test on Chrome + Safari (different print engines)
- [ ] Test paper size A4 (default for Thailand)

## Anti-patterns

❌ Forgetting `.no-print` on action buttons → printer wastes ink on UI chrome
❌ Using `display: none` instead of `.no-print` → loses semantic intent
❌ Hardcoding colors in print template → ink waste + bad reproduction
❌ Long forms with no `page-break-inside: avoid` on critical sections → split rows look broken
