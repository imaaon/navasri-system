# Mobile Modal CSS Strategy

> Reference doc for R3 Session D — Mobile Modal Full-screen Pattern
> Implementation: `css/style.css` line ~3445-3615
> Last updated: 15 พ.ค. 2569

## Problem

Desktop modal pattern (centered popup with backdrop) doesn't work well on mobile:
- Small modal in middle of screen feels cramped
- Touch targets too small
- Keyboard pushes content awkwardly
- Backdrop blur eats GPU/battery on older devices

## Solution

**CSS-only conversion to full-screen pattern on mobile (≤768px)** — no HTML/JS changes needed.

### Strategy

1. **Append at end of style.css** — wins CSS specificity battle without `!important` spam
2. **Use `@media (max-width: 768px)`** — single breakpoint, matches Bootstrap/Tailwind convention
3. **Use `z-index: 300` for modal** > `200` (bottom-tab-bar) > `100` (sidebar)
4. **Respect iOS safe area** — use `env(safe-area-inset-*)`
5. **Preserve small/confirm modals** — opt-in via `data-modal-size="small"` attribute

## Implementation Details

### Overlay (full screen)

```css
@media (max-width: 768px) {
  .modal-overlay.open {
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
    backdrop-filter: none;      /* save GPU on mobile */
    background: var(--bg);       /* solid bg, not translucent */
  }
}
```

### Modal box (full viewport)

```css
.modal-overlay.open .modal,
.modal-overlay.open .modal-box {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  border-radius: 0;
  display: flex;
  flex-direction: column;
}
```

### Header (sticky top)

Modal header becomes sticky so user can always tap close button:

```css
.modal-overlay.open .modal-header {
  position: sticky;
  top: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--divider);
  z-index: 10;
  padding-top: max(16px, env(safe-area-inset-top));  /* iOS notch */
}
```

### Body (scrollable)

```css
.modal-overlay.open .modal-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;  /* iOS momentum scroll */
  padding-bottom: 100px;  /* room for footer */
}
```

### Footer (sticky bottom)

Action buttons always reachable:

```css
.modal-overlay.open .modal-footer {
  position: sticky;
  bottom: 0;
  background: var(--surface);
  border-top: 1px solid var(--divider);
  padding: 12px 16px max(12px, env(safe-area-inset-bottom));
}
```

### Touch Targets

All buttons inside modal get min-height 44px on mobile (Apple HIG):

```css
.modal-overlay.open .btn {
  min-height: 44px;
  padding: 10px 16px;
  font-size: 14px;
}
```

## Opt-out: Small Modals

For confirm/alert dialogs that should stay small:

```html
<div class="modal-overlay" id="modal-confirm-delete" data-modal-size="small">
  <div class="modal">...</div>
</div>
```

CSS override:

```css
.modal-overlay[data-modal-size="small"].open {
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 30, 15, 0.42);  /* restore backdrop */
}

.modal-overlay[data-modal-size="small"].open .modal {
  width: auto !important;
  max-width: 400px !important;
  height: auto !important;
  max-height: 80vh !important;
  border-radius: var(--r-xl);
}
```

## Compatibility

- ✅ iOS Safari 14+
- ✅ Chrome Android 90+
- ✅ Desktop Chrome/Edge/Firefox (unaffected — uses original centered pattern)
- ⚠️ iOS 13 and below — `env(safe-area-inset-*)` works but with quirks; tested OK
- ⚠️ Older Android (<8) — `position: sticky` on `.modal-header` may have issues; acceptable trade-off

## Known Issues / Workarounds

### 1. iOS keyboard pushes modal up

iOS auto-pushes when input focused. Solution: ensure body has `padding-bottom: 100px` so input is always visible.

### 2. Modal stacking (z-index)

Patient Contracts modal (`#modal-patient-contracts`) uses `z-index: 190` (below standard 200) — intentional, so it stays *behind* other modals if both are open.

### 3. `body.modal-open` scroll lock

Not currently implemented. Body remains scrollable behind modal on mobile. Acceptable because modal is full-screen anyway.

## Testing Checklist

When adding new modals, verify on real mobile:
- [ ] Modal opens full-screen on mobile, centered on desktop
- [ ] Header sticky at top, close button always tappable
- [ ] Body scrolls smoothly (no momentum loss)
- [ ] Footer sticky at bottom, action buttons within thumb reach
- [ ] Touch targets ≥44px
- [ ] iOS notch and home indicator respected (safe-area-inset)
- [ ] Keyboard doesn't hide submit button
- [ ] Can swipe-up from bottom edge without closing modal accidentally
