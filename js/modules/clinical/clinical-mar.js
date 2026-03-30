
function openEditMedModal(patientId, pid, medId) {
  const meds = db.medications[pid] || [];
  const med = meds.find(m => m.id == medId);
  if (!med) return;
  document.getElementById('med-pat-id').value = patientId;
  document.getElementById('med-pat-id').dataset.editId = medId;
  document.getElementById('med-pat-id').dataset.pid = pid;
  document.getElementById('med-name').value = med.name || '';
  document.getElementById('med-dose').value = med.dose || '';
  document.getElementById('med-unit').value = med.unit || 'mg';
  document.getElementById('med-route').value = med.route || 'ทาน';
  document.getElementById('med-note').value = med.note || '';
  document.getElementById('med-start').value = med.startDate || '';
  document.getElementById('med-end').value = med.endDate || '';
  MAR_TIMINGS.forEach(t => {
    const cb = document.getElementById('med-timing-'+t.replace(/[^a-zA-Zก-๙]/g,'_'));
    if (cb) cb.checked = (med.timing||[]).includes(t);
  });
  document.querySelector('#modal-add-medication .modal-title').textContent = '✏️ แก้ไขยาประจำ';
  openModal('modal-add-medication');
}
// ===== CLINICAL: MAR (Medication Admin Record) =====

// ==========================================
const MAR_TIMINGS = ['เช้า','กลางวัน','เย็น','ก่อนนอน','ก่อนอาหาร','หลังอาหาร','PRN (เมื่อมีอาการ)'];

function renderMARTab(pid, patientId) {
  const meds = (db.medications[pid]||[]).filter(m => m.isActive);
  const mar  = (db.marRecords[pid]||[]);

  // Today & filter
  const today = new Date().toISOString().split('T')[0];
  const todayMar = mar.filter(r => r.date === today);

  const medRows = meds.length === 0 ? '' : `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div>
          <div class="card-title" style="font-size:13px;">💊 รายการยาประจำของผู้รับบริการ</div>
          <div style="font-size:12px;color:var(--text3);">คลิก "บันทึกการให้" เพื่อกรอกข้อมูลการให้ยาแต่ละครั้ง</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAddMedModal('${patientId}')">+ เพิ่มยา</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ชื่อยา</th><th>ขนาด / วิธีใช้</th><th>กำหนดให้</th><th>ให้วันนี้ล่าสุด</th><th>ครั้งรวมวันนี้</th><th></th></tr></thead>
          <tbody>
            ${meds.map(med => {
              const todayForMed = todayMar.filter(r => r.medicationId == med.id);
              const lastGiven   = todayForMed.length ? todayForMed.sort((a,b)=>b.givenAt?.localeCompare(a.givenAt||'')||0)[0] : null;
              return `<tr>
                <td style="font-weight:600;">${med.name}</td>
                <td style="font-size:12px;color:var(--text2);">${med.dose||''} ${med.unit||''} ${med.route ? '· '+med.route : ''}</td>
                <td style="font-size:12px;">${(med.timings||[]).join(', ')||'-'}</td>
                <td style="font-size:12px;">${lastGiven ? `<span style="color:#27ae60;font-weight:600;">${lastGiven.givenAt?.slice(11,16)||''}</span> โดย ${lastGiven.givenBy||'-'}` : '<span style="color:var(--text3);">ยังไม่ได้ให้วันนี้</span>'}</td>
                <td style="text-align:center;"><span style="background:${todayForMed.length?'#27ae60':'var(--surface2)'};color:${todayForMed.length?'white':'var(--text3)'};border-radius:10px;padding:2px 10px;font-size:12px;">${todayForMed.length} ครั้ง</span></td>
                <td style="display:flex;gap:4px;">
                  <button class="btn btn-primary btn-sm" onclick="openMAREntryModal('${patientId}','${pid}','${med.id}')">+ บันทึกการให้</button>
                  <button class="btn btn-ghost btn-sm" onclick="openEditMedModal('${patientId}','${pid}','${med.id}')" title="แก้ไข">✏️</button>
                  <button class="btn btn-ghost btn-sm" onclick="deleteMedication('${patientId}','${med.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  if (meds.length === 0) return `
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">💊 MAR — ใบบันทึกการให้ยา</div>
        <button class="btn btn-primary btn-sm" onclick="openAddMedModal('${patientId}')">+ เพิ่มยา</button>
      </div>
      <div style="padding:32px;text-align:center;color:var(--text3);">ยังไม่มีรายการยาประจำ กด "+ เพิ่มยา" เพื่อเริ่มต้น</div>
    </div>`;

  return medRows + `
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📋 ประวัติการให้ยาทั้งหมด</div>
        <input type="date" id="mar-filter-date" class="form-control" style="width:160px;font-size:12px;padding:4px 8px;"
          value="${today}" onchange="document.getElementById('patprofile-tab-mar').innerHTML=renderMARTab('${pid}','${patientId}')">
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วัน</th><th>เวลาให้จริง</th><th>ยา</th><th>ขนาด</th><th>มื้อ/ครั้งที่</th><th>ผู้ให้</th><th>หมายเหตุ</th><th></th></tr></thead>
          <tbody>
            ${(() => {
              const filterDate = document.getElementById('mar-filter-date')?.value || today;
              const filtered = mar.filter(r => r.date === filterDate).sort((a,b)=>(b.givenAt||'').localeCompare(a.givenAt||''));
              return filtered.length ? filtered.map(r => {
                const med = (db.medications[pid]||[]).find(m=>m.id==r.medicationId);
                return `<tr>
                  <td class="number" style="font-size:12px;">${r.date}</td>
                  <td class="number" style="font-weight:600;color:#27ae60;">${r.givenAt ? r.givenAt.slice(11,16) : '-'}</td>
                  <td style="font-weight:500;">${med?.name||'-'}</td>
                  <td style="font-size:12px;color:var(--text2);">${med?.dose||''} ${med?.unit||''}</td>
                  <td><span style="background:var(--sage-light);border-radius:4px;padding:2px 8px;font-size:12px;">${r.timing||'-'}</span></td>
                  <td style="font-size:12px;">${r.givenBy||'-'}</td>
                  <td style="font-size:12px;color:var(--text3);">${r.note||''}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="deleteMAREntry('${pid}','${patientId}','${r.id}')">🗑️</button></td>
                </tr>`;
              }).join('') : '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">ไม่มีรายการวันนี้</td></tr>';
            })()}
          </tbody>
        </table>
      </div>
    </div>`;
}

let _marMedId = null, _marPid = null, _marPatientId = null;
function openMAREntryModal(patientId, pid, medId) {
  _marMedId = medId; _marPid = pid; _marPatientId = patientId;
  const med = (db.medications[pid]||[]).find(m=>m.id==medId);
  document.getElementById('mar-entry-med-name').textContent = med ? `${med.name} ${med.dose||''} ${med.unit||''}` : '';
  document.getElementById('mar-entry-timing').value = med?.timings?.[0] || 'เช้า';
  // Populate timing select with this med's timings
  const sel = document.getElementById('mar-entry-timing');
  const allTimings = med?.timings?.length ? med.timings : MAR_TIMINGS;
  sel.innerHTML = allTimings.map(t=>`<option>${t}</option>`).join('');
  // Default time = now
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  document.getElementById('mar-entry-time').value = localISO;
  document.getElementById('mar-entry-by').value = currentUser?.displayName || currentUser?.username || '';
  document.getElementById('mar-entry-note').value = '';
  openModal('modal-mar-entry');
}

function onMARStatusChange() {
  const status = document.getElementById('mar-entry-status').value;
  const timeField = document.getElementById('mar-entry-time');
  const btn = document.getElementById('mar-entry-btn');
  if (status === 'given') {
    timeField.disabled = false;
    btn.textContent = '✔️ บันทึกการให้ยา';
    btn.style.background = '';
  } else if (status === 'refused') {
    timeField.disabled = false;
    btn.textContent = '❌ บันทึกการปฏิเสธยา';
    btn.style.background = '#c0392b';
  } else {
    timeField.disabled = false;
    btn.textContent = '⏸️ บันทึกการงดยา';
    btn.style.background = '#e67e22';
  }
}

async function saveMAREntry() {
  const timeVal = document.getElementById('mar-entry-time').value;
  const status  = document.getElementById('mar-entry-status').value;
  if (!timeVal) { toast('กรุณาระบุเวลา','warning'); return; }
  const givenAt = new Date(timeVal).toISOString();
  const date    = timeVal.slice(0,10);
  const data = {
    patient_id:    _marPatientId,
    medication_id: _marMedId,
    date, given_at: givenAt,
    status:   status || 'given',
    timing:   document.getElementById('mar-entry-timing').value,
    given_by: document.getElementById('mar-entry-by').value.trim(),
    note:     document.getElementById('mar-entry-note').value.trim(),
  };
  const { data: ins, error } = await supa.from('mar_records').insert(data).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  if(!db.marRecords[_marPid]) db.marRecords[_marPid]=[];
  db.marRecords[_marPid].unshift(mapMarRecord(ins));
  const med = (db.medications[_marPid]||[]).find(m=>m.id==_marMedId);
  toast(`✔️ บันทึกการให้ยา ${med?.name||''} เวลา ${timeVal.slice(11,16)}`, 'success');
  closeModal('modal-mar-entry');
  document.getElementById('patprofile-tab-mar').innerHTML = renderMARTab(_marPid, _marPatientId);
}

async function deleteMAREntry(pid, patientId, id) {
  if(!confirm('ลบรายการนี้?')) return;
  const { error } = await supa.from('mar_records').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.marRecords[pid] = (db.marRecords[pid]||[]).filter(r=>r.id!=id);
  toast('ลบแล้ว');
  document.getElementById('patprofile-tab-mar').innerHTML = renderMARTab(pid, patientId);
}

function openAddMedModal(patientId) {
  document.getElementById('med-pat-id').value = patientId;
  document.getElementById('med-name').value = '';
  document.getElementById('med-dose').value = '';
  document.getElementById('med-unit').value = 'mg';
  document.getElementById('med-route').value = 'ทาน';
  document.getElementById('med-note').value = '';
  document.getElementById('med-start').value = new Date().toISOString().split('T')[0];
  document.getElementById('med-end').value = '';
  MAR_TIMINGS.forEach(t => {
    const cb = document.getElementById('med-timing-'+t.replace(/[^a-zA-Zก-๙]/g,'_'));
    if(cb) cb.checked = false;
  });
  openModal('modal-add-medication');
}

async function saveMedication() {
  const patientId = document.getElementById('med-pat-id').value;
  const name = document.getElementById('med-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อยา','warning'); return; }
  const timings = MAR_TIMINGS.filter(t => {
    const cb = document.getElementById('med-timing-'+t.replace(/[^a-zA-Zก-๙]/g,'_'));
    return cb?.checked;
  });
  if (!timings.length) { toast('กรุณาเลือกอย่างน้อย 1 มื้อ','warning'); return; }
  const data = {
    patient_id: patientId, name,
    dose:  document.getElementById('med-dose').value.trim(),
    unit:  document.getElementById('med-unit').value,
    route: document.getElementById('med-route').value,
    timings, is_active: true,
    start_date: document.getElementById('med-start').value||null,
    end_date:   document.getElementById('med-end').value||null,
    note: document.getElementById('med-note').value.trim(),
  };
  const editId = document.getElementById('med-pat-id').dataset.editId || '';
  const pid = String(document.getElementById('med-pat-id').dataset.pid || patientId);
  let ins, error;
  if (editId) {
    ({data: ins, error} = await supa.from('patient_medications').update(data).eq('id', editId).select().single());
    if (!error && ins) {
      const idx = (db.medications[pid]||[]).findIndex(m => m.id == editId);
      if (idx >= 0) db.medications[pid][idx] = mapMedication(ins);
    }
  } else {
    ({data: ins, error} = await supa.from('patient_medications').insert(data).select().single());
    if (!error) { if(!db.medications[pid]) db.medications[pid]=[]; db.medications[pid].push(mapMedication(ins)); }
  }
  document.getElementById('med-pat-id').dataset.editId = '';
  document.querySelector('#modal-add-medication .modal-title').textContent = '💊 เพิ่มยาประจำ';
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  toast(editId ? `แก้ไขยา "${name}" เรียบร้อย` : `เพิ่มยา "${name}" เรียบร้อย`,'success');
  closeModal('modal-add-medication');
  document.getElementById('patprofile-tab-mar').innerHTML = renderMARTab(pid, patientId);
}

async function deleteMedication(patientId, medId) {
  if(!confirm('หยุดใช้ยานี้?')) return;
  await supa.from('patient_medications').update({is_active:false}).eq('id',medId);
  const pid=String(patientId);
  const m = (db.medications[pid]||[]).find(x=>x.id==medId);
  if(m) m.isActive=false;
  toast('หยุดใช้ยาแล้ว');
  document.getElementById('patprofile-tab-meds').innerHTML = renderMARTab(pid, patientId);
  document.getElementById('patprofile-tab-mar').innerHTML = renderMARTab(pid, patientId);
}

// ==========================================
