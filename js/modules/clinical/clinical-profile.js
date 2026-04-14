// ===== CLINICAL PROFILE =====

async function openPatientProfile(id, activeTab) {
  try {
  const p = db.patients.find(x => x.id == id);
  if (!p) { toast('ไม่พบข้อมูลผู้รับบริการ','error'); return; }
  document.getElementById('patprofile-breadcrumb').textContent = p.name;
  // Query all reqs for this patient directly (no time limit — full history per patient)
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
        <div style="margin-top:8px;">
          <button class="btn btn-ghost" style="width:100%;font-size:13px;" onclick="openHealthReportModal('${p.id}')">📋 รายงานสุขภาพ</button>
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
      ${renderPatientTabBar(p, totalReqs)}
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
        <div class="card" style="margin-bottom:12px;" id="diag-card-${p.id}">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">🏥 โรคประจำตัว</div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" id="diag-edit-${p.id}">✏️ แก้ไข</button>
              <button class="btn btn-primary btn-sm" id="diag-save-${p.id}" style="display:none;">💾 บันทึก</button>
            </div>
          </div>
          <div style="padding:14px 16px;">
            <div id="diag-disp-${p.id}" style="font-size:14px;min-height:24px;">${p.diagnosis||'-'}</div>
            <textarea id="diag-inp-${p.id}" style="display:none;width:100%;min-height:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:14px;resize:vertical;box-sizing:border-box;">${p.diagnosis||''}</textarea>
          </div>
        </div>
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
      <div id="patprofile-tab-excretion" style="display:none;"></div>
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
      <!-- DEPOSITS TAB -->
      ${(ROLE_PAGES[currentUser?.role]||[]).includes('deposits') ? `
      <div id="patprofile-tab-deposits" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="font-size:13px;">💰 มัดจำ & เงินประกัน</div>
            <button class="btn btn-primary btn-sm" onclick="openDepositModal('${p.id}')">+ บันทึกมัดจำ</button>
          </div>
          <div id="pat-deposits-list-${p.id}">
            <div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
<div id="patprofile-tab-incident" style="display:none"><div id="pat-incident-list-${pid}"><div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div></div></div>
<div id="patprofile-tab-dietary" style="display:none"><div id="pat-dietary-list-${pid}"><div style="padding:24px;text-align:center;color:var(--text3);">⏳ กำลังโหลด...</div></div></div>
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
        logAudit('patients','update',pid,{field:'diagnosis',value:val});
      });
    });
  })();
  if(typeof window._injectStatusBtn==='function'){
    setTimeout(function(){window._injectStatusBtn(String(id));},200);
  }
  } catch(err) { console.error('openPatientProfile error:', err); toast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
}


function _renderPatIncidentTab(pid, listEl) {
  if (!document.getElementById('pat-incident-btns-'+pid)) {
    var wrap = document.createElement('div');
    wrap.id = 'pat-incident-btns-'+pid;
    wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
    var b1 = document.createElement('button');
    b1.className = 'btn btn-primary btn-sm';
    b1.textContent = '⚠️ + อุบัติเหตุ';
    b1.addEventListener('click', function(){
      if(typeof openIncidentModal!=='function') return;
      openIncidentModal();
      setTimeout(function(){
        var h=document.getElementById('ta-inc-id');
        var hn=document.getElementById('ta-inc-inp');
        var pat=(db.patients||[]).find(function(x){return x.id===pid;});
        if(h) h.value=pid;
        if(hn&&pat) hn.value=pat.name||'';
      },150);
    });
    var b2 = document.createElement('button');
    b2.className = 'btn btn-secondary btn-sm';
    b2.textContent = '🩹 + แผลกดทับ';
    b2.addEventListener('click', function(){
      if(typeof openWoundModal!=='function') return;
      openWoundModal();
      setTimeout(function(){
        var h=document.getElementById('ta-wnd-id');
        var hn=document.getElementById('ta-wnd-inp');
        var pat=(db.patients||[]).find(function(x){return x.id===pid;});
        if(h) h.value=pid;
        if(hn&&pat) hn.value=pat.name||'';
      },150);
    });
    wrap.appendChild(b1); wrap.appendChild(b2);
    listEl.parentNode.insertBefore(wrap, listEl);
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
      info.innerHTML='<b>'+x.type+'</b><div style="font-size:13px;color:var(--text2)">'+x.date+' | '+(x.severity||'')+'</div><div style="font-size:13px">'+(x.detail||'')+'</div>';
      var btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openIncidentModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',function(){
        if(!confirm('ลบรายการนี้?')) return;
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
      info.innerHTML='<b>🩹 '+(x.location||'')+' Stage '+(x.stage||'')+'</b><div style="font-size:13px;color:var(--text2)">'+(x.wound_date||'')+'</div><div style="font-size:13px">'+(x.appearance||'')+'</div>';
      var btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openWoundModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',function(){
        if(!confirm('ลบรายการนี้?')) return;
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
    var wrap = document.createElement('div');
    wrap.id = 'pat-dietary-btns-'+pid;
    wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
    var b1 = document.createElement('button');
    b1.className = 'btn btn-primary btn-sm';
    b1.textContent = '🍽️ + กำหนดอาหาร';
    b1.addEventListener('click', function(){
      if(typeof openDietModal!=='function') return;
      openDietModal();
      setTimeout(function(){
        var h=document.getElementById('ta-diet-id');
        var hn=document.getElementById('ta-diet-inp');
        var pat=(db.patients||[]).find(function(x){return x.id===pid;});
        if(h) h.value=pid;
        if(hn&&pat) hn.value=pat.name||'';
      },150);
    });
    var b2 = document.createElement('button');
    b2.className = 'btn btn-secondary btn-sm';
    b2.textContent = '🧪 + สายให้อาหาร';
    b2.addEventListener('click', function(){
      if(typeof openTubeFeedModal!=='function') return;
      openTubeFeedModal();
      setTimeout(function(){
        var h=document.getElementById('ta-tf-id');
        var hn=document.getElementById('ta-tf-inp');
        var pat=(db.patients||[]).find(function(x){return x.id===pid;});
        if(h) h.value=pid;
        if(hn&&pat) hn.value=pat.name||'';
      },150);
    });
    wrap.appendChild(b1); wrap.appendChild(b2);
    listEl.parentNode.insertBefore(wrap, listEl);
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
      info.innerHTML='<div style="font-weight:600;">'+(x.diet_type||'')+'</div><div style="font-size:13px;color:var(--text2);">'+(x.meals||'')+(x.calories?' | '+x.calories+' kcal':'')+'</div>';
      var btns=document.createElement('div'); btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openDietModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',function(){
        if(!confirm('ลบรายการนี้?')) return;
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
      info.innerHTML='<div style="font-weight:600;">🧪 สายให้อาหาร</div><div style="font-size:13px;color:var(--text2);">'+(x.date||'')+' | '+(x.formula||'')+'</div>';
      var btns=document.createElement('div'); btns.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      var eb=document.createElement('button'); eb.className='btn btn-ghost btn-sm'; eb.textContent='✏️';
      eb.addEventListener('click',function(){openTubeFeedModal(x.id);});
      var db2=document.createElement('button'); db2.className='btn btn-ghost btn-sm'; db2.style.color='#c0392b'; db2.textContent='🗑️';
      db2.addEventListener('click',function(){
        if(!confirm('ลบรายการนี้?')) return;
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
    var _ie=document.querySelector('[id^="pat-incident-list-"]');
    var _ip=_ie?_ie.id.replace('pat-incident-list-',''):null;
    if(_ip&&_ie){ _renderPatIncidentTab(_ip,_ie); }
  }
  if (tab === 'dietary') {
    var _de=document.querySelector('[id^="pat-dietary-list-"]');
    var _dp=_de?_de.id.replace('pat-dietary-list-',''):null;
    if(_dp&&_de){ _renderPatDietaryTab(_dp,_de); }
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

function renderLabTab(patientId) {
  var el = document.getElementById('lab-list-' + patientId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;">กำลังโหลด...</div>';
  supa.from('patient_lab_results').select('*').eq('patient_id', patientId)
    .order('test_date', { ascending: false })
    .then(function(res) {
      var rows = res.data || [];
      if (!rows.length) {
        el.innerHTML = '<div class="card"><div class="card-header"><div class="card-title">🧪 ผลแล็บ</div>' +
          '<button class="btn btn-primary btn-sm" onclick="openAddLabModal(\''+patientId+'\')" style="margin-left:auto;">+ บันทึก</button></div>' +
          '<div style="padding:32px;text-align:center;">ยังไม่มีผลแล็บ</div></div>';
        return;
      }
      var html = '<div class="card"><div class="card-header"><div class="card-title">🧪 ผลแล็บ (' + rows.length + ')</div>' +
        '<button class="btn btn-primary btn-sm" onclick="openAddLabModal(\''+patientId+'\')" style="margin-left:auto;">+ บันทึก</button></div><div style="padding:0 16px;">';
      rows.forEach(function(r) {
        var results = [];
        try { results = typeof r.results === 'string' ? JSON.parse(r.results) : (r.results || []); } catch(e) {}
        var abn = results.filter(function(x) { return x.status === 'high' || x.status === 'low'; });
        html += '<div style="padding:14px 0;border-bottom:1px solid var(--border);">' +
          '<div style="display:flex;justify-content:space-between;">' +
          '<div><div style="font-weight:600;">📅 ' + (r.test_date||'-') + ' ' +
          (r.hospital ? '<span style="font-size:12px;color:var(--text2);">' + r.hospital + '</span>' : '') + '</div>' +
          (r.summary ? '<div style="font-size:12px;color:var(--text2);">' + r.summary + '</div>' : '') + '</div>' +
          '<div><button class="btn btn-ghost btn-sm" onclick="openEditLabModal(\'' + r.id + '\',\'' + patientId + '\')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteLabResult(\'' + r.id + '\',\'' + patientId + '\')" style="color:#e74c3c;">🗑️</button></div></div>' +
          (abn.length ? '<div style="margin-top:4px;">' + abn.map(function(x) {
            return '<span style="font-size:11px;padding:2px 6px;border-radius:10px;background:' +
              (x.status==='high'?'#fde8e8':'#fff3e0') + ';color:' + (x.status==='high'?'#c0392b':'#d35400') + '">' +
              x.test_name + ': ' + x.value + '</span>';
          }).join(' ') + '</div>' : '') +
          (results.length ? '<details style="margin-top:4px;"><summary style="font-size:12px;color:var(--text2);cursor:pointer;">ดูทั้งหมด (' + results.length + ')</summary>' +
          '<div style="margin-top:4px;">' + results.map(function(x) {
            var sc = x.status==='high'?'#e74c3c':x.status==='low'?'#e67e22':'#27ae60';
            return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 6px;background:var(--surface2);border-radius:4px;margin-bottom:2px;">' +
              '<span>' + x.test_name + '</span><span style="color:' + sc + '">' + x.value + ' ' + (x.unit||'') +
              (x.reference_range ? ' (' + x.reference_range + ')' : '') + '</span></div>';
          }).join('') + '</div></details>' : '') + '</div>';
      });
      html += '</div></div>';
      el.innerHTML = html;
    });
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
  document.getElementById('lab-test-date').value = '';
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
  var res = editId
    ? await supa.from('patient_lab_results').update(payload).eq('id', editId)
    : await supa.from('patient_lab_results').insert(payload);
  if (res.error) { toast('บันทึกไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  toast('บันทึกเรียบร้อย', 'success');
  closeModal('modal-add-lab');
  renderLabTab(patientId);
}

async function deleteLabResult(labId, patientId) {
  if (!confirm('ลบผลแล็บ?')) return;
  var res = await supa.from('patient_lab_results').delete().eq('id', labId);
  if (res.error) { toast('ลบไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  toast('ลบเรียบร้อย', 'success');
  renderLabTab(patientId);
}

// ─── Patient Profile Tab Bar (role-aware) ────────────────────
function renderPatientTabBar(p, totalReqs) {
  const allTabs = [
    { k:'medical',    perm:'nursing',       label:'🏥 โรคประจำตัว/ประวัติการรักษา' },
    { k:'meds',       perm:'mar',           label:'💊 ยาประจำ' },
    { k:'allergy',    perm:'allergy',       label:'🚨 แพ้ยา/อาหาร' + (p.allergies?.length ? '<span style="background:#c0392b;color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">' + p.allergies.length + '</span>' : '') },
    { k:'nursing',    perm:'nursing',       label:'📋 บันทึกพยาบาล' },
    { k:'mar',        perm:'mar',           label:'💊 MAR ยาประจำวัน' },
    { k:'vitals',     perm:'vitals',        label:'📊 Vital Signs' },
    { k:'excretion', perm:'excretion',  label:'🚽 ขับถ่าย / น้ำเข้าออก' },
    { k:'physio',     perm:'physio',        label:'🧘 กายภาพบำบัด' },
    { k:'lab',        perm:'lab',           label:'🧪 ผลแล็บ' },
    { k:'appts',      perm:'appts',         label:'🚐 นัดหมายแพทย์' },
    { k:'incident',   perm:'incident',      label:'🚨 อุบัติเหตุ' },
    { k:'dietary',    perm:'dietary',       label:'🥦 โภชนาการ' },
    { k:'contacts',   perm:'contacts',      label:'👥 ผู้ติดต่อ' + (p.contacts?.length ? '<span style="background:var(--accent);color:white;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:4px;">' + p.contacts.length + '</span>' : '') },
    { k:'notes',      perm:'nursing',       label:'📝 หมายเหตุ' },
    { k:'belongings', perm:'belongings',    label:'🧳 ทรัพย์สิน' },
    { k:'deposits',   perm:'deposits',      label:'💰 มัดจำ' },
    { k:'dnr',        perm:'dnr',           label:'⚖️ DNR & Consent' },
    { k:'dispense',   perm:'dispense',      label:'💊 เบิกสินค้า' },
    { k:'history',    perm:'history',       label:'📦 ประวัติเบิก (' + totalReqs + ')' },
  ];
  const visibleTabs = allTabs.filter(t => canSeePatientTab(t.perm));
  const tabsHtml = visibleTabs.map(t =>
    '<div class="tab" onclick="switchPatTab(\'' + t.k + '\')">' + t.label + '</div>'
  ).join('\n        ');
  return '<div class="tabs" id="patprofileTabs" style="margin-bottom:16px;">\n        ' + tabsHtml + '\n      </div>';
}

// ========== EXCRETION TAB ==========
function _renderExcretionTab(patId) {
  var el = document.getElementById('patprofile-tab-excretion');
  if (!el) return;
  el.innerHTML = '';
  el.dataset.patid = patId;

  var canEdit = (typeof canEditExcretion === 'function') ? canEditExcretion() : false;

  // Header
  var hdr = document.createElement('div');
  hdr.className = 'section-header';
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px';
  var title = document.createElement('h4');
  title.style.margin = '0';
  title.textContent = String.fromCodePoint(0x1F6BD) + ' ' + 'ขับถ่าย / น้ำเข้าออก';
  hdr.appendChild(title);
  el.appendChild(hdr);

  // Load data and render sections
  _loadExcretionData(patId, el, canEdit);
}

function _loadExcretionData(patId, el, canEdit) {
  var today = new Date().toISOString().slice(0, 10);
  Promise.all([
    supa.from('patient_excretions').select('*').eq('patient_id', patId).gte('recorded_at', today + 'T00:00:00').order('recorded_at', {ascending: true}),
    supa.from('patient_fluid_records').select('*').eq('patient_id', patId).gte('recorded_at', today + 'T00:00:00').order('recorded_at', {ascending: true})
  ]).then(function(results) {
    var excretions = (results[0].data || []);
    var fluids = (results[1].data || []);
    _renderExcretionSections(el, patId, excretions, fluids, canEdit, today);
  }).catch(function(e) {
    el.innerHTML = '<p style="color:red">เกิดข้อผิด: ' + e.message + '</p>';
  });
}

function _renderExcretionSections(el, patId, excretions, fluids, canEdit, today) {
  el.innerHTML = '';

  // ===== SECTION 1: EXCRETIONS =====
  var sec1 = document.createElement('div');
  sec1.style.cssText = 'background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:16px';
  var s1hdr = document.createElement('div');
  s1hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  var s1title = document.createElement('strong');
  s1title.textContent = 'ปัสสาวะ / อุจจาระ';
  s1hdr.appendChild(s1title);
  if (canEdit) {
    var btnAdd1 = document.createElement('button');
    btnAdd1.className = 'btn btn-sm btn-primary';
    btnAdd1.textContent = '+ เพิ่มรายการ';
    btnAdd1.addEventListener('click', function() { _openExcretionModal(null, patId, today); });
    s1hdr.appendChild(btnAdd1);
  }
  sec1.appendChild(s1hdr);

  if (excretions.length === 0) {
    var nodata1 = document.createElement('p');
    nodata1.style.color = '#888';
    nodata1.textContent = 'ยังไม่มีข้อมูลวันนี้';
    sec1.appendChild(nodata1);
  } else {
    var tbl1 = document.createElement('table');
    tbl1.className = 'table table-sm table-bordered';
    tbl1.style.fontSize = '13px';
    var thead1 = document.createElement('thead');
    thead1.innerHTML = '<tr><th>เวลา</th><th>เวร</th><th>ประเภท</th><th>จำนวนครั้ง</th><th>ปริมาณ(ml)</th><th>ลักษณะ</th><th>หมายเหตุ</th>' + (canEdit ? '<th></th>' : '') + '</tr>';
    tbl1.appendChild(thead1);
    var tbody1 = document.createElement('tbody');
    excretions.forEach(function(r) {
      var tr = document.createElement('tr');
      var t = r.recorded_at ? r.recorded_at.slice(11,16) : '';
      var typeLabel = r.type === 'urine' ? 'ปัสสาวะ' : r.type === 'stool' ? 'อุจจาระ' : (r.type || '');
      tr.innerHTML = '<td>' + t + '</td><td>' + (r.shift||'') + '</td><td>' + typeLabel + '</td><td>' + (r.count||'') + '</td><td>' + (r.volume_ml||'') + '</td><td>' + (r.characteristics||'') + '</td><td>' + (r.note||'') + '</td>';
      if (canEdit) {
        var tdAct = document.createElement('td');
        var btnE = document.createElement('button');
        btnE.className = 'btn btn-xs btn-outline-secondary';
        btnE.textContent = '✒';
        btnE.style.marginRight = '4px';
        btnE.addEventListener('click', (function(rec){ return function(){ _openExcretionModal(rec, patId, today); }; })(r));
        var btnD = document.createElement('button');
        btnD.className = 'btn btn-xs btn-outline-danger';
        btnD.textContent = '✕';
        btnD.addEventListener('click', (function(id){ return function(){ _deleteExcretion(id, patId); }; })(r.id));
        tdAct.appendChild(btnE); tdAct.appendChild(btnD);
        tr.appendChild(tdAct);
      }
      tbody1.appendChild(tr);
    });
    tbl1.appendChild(tbody1);
    sec1.appendChild(tbl1);
  }
  el.appendChild(sec1);

  // ===== SECTION 2: FLUID INTAKE =====
  var intakeFluids = fluids.filter(function(f){ return f.direction === 'intake'; });
  var sec2 = document.createElement('div');
  sec2.style.cssText = 'background:#f0f8f0;border-radius:8px;padding:16px;margin-bottom:16px';
  var s2hdr = document.createElement('div');
  s2hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  var s2title = document.createElement('strong');
  s2title.textContent = String.fromCodePoint(0x1F4A7) + ' น้ำเข้า (Intake)';
  s2hdr.appendChild(s2title);
  if (canEdit) {
    var btnAdd2 = document.createElement('button');
    btnAdd2.className = 'btn btn-sm btn-success';
    btnAdd2.textContent = '+ เพิ่มน้ำเข้า';
    btnAdd2.addEventListener('click', function() { _openFluidModal(null, patId, 'intake', today); });
    s2hdr.appendChild(btnAdd2);
  }
  sec2.appendChild(s2hdr);
  _renderFluidTable(sec2, intakeFluids, canEdit, patId, 'intake', today);
  el.appendChild(sec2);

  // ===== SECTION 2b: FLUID OUTPUT (other) =====
  var outputFluids = fluids.filter(function(f){ return f.direction === 'output'; });
  var sec2b = document.createElement('div');
  sec2b.style.cssText = 'background:#fff0f0;border-radius:8px;padding:16px;margin-bottom:16px';
  var s2bhdr = document.createElement('div');
  s2bhdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  var s2btitle = document.createElement('strong');
  s2btitle.textContent = '☂ น้ำออกอื่นๆ (อาเจียน / Drainage / อื่นๆ)';
  s2bhdr.appendChild(s2btitle);
  if (canEdit) {
    var btnAdd2b = document.createElement('button');
    btnAdd2b.className = 'btn btn-sm btn-danger';
    btnAdd2b.textContent = '+ เพิ่มน้ำออก';
    btnAdd2b.addEventListener('click', function() { _openFluidModal(null, patId, 'output', today); });
    s2bhdr.appendChild(btnAdd2b);
  }
  sec2b.appendChild(s2bhdr);
  _renderFluidTable(sec2b, outputFluids, canEdit, patId, 'output', today);
  el.appendChild(sec2b);

  // ===== SECTION 3: BALANCE SUMMARY =====
  _renderBalanceSummary(el, excretions, fluids);
}

function _renderFluidTable(container, rows, canEdit, patId, direction, today) {
  if (rows.length === 0) {
    var p = document.createElement('p');
    p.style.color = '#888';
    p.textContent = 'ยังไม่มีข้อมูลวันนี้';
    container.appendChild(p);
    return;
  }
  var tbl = document.createElement('table');
  tbl.className = 'table table-sm table-bordered';
  tbl.style.fontSize = '13px';
  var th = document.createElement('thead');
  th.innerHTML = '<tr><th>เวลา</th><th>เวร</th><th>ประเภทน้ำ</th><th>ปริมาณ(ml)</th><th>หมายเหตุ</th>' + (canEdit ? '<th></th>' : '') + '</tr>';
  tbl.appendChild(th);
  var tb = document.createElement('tbody');
  rows.forEach(function(r) {
    var tr = document.createElement('tr');
    var t = r.recorded_at ? r.recorded_at.slice(11,16) : '';
    tr.innerHTML = '<td>' + t + '</td><td>' + (r.shift||'') + '</td><td>' + (r.fluid_type||'') + '</td><td>' + (r.volume_ml||'') + '</td><td>' + (r.note||'') + '</td>';
    if (canEdit) {
      var tdA = document.createElement('td');
      var bE = document.createElement('button');
      bE.className = 'btn btn-xs btn-outline-secondary';
      bE.textContent = '✒';
      bE.style.marginRight = '4px';
      bE.addEventListener('click', (function(rec){ return function(){ _openFluidModal(rec, patId, direction, today); }; })(r));
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

function _renderBalanceSummary(container, excretions, fluids) {
  var shifts = [
    {key:'เช้า', start:6, end:14},
    {key:'บ่าย', start:14, end:22},
    {key:'ดึก', start:22, end:30}
  ];
  var sec3 = document.createElement('div');
  sec3.style.cssText = 'background:#fffbe6;border-radius:8px;padding:16px;margin-bottom:16px';
  var title3 = document.createElement('strong');
  title3.textContent = String.fromCodePoint(0x1F4CA) + ' สรุป Balance วันนี้';
  sec3.appendChild(title3);

  var tbl = document.createElement('table');
  tbl.className = 'table table-sm table-bordered';
  tbl.style.cssText = 'margin-top:10px;font-size:13px';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>เวร</th><th>น้ำเข้า (ml)</th><th>น้ำออก (ml)</th><th>Balance (ml)</th><th>อุจจาระ (ครั้ง)</th></tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');
  var totIn = 0, totOut = 0, totStool = 0;
  shifts.forEach(function(sh) {
    var shIn = 0, shOut = 0, shStool = 0;
    fluids.forEach(function(f) {
      var h = f.recorded_at ? parseInt(f.recorded_at.slice(11,13)) : -1;
      var inShift = sh.key === 'ดึก' ? (h >= 22 || h < 6) : (h >= sh.start && h < sh.end);
      if (!inShift) return;
      var vol = parseFloat(f.volume_ml) || 0;
      if (f.direction === 'intake') shIn += vol;
      else if (f.direction === 'output') shOut += vol;
    });
    excretions.forEach(function(r) {
      var h = r.recorded_at ? parseInt(r.recorded_at.slice(11,13)) : -1;
      var inShift = sh.key === 'ดึก' ? (h >= 22 || h < 6) : (h >= sh.start && h < sh.end);
      if (!inShift) return;
      if (r.type === 'urine') shOut += parseFloat(r.volume_ml) || 0;
      if (r.type === 'stool') shStool += parseInt(r.count) || 0;
    });
    totIn += shIn; totOut += shOut; totStool += shStool;
    var bal = shIn - shOut;
    var tr = document.createElement('tr');
    tr.style.color = bal < 0 ? '#c0392b' : '#1a5276';
    tr.innerHTML = '<td>' + sh.key + '</td><td>' + shIn + '</td><td>' + shOut + '</td><td><strong>' + (bal >= 0 ? '+' : '') + bal + '</strong></td><td>' + shStool + '</td>';
    tbody.appendChild(tr);
  });
  var trTot = document.createElement('tr');
  trTot.style.cssText = 'background:#fef9c3;font-weight:bold';
  var totBal = totIn - totOut;
  trTot.innerHTML = '<td>รวม 24ชม.</td><td>' + totIn + '</td><td>' + totOut + '</td><td style="color:' + (totBal < 0 ? '#c0392b' : '#1a5276') + '">' + (totBal >= 0 ? '+' : '') + totBal + '</td><td>' + totStool + '</td>';
  tbody.appendChild(trTot);
  tbl.appendChild(tbody);
  sec3.appendChild(tbl);
  var note3 = document.createElement('p');
  note3.style.cssText = 'font-size:11px;color:#888;margin:4px 0 0';
  note3.textContent = 'หมายเหตุ: น้ำออก = ปัสสาวะ (ml) + น้ำออกอื่นๆ | เฉพาะข้อมูลวันนี้';
  sec3.appendChild(note3);
  container.appendChild(sec3);
}

function _openExcretionModal(rec, patId, today) {
  var isEdit = !!rec;
  var title = isEdit ? 'แก้ไขปัสสาวะ/อุจจาระ' : 'บันทึกปัสสาวะ/อุจจาระ';
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
    var timeVal = inpTime.value;
    var dateTime = today + 'T' + timeVal + ':00+07:00';
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
    var prom = isEdit
      ? supa.from('patient_excretions').update(payload).eq('id', rec.id)
      : supa.from('patient_excretions').insert(payload);
    prom.then(function(res) {
      if (res.error) { alert('บันทึกไม่สำเร็จ: ' + res.error.message); return; }
      document.body.removeChild(overlay);
      switchPatTab('excretion');
    });
  });
}

function _deleteExcretion(id, patId) {
  if (!confirm('ยืนยันลบรายการนี้?')) return;
  supa.from('patient_excretions').delete().eq('id', id).then(function(res) {
    if (res.error) { alert('ลบไม่สำเร็จ: ' + res.error.message); return; }
    switchPatTab('excretion');
  });
}

function _openFluidModal(rec, patId, direction, today) {
  var isEdit = !!rec;
  var isIntake = direction === 'intake';
  var title = isEdit
    ? ('แก้ไขน้ำ' + (isIntake ? 'เข้า' : 'ออก'))
    : ('บันทึกน้ำ' + (isIntake ? 'เข้า' : 'ออก'));
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
    var timeVal = inpTime.value;
    var dateTime = today + 'T' + timeVal + ':00+07:00';
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
    var prom = isEdit
      ? supa.from('patient_fluid_records').update(payload).eq('id', rec.id)
      : supa.from('patient_fluid_records').insert(payload);
    prom.then(function(res) {
      if (res.error) { alert('บันทึกไม่สำเร็จ: ' + res.error.message); return; }
      document.body.removeChild(overlay);
      switchPatTab('excretion');
    });
  });
}

function _deleteFluidRecord(id, patId) {
  if (!confirm('ยืนยันลบรายการนี้?')) return;
  supa.from('patient_fluid_records').delete().eq('id', id).then(function(res) {
    if (res.error) { alert('ลบไม่สำเร็จ: ' + res.error.message); return; }
    switchPatTab('excretion');
  });
}
