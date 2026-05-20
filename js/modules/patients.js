
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
    const by = (rec && rec.closed_by) ? rec.closed_by : '—';
    const at = (rec && rec.closed_at) ? new Date(rec.closed_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}) : '';
    txt = '🔒 ส่งแล้ว · ' + by + (at ? ' · ' + at : '');
    style = 'background:#0F6E56;color:#fff;';
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

// ── Action handlers (B-2a stubs — show alert, real logic ใน B-3/B-4) ──
function patHandoverCloseSelected() {
  const count = Object.keys(window._patHandoverSelected || {}).length;
  if (typeof toast === 'function') {
    toast('📤 ปิดเวร ' + count + ' คน — ฟีเจอร์นี้กำลังจะมา (B-3)', 'info');
  }
}

function patHandoverReceiveSelected() {
  const count = Object.keys(window._patHandoverSelected || {}).length;
  if (typeof toast === 'function') {
    toast('✓ รับเวร ' + count + ' คน — ฟีเจอร์นี้กำลังจะมา (B-4)', 'info');
  }
}

// ── Admin dropdown ──
function patHandoverToggleAdminMenu() {
  const menu = document.getElementById('patHandoverAdminMenu');
  if (!menu) return;
  menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function patHandoverCloseInstead() {
  if (typeof toast === 'function') toast('🔓 ปิดเวรแทน — ฟีเจอร์นี้กำลังจะมา', 'info');
  const menu = document.getElementById('patHandoverAdminMenu');
  if (menu) menu.style.display = 'none';
}

function patHandoverReopen() {
  if (typeof toast === 'function') toast('🔓 เปิดเวรใหม่ — ฟีเจอร์นี้กำลังจะมา', 'info');
  const menu = document.getElementById('patHandoverAdminMenu');
  if (menu) menu.style.display = 'none';
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
// [Step B-2b] expose load function สำหรับ refresh แบบ programmatic ก่อนทำ action ใหญ่
window._patHandoverLoadAllStatus = _patHandoverLoadAllStatus;

