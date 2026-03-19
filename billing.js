// ===== CLINICAL APPT =====

// ==========================================
// ==========================================
// ===== APPOINTMENTS 🚐 ===================
// ==========================================
function renderApptList(patientId) {
  const appts = (db.appointments||[]).filter(a=>String(a.patientId)===String(patientId))
    .sort((a,b)=>a.apptDate.localeCompare(b.apptDate));
  if (!appts.length) return `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีนัดหมาย</div>`;
  const today = new Date().toISOString().split('T')[0];
  const STATUS_COLOR = { upcoming:'#3498db', done:'#27ae60', cancelled:'#e74c3c', postponed:'#e67e22' };
  const STATUS_LABEL = { upcoming:'🔵 กำลังจะถึง', done:'✅ เสร็จแล้ว', cancelled:'❌ ยกเลิก', postponed:'⏸ เลื่อน' };
  const TRANSPORT_ICON = { 'รถคลินิก':'🚐', 'ญาติมารับ':'👨‍👩‍👧', 'แท็กซี่/รถรับจ้าง':'🚕', 'รถพยาบาล':'🚑' };
  return `<div style="display:flex;flex-direction:column;gap:10px;padding:12px 16px;">
    ${appts.map(a => {
      const daysLeft = a.apptDate >= today ? Math.ceil((new Date(a.apptDate)-new Date(today))/(86400000)) : -1;
      const urgent   = daysLeft >= 0 && daysLeft <= 2 && a.status==='upcoming';
      return `<div style="border:1.5px solid ${urgent?'#e74c3c':a.status==='done'?'#ddd':'var(--border)'};border-radius:10px;padding:14px;background:${urgent?'#fff5f5':a.status==='done'?'#f9f9f9':'var(--surface2)'};position:relative;">
        ${urgent?`<div style="position:absolute;top:8px;right:8px;background:#e74c3c;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">⚠️ อีก ${daysLeft} วัน</div>`:''}
        <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div style="min-width:100px;">
            <div style="font-size:17px;font-weight:700;color:${a.status==='upcoming'?'var(--accent)':'var(--text2)'};">${a.apptDate} ${a.apptTime?'🕐'+a.apptTime:''}</div>
            <div style="font-size:11px;margin-top:2px;"><span style="background:${STATUS_COLOR[a.status]||'#888'}22;color:${STATUS_COLOR[a.status]||'#888'};padding:2px 8px;border-radius:10px;">${STATUS_LABEL[a.status]||a.status}</span></div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${a.hospital}</div>
            <div style="font-size:13px;color:var(--text2);">${a.department?'แผนก '+a.department+' ':''} ${a.doctor?'นพ./พญ. '+a.doctor:''}</div>
            <div style="font-size:12px;margin-top:4px;">🎯 ${a.purpose||'-'}</div>
            ${a.preparation?`<div style="font-size:12px;color:#e67e22;margin-top:2px;">📋 เตรียม: ${a.preparation}</div>`:''}
            <div style="font-size:12px;margin-top:4px;">${TRANSPORT_ICON[a.transport]||'🚗'} ${a.transport} ${a.transportNote?'('+a.transportNote+')':''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${a.status==='upcoming'?`<button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;" onclick="markApptDone('${a.id}')">✅ เสร็จ</button>`:''}
            <button class="btn btn-ghost btn-sm" onclick="openApptModal('${a.id}')" style="font-size:11px;">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteAppt('${a.id}','${patientId}')" style="font-size:11px;color:#e74c3c;">🗑️</button>
          </div>
        </div>
        ${a.note?`<div style="font-size:12px;color:var(--text3);margin-top:6px;border-top:1px solid var(--border);padding-top:6px;">💬 ${a.note}</div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

let _apptEditId = null, _apptPatId = null, _apptPatName = null;
function openApptModal(id, patientId, patientName) {
  _apptEditId   = id;
  _apptPatId    = patientId || (id ? (db.appointments||[]).find(a=>a.id==id)?.patientId : null);
  _apptPatName  = patientName || (db.appointments||[]).find(a=>a.id==id)?.patientName || '';
  const a = id ? (db.appointments||[]).find(x=>x.id==id) : null;
  document.getElementById('modal-appt-title').textContent = id ? '✏️ แก้ไขนัดหมาย' : '+ เพิ่มนัดหมาย';
  document.getElementById('appt-date').value       = a?.apptDate    || new Date().toISOString().split('T')[0];
  document.getElementById('appt-time').value       = a?.apptTime    || '';
  document.getElementById('appt-hospital').value   = a?.hospital    || '';
  document.getElementById('appt-department').value = a?.department  || '';
  document.getElementById('appt-doctor').value     = a?.doctor      || '';
  document.getElementById('appt-purpose').value    = a?.purpose     || '';
  document.getElementById('appt-preparation').value= a?.preparation || '';
  document.getElementById('appt-transport').value  = a?.transport   || 'รถคลินิก';
  document.getElementById('appt-transport-note').value = a?.transportNote || '';
  document.getElementById('appt-status').value     = a?.status      || 'upcoming';
  document.getElementById('appt-note').value       = a?.note        || '';
  openModal('modal-appt');
}

async function saveAppt() {
  const apptDate = document.getElementById('appt-date').value;
  const hospital = document.getElementById('appt-hospital').value.trim();
  if (!apptDate || !hospital) { toast('กรุณาระบุวันที่และโรงพยาบาล','warning'); return; }
  const actor = currentUser?.displayName || currentUser?.username || '';
  const row = {
    patient_id: _apptPatId, patient_name: _apptPatName,
    appt_date: apptDate,
    appt_time: document.getElementById('appt-time').value,
    hospital, department: document.getElementById('appt-department').value.trim(),
    doctor: document.getElementById('appt-doctor').value.trim(),
    purpose: document.getElementById('appt-purpose').value.trim(),
    preparation: document.getElementById('appt-preparation').value.trim(),
    transport: document.getElementById('appt-transport').value,
    transport_note: document.getElementById('appt-transport-note').value.trim(),
    status: document.getElementById('appt-status').value,
    note: document.getElementById('appt-note').value.trim(),
    created_by: actor,
  };
  if (_apptEditId) {
    await supa.from('patient_appointments').update(row).eq('id',_apptEditId);
    const idx = db.appointments.findIndex(a=>a.id==_apptEditId);
    if(idx>=0) db.appointments[idx] = mapAppointment({id:_apptEditId,...Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v]))});
    toast('บันทึกนัดหมายเรียบร้อย','success');
  } else {
    const {data:ins,error} = await supa.from('patient_appointments').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    db.appointments.push(mapAppointment(ins));
    // Send LINE notification if upcoming and within 2 days
    const daysLeft = Math.ceil((new Date(apptDate)-new Date())/(86400000));
    if (daysLeft <= 2) {
      sendLineNotify('appt_reminder', `🚐 นัดหมายใกล้แล้ว!\n━━━━━━━━━━━━━━\n👤 ${_apptPatName}\n🏥 ${hospital}\n📅 ${apptDate} ${row.appt_time||''}\n🎯 ${row.purpose||'-'}`, {patientName:_apptPatName});
    }
    toast('เพิ่มนัดหมายเรียบร้อย','success');
  }
  closeModal('modal-appt');
  const listEl = document.getElementById('appt-list-'+_apptPatId);
  if(listEl) listEl.innerHTML = renderApptList(_apptPatId);
  renderUpcomingAppts();
}

async function markApptDone(id) {
  await supa.from('patient_appointments').update({status:'done'}).eq('id',id);
  const a = db.appointments.find(x=>x.id==id);
  if(a) { a.status='done'; const el=document.getElementById('appt-list-'+a.patientId); if(el) el.innerHTML=renderApptList(a.patientId); }
  toast('✅ บันทึกเสร็จสิ้นแล้ว','success');
  renderUpcomingAppts();
}

async function deleteAppt(id, patientId) {
  if(!confirm('ลบนัดหมายนี้?')) return;
  await supa.from('patient_appointments').delete().eq('id',id);
  db.appointments = db.appointments.filter(a=>a.id!=id);
  const el=document.getElementById('appt-list-'+patientId); if(el) el.innerHTML=renderApptList(patientId);
  toast('ลบนัดหมายแล้ว','success');
  renderUpcomingAppts();
}

function renderUpcomingAppts() {
  // Called from dashboard to show upcoming appt widget
  const el = document.getElementById('dashboard-appts');
  if(!el) return;
  const today = new Date().toISOString().split('T')[0];
  const soon = (db.appointments||[]).filter(a=>a.status==='upcoming'&&a.apptDate>=today)
    .sort((a,b)=>a.apptDate.localeCompare(b.apptDate)).slice(0,5);
  if(!soon.length){el.innerHTML=`<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีนัดหมายที่กำลังจะถึง</div>`;return;}
  el.innerHTML = soon.map(a=>{
    const daysLeft=Math.ceil((new Date(a.apptDate)-new Date(today))/(86400000));
    return `<div onclick="navigateToAppt('${a.patientId}')" style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;">
      <div style="background:${daysLeft<=2?'#e74c3c22':'var(--sage-light)'};color:${daysLeft<=2?'#e74c3c':'var(--accent)'};border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap;">${daysLeft===0?'วันนี้':daysLeft===1?'พรุ่งนี้':'อีก '+daysLeft+' วัน'}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:12px;">${a.patientName}</div><div style="font-size:11px;color:var(--text2);">${a.hospital} ${a.apptTime?'· '+a.apptTime:''}</div></div>
    </div>`;
  }).join('');
}
function navigateToAppt(patientId) {
  openPatientProfile(patientId).then(()=>switchPatTab('appts'));
}