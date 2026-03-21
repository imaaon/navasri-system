// ===== STAFF MODULE =====

// ===== STAFF =====
function renderStaff() {
  const search = (document.getElementById('staffSearch')?.value || '').toLowerCase();
  const posFilterEl = document.getElementById('staffPosFilter');
  const posF = posFilterEl?.value || '';

  // สร้าง dropdown ตำแหน่งจากข้อมูลจริงใน db.staff
  if (posFilterEl) {
    const allPositions = [...new Set((db.staff||[]).map(s => s.position).filter(Boolean))].sort();
    const currentVal = posFilterEl.value;
    posFilterEl.innerHTML = '<option value="">ทั้งหมด</option>' +
      allPositions.map(pos => `<option value="${pos}"${pos === currentVal ? ' selected' : ''}>${pos}</option>`).join('');
  }

  const posBadges = {
    'พยาบาลวิชาชีพ':'badge-blue', 'พยาบาลพาร์ทไทม์':'badge-blue',
    'ผู้ช่วยพยาบาล':'badge-blue', 'พนักงานผู้ช่วยเหลือคนไข้':'badge-blue',
    'นักกายภาพบำบัด':'badge-purple', 'นักโภชนาการ':'badge-green',
    'หมอ':'badge-red', 'ธุรการ':'badge-gray', 'บัญชี':'badge-orange',
    'แม่บ้าน':'badge-gray', 'พ่อบ้าน':'badge-gray',
    'แม่ครัว':'badge-orange', 'พ่อครัว':'badge-orange',
  };

  let staffList = [...(db.staff||[])];
  if (search) staffList = staffList.filter(s =>
    (s.name||'').toLowerCase().includes(search) ||
    (s.nickname||'').toLowerCase().includes(search) ||
    (s.position||'').toLowerCase().includes(search)
  );
  if (posF) staffList = staffList.filter(s => s.position === posF);

  const positions = {};
  db.staff.forEach(s => { positions[s.position||'อื่นๆ'] = (positions[s.position||'อื่นๆ']||0)+1; });
  const sumEl = document.getElementById('staffSummary');
  if (sumEl) sumEl.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
    <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">👥 ทั้งหมด <strong>${db.staff.length}</strong> คน</div>
    ${Object.entries(positions).slice(0,5).map(([pos,cnt]) =>
      `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-size:12px;"><strong>${cnt}</strong> ${pos}</div>`
    ).join('')}
  </div>`;

  const tb = document.getElementById('staffTable');
  if (staffList.length === 0) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบข้อมูล</td></tr>';
    return;
  }
  tb.innerHTML = staffList.map((s, i) => {
    const age     = s.dob ? calcAge(s.dob) : '-';
    const tenure  = s.startDate ? calcDuration(s.startDate) : (s.start ? calcDuration(s.start) : '-');
    const startD  = s.startDate || s.start || '-';
    const endD    = s.endDate || '-';
    const idcard  = s.idcard || s.idCard || '-';
    return `<tr>
      <td class="number" style="color:var(--text3);">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          ${s.photo ? `<img src="${s.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--sage-light);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>`}
          <span style="font-weight:600;cursor:pointer;color:var(--accent);" onclick=\"openStaffProfile('${s.id}')\">${s.name}</span>
        </div>
      </td>
      <td style="color:var(--green-dark);font-weight:500;">${s.nickname||'-'}</td>
      <td><span class="badge ${posBadges[s.position]||'badge-gray'}">${s.position||'-'}</span></td>
      <td class="number" style="font-size:12px;color:var(--text2);">${idcard}</td>
      <td class="number" style="font-size:12px;">${s.dob||'-'}</td>
      <td style="font-size:12px;">${age}</td>
      <td class="number" style="font-size:12px;">${startD}</td>
      <td style="font-size:12px;color:var(--text2);">${tenure}</td>
      <td class="number" style="font-size:12px;">${endD}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick=\"openStaffProfile('${s.id}')\" title="ดูโปรไฟล์">🔍</button>
        <button class="btn btn-ghost btn-sm" onclick=\"editStaff('${s.id}')\" title="แก้ไข">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

function editStaff(id) {
  const s = db.staff.find(x => x.id == id);
  if (!s) return;
  document.getElementById('staff-edit-id').value    = id;
  document.getElementById('staff-name').value       = s.name || '';
  document.getElementById('staff-nickname').value   = s.nickname || '';
  document.getElementById('staff-pos').value        = s.position || '';
  document.getElementById('staff-id-type').value    = s.idType || 'thai';
  document.getElementById('staff-idcard').value     = s.idcard || s.idCard || '';
  document.getElementById('staff-dob').value        = s.dob || '';
  document.getElementById('staff-age-display').value= s.dob ? calcAge(s.dob) : '';
  document.getElementById('staff-start').value      = s.startDate || s.start || '';
  document.getElementById('staff-enddate').value    = s.endDate || '';
  document.getElementById('staff-phone').value      = s.phone || '';
  document.getElementById('staff-address').value    = s.address || '';
  document.getElementById('staff-note').value       = s.note || '';
  const photoData = document.getElementById('staff-photo-data');
  photoData.value = s.photo || '';
  const preview = document.getElementById('staff-photo-preview');
  preview.innerHTML = s.photo ? `<img src="${s.photo}" style="width:72px;height:72px;object-fit:cover;">` : '👤';
  document.getElementById('modal-addStaff-title').textContent = 'แก้ไขข้อมูลพนักงาน';
  // Load contract
  const cData = s.contractData || '';
  const cName = s.contractName || 'ยังไม่มีไฟล์';
  document.getElementById('staff-contract-data').value = cData;
  document.getElementById('staff-contract-name').textContent = cName;
  document.getElementById('staff-contract-view-btn').style.display = cData ? '' : 'none';
  document.getElementById('staff-contract-clear-btn').style.display = cData ? '' : 'none';
  openModal('modal-addStaff');
}

// ===== STAFF PROFILE PAGE =====
async function openStaffProfile(id) {
  try {
  const s = db.staff.find(x => x.id == id);
  if (!s) { toast('ไม่พบข้อมูลพนักงาน','error'); return; }
  document.getElementById('staffprofile-breadcrumb').textContent = s.name + (s.nickname ? ` (${s.nickname})` : '');
  // Query all reqs for this staff directly
  const { data: reqData } = await supa.from('requisitions').select('*').eq('staff_id', String(s.id)).order('id', {ascending:false});
  const reqs = (reqData||[]).map(mapReq);
  const age    = s.dob ? calcAge(s.dob) : '-';
  const tenure = s.startDate ? calcDuration(s.startDate) : (s.start ? calcDuration(s.start) : '-');
  const idcard = s.idcard || s.idCard || '-';
  const startD = s.startDate || s.start || '-';
  const posBadges = { พยาบาล:'badge-blue', PN:'badge-blue', หมอ:'badge-red',
    ธุรการ:'badge-gray', บัญชี:'badge-orange', โภชนากร:'badge-green',
    นักกายภาพ:'badge-purple', ผู้บริหาร:'badge-purple', บริบาล:'badge-blue' };

  document.getElementById('staffprofile-content').innerHTML = `
  <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start;">
    <div>
      <div class="card" style="text-align:center;padding:28px 20px;">
        ${s.photo ? `<img src="${s.photo}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--sage);margin:0 auto 12px;">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--sage-light);border:3px solid var(--sage);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:40px;">👤</div>`}
        <div style="font-size:17px;font-weight:700;margin-bottom:2px;">${s.name}</div>
        ${s.nickname ? `<div style="font-size:14px;color:var(--accent);margin-bottom:8px;">(${s.nickname})</div>` : ''}
        <span class="badge ${posBadges[s.position]||'badge-gray'}" style="font-size:13px;padding:4px 14px;">${s.position||'-'}</span>
        <div style="margin-top:16px;">
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;">
            <div style="font-size:20px;font-weight:700;color:var(--accent);">${tenure}</div>
            <div style="font-size:11px;color:var(--text2);">อายุงาน</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-primary" style="width:100%;" onclick=\"editStaff('${s.id}')\">✏️ แก้ไขข้อมูล</button>
          ${s.photo ? `<button class="btn btn-ghost btn-sm" style="width:100%;" onclick=\"showStaffPhoto('${s.id}')\">🖼️ ดูรูปถ่าย</button>` : ''}
          ${s.contractData ? `<button class="btn btn-ghost btn-sm" style="width:100%;color:var(--accent);" onclick=\"viewStaffContractById('${s.id}')\">📄 ดูสัญญาว่าจ้าง</button>` : '<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px 0;">ยังไม่มีสัญญาว่าจ้าง</div>'}
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><div class="card-title" style="font-size:13px;">📋 ข้อมูลส่วนตัว</div></div>
        <div style="padding:14px 16px;font-size:13px;display:flex;flex-direction:column;gap:10px;">
          <div><span style="color:var(--text3);min-width:90px;display:inline-block;">บัตร/พาสปอร์ต</span><strong>${idcard}</strong></div>
          <div><span style="color:var(--text3);min-width:90px;display:inline-block;">วันเกิด</span><strong>${s.dob||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:90px;display:inline-block;">อายุ</span><strong>${age}</strong></div>
          <div><span style="color:var(--text3);min-width:90px;display:inline-block;">วันเริ่มงาน</span><strong>${startD}</strong></div>
          <div><span style="color:var(--text3);min-width:90px;display:inline-block;">สิ้นสุดสัญญา</span><strong>${s.endDate||'-'}</strong></div>
          ${s.phone ? `<div><span style="color:var(--text3);min-width:90px;display:inline-block;">โทรศัพท์</span><strong>${s.phone}</strong></div>` : ''}
          ${s.address ? `<div><span style="color:var(--text3);min-width:90px;display:inline-block;vertical-align:top;">ที่อยู่</span><strong>${s.address}</strong></div>` : ''}
        </div>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-header">
          <div class="card-title" style="font-size:13px;">📦 ประวัติการเบิกสินค้า (${reqs.length} ครั้ง)</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>วันที่</th><th>ผู้รับบริการ</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th></th></tr></thead>
            <tbody>
              ${reqs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">ยังไม่มีประวัติ</td></tr>' :
                reqs.slice(0,30).map(r => `<tr>
                  <td class="number" style="font-size:12px;white-space:nowrap;">${r.date||'-'}</td>
                  <td style="font-size:12px;">${r.patientName||'-'}</td>
                  <td style="font-weight:500;">${r.itemName||'-'}</td>
                  <td class="number">${r.qty||0}</td>
                  <td>${r.unit||''}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">🖨️</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${s.note ? `<div class="card" style="margin-top:16px;"><div class="card-header"><div class="card-title" style="font-size:13px;">📝 หมายเหตุ</div></div><div style="padding:16px 20px;font-size:13px;white-space:pre-wrap;">${s.note}</div></div>` : ''}
    </div>
  </div>`;
  showPage('staffprofile');
  } catch(err) { console.error('openStaffProfile error:', err); toast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
}

// ===== STAFF CRUD =====
function openAddStaffModal() {
  document.getElementById('staff-edit-id').value = '';
  document.getElementById('staff-name').value = '';
  document.getElementById('staff-nickname').value = '';
  document.getElementById('staff-pos').value = '';
  document.getElementById('staff-idcard').value = '';
  document.getElementById('staff-dob').value = '';
  document.getElementById('staff-start').value = '';
  document.getElementById('staff-enddate').value = '';
  document.getElementById('staff-note').value = '';
  document.getElementById('modal-addStaff-title').textContent = 'เพิ่มพนักงาน';
  document.getElementById('staff-contract-data').value = '';
  document.getElementById('staff-contract-name').textContent = 'ยังไม่มีไฟล์';
  document.getElementById('staff-contract-view-btn').style.display = 'none';
  document.getElementById('staff-contract-clear-btn').style.display = 'none';
  openModal('modal-addStaff');
}
function saveStaff() {
  const name = document.getElementById('staff-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อ', 'warning'); return; }
  const editId = document.getElementById('staff-edit-id').value;
  (async () => {
  const photoEl = document.getElementById('staff-photo-data');
  let photoVal = photoEl.value;
  if (photoVal === '__pending__' && photoEl._pendingFile) {
    try { photoVal = await uploadPhotoToStorage(photoEl._pendingFile, 'staff'); }
    catch(e) { toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message, 'error'); return; }
  } else if (photoVal === '__pending__') { photoVal = ''; }
  const data = {
    name,
    nickname:  document.getElementById('staff-nickname').value,
    position:  document.getElementById('staff-pos').value,
    idcard:    document.getElementById('staff-idcard').value,
    idType:    document.getElementById('staff-id-type').value,
    dob:       document.getElementById('staff-dob').value,
    startDate: document.getElementById('staff-start').value,
    endDate:   document.getElementById('staff-enddate').value,
    phone:     document.getElementById('staff-phone').value,
    address:   document.getElementById('staff-address').value,
    note:      document.getElementById('staff-note').value,
    photo:     photoVal || undefined,
    contractData: document.getElementById('staff-contract-data').value || undefined,
    contractName: document.getElementById('staff-contract-name').textContent !== 'ยังไม่มีไฟล์' ? document.getElementById('staff-contract-name').textContent : undefined,
  };
  const row = { name: data.name, nickname: data.nickname||null, position: data.position||null,
      id_type: data.idType||'thai', idcard: data.idcard||null,
      dob: data.dob||null, start_date: data.startDate||null, end_date: data.endDate||null,
      phone: data.phone||null, address: data.address||null, note: data.note||null,
      photo: data.photo||null, contract_data: data.contractData||null, contract_name: data.contractName||null };
    if (editId) {
      const { error } = await supa.from('staff').update(row).eq('id', editId);
      if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
      const idx = db.staff.findIndex(s => s.id == editId);
      if (idx >= 0) db.staff[idx] = { ...db.staff[idx], ...data, id: editId };
      toast('แก้ไขข้อมูลเรียบร้อย','success');
    } else {
      const { data: ins, error } = await supa.from('staff').insert(row).select().single();
      if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
      db.staff.push({ ...data, id: ins.id });
      toast('เพิ่มพนักงานเรียบร้อย', 'success');
    }
    closeModal('modal-addStaff');
    renderStaff();
  })();
}

// ===== STAFF CONTRACT HELPERS =====
function loadStaffContract() {
  const input = document.getElementById('staff-contract-input');
  if (!input.files[0]) return;
  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) {
    toast('ไฟล์ใหญ่เกิน 5 MB — อาจทำให้ระบบช้า', 'warning');
  }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('staff-contract-data').value = e.target.result;
    document.getElementById('staff-contract-name').textContent = file.name;
    document.getElementById('staff-contract-view-btn').style.display = '';
    document.getElementById('staff-contract-clear-btn').style.display = '';
  };
  reader.readAsDataURL(file);
}

function clearStaffContract() {
  document.getElementById('staff-contract-data').value = '';
  document.getElementById('staff-contract-name').textContent = 'ยังไม่มีไฟล์';
  document.getElementById('staff-contract-view-btn').style.display = 'none';
  document.getElementById('staff-contract-clear-btn').style.display = 'none';
  document.getElementById('staff-contract-input').value = '';
}

function viewStaffContract() {
  const data = document.getElementById('staff-contract-data').value;
  if (!data) return;
  openBase64PDF(data);
}

function viewStaffContractById(id) {
  const s = db.staff.find(x => x.id == id);
  if (!s || !s.contractData) { toast('ไม่พบไฟล์สัญญา', 'warning'); return; }
  openBase64PDF(s.contractData);
}

function showPatientPhoto(id) {
  const p = db.patients.find(x => x.id == id);
  if (!p || !p.photo) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.innerHTML = `<div style="text-align:center;">
    <img src="${p.photo}" style="max-width:88vw;max-height:78vh;object-fit:contain;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.5);">
    <div style="color:white;margin-top:12px;font-size:16px;font-weight:700;">${p.name}</div>
    <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:4px;">คลิกที่ใดก็ได้เพื่อปิด</div>
  </div>`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

function showStaffPhoto(id) {
  const s = db.staff.find(x => x.id == id);
  if (!s || !s.photo) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.innerHTML = `<div style="text-align:center;">
    <img src="${s.photo}" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.5);">
    <div style="color:white;margin-top:10px;font-size:15px;font-weight:600;">${s.name}</div>
  </div>`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

function openBase64PDF(dataUrl) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>สัญญาว่าจ้าง</title>
    <style>body{margin:0;padding:0;background:#333;}iframe{width:100vw;height:100vh;border:none;}</style>
    </head><body><iframe src="${dataUrl}"></iframe></body></html>`);
  win.document.close();
}

function exportStaffExcel() {
  const rows = [
    ['#', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'ตำแหน่ง', 'ประเภทบัตร', 'เลขบัตร', 'วันเกิด', 'วันเริ่มงาน', 'วันสิ้นสุด', 'โทรศัพท์', 'ที่อยู่', 'หมายเหตุ']
  ];
  db.staff.forEach((s, i) => {
    rows.push([
      i+1, s.name || '', s.nickname || '', s.position || '',
      s.idType || '', s.idcard || '', s.dob || '',
      s.startDate || '', s.endDate || '',
      s.phone || '', s.address || '', s.note || ''
    ]);
  });
  _xlsxDownload(rows, 'พนักงาน', 'navasri_staff_' + new Date().toISOString().slice(0,10));
}
