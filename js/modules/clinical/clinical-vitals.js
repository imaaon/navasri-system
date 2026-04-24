
async function openEditVitalModal(patientId, pid, vitalId) {
  const vitals = db.vitalSigns[pid] || [];
  const v = vitals.find(x => x.id == vitalId);
  if (!v) return;
  document.getElementById('vital-pat-id').value = patientId;
  document.getElementById('vital-pat-id').dataset.editId = vitalId;
  document.getElementById('vital-pat-id').dataset.pid = pid;
  // set datetime
  const dt = v.recordedAt || new Date().toISOString();
  document.getElementById('vital-time').value = dt.slice(0,16);
  document.getElementById('vital-by').value = v.recordedBy || '';
  // vital fields
  document.getElementById('vital-bp-sys').value = v.bp_sys || '';
  document.getElementById('vital-bp-dia').value = v.bp_dia || '';
  document.getElementById('vital-hr').value = v.hr || '';
  document.getElementById('vital-temp').value = v.temp || '';
  document.getElementById('vital-spo2').value = v.spo2 || '';
  document.getElementById('vital-dtx').value = v.dtx || '';
  document.getElementById('vital-rr').value = v.rr || '';
  document.getElementById('vital-weight').value = v.weight || '';
  document.getElementById('vital-height').value = v.height || '';
  document.getElementById('vital-other').value = v.otherFields || '';
  document.getElementById('vital-note').value = v.note || '';
  document.getElementById('modal-vital-title').textContent = '✏️ แก้ไข Vital Signs';
  openModal('modal-add-vital');
}
// ===== CLINICAL: VITALS + NURSING NOTES =====

// ===== VITAL SIGNS ========================
// ==========================================
function renderVitalsTab(pid, patientId) {
  const vitals = (db.vitalSigns[pid]||[]);
  const recent7 = vitals.slice(0, 14);

  // Mini chart data — last 14 records
  const chartData = [...recent7].reverse();
  const bpPoints = chartData.map(v => v.bp_sys ? `${v.bp_sys}/${v.bp_dia}` : '-');
  const hrPoints = chartData.map(v => v.hr||'-');
  const spo2Points = chartData.map(v => v.spo2||'-');
  const labels  = chartData.map(v => v.recordedAt?.slice(5,10)||'');

  const svgBP = vitalsSparkline(chartData.map(v=>v.bp_sys), '#e74c3c', 120, 180);
  const svgHR = vitalsSparkline(chartData.map(v=>v.hr), '#3498db', 50, 100);
  const svgSpo2 = vitalsSparkline(chartData.map(v=>v.spo2), '#27ae60', 90, 100);

  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📊 แนวโน้มสัญญาณชีพ (14 ครั้งล่าสุด)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;">
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#e74c3c;margin-bottom:4px;">🩸 ความดันโลหิต (mmHg)</div>
          ${svgBP}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${vitals[0]?.bp_sys ? vitals[0].bp_sys+'/'+vitals[0].bp_dia : '-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#3498db;margin-bottom:4px;">💓 ชีพจร (bpm)</div>
          ${svgHR}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${vitals[0]?.hr||'-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#27ae60;margin-bottom:4px;">🫁 SpO₂ (%)</div>
          ${svgSpo2}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${vitals[0]?.spo2 ? vitals[0].spo2+'%' : '-'}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📋 บันทึกสัญญาณชีพ</div>
        <button class="btn btn-primary btn-sm" onclick="openAddVitalModal('${patientId}')">+ บันทึก</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>วัน/เวลา</th>
            <th style="text-align:center;color:#e74c3c;">🩸 BP</th>
            <th style="text-align:center;color:#3498db;">💓 HR</th>
            <th style="text-align:center;color:#e67e22;">🌡️ Temp</th>
            <th style="text-align:center;color:#27ae60;">🫁 SpO₂</th>
            <th style="text-align:center;color:#8e44ad;">🍬 DTX</th>
            <th style="text-align:center;color:#16a085;">🫀 RR</th>
            <th>อื่นๆ</th>
            <th>ผู้บันทึก</th>
            <th>หมายเหตุ</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${vitals.length===0 ? '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text3);">ยังไม่มีข้อมูล</td></tr>' :
              vitals.slice(0,30).map(v => {
                const bpAlert = v.bp_sys && (v.bp_sys>=160||v.bp_sys<=90);
                const spo2Alert = v.spo2 && v.spo2<95;
                const hrAlert = v.hr && (v.hr>100||v.hr<50);
                return `<tr ${bpAlert||spo2Alert||hrAlert ? 'style="background:#fff8f8;"' : ''}>
                  <td class="number" style="font-size:12px;white-space:nowrap;">${(v.recordedAt ? new Date(v.recordedAt).toLocaleString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replace(',',' ') : '-')}</td>
                  <td style="text-align:center;font-weight:${bpAlert?'700':'400'};color:${bpAlert?'#e74c3c':'inherit'};">${v.bp_sys ? v.bp_sys+'/'+v.bp_dia : '-'}</td>
                  <td style="text-align:center;font-weight:${hrAlert?'700':'400'};color:${hrAlert?'#e74c3c':'inherit'};">${v.hr||'-'}</td>
                  <td style="text-align:center;">${v.temp ? v.temp+'°C' : '-'}</td>
                  <td style="text-align:center;font-weight:${spo2Alert?'700':'400'};color:${spo2Alert?'#e74c3c':'inherit'};">${v.spo2 ? v.spo2+'%' : '-'}</td>
                  <td style="text-align:center;">${v.dtx ? v.dtx+' mg/dL' : '-'}</td>
                  <td style="text-align:center;">${v.rr ? v.rr+'/min' : '-'}</td>
                  <td style="font-size:12px;color:var(--text2);max-width:80px;">${v.weight ? v.weight+'kg' : '-'}</td>
                  <td style="text-align:center;font-size:12px;color:var(--text2);">${v.height ? v.height+'cm' : '-'}</td>
                  <td style="font-size:12px;color:var(--text2);max-width:120px;">${v.otherFields||'-'}</td>
                  <td style="font-size:12px;">${v.recordedBy||'-'}</td>
                  <td style="font-size:12px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${v.note||''}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="openEditVitalModal('${patientId}','${pid}','${v.id}')" title="แก้ไข">✏️</button><button class="btn btn-ghost btn-sm" onclick="deleteVitalSign('${patientId}','${pid}','${v.id}')" title="ลบ">🗑️</button></td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function vitalsSparkline(values, color, min, max) {
  const data = values.filter(v=>v!=null&&!isNaN(v));
  if (data.length < 2) return `<div style="height:40px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text3);">ยังไม่มีข้อมูลพอ</div>`;
  const w=200, h=44, pad=4;
  const range = (max-min)||1;
  const pts = data.map((v,i)=>{
    const x = pad + (i/(data.length-1))*(w-pad*2);
    const y = h-pad - ((v-min)/range)*(h-pad*2);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:44px;">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${data.map((v,i)=>{
      const x = pad + (i/(data.length-1))*(w-pad*2);
      const y = h-pad - ((v-min)/range)*(h-pad*2);
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
    }).join('')}
  </svg>`;
}

function openAddVitalModal(patientId) {
  document.getElementById('vital-pat-id').value = patientId;
  ['vital-bp-sys','vital-bp-dia','vital-hr','vital-temp','vital-spo2','vital-dtx','vital-rr','vital-other','vital-note']
    .forEach(id => { document.getElementById(id).value = ''; });
  const now = new Date();
  document.getElementById('vital-time').value = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  document.getElementById('vital-by').value = currentUser?.displayName || currentUser?.username || '';
  openModal('modal-add-vital');
}

async function saveVitalSign() {
  const editId = document.getElementById('vital-pat-id').dataset.editId || '';
  document.getElementById('vital-pat-id').dataset.editId = '';
  const patientId = document.getElementById('vital-pat-id').value;
  const time = document.getElementById('vital-time').value;
  if (!time) { toast('กรุณาระบุวัน/เวลา','warning'); return; }
  const n = v => { const x=document.getElementById(v).value; return x===''?null:parseFloat(x); };
  const data = {
    patient_id: patientId,
    recorded_at: new Date(time + ':00').toISOString(),
    recorded_by: document.getElementById('vital-by').value.trim(),
    bp_sys: n('vital-bp-sys'), bp_dia: n('vital-bp-dia'),
    hr: n('vital-hr'), temp: n('vital-temp'),
    spo2: n('vital-spo2'), dtx: n('vital-dtx'), rr: n('vital-rr'),
    weight: n('vital-weight'), height: n('vital-height'),
    other_fields: document.getElementById('vital-other').value.trim(),
    note: document.getElementById('vital-note').value.trim(),
  };
  const pid = String(patientId);
  let ins, error;
  if (editId) {
    // แก้ไขรายการเดิม
    ({ data: ins, error } = await supa.from('vital_signs').update(data).eq('id', editId).select().single());
    if (error) { toast('แก้ไขไม่สำเร็จ: '+error.message,'error'); return; }
    if(!db.vitalSigns[pid]) db.vitalSigns[pid]=[];
    db.vitalSigns[pid] = db.vitalSigns[pid].map(v => String(v.id)===String(editId) ? mapVitalSign(ins) : v);
    toast('แก้ไข Vital Signs แล้ว','success');
  } else {
    // เพิ่มรายการใหม่
    ({ data: ins, error } = await supa.from('vital_signs').insert(data).select().single());
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if(!db.vitalSigns[pid]) db.vitalSigns[pid]=[];
    db.vitalSigns[pid].unshift(mapVitalSign(ins));
    toast('บันทึก Vital Signs แล้ว','success');
  }
  closeModal('modal-add-vital');
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId);
}

async function deleteVitalSign(patientId, pid, id) {
  if(!confirm('ลบรายการนี้?')) return;
  const { error } = await supa.from('vital_signs').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.vitalSigns[pid] = (db.vitalSigns[pid]||[]).filter(v=>v.id!=id);
  toast('ลบแล้ว');
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId);
}

// ==========================================