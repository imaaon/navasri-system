
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

  const active   = pats.filter(p => p.status === 'active').length;
  const hospital = pats.filter(p => p.status === 'hospital').length;
  const total    = pats.length;

  const sumEl = document.getElementById('patSummary');
  if (sumEl) sumEl.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
    <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">👥 ทั้งหมด <strong>${total}</strong> คน</div>
    <div style="background:var(--green-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">✅ พักอยู่ <strong>${active}</strong> คน</div>
    ${hospital ? `<div style="background:#EBF5FB;border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🏥 อยู่โรงพยาบาล <strong>${hospital}</strong> คน</div>` : ''}
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🚪 ออกแล้ว <strong>${total-active-hospital}</strong> คน</div>
  </div>`;

  const tb = document.getElementById('patTable');
  if (pats.length === 0) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบข้อมูล</td></tr>';
    return;
  }
  tb.innerHTML = pats.map((p, i) => {
    const idcard = p.idcard || p.idCard || '-';
    const age    = p.dob ? calcAge(p.dob) : '-';
    const dur    = p.admitDate ? calcDuration(p.admitDate, p.endDate) : '-';
    const isActive = p.status === 'active';
    return `<tr>
      <td class="number" style="color:var(--text3);">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          ${p.photo
            ? `<img src="${p.photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--sage);cursor:zoom-in;flex-shrink:0;" onclick=\"showPatientPhoto('${p.id}')\" title="คลิกเพื่อขยาย">`
            : `<div style="width:52px;height:52px;border-radius:50%;background:var(--sage-light);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;cursor:pointer;" onclick=\"editPatient('${p.id}')\" title="เพิ่มรูปภาพ">👤</div>`}
          <div>
            <div style="font-weight:600;cursor:pointer;color:var(--accent);line-height:1.3;" onclick=\"openPatientProfile('${p.id}')\">${p.name}</div>
            <div style="font-size:11px;color:var(--text3);">${p.position||''}</div>
          </div>
        </div>
      </td>
      <td class="number" style="font-size:12px;color:var(--text2);">${idcard}</td>
      <td class="number" style="font-size:12px;">${p.dob||'-'}</td>
      <td style="font-size:12px;">${age}</td>
      <td class="number" style="font-size:12px;">${p.admitDate||p.admit_date||'-'}</td>
      <td class="number" style="font-size:12px;">${p.endDate||p.end_date||'-'}</td>
      <td style="font-size:12px;color:var(--text2);">${dur}</td>
      <td><span class="badge ${p.status==='active' ? 'badge-green' : p.status==='hospital' ? 'badge-blue' : 'badge-gray'}">${p.status==='active' ? 'พักอยู่' : p.status==='hospital' ? '🏥 อยู่ รพ.' : 'ออกแล้ว'}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick=\"openPatientProfile('${p.id}')\" title="ดูโปรไฟล์">🔍</button>
        <button class="btn btn-ghost btn-sm" onclick=\"editPatient('${p.id}')\" title="แก้ไข">✏️</button>
      </td>
    </tr>`;
  }).join('');
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
  document.getElementById('pat-edit-id').value = '';
  document.getElementById('pat-name').value = '';
  document.getElementById('pat-id').value = '';
  document.getElementById('pat-dob').value = '';
  document.getElementById('pat-dob').disabled = false;
  document.getElementById('pat-birth-year').value = '';
  document.getElementById('pat-birth-year').disabled = false;
  document.getElementById('pat-dob-unknown').checked = false;
  document.getElementById('pat-age-display').value = '';
  document.getElementById('pat-admit').value = '';
  document.getElementById('pat-enddate').value = '';
  document.getElementById('pat-status').value = 'active';
  document.getElementById('pat-note').value = '';
  document.getElementById('pat-photo-data').value = '';
  document.getElementById('pat-photo-preview').innerHTML = '👤';
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
    infoDiv.innerHTML = `🏠 ${room.roomType} · ${room.zone||''} · ค่าห้อง <strong>${room.monthlyRate?.toLocaleString('th-TH')||0} ฿/เดือน</strong>${room.dailyRate ? ` หรือ ${room.dailyRate.toLocaleString('th-TH')} ฿/วัน` : ''}`;
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
    const _oldBedId = editId ? (db.patients.find(p=>p.id==editId)?.currentBedId||null) : null;
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
    }
  }
  logAudit(AUDIT_MODULES.PATIENT,
    editId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
    editId || 'new', { name: data.name || data.first_name });
  closeModal('modal-addPatient');
  renderPatients();
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
  if (!confirm('ลบประวัติการแพ้นี้?')) return;
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
  if (!confirm('ลบผู้ติดต่อนี้?')) return;
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
