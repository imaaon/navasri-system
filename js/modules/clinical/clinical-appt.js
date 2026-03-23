// ===== PREP LIST HELPERS =====
window._apptPreps = [];

function renderApptPrepList() {
  const el = document.getElementById('appt-prep-list');
  if (!el) return;
  if (!window._apptPreps.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);">ยังไม่มีรายการ</div>'; return; }
  el.innerHTML = window._apptPreps.map((p, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:var(--sage-light);border-radius:6px;padding:6px 10px;">
      <span style="font-size:13px;flex:1;">✓ ${p}</span>
      <button type="button" class="btn btn-ghost btn-sm" onclick="removeApptPrep(${i})" style="padding:2px 6px;color:#e74c3c;">✕</button>
    </div>`).join('');
}

function addApptPrep(text) {
  if (!window._apptPreps.includes(text)) {
    window._apptPreps.push(text);
    renderApptPrepList();
  } else { toast('มีรายการนี้แล้ว', 'warning'); }
}

function addApptPrepCustom() {
  const text = prompt('ระบุสิ่งที่ต้องเตรียม:');
  if (text?.trim()) addApptPrep(text.trim());
}

function removeApptPrep(idx) {
  window._apptPreps.splice(idx, 1);
  renderApptPrepList();
}

function previewApptCard(input) {
  const file = input.files[0];
  if (!file) return;
  input._pendingFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('appt-card-preview').innerHTML =
      `<img src="${e.target.result}" style="height:48px;border-radius:6px;cursor:pointer;" onclick="showPhotoModal('${e.target.result}')">`;
  };
  reader.readAsDataURL(file);
}

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
            ${a.preparations?.length ? `<div style="font-size:12px;color:#e67e22;margin-top:2px;">📋 เตรียม: ${a.preparations.join(' · ')}</div>` : a.preparation ? `<div style="font-size:12px;color:#e67e22;margin-top:2px;">📋 เตรียม: ${a.preparation}</div>` : ''}
            <div style="font-size:12px;margin-top:4px;">${TRANSPORT_ICON[a.transport]||'🚗'} ${a.transport}${a.companion?' · ผู้ติดตาม: '+a.companion:''}${a.departTime?' · ออก: '+a.departTime:''}${a.transportNote?' ('+a.transportNote+')':''}</div>
            ${a.cardPhotoUrl?`<div style="margin-top:6px;"><img src="${a.cardPhotoUrl}" style="height:40px;border-radius:6px;cursor:pointer;border:1px solid var(--border);" onclick="showPhotoModal('${a.cardPhotoUrl}')" title="บัตรนัด"></div>`:''}
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
  document.getElementById('appt-date').value        = a?.apptDate     || new Date().toISOString().split('T')[0];
  document.getElementById('appt-time').value        = a?.apptTime     || '';
  document.getElementById('appt-hospital').value    = a?.hospital     || '';
  document.getElementById('appt-department').value  = a?.department   || '';
  document.getElementById('appt-doctor').value      = a?.doctor       || '';
  document.getElementById('appt-purpose').value     = a?.purpose      || '';
  document.getElementById('appt-transport').value   = a?.transport    || 'รถคลินิก';
  document.getElementById('appt-companion').value   = a?.companion    || '';
  document.getElementById('appt-depart-time').value = a?.departTime   || '';
  document.getElementById('appt-transport-note').value = a?.transportNote || '';
  document.getElementById('appt-status').value      = a?.status       || 'upcoming';
  document.getElementById('appt-note').value        = a?.note         || '';
  document.getElementById('appt-card-photo-url').value = a?.cardPhotoUrl || '';
  document.getElementById('appt-card-preview').innerHTML = a?.cardPhotoUrl
    ? `<img src="${a.cardPhotoUrl}" style="height:48px;border-radius:6px;cursor:pointer;" onclick="showPhotoModal('${a.cardPhotoUrl}')">`
    : 'ยังไม่มีรูป';
  // โหลด preparations list
  window._apptPreps = a?.preparations ? [...a.preparations] : [];
  renderApptPrepList();
  openModal('modal-appt');
}

async function saveAppt() {
  const apptDate = document.getElementById('appt-date').value;
  const hospital = document.getElementById('appt-hospital').value.trim();
  if (!apptDate || !hospital) { toast('กรุณาระบุวันที่และโรงพยาบาล','warning'); return; }
  const actor = currentUser?.displayName || currentUser?.username || '';

  // อัปโหลดรูปบัตรนัดถ้ามี
  let cardPhotoUrl = document.getElementById('appt-card-photo-url').value || '';
  const cardFile = document.getElementById('appt-card-input')._pendingFile;
  if (cardFile) {
    try {
      const ext = cardFile.name.split('.').pop();
      const path = `appt_cards/${Date.now()}.${ext}`;
      const { error: upErr } = await supa.storage.from('clinical-photos').upload(path, cardFile);
      if (!upErr) {
        const { data: urlData } = supa.storage.from('clinical-photos').getPublicUrl(path);
        cardPhotoUrl = urlData.publicUrl;
      }
    } catch(e) { console.warn('card photo upload failed', e); }
    document.getElementById('appt-card-input')._pendingFile = null;
  }

  const row = {
    patient_id:     _apptPatId,
    patient_name:   _apptPatName,
    appt_date:      apptDate,
    appt_time:      document.getElementById('appt-time').value,
    hospital,
    department:     document.getElementById('appt-department').value.trim(),
    doctor:         document.getElementById('appt-doctor').value.trim(),
    purpose:        document.getElementById('appt-purpose').value.trim(),
    preparation:    (window._apptPreps||[]).join(', '),
    preparations:   window._apptPreps||[],
    transport:      document.getElementById('appt-transport').value,
    companion:      document.getElementById('appt-companion').value.trim(),
    depart_time:    document.getElementById('appt-depart-time').value,
    transport_note: document.getElementById('appt-transport-note').value.trim(),
    card_photo_url: cardPhotoUrl,
    status:         document.getElementById('appt-status').value,
    note:           document.getElementById('appt-note').value.trim(),
    created_by:     actor,
  };

  // เช็คว่าเปลี่ยนสถานะเป็น cancelled ไหม (สำหรับแจ้งเตือน)
  const prevStatus = _apptEditId ? (db.appointments||[]).find(a=>a.id==_apptEditId)?.status : null;
  const nowCancelled = row.status === 'cancelled' && prevStatus !== 'cancelled';

  if (_apptEditId) {
    const { error } = await supa.from('patient_appointments').update(row).eq('id',_apptEditId);
    if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
    const idx = db.appointments.findIndex(a=>a.id==_apptEditId);
    if(idx>=0) db.appointments[idx] = mapAppointment({id:_apptEditId,...row});

    if (nowCancelled) {
      // ยกเลิกนัด → ลบออกจาก Calendar + แจ้ง LINE/Email
      const cancelMsg = `❌ ยกเลิกนัด วันที่ ${apptDate}\n━━━━━━━━━━━━━━\n👤 ${_apptPatName}\n🏥 ${hospital} ${row.appt_time||''}\n🎯 ${row.purpose||'-'}`;
      sendLineNotify('appt_cancelled', cancelMsg, { appt_id: _apptEditId });
    } else {
      // แก้ไขนัด → อัปเดต Calendar
      _syncCalendar('appt_update', { ...row, appt_id: _apptEditId, patient_name: _apptPatName, preparations: window._apptPreps||[] });
    }
    toast('บันทึกนัดหมายเรียบร้อย','success');
  } else {
    const {data:ins,error} = await supa.from('patient_appointments').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    db.appointments.push(mapAppointment(ins));
    // บันทึกนัดใหม่ → เพิ่มใน Calendar ทันที (ไม่แจ้ง LINE — Cron จะแจ้ง 3/1 วัน)
    _syncCalendar('appt_save', { ...row, appt_id: ins.id, patient_name: _apptPatName, preparations: window._apptPreps||[] });
    toast('เพิ่มนัดหมายเรียบร้อย','success');
  }
  closeModal('modal-appt');
  const listEl = document.getElementById('appt-list-'+_apptPatId);
  if(listEl) listEl.innerHTML = renderApptList(_apptPatId);
  renderUpcomingAppts();
}

// ส่ง event ไป Edge Function สำหรับ Google Calendar (ไม่แจ้ง LINE/Email)
async function _syncCalendar(event, data) {
  const EDGE_URL = 'https://umueucsxowjaurlaubwa.supabase.co/functions/v1/line-notify';
  try {
    await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': window._supabaseKey || '' },
      body: JSON.stringify({ event, data }),
    });
    console.log('[Calendar] sync:', event, data.appt_id);
  } catch(e) {
    console.warn('[Calendar] sync failed:', e.message);
  }
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
  // ลบออกจาก Google Calendar ด้วย
  _syncCalendar('appt_delete', { appt_id: id });
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