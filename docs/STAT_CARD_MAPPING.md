# Stat Card Color Mapping (8 → 6 semantic tones)

> Reference doc for R3 stat card design
> Implementation: `css/style.css` line ~224-280
> Last updated: 15 พ.ค. 2569

## Problem (จากเดิม)

Webapp เก่าใช้ stat card 8 สีที่ hardcoded ใน HTML — ไม่ใช้ design tokens, ไม่มี semantic meaning:
- teal, red, green, orange, yellow, blue, purple, powder

ปัญหา:
- ใช้สีตามรสนิยมโดยไม่มีความหมาย
- 8 สีเยอะเกินไป — ไม่จำเป็นและรกตา
- เปลี่ยน theme ทั้งระบบยาก (ต้องค้นทุก stat-card class)

## Solution (R3)

**ยังคงใช้ class เดิมใน HTML** (ไม่ต้องแก้ HTML 28+ pages)
**แต่ remap CSS ให้ใช้ R3 semantic tokens** — 6 tones ที่มี meaning ชัด

### Mapping Table

| Legacy class | R3 token (bg) | R3 token (text) | Semantic meaning |
|---|---|---|---|
| `.stat-card.teal` | `var(--sage-100)` `#e8f2ec` | `var(--sage-800)` `#14352a` | **Default / neutral count** (active patients, total items) |
| `.stat-card.red` | `var(--danger-bg)` `#f3e1dc` | `var(--danger-text)` `#6b2820` | **Critical / urgent** (overdue, errors, expired) |
| `.stat-card.green` | `var(--success-bg)` `#e6efe8` | `var(--success-text)` `#1f4d38` | **Success / paid / OK** |
| `.stat-card.orange` | `var(--warning-bg)` `#f5e9d4` | `var(--warning-text)` `#6e4715` | **Warning / pending / attention** |
| `.stat-card.yellow` | `var(--amber-bg)` `#f5e9c4` | `var(--amber-text)` `#6b4d10` | **Notice / informational warning** |
| `.stat-card.blue` | `var(--info-bg)` `#e2eaf2` | `var(--info-text)` `#2a3f57` | **Info / appointments / scheduled** |
| `.stat-card.purple` | `var(--purple-bg)` `#e9e4f0` | `var(--purple-text)` `#3e3360` | **Special / accent** (rare use) |
| `.stat-card.powder` | `var(--info-bg)` (alias) | `var(--info-text)` (alias) | Same as blue |

### Visual Properties (uniform)

ทุก stat-card variant มีโครงสร้างเหมือนกัน:
```css
.stat-card {
  border-radius: var(--r-lg);  /* 12px */
  padding: 18px 16px;
  position: relative;
  overflow: hidden;
  border: none;
  box-shadow: none;            /* R3: flat, not elevated */
}
```

**Note (Design intent):** `box-shadow: none` is intentional. The colored background IS the visual distinguisher. Adding shadow would muddy the soft earthy palette.

Sub-elements use the variant color via inheritance:
```css
.stat-card.{variant} .stat-label,
.stat-card.{variant} .stat-sub,
.stat-card.{variant} .stat-value,
.stat-card.{variant} .stat-icon { color: var(--{variant}-text); }
```

## Usage Examples

### Dashboard
- "ผู้รับบริการ" (active count) → `.stat-card.teal`
- "ครบกำหนดเก็บเงิน" (overdue invoices) → `.stat-card.red`
- "ชำระแล้ว" (paid invoices) → `.stat-card.green`
- "นัดหมายวันนี้" → `.stat-card.blue`

### Billing
- "ใบแจ้งหนี้ค้าง" → `.stat-card.orange`
- "ใบเสร็จออกแล้ว" → `.stat-card.green`

### Stock
- "ใกล้หมดอายุ" → `.stat-card.orange`
- "หมดสต๊อก" → `.stat-card.red`
- "รายการทั้งหมด" → `.stat-card.teal`

## How to Add a New Stat Card

```html
<div class="stat-card teal">
  <div class="stat-label">ผู้รับบริการที่พักอยู่</div>
  <div class="stat-value">42</div>
  <div class="stat-sub">เพิ่มขึ้น 3 จากเดือนที่แล้ว</div>
  <div class="stat-icon">👥</div>
</div>
```

เลือก variant ตาม semantic meaning (ใช้ตาราง mapping ข้างบน)

## How to Add a New Color Tone

ถ้าต้องการเพิ่ม tone ใหม่ (เช่น `.stat-card.cyan`):

1. เพิ่ม CSS variables ใน `:root`:
   ```css
   --cyan: #4d8a8c;
   --cyan-bg: #d6e6e7;
   --cyan-text: #1f3d3f;
   ```
2. เพิ่ม rule:
   ```css
   .stat-card.cyan { background: var(--cyan-bg); }
   .stat-card.cyan .stat-label,
   .stat-card.cyan .stat-sub,
   .stat-card.cyan .stat-value,
   .stat-card.cyan .stat-icon { color: var(--cyan-text); }
   ```
3. Update this doc

## Anti-patterns (ห้ามทำ)

❌ ใช้ hardcoded hex แทน variant class — `<div class="stat-card" style="background:#e8f2ec">`
❌ Override ผ่าน inline style — `<div class="stat-card teal" style="background:red">`
❌ Mix variants — `<div class="stat-card teal red">` (ใช้แค่ตัวเดียว)
❌ ใช้สี variant กับ semantic ที่ผิด (e.g. ใช้ `.red` กับ "ชำระแล้ว" ที่ควรเป็น success)
