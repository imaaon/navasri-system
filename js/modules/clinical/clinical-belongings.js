
function previewBelongingPhoto(input) {
  const preview = document.getElementById('belonging-photo-preview');
  const img     = document.getElementById('belonging-photo-img');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
      preview.style.display = '';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function openEditBelongingModal(belongingId, patientId) {
  const b = (db.belongings||[]).find(x=>x.id==belongingId);
  if (!b) return;
  document.getElementById('belonging-patient-id').value = patientId;
  document.getElementById('belonging-item-name').value = b.itemName||'';
  document.getElementById('belonging-description').value = b.description||'';
  document.getElementById('belonging-qty').value = b.qty||1;
  document.getElementById('belonging-condition').value = b.condition||'ดี';
  document.getElementById('belonging-date-in').value = b.dateIn||'';
  document.getElementById('belonging-received-by').value = b.receivedBy||'';
  document.getElementById('belonging-note').value = b.note||'';
  document.getElementById('belonging-patient-id').dataset.editId = belongingId;
  openModal('modal-belonging');
}
// ===== CLINICAL BELONGINGS =====

// ==========================================
// ===== BELONGINGS 🧳 ======================
// ==========================================
function renderBelongingList(patientId) {
  const items = (db.belongings||[]).filter(b=>String(b.patientId)===String(patientId));
  if(!items.length) return `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีสิ่งของบันทึกไว้</div>`;
  const held = items.filter(i=>i.status==='held');
  const returned = items.filter(i=>i.status==='returned');
  const COND_COLOR = { ดี:'#27ae60', ปานกลาง:'#e67e22', ชำรุด:'#e74c3c' };
  const renderGroup = (list, label) => !list.length ? '' : `
    <div style="padding:10px 16px 0;font-size:12px;font-weight:700;color:var(--text3);">${label} (${list.length})</div>
    <table style="width:100%;">
      <thead><tr style="font-size:12px;"><th style="padding:6px 16px;">สิ่งของ</th><th>จำนวน</th><th>สภาพ</th><th>วันนำเข้า</th><th>รับโดย</th><th>หมายเหตุ</th><th></th></tr></thead>
      <tbody>
        ${list.map(b=>`<tr style="font-size:13px;">
          <td style="padding:8px 16px;font-weight:600;">${b.itemName}${b.description?`<br><span style="font-size:11px;font-weight:400;color:var(--text3);">${b.description}</span>`:''}</td>
          <td class="number">${b.qty}</td>
          <td><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${COND_COLOR[b.condition]||'#888'}22;color:${COND_COLOR[b.condition]||'#888'};">${b.condition}</span></td>
          <td style="font-size:12px;">${b.dateIn}</td>
          <td style="font-size:12px;">${b.receivedBy}</td>
          <td style="font-size:12px;color:var(--text2);">${b.note||'-'}</td>
          <td style="white-space:nowrap;">
            ${b.status==='held'?`<button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;" onclick="returnBelonging('${b.id}','${patientId}')">↩️ คืน</button>`:`<span style="font-size:11px;color:var(--text3);">คืนแล้ว ${b.dateOut||''}</span>`}
            <button class="btn btn-ghost btn-sm" onclick="openEditBelongingModal('${b.id}','${patientId}')" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteBelonging('${b.id}','${patientId}')" style="font-size:11px;color:#e74c3c;">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  return `<div>${renderGroup(held,'📦 อยู่ในความดูแล')}${renderGroup(returned,'✅ คืนแล้ว')}</div>`;
}

let _belongingEditPatId=null, _belongingEditPatName=null;
function openBelongingModal(id, patientId, patientName) {
  _belongingEditPatId   = patientId;
  _belongingEditPatName = patientName;
  const actor = currentUser?.displayName || currentUser?.username || '';
  document.getElementById('belonging-item-name').value = '';
  document.getElementById('belonging-qty').value = 1;
  document.getElementById('belonging-condition').value = 'ดี';
  document.getElementById('belonging-description').value = '';
  document.getElementById('belonging-date-in').value = new Date().toISOString().split('T')[0];
  document.getElementById('belonging-received-by').value = actor;
  document.getElementById('belonging-note').value = '';
  openModal('modal-belonging');
}

async function saveBelonging() {
  const itemName = document.getElementById('belonging-item-name').value.trim();
  if(!itemName){toast('กรุณาระบุชื่อสิ่งของ','warning');return;}
  const actor = currentUser?.displayName || currentUser?.username || '';
  // อัปโหลดรูปถ้ามี
  let photoUrl = document.getElementById('belonging-photo-url')?.value || '';
  const photoFile = document.getElementById('belonging-photo-file')?.files?.[0];
  if (photoFile) {
    try { photoUrl = await uploadPhotoToStorage(photoFile, 'belongings'); }
    catch(e) { toast('อัปโหลดรูปไม่สำเร็จ: '+e.message,'warning'); }
  }
  const row = {
    patient_id: _belongingEditPatId, patient_name: _belongingEditPatName,
    item_name: itemName,
    qty: parseFloat(document.getElementById('belonging-qty').value)||1,
    condition: document.getElementById('belonging-condition').value,
    description: document.getElementById('belonging-description').value.trim(),
    date_in: document.getElementById('belonging-date-in').value,
    received_by: document.getElementById('belonging-received-by').value.trim()||actor,
    status: 'held',
    note: document.getElementById('belonging-note').value.trim(),
    photo: photoUrl||null,
  };
  const editId = document.getElementById('belonging-patient-id')?.dataset?.editId || '';
  let ins, error;
  if (editId) {
    ({data: ins, error} = await supa.from('patient_belongings').update(row).eq('id', editId).select().single());
    if(!error && ins) {
      const idx = (db.belongings||[]).findIndex(b=>b.id==editId);
      if(idx>=0) db.belongings[idx] = mapBelonging(ins);
    }
  } else {
    ({data: ins, error} = await supa.from('patient_belongings').insert(row).select().single());
    if(!error) { if(!db.belongings) db.belongings=[]; db.belongings.unshift(mapBelonging(ins)); }
  }
  if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
  const el=document.getElementById('belonging-list-'+_belongingEditPatId);
  if(el) el.innerHTML=renderBelongingList(_belongingEditPatId);
  toast('บันทึกสิ่งของเรียบร้อย','success');
  closeModal('modal-belonging');
}

async function returnBelonging(id, patientId) {
  const returnedBy = currentUser?.displayName || currentUser?.username || '';
  const dateOut = new Date().toISOString().split('T')[0];
  await supa.from('patient_belongings').update({status:'returned', date_out:dateOut, returned_by:returnedBy}).eq('id',id);
  const b = db.belongings.find(x=>x.id==id);
  if(b){b.status='returned';b.dateOut=dateOut;b.returnedBy=returnedBy;}
  const el=document.getElementById('belonging-list-'+patientId);
  if(el) el.innerHTML=renderBelongingList(patientId);
  toast('✅ บันทึกการคืนสิ่งของเรียบร้อย','success');
}

async function deleteBelonging(id, patientId) {
  if(!confirm('ลบรายการนี้?')) return;
  await supa.from('patient_belongings').delete().eq('id',id);
  db.belongings = db.belongings.filter(b=>b.id!=id);
  const el=document.getElementById('belonging-list-'+patientId); if(el) el.innerHTML=renderBelongingList(patientId);
  toast('ลบแล้ว','success');
}

// ==========================================
// ===== DNR & CONSENT ⚖️ ==================
// ==========================================
function renderDnrPanel(p) {
  const consent = (db.patientConsents||[]).find(c=>String(c.patientId)===String(p.id));
  const DNR_STYLES = {
    dnr:   { bg:'#fdf2f8', border:'#c0392b', badge:'#c0392b', icon:'🚫', label:'DNR — ไม่ต้องการการช่วยชีวิต' },
    full:  { bg:'#f0fff4', border:'#27ae60', badge:'#27ae60', icon:'✅', label:'Full Code — ยินยอมให้ช่วยชีวิตเต็มที่' },
    limited:{ bg:'#fffdf0', border:'#e67e22', badge:'#e67e22', icon:'⚠️', label:'Limited — ยินยอมบางส่วน (ดูรายละเอียด)' },
    not_set:{ bg:'var(--surface2)', border:'var(--border)', badge:'#888', icon:'❓', label:'ยังไม่ได้กำหนด' },
  };
  const style = DNR_STYLES[consent?.dnrStatus||'not_set'];
  return `
  <div style="background:${style.bg};border:2px solid ${style.border};border-radius:12px;padding:18px 20px;margin-bottom:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:${style.border};">${style.icon} ${style.label}</div>
        ${consent?.dnrSignedDate?`<div style="font-size:12px;color:var(--text3);margin-top:4px;">ลงนาม: ${consent.dnrSignedDate} โดย ${consent.dnrSignedBy}</div>`:''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="openDnrModal('${p.id}','${p.name}')">✏️ แก้ไข DNR & Consent</button>
    </div>
    ${consent ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px;">
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🫀 การกู้คืนหัวใจ (CPR)</div>
        <div style="font-weight:600;">${consent.cprConsent===true?'✅ ยินยอม':consent.cprConsent===false?'❌ ไม่ยินยอม':'❓ ไม่ระบุ'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🫁 เครื่องช่วยหายใจ (Ventilator)</div>
        <div style="font-weight:600;">${consent.ventilatorConsent===true?'✅ ยินยอม':consent.ventilatorConsent===false?'❌ ไม่ยินยอม':'❓ ไม่ระบุ'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🏥 โรงพยาบาลที่ต้องการ</div>
        <div style="font-weight:600;">${consent.preferredHospital||'-'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">📞 ผู้ติดต่อฉุกเฉิน</div>
        <div style="font-weight:600;">${consent.emergencyContact||'-'} ${consent.emergencyPhone?'<span style="font-size:12px;color:var(--accent);">'+consent.emergencyPhone+'</span>':''}</div>
      </div>
    </div>
    ${consent.advanceDirective?`<div style="margin-top:12px;background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">📜 Advance Directive / ข้อปฏิบัติพิเศษ</div><div style="font-size:13px;">${consent.advanceDirective}</div></div>`:''}
    ${consent.note?`<div style="margin-top:8px;font-size:12px;color:var(--text3);">💬 ${consent.note}</div>`:''}
    ` : `<div style="margin-top:12px;font-size:13px;color:var(--text3);">ยังไม่มีข้อมูล กดปุ่ม "แก้ไข" เพื่อบันทึก</div>`}
  </div>`;
}

let _dnrPatId=null, _dnrPatName=null;
function openDnrModal(patientId, patientName) {
  _dnrPatId   = patientId;
  _dnrPatName = patientName;
  const c = (db.patientConsents||[]).find(x=>String(x.patientId)===String(patientId));
  document.getElementById('dnr-status').value    = c?.dnrStatus||'not_set';
  document.getElementById('dnr-cpr').value       = c?.cprConsent===null ? 'null' : c?.cprConsent===true ? 'true' : c?.cprConsent===false ? 'false' : 'null';
  document.getElementById('dnr-vent').value      = c?.ventilatorConsent===null ? 'null' : c?.ventilatorConsent===true ? 'true' : c?.ventilatorConsent===false ? 'false' : 'null';
  document.getElementById('dnr-hospital').value  = c?.preferredHospital||'';
  document.getElementById('dnr-ec-name').value   = c?.emergencyContact||'';
  document.getElementById('dnr-ec-phone').value  = c?.emergencyPhone||'';
  document.getElementById('dnr-directive').value = c?.advanceDirective||'';
  document.getElementById('dnr-signed-date').value = c?.dnrSignedDate||new Date().toISOString().split('T')[0];
  document.getElementById('dnr-signed-by').value = c?.dnrSignedBy||'';
  document.getElementById('dnr-note').value      = c?.note||'';
  openModal('modal-dnr');
}

async function saveDnr() {
  const cprVal  = document.getElementById('dnr-cpr').value;
  const ventVal = document.getElementById('dnr-vent').value;
  const row = {
    patient_id: _dnrPatId,
    dnr_status: document.getElementById('dnr-status').value,
    cpr_consent: cprVal==='null'?null:cprVal==='true',
    ventilator_consent: ventVal==='null'?null:ventVal==='true',
    preferred_hospital: document.getElementById('dnr-hospital').value.trim(),
    emergency_contact: document.getElementById('dnr-ec-name').value.trim(),
    emergency_phone: document.getElementById('dnr-ec-phone').value.trim(),
    advance_directive: document.getElementById('dnr-directive').value.trim(),
    dnr_signed_date: document.getElementById('dnr-signed-date').value,
    dnr_signed_by: document.getElementById('dnr-signed-by').value.trim(),
    note: document.getElementById('dnr-note').value.trim(),
    updated_at: new Date().toISOString(),
  };
  const existing = (db.patientConsents||[]).find(c=>String(c.patientId)===String(_dnrPatId));
  if(existing) {
    await supa.from('patient_consents').update(row).eq('id',existing.id);
    Object.assign(existing, mapConsent({id:existing.id,...Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v]))}));
  } else {
    const {data:ins,error}=await supa.from('patient_consents').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    if(!db.patientConsents)db.patientConsents=[];
    db.patientConsents.push(mapConsent(ins));
  }
  const p = db.patients.find(x=>String(x.id)===String(_dnrPatId));
  const panelEl = document.getElementById('dnr-panel-'+_dnrPatId);
  if(panelEl && p) panelEl.innerHTML = renderDnrPanel(p);
  toast('บันทึก DNR & Consent เรียบร้อย','success');
  closeModal('modal-dnr');
}