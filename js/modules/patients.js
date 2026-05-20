
function openEditAllergyModal(patId, allergyId) {
  const patient = db.patients.find(p => p.id == patId);
  if (!patient) { toast('ไม่พบข้อมูลผู้รับบริการ — กรุณา refresh แล้วลองใหม่', 'error'); return; }
  const a = (patient.allergies||[]).find(x => x.id == allergyId);
  if (!a) { toast('ไม่พบรายการแพ้ที่ต้องการแก้ไข — กรุณา refresh แล้วลองใหม่', 'error'); return; }
  document.getElementById('allergy-pat-id').value = patId;
  document.getElementById('allergy-pat-id').dataset.editId = allergyId;
  document.getElementById('allergy-allergen').value = a.allergen || '';
  document.getElementById('allergy-type').value = a.allergyType || 'ยา';
  document.getElementById('allergy-severity').value = a.severity || 'ปานกลาง';
  document.getElementById('allergy-reaction').value = a.reaction || '';
  document.getElementById('allergy-note').value = a.note || '';
  var titleEl = document.getElementById('allergy-modal-title');
  if (titleEl) titleEl.textContent = '✏️ แก้ไขประวัติการแพ้ยา / อาหาร';
  openModal('modal-add-allergy');
}
// ===== PATIENTS MODULE =====

// ===== Helper: แปล Postgres error เป็นข้อความภาษาไทยที่อ่านง่าย =====
function _translatePatientError(error) {
  if (!error) return 'บันทึกไม่สำเร็จ: เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
  const msg = (error.message || '').toLowerCase();
  // Postgres unique violation (code 23505)
  if (error.code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('idcard')) {
      return '❌ เลขบัตรประชาชนนี้มีในระบบแล้ว กรุณาตรวจสอบรายชื่อผู้รับบริการที่มีอยู่';
    }
    return '❌ ข้อมูลซ้ำกับที่มีในระบบแล้ว กรุณาตรวจสอบ';
  }
  return 'บันทึกไม่สำเร็จ: ' + (error.message || 'unknown');
}

// ===== PATIENTS =====
// [R9-A 14พค69] renderPatients — uses KPI cards (pat-kpi-*) instead of inline patSummary
function renderPatients() {
  const search = (document.getElementById('patSearch')?.value || '').toLowerCase();
  const statusF = document.getElementById('patStatusFilter')?.value || '';
  let pats = [...db.patients];
  if (search) pats = pats.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.idcard||p.idCard||'').toLowerCase().includes(search) ||
    (p.hn||'').toLowerCase().includes(search) ||
    (p.phone||'').includes(search)
  );
  if (statusF) pats = pats.filter(p => p.status === statusF);

  // [Step B-1 · 20 พ.ค. 69] Sort pinned ขึ้นบน — keep order ตาม pin order (newest pin บนสุด)
  const pinnedIds = window._pinnedPatients || [];
  if (pinnedIds.length > 0) {
    const pinnedSet = new Set(pinnedIds.map(String));
    const pinned = [];
    const others = [];
    pats.forEach(p => {
      if (pinnedSet.has(String(p.id))) pinned.push(p);
      else others.push(p);
    });
    // Sort pinned ตามลำดับใน window._pinnedPatients (recent pin first)
    pinned.sort((a, b) => {
      const ia = pinnedIds.findIndex(id => String(id) === String(a.id));
      const ib = pinnedIds.findIndex(id => String(id) === String(b.id));
      return ia - ib;
    });
    pats = pinned.concat(others);
  }

  // ── KPI counts (based on UNFILTERED full set — like dashboard) ──
  const all = db.patients || [];
  const totalAll    = all.length;
  const activeAll   = all.filter(p => p.status === 'active').length;
  const hospitalAll = all.filter(p => p.status === 'hospital').length;
  const inactiveAll = all.filter(p => p.status === 'inactive').length;

  // ── Update KPI cards ──
  const $ = (id) => document.getElementById(id);
  if ($('pat-kpi-total'))    $('pat-kpi-total').textContent    = totalAll.toLocaleString('th-TH');
  if ($('pat-kpi-active'))   $('pat-kpi-active').textContent   = activeAll.toLocaleString('th-TH');
  if ($('pat-kpi-hospital')) $('pat-kpi-hospital').textContent = hospitalAll.toLocaleString('th-TH');
  if ($('pat-kpi-inactive')) $('pat-kpi-inactive').textContent = inactiveAll.toLocaleString('th-TH');

  // ── Header subtitle (live count of filtered + filter status) ──
  if ($('pat-header-subtitle')) {
    const filterLabel = statusF === 'active' ? ' · กรอง: พักอยู่'
      : statusF === 'hospital' ? ' · กรอง: อยู่โรงพยาบาล'
      : statusF === 'inactive' ? ' · กรอง: ออกแล้ว'
      : '';
    const searchLabel = search ? ` · ค้นหา: "${search}"` : '';
    $('pat-header-subtitle').textContent = `${totalAll} รายในระบบ · พักอยู่ ${activeAll} · ออกแล้ว ${inactiveAll}${filterLabel}${searchLabel}`;
  }

  // ── Table count subtitle ──
  if ($('patCount')) $('patCount').textContent = `${pats.length} ราย · กดที่แถวเพื่อดูโปรไฟล์`;

  // ── Legacy patSummary kept empty (was inline chips, replaced by KPI cards) ──
  const sumEl = document.getElementById('patSummary');
  if (sumEl) sumEl.innerHTML = '';

  const tb = document.getElementById('patTable');
  if (pats.length === 0) {
    tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบข้อมูล</td></tr>';
    return;
  }
  // [Step B-1 · 20 พ.ค. 69] Helper: เช็ค pinned + แสดง separator
  const pinnedSet = new Set((window._pinnedPatients || []).map(String));
  const pinnedCount = pats.filter(p => pinnedSet.has(String(p.id))).length;
  const othersCount = pats.length - pinnedCount;
  let separatorInserted = false;

  tb.innerHTML = pats.map((p, i) => {
    const isPinned = pinnedSet.has(String(p.id));

    // [Step B-1] Insert separator row ก่อนคนแรกที่ไม่ใช่ pin (เฉพาะถ้ามี pin อย่างน้อย 1)
    let separatorRow = '';
    if (pinnedCount > 0 && i === 0) {
      separatorRow = `<tr class="pat-list-separator" aria-hidden="true">
        <td colspan="12" style="padding:6px 12px;background:#FAEEDA;font-size:11px;font-weight:600;color:#854F0B;border-top:0;">
          ⭐ ปักหมุด (${pinnedCount} ราย)
        </td>
      </tr>`;
    }
    if (pinnedCount > 0 && !isPinned && !separatorInserted) {
      separatorInserted = true;
      separatorRow += `<tr class="pat-list-separator" aria-hidden="true">
        <td colspan="12" style="padding:6px 12px;background:var(--bg-elevated,#f5f3ee);font-size:11px;font-weight:600;color:var(--text2);border-top:0;">
          ผู้รับบริการอื่น (${othersCount} ราย)
        </td>
      </tr>`;
    }

    const idcard = p.idcard || p.idCard || '-';
    // [R9-B] Format เลขบัตรประชาชน: 1234567890123 → 1-2345-67890-12-3
    const idcardFmt = (idcard && idcard !== '-' && idcard.replace(/\D/g, '').length === 13)
      ? idcard.replace(/\D/g, '').replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')
      : idcard;
    const age    = p.dob ? calcAge(p.dob) : '-';
    const dur    = p.admitDate ? calcDuration(p.admitDate, p.endDate) : '-';
    const isActive = p.status === 'active';

    // [R9-B] Avatar initials — Thai 2 chars from name (e.g. "สมหญิง พิทักษ์" → "สห")
    const nameTrim = (p.name || '').trim();
    const nameParts = nameTrim.split(/\s+/);
    const initials = nameParts.length >= 2
      ? (nameParts[0].charAt(0) + nameParts[1].charAt(0))
      : nameTrim.substring(0, 2);

    // [R9-B] Row class + avatar tone based on status
    const rowClass = p.status === 'hospital' ? 'pat-status-hospital'
      : p.status === 'inactive' ? 'pat-status-inactive'
      : 'pat-status-active';
    const avatarToneClass = p.status === 'hospital' ? 'pat-avatar-hospital'
      : p.status === 'inactive' ? 'pat-avatar-inactive'
      : 'pat-avatar-active';

    // [R9-B] HN line (under name)
    const hn = p.hn || '';
    const subLine = hn ? `HN ${hn}` : (p.position || '');

    return `${separatorRow}<tr class="${rowClass}" data-patient-id="${p.id}">
      <td class="ph-col-check" style="text-align:center;display:none;"><input type="checkbox" class="patient-handover-cb" data-patient-id="${p.id}" onclick="patHandoverToggleRow(this)" style="cursor:pointer;width:18px;height:18px;"></td>
      <td data-label="#">${i+1}</td>
      <td data-label="ชื่อ-นามสกุล">
        <div style="display:flex;align-items:center;gap:10px;">
          ${p.photo
            ? `<img src="${p.photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--sage);cursor:zoom-in;flex-shrink:0;" onclick=\"showPatientPhoto('${p.id}')\" title="คลิกเพื่อขยาย">`
            : `<div class="pat-avatar-initials ${avatarToneClass}" onclick=\"editPatient('${p.id}')\" title="เพิ่มรูปภาพ">${initials}</div>`}
          <div>
            <div style="font-weight:600;cursor:pointer;color:var(--accent);line-height:1.3;" onclick=\"openPatientProfile('${p.id}')\">${isPinned ? '<span style="color:#EF9F27;font-size:13px;margin-right:3px;" title="ปักหมุด" aria-label="ปักหมุด">★</span>' : ''}${p.name}</div>
            <div style="font-size:11px;color:var(--text3);">${subLine}</div>
          </div>
        </div>
      </td>
      <td data-label="เลขบัตรประชาชน">${idcardFmt}</td>
      <td data-label="วันเกิด">${p.dob||'—'}</td>
      <td data-label="อายุ">${age}</td>
      <td data-label="วันเข้ารับบริการ">${p.admitDate||p.admit_date||'—'}</td>
      <td data-label="วันสิ้นสุดสัญญา">${p.endDate||p.end_date||'—'}</td>
      <td data-label="ระยะเวลา">${dur}</td>
      <td data-label="สถานะ"><span class="badge ${p.status==='active' ? 'badge-green' : p.status==='hospital' ? 'badge-blue' : 'badge-gray'}">${p.status==='active' ? 'พักอยู่' : p.status==='hospital' ? '🏥 อยู่ รพ.' : 'ออกแล้ว'}</span></td>
      <td class="ph-col-shift" data-label="สถานะเวร" data-patient-id="${p.id}" style="display:none;"><span style="font-size:11px;color:var(--text3);">—</span></td>
      <td data-label="" style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick=\"openPatientProfile('${p.id}')\" title="ดูโปรไฟล์">🔍</button>
        <button class="btn btn-ghost btn-sm" onclick=\"editPatient('${p.id}')\" title="แก้ไข">✏️</button>
      </td>
    </tr>`;
  }).join('');

  // [Step B-2a · 20 พ.ค. 69] Initialize handover UI + restore checkbox state
  if (typeof patHandoverInitUI === 'function') patHandoverInitUI();
  // Restore checkbox state จาก session
  const sel = window._patHandoverSelected || {};
  document.querySelectorAll('.patient-handover-cb').forEach(cb => {
    if (sel[cb.dataset.patientId]) cb.checked = true;
  });
  if (typeof _patHandoverUpdateCounter === 'function') _patHandoverUpdateCounter();
}

function calcDuration(startDate, endDate) {
  if (!startDate) return '-';
  const start = new Date(startDate);
  const end   = endDate ? new Date(endDate) : new Date();
  const diffMs = end - start;
  if (diffMs < 0) return '-';
  const days   = Math.floor(diffMs / (1000*60*60*24));
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rem    = days % 30;
  if (years > 0) return `${years} ปี ${months} เดือน`;
  if (months > 0) return `${months} เดือน ${rem} วัน`;
  return `${days} วัน`;
}

function viewPatientHistory(patId) {
  openPatientProfile(patId);
}

function editPatient(id) {
  const p = db.patients.find(x => x.id == id);
  if (!p) { toast('ไม่พบข้อมูลผู้รับบริการ — กรุณา refresh แล้วลองใหม่', 'error'); return; }
  document.getElementById('pat-edit-id').value  = id;
  document.getElementById('pat-name').value     = p.name || '';
  document.getElementById('pat-id-type').value  = p.idType || 'thai';
  document.getElementById('pat-id').value       = p.idcard || p.idCard || '';
  // วันเกิด
  const dobUnknown = !!(p.dobUnknown);
  document.getElementById('pat-dob-unknown').checked  = dobUnknown;
  document.getElementById('pat-dob').value             = dobUnknown ? '' : (p.dob || '');
  document.getElementById('pat-dob').disabled          = dobUnknown;
  document.getElementById('pat-birth-year').value      = p.birthYear || '';
  document.getElementById('pat-birth-year').disabled   = dobUnknown;
  if (dobUnknown) {
    document.getElementById('pat-age-display').value = 'ไม่ทราบ';
  } else if (p.dob) {
    document.getElementById('pat-age-display').value = calcAge(p.dob);
  } else if (p.birthYear) {
    document.getElementById('pat-age-display').value = (new Date().getFullYear() + 543 - parseInt(p.birthYear)) + ' ปี (ประมาณ)';
  } else {
    document.getElementById('pat-age-display').value = '';
  }
  document.getElementById('pat-admit').value    = p.admitDate || p.admit_date || '';
  document.getElementById('pat-enddate').value  = p.endDate || p.end_date || '';
  document.getElementById('pat-status').value   = p.status || 'active';
  document.getElementById('pat-phone').value    = p.phone || '';
  document.getElementById('pat-emergency').value= p.emergency || '';
  document.getElementById('pat-address').value  = p.address || '';
  document.getElementById('pat-note').value     = p.note || '';
  const photoData = document.getElementById('pat-photo-data');
  photoData.value = p.photo || '';
  const preview = document.getElementById('pat-photo-preview');
  preview.innerHTML = p.photo ? `<img src="${p.photo}" style="width:72px;height:72px;object-fit:cover;">` : '👤';
  // bed
  populateBedDropdown(p.currentBedId);
  onPatBedChange();
  document.getElementById('modal-addPatient-title').textContent = 'แก้ไขข้อมูลผู้รับบริการ';
  openModal('modal-addPatient');
}

function calcAge(dob) {
  if (!dob) return '-';
  const age = Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  return age + ' ปี';
}

function onPatDobChange() {
  const dob = document.getElementById('pat-dob').value;
  const ageEl = document.getElementById('pat-age-display');
  if (dob) {
    ageEl.value = calcAge(dob);
    document.getElementById('pat-birth-year').value = '';
  } else {
    ageEl.value = '';
  }
}

function onPatBirthYearChange() {
  const yr = parseInt(document.getElementById('pat-birth-year').value);
  const ageEl = document.getElementById('pat-age-display');
  if (yr) {
    ageEl.value = (new Date().getFullYear() + 543 - yr) + ' ปี (ประมาณ)';
    document.getElementById('pat-dob').value = '';
  } else {
    ageEl.value = '';
  }
}

function onPatDobUnknownChange() {
  const unknown = document.getElementById('pat-dob-unknown').checked;
  document.getElementById('pat-dob').disabled        = unknown;
  document.getElementById('pat-birth-year').disabled = unknown;
  document.getElementById('pat-age-display').value   = unknown ? 'ไม่ทราบ' : '';
  if (unknown) {
    document.getElementById('pat-dob').value        = '';
    document.getElementById('pat-birth-year').value = '';
  }
}

// ===== PATIENT CRUD =====
function openAddPatientModal() {
  // [R27-P4 15พค69] UAT-2: เพิ่ม reset field ที่ขาด (pat-id-type/phone/emergency/address)
  //   เดิม reset แค่ 11 fields ทำให้ข้อมูลค้างเมื่อเปิด modal ครั้งถัดไปหลัง save
  document.getElementById('pat-edit-id').value = '';
  document.getElementById('pat-name').value = '';
  document.getElementById('pat-id-type').value = 'thai';
  document.getElementById('pat-id').value = '';
  document.getElementById('pat-dob').value = '';
  document.getElementById('pat-dob').disabled = false;
  document.getElementById('pat-birth-year').value = '';
  document.getElementById('pat-birth-year').disabled = false;
  document.getElementById('pat-dob-unknown').checked = false;
  document.getElementById('pat-age-display').value = '';
  document.getElementById('pat-phone').value = '';
  document.getElementById('pat-emergency').value = '';
  document.getElementById('pat-address').value = '';
  document.getElementById('pat-admit').value = '';
  document.getElementById('pat-enddate').value = '';
  document.getElementById('pat-status').value = 'active';
  document.getElementById('pat-note').value = '';
  document.getElementById('pat-photo-data').value = '';
  document.getElementById('pat-photo-preview').innerHTML = '👤';
  // photo input file ก็ต้อง reset (ไม่งั้นเลือกไฟล์เดิมจะไม่ trigger change)
  const photoInput = document.getElementById('pat-photo-input');
  if (photoInput) photoInput.value = '';
  populateBedDropdown(null);
  document.getElementById('pat-room-info').style.display = 'none';
  document.getElementById('modal-addPatient-title').textContent = 'เพิ่มผู้รับบริการ';
  openModal('modal-addPatient');
}
function populateBedDropdown(currentBedId) {
  const sel = document.getElementById('pat-bed');
  const availBeds = db.beds.filter(b => b.status === 'available' || (currentBedId && b.id == currentBedId));
  sel.innerHTML = '<option value="">-- ไม่ระบุ / ยังไม่มีเตียง --</option>' +
    availBeds.map(b => {
      const room = db.rooms.find(r => r.id == b.roomId);
      const label = room ? `${room.name} · เตียง ${b.bedCode} (${room.roomType})` : `เตียง ${b.bedCode}`;
      return `<option value="${b.id}" ${currentBedId == b.id ? 'selected':''}>${label}</option>`;
    }).join('');
}
function onPatBedChange() {
  const bedId = document.getElementById('pat-bed').value;
  const infoDiv = document.getElementById('pat-room-info');
  if (!bedId) { infoDiv.style.display = 'none'; return; }
  const bed  = db.beds.find(b => b.id == bedId);
  const room = bed ? db.rooms.find(r => r.id == bed.roomId) : null;
  if (room) {
    const priceHtml = canSeePrice() ? ` · ค่าห้อง <strong>${room.monthlyRate?.toLocaleString('th-TH')||0} ฿/เดือน</strong>${room.dailyRate ? ` หรือ ${room.dailyRate.toLocaleString('th-TH')} ฿/วัน` : ''}` : '';
    infoDiv.innerHTML = `🏠 ${room.roomType} · ${room.zone||''}${priceHtml}`;
    infoDiv.style.display = 'block';
  }
}
async function savePatient() {
  if (!canManagePatients()) { toast('ไม่มีสิทธิ์แก้ไขข้อมูลผู้รับบริการ','error'); return; }
  const name = document.getElementById('pat-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อ', 'warning'); return; }
  const editId = document.getElementById('pat-edit-id').value;
  const bedId  = document.getElementById('pat-bed').value || null;
  const photoEl = document.getElementById('pat-photo-data');
  let photoVal = photoEl.value;
  if (photoVal === '__pending__' && photoEl._pendingFile) {
    try { photoVal = await uploadPhotoToStorage(photoEl._pendingFile, 'patients'); }
    catch(e) { toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message, 'error'); return; }
  } else if (photoVal === '__pending__') { photoVal = ''; }
  const data = {
    name,
    idcard: document.getElementById('pat-id').value,
    idType: document.getElementById('pat-id-type').value,
    dob:    document.getElementById('pat-dob').value,
    birthYear: document.getElementById('pat-birth-year').value || null,
    dobUnknown: document.getElementById('pat-dob-unknown').checked,
    admitDate: document.getElementById('pat-admit').value,
    endDate: document.getElementById('pat-enddate').value,
    status: document.getElementById('pat-status').value,
    phone:  document.getElementById('pat-phone').value,
    emergency: document.getElementById('pat-emergency').value,
    address: document.getElementById('pat-address').value,
    note:   document.getElementById('pat-note').value,
    photo:  photoVal || undefined,
    currentBedId: bedId || null,
  };
  // ===== VALIDATION (Phase 6) =====
  // เฉพาะถ้า id_type = thai เท่านั้น ที่ต้อง 13 หลัก
  if (data.idType === 'thai') {
    const idErr = validateThaiIdCard(data.idcard);
    if (idErr) { toast(idErr, 'warning'); return; }
  }
  const phoneErr = validatePhone(data.phone);
  if (phoneErr) { toast('เบอร์โทร: '+phoneErr, 'warning'); return; }
  const emergencyErr = validatePhone(data.emergency);
  if (emergencyErr) { toast('เบอร์ติดต่อฉุกเฉิน: '+emergencyErr, 'warning'); return; }
  const dateErr = validateDateOrder(data.admitDate, data.endDate, 'วันรับเข้า', 'วันสิ้นสุดสัญญา');
  if (dateErr) { toast(dateErr, 'warning'); return; }
  // ===== END VALIDATION =====
  const row = {
    name: data.name, idcard: data.idcard||null, id_type: data.idType||'thai',
    dob: data.dob||null, birth_year: data.birthYear||null,
    dob_unknown: data.dobUnknown||false,
    admit_date: data.admitDate||null, end_date: data.endDate||null,
    status: data.status||'active', phone: data.phone||null,
    emergency: data.emergency||null, address: data.address||null,
    note: data.note||null, photo: data.photo||null,
    current_bed_id: data.currentBedId,
  };
  // [BUG FIX 18 พ.ค. 2569] Snapshot oldBedId ก่อน update — เพราะ db.patients[] จะถูก update ก่อนเรียก admit_patient RPC
  // ถ้าอ่าน oldBedId หลัง update จะได้ bedId ใหม่ (เท่ากับ bedId) → RPC ไม่ปล่อยเตียงเก่า
  const _oldBedIdSnapshot = editId ? (db.patients.find(p=>p.id==editId)?.currentBedId||null) : null;

  if (editId) {








    const { error } = await supa.from('patients').update(row).eq('id', editId);
    if (error) { toast(_translatePatientError(error), 'error'); return; }
    // บันทึก status log ถ้า status เปลี่ยน
    const oldPat = db.patients.find(p => p.id == editId);
    if (oldPat && oldPat.status !== data.status) {
      const { error: _logErr } = await supa.from('patient_status_logs').insert({
        patient_id: editId,
        old_status: oldPat.status,
        new_status: data.status,
        changed_by: currentUser?.displayName || currentUser?.username || '',
        note: `เปลี่ยนจาก ${oldPat.status === 'active' ? 'พักอยู่' : oldPat.status === 'hospital' ? 'อยู่โรงพยาบาล' : 'ออกแล้ว'} เป็น ${data.status === 'active' ? 'พักอยู่' : data.status === 'hospital' ? 'อยู่โรงพยาบาล' : 'ออกแล้ว'}`,
      });
      if (_logErr) console.error('[navasri] status_log insert fail:', _logErr.message);
    }
    const idx = db.patients.findIndex(p => p.id == editId);
    if (idx >= 0) db.patients[idx] = { ...db.patients[idx], ...data };
  } else {
    const { data: ins, error } = await supa.from('patients').insert(row).select().single();
    if (error) { toast(_translatePatientError(error), 'error'); return; }
    db.patients.push({ ...data, id: ins.id, medicalLog: [], medsLog: [], allergies: [], contacts: [] });
  }
  // Mark bed as occupied — atomic via admit_patient RPC
  if (bedId) {
    const _oldBedId = _oldBedIdSnapshot;  // ใช้ snapshot ที่บันทึกไว้ก่อน update (Bug fix)
    const _patId = editId || db.patients[db.patients.length-1]?.id;
    const { data: _rpcBed, error: _rpcBedErr } = await supa.rpc('admit_patient', {
      p_patient_id: _patId,
      p_bed_id:     parseInt(bedId),
      p_old_bed_id: _oldBedId ? parseInt(_oldBedId) : null,
      p_created_by: currentUser?.username || '',
    });
    if (_rpcBedErr || !_rpcBed?.ok) {
      toast('⚠️ บันทึกสำเร็จ แต่อัปเดตเตียงไม่สำเร็จ: ' + (_rpcBedErr?.message||_rpcBed?.error||'unknown'), 'warning');
    } else {
      const _nb = db.beds.find(b=>b.id==bedId); if(_nb) _nb.status='occupied';
      const _ob = db.beds.find(b=>b.id==_oldBedId); if(_ob&&_oldBedId!=bedId) _ob.status='available';
      // [BUG FIX 18 พ.ค. 2569] บันทึก patient_room_history เมื่อย้ายเตียง (case: เตียงเก่า ≠ เตียงใหม่ + มีเตียงเก่า)
      if (_oldBedId && _oldBedId != bedId) {
        try {
          const _oldBed = db.beds.find(b=>b.id==_oldBedId);
          const _newBed = db.beds.find(b=>b.id==bedId);
          const _oldRoom = _oldBed ? db.rooms.find(r=>r.id==_oldBed.roomId) : null;
          const _newRoom = _newBed ? db.rooms.find(r=>r.id==_newBed.roomId) : null;
          if (_newBed && _newRoom) {
            const _today = new Date().toISOString().slice(0,10);
            const { error: _hisErr } = await supa.from('patient_room_history').insert({
              patient_id: _patId,
              patient_name: data.name || '',
              from_room_id: _oldRoom?.id || null,
              from_room:    _oldRoom?.name || '',
              from_bed_id:  _oldBed?.id || null,
              from_bed:     _oldBed?.bedCode || '',
              to_room_id:   _newRoom.id,
              to_room:      _newRoom.name,
              to_bed_id:    _newBed.id,
              to_bed:       _newBed.bedCode,
              transfer_date: _today,
              created_by:   currentUser?.displayName || currentUser?.username || '',
              note:         'ย้ายห้องผ่านการแก้ไขข้อมูลผู้รับบริการ',
            });
            if (_hisErr) console.error('[navasri] room_history insert fail:', _hisErr.message);
          }
        } catch(e) { console.error('[navasri] room_history exception:', e); }
      }
    }
  }
  logAudit(AUDIT_MODULES.PATIENT,
    editId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
    editId || 'new', { name: data.name || data.first_name });
  closeModal('modal-addPatient');
  renderPatients();
  // [Bug fix] re-render หน้า profile ถ้ากำลังเปิดอยู่ — เพื่อให้ badge สถานะ + ข้อมูลอื่น update ทันที (ไม่ต้อง F5)
  if (editId && typeof openPatientProfile === 'function') {
    await openPatientProfile(editId);
  }
}

// ===== ALLERGY CRUD =====
function openAddAllergyModal(patId) {
  document.getElementById('allergy-pat-id').value = patId;
  document.getElementById('allergy-pat-id').dataset.editId = '';  // clear edit mode
  document.getElementById('allergy-allergen').value = '';
  document.getElementById('allergy-type').value = 'ยา';
  document.getElementById('allergy-severity').value = '';
  document.getElementById('allergy-reaction').value = '';
  document.getElementById('allergy-note').value = '';
  var titleEl = document.getElementById('allergy-modal-title');
  if (titleEl) titleEl.textContent = '🚨 เพิ่มประวัติการแพ้ยา / อาหาร';
  openModal('modal-add-allergy');
}
async function saveAllergy() {
  const patId   = document.getElementById('allergy-pat-id').value;
  const allergen= document.getElementById('allergy-allergen').value.trim();
  if (!allergen) { toast('กรุณาระบุสิ่งที่แพ้', 'warning'); return; }
  const data = {
    patient_id: patId,
    allergen,
    allergy_type: document.getElementById('allergy-type').value,
    severity:    document.getElementById('allergy-severity').value,
    reaction:    document.getElementById('allergy-reaction').value.trim(),
    note:        document.getElementById('allergy-note').value.trim(),
  };
  const editAllergyId = document.getElementById('allergy-pat-id').dataset.editId || '';
  document.getElementById('allergy-pat-id').dataset.editId = '';
  let ins, error;
  if (editAllergyId) {
    ({data: ins, error} = await supa.from('patient_allergies').update(data).eq('id', editAllergyId).select().single());
  } else {
    ({data: ins, error} = await supa.from('patient_allergies').insert(data).select().single());
  }
  if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  const patient = db.patients.find(p => p.id == patId);
  const cacheData = { id: ins.id, allergen, allergyType: data.allergy_type, severity: data.severity, reaction: data.reaction, note: data.note };
  if (patient) {
    if (!patient.allergies) patient.allergies = [];
    if (editAllergyId) {
      // UPDATE mode: replace existing record in cache
      const idx = patient.allergies.findIndex(x => x.id == editAllergyId);
      if (idx >= 0) patient.allergies[idx] = cacheData;
      else patient.allergies.push(cacheData);
    } else {
      // INSERT mode: push new record
      patient.allergies.push(cacheData);
    }
  }
  toast(editAllergyId ? `แก้ไขประวัติแพ้ "${allergen}" เรียบร้อย` : `บันทึกประวัติแพ้ "${allergen}" เรียบร้อย`, 'success');
  closeModal('modal-add-allergy');
  openPatientProfile(patId, 'allergy');
}
async function deleteAllergy(patId, allergyId) {
  if (!(await customConfirm('ลบประวัติการแพ้นี้?'))) return;
  const { error } = await supa.from('patient_allergies').delete().eq('id', allergyId);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  const patient = db.patients.find(p => p.id == patId);
  if (patient) patient.allergies = (patient.allergies||[]).filter(a => a.id != allergyId);
  toast('ลบเรียบร้อย');
  openPatientProfile(patId, 'allergy');
}

// ===== CONTACT CRUD =====

async function openEditContactModal(patId, contactId) {
  const patient = db.patients.find(p => p.id == patId);
  if (!patient) { toast('ไม่พบข้อมูลผู้รับบริการ — กรุณา refresh แล้วลองใหม่', 'error'); return; }
  const c = (patient.contacts||[]).find(c => c.id == contactId);
  if (!c) { toast('ไม่พบผู้ติดต่อที่ต้องการแก้ไข — กรุณา refresh แล้วลองใหม่', 'error'); return; }
  // [BUG FIX 18 พ.ค. 2569] เปลี่ยน title modal เป็น 'แก้ไขผู้ติดต่อ'
  const _ttl = document.getElementById('modal-add-contact-title');
  if (_ttl) _ttl.textContent = '✏️ แก้ไขผู้ติดต่อ / ผู้รับผิดชอบ';
  document.getElementById('contact-pat-id').value = patId;
  document.getElementById('contact-pat-id').dataset.editId = contactId;
  document.getElementById('contact-name').value = c.name || '';
  document.getElementById('contact-relation').value = c.relation || '';
  document.getElementById('contact-role').value = c.role || 'ญาติ';
  document.getElementById('contact-phone').value = c.phone || '';
  document.getElementById('contact-email').value = c.email || '';
  document.getElementById('contact-is-payer').checked = c.isPayer || false;
  document.getElementById('contact-is-dm').checked = c.isDecisionMaker || false;
  document.getElementById('contact-note').value = c.note || '';
  openModal('modal-add-contact');
}

function openAddContactModal(patId) {
  document.getElementById('contact-pat-id').value = patId;
  document.getElementById('contact-pat-id').dataset.editId = '';  // [BUG FIX 18 พ.ค. 2569] clear edit id กันค้าง
  // [BUG FIX 18 พ.ค. 2569] reset title เป็น 'เพิ่มผู้ติดต่อ' (เพราะ openEditContactModal เปลี่ยนเป็น 'แก้ไข')
  const _ttl = document.getElementById('modal-add-contact-title');
  if (_ttl) _ttl.textContent = '👥 เพิ่มผู้ติดต่อ / ผู้รับผิดชอบ';
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-relation').value = '';
  document.getElementById('contact-role').value = 'ญาติ';
  document.getElementById('contact-phone').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-is-payer').checked = false;
  document.getElementById('contact-is-dm').checked = false;
  document.getElementById('contact-note').value = '';
  openModal('modal-add-contact');
}
async function saveContact() {
  const patId  = document.getElementById('contact-pat-id').value;
  const editId = document.getElementById('contact-pat-id').dataset.editId || '';
  const name   = document.getElementById('contact-name').value.trim();
  const phone  = document.getElementById('contact-phone').value.trim();
  if (!name)  { toast('กรุณาระบุชื่อ', 'warning'); return; }
  if (!phone) { toast('กรุณาระบุเบอร์โทร', 'warning'); return; }
  const data = {
    patient_id: patId, name, phone,
    relation:   document.getElementById('contact-relation').value.trim(),
    role:       document.getElementById('contact-role').value,
    email:      document.getElementById('contact-email').value.trim(),
    is_payer:   document.getElementById('contact-is-payer').checked,
    is_decision_maker: document.getElementById('contact-is-dm').checked,
    note:       document.getElementById('contact-note').value.trim(),
  };
  let ins, error;
  if (editId) {
    ({ data: ins, error } = await supa.from('patient_contacts').update(data).eq('id', editId).select().single());
  } else {
    ({ data: ins, error } = await supa.from('patient_contacts').insert(data).select().single());
  }
  if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  document.getElementById('contact-pat-id').dataset.editId = '';
  const patient = db.patients.find(p => p.id == patId);
  if (patient) {
    if (!patient.contacts) patient.contacts = [];
    if (editId) {
      const idx = patient.contacts.findIndex(c => c.id == editId);
      const updated = { id: ins.id, name, phone, relation: data.relation, role: data.role,
        email: data.email, isPayer: data.is_payer, isDecisionMaker: data.is_decision_maker, note: data.note };
      if (idx >= 0) patient.contacts[idx] = updated;
    } else {
      patient.contacts.push({ id: ins.id, name, phone, relation: data.relation, role: data.role,
        email: data.email, isPayer: data.is_payer, isDecisionMaker: data.is_decision_maker, note: data.note });
    }
  }
  toast(editId ? `แก้ไขผู้ติดต่อ "${name}" เรียบร้อย` : `เพิ่มผู้ติดต่อ "${name}" เรียบร้อย`, 'success');
  closeModal('modal-add-contact');
  openPatientProfile(patId, 'contacts');
}
async function deleteContact(patId, contactId) {
  if (!(await customConfirm('ลบผู้ติดต่อนี้?'))) return;
  const { error } = await supa.from('patient_contacts').delete().eq('id', contactId);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  const patient = db.patients.find(p => p.id == patId);
  if (patient) patient.contacts = (patient.contacts||[]).filter(c => c.id != contactId);
  toast('ลบเรียบร้อย');
  openPatientProfile(patId, 'contacts');
}

function exportPatientsExcel() {
  const rows = [
    ['#', 'ชื่อ-นามสกุล', 'ประเภทบัตร', 'เลขบัตร', 'วันเกิด', 'วันรับบริการ', 'วันสิ้นสุด', 'สถานะ', 'โทรศัพท์', 'ผู้ติดต่อฉุกเฉิน', 'ที่อยู่', 'หมายเหตุ']
  ];
  db.patients.forEach((p, i) => {
    const statusLabel = p.status === 'active' ? 'พักอยู่' : p.status === 'hospital' ? 'อยู่โรงพยาบาล' : 'ออกแล้ว';
    rows.push([
      i+1, p.name || '', p.idType || '', p.idcard || '',
      p.dob || '', p.admitDate || '', p.endDate || '',
      statusLabel, p.phone || '', p.emergency || '',
      p.address || '', p.note || ''
    ]);
  });
  _xlsxDownload(rows, 'ผู้รับบริการ', 'navasri_patients_' + new Date().toISOString().slice(0,10));
}

// ═══════════════════════════════════════════════════════════════════
// [Step B-2a · 20 พ.ค. 69] Handover UI — patient list bulk action bar
// ─────────────────────────────────────────────────────────────────
// B-2a = UI skeleton only (action bar + checkbox column + handlers)
// B-2b = load status + state management + smart button enable/disable
// B-2c = badge "รออนุมัติ" + ปุ่ม inline สำหรับ admin
// B-3 = modal "ปิดเวร"
// B-4 = modal "รับเวร" (พร้อม preview summary)
// ═══════════════════════════════════════════════════════════════════

// State (per-session)
window._patHandoverSelected = window._patHandoverSelected || {};  // { patient_id: true }

// Check permission — caregiver/officer/admin/manager/nurse/PT เห็น bulk bar
function _patHandoverCanOperate() {
  return typeof hasRole === 'function' && hasRole(
    'admin', 'manager', 'officer', 'nurse', 'parttime_nurse', 'physical_therapist', 'caregiver'
  );
}

// Check permission — admin/manager/nurse/PT-nurse เห็น ⋮ menu
function _patHandoverCanAdmin() {
  return typeof hasRole === 'function' && hasRole('admin', 'manager', 'nurse', 'parttime_nurse');
}

// Show/hide bulk bar + checkbox columns ตาม permission
// เรียกครั้งเดียวหลัง role พร้อม (เช่น login เสร็จ + page เปิด)
function patHandoverInitUI() {
  const bar = document.getElementById('patHandoverBar');
  if (!bar) return;
  if (_patHandoverCanOperate()) {
    bar.style.display = 'flex';
    // Show checkbox column header + cells
    document.querySelectorAll('.ph-col-check').forEach(el => { el.style.display = ''; });
    document.querySelectorAll('.ph-col-shift').forEach(el => { el.style.display = ''; });
    // Show admin menu wrap ถ้าเป็น admin
    if (_patHandoverCanAdmin()) {
      const adminWrap = document.getElementById('patHandoverAdminWrap');
      if (adminWrap) adminWrap.style.display = 'block';
    }
    _patHandoverUpdateShiftLabel();
    // [Step B-2b] Render badges จาก cached map ก่อน (ถ้ามี) แล้วโหลดใหม่ background
    if (Object.keys(window._patHandoverStatusMap || {}).length > 0) {
      _patHandoverRenderStatusBadges();
      _patHandoverUpdateCheckboxes();
      _patHandoverUpdateCounter();
    }
    // Load fresh status async (ไม่ block UI)
    _patHandoverLoadAllStatus();
  }
}

// [Step B-2b · 20 พ.ค. 69] Detect current shift (date + shift name)
function _patHandoverDetectShift() {
  const now = new Date();
  const hour = now.getHours();
  const shift = (hour >= 7 && hour < 19) ? 'เช้า' : 'ดึก';
  // shift_date: ถ้าเป็นกะดึกหลังเที่ยงคืน (00:00-06:59) → ยังนับเป็นวันก่อนหน้า
  const d = new Date(now);
  if (shift === 'ดึก' && hour < 7) d.setDate(d.getDate() - 1);
  const sd = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return { date: sd, shift: shift, displayDate: d.getDate() + '/' + (d.getMonth()+1) };
}

// Update label "กะ xxx"
function _patHandoverUpdateShiftLabel() {
  const el = document.getElementById('patHandoverShift');
  if (!el) return;
  const cur = _patHandoverDetectShift();
  el.textContent = '· กะ' + cur.shift + ' ' + cur.displayDate;
}

// [Step B-2b · 20 พ.ค. 69] Status state per session — { patient_id: { status, record } }
window._patHandoverStatusMap = window._patHandoverStatusMap || {};
window._patHandoverHasVitalMap = window._patHandoverHasVitalMap || {};

// ── Load สถานะเวรของทุก patient ใน 1 query ──
async function _patHandoverLoadAllStatus() {
  if (!_patHandoverCanOperate()) return;
  if (typeof supa === 'undefined') return;

  const cur = _patHandoverDetectShift();
  const patientIds = (db.patients || [])
    .filter(p => p.status === 'active' || p.status === 'hospital')
    .map(p => p.id);
  if (patientIds.length === 0) return;

  try {
    // Single batch query — fetch summaries for current (shift_date, shift)
    const res = await supa
      .from('patient_shift_summaries')
      .select('id, patient_id, summary_text, is_closed, closed_by, closed_at, received_by, received_at, reopen_requested, reopen_requested_by, reopen_requested_at, reopen_reason, was_reopened')
      .in('patient_id', patientIds)
      .eq('shift_date', cur.date)
      .eq('shift', cur.shift);

    const map = {};
    (res.data || []).forEach(r => {
      let status = 'draft';
      if (r.received_by) status = 'received';
      else if (r.is_closed) status = 'sent';
      else if (r.reopen_requested) status = 'reopen_pending';
      map[String(r.patient_id)] = { status: status, record: r };
    });

    // Patients ที่ไม่มี record = no_data
    patientIds.forEach(pid => {
      if (!map[String(pid)]) map[String(pid)] = { status: 'no_data', record: null };
    });

    window._patHandoverStatusMap = map;
  } catch (e) {
    console.warn('[handover] load all status error', e);
  }

  // Load vital sign existence (parallel ไป เพราะไม่ค่อย critical)
  await _patHandoverLoadVitalExistence(cur, patientIds);

  // Update UI
  _patHandoverRenderStatusBadges();
  _patHandoverUpdateCheckboxes();
  _patHandoverUpdateCounter();
}

// ── Check ว่า patients ไหนมี vital ในกะนี้ (เพื่อแสดง ⚠️ ไม่มี vital) ──
async function _patHandoverLoadVitalExistence(cur, patientIds) {
  if (!cur || !patientIds || patientIds.length === 0) return;
  if (typeof supa === 'undefined') return;
  try {
    // Build time range สำหรับกะ
    const startHour = (cur.shift === 'เช้า') ? '07:00:00' : '19:00:00';
    let endShiftDate = cur.date;
    const endHour = (cur.shift === 'เช้า') ? '19:00:00' : '07:00:00';
    if (cur.shift === 'ดึก') {
      const d = new Date(cur.date);
      d.setDate(d.getDate() + 1);
      endShiftDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    const startTs = new Date(cur.date + 'T' + startHour).toISOString();
    const endTs = new Date(endShiftDate + 'T' + endHour).toISOString();

    // Fetch distinct patient_id ที่มี vital ในกะนี้
    const res = await supa
      .from('vital_signs')
      .select('patient_id')
      .in('patient_id', patientIds)
      .gte('recorded_at', startTs)
      .lte('recorded_at', endTs)
      .limit(1000);
    const hasMap = {};
    (res.data || []).forEach(r => { hasMap[String(r.patient_id)] = true; });
    window._patHandoverHasVitalMap = hasMap;
  } catch (e) {
    console.warn('[handover] load vital existence error', e);
  }
}

// ── Render status badge ในแต่ละแถว ──
function _patHandoverRenderStatusBadges() {
  const statusMap = window._patHandoverStatusMap || {};
  const hasVitalMap = window._patHandoverHasVitalMap || {};

  document.querySelectorAll('.ph-col-shift').forEach(td => {
    // Skip th (no patient_id)
    if (td.tagName !== 'TD') return;
    const pid = td.dataset.patientId;
    if (!pid) return;
    const info = statusMap[String(pid)];
    if (!info) {
      td.innerHTML = '<span style="font-size:11px;color:var(--text3);">—</span>';
      return;
    }
    td.innerHTML = _patHandoverStatusBadgeHTML(info, hasVitalMap[String(pid)]);
  });
}

// ── Generate HTML สำหรับ badge สถานะ ──
function _patHandoverStatusBadgeHTML(info, hasVital) {
  const st = info.status;
  const rec = info.record;
  let txt = '', style = '';

  if (st === 'received') {
    const by = (rec && rec.received_by) ? rec.received_by : '—';
    const at = (rec && rec.received_at) ? new Date(rec.received_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}) : '';
    txt = '🤝 รับแล้ว · ' + by + (at ? ' · ' + at : '');
    style = 'background:#1f4d38;color:#fff;';
  } else if (st === 'reopen_pending') {
    // [Step B-2c · 20 พ.ค. 69] Badge + ปุ่ม inline สำหรับ admin
    const by = (rec && rec.reopen_requested_by) ? rec.reopen_requested_by : '—';
    let html = '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;display:inline-block;background:#fff;color:#854F0B;border:1px solid #854F0B;">⏳ รออนุมัติ · ' + _patHandoverEscape(by) + '</span>';
    // ถ้าเป็น admin/พยาบาล → เพิ่มปุ่ม inline ทันที
    if (_patHandoverCanAdmin() && rec && rec.id) {
      const sumId = rec.id;
      html += ' <button class="btn btn-sm" onclick="patHandoverApproveReopen(' + sumId + ')" style="font-size:10px;padding:2px 6px;margin-left:4px;background:#0F6E56;color:#fff;border:none;border-radius:4px;cursor:pointer;" title="อนุมัติคำขอ">✅</button>';
      html += '<button class="btn btn-sm" onclick="patHandoverDenyReopen(' + sumId + ')" style="font-size:10px;padding:2px 6px;margin-left:2px;background:#A32D2D;color:#fff;border:none;border-radius:4px;cursor:pointer;" title="ปฏิเสธคำขอ">❌</button>';
    }
    return html;
  } else if (st === 'sent') {
    // [Step B-7 · 20 พ.ค. 69] Badge "ส่งแล้ว" + ปุ่ม "📨 ขอเปิดเวร" สำหรับ caregiver
    const by = (rec && rec.closed_by) ? rec.closed_by : '—';
    const at = (rec && rec.closed_at) ? new Date(rec.closed_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}) : '';
    let html = '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;display:inline-block;background:#0F6E56;color:#fff;">🔒 ส่งแล้ว · ' + _patHandoverEscape(by) + (at ? ' · ' + at : '') + '</span>';
    // ถ้าเป็น caregiver ที่ไม่ใช่ admin/nurse → เพิ่มปุ่ม "📨 ขอเปิดเวร"
    // (admin/nurse กดเปิดเวรแทนได้เลยผ่าน ⋮ menu ใน action bar)
    if (rec && rec.id && _patHandoverCanOperate() && !_patHandoverCanAdmin()) {
      html += ' <button class="btn btn-sm" onclick="patHandoverRequestReopen(' + rec.id + ')" style="font-size:10px;padding:2px 6px;margin-left:4px;background:#fff;color:#BA7517;border:1px solid #BA7517;border-radius:4px;cursor:pointer;" title="ขอเปิดเวรเพื่อแก้ไข summary">📨 ขอเปิดเวร</button>';
    }
    return html;
  } else if (st === 'draft') {
    txt = '📝 มี summary';
    style = 'background:#E1F5EE;color:#0F6E56;';
  } else if (hasVital === true) {
    txt = '⚪ ยังไม่ส่ง';
    style = 'background:#E6F1FB;color:#185FA5;';
  } else {
    txt = '⚠️ ไม่มี vital';
    style = 'background:#FAEEDA;color:#854F0B;';
  }
  return '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;display:inline-block;' + style + '">' + txt + '</span>';
}

// ── Helper: escape HTML for safe display ──
function _patHandoverEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Update checkbox state — disable คนที่ติ๊กไม่ได้ ──
function _patHandoverUpdateCheckboxes() {
  const statusMap = window._patHandoverStatusMap || {};
  document.querySelectorAll('.patient-handover-cb').forEach(cb => {
    const pid = cb.dataset.patientId;
    const info = statusMap[String(pid)];
    if (!info) {
      cb.disabled = false;
      cb.title = '';
      return;
    }
    const st = info.status;
    // Received = disable (เสร็จแล้ว), reopen_pending = disable (รออนุมัติ)
    if (st === 'received' || st === 'reopen_pending') {
      cb.disabled = true;
      cb.title = (st === 'received') ? 'รับเวรแล้ว' : 'รออนุมัติเปิดเวร';
      if (cb.checked) { cb.checked = false; delete window._patHandoverSelected[pid]; }
      return;
    }
    cb.disabled = false;
    cb.title = '';
  });
}

// ── Smart enable/disable buttons ตาม mix ของ status ที่เลือก ──
function _patHandoverUpdateCounter() {
  const counter = document.getElementById('patHandoverCount');
  if (!counter) return;
  const sel = window._patHandoverSelected || {};
  const ids = Object.keys(sel);
  counter.textContent = 'เลือกแล้ว ' + ids.length + ' คน';

  const closeBtn = document.getElementById('patHandoverCloseBtn');
  const receiveBtn = document.getElementById('patHandoverReceiveBtn');
  if (!closeBtn || !receiveBtn) return;

  if (ids.length === 0) {
    closeBtn.disabled = true;
    receiveBtn.disabled = true;
    closeBtn.textContent = '📤 ปิดเวรที่เลือก';
    receiveBtn.textContent = '✓ รับเวรที่เลือก';
    return;
  }

  // Categorize ที่เลือกแล้ว
  const statusMap = window._patHandoverStatusMap || {};
  let canClose = 0;   // no_data / draft
  let canReceive = 0; // sent
  let other = 0;       // received / pending
  ids.forEach(pid => {
    const info = statusMap[String(pid)];
    if (!info) { canClose++; return; }
    const st = info.status;
    if (st === 'no_data' || st === 'draft') canClose++;
    else if (st === 'sent') canReceive++;
    else other++;
  });

  closeBtn.disabled = (canClose === 0);
  receiveBtn.disabled = (canReceive === 0);
  closeBtn.textContent = canClose > 0 ? ('📤 ปิดเวรที่เลือก (' + canClose + ')') : '📤 ปิดเวรที่เลือก';
  receiveBtn.textContent = canReceive > 0 ? ('✓ รับเวรที่เลือก (' + canReceive + ')') : '✓ รับเวรที่เลือก';
}

// ── Checkbox handlers ──
function patHandoverToggleRow(checkbox) {
  const pid = checkbox.dataset.patientId;
  if (!pid) return;
  if (checkbox.checked) {
    window._patHandoverSelected[pid] = true;
  } else {
    delete window._patHandoverSelected[pid];
  }
  _patHandoverUpdateCounter();
}

function patHandoverToggleAll(checkbox) {
  const checked = checkbox.checked;
  document.querySelectorAll('.patient-handover-cb').forEach(cb => {
    if (cb.disabled) return;
    if (cb.checked !== checked) {
      cb.checked = checked;
      patHandoverToggleRow(cb);
    }
  });
}

function patHandoverSelectPinned() {
  const pinnedSet = new Set((window._pinnedPatients || []).map(String));
  if (pinnedSet.size === 0) {
    if (typeof toast === 'function') toast('ยังไม่ได้ปักหมุดผู้รับบริการ', 'info');
    return;
  }
  let changed = 0;
  document.querySelectorAll('.patient-handover-cb').forEach(cb => {
    const pid = cb.dataset.patientId;
    if (!pinnedSet.has(String(pid))) return;
    if (cb.disabled) return;
    if (!cb.checked) {
      cb.checked = true;
      patHandoverToggleRow(cb);
      changed++;
    }
  });
  if (changed === 0 && typeof toast === 'function') toast('ผู้ที่ปักหมุดถูกเลือกครบแล้ว', 'info');
}

function patHandoverClearSelection() {
  window._patHandoverSelected = {};
  document.querySelectorAll('.patient-handover-cb').forEach(cb => {
    if (cb.checked) cb.checked = false;
  });
  const selectAll = document.getElementById('patHandoverSelectAll');
  if (selectAll) selectAll.checked = false;
  _patHandoverUpdateCounter();
}

// ═══════════════════════════════════════════════════════════════════
// [Step B-3 · 20 พ.ค. 69] Modal "ปิดเวรที่เลือก"
// ═══════════════════════════════════════════════════════════════════

// Generate auto-summary text สำหรับ patient 1 คน — เรียก clinical-vitals helpers
async function _patHandoverGenerateAutoText(patientId, cur) {
  // ถ้า clinical-vitals helpers ไม่พร้อม → fallback text
  if (typeof window._ssGroupByShift !== 'function' || typeof window._ssGenerateText !== 'function') {
    return '[Auto-generated] สรุปเวร' + cur.shift + ' ' + _patHandoverFormatDate(cur.date);
  }
  if (typeof supa === 'undefined') {
    return '[Auto-generated] สรุปเวร' + cur.shift + ' ' + _patHandoverFormatDate(cur.date);
  }

  try {
    // Build time range ของกะ
    const startHour = (cur.shift === 'เช้า') ? '07:00:00' : '19:00:00';
    let endShiftDate = cur.date;
    const endHour = (cur.shift === 'เช้า') ? '19:00:00' : '07:00:00';
    if (cur.shift === 'ดึก') {
      const d = new Date(cur.date);
      d.setDate(d.getDate() + 1);
      endShiftDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    const startTs = new Date(cur.date + 'T' + startHour).toISOString();
    const endTs = new Date(endShiftDate + 'T' + endHour).toISOString();

    // Load 6 data sources (เหมือนใน clinical-vitals._ssRenderSection)
    const [vRes, exRes, flRes, apRes, inRes, nnRes] = await Promise.all([
      supa.from('vital_signs').select('*').eq('patient_id', patientId).gte('recorded_at', startTs).lte('recorded_at', endTs).order('recorded_at', { ascending: false }),
      supa.from('patient_excretions').select('*').eq('patient_id', patientId).gte('recorded_at', startTs).lte('recorded_at', endTs).order('recorded_at', { ascending: false }),
      supa.from('patient_fluid_records').select('*').eq('patient_id', patientId).gte('recorded_at', startTs).lte('recorded_at', endTs).order('recorded_at', { ascending: false }),
      supa.from('patient_appointments').select('*').eq('patient_id', patientId).eq('appt_date', cur.date).order('appt_time', { ascending: true }),
      supa.from('incident_reports').select('*').eq('patient_id', patientId).gte('created_at', startTs).lte('created_at', endTs).order('created_at', { ascending: false }),
      supa.from('nursing_notes').select('*').eq('patient_id', patientId).eq('date', cur.date).eq('shift', cur.shift)
    ]);

    const vitals = (vRes && !vRes.error) ? (vRes.data || []) : [];
    const excretions = (exRes && !exRes.error) ? (exRes.data || []) : [];
    const fluids = (flRes && !flRes.error) ? (flRes.data || []) : [];
    const appointments = (apRes && !apRes.error) ? (apRes.data || []) : [];
    const incidents = (inRes && !inRes.error) ? (inRes.data || []) : [];
    const nursingNotes = (nnRes && !nnRes.error) ? (nnRes.data || []) : [];

    // Group → ดึง bucket ของกะปัจจุบัน → generate text
    const buckets = window._ssGroupByShift(vitals, excretions, fluids, appointments, incidents, nursingNotes, cur.date, cur.date);
    const key = (typeof window._ssKey === 'function') ? window._ssKey(cur.date, cur.shift) : (cur.date + '|' + cur.shift);
    const bucket = buckets[key];
    if (!bucket) return '⚠️ ไม่มีข้อมูลในกะ' + cur.shift + ' ' + _patHandoverFormatDate(cur.date) + ' — กรุณาเพิ่ม note ก่อนปิดเวร หรือยืนยันว่าผู้รับบริการอาการปกติ';
    return window._ssGenerateText(bucket);
  } catch (e) {
    console.warn('[handover] auto-gen text error', e);
    return '[Auto-generated] สรุปเวร' + cur.shift + ' ' + _patHandoverFormatDate(cur.date);
  }
}

// Format date YYYY-MM-DD → DD/MM/YY (Buddhist year short)
function _patHandoverFormatDate(ymd) {
  if (!ymd) return '';
  const p = ymd.split('-');
  if (p.length !== 3) return ymd;
  const buddhistYear = (parseInt(p[0], 10) + 543).toString().slice(-2);
  return p[2] + '/' + p[1] + '/' + buddhistYear;
}

// Open modal — สร้าง DOM แบบ dynamic
async function _patHandoverOpenCloseModal(patientIds) {
  const cur = _patHandoverDetectShift();
  const statusMap = window._patHandoverStatusMap || {};

  // Build patient info + initial summary text
  const items = patientIds.map(pid => {
    const p = (db.patients || []).find(p => String(p.id) === String(pid));
    const info = statusMap[String(pid)];
    return {
      patient: p,
      patientId: pid,
      status: info ? info.status : 'no_data',
      existingText: (info && info.record && info.record.summary_text) ? info.record.summary_text : '',
      summaryText: '' // จะ fill หลังโหลด auto-gen
    };
  }).filter(it => it.patient);

  if (items.length === 0) return;

  // ── Build overlay + modal ──
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:flex-start;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;overflow-y:auto;padding:30px 16px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:0;width:720px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;';

  // Header
  let headerHTML =
    '<div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
    '  <div>' +
    '    <div style="font-size:17px;font-weight:700;color:var(--accent2);">📤 ปิดเวรของผู้รับบริการ ' + items.length + ' คน</div>' +
    '    <div style="font-size:12px;color:var(--text2);margin-top:2px;">เวร' + cur.shift + ' ' + _patHandoverFormatDate(cur.date) + '</div>' +
    '  </div>' +
    '  <button id="pat-close-modal-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);padding:0 6px;line-height:1;">✕</button>' +
    '</div>' +
    '<div style="background:var(--warning-bg, #fff3d4);border-left:4px solid var(--warning-text, #b88240);padding:10px 14px;margin:0;font-size:12px;color:#8a4d00;line-height:1.5;">' +
    '⚠️ หลังกดยืนยัน — summary จะถูก lock <br>caregiver ต้องขออนุมัติเพื่อแก้ไขภายหลัง' +
    '</div>';

  // Body — list ของแต่ละคน
  let bodyHTML = '<div id="pat-close-modal-body" style="padding:14px 22px;overflow-y:auto;flex:1;">';
  items.forEach((item, idx) => {
    const p = item.patient;
    const room = p.roomNumber || p.room || '—';
    const sumId = 'pat-close-sum-' + item.patientId;
    let statusBadge = '';
    if (item.status === 'draft') statusBadge = '<span style="font-size:10px;background:#E1F5EE;color:#0F6E56;padding:2px 6px;border-radius:8px;">📝 มี summary เดิม</span>';
    else statusBadge = '<span style="font-size:10px;background:#E6F1FB;color:#185FA5;padding:2px 6px;border-radius:8px;">⚪ เริ่มใหม่</span>';

    bodyHTML +=
      '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#fff;">' +
      '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;">' +
      '    <div style="font-size:14px;font-weight:600;color:var(--text);">' +
      '      ' + (idx+1) + '. ' + _patHandoverEscape(p.name || '-') +
      '      <span style="font-size:11px;color:var(--text3);font-weight:400;">· ห้อง ' + _patHandoverEscape(room) + '</span>' +
      '    </div>' +
      '    ' + statusBadge +
      '  </div>' +
      '  <textarea id="' + sumId + '" style="width:100%;min-height:100px;padding:8px 10px;font-size:12px;line-height:1.55;border:1px solid var(--border);border-radius:6px;font-family:inherit;resize:vertical;background:#fff;color:var(--text);" placeholder="กำลังโหลดสรุปอัตโนมัติ..."></textarea>' +
      '</div>';
  });
  bodyHTML += '</div>';

  // Footer
  const footerHTML =
    '<div id="pat-close-modal-progress" style="display:none;padding:10px 22px;background:#f5f3ee;border-top:1px solid var(--border);font-size:12px;color:var(--text2);"></div>' +
    '<div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
    '  <button id="pat-close-cancel" class="btn btn-ghost" style="font-size:13px;padding:10px 20px;">❌ ยกเลิก</button>' +
    '  <button id="pat-close-confirm" class="btn btn-primary" disabled style="font-size:13px;padding:10px 22px;background:#1f4d38;border-color:#1f4d38;color:#fff;font-weight:600;">⏳ กรุณารอ 2 วินาที</button>' +
    '</div>';

  modal.innerHTML = headerHTML + bodyHTML + footerHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  modal.querySelector('#pat-close-modal-x').addEventListener('click', close);
  modal.querySelector('#pat-close-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });

  // ── Load auto-gen text (parallel) ──
  await Promise.all(items.map(async (item) => {
    let text = item.existingText;
    if (!text) text = await _patHandoverGenerateAutoText(item.patientId, cur);
    item.summaryText = text;
    const ta = modal.querySelector('#pat-close-sum-' + item.patientId);
    if (ta) {
      ta.value = text;
      ta.placeholder = '';
    }
  }));

  // Enable confirm button หลัง 2 วินาที (ป้องกัน accidental click)
  setTimeout(function() {
    const btn = modal.querySelector('#pat-close-confirm');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ ยืนยันปิดเวร ' + items.length + ' คน';
    }
  }, 2000);

  // Confirm handler
  modal.querySelector('#pat-close-confirm').addEventListener('click', async function() {
    await _patHandoverSubmitCloseAll(modal, items, cur, close);
  });
}

// Submit ปิดเวรทีละคน (sequential)
async function _patHandoverSubmitCloseAll(modal, items, cur, closeFn) {
  const confirmBtn = modal.querySelector('#pat-close-confirm');
  const cancelBtn = modal.querySelector('#pat-close-cancel');
  const progressEl = modal.querySelector('#pat-close-modal-progress');
  if (!confirmBtn || !progressEl) return;

  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  progressEl.style.display = 'block';

  let success = 0, fail = 0;
  const failList = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = item.patient;
    progressEl.textContent = '⏳ กำลังปิด ' + (i+1) + '/' + items.length + ' — ' + (p.name || '-') + '...';

    // อ่าน text ปัจจุบันจาก textarea (เผื่อ user แก้)
    const ta = modal.querySelector('#pat-close-sum-' + item.patientId);
    const finalText = ta ? (ta.value || '').trim() : item.summaryText;
    if (!finalText) {
      fail++;
      failList.push((p.name || '-') + ' (summary ว่าง)');
      continue;
    }

    try {
      // Re-check status — ป้องกัน race
      const checkRes = await supa
        .from('patient_shift_summaries')
        .select('id, is_closed, received_by')
        .eq('patient_id', item.patientId)
        .eq('shift_date', cur.date)
        .eq('shift', cur.shift)
        .maybeSingle();

      if (checkRes && checkRes.data) {
        if (checkRes.data.received_by) {
          fail++;
          failList.push((p.name || '-') + ' (มีคนรับเวรไปแล้ว)');
          continue;
        }
        if (checkRes.data.is_closed) {
          fail++;
          failList.push((p.name || '-') + ' (ปิดเวรไปแล้วโดยคนอื่น)');
          continue;
        }
      }

      // Pre-load _shiftSummaryCache สำหรับ _ssCloseShift (ใช้ existing.id)
      if (typeof window._ssLoadManualSummaries === 'function') {
        await window._ssLoadManualSummaries(item.patientId);
      }

      // เรียก _ssCloseShift (ตัวจริง — handles edit log + upsert logic)
      let res;
      if (typeof window._ssCloseShift === 'function') {
        res = await window._ssCloseShift(item.patientId, cur.date, cur.shift, finalText);
      } else {
        // Fallback — direct DB call ถ้า clinical-vitals helper ไม่พร้อม
        const user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
        const payload = {
          patient_id: item.patientId,
          shift_date: cur.date,
          shift: cur.shift,
          summary_text: finalText,
          recorded_by: user,
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: user,
          reopen_requested: false,
          reopen_requested_at: null,
          reopen_requested_by: null,
          reopen_reason: null
        };
        if (checkRes && checkRes.data && checkRes.data.id) {
          res = await supa.from('patient_shift_summaries').update(payload).eq('id', checkRes.data.id).select().single();
        } else {
          res = await supa.from('patient_shift_summaries').insert(payload).select().single();
        }
      }

      if (res && res.error) {
        fail++;
        failList.push((p.name || '-') + ' (' + res.error.message + ')');
      } else {
        success++;
      }
    } catch (e) {
      fail++;
      failList.push((p.name || '-') + ' (' + (e.message || e) + ')');
    }
  }

  // Show result
  progressEl.innerHTML =
    '<div style="color:#0F6E56;font-weight:600;">✓ ปิดเวรสำเร็จ ' + success + ' คน</div>' +
    (fail > 0 ? '<div style="color:#A32D2D;margin-top:4px;">✗ ไม่สำเร็จ ' + fail + ' คน: ' + _patHandoverEscape(failList.join(', ')) + '</div>' : '');

  confirmBtn.textContent = '✓ ปิด';
  confirmBtn.disabled = false;
  cancelBtn.disabled = false;

  // Clear selected ที่ success
  if (success > 0) {
    items.forEach(item => { delete window._patHandoverSelected[item.patientId]; });
  }

  // Refresh status map → re-paint badges
  if (typeof _patHandoverLoadAllStatus === 'function') {
    await _patHandoverLoadAllStatus();
  }
  // Refresh patient list rendering (clear checkbox + update count)
  if (typeof renderPatients === 'function') {
    renderPatients();
  }

  // Auto-close หลัง 2 วินาทีถ้าทุกคนสำเร็จ
  if (fail === 0) {
    setTimeout(closeFn, 2000);
  } else {
    confirmBtn.addEventListener('click', closeFn, { once: true });
  }
}

// ═══════════════════════════════════════════════════════════════════
// [Step B-4 · 20 พ.ค. 69] Modal "รับเวรที่เลือก"
// ═══════════════════════════════════════════════════════════════════

// Open modal — สร้าง DOM แบบ dynamic + แสดง summary ของกะก่อน
async function _patHandoverOpenReceiveModal(receivableIds, skippedIds) {
  const cur = _patHandoverDetectShift();
  const statusMap = window._patHandoverStatusMap || {};

  // สำหรับ modal "รับเวร" — ต้องแสดง summary ของ "เวรก่อนหน้า"
  // แต่ status ที่เก็บใน statusMap เป็นของ "เวรปัจจุบัน" ที่ปิดแล้ว (🔒)
  // → ใช้ record ของ status sent นั้นเลย (มี closed_by + summary_text + closed_at)

  const items = receivableIds.map(pid => {
    const p = (db.patients || []).find(p => String(p.id) === String(pid));
    const info = statusMap[String(pid)];
    const rec = info ? info.record : null;
    return {
      patient: p,
      patientId: pid,
      record: rec,
      summaryText: (rec && rec.summary_text) ? rec.summary_text : '(ไม่มีสรุป)',
      closedBy: (rec && rec.closed_by) ? rec.closed_by : '—',
      closedAt: (rec && rec.closed_at) ? new Date(rec.closed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
    };
  }).filter(it => it.patient);

  if (items.length === 0) return;

  // คำนวณกะก่อนหน้า (display)
  const prevShift = (cur.shift === 'เช้า') ? 'ดึก' : 'เช้า';

  // ── Build overlay + modal ──
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:flex-start;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;overflow-y:auto;padding:30px 16px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:0;width:720px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;';

  // Header
  let headerHTML =
    '<div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
    '  <div>' +
    '    <div style="font-size:17px;font-weight:700;color:#185fa5;">✓ รับเวรของผู้รับบริการ ' + items.length + ' คน</div>' +
    '    <div style="font-size:12px;color:var(--text2);margin-top:2px;">รับจากกะก่อน → เวร' + cur.shift + ' ' + _patHandoverFormatDate(cur.date) + '</div>' +
    '  </div>' +
    '  <button id="pat-recv-modal-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);padding:0 6px;line-height:1;">✕</button>' +
    '</div>' +
    '<div style="background:#E6F1FB;border-left:4px solid #185fa5;padding:10px 14px;margin:0;font-size:12px;color:#0C447C;line-height:1.5;">' +
    'ℹ️ กรุณาอ่าน summary ของกะก่อนหน้า ก่อนกดยืนยัน<br>' +
    'หลังกดรับ — คุณจะเป็นผู้รับผิดชอบในกะ' + cur.shift + 'นี้แทน' +
    '</div>';

  // ถ้ามี skipped → แสดง warning
  if (skippedIds && skippedIds.length > 0) {
    const skippedNames = skippedIds.map(pid => {
      const p = (db.patients || []).find(p => String(p.id) === String(pid));
      const info = statusMap[String(pid)];
      let reason = '';
      if (info) {
        if (info.status === 'no_data') reason = ' (ยังไม่ปิดเวร)';
        else if (info.status === 'draft') reason = ' (มี summary แต่ยังไม่ปิด)';
        else if (info.status === 'received') reason = ' (รับแล้ว)';
        else if (info.status === 'reopen_pending') reason = ' (รออนุมัติ)';
      }
      return (p ? p.name : '#' + pid) + reason;
    });
    headerHTML +=
      '<div style="background:#FAEEDA;border-left:4px solid #854F0B;padding:10px 14px;margin:0;font-size:11px;color:#854F0B;line-height:1.5;">' +
      '⚠️ ผู้รับบริการ ' + skippedIds.length + ' คนถูกข้าม: ' + _patHandoverEscape(skippedNames.join(', ')) +
      '</div>';
  }

  // Body — list ของแต่ละคน (อ่านอย่างเดียว)
  let bodyHTML = '<div id="pat-recv-modal-body" style="padding:14px 22px;overflow-y:auto;flex:1;">';
  items.forEach((item, idx) => {
    const p = item.patient;
    const room = p.roomNumber || p.room || '—';

    bodyHTML +=
      '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#fff;">' +
      '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px;">' +
      '    <div style="font-size:14px;font-weight:600;color:var(--text);">' +
      '      ' + (idx+1) + '. ' + _patHandoverEscape(p.name || '-') +
      '      <span style="font-size:11px;color:var(--text3);font-weight:400;">· ห้อง ' + _patHandoverEscape(room) + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">' +
      '    🔒 ปิดเวรโดย: <strong>' + _patHandoverEscape(item.closedBy) + '</strong>' +
      (item.closedAt ? ' · เวลา ' + _patHandoverEscape(item.closedAt) : '') +
      '  </div>' +
      '  <div style="background:#f5f3ee;border-radius:6px;padding:10px 12px;font-size:12px;line-height:1.6;color:var(--text);white-space:pre-wrap;">' +
      _patHandoverEscape(item.summaryText) +
      '  </div>' +
      '</div>';
  });
  bodyHTML += '</div>';

  // Acknowledge checkbox + Footer
  const ackHTML =
    '<div style="padding:12px 22px;border-top:1px solid var(--border);background:#fafaf7;">' +
    '  <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13px;line-height:1.5;color:var(--text);">' +
    '    <input type="checkbox" id="pat-recv-ack" style="margin-top:2px;cursor:pointer;width:18px;height:18px;flex-shrink:0;">' +
    '    <span>ฉันได้อ่านและรับทราบข้อมูลของผู้รับบริการทั้ง ' + items.length + ' คนข้างต้นแล้ว</span>' +
    '  </label>' +
    '</div>';

  const footerHTML =
    '<div id="pat-recv-modal-progress" style="display:none;padding:10px 22px;background:#f5f3ee;border-top:1px solid var(--border);font-size:12px;color:var(--text2);"></div>' +
    '<div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
    '  <button id="pat-recv-cancel" class="btn btn-ghost" style="font-size:13px;padding:10px 20px;">❌ ยกเลิก</button>' +
    '  <button id="pat-recv-confirm" class="btn btn-primary" disabled style="font-size:13px;padding:10px 22px;background:#185fa5;border-color:#185fa5;color:#fff;font-weight:600;">⏳ กรุณาอ่านและติ๊ก checkbox</button>' +
    '</div>';

  modal.innerHTML = headerHTML + bodyHTML + ackHTML + footerHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  modal.querySelector('#pat-recv-modal-x').addEventListener('click', close);
  modal.querySelector('#pat-recv-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });

  // Acknowledge checkbox — เริ่ม 2-วินาที delay หลังติ๊ก
  const ackCb = modal.querySelector('#pat-recv-ack');
  const confirmBtn = modal.querySelector('#pat-recv-confirm');
  let delayTimer = null;
  ackCb.addEventListener('change', function() {
    if (ackCb.checked) {
      confirmBtn.textContent = '⏳ กรุณารอ 2 วินาที';
      if (delayTimer) clearTimeout(delayTimer);
      delayTimer = setTimeout(function() {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✅ ยืนยันรับเวร ' + items.length + ' คน';
      }, 2000);
    } else {
      if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ กรุณาอ่านและติ๊ก checkbox';
    }
  });

  // Confirm handler
  confirmBtn.addEventListener('click', async function() {
    await _patHandoverSubmitReceiveAll(modal, items, cur, close);
  });
}

// Submit รับเวรทีละคน (sequential + race protection)
async function _patHandoverSubmitReceiveAll(modal, items, cur, closeFn) {
  const confirmBtn = modal.querySelector('#pat-recv-confirm');
  const cancelBtn = modal.querySelector('#pat-recv-cancel');
  const progressEl = modal.querySelector('#pat-recv-modal-progress');
  if (!confirmBtn || !progressEl) return;

  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  progressEl.style.display = 'block';

  let success = 0, fail = 0;
  const failList = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = item.patient;
    progressEl.textContent = '⏳ กำลังรับเวร ' + (i+1) + '/' + items.length + ' — ' + (p.name || '-') + '...';

    try {
      // Re-check status ก่อน update — กัน race
      const checkRes = await supa
        .from('patient_shift_summaries')
        .select('id, is_closed, received_by, received_at')
        .eq('patient_id', item.patientId)
        .eq('shift_date', cur.date)
        .eq('shift', cur.shift)
        .maybeSingle();

      if (!checkRes || !checkRes.data) {
        fail++;
        failList.push((p.name || '-') + ' (ไม่พบสรุปเวร)');
        continue;
      }
      if (!checkRes.data.is_closed) {
        fail++;
        failList.push((p.name || '-') + ' (กะก่อนยังไม่ปิดเวร)');
        continue;
      }
      if (checkRes.data.received_by) {
        fail++;
        failList.push((p.name || '-') + ' (รับไปแล้วโดย ' + checkRes.data.received_by + ')');
        continue;
      }

      // Pre-load _shiftSummaryCache สำหรับ _ssReceiveShift (ใช้ existing.id)
      if (typeof window._ssLoadManualSummaries === 'function') {
        await window._ssLoadManualSummaries(item.patientId);
      }

      // เรียก _ssReceiveShift จริง (helper handles race + permission)
      let res;
      if (typeof window._ssReceiveShift === 'function') {
        res = await window._ssReceiveShift(item.patientId, cur.date, cur.shift);
      } else {
        // Fallback — direct DB call
        const user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
        const role = (typeof currentUser !== 'undefined') ? (currentUser.role || '') : '';
        res = await supa.from('patient_shift_summaries').update({
          received_at: new Date().toISOString(),
          received_by: user,
          received_by_role: role
        }).eq('id', checkRes.data.id).select().single();
      }

      if (res && res.error) {
        fail++;
        failList.push((p.name || '-') + ' (' + res.error.message + ')');
      } else {
        success++;
      }
    } catch (e) {
      fail++;
      failList.push((p.name || '-') + ' (' + (e.message || e) + ')');
    }
  }

  // Show result
  progressEl.innerHTML =
    '<div style="color:#0F6E56;font-weight:600;">✓ รับเวรสำเร็จ ' + success + ' คน</div>' +
    (fail > 0 ? '<div style="color:#A32D2D;margin-top:4px;">✗ ไม่สำเร็จ ' + fail + ' คน: ' + _patHandoverEscape(failList.join(', ')) + '</div>' : '');

  confirmBtn.textContent = '✓ ปิด';
  confirmBtn.disabled = false;
  cancelBtn.disabled = false;

  // Clear selected ที่ success
  if (success > 0) {
    items.forEach(item => { delete window._patHandoverSelected[item.patientId]; });
  }

  // Refresh status + re-render
  if (typeof _patHandoverLoadAllStatus === 'function') {
    await _patHandoverLoadAllStatus();
  }
  if (typeof renderPatients === 'function') {
    renderPatients();
  }

  // Auto-close หลัง 2 วินาทีถ้าทุกคนสำเร็จ
  if (fail === 0) {
    setTimeout(closeFn, 2000);
  } else {
    confirmBtn.addEventListener('click', closeFn, { once: true });
  }
}


async function patHandoverReceiveSelected() {
  const statusMap = window._patHandoverStatusMap || {};
  const sel = window._patHandoverSelected || {};
  const allSelected = Object.keys(sel);
  if (allSelected.length === 0) return;

  // Filter เฉพาะคนที่ "รับได้" (status = sent)
  const receivable = allSelected.filter(pid => {
    const info = statusMap[String(pid)];
    if (!info) return false;
    return info.status === 'sent';
  });

  // Filter "รับไม่ได้" — มีเหตุผล (กะก่อนยังไม่ปิด หรือ รับแล้ว)
  const skipped = allSelected.filter(pid => !receivable.includes(pid));

  if (receivable.length === 0) {
    if (typeof toast === 'function') {
      toast('ไม่มีผู้รับบริการที่รับเวรได้ — ขอให้กะก่อนปิดเวรก่อน', 'warning');
    }
    return;
  }

  await _patHandoverOpenReceiveModal(receivable, skipped);
}

// ── Admin dropdown ──
function patHandoverToggleAdminMenu() {
  const menu = document.getElementById('patHandoverAdminMenu');
  if (!menu) return;
  menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

// [Step B-7 · 20 พ.ค. 69] ── Admin: ปิดเวรแทน (กรณี caregiver ลืมปิด + กลับบ้านแล้ว) ──
async function patHandoverCloseInstead() {
  const menu = document.getElementById('patHandoverAdminMenu');
  if (menu) menu.style.display = 'none';
  if (!_patHandoverCanAdmin()) {
    if (typeof toast === 'function') toast('คุณไม่มีสิทธิ์ปิดเวรแทน', 'error');
    return;
  }
  const statusMap = window._patHandoverStatusMap || {};
  const sel = window._patHandoverSelected || {};
  const allSelected = Object.keys(sel);
  if (allSelected.length === 0) {
    if (typeof toast === 'function') toast('กรุณาเลือกผู้รับบริการก่อน', 'warning');
    return;
  }
  // Filter เฉพาะคนที่ปิดได้ (no_data/draft) — ใช้ flow เดียวกับ patHandoverCloseSelected
  const closable = allSelected.filter(pid => {
    const info = statusMap[String(pid)];
    if (!info) return true;
    return (info.status === 'no_data' || info.status === 'draft');
  });
  if (closable.length === 0) {
    if (typeof toast === 'function') toast('ไม่มีผู้รับบริการที่ปิดเวรได้ใน list', 'warning');
    return;
  }
  // ใช้ modal เดียวกับ B-3 — admin จะเห็น message ปกติ + ปิดให้แทน caregiver
  await _patHandoverOpenCloseModal(closable);
}

// [Step B-7 · 20 พ.ค. 69] ── Admin: เปิดเวรใหม่ (force reopen — ไม่ต้องรอ caregiver ขอ) ──
async function patHandoverReopen() {
  const menu = document.getElementById('patHandoverAdminMenu');
  if (menu) menu.style.display = 'none';
  if (!_patHandoverCanAdmin()) {
    if (typeof toast === 'function') toast('คุณไม่มีสิทธิ์เปิดเวรใหม่', 'error');
    return;
  }
  const statusMap = window._patHandoverStatusMap || {};
  const sel = window._patHandoverSelected || {};
  const allSelected = Object.keys(sel);
  if (allSelected.length === 0) {
    if (typeof toast === 'function') toast('กรุณาเลือกผู้รับบริการก่อน', 'warning');
    return;
  }
  // Filter เฉพาะคนที่ปิดแล้ว (sent / received / reopen_pending)
  const reopenable = allSelected.filter(pid => {
    const info = statusMap[String(pid)];
    if (!info || !info.record || !info.record.id) return false;
    return (info.status === 'sent' || info.status === 'received' || info.status === 'reopen_pending');
  });
  if (reopenable.length === 0) {
    if (typeof toast === 'function') toast('ไม่มีผู้รับบริการที่เปิดเวรใหม่ได้ใน list (ต้องเป็นเวรที่ปิดแล้ว)', 'warning');
    return;
  }
  // Confirm
  const names = reopenable.slice(0, 5).map(pid => {
    const p = (db.patients || []).find(p => String(p.id) === String(pid));
    return p ? p.name : '#' + pid;
  });
  const more = reopenable.length > 5 ? ' และอีก ' + (reopenable.length - 5) + ' คน' : '';
  let proceed = false;
  if (typeof customConfirm === 'function') {
    proceed = await customConfirm('เปิดเวรใหม่ของ ' + reopenable.length + ' คน?\n' + names.join(', ') + more + '\n\nระบบจะ unlock summary ให้แก้ไขได้');
  } else {
    proceed = confirm('เปิดเวรใหม่ของ ' + reopenable.length + ' คน?');
  }
  if (!proceed) return;
  // Sequential reopen
  let success = 0, fail = 0;
  const failList = [];
  for (let i = 0; i < reopenable.length; i++) {
    const pid = reopenable[i];
    const info = statusMap[String(pid)];
    const p = (db.patients || []).find(p => String(p.id) === String(pid));
    try {
      const res = await supa.from('patient_shift_summaries').update({
        is_closed: false,
        closed_at: null,
        closed_by: null,
        was_reopened: true,
        received_at: null,
        received_by: null,
        received_by_role: null,
        reopen_requested: false,
        reopen_requested_at: null,
        reopen_requested_by: null,
        reopen_reason: null
      }).eq('id', info.record.id).select().single();
      if (res.error) { fail++; failList.push((p ? p.name : '#'+pid) + ': ' + res.error.message); }
      else success++;
    } catch (e) {
      fail++;
      failList.push((p ? p.name : '#'+pid) + ': ' + (e.message || e));
    }
  }
  // Toast result
  if (typeof toast === 'function') {
    if (fail === 0) {
      toast('🔓 เปิดเวรใหม่สำเร็จ ' + success + ' คน', 'success');
    } else {
      toast('✓ สำเร็จ ' + success + ' / ✗ ไม่สำเร็จ ' + fail + ' คน', 'warning');
      console.warn('[handover] reopen failures:', failList);
    }
  }
  // Clear selected + refresh
  window._patHandoverSelected = {};
  if (typeof _patHandoverLoadAllStatus === 'function') await _patHandoverLoadAllStatus();
  if (typeof renderPatients === 'function') renderPatients();
}

// [Step B-2c · 20 พ.ค. 69] ── Approve / Deny reopen request (inline ในแถว) ──
async function patHandoverApproveReopen(summaryId) {
  if (!summaryId) return;
  if (typeof supa === 'undefined') return;
  if (!_patHandoverCanAdmin()) {
    if (typeof toast === 'function') toast('คุณไม่มีสิทธิ์อนุมัติคำขอ', 'error');
    return;
  }
  if (typeof customConfirm === 'function') {
    if (!(await customConfirm('อนุมัติคำขอเปิดเวรนี้? — caregiver จะแก้ summary ได้อีกครั้ง'))) return;
  } else {
    if (!confirm('อนุมัติคำขอเปิดเวรนี้?')) return;
  }
  try {
    // อนุมัติ = reopen ตามคำขอ (clear request flags + set is_closed=false + was_reopened=true)
    const res = await supa.from('patient_shift_summaries').update({
      is_closed: false,
      closed_at: null,
      closed_by: null,
      was_reopened: true,
      reopen_requested: false,
      reopen_requested_at: null,
      reopen_requested_by: null,
      reopen_reason: null
    }).eq('id', summaryId).select().single();
    if (res.error) throw res.error;
    if (typeof toast === 'function') toast('✅ อนุมัติแล้ว — caregiver แก้ summary ได้', 'success');
    // Refresh status + re-render
    await _patHandoverLoadAllStatus();
  } catch (e) {
    if (typeof toast === 'function') toast('อนุมัติไม่สำเร็จ: ' + (e.message || e), 'error');
    console.error('[handover] approve reopen error:', e);
  }
}

async function patHandoverDenyReopen(summaryId) {
  if (!summaryId) return;
  if (typeof supa === 'undefined') return;
  if (!_patHandoverCanAdmin()) {
    if (typeof toast === 'function') toast('คุณไม่มีสิทธิ์ปฏิเสธคำขอ', 'error');
    return;
  }
  if (typeof customConfirm === 'function') {
    if (!(await customConfirm('ปฏิเสธคำขอเปิดเวรนี้? — caregiver จะแก้ summary ไม่ได้'))) return;
  } else {
    if (!confirm('ปฏิเสธคำขอเปิดเวรนี้?')) return;
  }
  try {
    const res = await supa.from('patient_shift_summaries').update({
      reopen_requested: false,
      reopen_requested_at: null,
      reopen_requested_by: null,
      reopen_reason: null
    }).eq('id', summaryId).select().single();
    if (res.error) throw res.error;
    if (typeof toast === 'function') toast('❌ ปฏิเสธคำขอแล้ว', 'success');
    await _patHandoverLoadAllStatus();
  } catch (e) {
    if (typeof toast === 'function') toast('ปฏิเสธไม่สำเร็จ: ' + (e.message || e), 'error');
    console.error('[handover] deny reopen error:', e);
  }
}

// [Step B-7 · 20 พ.ค. 69] ── caregiver ขอเปิดเวรเพื่อแก้ไข summary ──
async function patHandoverRequestReopen(summaryId) {
  if (!summaryId) return;
  if (typeof supa === 'undefined') return;
  if (!_patHandoverCanOperate()) {
    if (typeof toast === 'function') toast('คุณไม่มีสิทธิ์ขอเปิดเวร', 'error');
    return;
  }
  // Prompt เหตุผล
  let reason = '';
  if (typeof customPrompt === 'function') {
    reason = await customPrompt('กรุณาระบุเหตุผลที่ต้องการเปิดเวรนี้:');
  } else {
    reason = prompt('กรุณาระบุเหตุผลที่ต้องการเปิดเวรนี้:');
  }
  if (reason === null) return; // ยกเลิก
  reason = (reason || '').trim();
  if (!reason) {
    if (typeof toast === 'function') toast('กรุณาระบุเหตุผล', 'warning');
    return;
  }
  try {
    const user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
    const res = await supa.from('patient_shift_summaries').update({
      reopen_requested: true,
      reopen_requested_at: new Date().toISOString(),
      reopen_requested_by: user,
      reopen_reason: reason
    }).eq('id', summaryId).select().single();
    if (res.error) throw res.error;
    if (typeof toast === 'function') toast('📨 ส่งคำขอเปิดเวรแล้ว — รอ admin/พยาบาลอนุมัติ', 'success');
    await _patHandoverLoadAllStatus();
  } catch (e) {
    if (typeof toast === 'function') toast('ขอเปิดเวรไม่สำเร็จ: ' + (e.message || e), 'error');
    console.error('[handover] request reopen error:', e);
  }
}

// ── Close admin menu when clicking outside ──
document.addEventListener('click', function(e) {
  const menu = document.getElementById('patHandoverAdminMenu');
  const btn = document.getElementById('patHandoverAdminBtn');
  if (!menu || !btn) return;
  if (menu.style.display !== 'block') return;
  if (btn.contains(e.target) || menu.contains(e.target)) return;
  menu.style.display = 'none';
});

// Expose functions to window
window.patHandoverInitUI = patHandoverInitUI;
window.patHandoverToggleRow = patHandoverToggleRow;
window.patHandoverToggleAll = patHandoverToggleAll;
window.patHandoverSelectPinned = patHandoverSelectPinned;
window.patHandoverClearSelection = patHandoverClearSelection;
window.patHandoverCloseSelected = patHandoverCloseSelected;
window.patHandoverReceiveSelected = patHandoverReceiveSelected;
window.patHandoverToggleAdminMenu = patHandoverToggleAdminMenu;
window.patHandoverCloseInstead = patHandoverCloseInstead;
window.patHandoverReopen = patHandoverReopen;
// [Step B-2c · 20 พ.ค. 69] inline admin actions ใน badge แถว
window.patHandoverApproveReopen = patHandoverApproveReopen;
window.patHandoverDenyReopen = patHandoverDenyReopen;
// [Step B-7 · 20 พ.ค. 69] caregiver ขอเปิดเวร (inline ในแถว status=sent)
window.patHandoverRequestReopen = patHandoverRequestReopen;
// [Step B-2b] expose load function สำหรับ refresh แบบ programmatic ก่อนทำ action ใหญ่
window._patHandoverLoadAllStatus = _patHandoverLoadAllStatus;

