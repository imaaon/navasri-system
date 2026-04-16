// ===== CLINICAL NURSING =====

// ==========================================
// ===== NURSING NOTES ======================
// ==========================================
const SHIFTS = ['ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²','ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ'];
const SHIFT_TIMES = {'ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²':'07:00ÃÂ¢ÃÂÃÂ19:00','ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ':'19:00ÃÂ¢ÃÂÃÂ07:00'};
const SHIFT_COLORS = {'ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²':'#e67e22','ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ':'#8e44ad'};

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
      const dateLabel = isToday ? 'ÃÂ°ÃÂÃÂÃÂ ÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¹ÃÂ' : 'ÃÂ°ÃÂÃÂÃÂ '+date;
      const entryRows = dayNotes.map(note => `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start;">
          <div style="flex-shrink:0;min-width:48px;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:var(--accent);">${note.time||'--:--'}</div>
          </div>
          <div style="flex:1;font-size:13px;line-height:1.6;white-space:pre-wrap;">${[
              note.generalCondition ? 'ÃÂ°ÃÂÃÂ§ÃÂ ÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£: ' + note.generalCondition : '',
              note.consciousness    ? 'ÃÂ°ÃÂÃÂ§ÃÂ  ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ¹ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂ§: ' + note.consciousness : '',
              note.pain             ? 'ÃÂ°ÃÂÃÂÃÂ£ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ: ' + note.pain : '',
              note.eating           ? 'ÃÂ°ÃÂÃÂÃÂ½ÃÂ¯ÃÂ¸ÃÂ ÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ«ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£: ' + note.eating : '',
              note.elimination      ? 'ÃÂ°ÃÂÃÂÃÂ½ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¢: ' + note.elimination : '',
              note.sleep            ? 'ÃÂ°ÃÂÃÂÃÂ´ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ: ' + note.sleep : '',
              note.activity         ? 'ÃÂ°ÃÂÃÂÃÂ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ´ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ¡: ' + note.activity : '',
              note.wound            ? 'ÃÂ°ÃÂÃÂ©ÃÂ¹ ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¥: ' + note.wound : '',
              note.iv               ? 'ÃÂ°ÃÂÃÂÃÂ IV: ' + note.iv : '',
              note.o2               ? 'ÃÂ°ÃÂÃÂ«ÃÂ OÃÂ¢ÃÂÃÂ: ' + note.o2 : '',
              note.handoverNote     ? 'ÃÂ°ÃÂÃÂÃÂ ÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ£: ' + note.handoverNote : '',
            ].filter(Boolean).join('\n') || '-'}</div>
          <div style="flex-shrink:0;font-size:11px;color:var(--text3);text-align:right;">
            ${note.by||''}<br>
            <div style="display:flex;gap:4px;margin-top:2px;">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="editNursingNote('${patientId}','${pid}','${note.id}')">ÃÂ¢ÃÂÃÂÃÂ¯ÃÂ¸ÃÂ</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;color:#e74c3c;" onclick="deleteNursingNote('${patientId}','${pid}','${note.id}')">ÃÂ°ÃÂÃÂÃÂÃÂ¯ÃÂ¸ÃÂ</button>
            </div>
          </div>
        </div>`).join('');

      return `
        <div style="border:1.5px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:var(--surface2);">
            <div style="font-size:12px;font-weight:700;color:${isToday?'var(--accent)':'var(--text2)'};">${dateLabel}</div>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="openAddNursingModal('${patientId}','${date}','')">+ ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ´ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ</button>
          </div>
          <div style="padding:0 14px;">${entryRows}</div>
        </div>`;
    }).join('');

  const addTodayBtn = !byDate[today] ? `
    <div style="padding:16px;text-align:center;">
      <button class="btn btn-primary" onclick="openAddNursingModal('${patientId}','${today}','')">+ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¹ÃÂ</button>
    </div>` : '';

  return `<div class="card">
    <div class="card-header">
      <div class="card-title" style="font-size:13px;">ÃÂ°ÃÂÃÂÃÂ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¥ (${notes.length} ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£)</div>
      <button class="btn btn-primary btn-sm" onclick="openAddNursingModal('${patientId}','${today}','')">+ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ«ÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂ</button>
    </div>
    <div style="padding:12px 16px;">
      ${addTodayBtn}
      ${noteCards || '<div style="padding:24px;text-align:center;color:var(--text3);">ÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ</div>'}
    </div>
  </div>`;
}

function getCurrentShift() {
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²' : 'ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ';
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
  document.getElementById('modal-nursing-title').textContent = noteId ? 'ÃÂ¢ÃÂÃÂÃÂ¯ÃÂ¸ÃÂ ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¥' : 'ÃÂ°ÃÂÃÂÃÂ ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¥';
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
  if (!date) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ¸ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ°ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¸ÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¹ÃÂ','warning'); return; }
  const time_val = document.getElementById('nursing-time')?.value || '';
  if (!time_val) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ¸ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ°ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¸ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂ','warning'); return; }
  const data = {
    patient_id: patientId, date, shift, time,
    recorded_by:       document.getElementById('nursing-by').value.trim(),
    general_condition: document.getElementById('nursing-condition').value.trim(),
    consciousness:     document.getElementById('nursing-consciousness').value.trim(),
    pain:              (document.getElementById('nursing-pain')?.value||'').trim(),
    eating:            document.getElementById('nursing-eating').value.trim(),
    pain:       document.getElementById('nursing-pain').value.trim(),
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
    if (error) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂ³ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ: '+error.message,'error'); return; }
    const idx = (db.nursingNotes[pid]||[]).findIndex(n=>n.id==_nursingEditId);
    if(!db.nursingNotes) db.nursingNotes={};
            if(!db.nursingNotes[pid]) db.nursingNotes[pid]=[];
            if(idx>=0) db.nursingNotes[pid][idx] = mapNursingNote({id:_nursingEditId,...data,created_at:db.nursingNotes[pid][idx].createdAt});
    toast('ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ§','success');
  } else {
    const { data: ins, error } = await supa.from('nursing_notes').insert(data).select().single();
    if (error) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂ³ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ: '+error.message,'error'); return; }
    if(!db.nursingNotes) db.nursingNotes={};
            if(!db.nursingNotes[pid]) db.nursingNotes[pid]=[];
    db.nursingNotes[pid].unshift(mapNursingNote(ins));
    toast(`ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ°${shift} ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ¢`,'success');
  }
  closeModal('modal-add-nursing');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

async function deleteNursingNote(patientId, pid, id) {
  if(!confirm('ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¹ÃÂ?')) return;
  const { error } = await supa.from('nursing_notes').delete().eq('id', id);
  if (error) { toast('ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂ³ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ: ' + error.message, 'error'); return; }
  db.nursingNotes[pid] = (db.nursingNotes[pid]||[]).filter(n=>n.id!=id);
  toast('ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ§');
  document.getElementById('patprofile-tab-nursing').innerHTML = renderNursingTab(pid, patientId);
}

// ===== DISCHARGE MANAGEMENT =====
function onPatStatusChange(sel) {
  const editId = document.getElementById('pat-edit-id')?.value;
  if (sel.value === 'inactive' && editId) {
    const p = db.patients.find(x => x.id == editId);
    if (p && p.status === 'active') {
      sel.value = 'active'; // reset ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ§ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ
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
  document.getElementById('discharge-reason').value = 'ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ';
  document.getElementById('discharge-summary').value = '';
  openModal('modal-discharge');
}

async function saveDischarge() {
  const patId  = document.getElementById('discharge-patient-id').value;
  const date   = document.getElementById('discharge-date').value;
  const reason = document.getElementById('discharge-reason').value;
  const summary = document.getElementById('discharge-summary').value.trim();
  if (!date || !reason) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ¸ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¸ÃÂ¹ÃÂ ÃÂ¸ÃÂ¥ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ«ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂ', 'warning'); return; }

  const p = db.patients.find(x => x.id == patId);
  if (!p) return;

  // ÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ°ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂ
  const { error } = await supa.from('patients').update({
    status: 'inactive',
    end_date: date,
    discharge_reason: reason,
    discharge_summary: summary,
    discharged_by: currentUser?.displayName || currentUser?.username || ''
  }).eq('id', patId);

  if (error) { toast('ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ±ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ¶ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ¡ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂªÃÂ ÃÂ¸ÃÂ³ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ: ' + error.message, 'error'); return; }

  // ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ·ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂ
  if (p.currentBedId) {
    await supa.from('beds').update({ status: 'available' }).eq('id', p.currentBedId);
    const bed = db.beds.find(b => b.id == p.currentBedId);
    if (bed) bed.status = 'available';
  }

  p.status = 'inactive';
  p.endDate = date;

  toast(`ÃÂ°ÃÂÃÂÃÂª ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ³ÃÂ ÃÂ¸ÃÂ«ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ²ÃÂ ÃÂ¸ÃÂ¢ ${p.name} ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¸ÃÂµÃÂ ÃÂ¸ÃÂ¢ÃÂ ÃÂ¸ÃÂÃÂ ÃÂ¸ÃÂ£ÃÂ ÃÂ¹ÃÂÃÂ ÃÂ¸ÃÂ­ÃÂ ÃÂ¸ÃÂ¢ (${reason})`, 'success');
  closeModal('modal-discharge');
  closeModal('modal-addPatient');
  renderPatients();
}