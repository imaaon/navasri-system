// ===== CLINICAL NURSING =====

// ==========================================
// ===== NURSING NOTES ======================
// ==========================================
const SHIFTS = ['à¹à¸à¹à¸²','à¸à¸¶à¸'];
const SHIFT_TIMES = {'à¹à¸à¹à¸²':'07:00â19:00','à¸à¸¶à¸':'19:00â07:00'};
const SHIFT_COLORS = {'à¹à¸à¹à¸²':'#e67e22','à¸à¸¶à¸':'#8e44ad'};

function renderNursingTab(pid, patientId) {
  const notes = (db.nursingNotes[pid]||[]);
  const today = new Date().toISOString().split('T')[0];

  // Group by date, sort desc
  const byDate = {};
  notes.forEach(n => {
    if(!byDate[n.date]) byDate[n.date]=[];
    byDate[n.date].push(n);
  });
  // Sort entries by time within each date
  Object.values(byDate).forEach(arr => arr.sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00')));

  const noteCards = Object.entries(byDate)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .slice(0,30)
    .map(([date, dayNotes]) => {
      const isToday = date === today;
      const dateLabel = isToday ? 'ð à¸§à¸±à¸à¸à¸µà¹' : 'ð '+date;
      const entryRows = dayNotes.map(note => `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start;">
          <div style="flex-shrink:0;min-width:48px;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:var(--accent);">${note.time||'--:--'}</div>
          </div>
          <div style="flex:1;font-size:13px;line-height:1.6;white-space:pre-wrap;">${[
              note.generalCondition ? 'ð§ à¸­à¸²à¸à¸²à¸£: ' + note.generalCondition : '',
              note.consciousness    ? 'ð§  à¸à¸§à¸²à¸¡à¸£à¸¹à¹à¸ªà¸¶à¸à¸à¸±à¸§: ' + note.consciousness : '',
              note.pain             ? 'ð£ à¸à¸§à¸: ' + note.pain : '',
              note.eating           ? 'ð½ï¸ à¸­à¸²à¸«à¸²à¸£: ' + note.eating : '',
              note.elimination      ? 'ð½ à¸à¸±à¸à¸à¹à¸²à¸¢: ' + note.elimination : '',
              note.sleep            ? 'ð´ à¸à¸­à¸: ' + note.sleep : '',
              note.activity         ? 'ð à¸à¸´à¸à¸à¸£à¸£à¸¡: ' + note.activity : '',
              note.wound            ? 'ð©¹ à¹à¸à¸¥: ' + note.wound : '',
              note.iv               ? 'ð IV: ' + note.iv : '',
              note.o2               ? 'ð« Oâ: ' + note.o2 : '',
              note.handoverNote     ? 'ð à¸ªà¹à¸à¹à¸§à¸£: ' + note.handoverNote : '',
            ].filter(Boolean).join('\n') || '-'}</div>
          <div style="flex-shrink:0;font-size:11px;color:var(--text3);text-align:right;">
            ${note.by||''}<br>
            <div style="display:flex;gap:4px;margin-top:2px;">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="editNursingNote('${patientId}','${pid}','${note.id}')">âï¸</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;color:#e74c3c;" onclick="deleteNursingNote('${patientId}','${pid}','${note.id}')">ðï¸</button>
            </div>
          </div>
        </div>`).join('');

      return `
        <div style="border:1.5px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:var(--surface2);">
            <div style="font-size:12px;font-weight:700;color:${isToday?'var(--accent)':'var(--text2)'};">${dateLabel}</div>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="openAddNursingModal('${patientId}','${date}','')">+ à¹à¸à¸´à¹à¸¡à¸à¸±à¸à¸à¸¶à¸</button>
          </div>
          <div style="padding:0 14px;">${entryRows}</div>
        </div>`;
    }).join('');

  const addTodayBtn = !byDate[today] ? `
    <div style="padding:16px;text-align:center;">
      <button class="btn btn-primary" onclick="openAddNursingModal('${patientId}','${today}','')">+ à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸à¸à¸²à¸£à¸à¸¢à¸²à¸à¸²à¸¥à¸§à¸±à¸à¸à¸µà¹</button>
    </div>` : '';

  return `<div class="card">
    <div class="card-header">
      <div class="card-title" style="font-size:13px;">ð à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸à¸à¸²à¸£à¸à¸¢à¸²à¸à¸²à¸¥ (${notes.length} à¸£à¸²à¸¢à¸à¸²à¸£)</div>
      <button class="btn btn-primary btn-sm" onclick="openAddNursingModal('${patientId}','${today}','')">+ à¸à¸±à¸à¸à¸¶à¸à¹à¸«à¸¡à¹</button>
    </div>
    <div style="padding:12px 16px;">
      ${addTodayBtn}
      ${noteCards || '<div style="padding:24px;text-align:center;color:var(--text3);">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¸±à¸à¸à¸¶à¸</div>'}
    </div>
  </div>`;
}

function getCurrentShift() {
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'à¹à¸à¹à¸²' : 'à¸à¸¶à¸';
}

let _nursingEditId = null;
function openAddNursingModal(patientId, date, shift, noteId=null) {
  _nursingEditId = noteId;
  {const _e=document.getElementById('nursing-pat-id');if(_e)_e.value=patientId;}
  {const _e=document.getElementById('nursing-date');if(_e)_e.value=date || new Date().toISOString().split('T')[0];}
  {const _e=document.getElementById('nursing-shift');if(_e)_e.value=shift || getCurrentShift();}
  const nowTime = new Date().toTimeString().slice(0,5);
  {const _e=document.getElementById('nursing-time');if(_e)_e.value=nowTime;}
  {const _e=document.getElementById('nursing-by');if(_e)_e.value=currentUser?.displayName || currentUser?.username || '';}
  // Clear all fields
  ['nursing-condition','nursing-consciousness','nursing-eating',
   'nursing-sleep','nursing-activity','nursing-wound',
   'nursing-iv','nursing-o2','nursing-handover'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  if (noteId) {
    const pid = String(patientId);
    const note = (db.nursingNotes[pid]||[]).find(n=>n.id==noteId);
    if (note) {
      {const _e=document.getElementById('nursing-condition');if(_e)_e.value=note.generalCondition||'';}
      {const _e=document.getElementById('nursing-consciousness');if(_e)_e.value=note.consciousness||'';}
      {const _e=document.getElementById('nursing-pain');if(_e)_e.value=note.pain||'';}
      {const _e=document.getElementById('nursing-eating');if(_e)_e.value=note.eating||'';}
      // elimination removed
      {const _e=document.getElementById('nursing-sleep');if(_e)_e.value=note.sleep||'';}
      {const _e=document.getElementById('nursing-activity');if(_e)_e.value=note.activity||'';}
      {const _e=document.getElementById('nursing-wound');if(_e)_e.value=note.wound||'';}
      {const _e=document.getElementById('nursing-iv');if(_e)_e.value=note.iv||'';}
      {const _e=document.getElementById('nursing-o2');if(_e)_e.value=note.o2||'';}
      {const _e=document.getElementById('nursing-handover');if(_e)_e.value=note.handoverNote||'';}
      {const _e=document.getElementById('nursing-by');if(_e)_e.value=note.recordedBy||'';}
      {const _e=document.getElementById('nursing-time');if(_e)_e.value=note.time||nowTime;}
    }
  }
  document.getElementById('modal-nursing-title').textContent = noteId ? 'âï¸ à¹à¸à¹à¹à¸à¸à¸±à¸à¸à¸¶à¸à¸à¸¢à¸²à¸à¸²à¸¥' : 'ð à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸à¸à¸²à¸£à¸à¸¢à¸²à¸à¸²à¸¥';
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
  const time  = document.getElementById('nursing-time')?.value || '';
  if (!date) { toast('à¸à¸£à¸¸à¸à¸²à¸£à¸°à¸à¸¸à¸§à¸±à¸à¸à¸µà¹','warning'); return; }
  const time_val = document.getElementById('nursing-time')?.value || '';
  if (!time_val) { toast('à¸à¸£à¸¸à¸à¸²à¸£à¸°à¸à¸¸à¹à¸§à¸¥à¸²à¸à¸µà¹à¸à¸±à¸à¸à¸¶à¸','warning'); return; }
  const data = {
    patient_id: patientId, date, shift, time,
    recorded_by:       document.getElementById('nursing-by').value.trim(),
    general_condition: document.getElementById('nursing-condition').value.trim(),
    consciousness:     document.getElementById('nursing-consciousness').value.trim(),
    pain:              (document.getElementById('nursing-pain')?.value||'').trim(),
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
    if (error) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
    const idx = (db.nursingNotes[pid]||[]).findIndex(n=>n.id==_nursingEditId);
    if(!db.nursingNotes) db.nursingNotes={};
            if(!db.nursingNotes[pid]) db.nursingNotes[pid]=[];
            if(idx>=0) db.nursingNotes[pid][idx] = mapNursingNote({id:_nursingEditId,...data,created_at:db.nursingNotes[pid][idx].createdAt});
    toast('à¹à¸à¹à¹à¸à¸à¸±à¸à¸à¸¶à¸à¹à¸¥à¹à¸§','success');
  } else {
    const { data: ins, error } = await supa.from('nursing_notes').insert(data).select().single();
    if (error) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
    if(!db.nursingNotes) db.nursingNotes={};
            if(!db.nursingNotes[pid]) db.nursingNotes[pid]=[];
    db.nursingNotes[pid].unshift(mapNursingNote(ins));
    toast(`à¸à¸±à¸à¸à¸¶à¸à¸à¸°${shift} à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢`,'success');
  }
  closeModal('modal-add-nursing');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

async function deleteNursingNote(patientId, pid, id) {
  if(!confirm('à¸¥à¸à¸à¸±à¸à¸à¸¶à¸à¸à¸µà¹?')) return;
  const { error } = await supa.from('nursing_notes').delete().eq('id', id);
  if (error) { toast('à¸¥à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: ' + error.message, 'error'); return; }
  db.nursingNotes[pid] = (db.nursingNotes[pid]||[]).filter(n=>n.id!=id);
  toast('à¸¥à¸à¹à¸¥à¹à¸§');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

// ===== DISCHARGE MANAGEMENT =====
function onPatStatusChange(sel) {
  const editId = document.getElementById('pat-edit-id')?.value;
  if (sel.value === 'inactive' && editId) {
    const p = db.patients.find(x => x.id == editId);
    if (p && p.status === 'active') {
      sel.value = 'active'; // reset à¹à¸§à¹à¸à¹à¸­à¸
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
  document.getElementById('discharge-reason').value = 'à¸à¸¥à¸±à¸à¸à¹à¸²à¸';
  document.getElementById('discharge-summary').value = '';
  openModal('modal-discharge');
}

async function saveDischarge() {
  const patId  = document.getElementById('discharge-patient-id').value;
  const date   = document.getElementById('discharge-date').value;
  const reason = document.getElementById('discharge-reason').value;
  const summary = document.getElementById('discharge-summary').value.trim();
  if (!date || !reason) { toast('à¸à¸£à¸¸à¸à¸²à¸à¸£à¸­à¸à¸à¹à¸­à¸¡à¸¹à¸¥à¹à¸«à¹à¸à¸£à¸', 'warning'); return; }

  const p = db.patients.find(x => x.id == patId);
  if (!p) return;

  // à¸­à¸±à¸à¹à¸à¸à¸ªà¸à¸²à¸à¸°à¸à¸à¹à¸à¹
  const { error } = await supa.from('patients').update({
    status: 'inactive',
    end_date: date,
    discharge_reason: reason,
    discharge_summary: summary,
    discharged_by: currentUser?.displayName || currentUser?.username || ''
  }).eq('id', patId);

  if (error) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: ' + error.message, 'error'); return; }

  // à¸à¸·à¸à¹à¸à¸µà¸¢à¸
  if (p.currentBedId) {
    await supa.from('beds').update({ status: 'available' }).eq('id', p.currentBedId);
    const bed = db.beds.find(b => b.id == p.currentBedId);
    if (bed) bed.status = 'available';
  }

  p.status = 'inactive';
  p.endDate = date;

  toast(`ðª à¸à¸³à¸«à¸à¹à¸²à¸¢ ${p.name} à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢ (${reason})`, 'success');
  closeModal('modal-discharge');
  closeModal('modal-addPatient');
  renderPatients();
}