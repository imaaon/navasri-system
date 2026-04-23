// ===== BILLING: PHYSIO PACKAGES =====

async function renderPhysioPackages() {
  var container = document.getElementById('physio-packages-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';

  var res = await supa.from('physio_packages')
    .select('*, patients(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (res.error) {
    container.innerHTML = '<div style="color:#e74c3c;padding:16px;">\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + res.error.message + '</div>';
    return;
  }

  var packages = res.data || [];
  if (!packages.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e01\u0e32\u0e22\u0e20\u0e32\u0e1e</div>';
    return;
  }

  var activeCount = packages.filter(function(p) { return p.is_active; }).length;
  var rows = packages.map(function(p) {
    var remaining = Math.max(0, p.sessions_included - p.sessions_used);
    var pct = p.sessions_included > 0 ? Math.round(p.sessions_used / p.sessions_included * 100) : 0;
    var pctCapped = Math.min(100, pct);
    var statusBadge = p.is_active
      ? '<span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:2px 8px;font-size:11px;">Active</span>'
      : '<span style="background:var(--surface2);color:var(--text3);border-radius:4px;padding:2px 8px;font-size:11px;">\u0e1b\u0e34\u0e14\u0e41\u0e25\u0e49\u0e27</span>';
    var bar = '<div style="background:var(--border);border-radius:3px;height:6px;margin-top:4px;">' +
      '<div style="background:var(--accent);border-radius:3px;height:6px;width:' + pctCapped + '%;"></div></div>';
    var editBtn = '<button class="btn btn-ghost btn-sm" onclick="openEditPhysioPackage(\'' + p.id + '\')">\u270F\uFE0F</button>';
    var closeBtn = p.is_active
      ? '<button class="btn btn-ghost btn-sm" onclick="deactivatePhysioPackage(\'' + p.id + '\')" style="color:#e74c3c;">\u26D4</button>'
      : '';
    var rateText = p.rate_per_hour_extra > 0 ? formatThb(p.rate_per_hour_extra) : '-';
    var remColor = remaining > 0 ? 'var(--accent)' : '#e74c3c';
    return '<tr>' +
      '<td style="font-weight:600;">' + ((p.patients && p.patients.name) || '-') + '</td>' +
      '<td>' + p.name + '</td>' +
      '<td style="text-align:center;">' + p.sessions_included + '</td>' +
      '<td style="text-align:center;">' + p.sessions_used + bar + '</td>' +
      '<td style="text-align:center;font-weight:700;color:' + remColor + ';">' + remaining + '</td>' +
      '<td style="text-align:right;">' + rateText + '</td>' +
      '<td style="font-size:12px;">' + (p.end_date || '-') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td style="white-space:nowrap;">' + editBtn + closeBtn + '</td>' +
    '</tr>';
  }).join('');

  var summaryHtml = '<div style="background:var(--surface2);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;">' +
    '<div><div style="font-size:11px;color:var(--text3);">\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</div><div style="font-size:18px;font-weight:700;">' + packages.length + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text3);">Active</div><div style="font-size:18px;font-weight:700;color:var(--accent);">' + activeCount + '</div></div>' +
    '</div>';

  var tableHtml = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
    '<th>\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23</th><th>\u0e0a\u0e37\u0e48\u0e2d\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08</th>' +
    '<th style="text-align:center;">Session \u0e23\u0e27\u0e21</th><th style="text-align:center;">\u0e43\u0e0a\u0e49\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27</th>' +
    '<th style="text-align:center;">\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d</th><th style="text-align:right;">\u0e23\u0e32\u0e04\u0e32/\u0e0a\u0e21. \u0e40\u0e01\u0e34\u0e19</th>' +
    '<th>\u0e27\u0e31\u0e19\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38</th><th>\u0e2a\u0e16\u0e32\u0e19\u0e30</th><th></th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  container.innerHTML = summaryHtml + tableHtml;
}

function openAddPhysioPackageModal(editId) {
  document.getElementById('pp-edit-id').value = editId || '';
  document.getElementById('modal-physio-package-title').textContent = editId
    ? '\u270F\uFE0F \u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e01\u0e32\u0e22\u0e20\u0e32\u0e1e'
    : '\u2795 \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e01\u0e32\u0e22\u0e20\u0e32\u0e1e';

  var sel = document.getElementById('pp-patient');
  sel.innerHTML = '<option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 \u2014</option>' +
    (db.patients || []).filter(function(p) { return p.status === 'active'; })
      .map(function(p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('');

  if (editId) {
    supa.from('physio_packages').select('*').eq('id', editId).single().then(function(res) {
      if (!res.data) return;
      var pkg = res.data;
      sel.value = pkg.patient_id || '';
      document.getElementById('pp-name').value = pkg.name || '';
      document.getElementById('pp-sessions-included').value = pkg.sessions_included || 0;
      document.getElementById('pp-rate-extra').value = pkg.rate_per_hour_extra || 0;
      document.getElementById('pp-start-date').value = pkg.start_date || '';
      document.getElementById('pp-end-date').value = pkg.end_date || '';
      document.getElementById('pp-note').value = pkg.note || '';
    });
  } else {
    document.getElementById('pp-name').value = '';
    document.getElementById('pp-sessions-included').value = '10';
    document.getElementById('pp-rate-extra').value = '0';
    document.getElementById('pp-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pp-end-date').value = '';
    document.getElementById('pp-note').value = '';
  }
  openModal('modal-physio-package');
}

function openEditPhysioPackage(id) { openAddPhysioPackageModal(id); }

async function savePhysioPackage() {
  var editId = document.getElementById('pp-edit-id').value;
  var patientId = document.getElementById('pp-patient').value;
  var name = document.getElementById('pp-name').value.trim();
  var sessionsIncluded = parseInt(document.getElementById('pp-sessions-included').value) || 0;
  var rateExtra = parseFloat(document.getElementById('pp-rate-extra').value) || 0;
  var startDate = document.getElementById('pp-start-date').value || null;
  var endDate = document.getElementById('pp-end-date').value || null;
  var note = document.getElementById('pp-note').value.trim();

  if (!patientId) { toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23', 'warning'); return; }
  if (!name) { toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08', 'warning'); return; }

  var data = {
    patient_id: patientId, name: name,
    sessions_included: sessionsIncluded, rate_per_hour_extra: rateExtra,
    start_date: startDate, end_date: endDate, note: note, is_active: true
  };

  var err;
  if (editId) {
    var res = await supa.from('physio_packages').update(data).eq('id', editId);
    err = res.error;
  } else {
    data.sessions_used = 0;
    data.created_by = currentUser ? currentUser.username : '';
    var res = await supa.from('physio_packages').insert(data);
    err = res.error;
  }
  if (err) { toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + err.message, 'error'); return; }
  toast(editId ? '\u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e25\u0e49\u0e27' : '\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e41\u0e25\u0e49\u0e27', 'success');
  closeModal('modal-physio-package');
  renderPhysioPackages();
}

async function deactivatePhysioPackage(id) {
  if (!confirm('\u0e1b\u0e34\u0e14\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e19\u0e35\u0e49?')) return;
  var res = await supa.from('physio_packages').update({ is_active: false }).eq('id', id);
  if (res.error) { toast('\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error'); return; }
  toast('\u0e1b\u0e34\u0e14\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e41\u0e25\u0e49\u0e27');
  renderPhysioPackages();
}
