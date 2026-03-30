// ===== HEALTH MODULE =====

// ===== MEDICAL LOG SYSTEM =====
function thDateShort(dateStr) {
  if (!dateStr) return '-';
  const [y,m,d] = dateStr.split('-');
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${parseInt(y)+543}`;
}

function renderMedLogTab(patId, type) {
  const p = db.patients.find(x => x.id == patId);
  if (!p) return '';
  const isM = type === 'medical';
  const icon   = isM ? '🏥' : '💊';
  const title  = isM ? 'ประวัติการรักษา / โรคประจำตัว' : 'ประวัติการให้ยา / ยาประจำ';
  const key    = isM ? 'medicalLog' : 'medsLog';
  const logs   = (p[key] || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  const _ = patId; // used below

  const rows = logs.length === 0
    ? `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px;">ยังไม่มีรายการ — กดปุ่ม + เพื่อเพิ่ม</div>`
    : logs.map((entry, i) => `
      <div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:${isM ? 'var(--sage-light)' : '#eef4ff'};border:2px solid ${isM ? 'var(--sage)' : '#a0bde8'};display:flex;align-items:center;justify-content:center;font-size:16px;margin-top:2px;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:4px;">📅 ${thDateShort(entry.date)}</div>
          <div style="font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text1);">${entry.detail}</div>
          ${entry.by ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">บันทึกโดย: ${entry.by}</div>` : ''}
        </div>
        <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="editMedLog('${patId}','${type}',${i})" title="แก้ไข">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteMedLog('${patId}','${type}',${i})" title="ลบ" style="color:#e74c3c;">🗑️</button>
        </div>
      </div>`).join('');

  return `<div class="card">
    <div class="card-header">
      <div class="card-title" style="font-size:13px;">${icon} ${title} (${logs.length} รายการ)</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="exportPatMedExcel('${patId}','${type}')" title="Export Excel" ${logs.length===0?'disabled':''}>📊 Excel</button>
        <button class="btn btn-ghost btn-sm" onclick="exportPatMedPDF('${patId}','${type}')" title="Export PDF" ${logs.length===0?'disabled':''}>📄 PDF</button>
        <button class="btn btn-primary btn-sm" onclick="openAddMedLog('${patId}','${type}')">+ เพิ่มรายการ</button>
      </div>
    </div>
    <div style="padding:0 20px;">${rows}</div>
  </div>`;
}

function openAddMedLog(patId, type) {
  const isM = type === 'medical';
  document.getElementById('medlog-type').value   = type;
  document.getElementById('medlog-patid').value  = patId;
  document.getElementById('medlog-editidx').value = '';
  document.getElementById('medlog-by').value = currentUser?.displayName || currentUser?.username || '';
  document.getElementById('medlog-date').value   = new Date().toISOString().slice(0,10);
  document.getElementById('medlog-detail').value = '';
  document.getElementById('medlog-title').textContent = isM ? '+ ประวัติการรักษา' : '+ ประวัติการให้ยา';
  openModal('modal-addMedLog');
}

function editMedLog(patId, type, idx) {
  const p = db.patients.find(x => x.id == patId);
  if (!p) return;
  const key  = type === 'medical' ? 'medicalLog' : 'medsLog';
  const logs = (p[key] || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  const entry = logs[idx];
  if (!entry) return;
  const realIdx = p[key].findIndex(e => e.date === entry.date && e.detail === entry.detail);
  document.getElementById('medlog-type').value    = type;
  document.getElementById('medlog-patid').value   = patId;
  document.getElementById('medlog-editidx').value = realIdx;
  // เก็บ _supaId ไว้ใน dataset เพื่อใช้ตอน update
  document.getElementById('medlog-editidx').dataset.supaId = entry._supaId || '';
  document.getElementById('medlog-date').value    = entry.date;
  document.getElementById('medlog-detail').value  = entry.detail;
  document.getElementById('medlog-by').value = entry.by || '';
  document.getElementById('medlog-title').textContent = type === 'medical' ? '✏️ แก้ไขประวัติการรักษา' : '✏️ แก้ไขประวัติการให้ยา';
  openModal('modal-addMedLog');
}

async function saveMedLog() {
  if (!canManageVitals()) { toast('ไม่มีสิทธิ์บันทึกข้อมูลสุขภาพ','error'); return; }
  const type    = document.getElementById('medlog-type').value;
  const patId   = document.getElementById('medlog-patid').value;
  const editIdx = document.getElementById('medlog-editidx').value;
  const editId  = document.getElementById('medlog-editidx').dataset?.supaId || '';
  const date    = document.getElementById('medlog-date').value;
  const detail  = document.getElementById('medlog-detail').value.trim();
  if (!date)   { toast('กรุณาระบุวันที่','warning'); return; }
  if (!detail) { toast('กรุณากรอกรายละเอียด','warning'); return; }

  const p = db.patients.find(x => x.id == patId);
  if (!p) return;
  const key = type === 'medical' ? 'medicalLog' : 'medsLog';
  if (!p[key]) p[key] = [];
  const byUser = document.getElementById('medlog-by')?.value.trim() || currentUser?.displayName || currentUser?.username || '';

  if (editId) {
    // แก้ไขใน Supabase
    const { error } = await supa.from('medical_logs').update({
      date, detail, by_user: byUser, log_type: type
    }).eq('id', editId);
    if (error) { toast('แก้ไขไม่สำเร็จ: ' + error.message, 'error'); return; }
    // อัปเดต in-memory
    const idx = p[key].findIndex(e => String(e._supaId) === String(editId));
    if (idx >= 0) p[key][idx] = { date, detail, by: byUser, savedAt: new Date().toISOString(), _supaId: editId };
    toast('แก้ไขเรียบร้อย', 'success');
  } else {
    // เพิ่มใหม่ใน Supabase
    const { data: ins, error } = await supa.from('medical_logs').insert({
      patient_id: patId, log_type: type, date, detail, by_user: byUser
    }).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
    p[key].push({ date, detail, by: byUser, savedAt: new Date().toISOString(), _supaId: ins.id });
    toast('เพิ่มรายการเรียบร้อย', 'success');
  }

  closeModal('modal-addMedLog');
  const tabEl = document.getElementById(`patprofile-tab-${type}`);
  if (tabEl) tabEl.innerHTML = renderMedLogTab(patId, type);
}

async function deleteMedLog(patId, type, idx) {
  if (!confirm('ลบรายการนี้?')) return;
  const p = db.patients.find(x => x.id == patId);
  if (!p) return;
  const key  = type === 'medical' ? 'medicalLog' : 'medsLog';
  const logs = (p[key] || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  const entry = logs[idx];
  if (entry._supaId) {
    const { error } = await supa.from('medical_logs').delete().eq('id', entry._supaId);
    if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  }
  const realIdx = p[key].findIndex(e => e.date === entry.date && e.detail === entry.detail);
  if (realIdx >= 0) p[key].splice(realIdx, 1);
  toast('ลบรายการเรียบร้อย', 'success');
  const tabEl = document.getElementById(`patprofile-tab-${type}`);
  if (tabEl) tabEl.innerHTML = renderMedLogTab(patId, type);
}

// ===== HEALTH REPORT =====
const MONTHS_TH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function resetHealthFilters() {
  const now = new Date();
  document.getElementById('hr-month').value = now.toISOString().slice(0,7);
  document.getElementById('hr-patient').value = '';
  document.getElementById('hr-type').value = 'both';
  renderHealthReport();
}

function renderHealthReport() {
  // Populate patient dropdown
  const patSel = document.getElementById('hr-patient');
  const curPat = patSel.value;
  const patsWithData = db.patients.filter(p => (p.medicalLog||[]).length > 0 || (p.medsLog||[]).length > 0);
  patSel.innerHTML = '<option value="">ทั้งหมด (' + patsWithData.length + ' คน)</option>' +
    db.patients.filter(p => p.status==='active').map(p => `<option value="${p.id}" ${curPat==p.id?'selected':''}>${p.name}</option>`).join('');
  if (curPat) patSel.value = curPat;

  const monthVal  = document.getElementById('hr-month').value;    // "2568-08" or "2025-08"
  const patientId = document.getElementById('hr-patient').value;
  const typeVal   = document.getElementById('hr-type').value;

  // Collect all logs filtered
  let allMedical = [], allMeds = [];
  db.patients.forEach(p => {
    if (patientId && p.id != patientId) return;
    if (typeVal !== 'meds') {
      (p.medicalLog||[]).forEach(e => {
        if (!monthVal || e.date.slice(0,7) === monthVal) {
          allMedical.push({ ...e, patientName: p.name, patientId: p.id });
        }
      });
    }
    if (typeVal !== 'medical') {
      (p.medsLog||[]).forEach(e => {
        if (!monthVal || e.date.slice(0,7) === monthVal) {
          allMeds.push({ ...e, patientName: p.name, patientId: p.id });
        }
      });
    }
  });

  allMedical.sort((a,b) => b.date.localeCompare(a.date));
  allMeds.sort((a,b) => b.date.localeCompare(a.date));

  // Summary strip
  const [y,m] = monthVal ? monthVal.split('-') : [null,null];
  const monthLabel = y ? `${MONTHS_TH_FULL[parseInt(m)-1]} ${parseInt(y)+543}` : 'ทุกเดือน';
  const summaryEl = document.getElementById('hr-summary');
  summaryEl.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
    <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📅 ${monthLabel}</div>
    ${patientId ? `<div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🏥 ${db.patients.find(p=>p.id==patientId)?.name||''}</div>` : ''}
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🏥 ประวัติรักษา <strong>${allMedical.length}</strong> รายการ</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">💊 ยาประจำ <strong>${allMeds.length}</strong> รายการ</div>
  </div>`;

  const content = document.getElementById('hr-content');

  // Allergy alert for specific patient
  const allergyHtml = patientId ? (() => {
    const p = db.patients.find(pt => pt.id == patientId);
    return p?.allergies?.length ? renderAllergyBanner(p, false) : '';
  })() : '';

  if (allMedical.length === 0 && allMeds.length === 0) {
    content.innerHTML = allergyHtml + `<div class="card" style="padding:48px;text-align:center;color:var(--text3);">ไม่พบข้อมูลในช่วงเวลาที่เลือก</div>`;
    return;
  }

  // Build view: group by patient if showing all, else show timeline
  if (!patientId) {
    // Overview: group by patient
    const patMap = {};
    [...allMedical.map(e=>({...e,_type:'medical'})), ...allMeds.map(e=>({...e,_type:'meds'}))].forEach(e => {
      if (!patMap[e.patientId]) patMap[e.patientId] = { name:e.patientName, medical:[], meds:[] };
      patMap[e.patientId][e._type === 'medical' ? 'medical' : 'meds'].push(e);
    });

    content.innerHTML = allergyHtml + Object.values(patMap).map(pat => `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title" style="font-size:14px;">🏥 ${pat.name}</div>
          <div style="font-size:12px;color:var(--text2);">รักษา ${pat.medical.length} รายการ · ยา ${pat.meds.length} รายการ</div>
        </div>
        <div style="padding:0 20px 12px;">
          ${pat.medical.length > 0 && typeVal !== 'meds' ? `
          <div style="margin-top:12px;">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">🏥 ประวัติการรักษา</div>
            ${pat.medical.map(e => `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
              <span style="color:var(--text3);white-space:nowrap;min-width:90px;">${thDateShort(e.date)}</span>
              <span style="flex:1;">${e.detail}</span>
              <span style="color:var(--text3);white-space:nowrap;">${e.by||''}</span>
            </div>`).join('')}
          </div>` : ''}
          ${pat.meds.length > 0 && typeVal !== 'medical' ? `
          <div style="margin-top:12px;">
            <div style="font-size:12px;font-weight:700;color:#2980b9;margin-bottom:8px;">💊 ยาประจำ</div>
            ${pat.meds.map(e => `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
              <span style="color:var(--text3);white-space:nowrap;min-width:90px;">${thDateShort(e.date)}</span>
              <span style="flex:1;">${e.detail}</span>
              <span style="color:var(--text3);white-space:nowrap;">${e.by||''}</span>
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`).join('');
  } else {
    // Individual timeline
    const allEntries = [
      ...allMedical.map(e=>({...e,_type:'medical'})),
      ...allMeds.map(e=>({...e,_type:'meds'}))
    ].sort((a,b) => b.date.localeCompare(a.date));

    // Group by date
    const byDate = {};
    allEntries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    content.innerHTML = `<div class="card">
      <div class="card-header"><div class="card-title">Timeline รายละเอียด</div></div>
      <div style="padding:0 20px;">
        ${Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => `
        <div style="padding:14px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:8px;">📅 ${thDateShort(date)}</div>
          ${byDate[date].map(e => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:4px 0 4px 12px;border-left:3px solid ${e._type==='medical'?'var(--sage)':'#a0bde8'};">
            <span style="font-size:16px;">${e._type==='medical'?'🏥':'💊'}</span>
            <div style="flex:1;font-size:13px;line-height:1.6;">${e.detail}</div>
            <div style="font-size:11px;color:var(--text3);white-space:nowrap;">${e.by||''}</div>
          </div>`).join('')}
        </div>`).join('')}
      </div>
    </div>`;
  }
}

// ── Export helpers ────────────────────────────────────────────────────────
function getHealthReportData() {
  const monthVal  = document.getElementById('hr-month').value;
  const patientId = document.getElementById('hr-patient').value;
  const typeVal   = document.getElementById('hr-type').value;
  const [y,m] = monthVal ? monthVal.split('-') : [null,null];
  const monthLabel = y ? `${MONTHS_TH_FULL[parseInt(m)-1]} ${parseInt(y)+543}` : 'ทุกเดือน';
  let rows = [];
  db.patients.forEach(p => {
    if (patientId && p.id != patientId) return;
    if (typeVal !== 'meds') {
      (p.medicalLog||[]).forEach(e => {
        if (!monthVal || e.date.slice(0,7) === monthVal)
          rows.push({ patient: p.name, date: e.date, dateDisplay: thDateShort(e.date), type: 'ประวัติการรักษา', detail: e.detail, by: e.by||'' });
      });
    }
    if (typeVal !== 'medical') {
      (p.medsLog||[]).forEach(e => {
        if (!monthVal || e.date.slice(0,7) === monthVal)
          rows.push({ patient: p.name, date: e.date, dateDisplay: thDateShort(e.date), type: 'ยาประจำ', detail: e.detail, by: e.by||'' });
      });
    }
  });
  rows.sort((a,b) => a.patient.localeCompare(b.patient,'th') || b.date.localeCompare(a.date));
  return { rows, monthLabel };
}

function exportHealthExcel() {
  const { rows, monthLabel } = getHealthReportData();
  if (rows.length === 0) { toast('ไม่มีข้อมูลสำหรับ export','warning'); return; }
  // Build CSV (UTF-8 BOM for Excel Thai)
  const BOM = '\uFEFF';
  const header = ['ผู้รับบริการ','วันที่','ประเภท','รายละเอียด','ผู้บันทึก'];
  const csvRows = [header, ...rows.map(r => [r.patient, r.dateDisplay, r.type, r.detail.replace(/\n/g,' '), r.by])];
  const csv = BOM + csvRows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `รายงานสุขภาพ_${monthLabel}.csv`;
  a.click();
  toast('Export Excel เรียบร้อย','success');
}

function exportHealthPDF() {
  const { rows, monthLabel } = getHealthReportData();
  if (rows.length === 0) { toast('ไม่มีข้อมูลสำหรับ export','warning'); return; }
  const win = window.open('','_blank','width=900,height=700');
  const patientId = document.getElementById('hr-patient').value;
  const patName = patientId ? db.patients.find(p=>p.id==patientId)?.name : 'ทุกคน';

  // Group rows by patient
  const byPatient = {};
  rows.forEach(r => {
    if (!byPatient[r.patient]) byPatient[r.patient] = { medical:[], meds:[] };
    if (r.type === 'ประวัติการรักษา') byPatient[r.patient].medical.push(r);
    else byPatient[r.patient].meds.push(r);
  });

  const patientsHtml = Object.entries(byPatient).map(([name, data]) => `
    <div class="patient-block">
      <h3>🏥 ${name}</h3>
      ${data.medical.length>0 ? `
        <div class="section-label">ประวัติการรักษา</div>
        <table><thead><tr><th>วันที่</th><th>รายละเอียด</th><th>ผู้บันทึก</th></tr></thead>
        <tbody>${data.medical.map(r=>`<tr><td class="date">${r.dateDisplay}</td><td>${r.detail}</td><td class="by">${r.by}</td></tr>`).join('')}</tbody></table>` : ''}
      ${data.meds.length>0 ? `
        <div class="section-label meds">ยาประจำ</div>
        <table><thead><tr><th>วันที่</th><th>รายละเอียด</th><th>ผู้บันทึก</th></tr></thead>
        <tbody>${data.meds.map(r=>`<tr><td class="date">${r.dateDisplay}</td><td>${r.detail}</td><td class="by">${r.by}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>รายงานสุขภาพ ${monthLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'IBM Plex Sans Thai',sans-serif; padding:16mm 18mm; font-size:12px; color:#1a1a1a; }
      h1 { font-size:18px; font-weight:700; margin-bottom:4px; }
      .meta { color:#666; font-size:12px; margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid #2d6a48; }
      .patient-block { margin-bottom:24px; page-break-inside:avoid; }
      h3 { font-size:14px; font-weight:700; color:#2d6a48; margin-bottom:8px; padding:6px 10px; background:#f2f8f4; border-radius:4px; }
      .section-label { font-size:11px; font-weight:700; color:#5a9e7a; text-transform:uppercase; letter-spacing:.05em; margin:10px 0 4px; }
      .section-label.meds { color:#2980b9; }
      table { width:100%; border-collapse:collapse; margin-bottom:8px; }
      th { background:#f2f8f4; padding:6px 8px; text-align:left; font-size:11px; border-bottom:1px solid #cde4d4; }
      td { padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; line-height:1.5; }
      .date { white-space:nowrap; color:#5a9e7a; font-weight:600; min-width:90px; }
      .by { white-space:nowrap; color:#999; font-size:11px; min-width:80px; }
      .footer { margin-top:20px; padding-top:8px; border-top:1px dashed #ccc; font-size:10px; color:#aaa; display:flex; justify-content:space-between; }
      @media print { body { padding:10mm 12mm; } }
    </style></head><body>
    <h1>📋 รายงานสุขภาพ</h1>
    <div class="meta">เดือน: <strong>${monthLabel}</strong> &nbsp;·&nbsp; ผู้รับบริการ: <strong>${patName}</strong> &nbsp;·&nbsp; รวม ${rows.length} รายการ</div>
    ${patientsHtml}
    <div class="footer"><span>นวศรี เนอร์สซิ่งโฮม — Navasri Database System</span><span>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</span></div>
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`);
  win.document.close();
}


function exportPatMedExcel(patId, type) {
  const p = db.patients.find(x => x.id == patId);
  if (!p) return;
  const key   = type === 'medical' ? 'medicalLog' : 'medsLog';
  const label = type === 'medical' ? 'ประวัติการรักษา' : 'ยาประจำ';
  const logs  = (p[key] || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  if (logs.length === 0) { toast('ไม่มีข้อมูล','warning'); return; }

  const BOM = '\uFEFF';
  const header = ['ผู้รับบริการ','วันที่','รายละเอียด','ผู้บันทึก'];
  const rows = logs.map(e => [p.name, thDateShort(e.date), e.detail.replace(/\n/g,' '), e.by||'']);
  const csv = BOM + [header,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
  a.download = `${label}_${p.name}.csv`;
  a.click();
  toast('Export Excel เรียบร้อย','success');
}

function exportPatMedPDF(patId, type) {
  const p = db.patients.find(x => x.id == patId);
  if (!p) return;
  const key   = type === 'medical' ? 'medicalLog' : 'medsLog';
  const icon  = type === 'medical' ? '🏥' : '💊';
  const label = type === 'medical' ? 'ประวัติการรักษา / โรคประจำตัว' : 'ประวัติการให้ยา / ยาประจำ';
  const color = type === 'medical' ? '#2d6a48' : '#2980b9';
  const logs  = (p[key] || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  if (logs.length === 0) { toast('ไม่มีข้อมูล','warning'); return; }

  // Group by month
  const byMonth = {};
  logs.forEach(e => {
    const [y,m] = e.date.split('-');
    const mk = `${y}-${m}`;
    const ml = `${MONTHS_TH_FULL[parseInt(m)-1]} ${parseInt(y)+543}`;
    if (!byMonth[mk]) byMonth[mk] = { label: ml, entries: [] };
    byMonth[mk].entries.push(e);
  });

  const monthsHtml = Object.values(byMonth).map(mo => `
    <div class="month-block">
      <div class="month-label">${mo.label} (${mo.entries.length} รายการ)</div>
      <table>
        <thead><tr><th class="date-col">วันที่</th><th>รายละเอียด</th><th class="by-col">ผู้บันทึก</th></tr></thead>
        <tbody>${mo.entries.map(e => `<tr>
          <td class="date-col">${thDateShort(e.date)}</td>
          <td style="white-space:pre-wrap;">${e.detail}</td>
          <td class="by-col">${e.by||''}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`).join('');

  const win = window.open('','_blank','width=860,height=700');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${label} — ${p.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'IBM Plex Sans Thai',sans-serif;padding:14mm 18mm;font-size:12px;color:#1a1a1a}
      .header{border-bottom:2.5px solid ${color};padding-bottom:10px;margin-bottom:16px}
      h1{font-size:17px;font-weight:700;color:${color};margin-bottom:4px}
      .meta{font-size:12px;color:#555;line-height:1.6}
      .month-block{margin-bottom:20px;page-break-inside:avoid}
      .month-label{font-size:13px;font-weight:700;color:${color};background:${type==='medical'?'#f2f8f4':'#eef4ff'};padding:5px 10px;border-radius:4px;margin-bottom:6px}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:6px 8px;text-align:left;font-size:11px;border-bottom:1px solid #ddd}
      td{padding:7px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;line-height:1.6}
      .date-col{white-space:nowrap;color:${color};font-weight:600;width:100px}
      .by-col{white-space:nowrap;color:#999;font-size:11px;width:90px}
      .footer{margin-top:18px;padding-top:8px;border-top:1px dashed #ccc;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
      @media print{body{padding:8mm 12mm}}
    </style></head><body>
    <div class="header">
      <h1>${icon} ${label}</h1>
      <div class="meta">
        ผู้รับบริการ: <strong>${p.name}</strong>
        &nbsp;·&nbsp; รวมทั้งหมด: <strong>${logs.length} รายการ</strong>
        &nbsp;·&nbsp; ช่วงเวลา: <strong>${Object.values(byMonth).slice(-1)[0]?.label||''} — ${Object.values(byMonth)[0]?.label||''}</strong>
      </div>
    </div>
    ${monthsHtml}
    <div class="footer">
      <span>นวศรี เนอร์สซิ่งโฮม — Navasri Database System</span>
      <span>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</span>
    </div>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`);
  win.document.close();
}

function printHealthReport() { exportHealthPDF(); }