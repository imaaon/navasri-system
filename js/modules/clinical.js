// ===== CLINICAL MODULE =====

// ===== PHOTO PREVIEW =====
async function uploadPhotoToStorage(file, folder) {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supa.storage.from('images').upload(filename, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supa.storage.from('images').getPublicUrl(filename);
  return urlData.publicUrl;
}

function previewPhoto(type) {
  const input = document.getElementById(`${type}-photo-input`);
  const preview = document.getElementById(`${type}-photo-preview`);
  const dataEl = document.getElementById(`${type}-photo-data`);
  if (!input.files[0]) return;
  const objectUrl = URL.createObjectURL(input.files[0]);
  preview.innerHTML = `<img src="${objectUrl}" style="width:72px;height:72px;object-fit:cover;">`;
  dataEl.value = '__pending__';
  dataEl._pendingFile = input.files[0];
}

function previewItemPhoto() {
  const input = document.getElementById('item-photo-input');
  const preview = document.getElementById('item-photo-preview');
  const dataEl = document.getElementById('item-photo-data');
  if (!input.files[0]) return;
  const objectUrl = URL.createObjectURL(input.files[0]);
  preview.innerHTML = `<img src="${objectUrl}" style="width:80px;height:80px;object-fit:cover;">`;
  dataEl.value = '__pending__';
  dataEl._pendingFile = input.files[0];
}

function clearItemPhoto() {
  document.getElementById('item-photo-data').value = '';
  document.getElementById('item-photo-preview').innerHTML = '📷';
  document.getElementById('item-photo-input').value = '';
}

function showItemPhoto(itemId) {
  const item = db.items.find(i => i.id == itemId);
  if (!item || !item.photo) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.innerHTML = `<div style="position:relative;max-width:90vw;max-height:90vh;">
    <img src="${item.photo}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.5);">
    <div style="text-align:center;color:white;margin-top:10px;font-size:14px;font-weight:600;">${item.name}</div>
  </div>`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}


function togglePatIdType() {
  const t = document.getElementById('pat-id-type').value;
  const labels = { thai: 'เลขบัตรประชาชน', passport: 'เลขพาสปอร์ต', alien: 'เลขบัตรประจำตัวคนต่างด้าว', workpermit: 'เลขใบอนุญาตทำงาน' };
  const placeholders = { thai: '0-0000-00000-00-0', passport: 'A1234567', alien: '0-0000-00000-00-0', workpermit: 'WP-XXXXXXXX' };
  document.getElementById('pat-id-label').textContent = labels[t] || 'เลขบัตร';
  document.getElementById('pat-id').placeholder = placeholders[t] || '';
}
function toggleStaffIdType() {
  const t = document.getElementById('staff-id-type').value;
  const labels = { thai: 'เลขบัตรประชาชน', passport: 'เลขพาสปอร์ต', alien: 'เลขบัตรประจำตัวคนต่างด้าว', workpermit: 'เลขใบอนุญาตทำงาน' };
  const placeholders = { thai: '0-0000-00000-00-0', passport: 'A1234567', alien: '0-0000-00000-00-0', workpermit: 'WP-XXXXXXXX' };
  document.getElementById('staff-idcard-label').textContent = labels[t] || 'เลขบัตร';
  document.getElementById('staff-idcard').placeholder = placeholders[t] || '';
  const inp = document.getElementById('staff-idcard');
  if (inp) inp.readOnly = false;
}
function toggleBedOtherNote() {
  const s = document.getElementById('bed-status').value;
  const noteEl = document.getElementById('bed-other-note');
  if (noteEl) noteEl.style.display = s === 'other' ? '' : 'none';
  if (s !== 'other' && noteEl) noteEl.value = '';
}

// ===== PATIENT PROFILE PAGE =====
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
        <span class="badge ${isActive ? 'badge-green' : 'badge-gray'}" style="font-size:13px;padding:4px 14px;">${isActive ? '🏠 พักอยู่' : '🚪 ออกแล้ว'}</span>
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
                  <td><button class="btn btn-ghost btn-sm" onclick="deleteAllergy('${p.id}','${a.id}')">🗑️</button></td>
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
                      ${c.isPayer ? '<span class="badge badge-green">💰 ผู้จ่ายเงิน (Payer)</span>' : ''}
                      ${c.isDecisionMaker ? '<span class="badge" style="background:#e8e8f8;color:#3d3d9e;">🧠 ผู้ตัดสินใจ</span>' : ''}
                      <span class="badge badge-gray">${c.role}</span>
                    </div>
                    ${c.note ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">📝 ${c.note}</div>` : ''}
                  </div>
                  <button class="btn btn-ghost btn-sm" onclick="deleteContact('${p.id}','${c.id}')">🗑️</button>
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
    </div>
  </div>`;
  } catch(err) { console.error('openPatientProfile error:', err); toast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
}

function switchPatTab(tab) {
  ['history','medical','meds','allergy','contacts','notes','mar','vitals','nursing','appts','belongings','dnr'].forEach(t => {
    const el = document.getElementById('patprofile-tab-'+t);
    if(el) el.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('#patprofileTabs .tab').forEach((el,i) => {
    el.classList.toggle('active', ['history','medical','meds','allergy','contacts','notes','mar','vitals','nursing','appts','belongings','dnr'][i] === tab);
  });
}

// ==========================================
// ==========================================
// ===== APPOINTMENTS 🚐 ===================
// ==========================================
function renderApptList(patientId) {
  const appts = (db.appointments||[]).filter(a=>String(a.patientId)===String(patientId))
    .sort((a,b)=>a.apptDate.localeCompare(b.apptDate));
  if (!appts.length) return `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีนัดหมาย</div>`;
  const today = new Date().toISOString().split('T')[0];
  const STATUS_COLOR = { upcoming:'#3498db', done:'#27ae60', cancelled:'#e74c3c', postponed:'#e67e22' };
  const STATUS_LABEL = { upcoming:'🔵 กำลังจะถึง', done:'✅ เสร็จแล้ว', cancelled:'❌ ยกเลิก', postponed:'⏸ เลื่อน' };
  const TRANSPORT_ICON = { 'รถคลินิก':'🚐', 'ญาติมารับ':'👨‍👩‍👧', 'แท็กซี่/รถรับจ้าง':'🚕', 'รถพยาบาล':'🚑' };
  return `<div style="display:flex;flex-direction:column;gap:10px;padding:12px 16px;">
    ${appts.map(a => {
      const daysLeft = a.apptDate >= today ? Math.ceil((new Date(a.apptDate)-new Date(today))/(86400000)) : -1;
      const urgent   = daysLeft >= 0 && daysLeft <= 2 && a.status==='upcoming';
      return `<div style="border:1.5px solid ${urgent?'#e74c3c':a.status==='done'?'#ddd':'var(--border)'};border-radius:10px;padding:14px;background:${urgent?'#fff5f5':a.status==='done'?'#f9f9f9':'var(--surface2)'};position:relative;">
        ${urgent?`<div style="position:absolute;top:8px;right:8px;background:#e74c3c;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">⚠️ อีก ${daysLeft} วัน</div>`:''}
        <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div style="min-width:100px;">
            <div style="font-size:17px;font-weight:700;color:${a.status==='upcoming'?'var(--accent)':'var(--text2)'};">${a.apptDate} ${a.apptTime?'🕐'+a.apptTime:''}</div>
            <div style="font-size:11px;margin-top:2px;"><span style="background:${STATUS_COLOR[a.status]||'#888'}22;color:${STATUS_COLOR[a.status]||'#888'};padding:2px 8px;border-radius:10px;">${STATUS_LABEL[a.status]||a.status}</span></div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${a.hospital}</div>
            <div style="font-size:13px;color:var(--text2);">${a.department?'แผนก '+a.department+' ':''} ${a.doctor?'นพ./พญ. '+a.doctor:''}</div>
            <div style="font-size:12px;margin-top:4px;">🎯 ${a.purpose||'-'}</div>
            ${a.preparation?`<div style="font-size:12px;color:#e67e22;margin-top:2px;">📋 เตรียม: ${a.preparation}</div>`:''}
            <div style="font-size:12px;margin-top:4px;">${TRANSPORT_ICON[a.transport]||'🚗'} ${a.transport} ${a.transportNote?'('+a.transportNote+')':''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${a.status==='upcoming'?`<button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;" onclick="markApptDone('${a.id}')">✅ เสร็จ</button>`:''}
            <button class="btn btn-ghost btn-sm" onclick="openApptModal('${a.id}')" style="font-size:11px;">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteAppt('${a.id}','${patientId}')" style="font-size:11px;color:#e74c3c;">🗑️</button>
          </div>
        </div>
        ${a.note?`<div style="font-size:12px;color:var(--text3);margin-top:6px;border-top:1px solid var(--border);padding-top:6px;">💬 ${a.note}</div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

let _apptEditId = null, _apptPatId = null, _apptPatName = null;
function openApptModal(id, patientId, patientName) {
  _apptEditId   = id;
  _apptPatId    = patientId || (id ? (db.appointments||[]).find(a=>a.id==id)?.patientId : null);
  _apptPatName  = patientName || (db.appointments||[]).find(a=>a.id==id)?.patientName || '';
  const a = id ? (db.appointments||[]).find(x=>x.id==id) : null;
  document.getElementById('modal-appt-title').textContent = id ? '✏️ แก้ไขนัดหมาย' : '+ เพิ่มนัดหมาย';
  document.getElementById('appt-date').value       = a?.apptDate    || new Date().toISOString().split('T')[0];
  document.getElementById('appt-time').value       = a?.apptTime    || '';
  document.getElementById('appt-hospital').value   = a?.hospital    || '';
  document.getElementById('appt-department').value = a?.department  || '';
  document.getElementById('appt-doctor').value     = a?.doctor      || '';
  document.getElementById('appt-purpose').value    = a?.purpose     || '';
  document.getElementById('appt-preparation').value= a?.preparation || '';
  document.getElementById('appt-transport').value  = a?.transport   || 'รถคลินิก';
  document.getElementById('appt-transport-note').value = a?.transportNote || '';
  document.getElementById('appt-status').value     = a?.status      || 'upcoming';
  document.getElementById('appt-note').value       = a?.note        || '';
  openModal('modal-appt');
}

async function saveAppt() {
  const apptDate = document.getElementById('appt-date').value;
  const hospital = document.getElementById('appt-hospital').value.trim();
  if (!apptDate || !hospital) { toast('กรุณาระบุวันที่และโรงพยาบาล','warning'); return; }
  const actor = currentUser?.displayName || currentUser?.username || '';
  const row = {
    patient_id: _apptPatId, patient_name: _apptPatName,
    appt_date: apptDate,
    appt_time: document.getElementById('appt-time').value,
    hospital, department: document.getElementById('appt-department').value.trim(),
    doctor: document.getElementById('appt-doctor').value.trim(),
    purpose: document.getElementById('appt-purpose').value.trim(),
    preparation: document.getElementById('appt-preparation').value.trim(),
    transport: document.getElementById('appt-transport').value,
    transport_note: document.getElementById('appt-transport-note').value.trim(),
    status: document.getElementById('appt-status').value,
    note: document.getElementById('appt-note').value.trim(),
    created_by: actor,
  };
  if (_apptEditId) {
    await supa.from('patient_appointments').update(row).eq('id',_apptEditId);
    const idx = db.appointments.findIndex(a=>a.id==_apptEditId);
    if(idx>=0) db.appointments[idx] = mapAppointment({id:_apptEditId,...Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v]))});
    toast('บันทึกนัดหมายเรียบร้อย','success');
  } else {
    const {data:ins,error} = await supa.from('patient_appointments').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    db.appointments.push(mapAppointment(ins));
    // Send LINE notification if upcoming and within 2 days
    const daysLeft = Math.ceil((new Date(apptDate)-new Date())/(86400000));
    if (daysLeft <= 2) {
      sendLineNotify('appt_reminder', `🚐 นัดหมายใกล้แล้ว!\n━━━━━━━━━━━━━━\n👤 ${_apptPatName}\n🏥 ${hospital}\n📅 ${apptDate} ${row.appt_time||''}\n🎯 ${row.purpose||'-'}`, {patientName:_apptPatName});
    }
    toast('เพิ่มนัดหมายเรียบร้อย','success');
  }
  closeModal('modal-appt');
  const listEl = document.getElementById('appt-list-'+_apptPatId);
  if(listEl) listEl.innerHTML = renderApptList(_apptPatId);
  renderUpcomingAppts();
}

async function markApptDone(id) {
  await supa.from('patient_appointments').update({status:'done'}).eq('id',id);
  const a = db.appointments.find(x=>x.id==id);
  if(a) { a.status='done'; const el=document.getElementById('appt-list-'+a.patientId); if(el) el.innerHTML=renderApptList(a.patientId); }
  toast('✅ บันทึกเสร็จสิ้นแล้ว','success');
  renderUpcomingAppts();
}

async function deleteAppt(id, patientId) {
  if(!confirm('ลบนัดหมายนี้?')) return;
  await supa.from('patient_appointments').delete().eq('id',id);
  db.appointments = db.appointments.filter(a=>a.id!=id);
  const el=document.getElementById('appt-list-'+patientId); if(el) el.innerHTML=renderApptList(patientId);
  toast('ลบนัดหมายแล้ว','success');
  renderUpcomingAppts();
}

function renderUpcomingAppts() {
  // Called from dashboard to show upcoming appt widget
  const el = document.getElementById('dashboard-appts');
  if(!el) return;
  const today = new Date().toISOString().split('T')[0];
  const soon = (db.appointments||[]).filter(a=>a.status==='upcoming'&&a.apptDate>=today)
    .sort((a,b)=>a.apptDate.localeCompare(b.apptDate)).slice(0,5);
  if(!soon.length){el.innerHTML=`<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีนัดหมายที่กำลังจะถึง</div>`;return;}
  el.innerHTML = soon.map(a=>{
    const daysLeft=Math.ceil((new Date(a.apptDate)-new Date(today))/(86400000));
    return `<div onclick="navigateToAppt('${a.patientId}')" style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;">
      <div style="background:${daysLeft<=2?'#e74c3c22':'var(--sage-light)'};color:${daysLeft<=2?'#e74c3c':'var(--accent)'};border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap;">${daysLeft===0?'วันนี้':daysLeft===1?'พรุ่งนี้':'อีก '+daysLeft+' วัน'}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:12px;">${a.patientName}</div><div style="font-size:11px;color:var(--text2);">${a.hospital} ${a.apptTime?'· '+a.apptTime:''}</div></div>
    </div>`;
  }).join('');
}
function navigateToAppt(patientId) {
  openPatientProfile(patientId).then(()=>switchPatTab('appts'));
}

// ==========================================
// ===== BELONGINGS 🧳 ======================
// ==========================================
function renderBelongingList(patientId) {
  const items = (db.belongings||[]).filter(b=>String(b.patientId)===String(patientId));
  if(!items.length) return `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีสิ่งของบันทึกไว้</div>`;
  const held = items.filter(i=>i.status==='held');
  const returned = items.filter(i=>i.status==='returned');
  const COND_COLOR = { ดี:'#27ae60', ปานกลาง:'#e67e22', ชำรุด:'#e74c3c' };
  const renderGroup = (list, label) => !list.length ? '' : `
    <div style="padding:10px 16px 0;font-size:12px;font-weight:700;color:var(--text3);">${label} (${list.length})</div>
    <table style="width:100%;">
      <thead><tr style="font-size:12px;"><th style="padding:6px 16px;">สิ่งของ</th><th>จำนวน</th><th>สภาพ</th><th>วันนำเข้า</th><th>รับโดย</th><th>หมายเหตุ</th><th></th></tr></thead>
      <tbody>
        ${list.map(b=>`<tr style="font-size:13px;">
          <td style="padding:8px 16px;font-weight:600;">${b.itemName}${b.description?`<br><span style="font-size:11px;font-weight:400;color:var(--text3);">${b.description}</span>`:''}</td>
          <td class="number">${b.qty}</td>
          <td><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${COND_COLOR[b.condition]||'#888'}22;color:${COND_COLOR[b.condition]||'#888'};">${b.condition}</span></td>
          <td style="font-size:12px;">${b.dateIn}</td>
          <td style="font-size:12px;">${b.receivedBy}</td>
          <td style="font-size:12px;color:var(--text2);">${b.note||'-'}</td>
          <td style="white-space:nowrap;">
            ${b.status==='held'?`<button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;" onclick="returnBelonging('${b.id}','${patientId}')">↩️ คืน</button>`:`<span style="font-size:11px;color:var(--text3);">คืนแล้ว ${b.dateOut||''}</span>`}
            <button class="btn btn-ghost btn-sm" onclick="deleteBelonging('${b.id}','${patientId}')" style="font-size:11px;color:#e74c3c;">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  return `<div>${renderGroup(held,'📦 อยู่ในความดูแล')}${renderGroup(returned,'✅ คืนแล้ว')}</div>`;
}

let _belongingEditPatId=null, _belongingEditPatName=null;
function openBelongingModal(id, patientId, patientName) {
  _belongingEditPatId   = patientId;
  _belongingEditPatName = patientName;
  const actor = currentUser?.displayName || currentUser?.username || '';
  document.getElementById('belonging-item-name').value = '';
  document.getElementById('belonging-qty').value = 1;
  document.getElementById('belonging-condition').value = 'ดี';
  document.getElementById('belonging-description').value = '';
  document.getElementById('belonging-date-in').value = new Date().toISOString().split('T')[0];
  document.getElementById('belonging-received-by').value = actor;
  document.getElementById('belonging-note').value = '';
  openModal('modal-belonging');
}

async function saveBelonging() {
  const itemName = document.getElementById('belonging-item-name').value.trim();
  if(!itemName){toast('กรุณาระบุชื่อสิ่งของ','warning');return;}
  const actor = currentUser?.displayName || currentUser?.username || '';
  const row = {
    patient_id: _belongingEditPatId, patient_name: _belongingEditPatName,
    item_name: itemName,
    qty: parseFloat(document.getElementById('belonging-qty').value)||1,
    condition: document.getElementById('belonging-condition').value,
    description: document.getElementById('belonging-description').value.trim(),
    date_in: document.getElementById('belonging-date-in').value,
    received_by: document.getElementById('belonging-received-by').value.trim()||actor,
    status: 'held',
    note: document.getElementById('belonging-note').value.trim(),
  };
  const {data:ins,error} = await supa.from('patient_belongings').insert(row).select().single();
  if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
  if(!db.belongings) db.belongings=[];
  db.belongings.unshift(mapBelonging(ins));
  const el=document.getElementById('belonging-list-'+_belongingEditPatId);
  if(el) el.innerHTML=renderBelongingList(_belongingEditPatId);
  toast('บันทึกสิ่งของเรียบร้อย','success');
  closeModal('modal-belonging');
}

async function returnBelonging(id, patientId) {
  const returnedBy = currentUser?.displayName || currentUser?.username || '';
  const dateOut = new Date().toISOString().split('T')[0];
  await supa.from('patient_belongings').update({status:'returned', date_out:dateOut, returned_by:returnedBy}).eq('id',id);
  const b = db.belongings.find(x=>x.id==id);
  if(b){b.status='returned';b.dateOut=dateOut;b.returnedBy=returnedBy;}
  const el=document.getElementById('belonging-list-'+patientId);
  if(el) el.innerHTML=renderBelongingList(patientId);
  toast('✅ บันทึกการคืนสิ่งของเรียบร้อย','success');
}

async function deleteBelonging(id, patientId) {
  if(!confirm('ลบรายการนี้?')) return;
  await supa.from('patient_belongings').delete().eq('id',id);
  db.belongings = db.belongings.filter(b=>b.id!=id);
  const el=document.getElementById('belonging-list-'+patientId); if(el) el.innerHTML=renderBelongingList(patientId);
  toast('ลบแล้ว','success');
}

// ==========================================
// ===== DNR & CONSENT ⚖️ ==================
// ==========================================
function renderDnrPanel(p) {
  const consent = (db.patientConsents||[]).find(c=>String(c.patientId)===String(p.id));
  const DNR_STYLES = {
    dnr:   { bg:'#fdf2f8', border:'#c0392b', badge:'#c0392b', icon:'🚫', label:'DNR — ไม่ต้องการการช่วยชีวิต' },
    full:  { bg:'#f0fff4', border:'#27ae60', badge:'#27ae60', icon:'✅', label:'Full Code — ยินยอมให้ช่วยชีวิตเต็มที่' },
    limited:{ bg:'#fffdf0', border:'#e67e22', badge:'#e67e22', icon:'⚠️', label:'Limited — ยินยอมบางส่วน (ดูรายละเอียด)' },
    not_set:{ bg:'var(--surface2)', border:'var(--border)', badge:'#888', icon:'❓', label:'ยังไม่ได้กำหนด' },
  };
  const style = DNR_STYLES[consent?.dnrStatus||'not_set'];
  return `
  <div style="background:${style.bg};border:2px solid ${style.border};border-radius:12px;padding:18px 20px;margin-bottom:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:${style.border};">${style.icon} ${style.label}</div>
        ${consent?.dnrSignedDate?`<div style="font-size:12px;color:var(--text3);margin-top:4px;">ลงนาม: ${consent.dnrSignedDate} โดย ${consent.dnrSignedBy}</div>`:''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="openDnrModal('${p.id}','${p.name}')">✏️ แก้ไข DNR & Consent</button>
    </div>
    ${consent ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px;">
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🫀 การกู้คืนหัวใจ (CPR)</div>
        <div style="font-weight:600;">${consent.cprConsent===true?'✅ ยินยอม':consent.cprConsent===false?'❌ ไม่ยินยอม':'❓ ไม่ระบุ'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🫁 เครื่องช่วยหายใจ (Ventilator)</div>
        <div style="font-weight:600;">${consent.ventilatorConsent===true?'✅ ยินยอม':consent.ventilatorConsent===false?'❌ ไม่ยินยอม':'❓ ไม่ระบุ'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🏥 โรงพยาบาลที่ต้องการ</div>
        <div style="font-weight:600;">${consent.preferredHospital||'-'}</div>
      </div>
      <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">📞 ผู้ติดต่อฉุกเฉิน</div>
        <div style="font-weight:600;">${consent.emergencyContact||'-'} ${consent.emergencyPhone?'<span style="font-size:12px;color:var(--accent);">'+consent.emergencyPhone+'</span>':''}</div>
      </div>
    </div>
    ${consent.advanceDirective?`<div style="margin-top:12px;background:rgba(255,255,255,.7);border-radius:8px;padding:12px 14px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">📜 Advance Directive / ข้อปฏิบัติพิเศษ</div><div style="font-size:13px;">${consent.advanceDirective}</div></div>`:''}
    ${consent.note?`<div style="margin-top:8px;font-size:12px;color:var(--text3);">💬 ${consent.note}</div>`:''}
    ` : `<div style="margin-top:12px;font-size:13px;color:var(--text3);">ยังไม่มีข้อมูล กดปุ่ม "แก้ไข" เพื่อบันทึก</div>`}
  </div>`;
}

let _dnrPatId=null, _dnrPatName=null;
function openDnrModal(patientId, patientName) {
  _dnrPatId   = patientId;
  _dnrPatName = patientName;
  const c = (db.patientConsents||[]).find(x=>String(x.patientId)===String(patientId));
  document.getElementById('dnr-status').value    = c?.dnrStatus||'not_set';
  document.getElementById('dnr-cpr').value       = c?.cprConsent===null ? 'null' : c?.cprConsent===true ? 'true' : c?.cprConsent===false ? 'false' : 'null';
  document.getElementById('dnr-vent').value      = c?.ventilatorConsent===null ? 'null' : c?.ventilatorConsent===true ? 'true' : c?.ventilatorConsent===false ? 'false' : 'null';
  document.getElementById('dnr-hospital').value  = c?.preferredHospital||'';
  document.getElementById('dnr-ec-name').value   = c?.emergencyContact||'';
  document.getElementById('dnr-ec-phone').value  = c?.emergencyPhone||'';
  document.getElementById('dnr-directive').value = c?.advanceDirective||'';
  document.getElementById('dnr-signed-date').value = c?.dnrSignedDate||new Date().toISOString().split('T')[0];
  document.getElementById('dnr-signed-by').value = c?.dnrSignedBy||'';
  document.getElementById('dnr-note').value      = c?.note||'';
  openModal('modal-dnr');
}

async function saveDnr() {
  const cprVal  = document.getElementById('dnr-cpr').value;
  const ventVal = document.getElementById('dnr-vent').value;
  const row = {
    patient_id: _dnrPatId,
    dnr_status: document.getElementById('dnr-status').value,
    cpr_consent: cprVal==='null'?null:cprVal==='true',
    ventilator_consent: ventVal==='null'?null:ventVal==='true',
    preferred_hospital: document.getElementById('dnr-hospital').value.trim(),
    emergency_contact: document.getElementById('dnr-ec-name').value.trim(),
    emergency_phone: document.getElementById('dnr-ec-phone').value.trim(),
    advance_directive: document.getElementById('dnr-directive').value.trim(),
    dnr_signed_date: document.getElementById('dnr-signed-date').value,
    dnr_signed_by: document.getElementById('dnr-signed-by').value.trim(),
    note: document.getElementById('dnr-note').value.trim(),
    updated_at: new Date().toISOString(),
  };
  const existing = (db.patientConsents||[]).find(c=>String(c.patientId)===String(_dnrPatId));
  if(existing) {
    await supa.from('patient_consents').update(row).eq('id',existing.id);
    Object.assign(existing, mapConsent({id:existing.id,...Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v]))}));
  } else {
    const {data:ins,error}=await supa.from('patient_consents').insert(row).select().single();
    if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
    if(!db.patientConsents)db.patientConsents=[];
    db.patientConsents.push(mapConsent(ins));
  }
  const p = db.patients.find(x=>String(x.id)===String(_dnrPatId));
  const panelEl = document.getElementById('dnr-panel-'+_dnrPatId);
  if(panelEl && p) panelEl.innerHTML = renderDnrPanel(p);
  toast('บันทึก DNR & Consent เรียบร้อย','success');
  closeModal('modal-dnr');
}

// ===== MAR — Medication Admin Record ======
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
  await supa.from('mar_records').delete().eq('id', id);
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
  const { data: ins, error } = await supa.from('patient_medications').insert(data).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  const pid = String(patientId);
  if(!db.medications[pid]) db.medications[pid]=[];
  db.medications[pid].push(mapMedication(ins));
  toast(`เพิ่มยา "${name}" เรียบร้อย`,'success');
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
  document.getElementById('patprofile-tab-mar').innerHTML = renderMARTab(pid, patientId);
}

// ==========================================
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
                  <td class="number" style="font-size:12px;white-space:nowrap;">${v.recordedAt?.replace('T',' ').slice(0,16)||'-'}</td>
                  <td style="text-align:center;font-weight:${bpAlert?'700':'400'};color:${bpAlert?'#e74c3c':'inherit'};">${v.bp_sys ? v.bp_sys+'/'+v.bp_dia : '-'}</td>
                  <td style="text-align:center;font-weight:${hrAlert?'700':'400'};color:${hrAlert?'#e74c3c':'inherit'};">${v.hr||'-'}</td>
                  <td style="text-align:center;">${v.temp ? v.temp+'°C' : '-'}</td>
                  <td style="text-align:center;font-weight:${spo2Alert?'700':'400'};color:${spo2Alert?'#e74c3c':'inherit'};">${v.spo2 ? v.spo2+'%' : '-'}</td>
                  <td style="text-align:center;">${v.dtx ? v.dtx+' mg/dL' : '-'}</td>
                  <td style="text-align:center;">${v.rr ? v.rr+'/min' : '-'}</td>
                  <td style="font-size:12px;color:var(--text2);max-width:120px;">${v.otherFields||'-'}</td>
                  <td style="font-size:12px;">${v.recordedBy||'-'}</td>
                  <td style="font-size:12px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${v.note||''}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="deleteVitalSign('${patientId}','${pid}','${v.id}')">🗑️</button></td>
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
  const patientId = document.getElementById('vital-pat-id').value;
  const time = document.getElementById('vital-time').value;
  if (!time) { toast('กรุณาระบุวัน/เวลา','warning'); return; }
  const n = v => { const x=document.getElementById(v).value; return x===''?null:parseFloat(x); };
  const data = {
    patient_id: patientId,
    recorded_at: new Date(time).toISOString(),
    recorded_by: document.getElementById('vital-by').value.trim(),
    bp_sys: n('vital-bp-sys'), bp_dia: n('vital-bp-dia'),
    hr: n('vital-hr'), temp: n('vital-temp'),
    spo2: n('vital-spo2'), dtx: n('vital-dtx'), rr: n('vital-rr'),
    other_fields: document.getElementById('vital-other').value.trim(),
    note: document.getElementById('vital-note').value.trim(),
  };
  const { data: ins, error } = await supa.from('vital_signs').insert(data).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  const pid=String(patientId);
  if(!db.vitalSigns[pid]) db.vitalSigns[pid]=[];
  db.vitalSigns[pid].unshift(mapVitalSign(ins));
  toast('บันทึก Vital Signs แล้ว','success');
  closeModal('modal-add-vital');
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId);
}

async function deleteVitalSign(patientId, pid, id) {
  if(!confirm('ลบรายการนี้?')) return;
  await supa.from('vital_signs').delete().eq('id', id);
  db.vitalSigns[pid] = (db.vitalSigns[pid]||[]).filter(v=>v.id!=id);
  toast('ลบแล้ว');
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId);
}

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
  const otherInput = document.getElementById('pat-status-other');
  if (otherInput) otherInput.style.display = sel.value === 'other' ? '' : 'none';

  const editId = document.getElementById('pat-edit-id')?.value;
  if (sel.value === 'inactive' && editId) {
    const p = db.patients.find(x => x.id == editId);
    if (p && p.status === 'active') {
      sel.value = 'active';
      if (otherInput) otherInput.style.display = 'none';
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