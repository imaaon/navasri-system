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
coverage: (document.getElementById('appt-coverage') || {}).value || null,
orders:   (document.getElementById('appt-orders') || {}).value || null,
  };
  if (_apptEditId) {
    const { error } = await supa.from('patient_appointments').update(row).eq('id',_apptEditId);
    if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
    const idx = db.appointments.findIndex(a=>a.id==_apptEditId);
    if(idx>=0) db.appointments[idx] = mapAppointment({id:_apptEditId,...Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v]))});
    toast('บันทึกนัดหมายเรียบร้อย','success');
  } else {
    const {data:ins,error} = await supa.from('patient_appointments').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    db.appointments.push(mapAppointment(ins));
  // Send LINE notification: 3 days before and 1 day before
  const daysLeft = Math.ceil((new Date(apptDate)-new Date())/(86400000));
  if (daysLeft === 3 || daysLeft === 1) {
    const urgencyTxt = daysLeft === 1 ? '🔴 ⚠️ ด่วนมาก!' : '🟡 ใกล้แล้ว';
    const timeTxt = daysLeft === 1 ? 'พรุ่งนี้!' : 'อีก 3 วัน';
    sendLineNotify('appt_reminder', '🚐 นัดหมาย: '+timeTxt+' '+urgencyTxt+'\n━━━━━━━━━━━━━━\n👤 ผู้รับบริการ: '+_apptPatName+'\n🏥 '+hospital+'\n📅 '+apptDate+(apptTime?' '+apptTime:'')+'\n🎯 วัตถุประสงค์: '+(row.purpose||'-'), {patientName:_apptPatName});
  }
    toast('เพิ่มนัดหมายเรียบร้อย','success');
  }
  closeModal('modal-appt');
  const listEl = document.getElementById('appt-list-'+_apptPatId);
  if(listEl) listEl.innerHTML = renderApptList(_apptPatId);
  renderUpcomingAppts();
}

async function markApptDone(id) {
  const { error } = await supa.from('patient_appointments').update({status:'done'}).eq('id',id);
  if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  const a = db.appointments.find(x=>x.id==id);
  if(a) { a.status='done'; const el=document.getElementById('appt-list-'+a.patientId); if(el) el.innerHTML=renderApptList(a.patientId); }
  toast('✅ บันทึกเสร็จสิ้นแล้ว','success');
  renderUpcomingAppts();
}

async function deleteAppt(id, patientId) {
  if(!confirm('ลบนัดหมายนี้?')) return;
  const { error } = await supa.from('patient_appointments').delete().eq('id',id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
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
  
  // Helpers
  const _uaEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const _uaThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const _uaFmtDate = (s) => { if(!s) return ''; const d = new Date(s); return d.getDate() + ' ' + _uaThaiMonths[d.getMonth()]; };
  const _uaFmtTime = (t) => { if(!t) return ''; return String(t).substring(0, 5); };
  const _uaDayLabel = (d) => d === 0 ? 'วันนี้' : d === 1 ? 'พรุ่งนี้' : ('อีก ' + d + ' วัน');
  
  el.innerHTML = soon.map(a=>{
    const daysLeft = Math.ceil((new Date(a.apptDate) - new Date(today)) / (86400000));
    // Fallback: หาชื่อจาก db.patients เมื่อ patientName ใน appointment ว่าง
    const fallbackName = (db.patients||[]).find(p => String(p.id) === String(a.patientId))?.name || '(ไม่ระบุชื่อ)';
    const displayName = a.patientName && a.patientName.trim() ? a.patientName : fallbackName;
    const dateText = _uaFmtDate(a.apptDate) + (a.apptTime ? ' ' + _uaFmtTime(a.apptTime) : '');
    const isUrgent = daysLeft <= 2;
    const badgeBg = isUrgent ? '#fef0ee' : '#eef4ff';
    const badgeColor = isUrgent ? '#e74c3c' : 'var(--accent)';
    return `<div onclick="navigateToAppt('${_uaEsc(a.patientId)}')" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden;">
      <div style="background:${badgeBg};color:${badgeColor};border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;flex-shrink:0;white-space:nowrap;">${_uaDayLabel(daysLeft)}</div>
      <div style="font-weight:600;font-size:13px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;">${_uaEsc(displayName)}</div>
      <div style="font-size:12px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;min-width:0;">· ${_uaEsc(a.hospital||'-')}</div>
      <div style="font-size:12px;color:var(--text3);flex-shrink:0;white-space:nowrap;">${_uaEsc(dateText)}</div>
    </div>`;
  }).join('');
}
function navigateToAppt(patientId) {
  openPatientProfile(patientId).then(()=>switchPatTab('appts'));
}

// External poller: รอ db พร้อมแล้วค่อย render widget นัดหมาย (กัน race condition กับ loadDB)
(function _uaWaitForDb() {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const dbReady = (typeof db !== 'undefined') && Array.isArray(db?.appointments);
    const widgetExists = !!document.getElementById('dashboard-appts');
    if (dbReady && widgetExists) {
      clearInterval(interval);
      try { renderUpcomingAppts(); } catch(e) { console.warn('_uaWaitForDb render failed:', e); }
    } else if (attempts > 60) {
      clearInterval(interval);
    }
  }, 500);
})();