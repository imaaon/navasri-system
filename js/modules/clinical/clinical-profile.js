// ===== CLINICAL PROFILE =====

async function openPatientProfile(id) {
  try {
  const p = db.patients.find(x => x.id == id);
  if (!p) { toast('à¹à¸¡à¹à¸à¸à¸à¹à¸­à¸¡à¸¹à¸¥à¸à¸¹à¹à¸£à¸±à¸à¸à¸£à¸´à¸à¸²à¸£','error'); return; }
  document.getElementById('patprofile-breadcrumb').textContent = p.name;
  // Query all reqs for this patient directly (no time limit â full history per patient)
  const { data: reqData } = await supa.from('requisitions').select('*').eq('patient_id', String(p.id)).order('id', {ascending:false});
  const reqs = (reqData||[]).map(mapReq);
  const age  = p.dob ? calcAge(p.dob) : '-';
  const dur  = p.admitDate ? calcDuration(p.admitDate, p.endDate) : '-';
  const isActive = p.status === 'active';
  const idcard = p.idcard || p.idCard || '-';
  const totalReqs = reqs.length;
  const totalQty  = reqs.reduce((s,r) => s+(r.qty||0), 0);
  // Load clinical data lazily
  showPage('patprofile');
  await loadPatientClinical(id);
  const pid = String(id);

  document.getElementById('patprofile-content').innerHTML = `
  <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">
    <!-- LEFT: Profile card -->
    <div>
      <div class="card" style="text-align:center;padding:28px 20px;">
        ${(p.photo||"") ? `<img src="${p.photo}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--sage);margin:0 auto 12px;">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--sage-light);border:3px solid var(--sage);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:40px;">ð¤</div>`}
        <div style="font-size:17px;font-weight:700;margin-bottom:4px;">${p.name}</div>
        <span class="badge ${isActive ? 'badge-green' : 'badge-gray'}" style="font-size:13px;padding:4px 14px;">${isActive ? 'ð  à¸à¸±à¸à¸­à¸¢à¸¹à¹' : 'ðª à¸­à¸­à¸à¹à¸¥à¹à¸§'}</span>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalReqs}</div>
            <div style="font-size:11px;color:var(--text2);">à¸à¸£à¸±à¹à¸à¸à¸µà¹à¹à¸à¸´à¸</div>
          </div>
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalQty}</div>
            <div style="font-size:11px;color:var(--text2);">à¸«à¸à¹à¸§à¸¢à¸£à¸§à¸¡</div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-primary" style="width:100%;" onclick="editPatient('${p.id}')">âï¸ à¹à¸à¹à¹à¸à¸à¹à¸­à¸¡à¸¹à¸¥</button>
        </div>
      </div>
      <!-- Info card -->
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><div class="card-title" style="font-size:13px;">ð à¸à¹à¸­à¸¡à¸¹à¸¥à¸ªà¹à¸§à¸à¸à¸±à¸§</div></div>
        <div style="padding:14px 16px;font-size:13px;display:flex;flex-direction:column;gap:10px;">
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸à¸±à¸à¸£/à¸à¸²à¸ªà¸à¸­à¸£à¹à¸</span><strong>${idcard}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸§à¸±à¸à¹à¸à¸´à¸</span><strong>${p.dob||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸­à¸²à¸¢à¸¸</span><strong>${age}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸§à¸±à¸à¹à¸£à¸à¸£à¸±à¸</span><strong>${p.admitDate||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸§à¸±à¸à¸ªà¸´à¹à¸à¸ªà¸±à¸à¸à¸²</span><strong>${p.endDate||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸£à¸°à¸¢à¸°à¹à¸§à¸¥à¸²</span><strong>${dur}</strong></div>
          ${p.phone ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¹à¸à¸£à¸¨à¸±à¸à¸à¹</span><strong>${p.phone}</strong></div>` : ''}
          ${p.emergency ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;">à¸à¸¹à¹à¸à¸¹à¹à¸¥</span><strong>${p.emergency}</strong></div>` : ''}
          ${p.address ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;vertical-align:top;">à¸à¸µà¹à¸­à¸¢à¸¹à¹</span><strong>${p.address}</strong></div>` : ''}
        </div>
      </div>
      <!-- Bed/Room card -->
      ${(() => { const bed = getPatientBed(p); const room = getPatientRoom(p); if (!bed) return ''; return `
      <div class="card" style="margin-top:12px;">
        <div class="card-header" style="background:var(--accent-light);">
          <div class="card-title" style="font-size:13px;color:var(--accent-dark);">ðï¸ à¸«à¹à¸­à¸à¸à¸±à¸à¸à¸±à¸à¸à¸¸à¸à¸±à¸</div>
          <button class="btn btn-ghost btn-sm" onclick="editPatient('${p.id}')">à¹à¸à¸¥à¸µà¹à¸¢à¸</button>
        </div>
        <div style="padding:12px 16px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">à¸«à¹à¸­à¸</span><strong>${room?.name||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">à¹à¸à¸µà¸¢à¸</span><strong>${bed.bedCode}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">à¸à¸£à¸°à¹à¸ à¸</span><strong>${room?.roomType||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">à¹à¸à¸</span><strong>${room?.zone||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">à¸à¹à¸²à¸«à¹à¸­à¸</span><strong style="color:var(--accent);">${room?.monthlyRate ? room.monthlyRate.toLocaleString('th-TH')+' à¸¿/à¹à¸à¸·à¸­à¸' : '-'}</strong></div>
        </div>
      </div>`; })()}
    </div>
    <!-- RIGHT: Tabs -->
    <div>
      ${renderAllergyBanner(p)}
      <div class="tabs" id="patprofileTabs" style="margin-bottom:16px;">
        <div class="tab active" onclick="switchPatTab('history')">ð¦ à¸à¸£à¸°à¸§à¸±à¸à¸´à¹à¸à¸´à¸ (${totalReqs})</div>
        <div class="tab" onclick="switchPatTab('medical')">ð¥ à¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¸£à¸±à¸à¸©à¸²</div>
        <div class="tab" onclick="switchPatTab('meds')">ð à¸¢à¸²à¸à¸£à¸°à¸à¸³</div>
        <div class="tab${p.allergies?.length ? ' tab-alert' : ''}" onclick="switchPatTab('allergy')">ð¨ à¹à¸à¹à¸¢à¸²/à¸­à¸²à¸«à¸²à¸£ ${p.allergies?.length ? `<span style="background:#c0392b;color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">${p.allergies.length}</span>` : ''}</div>
        <div class="tab${p.contacts?.length ? '' : ''}" onclick="switchPatTab('contacts')">ð¥ à¸à¸¹à¹à¸à¸´à¸à¸à¹à¸­ ${p.contacts?.length ? `<span style="background:var(--accent);color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">${p.contacts.length}</span>` : ''}</div>
        <div class="tab" onclick="switchPatTab('notes')">ð à¸«à¸¡à¸²à¸¢à¹à¸«à¸à¸¸</div>
        <div class="tab" onclick="switchPatTab('mar')">ð MAR à¸¢à¸²à¸à¸£à¸°à¸à¸³à¸§à¸±à¸</div>
        <div class="tab" onclick="switchPatTab('vitals')">ð Vital Signs</div>
        <div class="tab" onclick="switchPatTab('nursing')">ð à¸à¸±à¸à¸à¸¶à¸à¸à¸¢à¸²à¸à¸²à¸¥</div>
        <div class="tab" onclick="switchPatTab('appts')">ð à¸à¸±à¸à¸«à¸¡à¸²à¸¢à¹à¸à¸à¸¢à¹</div>
        <div class="tab" onclick="switchPatTab('belongings')">ð§³ à¸à¸£à¸±à¸à¸¢à¹à¸ªà¸´à¸</div>
        <div class="tab" onclick="switchPatTab('dnr')">âï¸ DNR & Consent</div>
        <div class="tab" onclick="switchPatTab('physio')">ð¤¸ à¸à¸²à¸¢à¸ à¸²à¸à¸à¸³à¸à¸±à¸</div>
<div class="tab" onclick="switchPatTab('dispense')">ð à¹à¸à¸´à¸à¸ªà¸´à¸à¸à¹à¸²</div>
      </div>
      <div id="patprofile-tab-history">
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>à¸§à¸±à¸à¸à¸µà¹</th><th>à¸£à¸²à¸¢à¸à¸²à¸£</th><th>à¸à¸³à¸à¸§à¸</th><th>à¸«à¸à¹à¸§à¸¢</th><th>à¸à¸¹à¹à¹à¸à¸´à¸</th><th></th></tr></thead>
              <tbody>
                ${reqs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¹à¸à¸´à¸</td></tr>' :
                  reqs.map(r => `<tr>
                    <td class="number" style="font-size:12px;white-space:nowrap;">${r.date||'-'}</td>
                    <td style="font-weight:500;">${r.itemName||'-'}</td>
                    <td class="number">${r.qty||0}</td>
                    <td>${r.unit||''}</td>
                    <td style="font-size:12px;">${r.staffName||'-'}</td>
                    <td><button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">ð¨ï¸</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="patprofile-tab-medical" style="display:none;">
        ${renderMedLogTab(p.id, 'medical')}
      </div>
      <div id="patprofile-tab-meds" style="display:none;">
        ${''}
      </div>
      <!-- ALLERGY TAB -->
      <div id="patprofile-tab-allergy" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">ð¨ à¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¹à¸à¹à¸¢à¸² / à¸­à¸²à¸«à¸²à¸£</div>
            <button class="btn btn-primary btn-sm" onclick="openAddAllergyModal('${p.id}')">+ à¹à¸à¸´à¹à¸¡</button>
          </div>
          ${p.allergies?.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--text3);">â à¹à¸¡à¹à¸¡à¸µà¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¹à¸à¹à¸à¸µà¹à¸à¸±à¸à¸à¸¶à¸à¹à¸§à¹</div>` :
          `<table>
            <thead><tr><th>à¸ªà¸´à¹à¸à¸à¸µà¹à¹à¸à¹</th><th>à¸à¸£à¸°à¹à¸ à¸</th><th>à¸£à¸°à¸à¸±à¸à¸à¸§à¸²à¸¡à¸£à¸¸à¸à¹à¸£à¸</th><th>à¸­à¸²à¸à¸²à¸£</th><th></th></tr></thead>
            <tbody>
              ${(p.allergies||[]).map(a => {
                return `<tr>
                  <td style="font-weight:700;">${a.allergen}</td>
                  <td><span class="badge badge-gray">${a.allergyType}</span></td>
                  <td style="font-size:12px;color:var(--text2);">${a.severity||'-'}</td>
                  <td style="font-size:12px;color:var(--text2);">${a.reaction||'-'}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="openEditAllergyModal('${p.id}','${a.id}')" title="à¹à¸à¹à¹à¸">âï¸</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteAllergy('${p.id}','${a.id}')">ðï¸</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
      <!-- CONTACTS TAB -->
      <div id="patprofile-tab-contacts" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">ð¥ à¸à¸¹à¹à¸à¸´à¸à¸à¹à¸­ / à¸à¸¹à¹à¸£à¸±à¸à¸à¸´à¸à¸à¸­à¸à¸à¹à¸²à¹à¸à¹à¸à¹à¸²à¸¢</div>
            <button class="btn btn-primary btn-sm" onclick="openAddContactModal('${p.id}')">+ à¹à¸à¸´à¹à¸¡</button>
          </div>
          ${p.contacts?.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--text3);">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¹à¸­à¸¡à¸¹à¸¥à¸à¸¹à¹à¸à¸´à¸à¸à¹à¸­</div>` :
          `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
            ${(p.contacts||[]).map(c => `
              <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;background:${c.isPayer?'#f0faf5':c.isDecisionMaker?'#f0f0fa':'var(--surface2)'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="font-weight:700;font-size:14px;">${c.name} <span style="font-size:12px;font-weight:400;color:var(--text3);">(${c.relation})</span></div>
                    <div style="font-size:12px;color:var(--text2);margin-top:4px;">ð ${c.phone||'-'} ${c.email ? 'Â· âï¸ '+c.email : ''}</div>
                    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                      ${c.isPayer ? '<span class="badge badge-green">ð° à¸à¸¹à¹à¸£à¸±à¸à¸à¸´à¸à¸à¸­à¸à¸à¹à¸²à¹à¸à¹à¸à¹à¸²à¸¢</span>' : ''}
                      ${c.isDecisionMaker ? '<span class="badge" style="background:#e8e8f8;color:#3d3d9e;">ð§  à¸à¸¹à¹à¸¡à¸µà¸­à¸³à¸à¸²à¸à¸à¸±à¸à¸ªà¸´à¸à¹à¸</span>' : ''}
                      ${!c.isPayer && !c.isDecisionMaker ? '<span class="badge badge-gray">ð à¸à¸¹à¹à¸à¸´à¸à¸à¹à¸­à¸à¸¸à¸à¹à¸à¸´à¸</span>' : ''}
                    </div>
                    ${c.note ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">ð ${c.note}</div>` : ''}
                  </div>
                  <button class="btn btn-ghost btn-sm" onclick="openEditContactModal('${p.id}','${c.id}')" style="margin-right:4px;">âï¸</button><button class="btn btn-ghost btn-sm" onclick="deleteContact('${p.id}','${c.id}')">ðï¸</button>
                </div>
              </div>`).join('')}
          </div>`}
        </div>
      </div>
      <div id="patprofile-tab-notes" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">ð à¸«à¸¡à¸²à¸¢à¹à¸«à¸à¸¸</div>
            <button class="btn btn-ghost btn-sm" onclick="editPatient('${p.id}')">âï¸ à¹à¸à¹à¹à¸</button>
          </div>
          <div style="padding:16px 20px;font-size:13px;line-height:1.7;white-space:pre-wrap;min-height:80px;">${p.note || '<span style="color:var(--text3);">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¹à¸­à¸¡à¸¹à¸¥</span>'}</div>
        </div>
      </div>
      <!-- MAR TAB -->
      <div id="patprofile-tab-mar" style="display:none;">
        ${renderMARTab(pid, p.id)}
      </div>
      <!-- VITAL SIGNS TAB -->
      <div id="patprofile-tab-vitals" style="display:none;">
        ${renderVitalsTab(pid, p.id)}
      </div>
      <!-- NURSING NOTES TAB -->
      <div id="patprofile-tab-nursing" style="display:none;">
        ${renderNursingTab(pid, p.id)}
      </div>
      <!-- APPOINTMENTS TAB -->
      <div id="patprofile-tab-appts" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">ð à¸à¸±à¸à¸«à¸¡à¸²à¸¢à¹à¸à¸à¸¢à¹ / à¸ªà¹à¸à¸à¹à¸­à¹à¸£à¸à¸à¸¢à¸²à¸à¸²à¸¥</div>
            <button class="btn btn-primary btn-sm" onclick="openApptModal(null,'${p.id}','${p.name}')">+ à¹à¸à¸´à¹à¸¡à¸à¸±à¸</button>
          </div>
          <div id="appt-list-${p.id}">
            ${renderApptList(p.id)}
          </div>
        </div>
      </div>
      <!-- BELONGINGS TAB -->
      <div id="patprofile-tab-belongings" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">ð§³ à¸à¸£à¸±à¸à¸¢à¹à¸ªà¸´à¸à¸à¸­à¸à¸¡à¸µà¸à¹à¸²</div>
            <button class="btn btn-primary btn-sm" onclick="openBelongingModal(null,'${p.id}','${p.name}')">+ à¸à¸±à¸à¸à¸¶à¸à¸ªà¸´à¹à¸à¸à¸­à¸</button>
          </div>
          <div id="belonging-list-${p.id}">
            ${renderBelongingList(p.id)}
          </div>
        </div>
      </div>
      <!-- DNR & CONSENT TAB -->
      <div id="patprofile-tab-dnr" style="display:none;">
        <div id="dnr-panel-${p.id}">
          ${renderDnrPanel(p)}
        </div>
      </div>

      <div id="patprofile-tab-physio" style="display:none;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-weight:600;font-size:14px;">ð¤¸ à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸¢à¸ à¸²à¸à¸à¸³à¸à¸±à¸</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="physio-month-filter" class="form-control" style="width:160px;font-size:13px;" onchange="renderPhysioTab('${p.id}')">
              </select>
              <button class="btn btn-ghost btn-sm" onclick="exportPhysioExcel()" title="à¸ªà¹à¸à¸­à¸­à¸ Excel">ð¥ Excel</button>
              <button class="btn btn-primary btn-sm" onclick="openPhysioSessionModal('${p.id}','${p.name}')">+ à¸à¸±à¸à¸à¸¶à¸ Session</button>
            </div>
          </div>
          <div id="physio-summary-${p.id}" style="background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
          <div id="physio-list-${p.id}"></div>
        </div>
      </div>

      <div id="patprofile-tab-dispense" style="display:none;">
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <div class="card-title" style="font-size:13px;">ð à¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¹à¸à¸´à¸à¸ªà¸´à¸à¸à¹à¸²</div>
            <button class="btn btn-primary btn-sm" onclick="openQuickDispenseModal()">â¡ à¹à¸à¸´à¸à¸à¹à¸§à¸</button>
          </div>
          <div id="pat-dispense-list-${p.id}"></div>
        </div>
        <div class="card" style="margin-top:12px;">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;color:var(--orange);">ð§¾ à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸µà¹à¸¢à¸±à¸à¹à¸¡à¹à¸­à¸­à¸à¸à¸´à¸¥</div>
          </div>
          <div id="pat-unbilled-list-${p.id}"></div>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById('patprofile-tab-meds').innerHTML = renderMARTab(pid, p.id);
  } catch(err) { console.error('openPatientProfile error:', err); toast('à¹à¸à¸´à¸à¸à¹à¸­à¸à¸´à¸à¸à¸¥à¸²à¸: ' + err.message, 'error'); }
}

function switchPatTab(tab) {
  const tabs = ['history','medical','meds','allergy','contacts','notes','mar','vitals','nursing','appts','belongings','dnr','physio','dispense'];
  tabs.forEach(t => {
    const el = document.getElementById('patprofile-tab-'+t);
    if(el) el.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('#patprofileTabs .tab').forEach((el,i) => {
    el.classList.toggle('active', tabs[i] === tab);
  });
  if (tab === 'physio') {
    const btn = document.querySelector('#patprofile-tab-physio button');
    const pid = btn?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (pid) renderPhysioTab(pid);
  }
  if (tab === 'dispense') {
    const el = document.querySelector('[id^="pat-dispense-list-"]');
    const patId = el?.id?.replace('pat-dispense-list-','');
    if (patId) loadPatDispense(patId);
  }
}

async function loadPatDispense(patId) {
  const listEl     = document.getElementById('pat-dispense-list-' + patId);
  const unbilledEl = document.getElementById('pat-unbilled-list-' + patId);
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">à¸à¸³à¸¥à¸±à¸à¹à¸«à¸¥à¸...</div>';

  const reqs = (db.requisitions || [])
    .filter(r => String(r.patientId) === String(patId))
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));

  if (reqs.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¹à¸à¸´à¸</div>';
  } else {
    const statusBadge = s => s === 'approved'
      ? '<span class="badge badge-green">à¸­à¸à¸¸à¸¡à¸±à¸à¸´</span>'
      : s === 'rejected'
        ? '<span class="badge badge-red">à¹à¸¡à¹à¸­à¸à¸¸à¸¡à¸±à¸à¸´</span>'
        : '<span class="badge badge-orange">à¸£à¸­à¸­à¸à¸¸à¸¡à¸±à¸à¸´</span>';
    listEl.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
      '<th>à¸§à¸±à¸à¸à¸µà¹</th><th>à¸ªà¸´à¸à¸à¹à¸²</th><th style="text-align:right;">à¸à¸³à¸à¸§à¸</th>' +
      '<th>à¸«à¸à¹à¸§à¸¢</th><th>à¸ªà¸à¸²à¸à¸°</th><th>à¸à¸¹à¹à¹à¸à¸´à¸</th>' +
      '</tr></thead><tbody>' +
      reqs.slice(0, 50).map(r =>
        '<tr><td style="font-size:12px;">' + (r.date||'-') + '</td>' +
        '<td style="font-weight:500;">' + (r.itemName||'-') + '</td>' +
        '<td style="text-align:right;">' + (r.qty||0) + '</td>' +
        '<td style="font-size:12px;">' + (r.unit||'') + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td style="font-size:12px;">' + (r.staffName||'-') + '</td></tr>'
      ).join('') + '</tbody></table></div>';
  }

  // à¸£à¸²à¸¢à¸à¸²à¸£ billable à¸à¸µà¹à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µ invoice (unbilled)
  if (unbilledEl) {
    const items = reqs
      .filter(r => r.status === 'approved')
      .map(r => {
        const item = db.items.find(i => i.id == r.itemId);
        if (!item || item.isBillable === false) return null;
        const price = item.price || item.cost || 0;
        return { name: r.itemName, qty: r.qty, unit: r.unit, price, total: r.qty * price, date: r.date };
      }).filter(Boolean);

    if (items.length === 0) {
      unbilledEl.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:13px;">à¹à¸¡à¹à¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¸à¹à¸²à¸à¹à¸à¸´à¸¥à¸¥à¹</div>';
    } else {
      const grand = items.reduce((s, i) => s + i.total, 0);
      unbilledEl.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th>à¸§à¸±à¸à¸à¸µà¹</th><th>à¸ªà¸´à¸à¸à¹à¸²</th><th style="text-align:right;">à¸à¸³à¸à¸§à¸</th>' +
        '<th style="text-align:right;">à¸£à¸²à¸à¸²/à¸«à¸à¹à¸§à¸¢</th><th style="text-align:right;">à¸£à¸§à¸¡</th>' +
        '</tr></thead><tbody>' +
        items.map(i =>
          '<tr><td style="font-size:12px;">' + (i.date||'-') + '</td>' +
          '<td>' + i.name + '</td>' +
          '<td style="text-align:right;">' + i.qty + ' ' + i.unit + '</td>' +
          '<td style="text-align:right;">' + i.price.toLocaleString() + '</td>' +
          '<td style="text-align:right;font-weight:600;">' + i.total.toLocaleString() + '</td></tr>'
        ).join('') +
        '<tr style="background:var(--surface2);font-weight:600;">' +
        '<td colspan="4" style="text-align:right;">à¸£à¸§à¸¡à¸à¹à¸²à¸à¹à¸à¸´à¸¥à¸¥à¹</td>' +
        '<td style="text-align:right;">à¸¿' + grand.toLocaleString() + '</td></tr>' +
        '</tbody></table></div>' +
        '<div style="padding:10px 0;text-align:right;">' +
          '<button class="btn btn-primary btn-sm" onclick="openBillingFromPatient(\''+patId+'\')">' +
          'ð§¾ à¸ªà¸£à¹à¸²à¸ Invoice à¸à¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸à¸´à¸</button>' +
        '</div>';
    }
  }
}

// ââ Auto-billing shortcut à¸à¸²à¸ patient profile ââââââââââââââââ
function openBillingFromPatient(patId) {
  if (typeof showPage !== 'function' || typeof openCreateInvoiceModal !== 'function') {
    toast('à¸à¸£à¸¸à¸à¸²à¹à¸à¸´à¸à¸«à¸à¹à¸² Billing à¸à¹à¸­à¸', 'warning'); return;
  }
  showPage('billing');
  // delay à¹à¸«à¹ billing load à¸à¹à¸­à¸
  setTimeout(() => {
    openCreateInvoiceModal();
    // set patient
    setTimeout(() => {
      const sel = document.getElementById('inv-patient');
      if (sel) {
        sel.value = patId;
        if (typeof onInvoicePatientChange === 'function') onInvoicePatientChange();
        // auto-load requisitions
        setTimeout(() => {
          if (typeof loadRequisitionsForInvoice === 'function') loadRequisitionsForInvoice();
        }, 300);
      }
    }, 200);
  }, 400);
}

// ==========================================