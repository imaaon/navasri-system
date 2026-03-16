// ===== CLINICAL NURSING =====

// ==========================================
// ===== NURSING NOTES ======================
// ==========================================
const SHIFTS = ['เช้า','ดึก'];
const SHIFT_TIMES = {'เช้า':'07:00–19:00','ดึก':'19:00–07:00'};
const SHIFT_COLORS = {'เช้า':'#e67e22','ดึก':'#8e44ad'};

function renderNursingTab(pid, patientId) {
  const notes = (db.nursingNotes[pid]||[]);
  const today = new Date().toISOString().split('T')[0];
  const currentShift = getCurrentShift();

  // Group by date
  const byDate = {};
  notes.forEach(n => {
    if(!byDate[n.date]) byDate[n.date]=[];
    byDate[n.date].push(n);
  });

  const noteCards = Object.entries(byDate).slice(0,14).map(([date, dayNotes]) => {
    const shiftCards = SHIFTS.map(shift => {
      const note = dayNotes.find(n=>n.shift===shift);
      const c = SHIFT_COLORS[shift];
      if (!note) return `
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:10px 14px;flex:1;min-width:200px;opacity:.6;">
          <div style="font-size:11px;font-weight:700;color:${c};">กะ${shift} <span style="font-weight:400;color:var(--text3);">(${SHIFT_TIMES[shift]})</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:6px;">ยังไม่มีบันทึก</div>
          ${date===today?`<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px;" onclick="openAddNursingModal('${patientId}','${date}','${shift}')">+ บันทึก</button>`:''}
        </div>`;
      return `
        <div style="border:1.5px solid ${c}33;border-radius:8px;padding:10px 14px;flex:1;min-width:200px;background:${c}08;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-size:11px;font-weight:700;color:${c};">กะ${shift} <span style="font-weight:400;color:var(--text3);">(${SHIFT_TIMES[shift]})</span></div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="editNursingNote('${patientId}','${pid}','${note.id}')">✏️</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="deleteNursingNote('${patientId}','${pid}','${note.id}')">🗑️</button>
            </div>
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:3px;">
            ${note.generalCondition?`<div>🧍 <strong>อาการทั่วไป:</strong> ${note.generalCondition}</div>`:''}
            ${note.consciousness?`<div>🧠 <strong>ความรู้สึกตัว:</strong> ${note.consciousness}</div>`:''}
            ${note.pain?`<div>😣 <strong>อาการปวด:</strong> ${note.pain}</div>`:''}
            ${note.eating?`<div>🍽️ <strong>การรับประทานอาหาร:</strong> ${note.eating}</div>`:''}
            ${note.elimination?`<div>🚽 <strong>การขับถ่าย:</strong> ${note.elimination}</div>`:''}
            ${note.sleep?`<div>😴 <strong>การนอนหลับ:</strong> ${note.sleep}</div>`:''}
            ${note.activity?`<div>🏃 <strong>กิจกรรม:</strong> ${note.activity}</div>`:''}
            ${note.wound?`<div>🩹 <strong>แผล/สาย:</strong> ${note.wound}</div>`:''}
            ${note.iv?`<div>💉 <strong>IV/สาย:</strong> ${note.iv}</div>`:''}
            ${note.o2?`<div>🫁 <strong>O₂:</strong> ${note.o2}</div>`:''}
          </div>
          ${note.handoverNote?`<div style="margin-top:8px;padding:6px 10px;background:${c}15;border-radius:5px;border-left:3px solid ${c};font-size:12px;"><strong>📢 ส่งเวร:</strong> ${note.handoverNote}</div>`:''}
          <div style="font-size:11px;color:var(--text3);margin-top:6px;">บันทึกโดย: ${note.recordedBy||'-'}</div>
        </div>`;
    }).join('');
    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          📅 ${date} ${date===today?'<span style="background:#27ae60;color:white;border-radius:10px;font-size:10px;padding:1px 8px;">วันนี้</span>':''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">${shiftCards}</div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📋 บันทึกทางการพยาบาล</div>
        <button class="btn btn-primary btn-sm" onclick="openAddNursingModal('${patientId}','${today}','${currentShift}')">+ บันทึกกะนี้</button>
      </div>
      <div style="padding:16px;">
        ${noteCards || `<div style="text-align:center;padding:32px;color:var(--text3);">ยังไม่มีบันทึก</div>`}
      </div>
    </div>`;
}

function getCurrentShift() {
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'เช้า' : 'ดึก';
}

let _nursingEditId = null;
function openAddNursingModal(patientId, date, shift, noteId=null) {
  _nursingEditId = noteId;
  document.getElementById('nursing-pat-id').value = patientId;
  document.getElementById('nursing-date').value = date || new Date().toISOString().split('T')[0];
  document.getElementById('nursing-shift').value = shift || getCurrentShift();
  document.getElementById('nursing-by').value = currentUser?.displayName || currentUser?.username || '';
  // Clear all fields
  ['nursing-condition','nursing-consciousness','nursing-pain','nursing-eating',
   'nursing-elimination','nursing-sleep','nursing-activity','nursing-wound',
   'nursing-iv','nursing-o2','nursing-handover'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  if (noteId) {
    const pid = String(patientId);
    const note = (db.nursingNotes[pid]||[]).find(n=>n.id==noteId);
    if (note) {
      document.getElementById('nursing-condition').value    = note.generalCondition||'';
      document.getElementById('nursing-consciousness').value= note.consciousness||'';
      document.getElementById('nursing-pain').value         = note.pain||'';
      document.getElementById('nursing-eating').value       = note.eating||'';
      document.getElementById('nursing-elimination').value  = note.elimination||'';
      document.getElementById('nursing-sleep').value        = note.sleep||'';
      document.getElementById('nursing-activity').value     = note.activity||'';
      document.getElementById('nursing-wound').value        = note.wound||'';
      document.getElementById('nursing-iv').value           = note.iv||'';
      document.getElementById('nursing-o2').value           = note.o2||'';
      document.getElementById('nursing-handover').value     = note.handoverNote||'';
      document.getElementById('nursing-by').value           = note.recordedBy||'';
    }
  }
  document.getElementById('modal-nursing-title').textContent = noteId ? '✏️ แก้ไขบันทึกพยาบาล' : '📋 บันทึกทางการพยาบาล';
  openModal('modal-add-nursing');
}
function editNursingNote(patientId, pid, noteId) {
  const note = (db.nursingNotes[pid]||[]).find(n=>n.id==noteId);
  if(note) openAddNursingModal(patientId, note.date, note.shift, noteId);
}

async function saveNursingNote() {
  const patientId = document.getElementById('nursing-pat-id').value;
  const date  = document.getElementById('nursing-date').value;
  const shift = document.getElementById('nursing-shift').value;
  if (!date || !shift) { toast('กรุณาระบุวันที่และกะ','warning'); return; }
  const data = {
    patient_id: patientId, date, shift,
    recorded_by:       document.getElementById('nursing-by').value.trim(),
    general_condition: document.getElementById('nursing-condition').value.trim(),
    consciousness:     document.getElementById('nursing-consciousness').value.trim(),
    pain:              document.getElementById('nursing-pain').value.trim(),
    eating:            document.getElementById('nursing-eating').value.trim(),
    elimination:       document.getElementById('nursing-elimination').value.trim(),
    sleep:             document.getElementById('nursing-sleep').value.trim(),
    activity:          document.getElementById('nursing-activity').value.trim(),
    wound:             document.getElementById('nursing-wound').value.trim(),
    iv:                document.getElementById('nursing-iv').value.trim(),
    o2:                document.getElementById('nursing-o2').value.trim(),
    handover_note:     document.getElementById('nursing-handover').value.trim(),
  };
  const pid = String(patientId);
  if (_nursingEditId) {
    const { error } = await supa.from('nursing_notes').update(data).eq('id', _nursingEditId);
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    const idx = (db.nursingNotes[pid]||[]).findIndex(n=>n.id==_nursingEditId);
    if(idx>=0) db.nursingNotes[pid][idx] = mapNursingNote({id:_nursingEditId,...data,created_at:db.nursingNotes[pid][idx].createdAt});
    toast('แก้ไขบันทึกแล้ว','success');
  } else {
    const { data: ins, error } = await supa.from('nursing_notes').insert(data).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if(!db.nursingNotes[pid]) db.nursingNotes[pid]=[];
    db.nursingNotes[pid].unshift(mapNursingNote(ins));
    toast(`บันทึกกะ${shift} เรียบร้อย`,'success');
  }
  closeModal('modal-add-nursing');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

async function deleteNursingNote(patientId, pid, id) {
  if(!confirm('ลบบันทึกนี้?')) return;
  await supa.from('nursing_notes').delete().eq('id', id);
  db.nursingNotes[pid] = (db.nursingNotes[pid]||[]).filter(n=>n.id!=id);
  toast('ลบแล้ว');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

// ===== DISCHARGE MANAGEMENT =====
function onPatStatusChange(sel) {
  const editId = document.getElementById('pat-edit-id')?.value;
  if (sel.value === 'inactive' && editId) {
    const p = db.patients.find(x => x.id == editId);
    if (p && p.status === 'active') {
      sel.value = 'active'; // reset ไว้ก่อน
      openDischargeModal(editId);
    }
  }
}

function openDischargeModal(patientId) {
  const p = db.patients.find(x => x.id == patientId);
  if (!p) return;
  document.getElementById('discharge-patient-id').value = patientId;
  document.getElementById('discharge-patient-name').textContent = p.name;
  document.getElementById('discharge-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('discharge-reason').value = 'กลับบ้าน';
  document.getElementById('discharge-summary').value = '';
  openModal('modal-discharge');
}

async function saveDischarge() {
  const patId  = document.getElementById('discharge-patient-id').value;
  const date   = document.getElementById('discharge-date').value;
  const reason = document.getElementById('discharge-reason').value;
  const summary = document.getElementById('discharge-summary').value.trim();
  if (!date || !reason) { toast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }

  const p = db.patients.find(x => x.id == patId);
  if (!p) return;

  // อัปเดตสถานะคนไข้
  const { error } = await supa.from('patients').update({
    status: 'inactive',
    end_date: date,
    discharge_reason: reason,
    discharge_summary: summary,
    discharged_by: currentUser?.displayName || currentUser?.username || ''
  }).eq('id', patId);

  if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }

  // คืนเตียง
  if (p.currentBedId) {
    await supa.from('beds').update({ status: 'available' }).eq('id', p.currentBedId);
    const bed = db.beds.find(b => b.id == p.currentBedId);
    if (bed) bed.status = 'available';
  }

  p.status = 'inactive';
  p.endDate = date;

  toast(`🚪 จำหน่าย ${p.name} เรียบร้อย (${reason})`, 'success');
  closeModal('modal-discharge');
  closeModal('modal-addPatient');
  renderPatients();
}