// ===== BILLING: PHYSIO PACKAGES =====

async function renderPhysioPackages() {
  var container = document.getElementById('physio-packages-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">กำลังโหลด...</div>';

  var { data, error } = await supa.from('physio_packages')
    .select('*, patients(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { container.innerHTML = '<div style="color:#e74c3c;padding:16px;">โหลดข้อมูลไม่สำเร็จ: '+error.message+'</div>'; return; }
  var packages = data || [];

  if (!packages.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">ยังไม่มีแพ็กเกจกายภาพ — กด "+ เพิ่มแพ็กเกจ" เพื่อเริ่มต้น</div>';
    return;
  }

  // summary
  var activeCount = packages.filter(function(p){ return p.is_active; }).length;
  var html = '<div style="background:var(--surface2);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;">' +
    '<div><div style="font-size:11px;color:var(--text3);">แพ็กเกจทั้งหมด</div><div style="font-size:18px;font-weight:700;">'+packages.length+'</div></div>' +
    '<div><div style="font-size:11px;color:var(--text3);">Active</div><div style="font-size:18px;font-weight:700;color:var(--accent);">'+activeCount+'</div></div>' +
    '</div>';

  html += '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
    '<th>ผู้รับบริการ</th><th>ชื่อแพ็กเกจ</th><th style="text-align:center;">Session รวม</th>' +
    '<th style="text-align:center;">ใช้ไปแล้ว</th><th style="text-align:center;">คงเหลือ</th>' +
    '<th style="text-align:right;">ราคา/ชม. เกิน</th><th>วันหมดอายุ</th><th>สถานะ</th><th></th>' +
    '</tr></thead><tbody>';

  packages.forEach(function(p) {
    var remaining = Math.max(0, p.sessions_included - p.sessions_used);
    var pct = p.sessions_included > 0 ? Math.round(p.sessions_used / p.sessions_included * 100) : 0;
    var statusBadge = p.is_active
      ? '<span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:2px 8px;font-size:11px;">Active</span>'
      : '<span style="background:var(--surface2);color:var(--text3);border-radius:4px;padding:2px 8px;font-size:11px;">ปิดแล้ว</span>';
    var progressBar = '<div style="background:var(--border);border-radius:3px;height:6px;margin-top:4px;">' +
      '<div style="background:var(--accent);border-radius:3px;height:6px;width:'+Math.min(100,pct)+'%;"></div></div>';
    html += '<tr>' +
      '<td style="font-weight:600;">'+(p.patients?.name||'-')+'</td>' +
      '<td>'+p.name+'</td>' +
      '<td style="text-align:center;">'+p.sessions_included+'</td>' +
      '<td style="text-align:center;">'+p.sessions_used+progressBar+'</td>' +
      '<td style="text-align:center;font-weight:700;color:'+(remaining>0?'var(--accent)':'#e74c3c')+';">'+remaining+'</td>' +
      '<td style="text-align:right;">'+(p.rate_per_hour_extra>0?formatThb(p.rate_per_hour_extra):'-')+'</td>' +
      '<td style="font-size:12px;">'+(p.end_date||'-')+'</td>' +
      '<td>'+statusBadge+'</td>' +
      '<td style="white-space:nowrap;">' +
        '<button class="btn btn-ghost btn-sm" onclick="openEditPhysioPackage(''+p.id+'')" title="แก้ไข">&#9998;&#65039;</button>' +
        (p.is_active ? '<button class="btn btn-ghost btn-sm" onclick="deactivatePhysioPackage(''+p.id+'')" style="color:#e74c3c;" title="ปิดแพ็กเกจ">&#128683;</button>' : '') +
      '</td>' +
    '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function openAddPhysioPackageModal(editId) {
  var pkg = editId ? null : null;
  if (editId) {
    // load from DB async then populate
    supa.from('physio_packages').select('*').eq('id', editId).single().then(function(res) {
      if (res.data) _populatePhysioPackageModal(res.data);
    });
  }
  document.getElementById('pp-edit-id').value = editId||'';
  document.getElementById('modal-physio-package-title').textContent = editId ? '✏️ แก้ไขแพ็กเกจกายภาพ' : '➕ เพิ่มแพ็กเกจกายภาพ';
  if (!editId) {
    document.getElementById('pp-patient').value = '';
    document.getElementById('pp-name').value = '';
    document.getElementById('pp-sessions-included').value = '10';
    document.getElementById('pp-rate-extra').value = '0';
    document.getElementById('pp-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pp-end-date').value = '';
    document.getElementById('pp-note').value = '';
    // populate patient select
    var sel = document.getElementById('pp-patient');
    sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
      (db.patients||[]).filter(function(p){ return p.status==='active'; })
        .map(function(p){ return '<option value="'+p.id+'">'+p.name+'</option>'; }).join('');
  }
  openModal('modal-physio-package');
}

function openEditPhysioPackage(id) { openAddPhysioPackageModal(id); }

function _populatePhysioPackageModal(pkg) {
  var sel = document.getElementById('pp-patient');
  sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    (db.patients||[]).filter(function(p){ return p.status==='active'; })
      .map(function(p){ return '<option value="'+p.id+'">'+p.name+'</option>'; }).join('');
  sel.value = pkg.patient_id||'';
  document.getElementById('pp-name').value = pkg.name||'';
  document.getElementById('pp-sessions-included').value = pkg.sessions_included||0;
  document.getElementById('pp-rate-extra').value = pkg.rate_per_hour_extra||0;
  document.getElementById('pp-start-date').value = pkg.start_date||'';
  document.getElementById('pp-end-date').value = pkg.end_date||'';
  document.getElementById('pp-note').value = pkg.note||'';
}

async function savePhysioPackage() {
  var editId = document.getElementById('pp-edit-id').value;
  var patientId = document.getElementById('pp-patient').value;
  var name = document.getElementById('pp-name').value.trim();
  var sessionsIncluded = parseInt(document.getElementById('pp-sessions-included').value)||0;
  var rateExtra = parseFloat(document.getElementById('pp-rate-extra').value)||0;
  var startDate = document.getElementById('pp-start-date').value||null;
  var endDate = document.getElementById('pp-end-date').value||null;
  var note = document.getElementById('pp-note').value.trim();

  if (!patientId) { toast('กรุณาเลือกผู้รับบริการ','warning'); return; }
  if (!name) { toast('กรุณาระบุชื่อแพ็กเกจ','warning'); return; }

  var data = { patient_id: patientId, name: name, sessions_included: sessionsIncluded,
    rate_per_hour_extra: rateExtra, start_date: startDate, end_date: endDate,
    note: note, is_active: true };

  var err;
  if (editId) {
    var res = await supa.from('physio_packages').update(data).eq('id', editId);
    err = res.error;
  } else {
    data.sessions_used = 0;
    data.created_by = currentUser?.username||'';
    var res = await supa.from('physio_packages').insert(data);
    err = res.error;
  }
  if (err) { toast('บันทึกไม่สำเร็จ: '+err.message,'error'); return; }
  toast(editId ? 'แก้ไขแล้ว' : 'เพิ่มแพ็กเกจแล้ว','success');
  closeModal('modal-physio-package');
  renderPhysioPackages();
}

async function deactivatePhysioPackage(id) {
  if (!confirm('ปิดแพ็กเกจนี้?')) return;
  var { error } = await supa.from('physio_packages').update({ is_active: false }).eq('id', id);
  if (error) { toast('ผิดพลาด','error'); return; }
  toast('ปิดแพ็กเกจแล้ว');
  renderPhysioPackages();
}
