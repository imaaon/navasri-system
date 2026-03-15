// ===== CLINICAL PHOTO =====

// ===== CLINICAL MODULE =====

// ===== PHOTO PREVIEW =====
async function uploadPhotoToStorage(file, folder) {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supa.storage.from('images').upload(filename, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supa.storage.from('images').getPublicUrl(filename);
  return urlData.publicUrl;
}

function previewPhoto(type) {
  const input = document.getElementById(`${type}-photo-input`);
  const preview = document.getElementById(`${type}-photo-preview`);
  const dataEl = document.getElementById(`${type}-photo-data`);
  if (!input.files[0]) return;
  const objectUrl = URL.createObjectURL(input.files[0]);
  preview.innerHTML = `<img src="${objectUrl}" style="width:72px;height:72px;object-fit:cover;">`;
  dataEl.value = '__pending__';
  dataEl._pendingFile = input.files[0];
}

function previewItemPhoto() {
  const input = document.getElementById('item-photo-input');
  const preview = document.getElementById('item-photo-preview');
  const dataEl = document.getElementById('item-photo-data');
  if (!input.files[0]) return;
  const objectUrl = URL.createObjectURL(input.files[0]);
  preview.innerHTML = `<img src="${objectUrl}" style="width:80px;height:80px;object-fit:cover;">`;
  dataEl.value = '__pending__';
  dataEl._pendingFile = input.files[0];
}

function clearItemPhoto() {
  document.getElementById('item-photo-data').value = '';
  document.getElementById('item-photo-preview').innerHTML = '📷';
  document.getElementById('item-photo-input').value = '';
}

function showItemPhoto(itemId) {
  const item = db.items.find(i => i.id == itemId);
  if (!item || !item.photo) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.innerHTML = `<div style="position:relative;max-width:90vw;max-height:90vh;">
    <img src="${item.photo}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.5);">
    <div style="text-align:center;color:white;margin-top:10px;font-size:14px;font-weight:600;">${item.name}</div>
  </div>`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}


function togglePatIdType() {
  const t = document.getElementById('pat-id-type').value;
  const labels = { thai: 'เลขบัตรประชาชน', passport: 'เลขพาสปอร์ต', alien: 'เลขบัตรประจำตัวคนต่างด้าว', workpermit: 'เลขใบอนุญาตทำงาน' };
  const placeholders = { thai: '0-0000-00000-00-0', passport: 'A1234567', alien: '0-0000-00000-00-0', workpermit: 'WP-XXXXXXXX' };
  document.getElementById('pat-id-label').textContent = labels[t] || 'เลขบัตร';
  document.getElementById('pat-id').placeholder = placeholders[t] || '';
}
function toggleStaffIdType() {
  const t = document.getElementById('staff-id-type').value;
  const labels = { thai: 'เลขบัตรประชาชน', passport: 'เลขพาสปอร์ต', alien: 'เลขบัตรประจำตัวคนต่างด้าว', workpermit: 'เลขใบอนุญาตทำงาน' };
  const placeholders = { thai: '0-0000-00000-00-0', passport: 'A1234567', alien: '0-0000-00000-00-0', workpermit: 'WP-XXXXXXXX' };
  document.getElementById('staff-idcard-label').textContent = labels[t] || 'เลขบัตร';
  document.getElementById('staff-idcard').placeholder = placeholders[t] || '';
  // เฉพาะ thai ที่ lock ไม่ให้แก้ — อื่นๆ แก้ได้
  const inp = document.getElementById('staff-idcard');
  if (inp) inp.readOnly = false;
}
function toggleBedOtherNote() {
  const s = document.getElementById('bed-status').value;
  const noteEl = document.getElementById('bed-other-note');
  if (noteEl) noteEl.style.display = s === 'other' ? '' : 'none';
  if (s !== 'other' && noteEl) noteEl.value = '';
}