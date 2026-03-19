// ===== CLINICAL PROFILE =====

async function openPatientProfile(id) {
  try {
  const p = db.patients.find(x => x.id == id);
  if (!p) { toast('ไม่พบข้อมูลผู้รับบริการ','error'); return; }
  document.getElementById('patprofile-breadcrumb').textContent = p.name;
  // Query all reqs for this patient directly (no time limit — full history per patient)
  const { data: reqData } = await supa
    .from('requisition_headers')
    .select('*, requisition_lines(*)')
    .eq('patient_id', p.id)
    .order('id', {ascending:false});
  const reqs = (reqData||[]).map(mapReq);
  const age  = p.dob ? calcAge(p.dob) : '-';
  const dur  = p.admitDate ? calcDuration(p.admitDate, p.endDate) : '-';
  const isActive = p.status === 'active';
  const idcard = p.idcard || p.idCard || '-';
  const totalReqs = reqs.length;
  const totalQty  = reqs.reduce((s,r) => s+(r.qty||0), 0);
  // badge สถานะรองรับทุก status รวมถึง hospital และ custom
  const statusBadgeHtml = (() => {
    const s = p.status;
    if (s === 'active')   return `<span class="badge badge-green" style="font-size:13px;padding:4px 14px;">🏠 พักอยู่</span>`;
    if (s === 'hospital') return `<span class="badge" style="font-size:13px;padding:4px 14px;background:#EBF5FB;color:#1565C0;border:1px solid #b3d7f0;">🏥 อยู่โรงพยาบาล</span>`;
    if (s === 'inactive') return `<span class="badge badge-gray" style="font-size:13px;padding:4px 14px;">🚪 ออกแล้ว</span>`;
    return `<span class="badge" style="font-size:13px;padding:4px 14px;background:#fef3e0;color:#d4760a;border:1px solid #f5c97a;">✏️ ${s}</span>`;
  })();
  // Load clinical data lazily
  showPage('patprofile');
  await loadPatientClinical(id);
  const pid = String(id);

  document.getElementById('patprofile-content').innerHTML = `
  <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">
    <!-- LEFT: Profile card -->
    <div>
      <div class="card" style="text-align:center;padding:28px 20px;">
        ${(p.photo||"") ? `<img src="${p.photo}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--sage);margin:0 auto 12px;">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--sage-light);border:3px solid var(--sage);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:40px;">👤</div>`}
        <div style="font-size:17px;font-weight:700;margin-bottom:4px;">${p.name}</div>
        ${statusBadgeHtml}
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalReqs}</div>
            <div style="font-size:11px;color:var(--text2);">ครั้งที่เบิก</div>
          </div>
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalQty}</div>
            <div style="font-size:11px;color:var(--text2);">หน่วยรวม</div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-primary" style="width:100%;" onclick="editPatient('${p.id}')">✏️ แก้ไขข้อมูล</button>
        </div>
      </div>
      <!-- Info card -->
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><div class="card-title" style="font-size:13px;">📋 ข้อมูลส่วนตัว</div></div>
        <div style="padding:14px 16px;font-size:13px;display:flex;flex-direction:column;gap:10px;">
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">บัตร/พาสปอร์ต</span><strong>${idcard}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">วันเกิด</span><strong>${p.dob||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">อายุ</span><strong>${age}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">วันแรกรับ</span><strong>${p.admitDate||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">วันสิ้นสัญญา</span><strong>${p.endDate||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:100px;display:inline-block;">ระยะเวลา</span><strong>${dur}</strong></div>
          ${p.phone ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;">โทรศัพท์</span><strong>${p.phone}</strong></div>` : ''}
          ${p.emergency ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;">ผู้ดูแล</span><strong>${p.emergency}</strong></div>` : ''}
          ${p.address ? `<div><span style="color:var(--text3);min-width:100px;display:inline-block;vertical-align:top;">ที่อยู่</span><strong>${p.address}</strong></div>` : ''}
        </div>
      </div>
      <!-- Bed/Room card -->
      ${(() => { const bed = getPatientBed(p); const room = getPatientRoom(p); if (!bed) return ''; return `
      <div class="card" style="margin-top:12px;">
        <div class="card-header" style="background:var(--accent-light);">
          <div class="card-title" style="font-size:13px;color:var(--accent-dark);">🛏️ ห้องพักปัจจุบัน</div>
          <button class="btn btn-ghost btn-sm" onclick="editPatient('${p.id}')">เปลี่ยน</button>
        </div>
        <div style="padding:12px 16px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">ห้อง</span><strong>${room?.name||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">เตียง</span><strong>${bed.bedCode}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">ประเภท</span><strong>${room?.roomType||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">โซน</span><strong>${room?.zone||'-'}</strong></div>
          <div><span style="color:var(--text3);min-width:80px;display:inline-block;">ค่าห้อง</span><strong style="color:var(--accent);">${room?.monthlyRate ? room.monthlyRate.toLocaleString('th-TH')+' ฿/เดือน' : '-'}</strong></div>
        </div>
      </div>`; })()}
    </div>
    <!-- RIGHT: Tabs -->
    <div>
      ${renderAllergyBanner(p)}
      <div class="tabs" id="patprofileTabs" style="margin-bottom:16px;">
        <div class="tab active" onclick="switchPatTab('history')">📦 ประวัติเบิก (${totalReqs})</div>
        <div class="tab" onclick="switchPatTab('medical')">🏥 ประวัติการรักษา</div>
        <div class="tab" onclick="switchPatTab('meds')">💊 ยาประจำ</div>
        <div class="tab${p.allergies?.length ? ' tab-alert' : ''}" onclick="switchPatTab('allergy')">🚨 แพ้ยา/อาหาร ${p.allergies?.length ? `<span style="background:#c0392b;color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">${p.allergies.length}</span>` : ''}</div>
        <div class="tab${p.contacts?.length ? '' : ''}" onclick="switchPatTab('contacts')">👥 ผู้ติดต่อ ${p.contacts?.length ? `<span style="background:var(--accent);color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">${p.contacts.length}</span>` : ''}</div>
        <div class="tab" onclick="switchPatTab('notes')">📝 หมายเหตุ</div>
        <div class="tab" onclick="switchPatTab('mar')">💊 MAR ยาประจำวัน</div>
        <div class="tab" onclick="switchPatTab('vitals')">📊 Vital Signs</div>
        <div class="tab" onclick="switchPatTab('nursing')">📋 บันทึกพยาบาล</div>
        <div class="tab" onclick="switchPatTab('appts')">🚐 นัดหมายแพทย์</div>
        <div class="tab" onclick="switchPatTab('belongings')">🧳 ทรัพย์สิน</div>
        <div class="tab" onclick="switchPatTab('dnr')">⚖️ DNR & Consent</div>
        <div class="tab" onclick="switchPatTab('physio')">🤸 กายภาพบำบัด</div>
<div class="tab" onclick="switchPatTab('dispense')">💊 เบิกสินค้า</div>
        <div class="tab" onclick="switchPatTab('statuslog')">📅 ประวัติสถานะ</div>
      </div>
      <div id="patprofile-tab-history">
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>วันที่</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ผู้เบิก</th><th></th></tr></thead>
              <tbody>
                ${reqs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">ยังไม่มีประวัติการเบิก</td></tr>' :
                  reqs.map(r => `<tr>
                    <td class="number" style="font-size:12px;white-space:nowrap;">${r.date||'-'}</td>
                    <td style="font-weight:500;">${r.itemName||'-'}</td>
                    <td class="number">${r.qty||0}</td>
                    <td>${r.unit||''}</td>
                    <td style="font-size:12px;">${r.staffName||'-'}</td>
                    <td><button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">🖨️</button></td>
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
        ${renderMedLogTab(p.id, 'meds')}
      </div>
      <!-- ALLERGY TAB -->
      <div id="patprofile-tab-allergy" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">🚨 ประวัติการแพ้ยา / อาหาร</div>
            <button class="btn btn-primary btn-sm" onclick="openAddAllergyModal('${p.id}')">+ เพิ่ม</button>
          </div>
          ${p.allergies?.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--text3);">✅ ไม่มีประวัติการแพ้ที่บันทึกไว้</div>` :
          `<table>
            <thead><tr><th>สิ่งที่แพ้</th><th>ประเภท</th><th>ระดับความรุนแรง</th><th>อาการ</th><th></th></tr></thead>
            <tbody>
              ${(p.allergies||[]).map(a => {
                return `<tr>
                  <td style="font-weight:700;">${a.allergen}</td>
                  <td><span class="badge badge-gray">${a.allergyType}</span></td>
                  <td style="font-size:12px;color:var(--text2);">${a.severity||'-'}</td>
                  <td style="font-size:12px;color:var(--text2);">${a.reaction||'-'}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="openEditAllergyModal('${p.id}','${a.id}')" title="แก้ไข">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteAllergy('${p.id}','${a.id}')">🗑️</button>
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
            <div class="card-title" style="font-size:13px;">👥 ผู้ติดต่อ / ผู้รับผิดชอบค่าใช้จ่าย</div>
            <button class="btn btn-primary btn-sm" onclick="openAddContactModal('${p.id}')">+ เพิ่ม</button>
          </div>
          ${p.contacts?.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีข้อมูลผู้ติดต่อ</div>` :
          `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
            ${(p.contacts||[]).map(c => `
              <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;background:${c.isPayer?'#f0faf5':c.isDecisionMaker?'#f0f0fa':'var(--surface2)'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="font-weight:700;font-size:14px;">${c.name} <span style="font-size:12px;font-weight:400;color:var(--text3);">(${c.relation})</span></div>
                    <div style="font-size:12px;color:var(--text2);margin-top:4px;">📞 ${c.phone||'-'} ${c.email ? '· ✉️ '+c.email : ''}</div>
                    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                      ${c.isPayer ? '<span class="badge badge-green">💰 ผู้รับผิดชอบค่าใช้จ่าย</span>' : ''}
                      ${c.isDecisionMaker ? '<span class="badge" style="background:#e8e8f8;color:#3d3d9e;">🧠 ผู้มีอำนาจตัดสินใจ</span>' : ''}
                      ${!c.isPayer && !c.isDecisionMaker ? '<span class="badge badge-gray">📞 ผู้ติดต่อฉุกเฉิน</span>' : ''}
                    </div>
                    ${c.note ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">📝 ${c.note}</div>` : ''}
                  </div>
                  <button class="btn btn-ghost btn-sm" onclick="openEditContactModal('${p.id}','${c.id}')" style="margin-right:4px;">✏️</button><button class="btn btn-ghost btn-sm" onclick="deleteContact('${p.id}','${c.id}')">🗑️</button>
                </div>
              </div>`).join('')}
          </div>`}
        </div>
      </div>
      <div id="patprofile-tab-notes" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">📝 หมายเหตุ</div>
            <button class="btn btn-ghost btn-sm" onclick="editPatient('${p.id}')">✏️ แก้ไข</button>
          </div>
          <div style="padding:16px 20px;font-size:13px;line-height:1.7;white-space:pre-wrap;min-height:80px;">${p.note || '<span style="color:var(--text3);">ยังไม่มีข้อมูล</span>'}</div>
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
            <div class="card-title" style="font-size:13px;">🚐 นัดหมายแพทย์ / ส่งต่อโรงพยาบาล</div>
            <button class="btn btn-primary btn-sm" onclick="openApptModal(null,'${p.id}','${p.name}')">+ เพิ่มนัด</button>
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
            <div class="card-title" style="font-size:13px;">🧳 ทรัพย์สินของมีค่า</div>
            <button class="btn btn-primary btn-sm" onclick="openBelongingModal(null,'${p.id}','${p.name}')">+ บันทึกสิ่งของ</button>
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
            <div style="font-weight:600;font-size:14px;">🤸 บันทึกกายภาพบำบัด</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="physio-month-filter" class="form-control" style="width:160px;font-size:13px;" onchange="renderPhysioTab('${p.id}')">
              </select>
              <button class="btn btn-ghost btn-sm" onclick="exportPhysioExcel()" title="ส่งออก Excel">📥 Excel</button>
              <button class="btn btn-primary btn-sm" onclick="openPhysioSessionModal('${p.id}','${p.name}')">+ บันทึก Session</button>
            </div>
          </div>
          <div id="physio-summary-${p.id}" style="background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
          <div id="physio-list-${p.id}"></div>
        </div>
      </div>

      <div id="patprofile-tab-dispense" style="display:none;">
          <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <div class="card-title" style="font-size:13px;">💊 ประวัติการเบิกสินค้า</div>
            <button class="btn btn-primary btn-sm" onclick="openQuickDispenseModal()">⚡ เบิกด่วน</button>
          </div>
          <div id="pat-dispense-list-${p.id}"></div>
        </div>
        <div class="card" style="margin-top:12px;">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;color:var(--orange);">🧾 รายการที่ยังไม่ออกบิล</div>
          </div>
          <div id="pat-unbilled-list-${p.id}"></div>
        </div>
      </div>

      <div id="patprofile-tab-statuslog" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">📅 ประวัติการเปลี่ยนสถานะ</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;"
                onclick="quickChangeStatus('${p.id}','${p.name}','active')">🏠 พักอยู่</button>
              <button class="btn btn-sm" style="background:#1565C0;color:#fff;font-size:11px;"
                onclick="quickChangeStatus('${p.id}','${p.name}','hospital')">🏥 อยู่โรงพยาบาล</button>
              <button class="btn btn-sm" style="background:#888;color:#fff;font-size:11px;"
                onclick="quickChangeStatus('${p.id}','${p.name}','inactive')">🚪 ออกแล้ว</button>
              <button class="btn btn-sm" style="background:#e67e22;color:#fff;font-size:11px;"
                onclick="quickChangeStatus('${p.id}','${p.name}','other')">✏️ อื่นๆ</button>
            </div>
          </div>
          <div id="pat-statuslog-${p.id}">
            <div style="text-align:center;padding:24px;color:var(--text3);">กำลังโหลด...</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  } catch(err) { console.error('openPatientProfile error:', err); toast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
}

function switchPatTab(tab) {
  const tabs = ['history','medical','meds','allergy','contacts','notes','mar','vitals','nursing','appts','belongings','dnr','physio','dispense','statuslog'];
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
  if (tab === 'statuslog') {
    const el = document.querySelector('[id^="pat-statuslog-"]');
    const patId = el?.id?.replace('pat-statuslog-','');
    if (patId) loadPatStatusLog(patId);
  }
}

async function loadPatDispense(patId) {
  const listEl     = document.getElementById('pat-dispense-list-' + patId);
  const unbilledEl = document.getElementById('pat-unbilled-list-' + patId);
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">กำลังโหลด...</div>';

  const reqs = (db.requisitions || [])
    .filter(r => String(r.patientId) === String(patId))
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));

  if (reqs.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ยังไม่มีประวัติการเบิก</div>';
  } else {
    const statusBadge = s => s === 'approved'
      ? '<span class="badge badge-green">อนุมัติ</span>'
      : s === 'rejected'
        ? '<span class="badge badge-red">ไม่อนุมัติ</span>'
        : '<span class="badge badge-orange">รออนุมัติ</span>';
    listEl.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
      '<th>วันที่</th><th>สินค้า</th><th style="text-align:right;">จำนวน</th>' +
      '<th>หน่วย</th><th>สถานะ</th><th>ผู้เบิก</th>' +
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

  // รายการ billable ที่ยังไม่มี invoice (unbilled)
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
      unbilledEl.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:13px;">ไม่มีรายการค้างเบิลล์</div>';
    } else {
      const grand = items.reduce((s, i) => s + i.total, 0);
      unbilledEl.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th>วันที่</th><th>สินค้า</th><th style="text-align:right;">จำนวน</th>' +
        '<th style="text-align:right;">ราคา/หน่วย</th><th style="text-align:right;">รวม</th>' +
        '</tr></thead><tbody>' +
        items.map(i =>
          '<tr><td style="font-size:12px;">' + (i.date||'-') + '</td>' +
          '<td>' + i.name + '</td>' +
          '<td style="text-align:right;">' + i.qty + ' ' + i.unit + '</td>' +
          '<td style="text-align:right;">' + i.price.toLocaleString() + '</td>' +
          '<td style="text-align:right;font-weight:600;">' + i.total.toLocaleString() + '</td></tr>'
        ).join('') +
        '<tr style="background:var(--surface2);font-weight:600;">' +
        '<td colspan="4" style="text-align:right;">รวมค้างเบิลล์</td>' +
        '<td style="text-align:right;">฿' + grand.toLocaleString() + '</td></tr>' +
        '</tbody></table></div>' +
        '<div style="padding:10px 0;text-align:right;">' +
          '<button class="btn btn-primary btn-sm" onclick="openBillingFromPatient(\''+patId+'\')">' +
          '🧾 สร้าง Invoice จากรายการเบิก</button>' +
        '</div>';
    }
  }
}

// ── Auto-billing shortcut จาก patient profile ────────────────
function openBillingFromPatient(patId) {
  if (typeof showPage !== 'function' || typeof openCreateInvoiceModal !== 'function') {
    toast('กรุณาเปิดหน้า Billing ก่อน', 'warning'); return;
  }
  showPage('billing');
  // delay ให้ billing load ก่อน
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
// ─────────────────────────────────────────────────────
// ── PATIENT STATUS LOG TAB ────────────────────────────
// ─────────────────────────────────────────────────────
async function loadPatStatusLog(patId) {
  const container = document.getElementById('pat-statuslog-' + patId);
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);">⏳ กำลังโหลด...</div>';

  const { data, error } = await supa
    .from('patient_status_logs')
    .select('*')
    .eq('patient_id', patId)
    .order('status_date', { ascending: false })
    .order('changed_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="padding:16px;color:#e74c3c;">เกิดข้อผิดพลาด: ${error.message}</div>`;
    return;
  }

  const logs = data || [];
  const STATUS_LABEL = { active: '🏠 พักอยู่', hospital: '🏥 อยู่โรงพยาบาล', inactive: '🚪 ออกแล้ว' };
  const STATUS_COLOR = { active: '#27ae60', hospital: '#1565C0', inactive: '#888' };
  const STATUS_BG    = { active: '#e8f5ee', hospital: '#EBF5FB', inactive: '#f5f5f5' };

  // สรุปรายเดือน — นับวันอยู่โรงพยาบาล
  const hospitalLogs = logs.filter(l => l.new_status === 'hospital' || l.old_status === 'hospital');
  const totalHospDays = logs.reduce((s, l) => s + (l.days_away || 0), 0);
  const hospCount = logs.filter(l => l.new_status === 'hospital').length;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text3);">
        <div style="font-size:32px;margin-bottom:8px;">📋</div>
        <div>ยังไม่มีประวัติการเปลี่ยนสถานะ</div>
        <div style="font-size:12px;margin-top:4px;">เมื่อมีการเปลี่ยนสถานะ (พักอยู่ / อยู่โรงพยาบาล / ออกแล้ว) ระบบจะบันทึกไว้ที่นี่</div>
      </div>`;
    return;
  }

  // Summary strip
  const summaryHtml = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;padding:14px 16px;background:var(--surface2);border-bottom:0.5px solid var(--border);">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 14px;text-align:center;min-width:80px;">
        <div style="font-size:20px;font-weight:700;color:var(--accent);">${logs.length}</div>
        <div style="font-size:11px;color:var(--text2);">ครั้งที่เปลี่ยน</div>
      </div>
      <div style="background:#EBF5FB;border:1px solid #b3d7f0;border-radius:8px;padding:8px 14px;text-align:center;min-width:80px;">
        <div style="font-size:20px;font-weight:700;color:#1565C0;">${hospCount}</div>
        <div style="font-size:11px;color:#1565C0;">ครั้งที่ไป รพ.</div>
      </div>
      ${totalHospDays > 0 ? `
      <div style="background:#EBF5FB;border:1px solid #b3d7f0;border-radius:8px;padding:8px 14px;text-align:center;min-width:80px;">
        <div style="font-size:20px;font-weight:700;color:#1565C0;">${totalHospDays}</div>
        <div style="font-size:11px;color:#1565C0;">วันรวมที่อยู่ รพ.</div>
      </div>` : ''}
    </div>`;

  // Log rows
  const rows = logs.map(l => {
    const daysText = l.days_away != null
      ? `<span style="background:#EBF5FB;color:#1565C0;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:600;">🏥 ${l.days_away} วัน</span>`
      : (l.new_status === 'hospital' && !l.return_date
          ? `<span style="background:#fef3e0;color:#d4760a;border-radius:10px;padding:1px 8px;font-size:11px;">ยังไม่กลับ</span>`
          : '');

    const returnText = l.return_date
      ? `<div style="font-size:11px;color:var(--text2);margin-top:2px;">📅 กลับมา: ${l.return_date}</div>`
      : '';

    return `<tr>
      <td style="font-size:12px;white-space:nowrap;">${l.status_date || l.changed_at?.split('T')[0] || '-'}</td>
      <td>
        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${STATUS_BG[l.old_status]||'#f0f0f0'};color:${STATUS_COLOR[l.old_status]||'#888'};">${STATUS_LABEL[l.old_status]||l.old_status||'-'}</span>
      </td>
      <td style="color:var(--text3);text-align:center;">→</td>
      <td>
        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${STATUS_BG[l.new_status]||'#f0f0f0'};color:${STATUS_COLOR[l.new_status]||'#888'};font-weight:600;">${STATUS_LABEL[l.new_status]||l.new_status||'-'}</span>
      </td>
      <td>${daysText}${returnText}</td>
      <td style="font-size:12px;color:var(--text2);">${l.note||'-'}</td>
      <td style="font-size:12px;color:var(--text3);">${l.changed_by||'-'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editPatStatusLog('${l.id}','${patId}')"
          title="แก้ไขรายการนี้" style="font-size:12px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deletePatStatusLog('${l.id}','${patId}')"
          title="ลบรายการนี้" style="color:#e74c3c;font-size:12px;">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    ${summaryHtml}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>จาก</th>
            <th></th>
            <th>เป็น</th>
            <th>จำนวนวัน</th>
            <th>หมายเหตุ</th>
            <th>บันทึกโดย</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─────────────────────────────────────────────────────
// ── QUICK STATUS CHANGE (จาก tab ประวัติสถานะ) ────────
// ─────────────────────────────────────────────────────
function quickChangeStatus(patientId, patientName, newStatus) {
  const pat = db.patients.find(p => p.id == patientId);
  if (!pat) { toast('ไม่พบข้อมูลผู้รับบริการ', 'error'); return; }

  const oldStatus = pat.status || 'active';
  if (oldStatus === newStatus && newStatus !== 'other') {
    toast(`${patientName} อยู่ในสถานะนี้อยู่แล้ว`, 'warning'); return;
  }

  if (newStatus === 'other') {
    _quickStatusOtherModal(patientId, patientName, oldStatus);
    return;
  }

  // เปิด modal เลือกวัน — RPC จะ update + log พร้อมกัน
  openPatientStatusLogModal(patientId, oldStatus, newStatus);
}

function _quickStatusOtherModal(patientId, patientName, oldStatus) {
  const customStatus = prompt(`ระบุสถานะของ ${patientName}\nเช่น: ลาพักผ่อน / พักที่บ้านญาติ / ย้ายสถานดูแล`);
  if (!customStatus || !customStatus.trim()) return;
  openPatientStatusLogModal(patientId, oldStatus, customStatus.trim());
}

async function deletePatStatusLog(logId, patId) {
  if (!confirm('ลบรายการนี้ออกจากประวัติ?')) return;
  const { error } = await supa.from('patient_status_logs').delete().eq('id', logId);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  toast('ลบรายการเรียบร้อย', 'success');
  loadPatStatusLog(patId);
}

async function editPatStatusLog(logId, patId) {
  // โหลดข้อมูล log นั้นจาก Supabase
  const { data, error } = await supa
    .from('patient_status_logs')
    .select('*')
    .eq('id', logId)
    .single();
  if (error || !data) { toast('ไม่พบข้อมูล log', 'error'); return; }

  // เปิด modal ในโหมดแก้ไข
  openPatientStatusLogModal(patId, data.old_status, data.new_status, {
    id:          data.id,
    status_date: data.status_date,
    return_date: data.return_date || '',
    note:        data.note || '',
  });
}
