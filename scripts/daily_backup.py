#!/usr/bin/env python3
"""
Navasri Daily Backup Script
รัน auto จาก GitHub Actions ทุกวัน ตี 2 (Bangkok time)

ทำหน้าที่:
1. เรียก Edge Function 'backup' → ได้ Excel 65 sheets
2. ดาวน์โหลดทุกไฟล์จาก Storage buckets (documents + images)
3. สร้าง zip ชื่อ navasri-backup-YYYY-MM-DD.zip
4. Print path ให้ workflow ใช้ upload ไป Release
"""

import os
import sys
import json
import zipfile
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ===== Config =====
SUPABASE_URL = "https://umueucsxowjaurlaubwa.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    print("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
    sys.exit(1)

# Bangkok timezone
BKK = timezone(timedelta(hours=7))
TODAY = datetime.now(BKK).strftime("%Y-%m-%d")
TIMESTAMP = datetime.now(BKK).strftime("%Y-%m-%d_%H-%M")

BACKUP_DIR = Path("/tmp/navasri-backup")
BACKUP_DIR.mkdir(exist_ok=True)

HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
}

print(f"🚀 Navasri Backup started: {TIMESTAMP} (Bangkok)")
print("=" * 60)

# ===== Step 1: ดึง Excel จาก Edge Function backup =====
print("\n📊 Step 1/3: Downloading Excel backup from Edge Function...")
try:
    resp = requests.post(
        f"{SUPABASE_URL}/functions/v1/backup",
        headers=HEADERS,
        timeout=120,  # backup ใหญ่ใช้เวลานาน
    )
    resp.raise_for_status()
    excel_path = BACKUP_DIR / f"navasri-excel-{TODAY}.xlsx"
    excel_path.write_bytes(resp.content)
    excel_size = excel_path.stat().st_size
    print(f"   ✅ Excel saved: {excel_path.name} ({excel_size / 1024:.1f} KB)")
except Exception as e:
    print(f"   ❌ FAILED: {e}", file=sys.stderr)
    sys.exit(1)

# ===== Step 2: ดาวน์โหลดไฟล์จาก Storage =====
print("\n📦 Step 2/3: Downloading Storage files...")
storage_dir = BACKUP_DIR / "storage"
storage_dir.mkdir(exist_ok=True)

total_files = 0
total_bytes = 0
errors = []

def list_files_recursive(bucket, prefix=""):
    """List ไฟล์ใน bucket recursive"""
    files = []
    url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket}"
    body = {"prefix": prefix, "limit": 1000, "offset": 0}
    r = requests.post(url, headers=HEADERS, json=body, timeout=30)
    r.raise_for_status()
    items = r.json()
    
    for item in items:
        # ถ้าเป็น file (มี id) → เก็บ
        # ถ้าเป็น folder (id เป็น None) → recurse
        if item.get("id"):
            files.append(prefix + item["name"] if prefix else item["name"])
        else:
            # Folder — recurse เข้าไป
            sub_prefix = (prefix + item["name"] + "/") if prefix else (item["name"] + "/")
            files.extend(list_files_recursive(bucket, sub_prefix))
    return files

def download_file(bucket, path, local_path):
    """ดาวน์โหลด 1 ไฟล์"""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(r.content)
    return len(r.content)

for bucket in ["documents", "images"]:
    print(f"\n   📁 Bucket: {bucket}")
    try:
        files = list_files_recursive(bucket)
        print(f"      Found {len(files)} files")
        
        bucket_dir = storage_dir / bucket
        for i, file_path in enumerate(files, 1):
            try:
                local = bucket_dir / file_path
                size = download_file(bucket, file_path, local)
                total_files += 1
                total_bytes += size
                if i % 20 == 0 or i == len(files):
                    print(f"      Progress: {i}/{len(files)} files")
            except Exception as e:
                errors.append(f"{bucket}/{file_path}: {e}")
                print(f"      ⚠️ Failed: {file_path}: {e}")
    except Exception as e:
        errors.append(f"List {bucket} failed: {e}")
        print(f"      ❌ Cannot list bucket {bucket}: {e}")

print(f"\n   ✅ Storage total: {total_files} files, {total_bytes / 1024 / 1024:.1f} MB")
if errors:
    print(f"   ⚠️ {len(errors)} errors (continue anyway)")

# ===== Step 3: สร้าง Manifest + Zip =====
print("\n🗜️  Step 3/3: Creating zip archive...")
manifest = {
    "backup_timestamp": TIMESTAMP,
    "backup_date": TODAY,
    "supabase_project": "umueucsxowjaurlaubwa",
    "excel_size_kb": round(excel_size / 1024, 1),
    "storage_files": total_files,
    "storage_size_mb": round(total_bytes / 1024 / 1024, 1),
    "errors_count": len(errors),
    "errors": errors[:20],  # เก็บ error 20 อันแรก
}
manifest_path = BACKUP_DIR / "manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

zip_path = BACKUP_DIR / f"navasri-backup-{TODAY}.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    # เพิ่ม Excel
    zf.write(excel_path, f"navasri-backup-{TODAY}/database/navasri-{TODAY}.xlsx")
    # เพิ่ม Manifest
    zf.write(manifest_path, f"navasri-backup-{TODAY}/manifest.json")
    # เพิ่ม Storage files
    for f in storage_dir.rglob("*"):
        if f.is_file():
            rel = f.relative_to(storage_dir)
            zf.write(f, f"navasri-backup-{TODAY}/storage/{rel}")

zip_size = zip_path.stat().st_size
print(f"   ✅ Zip created: {zip_path.name} ({zip_size / 1024 / 1024:.1f} MB)")

# ===== Output for workflow =====
print("\n" + "=" * 60)
print(f"✅ BACKUP COMPLETE")
print(f"📂 Zip: {zip_path}")
print(f"📊 Size: {zip_size / 1024 / 1024:.1f} MB")
print(f"📋 Files: 1 Excel + {total_files} storage files")
print(f"⚠️ Errors: {len(errors)}")

# Set GitHub Actions output
github_output = os.environ.get("GITHUB_OUTPUT")
if github_output:
    with open(github_output, "a") as f:
        f.write(f"zip_path={zip_path}\n")
        f.write(f"zip_size_mb={zip_size / 1024 / 1024:.1f}\n")
        f.write(f"backup_date={TODAY}\n")
        f.write(f"storage_files={total_files}\n")
        f.write(f"errors_count={len(errors)}\n")

# Exit with error if too many failures
if len(errors) > 10:
    print(f"\n❌ Too many errors ({len(errors)}) — failing build")
    sys.exit(2)
