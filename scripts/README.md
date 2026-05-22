# Daily Backup System

ระบบ backup อัตโนมัติของ Navasri ที่รันบน GitHub Actions

## 📅 ตารางเวลา

- **รัน auto:** ทุกวัน 02:00 น. (Bangkok time)
- **Cron expression:** `0 19 * * *` (19:00 UTC = 02:00 +07:00)
- **เวลาที่ใช้:** ~5-10 นาที/ครั้ง

## 📦 สิ่งที่ backup

1. **Database (Excel 65 sheets)** — เรียก Edge Function `backup`
2. **Storage files** — ดาวน์โหลดทุกไฟล์จาก:
   - `documents/` bucket (สัญญา + ผลแลป, ~58 MB)
   - `images/` bucket (รูปคนไข้/แผล/อุบัติเหตุ, ~133 MB)

ทุกอย่างรวมใน zip เดียวชื่อ `navasri-backup-YYYY-MM-DD.zip`

## 🗂️ Retention

เก็บ **30 ไฟล์ล่าสุด** — ลบอัตโนมัติเมื่อเกิน 30 release

(ใช้พื้นที่ ~6 GB ใน GitHub Releases ฟรี ไม่จำกัด)

## 🚨 Notification

- **Backup สำเร็จ:** ไม่แจ้ง (เงียบ)
- **Backup ล้มเหลว:** แจ้งเข้า LINE ผ่าน Edge Function `line-notify`

## 🔧 Manual Run

ถ้าต้องการ backup ทันทีไม่ต้องรอตี 2:

1. ไปที่ https://github.com/imaaon/navasri-system/actions
2. คลิก "Daily Backup" ในเมนูซ้าย
3. คลิกปุ่ม "Run workflow" (สีเขียว ขวาบน)
4. รอประมาณ 5-10 นาที

## 📁 วิธีกู้คืนข้อมูล

1. ไปที่ https://github.com/imaaon/navasri-system/releases
2. เลือก release ที่ต้องการ (เช่น `backup-2026-05-22`)
3. Download zip
4. แตก zip จะได้:
   ```
   navasri-backup-2026-05-22/
   ├── manifest.json           # ข้อมูล backup
   ├── database/
   │   └── navasri-2026-05-22.xlsx  # Excel 65 sheets
   └── storage/
       ├── documents/          # 53 ไฟล์ สัญญา+ผลแลป
       │   ├── contracts/
       │   └── medical/
       └── images/             # 121 ไฟล์ รูปต่างๆ
           ├── patients/
           ├── wounds/
           └── ...
   ```

## ⚙️ Secrets ที่ต้องตั้งใน GitHub

| Secret | ค่า | ใช้ทำอะไร |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key จาก Supabase Dashboard | ดึง Excel + Storage |

ตั้งได้ที่: Settings → Secrets and variables → Actions → New repository secret

## 🐛 Troubleshooting

### Backup fail บ่อย

1. เช็ค logs ที่ Actions tab
2. ถ้า timeout — เพิ่ม `timeout-minutes` ใน workflow
3. ถ้า quota เกิน — เช็ค GitHub Actions usage

### ลืม push ไป repo

```bash
cd navasri-system
git add .github/workflows/daily-backup.yml scripts/daily_backup.py scripts/README.md
git commit -m "feat: daily backup automation"
git push
```

### ต้องการเปลี่ยนเวลา backup

แก้ cron ใน `.github/workflows/daily-backup.yml`:
- 02:00 BKK = `0 19 * * *` (UTC)
- 06:00 BKK = `0 23 * * *` (UTC)
- 23:00 BKK = `0 16 * * *` (UTC)

## 📊 Monitor การใช้งาน

- **GitHub Actions usage:** Settings → Billing → Usage this month
- **Free tier:** 2,000 minutes/เดือน (private repo)
- **คาดการณ์:** 5-10 min × 30 วัน = 150-300 min/เดือน (ใช้ <15%)
