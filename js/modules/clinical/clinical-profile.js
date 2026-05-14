// ===== CLINICAL PROFILE =====

async function openPatientProfile(id, activeTab) {
  try {
  const p = db.patients.find(x => x.id == id);
  if (!p) { toast('ไม่พบข้อมูลผู้รับบริการ','error'); return; }
  document.getElementById('patprofile-breadcrumb').textContent = p.name;
  // Query all reqs for this patient directly (no time limit — full history per patient)
  // Phase 0: ใช้ requisition_headers + requisition_lines (ใหม่)
  const { data: reqData } = await supa.from(_REQ_TABLE).select(_REQ_SELECT).eq('patient_id', String(p.id)).order('id', {ascending:false});
  const reqs = (reqData||[]).map(mapReq);
  const age  = p.dob ? calcAge(p.dob) : '-';
  const dur  = p.admitDate ? calcDuration(p.admitDate, p.endDate) : '-';
  const isActive = p.status === 'active';
  const idcard = p.idcard || p.idCard || '-';
  // Phase 0: นับ "ใบเบิก" + "รายการ" + "หน่วยรวม" จาก lines (รองรับใบเบิกหลายรายการ)
  const totalReqs  = reqs.length;  // จำนวนใบเบิก (header)
  const totalLines = reqs.reduce((s,r) => s + ((r.lines||[]).length || (r.itemId ? 1 : 0)), 0);  // จำนวนรายการรวม
  const totalQty   = reqs.reduce((s,r) => 
    s + ((r.lines||[]).reduce((ls,l) => ls + (l.qty||0), 0) || (r.qty||0)), 0);
  // Load clinical data lazily
  showPage('patprofile');
  await loadPatientClinical(id);
  const pid = String(id);

  document.getElementById('patprofile-content').innerHTML = `
  <!-- [R4 P1 14พค69] Breadcrumb -->
  <div class="patprofile-breadcrumb" style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;color:var(--text2);">
    <button onclick="showPage('patients')" style="background:transparent;border:none;color:var(--brand);font-size:13px;font-weight:500;cursor:pointer;padding:4px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">← กลับ</button>
    <span style="opacity:0.5;">ผู้รับบริการ</span>
    <span style="opacity:0.5;">/</span>
    <span style="font-weight:600;color:var(--text);">${p.name}</span>
  </div>

  <!-- [R4 P1 14พค69] Horizontal Header Card -->
  <div class="patprofile-header-card" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:14px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
    <!-- Avatar -->
    <div class="patprofile-header-avatar" style="flex-shrink:0;">
      ${(p.photo||"") ? `<img src="${p.photo}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:2px solid var(--sage-200,#dbe5dc);">` : `<div style="width:88px;height:88px;border-radius:50%;background:var(--sage-100,#eaf1eb);color:var(--brand,#2e6b4f);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;letter-spacing:-1px;border:2px solid var(--sage-200,#dbe5dc);">${(p.name||'?').trim().split(/\s+/).slice(0,2).map(s=>s.charAt(0)).join('')}</div>`}
    </div>

    <!-- Name + status + info grid -->
    <div class="patprofile-header-info" style="flex:1;min-width:240px;">
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
        <h2 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin:0;">${p.name}</h2>
        <span class="badge ${isActive ? 'badge-green' : p.status==='hospital' ? 'badge-blue' : 'badge-gray'}" style="font-size:12px;padding:3px 12px;border-radius:999px;font-weight:600;">${isActive ? '🏠 พักอยู่' : p.status==='hospital' ? '🏥 อยู่ รพ.' : '🚪 ออกแล้ว'}</span>
        ${(() => { const bed = getPatientBed(p); const room = getPatientRoom(p); if (!bed) return ''; return `<span style="font-size:13px;color:var(--text2);">${room?.name||''}${bed.bedCode?' · เตียง '+bed.bedCode:''}</span>`; })()}
        <span style="font-size:13px;color:var(--text2);font-family:var(--mono,monospace);">HN ${p.hn||p.id||'-'}</span>
      </div>
      <div class="patprofile-header-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px 24px;font-size:13px;color:var(--text2);">
        ${p.gender ? `<div><span style="opacity:0.75;">เพศ </span><strong style="color:var(--text);">${p.gender}</strong></div>` : ''}
        ${p.dob ? `<div><span style="opacity:0.75;">อายุ </span><strong style="color:var(--text);">${age} ปี</strong></div>` : ''}
        ${idcard !== '-' ? `<div><span style="opacity:0.75;">เลขบัตร </span><strong style="color:var(--text);font-family:var(--mono,monospace);font-size:12px;">${idcard}</strong></div>` : ''}
        ${p.admitDate ? `<div><span style="opacity:0.75;">เข้าเมื่อ </span><strong style="color:var(--text);">${p.admitDate}</strong></div>` : ''}
        ${p.endDate ? `<div><span style="opacity:0.75;">สัญญา </span><strong style="color:var(--text);">${p.endDate}</strong></div>` : ''}
        ${dur !== '-' ? `<div><span style="opacity:0.75;">ระยะเวลา </span><strong style="color:var(--text);">${dur}</strong></div>` : ''}
      </div>
    </div>

    <!-- Action buttons -->
    <div class="patprofile-header-actions" style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
      <button class="btn btn-ghost btn-sm" onclick="openHealthReportModal('${p.id}')" style="white-space:nowrap;">🖨️ พิมพ์</button>
      <button class="btn btn-ghost btn-sm" onclick="openPatientContractsModal('${p.id}','${(p.name||'').replace(/'/g, "\\'")}')" style="white-space:nowrap;">📋 แพ็กเกจ</button>
      <button class="btn btn-primary btn-sm" onclick="editPatient('${p.id}')" style="white-space:nowrap;">✏️ แก้ไข</button>
    </div>
  </div>

  <!-- [R4 P1 14พค69] Allergy banner ใต้ header (ถ้ามี) -->
  ${renderAllergyBanner(p)}

  <!-- Mobile-only compact header (ซ่อนบน desktop) -->
  <div class="patprofile-mobile-header" id="patprofile-mobile-header" style="display:none;">
    ${(p.photo||"") ? `<img src="${p.photo}" class="pmh-photo">` : `<div class="pmh-photo-placeholder">👤</div>`}
    <div class="pmh-info">
      <div class="pmh-name">${p.name}</div>
      <div class="pmh-meta">
        ${p.dob ? calcAge(p.dob) + ' · ' : ''}${(() => { const bed = getPatientBed(p); const room = getPatientRoom(p); return room?.name ? 'ห้อง ' + room.name : ''; })()}
        <span class="badge ${isActive ? 'badge-green' : p.status==='hospital' ? 'badge-blue' : 'badge-gray'}" style="font-size:10px;padding:1px 8px;margin-left:4px;">${isActive ? 'พักอยู่' : p.status==='hospital' ? '🏥 อยู่ รพ.' : 'ออกแล้ว'}</span>
      </div>
    </div>
    <button class="btn btn-ghost btn-sm pmh-info-btn" onclick="_openPatientInfoModal('${p.id}')">ℹ️ ข้อมูล</button>
  </div>

  <div class="patprofile-grid" style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">
    <!-- LEFT: Profile card -->
    <div class="patprofile-left-col">
      <div class="card" style="text-align:center;padding:28px 20px;">
        ${(p.photo||"") ? `<img src="${p.photo}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--sage);margin:0 auto 12px;">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--sage-light);border:3px solid var(--sage);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:40px;">👤</div>`}
        <div style="font-size:17px;font-weight:700;margin-bottom:4px;">${p.name}</div>
        <span class="badge ${isActive ? 'badge-green' : 'badge-gray'}" style="font-size:13px;padding:4px 14px;">${isActive ? '🏠 พักอยู่' : '🚪 ออกแล้ว'}</span>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalReqs}</div>
            <div style="font-size:11px;color:var(--text2);">ครั้งที่เบิก${totalLines!==totalReqs?` (${totalLines} รายการ)`:''}</div>
          </div>
          <div style="background:var(--sage-light);border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalQty}</div>
            <div style="font-size:11px;color:var(--text2);">หน่วยรวม</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;${canSeePrice() ? '' : 'justify-content:center;'}">
          ${canSeePrice() ? `<button class="btn btn-outline-primary" style="flex:1;font-size:13px;" onclick="document.querySelectorAll('.patient-info-modal-overlay').forEach(m=>m.remove()); openContractFilesModal('${p.id}','${p.name}')">📄 สัญญา</button>` : ''}
          <button class="btn btn-outline-primary" style="${canSeePrice() ? 'flex:1;' : 'min-width:60%;'}font-size:13px;" onclick="document.querySelectorAll('.patient-info-modal-overlay').forEach(m=>m.remove()); openPatientContractsModal('${p.id}','${p.name}')">📋 แพ็กเกจ</button>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-primary" style="width:100%;" onclick="document.querySelectorAll('.patient-info-modal-overlay').forEach(m=>m.remove()); editPatient('${p.id}')">✏️ แก้ไขข้อมูล</button>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-ghost" style="width:100%;font-size:13px;" onclick="document.querySelectorAll('.patient-info-modal-overlay').forEach(m=>m.remove()); openHealthReportModal('${p.id}')">📋 รายงานสุขภาพ</button>
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
          ${canSeePrice() ? `<div><span style="color:var(--text3);min-width:80px;display:inline-block;">ค่าห้อง</span><strong style="color:var(--accent);">${room?.monthlyRate ? room.monthlyRate.toLocaleString('th-TH')+' ฿/เดือน' : '-'}</strong></div>` : ''}
        </div>
      </div>`; })()}
    </div>
    <!-- RIGHT: Tabs -->
    <div>
      ${renderPatientTabBar(p, totalReqs)}
      <div id="patprofile-tab-history">
        <!-- [R4 P3 14พค69] Patient general info section (ตาม mockup page 14: ข้อมูลทั่วไป → ข้อมูลส่วนตัว) -->
        <div class="card patprofile-info-card" style="margin-bottom:14px;padding:18px 22px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border,#e8e3d4);">
            <span style="font-size:18px;">👤</span>
            <h3 style="font-size:15px;font-weight:700;margin:0;letter-spacing:-0.3px;">ข้อมูลส่วนตัว</h3>
          </div>
          <div class="patprofile-info-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 32px;font-size:13.5px;">
            <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);">
              <span style="color:var(--text2);">ชื่อ-นามสกุล</span>
              <strong style="text-align:right;">${p.name||'-'}</strong>
            </div>
            ${p.nickname ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">ชื่อเล่น</span><strong style="text-align:right;">${p.nickname}</strong></div>` : ''}
            ${p.gender ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">เพศ</span><strong style="text-align:right;">${p.gender}</strong></div>` : ''}
            ${p.dob ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">วันเกิด</span><strong style="text-align:right;">${p.dob}</strong></div>` : ''}
            ${age !== '-' ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">อายุ</span><strong style="text-align:right;">${age} ปี</strong></div>` : ''}
            ${idcard !== '-' ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">เลขบัตรประชาชน</span><strong style="text-align:right;font-family:var(--mono,monospace);">${idcard}</strong></div>` : ''}
            ${p.bloodType ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">หมู่เลือด</span><strong style="text-align:right;color:#c0392b;">${p.bloodType}</strong></div>` : ''}
            ${p.insurance ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">สิทธิ์การรักษา</span><strong style="text-align:right;">${p.insurance}</strong></div>` : ''}
            ${p.phone ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">โทรศัพท์</span><strong style="text-align:right;font-family:var(--mono,monospace);">${p.phone}</strong></div>` : ''}
            ${p.admitDate ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">วันแรกรับ</span><strong style="text-align:right;">${p.admitDate}</strong></div>` : ''}
            ${p.endDate ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">วันสิ้นสัญญา</span><strong style="text-align:right;">${p.endDate}</strong></div>` : ''}
            ${dur !== '-' ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--border,#e8e3d4);"><span style="color:var(--text2);">ระยะเวลาพัก</span><strong style="text-align:right;color:var(--brand,#2e6b4f);">${dur}</strong></div>` : ''}
            ${p.address ? `<div style="grid-column:1/-1;padding:8px 0;border-top:1px solid var(--border,#e8e3d4);margin-top:4px;"><div style="color:var(--text2);font-size:12px;margin-bottom:4px;">ที่อยู่</div><strong>${p.address}</strong></div>` : ''}
          </div>
        </div>

        <!-- ประวัติเบิก (ตารางเดิม) -->
        <div class="card">
          <div class="card-header" style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e8e3d4);">
            <span style="font-size:16px;">📦</span>
            <h3 style="font-size:14px;font-weight:700;margin:0;letter-spacing:-0.2px;">ประวัติการเบิก</h3>
            <span style="font-size:12px;color:var(--text2);margin-left:auto;">${totalReqs} ครั้ง · ${totalLines} รายการ · ${totalQty} หน่วย</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>วันที่</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ผู้เบิก</th><th></th></tr></thead>
              <tbody>
                ${reqs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">ยังไม่มีประวัติการเบิก</td></tr>' :
                  reqs.flatMap(r => {
                    // Phase 0: flatten lines เป็น 1 row ต่อ line (รองรับใบเบิกหลายรายการ)
                    const lines = (r.lines && r.lines.length > 0) ? r.lines : [{ itemName: r.itemName, qty: r.qty, unit: r.unit }];
                    return lines.map((l, i) => `<tr>
                      <td class="number" style="font-size:12px;white-space:nowrap;">${i===0 ? (r.date||'-') : ''}</td>
                      <td style="font-weight:500;">${l.itemName||'-'}</td>
                      <td class="number">${l.qty||0}</td>
                      <td>${l.unit||''}</td>
                      <td style="font-size:12px;">${i===0 ? (r.staffName||'-') : ''}</td>
                      <td>${i===0 ? `<button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">🖨️</button>` : ''}</td>
                    </tr>`);
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="patprofile-tab-medical" style="display:none;" data-patid="${p.id}">
        <!-- [R4 P3] Section header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:8px 4px;">
          <span style="font-size:20px;">🩺</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;letter-spacing:-0.3px;">ข้อมูลทางการแพทย์</h3>
          <span style="font-size:12px;color:var(--text2);margin-left:auto;">โรคประจำตัว · ประวัติการรักษา</span>
        </div>
        ${renderMedLogTab(p.id, 'medical')}

        <div id="med-files-section-${p.id}" style="margin-top:12px;"></div>
      </div>
      <div id="patprofile-tab-meds" style="display:none;">
        <!-- [R4 P4] Section header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:8px 4px;">
          <span style="font-size:20px;">💊</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;letter-spacing:-0.3px;">ยาประจำตัว</h3>
          <span style="font-size:12px;color:var(--text2);margin-left:auto;">รายการยาที่ทานเป็นประจำ + ขนาด + วิธีใช้</span>
        </div>
        ${renderMedLogTab(p.id, 'meds')}
      </div>
      <!-- ALLERGY TAB -->
      <div id="patprofile-tab-allergy" style="display:none;" data-patid="${p.id}">
        <!-- [R4 P4] Section header + summary banner -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:8px 4px;">
          <span style="font-size:20px;">⚠️</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;letter-spacing:-0.3px;">แพ้ยา / แพ้อาหาร</h3>
          <span style="font-size:12px;color:var(--text2);margin-left:auto;">${p.allergies?.length || 0} รายการ · ระวังก่อนจ่ายยาทุกครั้ง</span>
        </div>
        <div class="card">
          <div class="card-header" style="background:linear-gradient(to right, #fdf0ee, transparent);">
            <div class="card-title" style="font-size:14px;color:#7a1f12;display:flex;align-items:center;gap:8px;"><span>🚨</span> ประวัติการแพ้</div>
            <button class="btn btn-primary btn-sm" onclick="openAddAllergyModal('${p.id}')">+ เพิ่ม</button>
          </div>
          ${(()=>{ var _d=document.createElement('div'); _d.id='pat-allergy-list-'+p.id; _d.style.padding='16px'; _d.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">⏳ กำลังโหลด...</div>'; return _d.outerHTML; })()}
        </div>
      </div>
      <!-- CONTACTS TAB -->
      <div id="patprofile-tab-contacts" style="display:none;">
        <!-- [R4 P4] Section header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:8px 4px;">
          <span style="font-size:20px;">📞</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;letter-spacing:-0.3px;">ผู้ติดต่อ</h3>
          <span style="font-size:12px;color:var(--text2);margin-left:auto;">${p.contacts?.length || 0} คน · ครอบครัว · ผู้รับผิดชอบ · ผู้ตัดสินใจ</span>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:14px;">รายชื่อผู้ติดต่อ</div>
            <button class="btn btn-primary btn-sm" onclick="openAddContactModal('${p.id}')">+ เพิ่มผู้ติดต่อ</button>
          </div>
          ${p.contacts?.length === 0 ? `<div style="padding:36px 24px;text-align:center;">
              <div style="font-size:40px;opacity:0.3;margin-bottom:8px;">📞</div>
              <div style="color:var(--text3);font-size:13px;">ยังไม่มีข้อมูลผู้ติดต่อ</div>
              <button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="openAddContactModal('${p.id}')">+ เพิ่มคนแรก</button>
            </div>` :
          `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
            ${(p.contacts||[]).map(c => {
              const tone = c.isPayer ? 'payer' : c.isDecisionMaker ? 'decision' : 'emergency';
              const accent = { payer: '#27ae60', decision: '#5e60ce', emergency: '#7a8a9a' }[tone];
              const tint = { payer: '#f0faf5', decision: '#f1f1fb', emergency: '#f7f8fa' }[tone];
              return `
              <div class="patprofile-contact-card" style="border:1px solid var(--border,#e8e3d4);border-left:3px solid ${accent};border-radius:10px;padding:14px 18px;background:${tint};transition:all 0.15s;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
                      <div style="font-weight:700;font-size:15px;letter-spacing:-0.2px;">${c.name}</div>
                      <span style="font-size:12px;color:var(--text2);">(${c.relation||'-'})</span>
                    </div>
                    <div style="font-size:13px;color:var(--text2);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;">
                      ${c.phone ? `<span>📞 <span style="font-family:var(--mono,monospace);color:var(--text);">${c.phone}</span></span>` : ''}
                      ${c.email ? `<span>✉️ <span style="color:var(--text);">${c.email}</span></span>` : ''}
                    </div>
                    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                      ${c.isPayer ? '<span style="background:#dcf0e2;color:#1f5132;border-radius:999px;font-size:11px;padding:2px 10px;font-weight:600;">💰 รับผิดชอบค่าใช้จ่าย</span>' : ''}
                      ${c.isDecisionMaker ? '<span style="background:#e8e8f8;color:#3d3d9e;border-radius:999px;font-size:11px;padding:2px 10px;font-weight:600;">🧠 ผู้ตัดสินใจ</span>' : ''}
                      ${!c.isPayer && !c.isDecisionMaker ? '<span style="background:#eef0f3;color:#56657a;border-radius:999px;font-size:11px;padding:2px 10px;font-weight:600;">📞 ผู้ติดต่อฉุกเฉิน</span>' : ''}
                    </div>
                    ${c.note ? `<div style="font-size:12px;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border,#e8e3d4);">📝 ${c.note}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0;">
                    <button class="btn btn-ghost btn-sm" onclick="openEditContactModal('${p.id}','${c.id}')" title="แก้ไข">✏️</button>
                    <button class="btn btn-ghost btn-sm" style="color:#c0392b;" onclick="deleteContact('${p.id}','${c.id}')" title="ลบ">🗑️</button>
                  </div>
                </div>
              </div>`;
            }).join('')}
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
      <div id="patprofile-tab-excretion" style="display:none;" data-patid="${p.id}"></div>
      <!-- LAB RESULTS TAB -->
      <div id="patprofile-tab-lab" style="display:none;">
        <div id="lab-list-${p.id}"></div>
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
            <button class="btn btn-primary btn-sm" onclick="openApptModal(null,'${p.id}')">+ เพิ่มนัด</button>
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
            <button class="btn btn-primary btn-sm" onclick="openBelongingModal(null,'${p.id}')">+ บันทึกสิ่งของ</button>
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
              <button class="btn btn-primary btn-sm" onclick="openPhysioSessionModal('${p.id}')">+ บันทึก Session</button>
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
            <button class="btn btn-primary btn-sm" onclick="openReqPageForPatient('${p.id}','${(p.name||'').replace(/'/g, "\\'")}')">+ เบิกสินค้า</button>
          </div>
          <div id="pat-dispense-list-${p.id}"></div>
        </div>
        ${canSeePrice() ? `
        <div class="card" style="margin-top:12px;">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;color:var(--orange);">🧾 รายการที่ยังไม่ออกบิล</div>
          </div>
          <div id="pat-unbilled-list-${p.id}"></div>
        </div>
        ` : ''}
      </div>
      <!-- DEPOSITS TAB -->
      ${(ROLE_PAGES[currentUser?.role]||[]).includes('deposits') ? `
      <div id="patprofile-tab-deposits" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">💰 มัดจำ & เงินประกัน</div>
            <button class="btn btn-primary btn-sm" onclick="openDepositModalFromProfile(null,'${p.id}')">+ บันทึกมัดจำ</button>
          </div>
          <div id="pat-deposits-list-${p.id}">
            <div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div>
          </div>
      </div>
    </div>
    
    <div id="patprofile-tab-incident" style="display:none" data-patid="${p.id}"><div id="pat-incident-list-${pid}"><div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div></div></div>
<div id="patprofile-tab-dietary" style="display:none" data-patid="${p.id}"><div id="pat-dietary-list-${pid}"><div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div></div></div>
  </div>
      </div>
      ` : ''}
    </div>

  </div>`;
  switchPatTab(activeTab || 'medical');
  // diagnosis edit/save handlers
  (function(){
    var editBtn=document.getElementById('diag-edit-'+pid);
    var saveBtn=document.getElementById('diag-save-'+pid);
    var disp=document.getElementById('diag-disp-'+pid);
    var inp=document.getElementById('diag-inp-'+pid);
    if(!editBtn||!saveBtn||!disp||!inp) return;
    editBtn.addEventListener('click',function(){
      disp.style.display='none'; inp.style.display='';
      editBtn.style.display='none'; saveBtn.style.display='';
      inp.focus();
    });
    saveBtn.addEventListener('click',function(){
      var val=inp.value;
      supa.from('patients').update({diagnosis:val}).eq('id',pid).then(function(res){
        if(res.error){toast('บันทึกไม่สำเร็จ: '+res.error.message,'error');return;}
        disp.textContent=val||'-';
        disp.style.display=''; inp.style.display='none';
        editBtn.style.display=''; saveBtn.style.display='none';
        var pat=(db.patients||[]).find(function(x){return x.id===pid;});
        if(pat) pat.diagnosis=val;
        toast('บันทึกโรคประจำตัวแล้ว','success');
        logAudit(AUDIT_MODULES.PATIENT,'update',pid,{field:'diagnosis',value:val});
      });
    });
  })();
  if(typeof window._injectStatusBtn==='function'){
    setTimeout(function(){window._injectStatusBtn(String(id));},200);
  }
  } catch(err) { console.error('openPatientProfile error:', err); toast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
}


function _renderPatAllergyTab(pid, listEl) {
  listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3)">⏳ กำลังโหลด...</div>';
  supa.from('patient_allergies').select('*').eq('patient_id', pid).order('created_at', {ascending: false})
    .then(function(res) {
      var rows = res.data || [];
      if (!rows.length) {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3)">✅ ไม่มีประวัติการแพ้ที่บันทึกไว้</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>สิ่งที่แพ้</th>' +
        '<th>ประเภท</th>' +
        '<th>อาการ</th>' +
        '<th>ความรุนแรง</th>' +
        '<th>หมายเหตุ</th>' +
        '<th>จัดการ</th>' +
        '</tr></thead><tbody>';
      rows.forEach(function(r) {
        var eid = r.id;
        var row = '<tr>' +
          '<td><b>' + (r.allergen || '') + '</b></td>' +
          '<td>' + (r.allergy_type || '') + '</td>' +
          '<td>' + (r.reaction || '') + '</td>' +
          '<td>' + (r.severity || '') + '</td>' +
          '<td>' + (r.note || '') + '</td>' +
          '<td style="white-space:nowrap">';
        row += '<button class="btn btn-ghost btn-sm" onclick="openEditAllergyModal(&quot;' + pid + '&quot;,' + eid + ')">✏️</button>';
        row += '<button class="btn btn-ghost btn-sm" onclick="deleteAllergy(&quot;' + pid + '&quot;,' + eid + ')">🗑️</button>';
        row += '</td></tr>';
        html += row;
      });
      html += '</tbody></table>';
      listEl.innerHTML = html;
    });
}

function _renderPatIncidentTab(pid, listEl) {
  if (!document.getElementById('pat-incident-btns-'+pid)) {
    var wrap=document.createElement('div');
    wrap.id='pat-incident-btns-'+pid;
    wrap.style.cssText='display:flex;gap:8px;margin-bottom:12px;';
    var b1=document.createElement('button');
    b1.className='btn btn-primary btn-sm';
    b1.innerHTML='⚠️ + อุบัติเหตุ';
    b1.onclick=function(){openIncidentModal(pid);};
    var b2=document.createElement('button');
    b2.className='btn btn-secondary btn-sm';
    b2.innerHTML='🩹 + แผลกดทับ';
    b2.onclick=function(){setTimeout(function(){openWoundModal(pid);},150);};
    wrap.appendChild(b1);wrap.appendChild(b2);
    listEl.parentNode.insertBefore(wrap,listEl);
  }
  listEl.innerHTML = '<div style="padding:20px;text-align:center">⏳ โหลด...</div>';
  Promise.all([
    supa.from('incident_reports').select('*').eq('patient_id',pid).order('date',{ascending:false}),
    supa.from('patient_wounds').select('*').eq('patient_id',pid).order('wound_date',{ascending:false})
  ]).then(function(rs){
    var iD=rs[0].data||[], wD=rs[1].data||[];
    if(!iD.length&&!wD.length){
      listEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</div>';
      return;
    }
    var frag = document.createDocumentFragment();
    iD.forEach(function(x){
      var d=document.createElement('div');
      d.className='card';
      d.style.cssText='margin-bottom:8px;padding:12px;display:flex;justify-content:space-between;align-items:flex-start;';
      var info=document.createElement('div');
      var incTime = x.date ? (x.time ? x.date+' '+x.time : x.date) : '-';
      var sevBadge = {'mild':'<span style="background:#27ae6022;color:#27ae60;border-radius:4px;padding:1px 8px;font-size:11px;">เล็กน้อย</span>','moderate':'<span style="background:#e67e2222;color:#d35400;border-radius:4px;padding:1px 8px;font-size:11px;">ปานกลาง</span>','severe':'<span style="background:#e74c3c22;color:#c0392b;border-radius:4px;padding:1px 8px;font-size:11px;">รุนแรง</span>'}[x.severity]||(x.severity?'<span style="background:var(--surface2);border-radius:4px;padding:1px 8px;font-size:11px;">'+x.severity+'</span>':'');
      var incPhoto=x.photo_url?'<div style="margin-top:8px;"><img src="'+x.photo_url+'" style="max-width:180px;max-height:140px;border-radius:6px;object-fit:cover;border:1px solid var(--border);" loading="lazy"></div>':'';
      info.innerHTML=
        '<div style="font-weight:600;font-size:13px;">⚠️ '+(x.type||'-')+' '+sevBadge+'</div>'
        +'<div style="font-size:12px;color:var(--text3);margin-top:3px;">📅 '+incTime+(x.patient_name?' &nbsp;|&nbsp; 👤 '+x.patient_name:'')+'</div>'
        +(x.location?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">📍 สถานที่: '+x.location+'</div>':'')
        +(x.detail?'<div style="font-size:13px;margin-top:4px;">'+x.detail+'</div>':'')
        +(x.first_aid?'<div style="font-size:12px;color:var(--text2);margin-top:3px;">🩹 การปฐมพยาบาล: '+x.first_aid+'</div>':'')
        +(x.notified?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">📞 แจ้ง: '+x.notified+'</div>':'')
        +'<div style="font-size:11px;color:var(--text3);margin-top:3px;">✍️ ผู้บันทึก: '+(x.recorder||'-')+'</div>'
        +incPhoto;
      var btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openIncidentModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',async function(){
        if(!(await customConfirm('ลบรายการนี้?'))) return;
        supa.from('incident_reports').delete().eq('id',x.id).then(function(){
          switchPatTab('incident'); toast('ลบแล้ว','success');
        });
      });
      btns.appendChild(eb); btns.appendChild(db2);
      d.appendChild(info); d.appendChild(btns); frag.appendChild(d);
    });
    wD.forEach(function(x){
      var d=document.createElement('div');
      d.className='card';
      d.style.cssText='margin-bottom:8px;padding:12px;border-left:3px solid #e67e22;display:flex;justify-content:space-between;align-items:flex-start;';
      var info=document.createElement('div');
      var stageBadge=x.stage?'<span style="background:#e67e2222;color:#d35400;border-radius:4px;padding:1px 8px;font-size:11px;">Stage '+x.stage+'</span>':'';
      var wndStatus={'active':'<span style="background:#e74c3c22;color:#c0392b;border-radius:4px;padding:1px 8px;font-size:11px;">กำลังรักษา</span>','healed':'<span style="background:#27ae6022;color:#27ae60;border-radius:4px;padding:1px 8px;font-size:11px;">หายแล้ว</span>','monitoring':'<span style="background:#3498db22;color:#2980b9;border-radius:4px;padding:1px 8px;font-size:11px;">เฝ้าระวัง</span>'}[x.status]||(x.status?'<span style="background:var(--surface2);border-radius:4px;padding:1px 8px;font-size:11px;">'+x.status+'</span>':'');
      var wndPhoto=x.photo_url?'<div style="margin-top:8px;"><img src="'+x.photo_url+'" style="max-width:180px;max-height:140px;border-radius:6px;object-fit:cover;border:1px solid var(--border);" loading="lazy"></div>':'';
      // Parse size_cm "WxLxD" และ extract treatment/trend จาก note
      var sizeStr = '';
      if (x.size_cm) {
        var parts = String(x.size_cm).split('x');
        if (parts.length >= 3) {
          var w = parseFloat(parts[0])||0, l = parseFloat(parts[1])||0, dp = parseFloat(parts[2])||0;
          if (w || l || dp) sizeStr = 'กว้าง '+w+' × ยาว '+l+' × ลึก '+dp+' cm';
        } else if (x.size_cm) {
          sizeStr = String(x.size_cm) + ' cm';
        }
      }
      // Extract treatment + trend + remaining note
      var treatmentStr = '', trendStr = '', remainingNote = '';
      if (x.note) {
        var noteText = String(x.note);
        var tMatch = noteText.match(/การรักษา:\s*([^]*?)(?=\s*แนวโน้ม:|$)/);
        var trMatch = noteText.match(/แนวโน้ม:\s*([^]*?)(?=\s*$|\s{2,})/);
        if (tMatch) treatmentStr = tMatch[1].trim();
        if (trMatch) trendStr = trMatch[1].trim();
        // remaining คือ note ที่ไม่มี prefix การรักษา/แนวโน้ม
        remainingNote = noteText.replace(/การรักษา:[^]*?(?=\s*แนวโน้ม:|$)/, '').replace(/แนวโน้ม:[^]*?(?=\s*$|\s{2,})/, '').trim();
      }
      info.innerHTML=
        '<div style="font-weight:600;font-size:13px;">🩹 '+(x.location||'-')+' '+stageBadge+' '+wndStatus+'</div>'
        +'<div style="font-size:12px;color:var(--text3);margin-top:3px;">📅 '+(x.wound_date||'-')+(x.patient_name?' &nbsp;|&nbsp; 👤 '+x.patient_name:'')+'</div>'
        +(sizeStr?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">📏 ขนาด: '+sizeStr+'</div>':'')
        +(x.appearance?'<div style="font-size:13px;margin-top:4px;">ลักษณะ: '+x.appearance+'</div>':'')
        +(x.exudate?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">💧 ของเหลว: '+x.exudate+'</div>':'')
        +(treatmentStr?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">🏥 การรักษา: '+treatmentStr+'</div>':(x.dressing?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">🩹 การรักษา: '+x.dressing+'</div>':''))
        +(trendStr?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">📈 แนวโน้ม: '+trendStr+'</div>':'')
        +(remainingNote?'<div style="font-size:12px;color:var(--text3);margin-top:2px;">💬 หมายเหตุ: '+remainingNote+'</div>':'')
        +(x.pain_score!=null&&x.pain_score!==''?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">😣 ความเจ็บปวด: '+x.pain_score+'/10</div>':'')
        +'<div style="font-size:11px;color:var(--text3);margin-top:3px;">✍️ ผู้บันทึก: '+(x.created_by||'-')+'</div>'
        +wndPhoto;
      var btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openWoundModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',async function(){
        if(!(await customConfirm('ลบรายการนี้?'))) return;
        supa.from('patient_wounds').delete().eq('id',x.id).then(function(){
          switchPatTab('incident'); toast('ลบแล้ว','success');
        });
      });
      btns.appendChild(eb); btns.appendChild(db2);
      d.appendChild(info); d.appendChild(btns); frag.appendChild(d);
    });
    listEl.innerHTML=''; listEl.appendChild(frag);
  });
}

function _renderPatDietaryTab(pid, listEl) {
  if (!document.getElementById('pat-dietary-btns-'+pid)) {
    var wrap=document.createElement('div');
    wrap.id='pat-dietary-btns-'+pid;
    wrap.style.cssText='display:flex;gap:8px;margin-bottom:12px;';
    var b1=document.createElement('button');
    b1.className='btn btn-primary btn-sm';
    b1.textContent='🍽️ + กำหนดอาหาร';
    b1.addEventListener('click',function(){if(typeof openDietModal!=='function')return;openDietModal();setTimeout(function(){var s=document.getElementById('diet-patient-id');if(s)s.value=pid;},150);});
    var b2=document.createElement('button');
    b2.className='btn btn-secondary btn-sm';
    b2.textContent='🧪 + สายให้อาหาร';
    b2.addEventListener('click',function(){if(typeof openTubeFeedModal!=='function')return;openTubeFeedModal();setTimeout(function(){var s=document.getElementById('tubefeed-patient-id');if(s)s.value=pid;},150);});
    wrap.appendChild(b1);wrap.appendChild(b2);
    listEl.parentNode.insertBefore(wrap,listEl);
  }
  listEl.innerHTML = '<div style="padding:20px;text-align:center">⏳ โหลด...</div>';
  Promise.all([
    supa.from('patient_diets').select('*').eq('patient_id',pid).order('updated_at',{ascending:false}),
    supa.from('tube_feedings').select('*').eq('patient_id',pid).order('created_at',{ascending:false})
  ]).then(function(rs){
    var dD=rs[0].data||[], tD=rs[1].data||[];
    if(!dD.length&&!tD.length){
      listEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</div>';
      return;
    }
    var frag = document.createDocumentFragment();
    dD.forEach(function(x){
      var d=document.createElement('div'); d.className='card';
      d.style.cssText='margin-bottom:8px;padding:12px;display:flex;justify-content:space-between;align-items:flex-start;';
      var info=document.createElement('div');
      var dietR='';
      try{var rArr=JSON.parse(x.restrictions||'[]');if(rArr.length)dietR='<div style="font-size:12px;color:#c0392b;margin-top:2px;">⚫ ข้อห้าม: '+rArr.join(', ')+'</div>';}catch(e){}
      info.innerHTML=
        '<div style="font-weight:600;font-size:13px;">สูตรอาหาร: '+(x.diet_type||'-')+'</div>'
        +(x.date?'<div style="font-size:12px;color:var(--text3);margin-top:2px;">📅 '+x.date+'</div>':'')
        +'<div style="font-size:12px;color:var(--text2);margin-top:2px;">มื้อ: '+(x.meals||'-')+(x.calories?' | '+x.calories+' kcal':'')+'</div>'
        +dietR
        +(x.note?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">หมายเหตุ: '+x.note+'</div>':'')
        +'<div style="font-size:11px;color:var(--text3);margin-top:3px;">✍️ ผู้บันทึก: '+(x.recorder||'-')+'</div>';
      var btns=document.createElement('div'); btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openDietModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',async function(){
        if(!(await customConfirm('ลบรายการนี้?'))) return;
        supa.from('patient_diets').delete().eq('id',x.id).then(function(){
          switchPatTab('dietary'); toast('ลบแล้ว','success');
        });
      });
      btns.appendChild(eb); btns.appendChild(db2);
      d.appendChild(info); d.appendChild(btns); frag.appendChild(d);
    });
    tD.forEach(function(x){
      var d=document.createElement('div'); d.className='card';
      d.style.cssText='margin-bottom:8px;padding:12px;border-left:3px solid #27ae60;display:flex;justify-content:space-between;align-items:flex-start;';
      var info=document.createElement('div');
      info.innerHTML=
        '<div style="font-weight:600;font-size:13px;">🧪 สายให้อาหาร '+(x.meal?'· '+x.meal:'')+'</div>'
        +'<div style="font-size:12px;color:var(--text3);margin-top:2px;">📅 '+(x.date||'-')+(x.time?' '+x.time:'')+'</div>'
        +(x.formula?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">🥛 สูตร: '+x.formula+'</div>':'')
        +(x.volume?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">💧 ปริมาณ: '+x.volume+' ml</div>':'')
        +(x.water?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">🚰 น้ำตาม: '+x.water+' ml</div>':'')
        +(x.residual!=null&&x.residual!==''?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">📊 Residual: '+x.residual+' ml</div>':'')
        +(x.note?'<div style="font-size:12px;color:var(--text2);margin-top:2px;">หมายเหตุ: '+x.note+'</div>':'')
        +'<div style="font-size:11px;color:var(--text3);margin-top:3px;">✍️ ผู้บันทึก: '+(x.recorder||'-')+'</div>';
      var btns=document.createElement('div'); btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openTubeFeedModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',async function(){
        if(!(await customConfirm('ลบรายการนี้?'))) return;
        supa.from('tube_feedings').delete().eq('id',x.id).then(function(){
          switchPatTab('dietary'); toast('ลบแล้ว','success');
        });
      });
      btns.appendChild(eb); btns.appendChild(db2);
      d.appendChild(info); d.appendChild(btns); frag.appendChild(d);
    });
    listEl.innerHTML=''; listEl.appendChild(frag);
  });
}

function switchPatTab(tab) {
  const tabs = ['history','medical','meds','allergy','contacts','notes','mar','vitals','excretion','lab','nursing','appts','belongings','dnr','physio','dispense','deposits','incident','dietary'];
  tabs.forEach(t => {
    const el = document.getElementById('patprofile-tab-'+t);
    if(el) el.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('#patprofileTabs .tab').forEach(el => {
    const t = el.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]; el.classList.toggle('active', t === tab);
  });
  // mobile: scroll ขึ้นบนหลังเลือก tab (เพราะ grid อยู่บนสุด)
  if (window.innerWidth <= 768) {
    setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  }
    if (tab === 'medical') {
      const _medEl = document.getElementById('patprofile-tab-medical');
      if (_medEl && _medEl.dataset.patid) { _renderMedicalFilesSection(_medEl.dataset.patid); }
    }
    if (tab === 'excretion') { const _exEl = document.getElementById('patprofile-tab-excretion'); if (_exEl && _exEl.dataset.patid) { _renderExcretionTab(_exEl.dataset.patid); return; } const _pEl = document.querySelector('[id^="diag-card-"]'); if (_pEl) { _renderExcretionTab(_pEl.id.replace('diag-card-','')); return; } }
  if (tab === 'physio') {
    const listEl = document.querySelector('[id^="physio-list-"]');
    if (listEl) {
      const pid = listEl.id.replace('physio-list-', '');
      if (pid && typeof renderPhysioTab === 'function') renderPhysioTab(pid);
    }
  }
  if (tab === 'dispense') {
    const el = document.querySelector('[id^="pat-dispense-list-"]');
    const patId = el?.id?.replace('pat-dispense-list-','');
    if (patId) loadPatDispense(patId);
  }
  if (tab === 'allergy') {
    const _aEl=document.getElementById('patprofile-tab-allergy');
    const _ap=_aEl?.dataset?.patid;
    const _ae=_ap?document.getElementById('pat-allergy-list-'+_ap):null;
    if(_ap&&_ae){ _renderPatAllergyTab(_ap,_ae); }
  }
  if (tab === 'deposits') {
    var depEl = document.querySelector('[id^="pat-deposits-list-"]');
    var depPid = depEl ? depEl.id.replace('pat-deposits-list-','') : null;
    if (depPid && typeof loadPatDeposits === 'function') setTimeout(function(){ loadPatDeposits(depPid); }, 100);
  }
  if (tab === 'lab') {
    var labEl = document.querySelector('[id^="lab-list-"]');
    var labPid = labEl ? labEl.id.replace('lab-list-','') : null;
    if (labPid && typeof renderLabTab === 'function') renderLabTab(labPid);
  }
  if (tab === 'incident') {
    const _incEl=document.getElementById('patprofile-tab-incident');
    const _ip=_incEl?.dataset?.patid;
    const _ie=_ip?document.getElementById('pat-incident-list-'+_ip):null;
    if(_ip&&_ie){_renderPatIncidentTab(_ip,_ie);}
  }
  if (tab === 'dietary') {
    const _dietEl=document.getElementById('patprofile-tab-dietary');
    const _dp=_dietEl?.dataset?.patid;
    const _de=_dp?document.getElementById('pat-dietary-list-'+_dp):null;
    // ใช้ window._renderPatDietaryTab เพื่อเรียก patched version จาก fix-features.js
    // (ที่มี tube feed section + date filter)
    if(_dp&&_de){window._renderPatDietaryTab(_dp,_de);}
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
      reqs.slice(0, 50).flatMap(r => {
        // Phase 0: flatten lines เป็น 1 row ต่อ line
        const lines = (r.lines && r.lines.length > 0) ? r.lines : [{ itemName: r.itemName, qty: r.qty, unit: r.unit }];
        return lines.map((l, i) =>
          '<tr><td style="font-size:12px;">' + (i===0 ? (r.date||'-') : '') + '</td>' +
          '<td style="font-weight:500;">' + (l.itemName||'-') + '</td>' +
          '<td style="text-align:right;">' + (l.qty||0) + '</td>' +
          '<td style="font-size:12px;">' + (l.unit||'') + '</td>' +
          '<td>' + (i===0 ? statusBadge(r.status) : '') + '</td>' +
          '<td style="font-size:12px;">' + (i===0 ? (r.staffName||'-') : '') + '</td></tr>'
        );
      }).join('') + '</tbody></table></div>';
  }

  // รายการ billable ที่ยังไม่มี invoice (unbilled)
  if (unbilledEl) {
    const items = reqs
      .filter(r => r.status === 'approved')
      .flatMap(r => {
        // Phase 0: flatten lines เป็น 1 item ต่อ line
        const lines = (r.lines && r.lines.length > 0) ? r.lines : [{ itemId: r.itemId, itemName: r.itemName, qty: r.qty, unit: r.unit }];
        return lines.map(l => {
          const item = db.items.find(i => i.id == l.itemId);
          if (!item || item.isBillable === false) return null;
          const price = item.price || item.cost || 0;
          const qty = l.qty || 0;
          return { name: l.itemName||item.name, qty, unit: l.unit||item.unit||'', price, total: qty * price, date: r.date };
        }).filter(Boolean);
      });

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
      const sel = document.getElementById("ta-inv-id");
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
function loadPatDeposits(patId) {
  if (!(ROLE_PAGES[currentUser?.role]||[]).includes('deposits')) return;
  var listEl = document.getElementById('pat-deposits-list-' + patId);
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);">\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';
  supa.from('patient_deposits').select('*').eq('patient_id', patId)
    .order('date_in', {ascending: false})
    .then(function(res) {
      if (res.error) { listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--danger);">\u274c \u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08</div>'; return; }
      var deps = res.data || [];
      var totalActive = deps.filter(function(d){return d.status==='active';}).reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
      var emptyRow = !deps.length ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">\u2705 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</td></tr>' : '';
      var rows = deps.map(function(d){
        var sl = d.status==='active'?'\u2705 \u0e04\u0e07\u0e2d\u0e22\u0e39\u0e48':'\u274c \u0e04\u0e37\u0e19\u0e41\u0e25\u0e49\u0e27';
        var sc = d.status==='active'?'var(--success)':'var(--text3)';
        var dateOut = d.date_out?' <span style="color:var(--text3);font-size:11px;">(\u0e04\u0e37\u0e19 '+d.date_out+')</span>':'';
        return '<tr>'+
          '<td style="font-size:12px;white-space:nowrap;">'+(d.date_in||'-')+'</td>'+
          '<td style="font-weight:500;">'+(d.type||'-')+'</td>'+
          '<td class="number" style="font-weight:600;">'+(parseFloat(d.amount)||0).toLocaleString('th-TH',{minimumFractionDigits:2})+'</td>'+
          '<td style="font-size:12px;">'+(d.pay_method||'-')+'</td>'+
          '<td><span style="font-size:12px;color:'+sc+';">'+sl+'</span>'+dateOut+'</td>'+
          '<td style="font-size:12px;color:var(--text3);">'+(d.note||'')+'</td>'+
          '<td style="white-space:nowrap;">'+
            '<button class="btn btn-ghost btn-sm" onclick="openDepositModalFromProfile('+d.id+',\u0027'+patId+'\u0027)" title="\u0e41\u0e01\u0e49\u0e44\u0e02">\u270f\ufe0f</button>'+
            '<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="deleteDepositFromProfile('+d.id+',\u0027'+patId+'\u0027)" title="\u0e25\u0e1a">\ud83d\uddd1\ufe0f</button>'+
          '</td>'+
        '</tr>';
      }).join('');
      listEl.innerHTML =
        '<div style="background:var(--surface2);border-radius:8px;margin-bottom:12px;padding:10px 14px;">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
            '<span style="font-size:12px;color:var(--text2);">\u0e22\u0e2d\u0e14\u0e21\u0e31\u0e14\u0e08\u0e33\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d</span>'+
            '<span style="font-size:16px;font-weight:700;color:var(--accent);">'+totalActive.toLocaleString('th-TH',{minimumFractionDigits:2})+' \u0e1a\u0e32\u0e17</span>'+
          '</div>'+
          '<div style="display:flex;gap:6px;">'+
            '<button class="btn btn-primary btn-sm" onclick="openDepositModalFromProfile(null,\u0027'+patId+'\u0027)">+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</button>'+
            '<button class="btn btn-ghost btn-sm" onclick="showPage(\u0027deposits\u0027)">\u2197\ufe0f \u0e14\u0e39\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</button>'+
          '</div>'+
        '</div>'+
        '<div class="table-wrap"><table>'+
          '<thead><tr>'+
            '<th>\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48</th>'+
            '<th>\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17</th>'+
            '<th class="number">\u0e08\u0e33\u0e19\u0e27\u0e19</th>'+
            '<th>\u0e27\u0e34\u0e18\u0e35\u0e0a\u0e33\u0e23\u0e30</th>'+
            '<th>\u0e2a\u0e16\u0e32\u0e19\u0e30</th>'+
            '<th>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</th>'+
            '<th></th>'+
          '</tr></thead>'+
          '<tbody>'+emptyRow+rows+'</tbody>'+
        '</table></div>';
    });
}


// ═══════════════════════════════════════════
// LAB RESULTS — moved from fix-features.js
// ═══════════════════════════════════════════

function renderLabTab(patientId, overrideFrom, overrideTo) {
  var el = document.getElementById('lab-list-' + patientId);
  if (!el) return;
  
  // ⚠️ อ่านค่า filter ก่อน clear innerHTML (ไม่งั้น input หายก่อน)
  // ถ้ามี override (จาก preset) ใช้ค่าที่ส่งมา ไม่อ่าน DOM
  var today = new Date().toISOString().split('T')[0];
  var fromDate, toDate;
  if (overrideFrom && overrideTo) {
    fromDate = overrideFrom;
    toDate = overrideTo;
  } else {
    try {
      fromDate = document.getElementById('lab-filter-from')?.value || today;
      toDate   = document.getElementById('lab-filter-to')?.value   || today;
      if (fromDate > toDate) { var tmp = fromDate; fromDate = toDate; toDate = tmp; }
    } catch(e) {
      fromDate = today; toDate = today;
    }
  }
  
  el.innerHTML = '<div style="text-align:center;padding:20px;">กำลังโหลด...</div>';
  
  supa.from('patient_lab_results').select('*').eq('patient_id', patientId)
    .gte('test_date', fromDate).lte('test_date', toDate)
    .order('test_date', { ascending: false })
    .then(function(res) {
      var rows = res.data || [];
      var rangeText = (fromDate === toDate) ? '' : ' (' + fromDate + ' ถึง ' + toDate + ')';
      var headerHtml = '<div class="card-header" style="flex-wrap:wrap;gap:8px;">' +
        '<div class="card-title">🧪 ผลแล็บ (' + rows.length + ')</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
        '<span style="font-size:12px;color:var(--text3);">จาก:</span>' +
        '<input type="date" id="lab-filter-from" class="form-control" style="width:140px;font-size:12px;padding:4px 8px;" value="' + fromDate + '" onchange="renderLabTab(\'' + patientId + '\')">' +
        '<span style="font-size:12px;color:var(--text3);">ถึง:</span>' +
        '<input type="date" id="lab-filter-to" class="form-control" style="width:140px;font-size:12px;padding:4px 8px;" value="' + toDate + '" onchange="renderLabTab(\'' + patientId + '\')">' +
        '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setLabDateRange(\'today\',\'' + patientId + '\')">วันนี้</button>' +
        '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setLabDateRange(\'7days\',\'' + patientId + '\')">7 วันล่าสุด</button>' +
        '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setLabDateRange(\'thisMonth\',\'' + patientId + '\')">เดือนนี้</button>' +
        '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setLabDateRange(\'lastMonth\',\'' + patientId + '\')">เดือนที่แล้ว</button>' +
        '<button class="btn btn-primary btn-sm" onclick="openAddLabModal(\''+patientId+'\')">+ บันทึก</button>' +
        '</div></div>';
      
      if (!rows.length) {
        el.innerHTML = '<div class="card">' + headerHtml +
          '<div style="padding:32px;text-align:center;color:var(--text3);">ไม่มีผลแล็บในช่วงที่เลือก' + rangeText + '</div></div>';
        return;
      }
      var html = '<div class="card">' + headerHtml + '<div style="padding:0 16px;">';
      rows.forEach(function(r) {
        var results = [];
        try { results = typeof r.results === 'string' ? JSON.parse(r.results) : (Array.isArray(r.results) ? r.results : []); } catch(e) {}
        var abn = results.filter(function(x) { return x.status === 'high' || x.status === 'low'; });
        // Option B: card layout — แสดงครบทุก field (date, hospital, doctor, summary, note)
        html += '<div style="border:1.5px solid var(--border);border-radius:10px;margin:12px 0;background:white;overflow:hidden;">' +
          // Header: date + actions
          '<div style="background:#f0faf5;padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="font-weight:700;font-size:15px;color:#2d8f3f;">📅 ' + (r.test_date||'-') + '</div>' +
          '<div>' +
          '<button class="btn btn-ghost btn-sm" onclick="openEditLabModal(\'' + r.id + '\',\'' + patientId + '\')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteLabResult(\'' + r.id + '\',\'' + patientId + '\')" style="color:#e74c3c;">🗑️</button>' +
          '</div></div>' +
          // Body: grid 2 columns
          '<div style="padding:14px 16px;">' +
          '<div style="display:grid;grid-template-columns:130px 1fr;gap:8px 12px;font-size:13px;">' +
          '<div style="color:#888;font-weight:600;">🏥 โรงพยาบาล</div>' +
          '<div style="color:#222;">' + (r.hospital ? r.hospital : '<span style="color:#bbb;">-</span>') + '</div>' +
          '<div style="color:#888;font-weight:600;">👨‍⚕️ แพทย์ผู้ตรวจ</div>' +
          '<div style="color:#222;">' + (r.doctor ? r.doctor : '<span style="color:#bbb;">-</span>') + '</div>' +
          '<div style="color:#888;font-weight:600;">📋 สรุปผล</div>' +
          '<div style="color:#222;line-height:1.5;">' + (r.summary ? r.summary : '<span style="color:#bbb;">-</span>') + '</div>' +
          '<div style="color:#888;font-weight:600;">📝 หมายเหตุ</div>' +
          '<div style="color:#222;line-height:1.5;">' + (r.note ? '<div style="font-style:italic;background:#fffbea;padding:6px 10px;border-radius:6px;border-left:3px solid #f59e0b;">' + r.note + '</div>' : '<span style="color:#bbb;">-</span>') + '</div>' +
          '</div>' +
          // Abnormal badges
          (abn.length ? '<div style="margin-top:10px;">' + abn.map(function(x) {
            return '<span style="font-size:11px;padding:2px 6px;border-radius:10px;background:' +
              (x.status==='high'?'#fde8e8':'#fff3e0') + ';color:' + (x.status==='high'?'#c0392b':'#d35400') + ';margin-right:4px;">' +
              x.test_name + ': ' + x.value + '</span>';
          }).join(' ') + '</div>' : '') +
          // Detailed results (collapsible)
          (results.length ? '<details style="margin-top:10px;"><summary style="font-size:12px;color:var(--text2);cursor:pointer;">ดูผลทั้งหมด (' + results.length + ' รายการ)</summary>' +
          '<div style="margin-top:6px;">' + results.map(function(x) {
            var sc = x.status==='high'?'#e74c3c':x.status==='low'?'#e67e22':'#27ae60';
            return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 6px;background:var(--surface2);border-radius:4px;margin-bottom:2px;">' +
              '<span>' + x.test_name + '</span><span style="color:' + sc + '">' + x.value + ' ' + (x.unit||'') +
              (x.reference_range ? ' (' + x.reference_range + ')' : '') + '</span></div>';
          }).join('') + '</div></details>' : '') +
          '</div></div>';
      });
      html += '</div></div>';
      el.innerHTML = html;
    });
}

// Helper: ปุ่ม preset date range สำหรับ Lab
function setLabDateRange(preset, patientId) {
  var today = new Date();
  var todayStr = today.toISOString().split('T')[0];
  var fromDate = todayStr, toDate = todayStr;
  if (preset === 'today') { fromDate = todayStr; toDate = todayStr; }
  else if (preset === '7days') {
    var past = new Date(today); past.setDate(today.getDate() - 6);
    fromDate = past.toISOString().split('T')[0]; toDate = todayStr;
  } else if (preset === 'thisMonth') {
    fromDate = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-01';
    toDate = todayStr;
  } else if (preset === 'lastMonth') {
    var lastMonth = new Date(today.getFullYear(), today.getMonth()-1, 1);
    var lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    fromDate = lastMonth.toISOString().split('T')[0];
    toDate = lastDayLastMonth.toISOString().split('T')[0];
  }
  var fromEl = document.getElementById('lab-filter-from');
  var toEl = document.getElementById('lab-filter-to');
  if (fromEl) fromEl.value = fromDate;
  if (toEl) toEl.value = toDate;
  // ส่ง fromDate/toDate ตรงๆ ไม่อ่านจาก DOM (เพราะ DOM อาจ flush ไม่ทัน)
  renderLabTab(patientId, fromDate, toDate);
}

function _renderLabRows() {
  var rows = window._labRows || [];
  var c = document.getElementById('lab-results-container');
  if (!c) return;
  if (!rows.length) { c.innerHTML = '<div style="text-align:center;padding:12px;">กด + เพิ่ม</div>'; return; }
  c.innerHTML = rows.map(function(row, i) {
    var sc = row.status==='high' ? 'border-left:3px solid #e74c3c;' : row.status==='low' ? 'border-left:3px solid #e67e22;' : 'border-left:3px solid #27ae60;';
    return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1.5fr auto auto;gap:6px;align-items:center;padding:6px 8px;background:var(--surface2);border-radius:6px;margin-bottom:6px;' + sc + '">' +
      '<input class="form-control" style="font-size:12px;" placeholder="ชื่อ" value="' + (row.test_name||'') + '" oninput="window._labRows[' + i + '].test_name=this.value">' +
      '<input class="form-control" style="font-size:12px;" placeholder="ค่า" value="' + (row.value||'') + '" oninput="window._labRows[' + i + '].value=this.value">' +
      '<input class="form-control" style="font-size:12px;" placeholder="หน่วย" value="' + (row.unit||'') + '" oninput="window._labRows[' + i + '].unit=this.value">' +
      '<input class="form-control" style="font-size:12px;" placeholder="อ้างอิง" value="' + (row.reference_range||'') + '" oninput="window._labRows[' + i + '].reference_range=this.value">' +
      '<select class="form-control" style="font-size:12px;" onchange="window._labRows[' + i + '].status=this.value;window._renderLabRows()">' +
      '<option value="normal"' + (row.status==='normal'?' selected':'') + '>N</option>' +
      '<option value="high"' + (row.status==='high'?' selected':'') + '>H</option>' +
      '<option value="low"' + (row.status==='low'?' selected':'') + '>L</option></select>' +
      '<button class="btn btn-ghost btn-sm" style="color:#e74c3c;" onclick="window._labRows.splice(' + i + ',1);window._renderLabRows()">✕</button></div>';
  }).join('');
}
window._renderLabRows = _renderLabRows;

function openAddLabModalBase(patientId) {
  document.getElementById('lab-edit-id').value = '';
  document.getElementById('lab-patient-id').value = patientId;
  // Phase 4 Step D: default วันที่ตรวจ = วันนี้ (กดบันทึกง่าย ไม่ต้องเลือกเอง)
  document.getElementById('lab-test-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('lab-hospital').value = '';
  document.getElementById('lab-doctor').value = '';
  document.getElementById('lab-summary').value = '';
  document.getElementById('lab-note').value = '';
  window._labRows = [];
  window._renderLabRows();
  document.getElementById('modal-add-lab-title').textContent = '🧪 บันทึกผลแล็บ';
  openModal('modal-add-lab');
}
window.openAddLabModal = openAddLabModalBase;

function openEditLabModal(labId, patientId) {
  supa.from('patient_lab_results').select('*').eq('id', labId).single().then(function(res) {
    var r = res.data;
    if (!r) return;
    document.getElementById('lab-edit-id').value = labId;
    document.getElementById('lab-patient-id').value = patientId;
    document.getElementById('lab-test-date').value = r.test_date || '';
    document.getElementById('lab-hospital').value = r.hospital || '';
    document.getElementById('lab-doctor').value = r.doctor || '';
    document.getElementById('lab-summary').value = r.summary || '';
    document.getElementById('lab-note').value = r.note || '';
    try { window._labRows = typeof r.results === 'string' ? JSON.parse(r.results) : (r.results || []); }
    catch(e) { window._labRows = []; }
    window._renderLabRows();
    document.getElementById('modal-add-lab-title').textContent = '✏️ แก้ไขผลแล็บ';
    openModal('modal-add-lab');
  });
}

function addLabResultRow(prefill) {
  if (!window._labRows) window._labRows = [];
  window._labRows.push(prefill || { test_name: '', value: '', unit: '', reference_range: '', status: 'normal' });
  window._renderLabRows();
}

async function saveLabResult() {
  var editId    = document.getElementById('lab-edit-id').value;
  var patientId = document.getElementById('lab-patient-id').value;
  var testDate  = document.getElementById('lab-test-date').value;
  if (!testDate) { toast('กรุณาระบุวันที่', 'warning'); return; }
  var payload = {
    patient_id: patientId,
    test_date:  testDate,
    hospital:   document.getElementById('lab-hospital').value.trim() || null,
    doctor:     document.getElementById('lab-doctor').value.trim() || null,
    summary:    document.getElementById('lab-summary').value.trim() || null,
    results:    JSON.stringify(window._labRows || []),
    note:       document.getElementById('lab-note').value.trim() || null,
    created_by: (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : null,
  };
  // R4-004 fix: ต้องมีผลแล็บอย่างน้อย 1 รายการ หรือ summary/note
  var labRows = (window._labRows || []).filter(r => r && (r.test_name || r.value));
  var hasContent = labRows.length > 0 || payload.summary || payload.note || payload.hospital || payload.doctor;
  if (!hasContent) {
    toast('กรุณาระบุผลแล็บอย่างน้อย 1 รายการ หรือกรอก summary/note/โรงพยาบาล/แพทย์','warning');
    return;
  }
  var res = editId
    ? await supa.from('patient_lab_results').update(payload).eq('id', editId)
    : await supa.from('patient_lab_results').insert(payload);
  if (res.error) { toast('บันทึกไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  toast('บันทึกเรียบร้อย', 'success');
  closeModal('modal-add-lab');
  renderLabTab(patientId);
}

async function deleteLabResult(labId, patientId) {
  if (!(await customConfirm('ลบผลแล็บ?'))) return;
  var res = await supa.from('patient_lab_results').delete().eq('id', labId);
  if (res.error) { toast('ลบไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  toast('ลบเรียบร้อย', 'success');
  renderLabTab(patientId);
}

// ─── Patient Profile Tab Bar (role-aware) ────────────────────
function renderPatientTabBar(p, totalReqs) {
  // [R4 P2 14พค69] Refactor: แยก icon/label/count + ใช้ data structure เดียวสำหรับทั้ง desktop + mobile
  // ตามเดิม onclick='switchPatTab' ไม่ broken
  const allTabs = [
    { k:'vitals',     perm:'vitals',     icon:'📊', label:'Vital Signs' },
    { k:'excretion',  perm:'excretion',  icon:'🚽', label:'ขับถ่าย / น้ำเข้าออก' },
    { k:'medical',    perm:'nursing',    icon:'📋', label:'ประวัติการรักษา' },
    { k:'meds',       perm:'mar',        icon:'💊', label:'ยาประจำ' },
    { k:'allergy',    perm:'allergy',    icon:'⚠️', label:'แพ้ยา/อาหาร', count: p.allergies?.length || 0, countTone:'danger' },
    { k:'nursing',    perm:'nursing',    icon:'📝', label:'บันทึกพยาบาล' },
    { k:'mar',        perm:'mar',        icon:'💊', label:'MAR ยาประจำวัน' },
    { k:'physio',     perm:'physio',     icon:'🧘', label:'กายภาพบำบัด' },
    { k:'lab',        perm:'lab',        icon:'🧪', label:'ผลแล็บ' },
    { k:'appts',      perm:'appts',      icon:'🚐', label:'นัดหมายแพทย์' },
    { k:'incident',   perm:'incident',   icon:'🚨', label:'อุบัติเหตุ' },
    { k:'dietary',    perm:'dietary',    icon:'🥦', label:'โภชนาการ' },
    { k:'contacts',   perm:'contacts',   icon:'📞', label:'ผู้ติดต่อ', count: p.contacts?.length || 0, countTone:'brand' },
    { k:'notes',      perm:'nursing',    icon:'📌', label:'หมายเหตุ' },
    { k:'belongings', perm:'belongings', icon:'🧳', label:'ทรัพย์สิน' },
    { k:'deposits',   perm:'deposits',   icon:'💰', label:'มัดจำ' },
    { k:'dnr',        perm:'dnr',        icon:'⚖️', label:'DNR & Consent' },
    { k:'dispense',   perm:'dispense',   icon:'📦', label:'เบิกสินค้า' },
    { k:'history',    perm:'history',    icon:'🕐', label:'ประวัติเบิก', count: totalReqs, countTone:'neutral' },
  ];
  const visibleTabs = allTabs.filter(t => canSeePatientTab(t.perm));

  // [R4 P2] Build count badge HTML (3 tones: danger/brand/neutral)
  function _countBadge(c, tone) {
    if (!c) return '';
    const palette = {
      danger:  { bg:'#fdf0ee', color:'#c0392b', border:'rgba(192,57,43,0.25)' },
      brand:   { bg:'var(--sage-100,#eaf1eb)', color:'var(--brand,#2e6b4f)', border:'var(--sage-200,#dbe5dc)' },
      neutral: { bg:'var(--surface2,#f5f1e3)', color:'var(--text2,#5e5e5e)', border:'var(--border,#e8e3d4)' }
    }[tone] || { bg:'#eaf1eb', color:'#2e6b4f', border:'#dbe5dc' };
    return `<span class="patprofile-tab-count" style="background:${palette.bg};color:${palette.color};border:1px solid ${palette.border};border-radius:999px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px;line-height:1.4;min-width:18px;display:inline-block;text-align:center;">${c}</span>`;
  }

  // Desktop: tabs (horizontal scroll) — pill underline style + count badge
  const tabsHtml = visibleTabs.map(t =>
    `<div class="tab" data-tab-key="${t.k}" onclick="switchPatTab('${t.k}')"><span class="patprofile-tab-icon">${t.icon}</span> <span class="patprofile-tab-label">${t.label}</span>${_countBadge(t.count, t.countTone)}</div>`
  ).join('\n        ');

  // Mobile: grid view (3 cols)
  const gridHtml = visibleTabs.map(t => {
    const badge = t.count ? `<span class="pat-app-badge" style="position:absolute;top:6px;right:6px;background:${t.countTone==='danger'?'#c0392b':'var(--brand,#2e6b4f)'};color:white;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px;min-width:18px;text-align:center;">${t.count}</span>` : '';
    return `<div class="pat-app-btn" style="position:relative;" onclick="switchPatTab('${t.k}');document.getElementById('patAppGrid').style.display='none';document.getElementById('patAppGridBackBtn').style.display='';">
        ${badge}
        <div class="pat-app-icon">${t.icon}</div>
        <div class="pat-app-label">${t.label}</div>
      </div>`;
  }).join('\n        ');

  return (
    // Desktop: tabs (horizontal scroll)
    '<div class="tabs patprofile-tabs" id="patprofileTabs" style="margin-bottom:16px;">\n        ' + tabsHtml + '\n      </div>\n' +
    // Mobile: grid (3 cols) + back button
    '<button class="btn btn-ghost pat-app-back" id="patAppGridBackBtn" style="display:none;margin-bottom:10px;" onclick="document.getElementById(\'patAppGrid\').style.display=\'\';document.getElementById(\'patAppGridBackBtn\').style.display=\'none\';">← กลับไปเลือกแท็บ</button>\n' +
    '<div class="pat-app-grid" id="patAppGrid">\n        ' + gridHtml + '\n      </div>'
  );
}

// ========== EXCRETION TAB ==========
function _renderExcretionTab(patId) {
  var el = document.getElementById('patprofile-tab-excretion');
  if (!el) return;
  el.innerHTML = '';
  el.dataset.patid = patId;

  var canEdit = (typeof canEditExcretion === 'function') ? canEditExcretion() : false;

  // ── Issue 1 Fix (2 พ.ค. 2569): เก็บ date range filter ที่ระดับ tab ──
  // default = today (backward compatible — behavior เดิมเมื่อยังไม่แตะ filter)
  var todayStr = new Date().toISOString().slice(0, 10);
  if (!el.dataset.dateFrom) el.dataset.dateFrom = todayStr;
  if (!el.dataset.dateTo)   el.dataset.dateTo   = todayStr;

  // Header + date range picker
  var hdr = document.createElement('div');
  hdr.className = 'section-header';
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px';
  var title = document.createElement('h4');
  title.style.margin = '0';
  title.textContent = String.fromCodePoint(0x1F6BD) + ' ' + 'ขับถ่าย / น้ำเข้าออก';
  hdr.appendChild(title);

  // Date range filter
  var filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px';
  var lblFrom = document.createElement('span'); lblFrom.textContent = 'จาก'; lblFrom.style.cssText = 'color:#666';
  var inpFrom = document.createElement('input');
  inpFrom.type = 'date'; inpFrom.value = el.dataset.dateFrom;
  inpFrom.className = 'form-control form-control-sm';
  inpFrom.style.cssText = 'width:140px';
  var lblTo = document.createElement('span'); lblTo.textContent = 'ถึง'; lblTo.style.cssText = 'color:#666';
  var inpTo = document.createElement('input');
  inpTo.type = 'date'; inpTo.value = el.dataset.dateTo;
  inpTo.className = 'form-control form-control-sm';
  inpTo.style.cssText = 'width:140px';
  var btnToday = document.createElement('button');
  btnToday.className = 'btn btn-ghost btn-sm';
  btnToday.textContent = 'วันนี้';
  btnToday.style.cssText = 'font-size:12px';
  btnToday.addEventListener('click', function() {
    inpFrom.value = todayStr; inpTo.value = todayStr;
    el.dataset.dateFrom = todayStr; el.dataset.dateTo = todayStr;
    _loadExcretionData(patId, el, canEdit);
  });
  // Preset buttons: 7 วันล่าสุด / เดือนนี้ / เดือนที่แล้ว
  var btn7days = document.createElement('button');
  btn7days.className = 'btn btn-ghost btn-sm';
  btn7days.textContent = '7 วันล่าสุด';
  btn7days.style.cssText = 'font-size:12px';
  btn7days.addEventListener('click', function() {
    var t = new Date();
    var past = new Date(t); past.setDate(t.getDate() - 6);
    var fromD = past.toISOString().slice(0,10);
    inpFrom.value = fromD; inpTo.value = todayStr;
    el.dataset.dateFrom = fromD; el.dataset.dateTo = todayStr;
    _loadExcretionData(patId, el, canEdit);
  });
  var btnThisMonth = document.createElement('button');
  btnThisMonth.className = 'btn btn-ghost btn-sm';
  btnThisMonth.textContent = 'เดือนนี้';
  btnThisMonth.style.cssText = 'font-size:12px';
  btnThisMonth.addEventListener('click', function() {
    var t = new Date();
    var fromD = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-01';
    inpFrom.value = fromD; inpTo.value = todayStr;
    el.dataset.dateFrom = fromD; el.dataset.dateTo = todayStr;
    _loadExcretionData(patId, el, canEdit);
  });
  var btnLastMonth = document.createElement('button');
  btnLastMonth.className = 'btn btn-ghost btn-sm';
  btnLastMonth.textContent = 'เดือนที่แล้ว';
  btnLastMonth.style.cssText = 'font-size:12px';
  btnLastMonth.addEventListener('click', function() {
    var t = new Date();
    var lastMonth = new Date(t.getFullYear(), t.getMonth()-1, 1);
    var lastDayLastMonth = new Date(t.getFullYear(), t.getMonth(), 0);
    var fromD = lastMonth.toISOString().slice(0,10);
    var toD = lastDayLastMonth.toISOString().slice(0,10);
    inpFrom.value = fromD; inpTo.value = toD;
    el.dataset.dateFrom = fromD; el.dataset.dateTo = toD;
    _loadExcretionData(patId, el, canEdit);
  });
  inpFrom.addEventListener('change', function() {
    el.dataset.dateFrom = inpFrom.value;
    if (inpFrom.value > inpTo.value) { inpTo.value = inpFrom.value; el.dataset.dateTo = inpFrom.value; }
    _loadExcretionData(patId, el, canEdit);
  });
  inpTo.addEventListener('change', function() {
    el.dataset.dateTo = inpTo.value;
    if (inpTo.value < inpFrom.value) { inpFrom.value = inpTo.value; el.dataset.dateFrom = inpTo.value; }
    _loadExcretionData(patId, el, canEdit);
  });
  filterWrap.appendChild(lblFrom);
  filterWrap.appendChild(inpFrom);
  filterWrap.appendChild(lblTo);
  filterWrap.appendChild(inpTo);
  filterWrap.appendChild(btnToday);
  filterWrap.appendChild(btn7days);
  filterWrap.appendChild(btnThisMonth);
  filterWrap.appendChild(btnLastMonth);
  hdr.appendChild(filterWrap);
  el.appendChild(hdr);

  // Load data and render sections
  _loadExcretionData(patId, el, canEdit);
}

function _loadExcretionData(patId, el, canEdit) {
  // ── Issue 1 Fix: ใช้ date range จาก dataset แทน hardcode today ──
  var todayStr = new Date().toISOString().slice(0, 10);
  var dateFrom = (el && el.dataset && el.dataset.dateFrom) ? el.dataset.dateFrom : todayStr;
  var dateTo   = (el && el.dataset && el.dataset.dateTo)   ? el.dataset.dateTo   : todayStr;
  var fromTs = dateFrom + 'T00:00:00';
  var toTs   = dateTo   + 'T23:59:59';
  Promise.all([
    supa.from('patient_excretions').select('*').eq('patient_id', patId).gte('recorded_at', fromTs).lte('recorded_at', toTs).order('recorded_at', {ascending: true}),
    supa.from('patient_fluid_records').select('*').eq('patient_id', patId).gte('recorded_at', fromTs).lte('recorded_at', toTs).order('recorded_at', {ascending: true})
  ]).then(function(results) {
    var excretions = (results[0].data || []);
    var fluids = (results[1].data || []);
    _renderExcretionSections(el, patId, excretions, fluids, canEdit, dateFrom, dateTo);
  }).catch(function(e) {
    el.innerHTML = '<p style="color:red">เกิดข้อผิด: ' + e.message + '</p>';
  });
}

function _renderExcretionSections(el, patId, excretions, fluids, canEdit, dateFrom, dateTo) {
  // ── Issue 1 Fix: ลบเฉพาะ sections เก่า (ไม่ลบ header + date filter ที่เพิ่งสร้าง) ──
  var existing = el.querySelector('[data-excretion-sections]');
  if (existing) existing.remove();
  var sectionsWrap = document.createElement('div');
  sectionsWrap.setAttribute('data-excretion-sections', '1');

  // backward compat: ถ้าโค้ดเก่าส่ง today เดียว → ใช้เป็นทั้ง from+to
  if (dateTo === undefined) dateTo = dateFrom;
  // ค่า default ตอนเปิด modal: ใช้ dateFrom (ถ้า user เลือกย้อนหลัง — บันทึกใหม่ไปวันแรกของ range)
  var modalDefaultDate = dateFrom;
  var rangeLabel = (dateFrom === dateTo) ? dateFrom : (dateFrom + ' ถึง ' + dateTo);

  // ===== SECTION 1: 💧 น้ำเข้า (Intake) — ขึ้นก่อนตามที่อ้นขอ =====
  var intakeFluids = fluids.filter(function(f){ return f.direction === 'intake'; });
  var sec1 = document.createElement('div');
  sec1.style.cssText = 'background:#f0f8f0;border-radius:8px;padding:16px;margin-bottom:16px';
  var s1hdr = document.createElement('div');
  s1hdr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px';
  var s1title = document.createElement('strong');
  s1title.textContent = String.fromCodePoint(0x1F4A7) + ' น้ำเข้า (Intake)';
  if (canEdit) {
    var btnAdd1 = document.createElement('button');
    btnAdd1.className = 'btn btn-sm btn-success';
    btnAdd1.textContent = '+ เพิ่มน้ำเข้า';
    btnAdd1.addEventListener('click', function() { _openIntakeModal(null, patId, modalDefaultDate); });
    s1hdr.appendChild(btnAdd1);
  }
  s1hdr.appendChild(s1title);
  sec1.appendChild(s1hdr);
  _renderFluidTable(sec1, intakeFluids, canEdit, patId, 'intake', modalDefaultDate, rangeLabel);
  sectionsWrap.appendChild(sec1);

  // ===== SECTION 2: 🚽 น้ำออก (Output) — รวม 4 ประเภท =====
  // ปัสสาวะ + อุจจาระ (จาก patient_excretions)
  // อาเจียน + อื่นๆ (จาก patient_fluid_records.direction='output')
  var outputFluids = fluids.filter(function(f){ return f.direction === 'output'; });
  var combinedOutput = _buildCombinedOutputRows(excretions, outputFluids);
  var sec2 = document.createElement('div');
  sec2.style.cssText = 'background:#fff0f0;border-radius:8px;padding:16px;margin-bottom:16px';
  var s2hdr = document.createElement('div');
  s2hdr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px';
  var s2title = document.createElement('strong');
  s2title.textContent = String.fromCodePoint(0x1F6BD) + ' น้ำออก (Output)';
  if (canEdit) {
    var btnAdd2 = document.createElement('button');
    btnAdd2.className = 'btn btn-sm btn-danger';
    btnAdd2.textContent = '+ เพิ่มน้ำออก';
    btnAdd2.addEventListener('click', function() { _openOutputModal(null, patId, modalDefaultDate); });
    s2hdr.appendChild(btnAdd2);
  }
  s2hdr.appendChild(s2title);
  sec2.appendChild(s2hdr);
  _renderCombinedOutputTable(sec2, combinedOutput, canEdit, patId, modalDefaultDate, rangeLabel);
  sectionsWrap.appendChild(sec2);

  // ===== SECTION 3: BALANCE SUMMARY =====
  _renderBalanceSummary(sectionsWrap, excretions, fluids, rangeLabel);

  el.appendChild(sectionsWrap);
}

// ── Helper: รวม excretions + output fluids เป็น list เดียว เรียงตามเวลา ──
function _buildCombinedOutputRows(excretions, outputFluids) {
  var rows = [];
  // ปัสสาวะ / อุจจาระ (จาก patient_excretions)
  excretions.forEach(function(r) {
    var typeLabel = r.type === 'urine' ? 'ปัสสาวะ'
                  : r.type === 'stool' ? 'อุจจาระ'
                  : (r.type || '');
    rows.push({
      source: 'excretion',
      id: r.id,
      recorded_at: r.recorded_at,
      shift: r.shift,
      type: r.type,
      typeLabel: typeLabel,
      count: r.count,
      volume_ml: r.volume_ml,
      characteristics: r.characteristics,
      note: r.note,
      raw: r
    });
  });
  // อาเจียน / อื่นๆ (จาก patient_fluid_records.direction='output')
  outputFluids.forEach(function(f) {
    var ft = (f.fluid_type || '').trim();
    var isVomit = ft === 'อาเจียน';
    // Extract [ลักษณะ: xxx] จาก note ออกมาเป็น characteristics
    var noteRaw = f.note || '';
    var charExtracted = null;
    var noteClean = noteRaw;
    var m = noteRaw.match(/^\[ลักษณะ:\s*([^\]]+)\]\s*(.*)$/);
    if (m) {
      charExtracted = m[1].trim();
      noteClean = m[2].trim();
    }
    rows.push({
      source: 'fluid',
      id: f.id,
      recorded_at: f.recorded_at,
      shift: f.shift,
      type: isVomit ? 'vomit' : 'other',
      typeLabel: isVomit ? 'อาเจียน' : ('อื่นๆ' + (ft ? ': ' + ft : '')),
      count: null,
      volume_ml: f.volume_ml,
      characteristics: charExtracted,
      note: noteClean,
      raw: f
    });
  });
  // เรียงตามเวลา (ใหม่สุดล่าง — เหมือนของเดิม)
  rows.sort(function(a, b) {
    return (a.recorded_at || '').localeCompare(b.recorded_at || '');
  });
  return rows;
}

// ── Render combined output table ──
function _renderCombinedOutputTable(sec, rows, canEdit, patId, modalDefaultDate, rangeLabel) {
  if (rows.length === 0) {
    var nodata = document.createElement('p');
    nodata.style.color = '#888';
    nodata.textContent = 'ไม่มีข้อมูลในช่วง ' + rangeLabel;
    sec.appendChild(nodata);
    return;
  }
  var tbl = document.createElement('table');
  tbl.className = 'table table-sm table-bordered';
  tbl.style.fontSize = '13px';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>วันที่</th><th>เวลา</th><th>เวร</th><th>ประเภท</th><th>จำนวนครั้ง</th><th>ปริมาณ(ml)</th><th>ลักษณะ</th><th>หมายเหตุ</th>' + (canEdit ? '<th></th>' : '') + '</tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');
  rows.forEach(function(r) {
    var tr = document.createElement('tr');
    var d = r.recorded_at ? r.recorded_at.slice(0,10) : '';
    var t = r.recorded_at ? r.recorded_at.slice(11,16) : '';
    tr.innerHTML = '<td>' + d + '</td><td>' + t + '</td><td>' + (r.shift||'') + '</td><td>' + r.typeLabel + '</td><td>' + (r.count||'-') + '</td><td>' + (r.volume_ml||'-') + '</td><td>' + (r.characteristics||'-') + '</td><td>' + (r.note||'-') + '</td>';
    if (canEdit) {
      var tdAct = document.createElement('td');
      var btnE = document.createElement('button');
      btnE.className = 'btn btn-xs btn-outline-secondary';
      btnE.textContent = '✒';
      btnE.style.marginRight = '4px';
      btnE.addEventListener('click', (function(row){ return function(){ _openOutputModal(row, patId, modalDefaultDate); }; })(r));
      var btnD = document.createElement('button');
      btnD.className = 'btn btn-xs btn-outline-danger';
      btnD.textContent = '✕';
      btnD.addEventListener('click', (function(row){ return function(){ _deleteOutputRow(row, patId); }; })(r));
      tdAct.appendChild(btnE); tdAct.appendChild(btnD);
      tr.appendChild(tdAct);
    }
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  sec.appendChild(tbl);
}

// ── Router: ลบ row จาก source ที่ถูกต้อง ──
async function _deleteOutputRow(row, patId) {
  if (!(await customConfirm('ยืนยันลบรายการนี้?'))) return;
  var promise = row.source === 'excretion'
    ? supa.from('patient_excretions').delete().eq('id', row.id)
    : supa.from('patient_fluid_records').delete().eq('id', row.id);
  promise.then(function(res) {
    if (res.error) { customAlert('ลบไม่สำเร็จ: ' + res.error.message); return; }
    switchPatTab('excretion');
  });
}

// ── Helper: คำนวณเวรจากเวลา (2 เวร: เช้า 07:00-18:59 / ดึก 19:00-06:59) ──
function _shiftFromTime(timeStr) {
  if (!timeStr) return 'เช้า';
  var h = parseInt(timeStr.slice(0,2));
  return (h >= 7 && h < 19) ? 'เช้า' : 'ดึก';
}

// ── Lists of ลักษณะ ตามประเภท ──
var _OUTPUT_CHARS = {
  urine: ['ใส', 'เหลืองเข้ม', 'น้ำตาล', 'ขุ่น/มีตะกอน', 'มีเลือดปน'],
  stool: ['ปกติ', 'แข็ง', 'เหลว', 'เหลวเป็นน้ำ', 'มีเลือดปน'],
  vomit: ['เป็นอาหาร', 'เป็นน้ำใส', 'มีเลือดปน', 'มีน้ำดี (สีเหลือง/เขียว)']
};
var _OUTPUT_TYPE_META = {
  urine: { label: 'ปัสสาวะ', icon: '💛', hasVolume: true, hasChar: true },
  stool: { label: 'อุจจาระ', icon: '💩', hasVolume: false, hasChar: true },
  vomit: { label: 'อาเจียน', icon: '🤢', hasVolume: true, hasChar: true },
  other: { label: 'อื่นๆ', icon: '📝', hasVolume: true, hasChar: false }
};

// ── Helper: parse string ลักษณะเป็น list (split by comma, trim) ──
function _parseChars(s) {
  if (!s) return [];
  return s.split(',').map(function(x){ return x.trim(); }).filter(function(x){ return x.length > 0; });
}
function _serializeChars(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

// ── Legacy mapping สำหรับ characteristics ที่ rename แล้ว ──
var _CHAR_LEGACY_MAP = {
  'urine': { 'ขุ่น': 'ขุ่น/มีตะกอน' }
};

// ── Build a multi-chip widget (returns {el, getValue, setValue}) ──
function _buildCharChipsWidget(typeKey, initialChars) {
  // initialChars: string ของลักษณะที่บันทึกไว้แล้ว
  var standardList = _OUTPUT_CHARS[typeKey] || [];
  var legacyMap = _CHAR_LEGACY_MAP[typeKey] || {};
  var initialArr = _parseChars(initialChars).map(function(item) {
    return legacyMap[item] || item;  // map ค่าเก่าเป็นชื่อใหม่
  });

  // แยก: ใน standard list (active) กับ outside (custom)
  var activeSet = {};
  var customs = [];
  initialArr.forEach(function(item) {
    if (standardList.indexOf(item) >= 0) {
      activeSet[item] = true;
    } else {
      customs.push(item);
    }
  });

  // Container
  var wrap = document.createElement('div');

  var chipsContainer = document.createElement('div');
  chipsContainer.className = 'char-chips';
  wrap.appendChild(chipsContainer);

  // Standard chips
  var standardChipEls = {};
  standardList.forEach(function(opt) {
    var chip = document.createElement('div');
    chip.className = 'char-chip' + (activeSet[opt] ? ' active' : '');
    chip.textContent = opt;
    chip.addEventListener('click', function() {
      if (activeSet[opt]) {
        delete activeSet[opt];
        chip.classList.remove('active');
      } else {
        activeSet[opt] = true;
        chip.classList.add('active');
      }
    });
    chipsContainer.appendChild(chip);
    standardChipEls[opt] = chip;
  });

  // Custom chips (พิมพ์เอง)
  function renderCustomChip(text) {
    var chip = document.createElement('div');
    chip.className = 'char-chip custom';
    var span = document.createElement('span');
    span.textContent = text;
    chip.appendChild(span);
    var rem = document.createElement('span');
    rem.className = 'char-chip-remove';
    rem.textContent = '✕';
    rem.addEventListener('click', function() {
      var idx = customs.indexOf(text);
      if (idx >= 0) customs.splice(idx, 1);
      chip.parentNode.removeChild(chip);
    });
    chip.appendChild(rem);
    chipsContainer.appendChild(chip);
  }
  customs.forEach(renderCustomChip);

  // Custom input
  var customWrap = document.createElement('div');
  customWrap.className = 'char-custom-wrap';
  var customLabel = document.createElement('span');
  customLabel.className = 'char-custom-label';
  customLabel.textContent = 'หรือพิมพ์เอง:';
  customWrap.appendChild(customLabel);
  var customRow = document.createElement('div');
  customRow.className = 'char-custom-row';
  var customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'form-control';
  customInput.placeholder = 'ลักษณะอื่น...';
  customInput.style.height = '36px';
  var customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'char-custom-btn';
  customBtn.textContent = '+ เพิ่ม';
  customBtn.addEventListener('click', function() {
    var v = (customInput.value || '').trim();
    if (!v) return;
    // กัน duplicate
    if (standardList.indexOf(v) >= 0) {
      // ถ้าตรงกับ standard option → set active แทน
      activeSet[v] = true;
      if (standardChipEls[v]) standardChipEls[v].classList.add('active');
    } else if (customs.indexOf(v) < 0) {
      customs.push(v);
      renderCustomChip(v);
    }
    customInput.value = '';
  });
  customInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      customBtn.click();
    }
  });
  customRow.appendChild(customInput);
  customRow.appendChild(customBtn);
  customWrap.appendChild(customRow);
  wrap.appendChild(customWrap);

  return {
    el: wrap,
    getValue: function() {
      var arr = [];
      // เรียงตาม standard order ก่อน, แล้วต่อด้วย custom
      standardList.forEach(function(opt) { if (activeSet[opt]) arr.push(opt); });
      customs.forEach(function(c) { arr.push(c); });
      return _serializeChars(arr);
    }
  };
}


// ═══════════════════════════════════════════════════════════════
// Multi-row Output Modal (4 types: urine/stool/vomit/other)
// ═══════════════════════════════════════════════════════════════
// row = null → เพิ่มใหม่ (เริ่มต้น 1 row ว่าง)
// row = {source, raw, ...} → edit mode: เปิดมาแสดง row นั้น (editing) + เพิ่ม row ใหม่ได้
function _openOutputModal(row, patId, today) {
  var isEdit = !!(row && row.source);
  var todayStr = new Date().toISOString().slice(0, 10);
  var nowStr = new Date().toTimeString().slice(0,5);

  // ── Shared header values ──
  var sharedDate = isEdit && row.recorded_at ? row.recorded_at.slice(0,10) : (today || todayStr);
  var sharedTime = isEdit && row.recorded_at ? row.recorded_at.slice(11,16) : nowStr;
  var sharedShift = isEdit && row.shift ? row.shift : _shiftFromTime(sharedTime);

  // ── สร้าง overlay + modal ──
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:18px;width:480px;max-width:95vw;max-height:92vh;overflow-y:auto;';

  // Title
  var h3 = document.createElement('div');
  h3.style.cssText = 'font-size:16px;font-weight:700;color:var(--accent2);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);';
  h3.textContent = isEdit ? '🚽 แก้ไขน้ำออก' : '🚽 เพิ่มน้ำออก';
  modal.appendChild(h3);

  // ── Shared section (วันที่/เวลา/เวร) ──
  var sharedSec = document.createElement('div');
  sharedSec.className = 'mr-shared';
  var sharedLabel = document.createElement('div');
  sharedLabel.className = 'mr-shared-label';
  sharedLabel.textContent = '📍 ใช้กับทุกรายการ';
  sharedSec.appendChild(sharedLabel);

  var dtGrid = document.createElement('div');
  dtGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;';
  var inpDate = document.createElement('input');
  inpDate.type = 'date'; inpDate.value = sharedDate; inpDate.className = 'form-control';
  inpDate.style.cssText = 'height:44px;font-size:14px;';
  var inpTime = document.createElement('input');
  inpTime.type = 'time'; inpTime.value = sharedTime; inpTime.className = 'form-control';
  inpTime.style.cssText = 'height:44px;font-size:14px;';
  var btnNow = document.createElement('button');
  btnNow.type = 'button'; btnNow.className = 'btn-now'; btnNow.textContent = '🕐 ตอนนี้';
  btnNow.addEventListener('click', function() {
    inpDate.value = new Date().toISOString().slice(0,10);
    inpTime.value = new Date().toTimeString().slice(0,5);
    selShift.value = _shiftFromTime(inpTime.value);
  });
  dtGrid.appendChild(inpDate); dtGrid.appendChild(inpTime); dtGrid.appendChild(btnNow);
  sharedSec.appendChild(dtGrid);

  var selShift = document.createElement('select');
  selShift.className = 'form-control';
  selShift.style.cssText = 'height:44px;font-size:14px;';
  ['เช้า (07:00–18:59)', 'ดึก (19:00–06:59)'].forEach(function(label, i) {
    var opt = document.createElement('option');
    opt.value = i === 0 ? 'เช้า' : 'ดึก';
    opt.textContent = label;
    selShift.appendChild(opt);
  });
  selShift.value = sharedShift;
  inpTime.addEventListener('change', function() {
    selShift.value = _shiftFromTime(inpTime.value);
  });
  sharedSec.appendChild(selShift);
  modal.appendChild(sharedSec);

  // ── Rows container ──
  var rowsContainer = document.createElement('div');
  modal.appendChild(rowsContainer);

  // ── State: rows array ── 
  // each row: {kind:'edit'|'new', dbRow?:row, typeVal, countInput, volInput, charsWidget, otherInput, noteInput, container}
  var rows = [];

  function _renumberBadges() {
    rows.forEach(function(r, i) {
      if (r.badgeEl) r.badgeEl.textContent = (r.kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (i + 1);
    });
  }

  function _createRowUI(opts) {
    // opts: {kind:'edit'|'new', dbRow?}
    var kind = opts.kind || 'new';
    var dbRow = opts.dbRow || null;

    // initial values
    var initType, initCount, initVol, initChars, initOtherType, initNote;
    if (dbRow) {
      initType = dbRow.type || 'urine';
      initCount = dbRow.count || '';
      initVol = dbRow.volume_ml || '';
      // ลักษณะ — สำหรับ vomit/other ค่าอยู่ใน note (เพราะ fluid_records ไม่มี characteristics) → extract กลับ
      initChars = dbRow.characteristics || '';
      initNote = dbRow.note || '';
      if (dbRow.source === 'fluid' && initNote) {
        // ดึง [ลักษณะ: xxx] ออกจาก note (legacy format)
        var m = initNote.match(/^\[ลักษณะ:\s*([^\]]+)\]\s*(.*)$/);
        if (m) {
          initChars = m[1].trim();
          initNote = m[2].trim();
        }
      }
      initOtherType = '';
      if (dbRow.source === 'fluid' && dbRow.raw) {
        var ft = (dbRow.raw.fluid_type || '').trim();
        if (ft && ft !== 'อาเจียน') initOtherType = ft;
      }
    } else {
      initType = 'urine';
      initCount = '1';
      initVol = '';
      initChars = '';
      initOtherType = '';
      initNote = '';
    }

    var rowEl = document.createElement('div');
    rowEl.className = 'mr-item ' + initType + (kind === 'edit' ? ' editing' : (rows.length > 0 ? ' new-row' : ''));
    
    // Badge
    var badge = document.createElement('div');
    badge.className = 'mr-badge' + (kind === 'edit' ? ' editing' : '');
    badge.textContent = (kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (rows.length + 1);
    rowEl.appendChild(badge);

    // Delete button (รายการที่ > 1 มี delete — รายการแรกของ row[0] ไม่มีถ้าเป็นรายการเดียว)
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mr-del';
    delBtn.textContent = '✕';
    delBtn.style.display = 'none';  // จะ toggle ใน _updateDelButtons
    delBtn.addEventListener('click', function() {
      var idx = rows.indexOf(rowState);
      if (idx >= 0) {
        rows.splice(idx, 1);
        rowEl.parentNode.removeChild(rowEl);
        _renumberBadges();
        _updateDelButtons();
        _updateSaveBtnText();
      }
    });
    rowEl.appendChild(delBtn);

    // ── Type chips ──
    var typeLabel = document.createElement('div');
    typeLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin:6px 0 5px 0;';
    typeLabel.textContent = 'ประเภท';
    rowEl.appendChild(typeLabel);

    var typeChips = document.createElement('div');
    typeChips.className = 'type-chips';
    var typeChipEls = {};
    ['urine','stool','vomit','other'].forEach(function(t) {
      var meta = _OUTPUT_TYPE_META[t];
      var chip = document.createElement('div');
      chip.className = 'type-chip' + (t === initType ? ' active' : '');
      chip.innerHTML = '<span class="icon">' + meta.icon + '</span><span>' + meta.label + '</span>';
      chip.addEventListener('click', function() {
        rowState.typeVal = t;
        Object.keys(typeChipEls).forEach(function(k) {
          if (k === t) typeChipEls[k].classList.add('active');
          else typeChipEls[k].classList.remove('active');
        });
        // Update row color
        rowEl.classList.remove('urine','stool','vomit','other');
        rowEl.classList.add(t);
        _refreshConditionalFields();
      });
      typeChips.appendChild(chip);
      typeChipEls[t] = chip;
    });
    rowEl.appendChild(typeChips);

    // ── ช่อง "ระบุประเภท" (เฉพาะ other) ──
    var otherWrap = document.createElement('div');
    otherWrap.className = 'cond-field-inline';
    var otherLbl = document.createElement('div');
    otherLbl.style.cssText = 'font-size:10px;font-weight:600;color:var(--text2);margin-bottom:3px;';
    otherLbl.textContent = 'ระบุประเภท';
    var inpOther = document.createElement('input');
    inpOther.type = 'text'; inpOther.value = initOtherType;
    inpOther.placeholder = 'เช่น Drainage, เหงื่อ, เลือดออก';
    inpOther.className = 'form-control'; inpOther.style.cssText = 'height:40px;';
    otherWrap.appendChild(otherLbl); otherWrap.appendChild(inpOther);
    rowEl.appendChild(otherWrap);

    // ── จำนวนครั้ง + ปริมาณ ──
    var qtyGrid = document.createElement('div');
    qtyGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;';
    var countWrap = document.createElement('div');
    var countLbl = document.createElement('div');
    countLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    countLbl.textContent = 'จำนวนครั้ง';
    var inpCount = document.createElement('input');
    inpCount.type = 'number'; inpCount.min = '0'; inpCount.setAttribute('inputmode','numeric');
    inpCount.value = initCount; inpCount.placeholder = '1';
    inpCount.className = 'form-control'; inpCount.style.cssText = 'height:40px;';
    countWrap.appendChild(countLbl); countWrap.appendChild(inpCount);
    var volWrap = document.createElement('div');
    var volLbl = document.createElement('div');
    volLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    volLbl.textContent = 'ปริมาณ (ml)';
    var inpVol = document.createElement('input');
    inpVol.type = 'number'; inpVol.min = '0'; inpVol.setAttribute('inputmode','numeric');
    inpVol.value = initVol;
    inpVol.className = 'form-control'; inpVol.style.cssText = 'height:40px;';
    volWrap.appendChild(volLbl); volWrap.appendChild(inpVol);
    qtyGrid.appendChild(countWrap); qtyGrid.appendChild(volWrap);
    rowEl.appendChild(qtyGrid);

    // ── ลักษณะ ──
    var charWrap = document.createElement('div');
    charWrap.style.cssText = 'margin-top:8px;';
    var charLbl = document.createElement('div');
    charLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;';
    charLbl.innerHTML = 'ลักษณะ <span style="color:var(--text3);font-weight:400;font-size:10px;">(เลือกได้หลายอย่าง)</span>';
    charWrap.appendChild(charLbl);

    // multi-chip widget (จะถูกสร้างใหม่ทุกครั้งที่เปลี่ยน type)
    var charWidgetContainer = document.createElement('div');
    charWrap.appendChild(charWidgetContainer);

    // ── ลักษณะแบบ text (เฉพาะ other) ──
    var charTextInput = document.createElement('input');
    charTextInput.type = 'text';
    charTextInput.placeholder = 'ลักษณะ (พิมพ์เอง)';
    charTextInput.value = (initType === 'other') ? initChars : '';
    charTextInput.className = 'form-control';
    charTextInput.style.cssText = 'height:40px;';
    charWrap.appendChild(charTextInput);
    rowEl.appendChild(charWrap);

    // ── หมายเหตุ ──
    var noteWrap = document.createElement('div');
    noteWrap.style.cssText = 'margin-top:8px;';
    var noteLbl = document.createElement('div');
    noteLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    noteLbl.textContent = 'หมายเหตุ (ไม่บังคับ)';
    var inpNote = document.createElement('input');
    inpNote.type = 'text'; inpNote.value = initNote;
    inpNote.className = 'form-control'; inpNote.style.cssText = 'height:40px;';
    noteWrap.appendChild(noteLbl); noteWrap.appendChild(inpNote);
    rowEl.appendChild(noteWrap);

    // ── Widget container (สร้าง multi-chip widget) ──
    var charsWidget = null;
    function _rebuildCharsWidget(newInitChars) {
      charWidgetContainer.innerHTML = '';
      if (rowState.typeVal === 'other') {
        charsWidget = null;
        return;
      }
      charsWidget = _buildCharChipsWidget(rowState.typeVal, newInitChars || '');
      charWidgetContainer.appendChild(charsWidget.el);
    }

    function _refreshConditionalFields() {
      var meta = _OUTPUT_TYPE_META[rowState.typeVal];
      otherWrap.style.display = (rowState.typeVal === 'other') ? '' : 'none';
      volWrap.style.display = meta.hasVolume ? '' : 'none';
      // ลักษณะ: chips สำหรับ urine/stool/vomit, text สำหรับ other
      if (rowState.typeVal === 'other') {
        charWidgetContainer.style.display = 'none';
        charTextInput.style.display = '';
      } else {
        charWidgetContainer.style.display = '';
        charTextInput.style.display = 'none';
        _rebuildCharsWidget('');  // เริ่มต้นว่าง (กรณีเปลี่ยน type ระหว่างเปิด modal)
      }
    }

    // ── rowState (สำหรับ save logic) ──
    var rowState = {
      kind: kind,
      dbRow: dbRow,
      container: rowEl,
      badgeEl: badge,
      delBtn: delBtn,
      get typeVal() { return rowState._typeVal; },
      set typeVal(v) { rowState._typeVal = v; },
      _typeVal: initType,
      getValues: function() {
        var meta = _OUTPUT_TYPE_META[rowState._typeVal];
        var charFinal = '';
        if (rowState._typeVal === 'other') {
          charFinal = (charTextInput.value || '').trim();
        } else if (charsWidget) {
          charFinal = charsWidget.getValue();
        }
        return {
          type: rowState._typeVal,
          count: parseInt(inpCount.value) || null,
          volume_ml: meta.hasVolume ? (parseFloat(inpVol.value) || null) : null,
          characteristics: charFinal || null,
          otherType: (inpOther.value || '').trim(),
          note: (inpNote.value || '').trim() || null
        };
      }
    };

    // Initial setup
    _rebuildCharsWidget(initType !== 'other' ? initChars : '');
    _refreshConditionalFields();

    return rowState;
  }

  function _addRow(opts) {
    var rowState = _createRowUI(opts || {});
    rows.push(rowState);
    rowsContainer.appendChild(rowState.container);
    _renumberBadges();
    _updateDelButtons();
    _updateSaveBtnText();
    return rowState;
  }

  function _updateDelButtons() {
    // แสดงปุ่ม delete ใน row ทุก row ยกเว้น row แรก (ถ้ามีแค่ 1 row)
    rows.forEach(function(r, i) {
      if (rows.length === 1) {
        r.delBtn.style.display = 'none';
      } else {
        r.delBtn.style.display = '';
      }
    });
  }

  function _updateSaveBtnText() {
    var editCount = rows.filter(function(r){ return r.kind === 'edit'; }).length;
    var newCount = rows.filter(function(r){ return r.kind === 'new'; }).length;
    var parts = [];
    if (editCount > 0) parts.push(editCount + ' แก้');
    if (newCount > 0) parts.push(newCount + ' ใหม่');
    if (typeof btnSave !== 'undefined' && btnSave) btnSave.textContent = '💾 บันทึก (' + parts.join(' + ') + ')';
  }

  // ── Initial rows ──
  if (isEdit) {
    _addRow({ kind: 'edit', dbRow: row });
  } else {
    _addRow({ kind: 'new' });
  }

  // ── ปุ่ม "เพิ่มรายการ" ──
  var btnAddRow = document.createElement('button');
  btnAddRow.type = 'button';
  btnAddRow.className = 'mr-add-row danger';
  btnAddRow.textContent = '➕ เพิ่มรายการ';
  btnAddRow.addEventListener('click', function() {
    _addRow({ kind: 'new' });
  });
  modal.appendChild(btnAddRow);

  // ── ปุ่มล่างสุด ──
  var btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:8px;margin-top:16px;';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-ghost';
  btnCancel.style.cssText = 'flex:1;height:44px;font-size:14px;';
  btnCancel.textContent = 'ยกเลิก';
  var btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-danger';
  btnSave.style.cssText = 'flex:1;height:44px;font-size:14px;font-weight:600;';
  btnSave.textContent = '💾 บันทึก';
  btnWrap.appendChild(btnCancel); btnWrap.appendChild(btnSave);
  modal.appendChild(btnWrap);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _updateSaveBtnText();

  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  // ── Save logic: validate + insert/update ทุก row ──
  btnSave.addEventListener('click', function() {
    // 1. Validate shared
    var dateValSel = inpDate.value;
    var timeValSel = inpTime.value || '00:00';
    if (!dateValSel) { customAlert('กรุณาเลือกวันที่'); return; }
    var dObj = new Date(dateValSel + 'T' + timeValSel + ':00');
    if (isNaN(dObj.getTime())) { customAlert('วันที่/เวลาไม่ถูกต้อง'); return; }
    var dateTime = new Date(dObj.getTime() - dObj.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + 'Z';
    var shiftVal = selShift.value;
    var user = (window._currentUser && window._currentUser.username) ? window._currentUser.username : 'user';

    // 2. Validate each row + build payload list
    var operations = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var v = r.getValues();
      var meta = _OUTPUT_TYPE_META[v.type];

      // ต้องมี count, vol, chars, หรือ note อย่างน้อย 1
      if (!v.count && !v.volume_ml && !v.characteristics && !v.note) {
        customAlert('รายการ ' + (i+1) + ': กรุณาระบุข้อมูลอย่างน้อย 1 อย่าง (จำนวนครั้ง, ปริมาณ, ลักษณะ หรือ หมายเหตุ)');
        return;
      }
      // other ต้องระบุประเภท
      if (v.type === 'other' && !v.otherType) {
        customAlert('รายการ ' + (i+1) + ': กรุณาระบุประเภท "อื่นๆ"');
        return;
      }
      operations.push({ rowState: r, values: v });
    }

    // 3. Execute operations
    var promises = operations.map(function(op) {
      var v = op.values;
      var rs = op.rowState;
      var meta = _OUTPUT_TYPE_META[v.type];

      // Routing: urine/stool → patient_excretions, vomit/other → patient_fluid_records
      if (v.type === 'urine' || v.type === 'stool') {
        var payload = {
          patient_id: patId,
          recorded_at: dateTime,
          shift: shiftVal,
          type: v.type,
          count: v.count,
          volume_ml: v.volume_ml,
          characteristics: v.characteristics,
          note: v.note,
          recorded_by: user
        };
        if (rs.kind === 'edit' && rs.dbRow && rs.dbRow.source === 'excretion') {
          return supa.from('patient_excretions').update(payload).eq('id', rs.dbRow.id);
        } else if (rs.kind === 'edit' && rs.dbRow && rs.dbRow.source === 'fluid') {
          // เปลี่ยน type ข้าม table → DELETE old + INSERT new
          return supa.from('patient_fluid_records').delete().eq('id', rs.dbRow.id)
            .then(function(){ return supa.from('patient_excretions').insert(payload); });
        } else {
          return supa.from('patient_excretions').insert(payload);
        }
      } else {
        // vomit / other → fluid_records
        var fluidType = (v.type === 'vomit') ? 'อาเจียน' : v.otherType;
        // characteristics + note → รวมเก็บใน note (fluid_records ไม่มี characteristics column)
        var noteCombined = v.characteristics
          ? ('[ลักษณะ: ' + v.characteristics + ']' + (v.note ? ' ' + v.note : ''))
          : v.note;
        var fluidPayload = {
          patient_id: patId,
          recorded_at: dateTime,
          shift: shiftVal,
          direction: 'output',
          fluid_type: fluidType,
          volume_ml: v.volume_ml,
          note: noteCombined,
          recorded_by: user
        };
        if (rs.kind === 'edit' && rs.dbRow && rs.dbRow.source === 'fluid') {
          return supa.from('patient_fluid_records').update(fluidPayload).eq('id', rs.dbRow.id);
        } else if (rs.kind === 'edit' && rs.dbRow && rs.dbRow.source === 'excretion') {
          return supa.from('patient_excretions').delete().eq('id', rs.dbRow.id)
            .then(function(){ return supa.from('patient_fluid_records').insert(fluidPayload); });
        } else {
          return supa.from('patient_fluid_records').insert(fluidPayload);
        }
      }
    });

    btnSave.disabled = true;
    btnSave.textContent = 'กำลังบันทึก...';

    Promise.allSettled(promises.map(function(p){
      return Promise.resolve(p).then(function(res) {
        if (res && res.error) throw res.error;
        return res;
      });
    })).then(function(results) {
      var fails = results.filter(function(r){ return r.status === 'rejected'; });
      if (fails.length > 0) {
        var msgs = fails.map(function(f, i){ return 'รายการ ' + (i+1) + ': ' + (f.reason.message || f.reason); }).join('\n');
        customAlert('บันทึกไม่สำเร็จบางรายการ:\n' + msgs);
        btnSave.disabled = false;
        _updateSaveBtnText();
        return;
      }
      close();
      switchPatTab('excretion');
    });
  });
}


function _renderFluidTable(container, rows, canEdit, patId, direction, modalDefaultDate, rangeLabel) {
  if (rows.length === 0) {
    var p = document.createElement('p');
    p.style.color = '#888';
    p.textContent = 'ไม่มีข้อมูลในช่วง ' + (rangeLabel || 'วันนี้');
    container.appendChild(p);
    return;
  }
  var tbl = document.createElement('table');
  tbl.className = 'table table-sm table-bordered';
  tbl.style.fontSize = '13px';
  var th = document.createElement('thead');
  th.innerHTML = '<tr><th>วันที่</th><th>เวลา</th><th>เวร</th><th>ประเภทน้ำ</th><th>ปริมาณ(ml)</th><th>หมายเหตุ</th>' + (canEdit ? '<th></th>' : '') + '</tr>';
  tbl.appendChild(th);
  var tb = document.createElement('tbody');
  rows.forEach(function(r) {
    var tr = document.createElement('tr');
    var d = r.recorded_at ? r.recorded_at.slice(0,10) : '';
    var t = r.recorded_at ? r.recorded_at.slice(11,16) : '';
    // ── Legacy display mapping: 'น้ำดื่ม'/'น้ำเปล่า' → 'น้ำ' ──
    var displayType = r.fluid_type || '';
    if (direction === 'intake' && typeof _INTAKE_LEGACY_NAMES !== 'undefined') {
      // รองรับ multi-value: split by ',' → map ทีละค่า → join
      var parts = displayType.split(',').map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 0; });
      displayType = parts.map(function(p) {
        return (_INTAKE_LEGACY_NAMES.indexOf(p) >= 0) ? 'น้ำ' : p;
      }).join(', ');
    }
    tr.innerHTML = '<td>' + d + '</td><td>' + t + '</td><td>' + (r.shift||'') + '</td><td>' + displayType + '</td><td>' + (r.volume_ml||'') + '</td><td>' + (r.note||'') + '</td>';
    if (canEdit) {
      var tdA = document.createElement('td');
      var bE = document.createElement('button');
      bE.className = 'btn btn-xs btn-outline-secondary';
      bE.textContent = '✒';
      bE.style.marginRight = '4px';
      // ใช้ _openIntakeModal สำหรับ direction='intake' (ของใหม่)
      // _openFluidModal เก็บไว้สำหรับ direction='output' (backward compat — output ใช้ผ่าน combined table)
      bE.addEventListener('click', (function(rec, dir){
        return function() {
          if (dir === 'intake') _openIntakeModal(rec, patId, modalDefaultDate);
          else _openFluidModal(rec, patId, dir, modalDefaultDate);
        };
      })(r, direction));
      var bD = document.createElement('button');
      bD.className = 'btn btn-xs btn-outline-danger';
      bD.textContent = '✕';
      bD.addEventListener('click', (function(id){ return function(){ _deleteFluidRecord(id, patId); }; })(r.id));
      tdA.appendChild(bE); tdA.appendChild(bD);
      tr.appendChild(tdA);
    }
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  container.appendChild(tbl);
}

function _renderBalanceSummary(container, excretions, fluids, rangeLabel) {
  // ── เวร 2 ตัวใหม่: เช้า 07:00-18:59 (h: 7-18), ดึก 19:00-06:59 (h: 19-23 || 0-6) ──
  var shifts = [
    {key:'เช้า', label:'เช้า', sub:'07:00–18:59'},
    {key:'ดึก',  label:'ดึก',  sub:'19:00–06:59'}
  ];
  function _inShift(hour, shKey) {
    if (hour < 0) return false;
    return shKey === 'เช้า' ? (hour >= 7 && hour < 19) : (hour >= 19 || hour < 7);
  }

  var sec3 = document.createElement('div');
  sec3.style.cssText = 'background:#fffbe6;border-radius:8px;padding:16px;margin-bottom:16px';
  var title3 = document.createElement('strong');
  // ── Issue 1 Fix: แสดง range ที่เลือก แทน "วันนี้" ──
  title3.textContent = String.fromCodePoint(0x1F4CA) + ' สรุป Balance' + (rangeLabel ? ' (' + rangeLabel + ')' : '');
  sec3.appendChild(title3);

  var tbl = document.createElement('table');
  tbl.className = 'table table-sm table-bordered';
  tbl.style.cssText = 'margin-top:10px;font-size:13px';
  var thead = document.createElement('thead');
  thead.innerHTML =
    '<tr>' +
      '<th>เวร</th>' +
      '<th>น้ำเข้า (ml)</th>' +
      '<th>น้ำออก (ml)</th>' +
      '<th>Balance (ml)</th>' +
      '<th>ปัสสาวะ (ครั้ง)</th>' +
      '<th>อุจจาระ (ครั้ง)</th>' +
      '<th>อาเจียน (ครั้ง)</th>' +
    '</tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');
  var totIn = 0, totOut = 0, totUrine = 0, totStool = 0, totVomit = 0;

  shifts.forEach(function(sh) {
    var shIn = 0, shOut = 0, shUrine = 0, shStool = 0, shVomit = 0;
    // ── fluids ──
    fluids.forEach(function(f) {
      var h = f.recorded_at ? parseInt(f.recorded_at.slice(11,13)) : -1;
      if (!_inShift(h, sh.key)) return;
      var vol = parseFloat(f.volume_ml) || 0;
      if (f.direction === 'intake') {
        shIn += vol;
      } else if (f.direction === 'output') {
        shOut += vol;
        // นับครั้งของ output fluid (อาเจียน หรือ อื่นๆ)
        var ft = (f.fluid_type || '').trim();
        if (ft === 'อาเจียน') shVomit += 1;
        // 'อื่นๆ' ไม่นับในคอลัมน์ครั้งหลัก (เพราะ user เห็นใน table หลัก)
      }
    });
    // ── excretions ──
    excretions.forEach(function(r) {
      var h = r.recorded_at ? parseInt(r.recorded_at.slice(11,13)) : -1;
      if (!_inShift(h, sh.key)) return;
      if (r.type === 'urine') {
        shOut += parseFloat(r.volume_ml) || 0;
        // ── ข้อ 6 ──: นับครั้งของปัสสาวะ ใช้ count ถ้ามี, ถ้าไม่มี count ให้นับเป็น 1
        shUrine += (parseInt(r.count) || 1);
      } else if (r.type === 'stool') {
        shStool += (parseInt(r.count) || 1);
      }
    });
    totIn += shIn; totOut += shOut;
    totUrine += shUrine; totStool += shStool; totVomit += shVomit;
    var bal = shIn - shOut;
    var tr = document.createElement('tr');
    tr.style.color = bal < 0 ? '#c0392b' : '#1a5276';
    tr.innerHTML =
      '<td>' + sh.label + '<br><span style="font-size:10px;color:var(--text3);font-weight:normal;">' + sh.sub + '</span></td>' +
      '<td>' + shIn + '</td>' +
      '<td>' + shOut + '</td>' +
      '<td><strong>' + (bal >= 0 ? '+' : '') + bal + '</strong></td>' +
      '<td>' + shUrine + '</td>' +
      '<td>' + shStool + '</td>' +
      '<td>' + shVomit + '</td>';
    tbody.appendChild(tr);
  });
  var trTot = document.createElement('tr');
  trTot.style.cssText = 'background:#fef9c3;font-weight:bold';
  var totBal = totIn - totOut;
  trTot.innerHTML =
    '<td>รวม 24 ชม.</td>' +
    '<td>' + totIn + '</td>' +
    '<td>' + totOut + '</td>' +
    '<td style="color:' + (totBal < 0 ? '#c0392b' : '#1a5276') + '">' + (totBal >= 0 ? '+' : '') + totBal + '</td>' +
    '<td>' + totUrine + '</td>' +
    '<td>' + totStool + '</td>' +
    '<td>' + totVomit + '</td>';
  tbody.appendChild(trTot);
  tbl.appendChild(tbody);
  sec3.appendChild(tbl);
  var note3 = document.createElement('p');
  note3.style.cssText = 'font-size:11px;color:#888;margin:4px 0 0';
  note3.textContent = 'หมายเหตุ: น้ำออก (ml) = ปัสสาวะ + อาเจียน + อื่นๆ · "จำนวนครั้ง" นับทุก record (รวมที่ไม่ได้กรอก ml)';
  sec3.appendChild(note3);

  // ── 🚨 แจ้งเตือนอาการผิดปกติ ──
  var alertsEl = _buildClinicalAlerts(excretions, fluids);
  sec3.appendChild(alertsEl);

  container.appendChild(sec3);
}

// ═══════════════════════════════════════════════════════════════
// 🚨 Clinical Alerts (แจ้งเตือนอาการผิดปกติ)
// ═══════════════════════════════════════════════════════════════
// excretions: rows ของ patient_excretions ในช่วง filter
// fluids: rows ของ patient_fluid_records ในช่วง filter
function _buildClinicalAlerts(excretions, fluids) {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:#fff;border-radius:10px;padding:14px;margin-top:14px;border:1.5px solid #e5e7eb';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:13px;font-weight:700;color:#555;margin-bottom:10px';
  title.textContent = '🚨 แจ้งเตือนอาการผิดปกติ';
  wrap.appendChild(title);

  var alerts = [];

  // Helper สร้าง alert item
  function mkAlert(level, icon, titleText, detailText) {
    var styles = {
      green:  { bg: '#ecf9f0', border: '#27ae60', color: '#1d8c4f' },
      orange: { bg: '#fff8e8', border: '#d35400', color: '#8a4d00' },
      red:    { bg: '#fff0f0', border: '#c0392b', color: '#8a1a0e' },
      gray:   { bg: '#f5f5f5', border: '#b0b0b0', color: '#999' }
    };
    var s = styles[level] || styles.gray;
    return {
      level: level,
      html: '<div style="border-radius:8px;padding:12px 14px;margin-bottom:8px;border-left:5px solid ' + s.border +
            ';background:' + s.bg + ';color:' + s.color + ';display:flex;gap:10px;font-size:13px;line-height:1.5">' +
            '<div style="font-size:22px;line-height:1">' + icon + '</div>' +
            '<div style="flex:1">' +
              '<div style="font-weight:700;margin-bottom:3px">' + titleText + '</div>' +
              '<div style="font-size:12px;opacity:0.85;line-height:1.55">' + detailText + '</div>' +
            '</div>' +
          '</div>'
    };
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 1: อุจจาระ
  // ─────────────────────────────────────────────────────────
  var stools = (excretions || []).filter(function(r){ return r.type === 'stool'; });

  // Alert #1: ไม่ถ่ายอุจจาระกี่เวร (คำนวณจากปัจจุบัน)
  if (stools.length === 0) {
    alerts.push(mkAlert('gray', '—', 'อุจจาระ — ยังไม่มีบันทึก', 'ไม่สามารถประเมินสถานะการขับถ่ายได้'));
  } else {
    // เรียงจากใหม่สุด
    var stoolsSorted = stools.slice().sort(function(a,b){
      return (b.recorded_at || '').localeCompare(a.recorded_at || '');
    });
    var lastStool = stoolsSorted[0];
    var noStoolShifts = _countShiftsSinceLast(lastStool.recorded_at);
    var detail = 'ถ่ายล่าสุด: <strong>' + _formatDateTimeTH(lastStool.recorded_at) + ' (เวร' + (lastStool.shift || '—') + ')</strong>';

    if (noStoolShifts <= 3) {
      alerts.push(mkAlert('green', '✓', 'การถ่ายอุจจาระ — ปกติ', detail + ' · ไม่ถ่ายมาแล้ว <strong>' + noStoolShifts + ' เวร</strong>'));
    } else if (noStoolShifts <= 5) {
      alerts.push(mkAlert('orange', '⚠️', 'ไม่ถ่ายอุจจาระมาแล้ว ' + noStoolShifts + ' เวร', detail + ' · ควรเฝ้าระวังท้องผูก'));
    } else {
      alerts.push(mkAlert('red', '🆘', 'ไม่ถ่ายอุจจาระมาแล้ว ' + noStoolShifts + ' เวร — อันตราย', detail + ' · ควรปรึกษาแพทย์/พยาบาลด่วน'));
    }
  }

  // Alert #2: ถ่าย ≥ 3 ครั้งใน 1 เวร (เช็คทุกเวรใน filter range)
  var stoolShiftBuckets = {};  // key = "วันที่|เวร", value = count รวม
  stools.forEach(function(r) {
    if (!r.recorded_at || !r.shift) return;
    var dateKey = r.recorded_at.slice(0,10) + '|' + r.shift;
    stoolShiftBuckets[dateKey] = (stoolShiftBuckets[dateKey] || 0) + (parseInt(r.count) || 1);
  });
  var overflowShifts = Object.keys(stoolShiftBuckets).filter(function(k) {
    return stoolShiftBuckets[k] >= 3;
  });
  if (overflowShifts.length > 0) {
    var listHtml = overflowShifts.map(function(k) {
      var p = k.split('|');
      return '<strong>เวร' + p[1] + ' ' + _formatDateTH(p[0]) + ': ' + stoolShiftBuckets[k] + ' ครั้ง</strong>';
    }).join('<br>');
    alerts.push(mkAlert('red', '🆘', 'ถ่ายอุจจาระบ่อย — เกิน 3 ครั้ง/เวร', listHtml + '<br>อาจมีอาการท้องเสีย'));
  } else if (stools.length > 0) {
    alerts.push(mkAlert('green', '✓', 'จำนวนการถ่ายต่อเวร — ปกติ', 'ไม่พบเวรที่ถ่ายเกิน 3 ครั้ง'));
  }

  // Alert #3: มีเลือดในอุจจาระ
  var stoolBlood = stools.filter(function(r) {
    return (r.characteristics || '').indexOf('เลือด') >= 0;
  });
  if (stoolBlood.length > 0) {
    var latest = stoolBlood.sort(function(a,b){
      return (b.recorded_at || '').localeCompare(a.recorded_at || '');
    })[0];
    var moreText = stoolBlood.length > 1 ? ' (พบทั้งหมด ' + stoolBlood.length + ' ครั้ง)' : '';
    alerts.push(mkAlert('red', '🆘', 'พบเลือดในอุจจาระ',
      _formatDateTimeTH(latest.recorded_at) + ' (เวร' + (latest.shift||'—') + ') · ลักษณะ: "' + (latest.characteristics||'') + '"' + moreText + '<br>ควรแจ้งแพทย์'));
  } else if (stools.length > 0) {
    alerts.push(mkAlert('green', '✓', 'ไม่พบเลือดในอุจจาระ', 'ลักษณะที่บันทึก: ' + (Array.from(new Set(stools.map(function(r){ return r.characteristics || '—'; }))).slice(0,3).join(', '))));
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 2: ปัสสาวะ
  // ─────────────────────────────────────────────────────────
  var urines = (excretions || []).filter(function(r){ return r.type === 'urine'; });

  // เตรียม bucket per เวร (วันที่|เวร → {count, volSum, samples})
  var urineShiftBuckets = {};
  urines.forEach(function(r) {
    if (!r.recorded_at || !r.shift) return;
    var dateKey = r.recorded_at.slice(0,10) + '|' + r.shift;
    if (!urineShiftBuckets[dateKey]) urineShiftBuckets[dateKey] = { count: 0, volSum: 0, samples: [] };
    urineShiftBuckets[dateKey].count += (parseInt(r.count) || 1);
    urineShiftBuckets[dateKey].volSum += (parseFloat(r.volume_ml) || 0);
    urineShiftBuckets[dateKey].samples.push(r);
  });

  // Alert: ไม่ปัสสาวะใน 1 เวร (เช็คเวรที่ผ่านมาในช่วง filter)
  // → ใช้วิธีคล้าย stool: หาเวรล่าสุดที่ฉี่
  if (urines.length === 0) {
    alerts.push(mkAlert('gray', '—', 'ปัสสาวะ — ยังไม่มีบันทึก', 'ไม่สามารถประเมินสถานะการขับถ่ายได้'));
  } else {
    var urinesSorted = urines.slice().sort(function(a,b){
      return (b.recorded_at || '').localeCompare(a.recorded_at || '');
    });
    var lastUrine = urinesSorted[0];
    var noUrineShifts = _countShiftsSinceLast(lastUrine.recorded_at);
    if (noUrineShifts >= 1) {
      alerts.push(mkAlert('red', '🆘', 'ไม่ปัสสาวะมาแล้ว ' + noUrineShifts + ' เวร',
        'ฉี่ล่าสุด: <strong>' + _formatDateTimeTH(lastUrine.recorded_at) + ' (เวร' + (lastUrine.shift||'—') + ')</strong>'));
    } else {
      alerts.push(mkAlert('green', '✓', 'การปัสสาวะ — ปกติ',
        'ฉี่ล่าสุด: ' + _formatDateTimeTH(lastUrine.recorded_at) + ' (เวร' + (lastUrine.shift||'—') + ')'));
    }
  }

  // Alert: ปริมาณน้อย < 300 ml/เวร
  var lowVolShifts = Object.keys(urineShiftBuckets).filter(function(k) {
    return urineShiftBuckets[k].volSum > 0 && urineShiftBuckets[k].volSum < 300;
  });
  if (lowVolShifts.length > 0) {
    var listHtml = lowVolShifts.map(function(k) {
      var p = k.split('|');
      return '<strong>เวร' + p[1] + ' ' + _formatDateTH(p[0]) + ': ' + urineShiftBuckets[k].volSum + ' ml</strong>';
    }).join('<br>');
    alerts.push(mkAlert('red', '🆘', 'ปัสสาวะน้อย — &lt; 300 ml/เวร', listHtml));
  }

  // Alert: Polyuria > 1,000 ml/เวร
  var highVolShifts = Object.keys(urineShiftBuckets).filter(function(k) {
    return urineShiftBuckets[k].volSum > 1000;
  });
  if (highVolShifts.length > 0) {
    var listHtml2 = highVolShifts.map(function(k) {
      var p = k.split('|');
      return '<strong>เวร' + p[1] + ' ' + _formatDateTH(p[0]) + ': ' + urineShiftBuckets[k].volSum + ' ml</strong>';
    }).join('<br>');
    alerts.push(mkAlert('red', '🆘', 'ปัสสาวะมาก (Polyuria) — &gt; 1,000 ml/เวร', listHtml2));
  }

  // Alert: มีเลือดในปัสสาวะ
  var urineBlood = urines.filter(function(r) {
    return (r.characteristics || '').indexOf('เลือด') >= 0;
  });
  if (urineBlood.length > 0) {
    var latestU = urineBlood.sort(function(a,b){
      return (b.recorded_at || '').localeCompare(a.recorded_at || '');
    })[0];
    var moreUText = urineBlood.length > 1 ? ' (พบทั้งหมด ' + urineBlood.length + ' ครั้ง)' : '';
    alerts.push(mkAlert('red', '🆘', 'พบเลือดในปัสสาวะ',
      _formatDateTimeTH(latestU.recorded_at) + ' (เวร' + (latestU.shift||'—') + ') · ลักษณะ: "' + (latestU.characteristics||'') + '"' + moreUText + '<br>ควรแจ้งแพทย์'));
  }

  // Alert: ปัสสาวะสีน้ำตาล หรือ ขุ่น/มีตะกอน
  var urineAbnormal = urines.filter(function(r) {
    var c = r.characteristics || '';
    return (c.indexOf('น้ำตาล') >= 0 || c.indexOf('ขุ่น') >= 0);
  });
  if (urineAbnormal.length > 0) {
    var latestA = urineAbnormal.sort(function(a,b){
      return (b.recorded_at || '').localeCompare(a.recorded_at || '');
    })[0];
    var moreAText = urineAbnormal.length > 1 ? ' (พบทั้งหมด ' + urineAbnormal.length + ' ครั้ง)' : '';
    alerts.push(mkAlert('orange', '⚠️', 'ปัสสาวะสีผิดปกติ',
      _formatDateTimeTH(latestA.recorded_at) + ' (เวร' + (latestA.shift||'—') + ') · ลักษณะ: "' + (latestA.characteristics||'') + '"' + moreAText));
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 3: อาเจียน
  // ─────────────────────────────────────────────────────────
  var vomits = (fluids || []).filter(function(r) {
    return r.direction === 'output' && (r.fluid_type || '').trim() === 'อาเจียน';
  });
  if (vomits.length > 0) {
    // group ตามเวรเพื่อรายงาน
    var vomitShiftBuckets = {};
    vomits.forEach(function(r) {
      if (!r.recorded_at || !r.shift) return;
      var dateKey = r.recorded_at.slice(0,10) + '|' + r.shift;
      if (!vomitShiftBuckets[dateKey]) vomitShiftBuckets[dateKey] = 0;
      vomitShiftBuckets[dateKey]++;
    });
    var vomitListHtml = Object.keys(vomitShiftBuckets).sort(function(a,b){ return b.localeCompare(a); }).slice(0,3).map(function(k) {
      var p = k.split('|');
      return 'เวร' + p[1] + ' ' + _formatDateTH(p[0]) + ': ' + vomitShiftBuckets[k] + ' ครั้ง';
    }).join('<br>');
    var moreVomit = Object.keys(vomitShiftBuckets).length > 3 ? '<br>(และอีก ' + (Object.keys(vomitShiftBuckets).length - 3) + ' เวร)' : '';
    alerts.push(mkAlert('red', '🆘', 'พบอาเจียน', vomitListHtml + moreVomit + '<br>ควรเฝ้าระวัง'));
  } else {
    alerts.push(mkAlert('green', '✓', 'ไม่พบอาเจียน', 'ไม่มีบันทึกอาเจียนในช่วงที่เลือก'));
  }

  // ─────────────────────────────────────────────────────────
  // กรอง: แสดงเฉพาะ 🟠 ส้ม และ 🔴 แดง (ตามที่อ้นขอ)
  // ─────────────────────────────────────────────────────────
  var filtered = alerts.filter(function(a) {
    return a.level === 'red' || a.level === 'orange';
  });

  // ─────────────────────────────────────────────────────────
  // เรียงตามความรุนแรง: red → orange
  // ─────────────────────────────────────────────────────────
  var order = { red: 0, orange: 1 };
  filtered.sort(function(a, b) { return order[a.level] - order[b.level]; });

  // ถ้าไม่มี alert ผิดปกติ → แสดงข้อความ "ปกติ" สั้นๆ
  if (filtered.length === 0) {
    var okDiv = document.createElement('div');
    okDiv.style.cssText = 'background:#ecf9f0;border-radius:8px;padding:12px 14px;border-left:5px solid #27ae60;color:#1d8c4f;display:flex;gap:10px;font-size:13px;line-height:1.5';
    okDiv.innerHTML = '<div style="font-size:22px;line-height:1">✓</div>' +
                      '<div style="flex:1"><div style="font-weight:700">ไม่พบอาการผิดปกติ</div>' +
                      '<div style="font-size:12px;opacity:0.85;margin-top:2px">ทุกอย่างอยู่ในเกณฑ์ปกติ</div></div>';
    wrap.appendChild(okDiv);
    return wrap;
  }

  // Append filtered alerts
  filtered.forEach(function(a) {
    var div = document.createElement('div');
    div.innerHTML = a.html;
    wrap.appendChild(div.firstChild);
  });

  return wrap;
}

// ── Helper: นับเวรที่ผ่านมาตั้งแต่ "เวรของ event ล่าสุด" จนถึงเวรล่าสุดที่จบไปแล้ว ──
// ไม่นับเวรปัจจุบันที่ยังไม่จบ
function _countShiftsSinceLast(lastEventAt) {
  if (!lastEventAt) return 0;
  var lastDate = new Date(lastEventAt);
  var now = new Date();
  if (isNaN(lastDate.getTime())) return 0;

  // หาเวรของ lastEvent
  var lastShiftStart = _shiftStartOf(lastDate);  // วันที่+เวลาเริ่มเวรของ event
  // หาเวรปัจจุบัน (เวรที่กำลังเกิดอยู่ตอน "now")
  var nowShiftStart = _shiftStartOf(now);

  // นับจำนวน 12-hr blocks ระหว่าง lastShiftStart และ nowShiftStart
  // (lastShiftStart และ nowShiftStart เป็น "เวลาเริ่มเวร")
  var diffMs = nowShiftStart.getTime() - lastShiftStart.getTime();
  var blocks = Math.round(diffMs / (12 * 3600 * 1000));
  // blocks = 0 → อยู่เวรเดียวกัน (เพิ่งเกิด) = ไม่ถ่ายมา 0 เวร
  // blocks = 1 → ผ่านมา 1 เวร แต่เวรปัจจุบันยังไม่จบ → ไม่นับ → ไม่ถ่ายมา 0 เวร
  // เราต้องการ "เวรที่จบไปแล้วและไม่มี event" = blocks - 1 (ถ้า blocks ≥ 1)
  if (blocks <= 0) return 0;
  return blocks - 1;  // ไม่นับเวรปัจจุบัน (ตามที่อ้นขอ — Q2.3)
}

// ── Helper: เวลาเริ่มเวรของ Date นี้ ──
// เช้า: 07:00 ของวันนั้น
// ดึก: 19:00 ของวันก่อนหน้า (ถ้า hour < 7) หรือ 19:00 ของวันเดียวกัน (ถ้า hour >= 19)
function _shiftStartOf(d) {
  var hour = d.getHours();
  var year = d.getFullYear(), month = d.getMonth(), day = d.getDate();
  if (hour >= 7 && hour < 19) {
    return new Date(year, month, day, 7, 0, 0, 0);  // เวรเช้า
  } else if (hour >= 19) {
    return new Date(year, month, day, 19, 0, 0, 0);  // เวรดึกของวันเดียวกัน
  } else {
    return new Date(year, month, day - 1, 19, 0, 0, 0);  // เวรดึกของเมื่อวาน
  }
}

// ── Helper: format date เป็น dd/mm/yyyy ──
function _formatDateTH(s) {
  if (!s) return '—';
  var p = s.split('-');
  if (p.length !== 3) return s;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// ── Helper: format datetime ──
function _formatDateTimeTH(s) {
  if (!s) return '—';
  return _formatDateTH(s.slice(0,10)) + ' ' + s.slice(11,16);
}

function _openExcretionModal(rec, patId, today) {
  var isEdit = !!rec;
  var title = isEdit ? 'แก้ไขปัสสาวะ/อุจจาระ' : 'บันทึกปัสสาวะ/อุจจาระ';
  // ── Issue 1 Fix: เก็บค่าวันที่ default — ใช้จาก rec ถ้า edit, else ใช้ today (อาจเป็น dateFrom ของ filter) ──
  var todayStr = new Date().toISOString().slice(0, 10);
  var dateVal = (rec && rec.recorded_at) ? rec.recorded_at.slice(0,10) : (today || todayStr);
  var nowStr = (rec && rec.recorded_at) ? rec.recorded_at.slice(11,16) : new Date().toTimeString().slice(0,5);
  var shiftVal = (rec && rec.shift) ? rec.shift : '';
  var typeVal = (rec && rec.type) ? rec.type : 'urine';
  var countVal = (rec && rec.count) ? rec.count : '';
  var volVal = (rec && rec.volume_ml) ? rec.volume_ml : '';
  var charVal = (rec && rec.characteristics) ? rec.characteristics : '';
  var noteVal = (rec && rec.note) ? rec.note : '';

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:8px;padding:24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto';

  var h3 = document.createElement('h5');
  h3.textContent = title;
  modal.appendChild(h3);

  var shiftOpts = ['เช้า','บ่าย','ดึก'];
  var typeOpts = [{v:'urine',l:'ปัสสาวะ'},{v:'stool',l:'อุจจาระ'}];

  function mkRow(labelTxt, inputEl) {
    var row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px';
    var lbl = document.createElement('label');
    lbl.style.cssText = 'display:block;font-size:13px;margin-bottom:3px;font-weight:500';
    lbl.textContent = labelTxt;
    row.appendChild(lbl);
    row.appendChild(inputEl);
    return row;
  }
  function mkInput(type, val, placeholder) {
    var inp = document.createElement('input');
    inp.type = type; inp.value = val || ''; inp.placeholder = placeholder || '';
    inp.className = 'form-control form-control-sm';
    return inp;
  }
  function mkSelect(opts, val) {
    var sel = document.createElement('select');
    sel.className = 'form-control form-control-sm';
    opts.forEach(function(o) {
      var opt = document.createElement('option');
      var v = typeof o === 'object' ? o.v : o;
      var l = typeof o === 'object' ? o.l : o;
      opt.value = v; opt.textContent = l;
      if (v === val) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  var inpDate = mkInput('date', dateVal);
  var inpTime = mkInput('time', nowStr);
  var selShift = mkSelect(shiftOpts, shiftVal);
  var selType = mkSelect(typeOpts, typeVal);
  var inpCount = mkInput('number', countVal, 'จำนวนครั้ง');
  var inpVol = mkInput('number', volVal, 'ปริมาณ ml');
  var inpChar = mkInput('text', charVal, 'ลักษณะ');
  var inpNote = mkInput('text', noteVal, 'หมายเหตุ');

  // urine ซ่อน stool count ซ่อน vol
  var rowVol = mkRow('ปริมาณ (ml) - เฉพาะปัสสาวะ', inpVol);
  function toggleFields() {
    var t = selType.value;
    rowVol.style.display = t === 'urine' ? '' : 'none';
  }
  selType.addEventListener('change', toggleFields);
  toggleFields();

  modal.appendChild(mkRow('วันที่', inpDate));
  modal.appendChild(mkRow('เวลา', inpTime));
  modal.appendChild(mkRow('เวร', selShift));
  modal.appendChild(mkRow('ประเภท', selType));
  modal.appendChild(mkRow('จำนวนครั้ง', inpCount));
  modal.appendChild(rowVol);
  modal.appendChild(mkRow('ลักษณะ', inpChar));
  modal.appendChild(mkRow('หมายเหตุ', inpNote));

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn btn-primary btn-sm';
  btnSave.textContent = 'บันทึก';
  var btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-secondary btn-sm';
  btnCancel.textContent = 'ยกเลิก';
  btnRow.appendChild(btnSave);
  btnRow.appendChild(btnCancel);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  btnCancel.addEventListener('click', function() { document.body.removeChild(overlay); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

  btnSave.addEventListener('click', function() {
    var dateValSel = inpDate.value || dateVal;
    var timeVal = inpTime.value || '00:00';
    if (!dateValSel) { customAlert('กรุณาเลือกวันที่'); return; }
    var _dObj1 = new Date(dateValSel + 'T' + timeVal + ':00');
    if (isNaN(_dObj1.getTime())) { customAlert('วันที่/เวลาไม่ถูกต้อง'); return; }
    var dateTime = new Date(_dObj1.getTime() - _dObj1.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + 'Z';
    var user = (window._currentUser && window._currentUser.username) ? window._currentUser.username : 'user';
    var payload = {
      patient_id: patId,
      recorded_at: dateTime,
      shift: selShift.value,
      type: selType.value,
      count: parseInt(inpCount.value) || null,
      volume_ml: selType.value === 'urine' ? (parseFloat(inpVol.value) || null) : null,
      characteristics: inpChar.value || null,
      note: inpNote.value || null,
      recorded_by: user
    };
    // R4-005 fix: ต้องมีค่าจริงอย่างน้อย 1 (count, volume, characteristics, หรือ note)
    if (!payload.count && !payload.volume_ml && !payload.characteristics && !payload.note) {
      customAlert('กรุณาระบุข้อมูลอย่างน้อย 1 อย่าง (จำนวนครั้ง, ปริมาณ, ลักษณะ หรือ note)');
      return;
    }
    var prom = isEdit
      ? supa.from('patient_excretions').update(payload).eq('id', rec.id)
      : supa.from('patient_excretions').insert(payload);
    prom.then(function(res) {
      if (res.error) { customAlert('บันทึกไม่สำเร็จ: ' + res.error.message); return; }
      document.body.removeChild(overlay);
      switchPatTab('excretion');
    });
  });
}

async function _deleteExcretion(id, patId) {
  if (!(await customConfirm('ยืนยันลบรายการนี้?'))) return;
  supa.from('patient_excretions').delete().eq('id', id).then(function(res) {
    if (res.error) { customAlert('ลบไม่สำเร็จ: ' + res.error.message); return; }
    switchPatTab('excretion');
  });
}

function _openFluidModal(rec, patId, direction, today) {
  var isEdit = !!rec;
  var isIntake = direction === 'intake';
  var title = isEdit
    ? ('แก้ไขน้ำ' + (isIntake ? 'เข้า' : 'ออก'))
    : ('บันทึกน้ำ' + (isIntake ? 'เข้า' : 'ออก'));
  // ── Issue 1 Fix: เก็บค่าวันที่ default — ใช้จาก rec ถ้า edit, else ใช้ today (อาจเป็น dateFrom ของ filter) ──
  var todayStr = new Date().toISOString().slice(0, 10);
  var dateVal = (rec && rec.recorded_at) ? rec.recorded_at.slice(0,10) : (today || todayStr);
  var nowStr = (rec && rec.recorded_at) ? rec.recorded_at.slice(11,16) : new Date().toTimeString().slice(0,5);
  var shiftVal = (rec && rec.shift) ? rec.shift : '';
  var typeVal = (rec && rec.fluid_type) ? rec.fluid_type : '';
  var volVal = (rec && rec.volume_ml) ? rec.volume_ml : '';
  var noteVal = (rec && rec.note) ? rec.note : '';

  var intakeSuggestions = ['น้ำดื่ม','อาหารเหลว','นม','น้ำชา','น้ำหวาน','Tube feeding','ยาน้ำ'];
  var outputSuggestions = ['อาเจียน','Drainage','เลือด','เหงื่อใสสวน','อื่นๆ'];
  var suggestions = isIntake ? intakeSuggestions : outputSuggestions;

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:8px;padding:24px;width:440px;max-width:95vw';

  var h3 = document.createElement('h5');
  h3.textContent = title;
  modal.appendChild(h3);

  var shiftOpts = ['เช้า','บ่าย','ดึก'];

  function mkRow2(labelTxt, inputEl) {
    var row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px';
    var lbl = document.createElement('label');
    lbl.style.cssText = 'display:block;font-size:13px;margin-bottom:3px;font-weight:500';
    lbl.textContent = labelTxt;
    row.appendChild(lbl);
    row.appendChild(inputEl);
    return row;
  }
  function mkSelect2(opts, val) {
    var sel = document.createElement('select');
    sel.className = 'form-control form-control-sm';
    opts.forEach(function(o) {
      var opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      if (o === val) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  var inpDate = document.createElement('input');
  inpDate.type = 'date'; inpDate.value = dateVal; inpDate.className = 'form-control form-control-sm';
  var inpTime = document.createElement('input');
  inpTime.type = 'time'; inpTime.value = nowStr; inpTime.className = 'form-control form-control-sm';
  var selShift = mkSelect2(shiftOpts, shiftVal);

  // datalist for fluid type
  var dlId = 'fluid-type-dl-' + Date.now();
  var dl = document.createElement('datalist');
  dl.id = dlId;
  suggestions.forEach(function(s) {
    var opt = document.createElement('option');
    opt.value = s;
    dl.appendChild(opt);
  });
  var inpType = document.createElement('input');
  inpType.type = 'text'; inpType.value = typeVal;
  inpType.placeholder = isIntake ? 'เช่น น้ำดื่ม, Tube feeding...' : 'เช่น อาเจียน, Drainage...';
  inpType.setAttribute('list', dlId);
  inpType.className = 'form-control form-control-sm';
  modal.appendChild(dl);

  var inpVol = document.createElement('input');
  inpVol.type = 'number'; inpVol.value = volVal; inpVol.placeholder = 'ml';
  inpVol.className = 'form-control form-control-sm';
  var inpNote = document.createElement('input');
  inpNote.type = 'text'; inpNote.value = noteVal; inpNote.placeholder = 'หมายเหตุ';
  inpNote.className = 'form-control form-control-sm';

  modal.appendChild(mkRow2('วันที่', inpDate));
  modal.appendChild(mkRow2('เวลา', inpTime));
  modal.appendChild(mkRow2('เวร', selShift));
  modal.appendChild(mkRow2('ประเภทน้ำ (เลือกหรือพิมพ์เอง)', inpType));
  modal.appendChild(mkRow2('ปริมาณ (ml)', inpVol));
  modal.appendChild(mkRow2('หมายเหตุ', inpNote));

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px';
  var btnSave = document.createElement('button');
  btnSave.className = 'btn btn-primary btn-sm';
  btnSave.textContent = 'บันทึก';
  var btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-secondary btn-sm';
  btnCancel.textContent = 'ยกเลิก';
  btnRow.appendChild(btnSave); btnRow.appendChild(btnCancel);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  btnCancel.addEventListener('click', function() { document.body.removeChild(overlay); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

  btnSave.addEventListener('click', function() {
    var dateValSel = inpDate.value || dateVal;
    var timeVal = inpTime.value || '00:00';
    if (!dateValSel) { customAlert('กรุณาเลือกวันที่'); return; }
    var _dObj2 = new Date(dateValSel + 'T' + timeVal + ':00');
    if (isNaN(_dObj2.getTime())) { customAlert('วันที่/เวลาไม่ถูกต้อง'); return; }
    var dateTime = new Date(_dObj2.getTime() - _dObj2.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + 'Z';
    var user = (window._currentUser && window._currentUser.username) ? window._currentUser.username : 'user';
    var payload = {
      patient_id: patId,
      recorded_at: dateTime,
      shift: selShift.value,
      direction: direction,
      fluid_type: inpType.value || null,
      volume_ml: parseFloat(inpVol.value) || null,
      note: inpNote.value || null,
      recorded_by: user
    };
    // R4-006 fix: ต้องมี volume หรือ type หรือ note อย่างน้อย 1 อย่าง
    if (!payload.volume_ml && !payload.fluid_type && !payload.note) {
      customAlert('กรุณาระบุข้อมูลอย่างน้อย 1 อย่าง (ปริมาณ, ประเภท หรือ note)');
      return;
    }
    var prom = isEdit
      ? supa.from('patient_fluid_records').update(payload).eq('id', rec.id)
      : supa.from('patient_fluid_records').insert(payload);
    prom.then(function(res) {
      if (res.error) { customAlert('บันทึกไม่สำเร็จ: ' + res.error.message); return; }
      document.body.removeChild(overlay);
      switchPatTab('excretion');
    });
  });
}

async function _deleteFluidRecord(id, patId) {
  if (!(await customConfirm('ยืนยันลบรายการนี้?'))) return;
  supa.from('patient_fluid_records').delete().eq('id', id).then(function(res) {
    if (res.error) { customAlert('ลบไม่สำเร็จ: ' + res.error.message); return; }
    switchPatTab('excretion');
  });
}

// ── List ประเภทน้ำเข้า ──
var _INTAKE_TYPES = ['น้ำ', 'อาหารสายยาง', 'ยา', 'IV', 'อื่นๆ'];
// ── Icons + label สำหรับ chips ──
var _INTAKE_TYPE_META = {
  'น้ำ':           { icon: '💧', label: 'น้ำ' },
  'อาหารสายยาง':   { icon: '🥣', label: 'อาหารสายยาง' },
  'ยา':            { icon: '💊', label: 'ยา' },
  'IV':            { icon: '💉', label: 'IV' },
  'อื่นๆ':         { icon: '📝', label: 'อื่นๆ (ระบุ)' }
};

// ── Legacy mapping: ค่าเก่าใน DB ที่ต้อง map เป็น 'น้ำ' (สำหรับ edit mode) ──
var _INTAKE_LEGACY_NAMES = ['น้ำดื่ม', 'น้ำเปล่า'];

// ═══════════════════════════════════════════════════════════════
// Multi-row Intake Modal
// ═══════════════════════════════════════════════════════════════
// rec = null → เพิ่มใหม่ (1 row ว่าง)
// rec = patient_fluid_records row → edit mode
function _openIntakeModal(rec, patId, today) {
  var isEdit = !!rec;
  var todayStr = new Date().toISOString().slice(0, 10);
  var nowStr = new Date().toTimeString().slice(0,5);

  // Shared values
  var sharedDate = isEdit && rec.recorded_at ? rec.recorded_at.slice(0,10) : (today || todayStr);
  var sharedTime = isEdit && rec.recorded_at ? rec.recorded_at.slice(11,16) : nowStr;
  var sharedShift = isEdit && rec.shift ? rec.shift : _shiftFromTime(sharedTime);

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:18px;width:460px;max-width:95vw;max-height:92vh;overflow-y:auto;';

  var h3 = document.createElement('div');
  h3.style.cssText = 'font-size:16px;font-weight:700;color:var(--accent2);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);';
  h3.textContent = isEdit ? '💧 แก้ไขน้ำเข้า' : '💧 เพิ่มน้ำเข้า';
  modal.appendChild(h3);

  // Shared header
  var sharedSec = document.createElement('div');
  sharedSec.className = 'mr-shared';
  var sharedLabel = document.createElement('div');
  sharedLabel.className = 'mr-shared-label';
  sharedLabel.textContent = '📍 ใช้กับทุกรายการ';
  sharedSec.appendChild(sharedLabel);

  var dtGrid = document.createElement('div');
  dtGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;';
  var inpDate = document.createElement('input');
  inpDate.type = 'date'; inpDate.value = sharedDate; inpDate.className = 'form-control';
  inpDate.style.cssText = 'height:44px;font-size:14px;';
  var inpTime = document.createElement('input');
  inpTime.type = 'time'; inpTime.value = sharedTime; inpTime.className = 'form-control';
  inpTime.style.cssText = 'height:44px;font-size:14px;';
  var btnNow = document.createElement('button');
  btnNow.type = 'button'; btnNow.className = 'btn-now'; btnNow.textContent = '🕐 ตอนนี้';
  btnNow.addEventListener('click', function() {
    inpDate.value = new Date().toISOString().slice(0,10);
    inpTime.value = new Date().toTimeString().slice(0,5);
    selShift.value = _shiftFromTime(inpTime.value);
  });
  dtGrid.appendChild(inpDate); dtGrid.appendChild(inpTime); dtGrid.appendChild(btnNow);
  sharedSec.appendChild(dtGrid);

  var selShift = document.createElement('select');
  selShift.className = 'form-control';
  selShift.style.cssText = 'height:44px;font-size:14px;';
  ['เช้า (07:00–18:59)', 'ดึก (19:00–06:59)'].forEach(function(label, i) {
    var opt = document.createElement('option');
    opt.value = i === 0 ? 'เช้า' : 'ดึก';
    opt.textContent = label;
    selShift.appendChild(opt);
  });
  selShift.value = sharedShift;
  inpTime.addEventListener('change', function() { selShift.value = _shiftFromTime(inpTime.value); });
  sharedSec.appendChild(selShift);
  modal.appendChild(sharedSec);

  var rowsContainer = document.createElement('div');
  modal.appendChild(rowsContainer);

  var rows = [];

  function _renumberBadges() {
    rows.forEach(function(r, i) {
      if (r.badgeEl) r.badgeEl.textContent = (r.kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (i + 1);
    });
  }

  function _createRowUI(opts) {
    var kind = opts.kind || 'new';
    var dbRow = opts.dbRow || null;

    // initial values
    // activeTypes: Set ของประเภทมาตรฐาน (น้ำ/อาหารสายยาง/ยา/IV)
    // initOtherType: ชื่อประเภทที่อยู่นอก list มาตรฐาน
    var activeTypes = {}, initOtherType = '', initVol = '', initNote = '';
    if (dbRow) {
      var ftRaw = (dbRow.fluid_type || '').trim();
      // split by ',' รองรับ multi-select (เช่น "น้ำ, ยา")
      var parts = ftRaw.split(',').map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 0; });
      parts.forEach(function(p) {
        // Legacy mapping: "น้ำดื่ม"/"น้ำเปล่า" → "น้ำ"
        if (_INTAKE_LEGACY_NAMES.indexOf(p) >= 0) p = 'น้ำ';
        if (_INTAKE_TYPES.slice(0, 4).indexOf(p) >= 0) {
          activeTypes[p] = true;
        } else {
          // ค่าที่ไม่อยู่ใน list มาตรฐาน → เก็บใน "อื่นๆ"
          activeTypes['อื่นๆ'] = true;
          if (!initOtherType) initOtherType = p;
        }
      });
      initVol = dbRow.volume_ml || '';
      initNote = dbRow.note || '';
    }

    var rowEl = document.createElement('div');
    rowEl.className = 'mr-item intake' + (kind === 'edit' ? ' editing' : (rows.length > 0 ? ' new-row' : ''));

    var badge = document.createElement('div');
    badge.className = 'mr-badge' + (kind === 'edit' ? ' editing' : '');
    badge.textContent = (kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (rows.length + 1);
    rowEl.appendChild(badge);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mr-del';
    delBtn.textContent = '✕';
    delBtn.style.display = 'none';
    delBtn.addEventListener('click', function() {
      var idx = rows.indexOf(rowState);
      if (idx >= 0) {
        rows.splice(idx, 1);
        rowEl.parentNode.removeChild(rowEl);
        _renumberBadges();
        _updateDelButtons();
        _updateSaveBtnText();
      }
    });
    rowEl.appendChild(delBtn);

    // Type chips (multi-select)
    var typeWrap = document.createElement('div');
    typeWrap.style.cssText = 'margin-top:6px;';
    var typeLbl = document.createElement('div');
    typeLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;';
    typeLbl.innerHTML = 'ประเภท <span style="color:var(--text3);font-weight:400;font-size:10px;">(เลือกได้หลายอย่าง)</span>';
    typeWrap.appendChild(typeLbl);

    // chips grid — 2 cols, "อื่นๆ" span 2 cols
    var typeChips = document.createElement('div');
    typeChips.className = 'type-chips';
    typeChips.style.cssText = 'grid-template-columns:1fr 1fr;';
    var typeChipEls = {};
    _INTAKE_TYPES.forEach(function(t) {
      var meta = _INTAKE_TYPE_META[t];
      var chip = document.createElement('div');
      chip.className = 'type-chip' + (activeTypes[t] ? ' active' : '');
      chip.innerHTML = '<span class="icon">' + meta.icon + '</span><span>' + meta.label + '</span>';
      if (t === 'อื่นๆ') chip.style.gridColumn = 'span 2';
      chip.addEventListener('click', function() {
        if (activeTypes[t]) {
          delete activeTypes[t];
          chip.classList.remove('active');
        } else {
          activeTypes[t] = true;
          chip.classList.add('active');
        }
        // Toggle other input
        otherWrap.style.display = activeTypes['อื่นๆ'] ? '' : 'none';
      });
      typeChips.appendChild(chip);
      typeChipEls[t] = chip;
    });
    typeWrap.appendChild(typeChips);

    // ระบุประเภท (เฉพาะ อื่นๆ)
    var otherWrap = document.createElement('div');
    otherWrap.className = 'cond-field-inline';
    var otherLbl = document.createElement('div');
    otherLbl.style.cssText = 'font-size:10px;font-weight:600;color:var(--text2);margin-bottom:3px;';
    otherLbl.textContent = 'ระบุประเภท';
    var inpOther = document.createElement('input');
    inpOther.type = 'text'; inpOther.value = initOtherType;
    inpOther.placeholder = 'เช่น น้ำผลไม้ปั่น, โอวัลติน';
    inpOther.className = 'form-control'; inpOther.style.cssText = 'height:40px;';
    otherWrap.appendChild(otherLbl); otherWrap.appendChild(inpOther);
    otherWrap.style.display = activeTypes['อื่นๆ'] ? '' : 'none';
    typeWrap.appendChild(otherWrap);
    rowEl.appendChild(typeWrap);

    // ปริมาณ ml
    var volWrap = document.createElement('div');
    volWrap.style.cssText = 'margin-top:8px;';
    var volLbl = document.createElement('div');
    volLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    volLbl.textContent = 'ปริมาณ (ml)';
    var inpVol = document.createElement('input');
    inpVol.type = 'number'; inpVol.min = '0'; inpVol.setAttribute('inputmode','numeric');
    inpVol.value = initVol;
    inpVol.className = 'form-control'; inpVol.style.cssText = 'height:40px;';
    volWrap.appendChild(volLbl); volWrap.appendChild(inpVol);
    rowEl.appendChild(volWrap);

    // หมายเหตุ
    var noteWrap = document.createElement('div');
    noteWrap.style.cssText = 'margin-top:8px;';
    var noteLbl = document.createElement('div');
    noteLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    noteLbl.textContent = 'หมายเหตุ (ไม่บังคับ)';
    var inpNote = document.createElement('input');
    inpNote.type = 'text'; inpNote.value = initNote;
    inpNote.className = 'form-control'; inpNote.style.cssText = 'height:40px;';
    noteWrap.appendChild(noteLbl); noteWrap.appendChild(inpNote);
    rowEl.appendChild(noteWrap);

    var rowState = {
      kind: kind,
      dbRow: dbRow,
      container: rowEl,
      badgeEl: badge,
      delBtn: delBtn,
      getValues: function() {
        // รวมประเภทที่ติด ✓ — เรียงตาม _INTAKE_TYPES order
        var selected = [];
        _INTAKE_TYPES.forEach(function(t) {
          if (!activeTypes[t]) return;
          if (t === 'อื่นๆ') {
            var custom = (inpOther.value || '').trim();
            if (custom) selected.push(custom);
          } else {
            selected.push(t);
          }
        });
        var finalType = selected.join(', ');
        // hasOther: true เมื่อมี chip อื่นๆ active แต่ยังไม่ระบุประเภท
        var hasOtherUnfilled = !!activeTypes['อื่นๆ'] && !(inpOther.value || '').trim();
        return {
          hasAny: selected.length > 0,
          hasOtherUnfilled: hasOtherUnfilled,
          fluid_type: finalType,
          volume_ml: parseFloat(inpVol.value) || null,
          note: (inpNote.value || '').trim() || null
        };
      }
    };

    return rowState;
  }

  function _addRow(opts) {
    var rowState = _createRowUI(opts || {});
    rows.push(rowState);
    rowsContainer.appendChild(rowState.container);
    _renumberBadges();
    _updateDelButtons();
    _updateSaveBtnText();
    return rowState;
  }

  function _updateDelButtons() {
    rows.forEach(function(r) {
      r.delBtn.style.display = (rows.length === 1) ? 'none' : '';
    });
  }

  function _updateSaveBtnText() {
    var editCount = rows.filter(function(r){ return r.kind === 'edit'; }).length;
    var newCount = rows.filter(function(r){ return r.kind === 'new'; }).length;
    var parts = [];
    if (editCount > 0) parts.push(editCount + ' แก้');
    if (newCount > 0) parts.push(newCount + ' ใหม่');
    if (typeof btnSave !== 'undefined' && btnSave) btnSave.textContent = '💾 บันทึก (' + parts.join(' + ') + ')';
  }

  // Initial rows
  if (isEdit) {
    _addRow({ kind: 'edit', dbRow: rec });
  } else {
    _addRow({ kind: 'new' });
  }

  // ปุ่ม เพิ่มรายการ
  var btnAddRow = document.createElement('button');
  btnAddRow.type = 'button';
  btnAddRow.className = 'mr-add-row';
  btnAddRow.textContent = '➕ เพิ่มรายการ';
  btnAddRow.addEventListener('click', function() { _addRow({ kind: 'new' }); });
  modal.appendChild(btnAddRow);

  // ปุ่มล่างสุด
  var btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:8px;margin-top:16px;';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-ghost';
  btnCancel.style.cssText = 'flex:1;height:44px;font-size:14px;';
  btnCancel.textContent = 'ยกเลิก';
  var btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.style.cssText = 'flex:1;height:44px;font-size:14px;font-weight:600;';
  btnSave.textContent = '💾 บันทึก';
  btnWrap.appendChild(btnCancel); btnWrap.appendChild(btnSave);
  modal.appendChild(btnWrap);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _updateSaveBtnText();

  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  // Save
  btnSave.addEventListener('click', function() {
    var dateValSel = inpDate.value;
    var timeValSel = inpTime.value || '00:00';
    if (!dateValSel) { customAlert('กรุณาเลือกวันที่'); return; }
    var dObj = new Date(dateValSel + 'T' + timeValSel + ':00');
    if (isNaN(dObj.getTime())) { customAlert('วันที่/เวลาไม่ถูกต้อง'); return; }
    var dateTime = new Date(dObj.getTime() - dObj.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + 'Z';
    var shiftVal = selShift.value;
    var user = (window._currentUser && window._currentUser.username) ? window._currentUser.username : 'user';

    // Validate ทุก row
    var operations = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var v = r.getValues();
      if (!v.hasAny) {
        customAlert('รายการ ' + (i+1) + ': กรุณาเลือกประเภทอย่างน้อย 1 อย่าง');
        return;
      }
      if (v.hasOtherUnfilled) {
        customAlert('รายการ ' + (i+1) + ': กรุณาระบุประเภท "อื่นๆ"');
        return;
      }
      if (!v.volume_ml && !v.note) {
        customAlert('รายการ ' + (i+1) + ': กรุณาระบุปริมาณ (ml) หรือหมายเหตุ');
        return;
      }
      operations.push({ rowState: r, values: v });
    }

    // Execute
    var promises = operations.map(function(op) {
      var v = op.values;
      var rs = op.rowState;
      var payload = {
        patient_id: patId,
        recorded_at: dateTime,
        shift: shiftVal,
        direction: 'intake',
        fluid_type: v.fluid_type,
        volume_ml: v.volume_ml,
        note: v.note,
        recorded_by: user
      };
      if (rs.kind === 'edit' && rs.dbRow) {
        return supa.from('patient_fluid_records').update(payload).eq('id', rs.dbRow.id);
      } else {
        return supa.from('patient_fluid_records').insert(payload);
      }
    });

    btnSave.disabled = true;
    btnSave.textContent = 'กำลังบันทึก...';

    Promise.allSettled(promises.map(function(p){
      return Promise.resolve(p).then(function(res){
        if (res && res.error) throw res.error;
        return res;
      });
    })).then(function(results) {
      var fails = results.filter(function(r){ return r.status === 'rejected'; });
      if (fails.length > 0) {
        var msgs = fails.map(function(f, i){ return 'รายการ ' + (i+1) + ': ' + (f.reason.message || f.reason); }).join('\n');
        customAlert('บันทึกไม่สำเร็จบางรายการ:\n' + msgs);
        btnSave.disabled = false;
        _updateSaveBtnText();
        return;
      }
      close();
      switchPatTab('excretion');
    });
  });
}


// ===== CONTRACT FILES MODAL =====
async function openContractFilesModal(patientId, patientName) {
  if (!canSeePrice()) { toast('ไม่มีสิทธิ์ดูไฟล์สัญญา', 'warning'); return; }
  // สร้าง overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;width:520px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;';
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
  header.innerHTML = '<div><div style="font-weight:600;font-size:15px;">📄 ไฟล์สัญญา</div><div style="font-size:12px;color:#6b7280;margin-top:2px;">' + (patientName||'') + ' — PDF หรือรูปภาพ ไม่เกิน 20MB</div></div>';
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = 'background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;padding:0 4px;line-height:1;';
  closeBtn.onclick = () => document.body.removeChild(overlay);
  header.appendChild(closeBtn);
  
  // Upload bar
  const uploadBar = document.createElement('div');
  uploadBar.style.cssText = 'padding:12px 20px;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;flex-shrink:0;';
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,image/*';
  fileInput.multiple = true;
  fileInput.style.cssText = 'flex:1;font-size:13px;';
  
  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.placeholder = 'หมายเหตุ (ไม่จำเป็น)';
  noteInput.style.cssText = 'width:140px;font-size:13px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;';
  
  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = '↑ อัปโหลด';
  uploadBtn.style.cssText = 'padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;';
  uploadBar.appendChild(fileInput); uploadBar.appendChild(noteInput); uploadBar.appendChild(uploadBtn);
  
  // File list area
  const listArea = document.createElement('div');
  listArea.style.cssText = 'flex:1;overflow-y:auto;padding:12px 20px;min-height:120px;';
  
  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:12px 20px;border-top:1px solid #e5e7eb;text-align:right;flex-shrink:0;';
  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'ปิด';
  doneBtn.style.cssText = 'padding:7px 20px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:pointer;';
  doneBtn.onclick = () => document.body.removeChild(overlay);
  footer.appendChild(doneBtn);
  
  box.appendChild(header); box.appendChild(uploadBar); box.appendChild(listArea); box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  // ฟังก์ชันโหลดรายการไฟล์
  async function loadFiles() {
    listArea.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:8px 0;">กำลังโหลด...</div>';
    const { data, error } = await supa.from('patient_contract_files')
      .select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) { listArea.innerHTML = '<div style="color:red;font-size:13px;">โหลดไม่ได้: ' + error.message + '</div>'; return; }
    if (!data || data.length === 0) {
      listArea.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:16px 0;text-align:center;">ยังไม่มีไฟล์สัญญา — กดอัปโหลดเพื่อเพิ่ม</div>'; return;
    }
    listArea.innerHTML = '';
    data.forEach(async f => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f9fafb;border-radius:8px;margin-bottom:6px;gap:10px;';
      const isPdf = (f.file_type||'').includes('pdf') || f.file_name.endsWith('.pdf');
      const badge = document.createElement('div');
      badge.style.cssText = 'width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;' + (isPdf ? 'background:#fee2e2;color:#b91c1c;' : 'background:#dcfce7;color:#15803d;');
      badge.textContent = isPdf ? 'PDF' : 'IMG';
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      const kb = f.file_size ? (f.file_size > 1048576 ? (f.file_size/1048576).toFixed(1)+' MB' : Math.round(f.file_size/1024)+' KB') : '';
      const dt = f.created_at ? new Date(f.created_at).toLocaleDateString('th-TH') : '';
      info.innerHTML = '<div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+f.file_name+'">'+f.file_name+'</div>'
        + '<div style="font-size:11px;color:#6b7280;">' + [kb, dt, f.note].filter(Boolean).join('  ·  ') + '</div>';
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'เปิดดู';
      viewBtn.style.cssText = 'padding:4px 10px;font-size:11px;border:1px solid #d1d5db;border-radius:5px;background:#fff;cursor:pointer;';
      viewBtn.onclick = async () => {
        const { data: urlData } = await supa.storage.from('documents').createSignedUrl(f.file_url, 60);
        if (urlData?.signedUrl) window.open(urlData.signedUrl, '_blank');
        else customAlert('ไม่สามารถเปิดได้');
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = 'ลบ';
      delBtn.style.cssText = 'padding:4px 10px;font-size:11px;border:1px solid #fca5a5;border-radius:5px;background:#fee2e2;color:#b91c1c;cursor:pointer;';
      delBtn.onclick = async () => {
        if (!(await customConfirm('ลบไฟล์ "' + f.file_name + '" ?'))) return;
        await supa.storage.from('documents').remove([f.file_url]);
        await supa.from('patient_contract_files').delete().eq('id', f.id);
        loadFiles();
      };
      btns.appendChild(viewBtn); btns.appendChild(delBtn);
      row.appendChild(badge); row.appendChild(info); row.appendChild(btns);
      listArea.appendChild(row);
    });
  }
  
  // Upload handler
  uploadBtn.onclick = async () => {
    if (!fileInput.files || fileInput.files.length === 0) { customAlert('กรุณาเลือกไฟล์ก่อน'); return; }
    uploadBtn.disabled = true; uploadBtn.textContent = 'กำลังอัปโหลด...';
    const note = noteInput.value.trim();
    for (const file of fileInput.files) {
      if (file.size > 20971520) { customAlert(file.name + ' ใหญ่เกิน 20MB'); continue; }
      const ext = file.name.split('.').pop();
      const path = 'contracts/' + patientId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const { error: upErr } = await supa.storage.from('documents').upload(path, file, { upsert: false });
      if (upErr) { customAlert('อัปโหลดไม่ได้: ' + upErr.message); continue; }
      const { error: insErr } = await supa.from('patient_contract_files').insert({
        patient_id: patientId, file_name: file.name, file_url: path,
        file_size: file.size, file_type: file.type, note: note||null,
        uploaded_by: window._currentUser || 'user'
      });
      if (insErr) {
        // rollback: ลบไฟล์ที่อัปโหลดแล้ว เพื่อไม่ให้ลอย
        await supa.storage.from('documents').remove([path]).catch(()=>{});
        customAlert('บันทึกข้อมูลไฟล์ไม่สำเร็จ: ' + insErr.message);
        continue;
      }
    }
    fileInput.value = ''; noteInput.value = '';
    uploadBtn.disabled = false; uploadBtn.textContent = '↑ อัปโหลด';
    loadFiles();
  };
  
  loadFiles();
}


// ===== MEDICAL FILES SECTION =====
async function _renderMedicalFilesSection(patientId) {
  const sec = document.getElementById('med-files-section-' + patientId);
  if (!sec) return;
  const patObj = db.patients.find(function(x){ return x.id === patientId; }) || {};
  const pName = patObj.name || '';
  const { data, error } = await supa.from('patient_medical_files')
    .select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
  let rows = '';
  if (!error && data && data.length > 0) {
    rows = data.map(function(f) {
      const isPdf = (f.file_type||'').indexOf('pdf') > -1 || f.file_name.slice(-4) === '.pdf';
      const kb = f.file_size ? (f.file_size > 1048576 ? (f.file_size/1048576).toFixed(1)+' MB' : Math.round(f.file_size/1024)+' KB') : '';
      const dt = f.created_at ? new Date(f.created_at).toLocaleDateString('th-TH') : '';
      const meta = [kb,dt,f.note].filter(Boolean).join(' · ');
      const badgeStyle = isPdf ? 'background:#fee2e2;color:#b91c1c' : 'background:#dcfce7;color:#15803d';
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;">'
        + '<span style="font-size:10px;font-weight:600;padding:2px 5px;border-radius:4px;flex-shrink:0;' + badgeStyle + ';">' + (isPdf?'PDF':'IMG') + '</span>'
        + '<div style="flex:1;min-width:0;"><div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + f.file_name + '</div>'
        + '<div style="font-size:10px;color:#9ca3af;">' + meta + '</div></div>'
        + '<button class="_med-view-btn" data-url="' + f.file_url + '" style="font-size:10px;padding:2px 7px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;">เปิด</button>'
        + '</div>';
    }).join('');
  }
  const emptyMsg = (!error && data && data.length > 0) ? '' : '<div style="color:#9ca3af;font-size:12px;padding:4px 0;">ยังไม่มีไฟล์</div>';
  sec.innerHTML = '<div style="border-top:1px solid #e5e7eb;padding-top:10px;margin-top:4px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<div style="font-size:12px;font-weight:600;color:#374151;">📂 ไฟล์ประวัติการรักษา</div>'
    + '<button id="_med-files-open-' + patientId + '" class="_med-open-btn btn btn-sm btn-outline-primary" data-patid="' + patientId + '" style="font-size:11px;padding:3px 10px;">+ เพิ่ม / ดูไฟล์</button>'
    + '</div>' + emptyMsg + rows + '</div>';
  const openBtn = document.getElementById('_med-files-open-' + patientId);
  if (openBtn) {
    openBtn.addEventListener('click', function() { openMedicalFilesModal(patientId, pName); });
  }
  sec.querySelectorAll('._med-view-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      const url = this.getAttribute('data-url');
      const { data: ud } = await supa.storage.from('documents').createSignedUrl(url, 60);
      if (ud && ud.signedUrl) window.open(ud.signedUrl, '_blank');
      else customAlert('ไม่สามารถเปิดได้');
    });
  });
}

async function openMedicalFilesModal(patientId, patientName) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;width:520px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;';
  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
  const titleDiv = document.createElement('div');
  const t1 = document.createElement('div'); t1.style.cssText='font-weight:600;font-size:15px;'; t1.textContent='📂 ไฟล์ประวัติการรักษา';
  const t2 = document.createElement('div'); t2.style.cssText='font-size:12px;color:#6b7280;margin-top:2px;'; t2.textContent=(patientName||'')+' — PDF หรือรูปภาพ ไม่เกิน 20MB';
  titleDiv.appendChild(t1); titleDiv.appendChild(t2);
  const closeBtn = document.createElement('button');
  closeBtn.textContent='×'; closeBtn.style.cssText='background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;padding:0 4px;line-height:1;';
  closeBtn.onclick=function(){ document.body.removeChild(overlay); _renderMedicalFilesSection(patientId); };
  header.appendChild(titleDiv); header.appendChild(closeBtn);
  const uploadBar=document.createElement('div'); uploadBar.style.cssText='padding:12px 20px;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;flex-shrink:0;';
  const fileInput=document.createElement('input'); fileInput.type='file'; fileInput.accept='.pdf,image/*'; fileInput.multiple=true; fileInput.style.cssText='flex:1;font-size:13px;';
  const noteInput=document.createElement('input'); noteInput.type='text'; noteInput.placeholder='หมายเหตุ'; noteInput.style.cssText='width:130px;font-size:13px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;';
  const uploadBtn=document.createElement('button'); uploadBtn.textContent='↑ อัปโหลด'; uploadBtn.style.cssText='padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;';
  uploadBar.appendChild(fileInput); uploadBar.appendChild(noteInput); uploadBar.appendChild(uploadBtn);
  const listArea=document.createElement('div'); listArea.style.cssText='flex:1;overflow-y:auto;padding:12px 20px;min-height:120px;';
  const footer=document.createElement('div'); footer.style.cssText='padding:12px 20px;border-top:1px solid #e5e7eb;text-align:right;flex-shrink:0;';
  const doneBtn=document.createElement('button'); doneBtn.textContent='ปิด'; doneBtn.style.cssText='padding:7px 20px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:pointer;';
  doneBtn.onclick=function(){ document.body.removeChild(overlay); _renderMedicalFilesSection(patientId); };
  footer.appendChild(doneBtn);
  box.appendChild(header); box.appendChild(uploadBar); box.appendChild(listArea); box.appendChild(footer);
  overlay.appendChild(box); document.body.appendChild(overlay);
  async function loadFiles() {
    listArea.innerHTML='<div style="color:#9ca3af;font-size:13px;padding:8px 0;">กำลังโหลด...</div>';
    const {data,error}=await supa.from('patient_medical_files').select('*').eq('patient_id',patientId).order('created_at',{ascending:false});
    if(error){listArea.innerHTML='<div style="color:red;font-size:13px;">โหลดไม่ได้: '+error.message+'</div>';return;}
    if(!data||data.length===0){listArea.innerHTML='<div style="color:#9ca3af;font-size:13px;padding:16px 0;text-align:center;">ยังไม่มีไฟล์ — กดอัปโหลดเพื่อเพิ่ม</div>';return;}
    listArea.innerHTML='';
    data.forEach(function(f){
      const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f9fafb;border-radius:8px;margin-bottom:6px;gap:10px;';
      const isPdf=(f.file_type||'').indexOf('pdf')>-1||f.file_name.slice(-4)==='.pdf';
      const badge=document.createElement('div'); badge.style.cssText='width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;'+(isPdf?'background:#fee2e2;color:#b91c1c;':'background:#dcfce7;color:#15803d;'); badge.textContent=isPdf?'PDF':'IMG';
      const info=document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
      const kb=f.file_size?(f.file_size>1048576?(f.file_size/1048576).toFixed(1)+' MB':Math.round(f.file_size/1024)+' KB'):'';
      const dt=f.created_at?new Date(f.created_at).toLocaleDateString('th-TH'):'';
      const nameEl=document.createElement('div'); nameEl.style.cssText='font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; nameEl.title=f.file_name; nameEl.textContent=f.file_name;
      const metaEl=document.createElement('div'); metaEl.style.cssText='font-size:11px;color:#6b7280;'; metaEl.textContent=[kb,dt,f.note].filter(Boolean).join('  ·  ');
      info.appendChild(nameEl); info.appendChild(metaEl);
      const btns=document.createElement('div'); btns.style.cssText='display:flex;gap:6px;flex-shrink:0;';
      const viewBtn=document.createElement('button'); viewBtn.textContent='เปิดดู'; viewBtn.style.cssText='padding:4px 10px;font-size:11px;border:1px solid #d1d5db;border-radius:5px;background:#fff;cursor:pointer;';
      viewBtn.onclick=async function(){ const {data:u}=await supa.storage.from('documents').createSignedUrl(f.file_url,60); if(u&&u.signedUrl)window.open(u.signedUrl,'_blank'); else customAlert('ไม่สามารถเปิด'); };
      const delBtn=document.createElement('button'); delBtn.textContent='ลบ'; delBtn.style.cssText='padding:4px 10px;font-size:11px;border:1px solid #fca5a5;border-radius:5px;background:#fee2e2;color:#b91c1c;cursor:pointer;';
      delBtn.onclick=async function(){ if(!(await customConfirm('ลบไฟล์ "'+f.file_name+'" ?')))return; await supa.storage.from('documents').remove([f.file_url]); await supa.from('patient_medical_files').delete().eq('id',f.id); loadFiles(); };
      btns.appendChild(viewBtn); btns.appendChild(delBtn);
      row.appendChild(badge); row.appendChild(info); row.appendChild(btns); listArea.appendChild(row);
    });
  }
  uploadBtn.onclick=async function(){
    if(!fileInput.files||fileInput.files.length===0){customAlert('กรุณาเลือกไฟล์ก่อน');return;}
    uploadBtn.disabled=true; uploadBtn.textContent='กำลังอัปโหลด...';
    const note=noteInput.value.trim();
    for(const file of fileInput.files){
      if(file.size>20971520){customAlert(file.name+' ใหญ่เกิน 20MB');continue;}
      const path='medical/'+patientId+'/'+Date.now()+'_'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const {error:upErr}=await supa.storage.from('documents').upload(path,file,{upsert:false});
      if(upErr){customAlert('อัปโหลดไม่ได้: '+upErr.message);continue;}
      const {error:insErr} = await supa.from('patient_medical_files').insert({patient_id:patientId,file_name:file.name,file_url:path,file_size:file.size,file_type:file.type,note:note||null,uploaded_by:window._currentUser||'user'});
      if(insErr){
        await supa.storage.from('documents').remove([path]).catch(()=>{});
        customAlert('บันทึกข้อมูลไฟล์ไม่สำเร็จ: '+insErr.message);
        continue;
      }
    }
    fileInput.value=''; noteInput.value=''; uploadBtn.disabled=false; uploadBtn.textContent='↑ อัปโหลด'; loadFiles();
  };
  loadFiles();
}
