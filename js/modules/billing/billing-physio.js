// ===== BILLING: PHYSIO PACKAGES =====

async function renderPhysioPackagesTab() {
  var container = document.getElementById('physio-packages-content');
  if (!container) return;

  // โหลด physio_packages จาก DB
  var { data: packages, error } = await supa.from('physio_packages')
    .select('*, patients(name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) { container.innerHTML = '<div style="color:#e74c3c;padding:20px;">โหลดข้อมูลไม่สำเร็จ: '+error.message+'</div>'; return; }

  var totalSessions = (packages||[]).reduce(function(s,p){ return s+p.sessions_included; }, 0);
  var totalUsed = (packages||[]).reduce(function(s,p){ return s+p.sessions_used; }, 0);

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div style="font-size:15px;font-weight:700;">🤸 กายภาพ Package แยก</div>
        <div style="font-size:12px;color:var(--text3);">Package กายภาพที่ซื้อแยกจาก contract รายเดือน</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAddPhysioPackageModal()">+ เพิ่ม Package</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:var(--accent-light);border:1px solid #b8d9c5;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--accent-dark);">📦 Package ที่ active</div>
        <div style="font-size:22px;font-weight:700;color:var(--accent);">${(packages||[]).length}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">🎯 Session ทั้งหมด</div>
        <div style="font-size:22px;font-weight:700;">${totalSessions}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">✅ ใช้ไปแล้ว</div>
        <div style="font-size:22px;font-weight:700;color:var(--warning);">${totalUsed}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">⏳ คงเหลือ</div>
        <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalSessions - totalUsed}</div>
      </div>
    </div>

    ${!(packages||[]).length ? '<div style="text-align:center;padding:40px;color:var(--text3);">ยังไม่มี Package กายภาพ + เพิ่ม Package เพื่อเริ่มต้น</div>' : `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
          <th>ผู้รับบริการ</th><th>ชื่อ Package</th>
          <th style="text-align:center;">Session ทั้งหมด</th>
          <th style="text-align:center;">ใช้แล้ว</th>
          <th style="text-align:center;">คงเหลือ</th>
          <th>ราคา/ชม. เกิน</th>
          <th>วันเริ่ม</th><th>วันหมด</th><th></th>
        </tr></thead>
        <tbody>
          ${(packages||[]).map(function(p) {
            var remaining = p.sessions_included - p.sessions_used;
            var pct = p.sessions_included > 0 ? Math.round((p.sessions_used/p.sessions_included)*100) : 0;
            var barColor = pct >= 100 ? '#e74c3c' : pct >= 75 ? '#e67e22' : 'var(--accent)';
            return `<tr>
              <td style="font-weight:600;">${p.patients?.name || '-'}</td>
              <td>${p.name}</td>
              <td style="text-align:center;">${p.sessions_included}</td>
              <td style="text-align:center;">
                <div>${p.sessions_used}</div>
                <div style="width:60px;height:4px;background:var(--border);border-radius:2px;margin:3px auto 0;">
                  <div style="width:${Math.min(pct,100)}%;height:100%;background:${barColor};border-radius:2px;"></div>
                </div>
              </td>
              <td style="text-align:center;font-weight:700;color:${remaining<=0?'#e74c3c':'var(--accent)'};">${remaining}</td>
              <td>${remaining <= 0 ? '-' : formatThb(p.rate_per_hour_extra || 0)+'/ชม.'}</td>
              <td style="font-size:12px;">${p.start_date || '-'}</td>
              <td style="font-size:12px;">${p.end_date || 'ไม่กำหนด'}</td>
              <td style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openEditPhysioPackage('${p.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deactivatePhysioPackage('${p.id}')" style="color:#e74c3c;" title="ปิดใช้งาน">🚫</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}
  `;
}

function openAddPhysioPackageModal(editId) {
  // สร้าง modal inline
  var patients = (db.patients || []).filter(function(p){ return p.status === 'active'; });
  var pkg = editId ? null : null; // จะโหลดจาก DB ถ้า edit

  var modalHtml = `
    <div class="modal-overlay" id="modal-physio-pkg" style="display:flex;">
      <div class="modal" style="max-width:480px;width:95%;">
        <div class="modal-header">
          <div class="modal-title">🤸 ${editId ? 'แก้ไข' : 'เพิ่ม'} Package กายภาพ</div>
          <button class="modal-close" onclick="closeModal('modal-physio-pkg')">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="physio-pkg-edit-id" value="${editId||''}">
          <div class="form-group">
            <label>ผู้รับบริการ <span class="required">*</span></label>
            <select id="physio-pkg-patient" class="form-control">
              <option value="">-- เลือก --</option>
              ${patients.map(function(p){ return '<option value="'+p.id+'">'+p.name+'</option>'; }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>ชื่อ Package <span class="required">*</span></label>
            <input id="physio-pkg-name" class="form-control" placeholder="เช่น กายภาพ 10 ครั้ง">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label>จำนวน Session</label>
              <input type="number" id="physio-pkg-sessions" class="form-control number" min="1" value="10">
            </div>
            <div class="form-group">
              <label>ราคา/ชม. ที่เกิน (฿)</label>
              <input type="number" id="physio-pkg-rate" class="form-control number" min="0" value="0">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label>วันเริ่ม</label>
              <input type="date" id="physio-pkg-start" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>วันหมดอายุ (ถ้ามี)</label>
              <input type="date" id="physio-pkg-end" class="form-control">
            </div>
          </div>
          <div class="form-group">
            <label>หมายเหตุ</label>
            <input id="physio-pkg-note" class="form-control" placeholder="ไม่จำเป็น">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-physio-pkg')">ยกเลิก</button>
          <button class="btn btn-primary" onclick="savePhysioPackage()">💾 บันทึก</button>
        </div>
      </div>
    </div>`;

  var existing = document.getElementById('modal-physio-pkg');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function openEditPhysioPackage(id) {
  var { data: pkg } = await supa.from('physio_packages').select('*').eq('id', id).single();
  if (!pkg) { toast('ไม่พบข้อมูล', 'error'); return; }
  openAddPhysioPackageModal(id);
  await new Promise(function(r){ setTimeout(r, 100); });
  document.getElementById('physio-pkg-patient').value = pkg.patient_id || '';
  document.getElementById('physio-pkg-name').value = pkg.name || '';
  document.getElementById('physio-pkg-sessions').value = pkg.sessions_included || 0;
  document.getElementById('physio-pkg-rate').value = pkg.rate_per_hour_extra || 0;
  document.getElementById('physio-pkg-start').value = pkg.start_date || '';
  document.getElementById('physio-pkg-end').value = pkg.end_date || '';
  document.getElementById('physio-pkg-note').value = pkg.note || '';
}

async function savePhysioPackage() {
  var editId = document.getElementById('physio-pkg-edit-id').value;
  var patientId = document.getElementById('physio-pkg-patient').value;
  var name = document.getElementById('physio-pkg-name').value.trim();
  var sessions = parseInt(document.getElementById('physio-pkg-sessions').value) || 0;
  var rate = parseFloat(document.getElementById('physio-pkg-rate').value) || 0;
  var startDate = document.getElementById('physio-pkg-start').value || null;
  var endDate = document.getElementById('physio-pkg-end').value || null;
  var note = document.getElementById('physio-pkg-note').value.trim();

  if (!patientId) { toast('กรุณาเลือกผู้รับบริการ', 'warning'); return; }
  if (!name) { toast('กรุณาระบุชื่อ Package', 'warning'); return; }
  if (sessions < 1) { toast('จำนวน Session ต้องมากกว่า 0', 'warning'); return; }

  var data = {
    patient_id: patientId,
    name: name,
    sessions_included: sessions,
    rate_per_hour_extra: rate,
    start_date: startDate,
    end_date: endDate,
    is_active: true,
    note: note,
    created_by: currentUser?.name || currentUser?.username || ''
  };

  var error;
  if (editId) {
    var res = await supa.from('physio_packages').update(data).eq('id', editId);
    error = res.error;
  } else {
    data.sessions_used = 0;
    var res = await supa.from('physio_packages').insert(data);
    error = res.error;
  }

  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message, 'error'); return; }
  toast(editId ? 'แก้ไข Package แล้วค่ะ' : 'เพิ่ม Package กายภาพแล้วค่ะ', 'success');
  closeModal('modal-physio-pkg');
  renderPhysioPackagesTab();
}

async function deactivatePhysioPackage(id) {
  if (!confirm('ปิดใช้งาน Package นี้?')) return;
  var { error } = await supa.from('physio_packages').update({ is_active: false }).eq('id', id);
  if (error) { toast('ไม่สำเร็จ: '+error.message, 'error'); return; }
  toast('ปิดใช้งานแล้วค่ะ', 'success');
  renderPhysioPackagesTab();
}
