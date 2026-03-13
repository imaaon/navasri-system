// ===== DASHBOARD MODULE =====

// ===== DASHBOARD =====
function renderDashboard() {
  const role = currentUser?.role || 'staff';
  // แสดง Dashboard ตาม Role
  if (role === 'nurse' || role === 'caregiver') {
    renderNurseDashboard();
    return;
  }
  renderAdminDashboard();
}

function renderNurseDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];
  const activePatients = db.patients.filter(p => p.status === 'active');

  // นัดหมายสัปดาห์นี้
  const weekLater = new Date(); weekLater.setDate(weekLater.getDate() + 7);
  const weekStr = weekLater.toISOString().split('T')[0];
  const upcomingAppts = (db.appointments || []).filter(a =>
    a.apptDate >= todayStr && a.apptDate <= weekStr && a.status !== 'done'
  ).sort((a,b) => a.apptDate.localeCompare(b.apptDate));

  // ยาที่ยังไม่ได้บันทึกวันนี้
  const missedMeds = [];
  activePatients.forEach(p => {
    const meds = db.medications?.[p.internalId] || [];
    meds.filter(m => m.active !== false).forEach(med => {
      const todayRecord = (db.marRecords?.[p.internalId] || []).find(r =>
        r.medicationId == med.id && r.date === todayStr
      );
      if (!todayRecord) missedMeds.push({ patient: p.name, med: med.name, patientId: p.id });
    });
  });

  const dashEl = document.getElementById('page-dashboard');
  dashEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${activePatients.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">👥 ผู้รับบริการปัจจุบัน</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#e67e22;">${upcomingAppts.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">📅 นัดหมายสัปดาห์นี้</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#c0392b;">${missedMeds.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">💊 ยาที่ยังไม่บันทึกวันนี้</div>
      </div>
    </div>

    ${upcomingAppts.length > 0 ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><div class="card-title">📅 นัดหมายสัปดาห์นี้</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--bg2);">
          <th style="padding:8px 12px;text-align:left;">วันที่</th>
          <th style="padding:8px 12px;text-align:left;">ผู้รับบริการ</th>
          <th style="padding:8px 12px;text-align:left;">สถานที่/แพทย์</th>
        </tr></thead>
        <tbody>${upcomingAppts.slice(0,10).map(a => `<tr style="border-top:1px solid var(--border);">
          <td style="padding:8px 12px;font-weight:600;color:var(--accent);">${a.apptDate}</td>
          <td style="padding:8px 12px;">${a.patientName || '-'}</td>
          <td style="padding:8px 12px;color:var(--text2);">${a.location || a.doctor || '-'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}

    ${missedMeds.length > 0 ? `
    <div class="card">
      <div class="card-header"><div class="card-title" style="color:#c0392b;">💊 ยาที่ยังไม่บันทึกวันนี้</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#fff5f5;">
          <th style="padding:8px 12px;text-align:left;">ผู้รับบริการ</th>
          <th style="padding:8px 12px;text-align:left;">ยา</th>
        </tr></thead>
        <tbody>${missedMeds.slice(0,15).map(m => `<tr style="border-top:1px solid var(--border);">
          <td style="padding:8px 12px;font-weight:600;">${m.patient}</td>
          <td style="padding:8px 12px;color:#c0392b;">💊 ${m.med}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="card" style="padding:20px;text-align:center;color:#27ae60;">✅ บันทึกการให้ยาครบทุกรายการแล้ววันนี้</div>`}
  `;
}

function renderAdminDashboard() {
  const lowItems = db.items.filter(i => i.qty <= i.reorder);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReqs = db.requisitions.filter(r => r.date === todayStr);

  document.getElementById('stat-total').textContent = db.items.length;
  document.getElementById('stat-low').textContent = lowItems.length;
  document.getElementById('stat-today').textContent = todayReqs.length;
  document.getElementById('stat-patients').textContent = db.patients.filter(p => p.status === 'active').length;

  // Low stock table
  const lowTb = document.getElementById('lowStockTable');
  if (lowItems.length === 0) {
    lowTb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;">✅ ไม่มีสินค้าใกล้หมด</td></tr>';
  } else {
    lowTb.innerHTML = lowItems.slice(0, 8).map(item => {
      const pct = Math.min(100, (item.qty / Math.max(item.reorder * 2, 1)) * 100);
      const badge = item.qty === 0 ? '<span class="badge badge-red">หมดแล้ว</span>' : '<span class="badge badge-orange">ใกล้หมด</span>';
      return `<tr class="${item.qty === 0 ? 'critical-stock' : 'low-stock'}">
        <td>${item.name}</td>
        <td class="number" style="font-weight:600;">${item.qty}</td>
        <td>${item.unit}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
  }

  // Recent timeline
  const tl = document.getElementById('recentTimeline');
  const recent = [...db.requisitions].sort((a,b) => b.id - a.id).slice(0, 8);
  if (recent.length === 0) {
    tl.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">ยังไม่มีการเบิก</div></div>';
  } else {
    tl.innerHTML = recent.map(r => {
      const catColors = { ยา:'#e05050', เวชภัณฑ์:'#e07040', ของใช้:'#4070c0', บริการ:'#9060c0' };
      const item = db.items.find(i => i.id === r.itemId);
      const color = item ? (catColors[item.category] || '#888') : '#888';
      return `<div class="tl-item">
        <div class="tl-dot" style="background:${color}20;color:${color};">📦</div>
        <div class="tl-content">
          <div class="tl-title">${r.itemName} <span class="tag">${r.qty} ${r.unit}</span></div>
          <div class="tl-meta">${r.patientName} · ${r.staffName} · ${r.date}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Expiry alert
  const expiryLots = (db.itemLots || []).filter(l => {
    if (!l.expiryDate || l.qtyRemaining <= 0) return false;
    return getLotStatus(l.expiryDate) !== 'ok';
  }).sort((a,b) => (a.expiryDate||'').localeCompare(b.expiryDate||''));
  const expiryCard = document.getElementById('expiry-alert-card');
  const expiryTb   = document.getElementById('expiryAlertTable');
  if (expiryLots.length > 0) {
    expiryCard.style.display = '';
    expiryTb.innerHTML = expiryLots.slice(0,10).map(lot => {
      const item   = db.items.find(i => i.id == lot.itemId);
      const status = getLotStatus(lot.expiryDate);
      const badge  = status === 'expired'
        ? '<span class="badge badge-red">หมดอายุแล้ว</span>'
        : '<span class="badge badge-orange">ใกล้หมดอายุ</span>';
      const today = new Date(); today.setHours(0,0,0,0);
      const exp   = new Date(lot.expiryDate);
      const diff  = Math.ceil((exp - today) / 86400000);
      const diffTxt = diff < 0 ? `เกินมา ${Math.abs(diff)} วัน` : `อีก ${diff} วัน`;
      return `<tr style="${status==='expired'?'background:#fff5f5':'background:#fff8f0'}">
        <td style="font-weight:600;">${item?.name||'-'}</td>
        <td style="font-family:monospace;font-size:12px;">${lot.lotNumber||'-'}</td>
        <td class="number">${lot.qtyRemaining}</td>
        <td>${item?.dispenseUnit||item?.unit||''}</td>
        <td style="font-family:monospace;">${lot.expiryDate} <span style="font-size:11px;color:${status==='expired'?'#c0392b':'#e67e22'};">(${diffTxt})</span></td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
  } else {
    expiryCard.style.display = 'none';
  }

  // Category summary
  const catDiv = document.getElementById('catSummary');
  const catColors2 = { ยา:{bg:'#fdecea',color:'#c0392b',icon:'💊'}, เวชภัณฑ์:{bg:'#fef3e0',color:'#d4760a',icon:'🩺'}, ของใช้:{bg:'#e8f0fa',color:'#1e5fa0',icon:'🧴'}, บริการ:{bg:'#f0e8fa',color:'#6e3fa0',icon:'⚕️'} };
  const cats = ['ยา','เวชภัณฑ์','ของใช้','บริการ'];
  catDiv.innerHTML = cats.map(cat => {
    const count = db.items.filter(i => i.category === cat).length;
    const lowCount = db.items.filter(i => i.category === cat && i.qty <= i.reorder).length;
    const c = catColors2[cat] || {bg:'#f0f0f0',color:'#888',icon:'📦'};
    return `<div style="background:${c.bg};border-radius:10px;padding:16px;text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;">${c.icon}</div>
      <div style="font-weight:700;color:${c.color};font-size:22px;font-family:var(--mono);">${count}</div>
      <div style="font-size:12px;font-weight:600;color:${c.color};margin-top:2px;">${cat}</div>
      ${lowCount > 0 ? `<div style="font-size:11px;color:var(--red);margin-top:4px;">⚠️ ${lowCount} รายการใกล้หมด</div>` : '<div style="font-size:11px;color:var(--green);margin-top:4px;">✅ ปกติ</div>'}
    </div>`;
  }).join('');
  renderUpcomingAppts();
}  // end renderAdminDashboard