// ===== BILLING: CLINICAL RECORDS (Incident/Wound/Diet/Deposit) =====

function switchIncidentTab(tab) {
  document.getElementById('incident-tab-incidents').style.display = tab==='incidents' ? '' : 'none';
  document.getElementById('incident-tab-wounds').style.display = tab==='wounds' ? '' : 'none';
  document.querySelectorAll('#incident-tabs .tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&tab==='incidents')||(i===1&&tab==='wounds'));
  });
}

function openIncidentModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('incident-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('incident-edit-id').value = id||'';
  document.getElementById('modal-incident-title').textContent = id ? '✏️ แก้ไขรายงานอุบัติเหตุ' : '⚠️ บันทึกอุบัติเหตุ / ความเสี่ยง';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0,5);
  if (id) {
    const inc = (db.incidents||[]).find(x=>x.id==id);
    if (inc) {
      document.getElementById('incident-patient').value = inc.patientId;
      document.getElementById('incident-type').value = inc.type;
      document.getElementById('incident-date').value = inc.date;
      document.getElementById('incident-time').value = inc.time||'';
      document.getElementById('incident-location').value = inc.location||'';
      document.getElementById('incident-detail').value = inc.detail||'';
      document.getElementById('incident-firstaid').value = inc.firstAid||'';
      document.getElementById('incident-severity').value = inc.severity||'เล็กน้อย';
      document.getElementById('incident-recorder').value = inc.recorder||'';
      document.getElementById('incident-notified').value = inc.notified||'ยังไม่แจ้ง';
    }
  } else {
    document.getElementById('incident-date').value = today;
    document.getElementById('incident-time').value = now;
    document.getElementById('incident-detail').value = '';
    document.getElementById('incident-firstaid').value = '';
    document.getElementById('incident-location').value = '';
    document.getElementById('incident-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-incident');
}

async function saveIncident() {
  const patientId = document.getElementById('incident-patient').value;
  const detail = document.getElementById('incident-detail').value.trim();
  if (!patientId||!detail) { toast('กรุณากรอกข้อมูลที่จำเป็น','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    type: document.getElementById('incident-type').value,
    date: document.getElementById('incident-date').value,
    time: document.getElementById('incident-time').value,
    location: document.getElementById('incident-location').value,
    detail, first_aid: document.getElementById('incident-firstaid').value,
    severity: document.getElementById('incident-severity').value,
    recorder: document.getElementById('incident-recorder').value,
    notified: document.getElementById('incident-notified').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('incident-edit-id').value;
  if (editId) {
    if (supa) await supa.from('incident_reports').update(row).eq('id', editId);
    const idx = (db.incidents||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.incidents[idx] = {...db.incidents[idx], ...mapIncident({id:editId,...row})};
  } else {
    if (supa) { const {data} = await supa.from('incident_reports').insert(row).select().single(); if(data){if(!db.incidents)db.incidents=[];db.incidents.unshift(mapIncident(data));} }
    else { if(!db.incidents)db.incidents=[]; db.incidents.unshift(mapIncident({id:Date.now(),...row})); }
  }
  closeModal('modal-incident');
  renderIncidentPage();
  toast('บันทึกรายงานอุบัติเหตุแล้ว','success');
}

function mapIncident(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, type:r.type, date:r.date, time:r.time, location:r.location, detail:r.detail, firstAid:r.first_aid, severity:r.severity, recorder:r.recorder, notified:r.notified };
}

async function deleteIncident(id) {
  if (!confirm('ลบรายงานอุบัติเหตุนี้?')) return;
  if (supa) await supa.from('incident_reports').delete().eq('id', id);
  db.incidents = (db.incidents||[]).filter(x=>x.id!=id);
  renderIncidentPage(); toast('ลบแล้ว','success');
}

function openWoundModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('wound-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('wound-edit-id').value = id||'';
  document.getElementById('modal-wound-title').textContent = id ? '✏️ แก้ไขบันทึกแผล' : '🩹 บันทึกการทำแผล / แผลกดทับ';
  if (id) {
    const w = (db.wounds||[]).find(x=>x.id==id);
    if (w) {
      document.getElementById('wound-patient').value = w.patientId;
      document.getElementById('wound-date').value = w.date;
      document.getElementById('wound-location').value = w.location;
      document.getElementById('wound-stage').value = w.stage;
      document.getElementById('wound-width').value = w.width||'';
      document.getElementById('wound-length').value = w.length||'';
      document.getElementById('wound-depth').value = w.depth||'';
      document.getElementById('wound-appearance').value = w.appearance||'';
      document.getElementById('wound-treatment').value = w.treatment||'';
      document.getElementById('wound-trend').value = w.trend||'คงที่';
      document.getElementById('wound-recorder').value = w.recorder||'';
      document.getElementById('wound-note').value = w.note||'';
    }
  } else {
    document.getElementById('wound-date').value = new Date().toISOString().split('T')[0];
    ['width','length','depth'].forEach(f=>document.getElementById('wound-'+f).value='');
    document.getElementById('wound-appearance').value='';
    document.getElementById('wound-treatment').value='';
    document.getElementById('wound-note').value='';
    document.getElementById('wound-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-wound');
}

async function saveWound() {
  const patientId = document.getElementById('wound-patient').value;
  const location = document.getElementById('wound-location').value;
  if (!patientId||!location) { toast('กรุณาเลือกผู้ป่วยและตำแหน่งแผล','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    date: document.getElementById('wound-date').value,
    location, stage: document.getElementById('wound-stage').value,
    width: parseFloat(document.getElementById('wound-width').value)||0,
    length: parseFloat(document.getElementById('wound-length').value)||0,
    depth: parseFloat(document.getElementById('wound-depth').value)||0,
    appearance: document.getElementById('wound-appearance').value,
    treatment: document.getElementById('wound-treatment').value,
    trend: document.getElementById('wound-trend').value,
    recorder: document.getElementById('wound-recorder').value,
    note: document.getElementById('wound-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('wound-edit-id').value;
  if (editId) {
    const woundRowEdit = { patient_id: row.patient_id, patient_name: row.patient_name, wound_date: row.date, location: row.location, stage: row.stage, size_cm: `${row.width}x${row.length}x${row.depth}`, appearance: row.appearance, note: (row.treatment?'การรักษา: '+row.treatment+' ':'')+(row.trend?'แนวโน้ม: '+row.trend+' ':'')+(row.note||''), created_by: row.recorder||'' };
    if (supa) await supa.from('patient_wounds').update(woundRowEdit).eq('id', editId);
    const idx = (db.wounds||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.wounds[idx] = {...db.wounds[idx], ...mapWound({id:editId,...woundRowEdit})};
  } else {
    const woundRow = { patient_id: row.patient_id, patient_name: row.patient_name, wound_date: row.date, location: row.location, stage: row.stage, size_cm: `${row.width}x${row.length}x${row.depth}`, appearance: row.appearance, note: (row.treatment?'การรักษา: '+row.treatment+' ':'')+(row.trend?'แนวโน้ม: '+row.trend+' ':'')+(row.note||''), created_by: row.recorder||'' };
    if (supa) { const {data} = await supa.from('patient_wounds').insert(woundRow).select().single(); if(data){if(!db.wounds)db.wounds=[];db.wounds.unshift(mapWound(data));} }
    else { if(!db.wounds)db.wounds=[]; db.wounds.unshift(mapWound({id:Date.now(),...row})); }
  }
  closeModal('modal-wound');
  renderIncidentPage();
  toast('บันทึกข้อมูลแผลแล้ว','success');
}

function mapWound(r) {
  const size = (r.size_cm||'').split('x');
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name,
    date:r.wound_date||r.date, location:r.location, stage:r.stage,
    width:parseFloat(size[0])||r.width||0, length:parseFloat(size[1])||r.length||0, depth:parseFloat(size[2])||r.depth||0,
    appearance:r.appearance, treatment:r.dressing||r.treatment, trend:r.status||r.trend, recorder:r.created_by||r.recorder, note:r.note };
}

async function deleteWound(id) {
  if (!confirm('ลบบันทึกแผลนี้?')) return;
  if (supa) await supa.from('patient_wounds').delete().eq('id', id);
  db.wounds = (db.wounds||[]).filter(x=>x.id!=id);
  renderIncidentPage(); toast('ลบแล้ว','success');
}

async function renderIncidentPage() {
  // โหลดข้อมูลล่าสุดจาก Supabase
  if (supa) {
    const { data: incData } = await supa.from('incident_reports').select('*').order('created_at',{ascending:false});
    if (incData) db.incidents = incData.map(mapIncident);
    const { data: woundData } = await supa.from('patient_wounds').select('*').order('wound_date',{ascending:false});
    if (woundData) db.wounds = woundData.map(r=>({id:r.id,patientId:r.patient_id,patientName:r.patient_name,date:r.wound_date||r.date,location:r.location,stage:r.stage,width:(r.size_cm?.split('x')[0])||0,length:(r.size_cm?.split('x')[1])||0,depth:(r.size_cm?.split('x')[2])||0,appearance:r.appearance,treatment:'',recorder:r.created_by||'',trend:'',note:r.note}));
  }
  const SEV = {เล็กน้อย:'badge-green',ปานกลาง:'badge-orange',รุนแรง:'badge-red'};
  const TREND = {ดีขึ้น:'📈',คงที่:'➡️',แย่ลง:'📉','ใหม่':'🆕'};
  const month = document.getElementById('incident-filter-month')?.value||'';
  const incidents = (db.incidents||[]).filter(x=>!month||x.date?.startsWith(month));
  const wounds = (db.wounds||[]).filter(x=>!month||x.date?.startsWith(month));

  const incTb = document.getElementById('incident-table-body');
  if (incTb) incTb.innerHTML = incidents.length ? incidents.map(x=>`<tr>
    <td><div style="font-weight:600;">${x.date||''}</div><div style="font-size:11px;color:var(--text2);">${x.time||''}</div></td>
    <td>${x.patientName||''}</td>
    <td><span class="badge badge-orange">${x.type||''}</span></td>
    <td style="font-size:12px;">${x.location||'-'}</td>
    <td style="font-size:12px;max-width:200px;">${x.detail||''}</td>
    <td style="font-size:12px;max-width:150px;">${x.firstAid||'-'}</td>
    <td style="font-size:12px;">${x.recorder||'-'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openIncidentModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteIncident('${x.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="8"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">ยังไม่มีรายงานอุบัติเหตุ</div></div></td></tr>`;

  const woundTb = document.getElementById('wound-table-body');
  if (woundTb) woundTb.innerHTML = wounds.length ? wounds.map(x=>`<tr>
    <td>${x.date||''}</td>
    <td>${x.patientName||''}</td>
    <td>${x.location||''}</td>
    <td><span class="badge ${x.stage?.includes('4')?'badge-red':x.stage?.includes('3')?'badge-orange':'badge-blue'}">${x.stage||''}</span></td>
    <td style="font-size:12px;">${x.width||0}×${x.length||0}×${x.depth||0}</td>
    <td style="font-size:12px;">${x.appearance||'-'}</td>
    <td style="font-size:12px;max-width:160px;">${x.treatment||'-'}</td>
    <td style="font-size:12px;">${x.recorder||'-'} ${TREND[x.trend]||''}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openWoundModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteWound('${x.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🩹</div><div class="empty-text">ยังไม่มีบันทึกแผลกดทับ</div></div></td></tr>`;
}

// =======================================================
// ── DIETARY & TUBE FEEDING SYSTEM ───────────────────────
// =======================================================

function switchDietTab(tab) {
  document.getElementById('diet-tab-diets').style.display = tab==='diets' ? '' : 'none';
  document.getElementById('diet-tab-tubefeed').style.display = tab==='tubefeed' ? '' : 'none';
  document.querySelectorAll('#page-dietary .tabs .tab').forEach((t,i)=>{
    t.classList.toggle('active',(i===0&&tab==='diets')||(i===1&&tab==='tubefeed'));
  });
  if (tab==='tubefeed') renderTubeFeedTable();
}

function openDietModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('diet-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('diet-edit-id').value = id||'';
  document.getElementById('modal-diet-title').textContent = id ? '✏️ แก้ไขแผนอาหาร' : '🍽️ กำหนดแผนอาหารผู้ป่วย';
  // reset checkboxes
  document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]').forEach(cb=>cb.checked=false);
  if (id) {
    const d = (db.diets||[]).find(x=>x.id==id);
    if (d) {
      document.getElementById('diet-patient').value = d.patientId;
      document.getElementById('diet-type').value = d.dietType;
      document.getElementById('diet-meals').value = d.meals||'3 มื้อ';
      document.getElementById('diet-note').value = d.note||'';
      const restrictions = d.restrictions||[];
      document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]').forEach(cb=>{
        if(restrictions.includes(cb.value)) cb.checked=true;
      });
    }
  } else {
    document.getElementById('diet-note').value='';
  }
  openModal('modal-diet');
}

async function saveDiet() {
  const patientId = document.getElementById('diet-patient').value;
  const dietType = document.getElementById('diet-type').value;
  if (!patientId) { toast('กรุณาเลือกผู้ป่วย','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const restrictions = [...document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]:checked')].map(cb=>cb.value);
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    diet_type: dietType, meals: document.getElementById('diet-meals').value,
    restrictions: JSON.stringify(restrictions),
    note: document.getElementById('diet-note').value,
    updated_at: new Date().toISOString()
  };
  const editId = document.getElementById('diet-edit-id').value;
  if (editId) {
    if (supa) await supa.from('patient_diets').update(row).eq('id', editId);
    const idx = (db.diets||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.diets[idx] = mapDiet({id:editId,...row});
  } else {
    row.created_at = new Date().toISOString();
    if (supa) { const {data} = await supa.from('patient_diets').insert(row).select().single(); if(data){if(!db.diets)db.diets=[];db.diets.unshift(mapDiet(data));} }
    else { if(!db.diets)db.diets=[]; db.diets.unshift(mapDiet({id:Date.now(),...row})); }
  }
  closeModal('modal-diet');
  renderDietaryPage();
  toast('บันทึกแผนอาหารแล้ว','success');
}

function mapDiet(r) {
  let restrictions = [];
  try { 
    if (Array.isArray(r.restrictions)) restrictions = r.restrictions;
    else if (typeof r.restrictions==='string') restrictions = JSON.parse(r.restrictions||'[]');
    else if (r.restrictions) restrictions = Object.values(r.restrictions);
  } catch(e){ restrictions = []; }
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, dietType:r.diet_type, meals:r.meals||r.meal_count||'3 มื้อ', restrictions, note:r.note, updatedAt:r.updated_at, date:r.date, recorder:r.recorder, calories:r.calories, protein:r.protein };
}

async function deleteDiet(id) {
  if (!confirm('ลบแผนอาหารนี้?')) return;
  if (supa) await supa.from('patient_diets').delete().eq('id', id);
  db.diets = (db.diets||[]).filter(x=>x.id!=id);
  renderDietaryPage(); toast('ลบแล้ว','success');
}

function openTubeFeedModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('tubefeed-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('tubefeed-edit-id').value = id||'';
  document.getElementById('modal-tubefeed-title').textContent = id ? '✏️ แก้ไขบันทึก' : '🧪 บันทึกการให้อาหารทางสายยาง';
  if (id) {
    const t = (db.tubeFeeds||[]).find(x=>x.id==id);
    if (t) {
      document.getElementById('tubefeed-patient').value = t.patientId;
      document.getElementById('tubefeed-date').value = t.date;
      document.getElementById('tubefeed-time').value = t.time||'';
      document.getElementById('tubefeed-meal').value = t.meal||'เช้า';
      document.getElementById('tubefeed-formula').value = t.formula||'';
      document.getElementById('tubefeed-volume').value = t.volume||'';
      document.getElementById('tubefeed-water').value = t.water||'';
      document.getElementById('tubefeed-residual').value = t.residual||'';
      document.getElementById('tubefeed-recorder').value = t.recorder||'';
      document.getElementById('tubefeed-note').value = t.note||'';
    }
  } else {
    const now = new Date();
    document.getElementById('tubefeed-date').value = now.toISOString().split('T')[0];
    document.getElementById('tubefeed-time').value = now.toTimeString().slice(0,5);
    ['formula','volume','water','residual','note'].forEach(f=>document.getElementById('tubefeed-'+f).value='');
    document.getElementById('tubefeed-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-tubefeed');
}

async function saveTubeFeed() {
  const patientId = document.getElementById('tubefeed-patient').value;
  if (!patientId) { toast('กรุณาเลือกผู้ป่วย','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    date: document.getElementById('tubefeed-date').value,
    time: document.getElementById('tubefeed-time').value,
    meal: document.getElementById('tubefeed-meal').value,
    formula: document.getElementById('tubefeed-formula').value,
    volume: parseFloat(document.getElementById('tubefeed-volume').value)||0,
    water: parseFloat(document.getElementById('tubefeed-water').value)||0,
    residual: parseFloat(document.getElementById('tubefeed-residual').value)||0,
    recorder: document.getElementById('tubefeed-recorder').value,
    note: document.getElementById('tubefeed-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('tubefeed-edit-id').value;
  if (editId) {
    if (supa) await supa.from('tube_feedings').update(row).eq('id', editId);
    const idx = (db.tubeFeeds||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.tubeFeeds[idx] = mapTubeFeed({id:editId,...row});
  } else {
    if (supa) { const {data} = await supa.from('tube_feedings').insert(row).select().single(); if(data){if(!db.tubeFeeds)db.tubeFeeds=[];db.tubeFeeds.unshift(mapTubeFeed(data));} }
    else { if(!db.tubeFeeds)db.tubeFeeds=[]; db.tubeFeeds.unshift(mapTubeFeed({id:Date.now(),...row})); }
  }
  closeModal('modal-tubefeed');
  renderTubeFeedTable();
  toast('บันทึกการให้อาหารทางสายแล้ว','success');
}

function mapTubeFeed(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, date:r.date, time:r.time, meal:r.meal, formula:r.formula, volume:r.volume, water:r.water, residual:r.residual, recorder:r.recorder, note:r.note };
}

async function deleteTubeFeed(id) {
  if (!confirm('ลบบันทึกนี้?')) return;
  if (supa) await supa.from('tube_feedings').delete().eq('id', id);
  db.tubeFeeds = (db.tubeFeeds||[]).filter(x=>x.id!=id);
  renderTubeFeedTable(); toast('ลบแล้ว','success');
}

async function renderDietaryPage() {
  // โหลดข้อมูลล่าสุดจาก Supabase
  if (supa) {
    const { data: dietData } = await supa.from('patient_diets').select('*').order('updated_at',{ascending:false});
    if (dietData) db.diets = dietData.map(r=>({id:r.id,patientId:r.patient_id,patientName:r.patient_name,dietType:r.diet_type,calories:r.calories,protein:r.protein,restrictions:r.restrictions||[],note:r.note,recorder:r.recorder,date:r.date}));
    const { data: tubeData } = await supa.from('tube_feedings').select('*').order('date',{ascending:false});
    if (tubeData) db.tubeFeeds = tubeData.map(r=>({id:r.id,patientId:r.patient_id,patientName:r.patient_name,date:r.date,time:r.time,formula:r.formula,volumeMl:r.volume_ml,rateMlHr:r.rate_ml_hr,route:r.route,recorder:r.recorder,note:r.note}));
  }
  // populate filter dropdown
  const sel = document.getElementById('tubefeed-filter-patient');
  if (sel) {
    const patients = (db.patients||[]).filter(p=>p.status==='active');
    sel.innerHTML = '<option value="">— เลือกผู้ป่วย —</option>' + patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  }
  const DIET_LABELS = {'ธรรมดา':'🍚','สับละเอียด':'🔪','ปั่นละเอียด':'🥣','อาหารเหลวใส':'🫗','สายยาง (Tube Feed)':'🧪'};
  const tb = document.getElementById('diet-table-body');
  const diets = db.diets||[];
  if (tb) tb.innerHTML = diets.length ? diets.map(d=>`<tr>
    <td style="font-weight:600;">${d.patientName||''}</td>
    <td>${DIET_LABELS[d.dietType]||''} ${d.dietType||''}</td>
    <td style="font-size:12px;">${(Array.isArray(d.restrictions) ? d.restrictions : (typeof d.restrictions==='string' ? JSON.parse(d.restrictions||'[]') : [])).join(', ')||'—'}</td>
    <td>${d.meals||'3 มื้อ'}</td>
    <td style="font-size:12px;">${d.note||'—'}</td>
    <td style="font-size:11px;color:var(--text2);">${(d.updatedAt||'').slice(0,10)}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openDietModal('${d.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDiet('${d.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">🍽️</div><div class="empty-text">ยังไม่มีแผนอาหาร</div></div></td></tr>`;
}

function renderTubeFeedTable() {
  const patientId = document.getElementById('tubefeed-filter-patient')?.value||'';
  const date = document.getElementById('tubefeed-filter-date')?.value||'';
  let feeds = (db.tubeFeeds||[]);
  if (patientId) feeds = feeds.filter(x=>String(x.patientId)===String(patientId));
  if (date) feeds = feeds.filter(x=>x.date===date);
  const tb = document.getElementById('tubefeed-table-body');
  if (tb) tb.innerHTML = feeds.length ? feeds.map(x=>`<tr>
    <td><div style="font-weight:600;">${x.date||''}</div><div style="font-size:11px;color:var(--text2);">${x.time||''} ${x.meal||''}</div></td>
    <td>${x.patientName||''}</td>
    <td style="font-size:12px;">${x.formula||'—'}</td>
    <td style="text-align:center;">${x.volume||0}</td>
    <td style="text-align:center;">${x.water||0}</td>
    <td style="text-align:center;${(x.residual||0)>150?'color:var(--red);font-weight:700;':''}">${x.residual||0}</td>
    <td style="font-size:12px;">${x.recorder||'—'}</td>
    <td style="font-size:12px;">${x.note||'—'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openTubeFeedModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteTubeFeed('${x.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🧪</div><div class="empty-text">ยังไม่มีบันทึก</div></div></td></tr>`;
}

function printDietaryReport() {
  const diets = db.diets||[];
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบจัดอาหารประจำวัน</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;padding:24px;}
  h1{font-size:18px;color:#2d4a38;margin-bottom:4px;}h2{font-size:12px;color:#888;margin-bottom:16px;font-weight:400;}
  table{width:100%;border-collapse:collapse;}th{background:#2d4a38;color:#fff;padding:8px 10px;font-size:12px;}
  td{border:1px solid #ddd;padding:7px 10px;}.print-btn{position:fixed;top:12px;right:12px;background:#5a9e7a;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;}
  @media print{.print-btn{display:none;}}</style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์</button>
  <h1>🍽️ ใบจัดอาหารประจำวัน — นวศรี เนอร์สซิ่งโฮม</h1>
  <h2>วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</h2>
  <table><thead><tr><th>#</th><th>ผู้ป่วย</th><th>ประเภทอาหาร</th><th>มื้อ</th><th>ข้อจำกัด</th><th>หมายเหตุ</th></tr></thead><tbody>
  ${diets.map((d,i)=>`<tr><td style="text-align:center;">${i+1}</td><td style="font-weight:600;">${d.patientName||''}</td><td>${d.dietType||''}</td><td>${d.meals||'3 มื้อ'}</td><td>${(Array.isArray(d.restrictions) ? d.restrictions : (typeof d.restrictions==='string' ? JSON.parse(d.restrictions||'[]') : [])).join(', ')||'—'}</td><td>${d.note||'—'}</td></tr>`).join('')}
  </tbody></table></body></html>`);
  w.document.close();
}

// =======================================================
// ── DEPOSITS SYSTEM ─────────────────────────────────────
// =======================================================

function openDepositModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('deposit-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('deposit-edit-id').value = id||'';
  document.getElementById('modal-deposit-title').textContent = id ? '✏️ แก้ไขรายการมัดจำ' : '🏦 บันทึกเงินมัดจำ / เงินประกัน';
  if (id) {
    const dep = (db.deposits||[]).find(x=>x.id==id);
    if (dep) {
      document.getElementById('deposit-patient').value = dep.patientId;
      document.getElementById('deposit-type').value = dep.type;
      document.getElementById('deposit-amount').value = dep.amount;
      document.getElementById('deposit-date-in').value = dep.dateIn;
      document.getElementById('deposit-pay-method').value = dep.payMethod;
      document.getElementById('deposit-status').value = dep.status;
      document.getElementById('deposit-date-out').value = dep.dateOut||'';
      document.getElementById('deposit-note').value = dep.note||'';
    }
  } else {
    document.getElementById('deposit-date-in').value = new Date().toISOString().split('T')[0];
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-date-out').value = '';
    document.getElementById('deposit-note').value = '';
    document.getElementById('deposit-status').value = 'active';
  }
  document.getElementById('deposit-return-group').style.display = document.getElementById('deposit-status').value!=='active' ? '' : 'none';
  document.getElementById('deposit-status').onchange = function(){ document.getElementById('deposit-return-group').style.display = this.value!=='active'?'':'none'; };
  openModal('modal-deposit');
}

async function saveDeposit() {
  const patientId = document.getElementById('deposit-patient').value;
  const amount = parseFloat(document.getElementById('deposit-amount').value)||0;
  if (!patientId||!amount) { toast('กรุณากรอกข้อมูลที่จำเป็น','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    type: document.getElementById('deposit-type').value,
    amount, date_in: document.getElementById('deposit-date-in').value,
    pay_method: document.getElementById('deposit-pay-method').value,
    status: document.getElementById('deposit-status').value,
    date_out: document.getElementById('deposit-date-out').value||null,
    note: document.getElementById('deposit-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('deposit-edit-id').value;
  if (editId) {
    if (supa) await supa.from('patient_deposits').update(row).eq('id', editId);
    const idx = (db.deposits||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.deposits[idx] = mapDeposit({id:editId,...row});
  } else {
    if (supa) { const {data} = await supa.from('patient_deposits').insert(row).select().single(); if(data){if(!db.deposits)db.deposits=[];db.deposits.unshift(mapDeposit(data));} }
    else { if(!db.deposits)db.deposits=[]; db.deposits.unshift(mapDeposit({id:Date.now(),...row})); }
  }
  closeModal('modal-deposit');
  renderDeposits();
  toast('บันทึกเงินมัดจำแล้ว','success');
}

function mapDeposit(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, type:r.type, amount:r.amount, dateIn:r.date_in, payMethod:r.pay_method, status:r.status, dateOut:r.date_out, note:r.note };
}

async function deleteDeposit(id) {
  if (!confirm('ลบรายการมัดจำนี้?')) return;
  if (supa) await supa.from('patient_deposits').delete().eq('id', id);
  db.deposits = (db.deposits||[]).filter(x=>x.id!=id);
  renderDeposits(); toast('ลบแล้ว','success');
}

async function renderDeposits() {
  // โหลดข้อมูลล่าสุดจาก Supabase
  if (supa) {
    const { data } = await supa.from('patient_deposits').select('*').order('date_in',{ascending:false});
    if (data) db.deposits = data.map(mapDeposit);
  }
  const search = (document.getElementById('deposit-search')?.value||'').toLowerCase();
  const statusFilter = document.getElementById('deposit-filter-status')?.value||'';
  let deps = (db.deposits||[]).filter(d=>{
    const matchSearch = !search || (d.patientName||'').toLowerCase().includes(search);
    const matchStatus = !statusFilter || d.status===statusFilter;
    return matchSearch && matchStatus;
  });
  const total = (db.deposits||[]).reduce((s,d)=>s+d.amount,0);
  const active = (db.deposits||[]).filter(d=>d.status==='active').reduce((s,d)=>s+d.amount,0);
  const done = (db.deposits||[]).filter(d=>d.status!=='active').reduce((s,d)=>s+d.amount,0);
  const fmt = v=>'฿'+v.toLocaleString('th-TH',{minimumFractionDigits:0});
  document.getElementById('dep-stat-total').textContent = fmt(total);
  document.getElementById('dep-stat-active').textContent = fmt(active);
  document.getElementById('dep-stat-done').textContent = fmt(done);
  const STATUS_BADGE = {active:'badge-blue',refunded:'badge-green',deducted:'badge-orange'};
  const STATUS_LABEL = {active:'💼 ถือครอง',refunded:'✅ คืนแล้ว',deducted:'🔄 หักชำระ'};
  const tb = document.getElementById('deposit-table-body');
  if (tb) tb.innerHTML = deps.length ? deps.map(d=>`<tr>
    <td style="font-weight:600;">${d.patientName||''}</td>
    <td style="font-size:12px;">${d.type||''}</td>
    <td style="font-weight:700;color:var(--green);">${fmt(d.amount||0)}</td>
    <td>${d.dateIn||''}</td>
    <td style="font-size:12px;">${d.payMethod||''}</td>
    <td><span class="badge ${STATUS_BADGE[d.status]||'badge-gray'}">${STATUS_LABEL[d.status]||d.status}</span></td>
    <td style="font-size:12px;">${d.dateOut||'—'}</td>
    <td style="font-size:12px;max-width:150px;">${d.note||'—'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openDepositModal('${d.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDeposit('${d.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🏦</div><div class="empty-text">ยังไม่มีรายการมัดจำ</div></div></td></tr>`;
}

// =======================================================
// ── HOOK INTO showPage & loadData ───────────────────────
// =======================================================

// Patch renderPage to handle new pages
// Hook new pages into existing renderPage
const _renderPageOrig = renderPage;
renderPage = function(page) {
  _renderPageOrig(page);
  if (page==='incident') {
    const el = document.getElementById('incident-filter-month');
    if (el && !el.value) el.value = new Date().toISOString().slice(0,7);
    renderIncidentPage();
  } else if (page==='dietary') {
    renderDietaryPage();
  } else if (page==='deposits') {
    renderDeposits();
  }
};

// Add new page titles to existing showPage titles object

// Load new tables from Supabase on init
const _origLoadData = typeof loadData==='function' ? loadData : null;
async function loadNewTables() {
  if (!supa) return;
  try {
    const [inc, wnd, diets, feeds, deps] = await Promise.all([
      supa.from('incident_reports').select('*').order('date',{ascending:false}),
      supa.from('patient_wounds').select('*').order('wound_date',{ascending:false}),
      supa.from('patient_diets').select('*').order('updated_at',{ascending:false}),
      supa.from('tube_feedings').select('*').order('date',{ascending:false}),
      supa.from('patient_deposits').select('*').order('date_in',{ascending:false}),
    ]);
    db.incidents = (inc.data||[]).map(mapIncident);
    db.wounds = (wnd.data||[]).map(mapWound);
    db.diets = (diets.data||[]).map(mapDiet);
    db.tubeFeeds = (feeds.data||[]).map(mapTubeFeed);
    db.deposits = (deps.data||[]).map(mapDeposit);
  } catch(e) {
    db.incidents=[]; db.wounds=[]; db.diets=[]; db.tubeFeeds=[]; db.deposits=[];
  }
}
// loadNewTables ถูกเรียกจาก loadDB ใน db.js แล้ว