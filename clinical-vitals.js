// ===== DASHBOARD MODULE =====

// ===== DASHBOARD =====
function renderDashboard() {
  const role = currentUser?.role || 'staff';
  // admin / manager / officer → full admin dashboard
  if (['admin', 'manager', 'officer'].includes(role)) {
    renderAdminDashboard();
    return;
  }
  // ทุก role อื่น → staff dashboard (nurse, caregiver, warehouse, accounting, supervisor, physical_therapist)
  renderStaffDashboard();
}

// ===== STAFF DASHBOARD (nurse / caregiver / warehouse / accounting / supervisor / physical_therapist) =====
async function renderStaffDashboard() {
  const dashEl = document.getElementById('page-dashboard');
  const todayStr = new Date().toISOString().split('T')[0];
  const activePatients = db.patients.filter(p => p.status === 'active');
  const userName = currentUser?.displayName || currentUser?.username || '';
  const role = currentUser?.role || '';

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

  // โหลดรายการเบิกของตัวเองจาก Supabase
  const { data: myReqData } = await supa
    .from('requisition_headers')
    .select('*, requisition_lines(*)')
    .order('id', { ascending: false })
    .limit(100);

  // กรองเฉพาะของตัวเอง เทียบจาก staff_name หรือ created_by
  const allMyReqs = (myReqData || [])
    .map(mapReq)
    .filter(r => r.staffName === userName || r.createdBy === (currentUser?.username || ''));

  const myPending  = allMyReqs.filter(r => r.status === 'pending');
  const myApproved = allMyReqs.filter(r => r.status === 'approved');

  // โหลดรายการรออนุมัติทั้งหมด (ทุก role เห็น)
  const { data: pendingData } = await supa
    .from('requisition_headers')
    .select('*, requisition_lines(*)')
    .eq('status', 'pending')
    .order('id', { ascending: false })
    .limit(20);
  const allPending = (pendingData || []).map(mapReq);

  const STATUS_BADGE = s => {
    if (s === 'approved') return '<span style="font-size:11px;padding:2px 10px;border-radius:12px;background:#e8f5ee;color:#2a7a4f;">อนุมัติแล้ว</span>';
    if (s === 'rejected') return '<span style="font-size:11px;padding:2px 10px;border-radius:12px;background:#fdecea;color:#c0392b;">ไม่อนุมัติ</span>';
    return '<span style="font-size:11px;padding:2px 10px;border-radius:12px;background:#fef3e0;color:#d4760a;">รออนุมัติ</span>';
  };

  dashEl.innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="font-size:18px;font-weight:700;color:var(--text);">สวัสดี, ${userName} 👋</div>
      <div style="font-size:13px;color:var(--text2);margin-top:2px;">${todayStr} · ${role}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${activePatients.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">👥 ผู้รับบริการ</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;cursor:pointer;" onclick="showPage('history')">
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${allMyReqs.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">📋 เบิกทั้งหมด (ของฉัน)</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;border:${myPending.length > 0 ? '2px solid #e67e22' : '0.5px solid var(--border)'};">
        <div style="font-size:28px;font-weight:800;color:#e67e22;">${myPending.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">⏳ ของฉัน รออนุมัติ</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#27ae60;">${myApproved.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">✅ อนุมัติแล้ว</div>
      </div>
      ${allPending.length > 0 ? `
      <div class="card" style="padding:18px;text-align:center;border:2px solid #e74c3c;cursor:pointer;" onclick="showPage('history');setTimeout(()=>switchHistoryTab('approval'),300)">
        <div style="font-size:28px;font-weight:800;color:#e74c3c;">${allPending.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">🔔 ใบเบิกรออนุมัติ (ทั้งหมด)</div>
      </div>` : ''}
    </div>

    ${myPending.length > 0 ? `
    <div style="background:#fef3e0;border:1px solid #f5c97a;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">⏳</span>
      <div>
        <div style="font-weight:600;color:#b7600a;font-size:13px;">มีใบเบิกของคุณ ${myPending.length} รายการ กำลังรออนุมัติจากธุรการ</div>
        <div style="font-size:12px;color:#c97a20;margin-top:2px;">ระบบจะอัปเดตสถานะเมื่อธุรการดำเนินการ</div>
      </div>
    </div>` : ''}

    ${allPending.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border:1.5px solid #e67e22;">
      <div class="card-header" style="background:#fef3e0;">
        <div class="card-title" style="color:#e67e22;">⏳ ใบเบิกรออนุมัติทั้งหมด (${allPending.length} รายการ)</div>
        ${canApproveReq()
          ? `<button class="btn btn-sm" style="background:#e67e22;color:#fff;font-size:11px;" onclick="showPage('history');setTimeout(()=>switchHistoryTab('approval'),300)">ไปหน้าอนุมัติ →</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="showPage('history');setTimeout(()=>switchHistoryTab('approval'),300)">ดูทั้งหมด</button>`}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วันที่</th><th>เลขที่</th><th>ผู้รับบริการ</th><th>รายการ</th><th>ผู้เบิก</th>${canApproveReq() ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${allPending.map(r => {
              const itemSummary = r.lines?.length > 0
                ? r.lines.map(l => `${l.itemName} (${l.qty} ${l.unit})`).join(', ')
                : `${r.itemName||'-'} (${r.qty||0} ${r.unit||''})`;
              const isMyReq = r.staffName === userName;
              return `<tr style="${isMyReq ? 'background:#fffbf0;' : ''}">
                <td style="font-size:12px;white-space:nowrap;">${r.date||'-'}${isMyReq ? ' <span style="font-size:10px;color:#e67e22;">(ของฉัน)</span>' : ''}</td>
                <td style="font-family:monospace;font-size:12px;">${r.refNo||'#'+r.id}</td>
                <td style="font-weight:600;">${r.patientName||'-'}</td>
                <td style="font-size:12px;max-width:200px;">${itemSummary}</td>
                <td style="font-size:12px;">${r.staffName||'-'}</td>
                ${canApproveReq() ? `<td style="white-space:nowrap;">
                  <button class="btn btn-primary btn-sm" onclick="approveReq('${r.id}');setTimeout(renderDashboard,800)" style="font-size:11px;">✅ อนุมัติ</button>
                  <button class="btn btn-sm" style="background:#e74c3c22;color:#e74c3c;font-size:11px;" onclick="openRejectModal('${r.id}')">❌ ไม่อนุมัติ</button>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : `
    <div class="card" style="padding:16px;text-align:center;color:#27ae60;margin-bottom:16px;">✅ ไม่มีใบเบิกรออนุมัติ</div>`}

    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div class="card-title">📦 ประวัติการเบิกของฉัน</div>
        <button class="btn btn-ghost btn-sm" onclick="showPage('requisition')">+ เบิกสินค้าใหม่</button>
      </div>
      ${allMyReqs.length === 0
        ? `<div style="padding:24px;text-align:center;color:var(--text3);">ยังไม่มีประวัติการเบิก</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>วันที่</th><th>เลขที่</th><th>ผู้รับบริการ</th><th>รายการ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${allMyReqs.slice(0, 15).map(r => {
                const itemSummary = r.lines?.length > 0
                  ? r.lines.map(l => `${l.itemName} (${l.qty} ${l.unit})`).join(', ')
                  : `${r.itemName||'-'} (${r.qty||0} ${r.unit||''})`;
                return `<tr>
                  <td style="font-size:12px;white-space:nowrap;">${r.date||'-'}</td>
                  <td style="font-family:monospace;font-size:12px;">${r.refNo||'#'+r.id}</td>
                  <td style="font-weight:600;">${r.patientName||'-'}</td>
                  <td style="font-size:12px;max-width:220px;">${itemSummary}</td>
                  <td>${STATUS_BADGE(r.status)}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">🖨️</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${allMyReqs.length > 15 ? `<div style="padding:10px 16px;font-size:12px;color:var(--text3);text-align:right;">
            แสดง 15 รายการล่าสุด · <a href="#" onclick="showPage('history');return false;" style="color:var(--accent);">ดูทั้งหมด ${allMyReqs.length} รายการ</a>
          </div>` : ''}
        </div>`}
    </div>

    ${['nurse','caregiver','supervisor'].includes(role) && upcomingAppts.length > 0 ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><div class="card-title">📅 นัดหมายสัปดาห์นี้</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--bg2);">
          <th style="padding:8px 12px;text-align:left;">วันที่</th>
          <th style="padding:8px 12px;text-align:left;">ผู้รับบริการ</th>
          <th style="padding:8px 12px;text-align:left;">สถานที่/แพทย์</th>
        </tr></thead>
        <tbody>${upcomingAppts.slice(0,8).map(a => `<tr style="border-top:1px solid var(--border);">
          <td style="padding:8px 12px;font-weight:600;color:var(--accent);">${a.apptDate}</td>
          <td style="padding:8px 12px;">${a.patientName||'-'}</td>
          <td style="padding:8px 12px;color:var(--text2);">${a.location||a.doctor||'-'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}

    ${['nurse','caregiver'].includes(role) ? (missedMeds.length > 0 ? `
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
    </div>` : `<div class="card" style="padding:20px;text-align:center;color:#27ae60;">✅ บันทึกการให้ยาครบทุกรายการแล้ววันนี้</div>`) : ''}
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
  if (typeof renderUpcomingAppts === 'function') renderUpcomingAppts();

  // ── Executive Stats (Phase 4) ──────────────────────────────
  const monthStr = new Date().toISOString().slice(0,7);
  const el_staff    = document.getElementById('stat-staff');
  const el_expiry   = document.getElementById('stat-expiry');
  const el_recv     = document.getElementById('stat-recv-month');
  const el_prPend   = document.getElementById('stat-pr-pending');

  if (el_staff)  el_staff.textContent  = (db.staff||[]).filter(s=>!s.endDate||s.endDate>new Date().toISOString().slice(0,10)).length;
  if (el_expiry) el_expiry.textContent = (db.itemLots||[]).filter(l=>l.expiryDate&&l.qtyRemaining>0&&typeof getLotStatus==='function'&&getLotStatus(l.expiryDate)!=='ok').length;
  if (el_recv)   el_recv.textContent   = (db.purchases||[]).filter(p=>(p.date||'').startsWith(monthStr)).length;
  if (el_prPend) el_prPend.textContent = (db.purchaseRequests||[]).filter(r=>['draft','submitted'].includes(r.status)).length;

  // ── Pending Requisitions Widget ───────────────────────────
  renderDashPendingReqs();

  // ── Executive Alerts ──────────────────────────────────────
  const alertSection = document.getElementById('exec-alerts-section');
  const alertBody    = document.getElementById('exec-alerts-body');
  if (alertSection && alertBody) {
    const alerts = [];
    // สินค้าหมด
    const outItems = (db.items||[]).filter(i=>i.qty<=0);
    if (outItems.length > 0) alerts.push(`🔴 <b>สินค้าหมดสต็อก ${outItems.length} รายการ</b> — ต้องสั่งด่วน`);
    // PR รออนุมัตินานเกิน 3 วัน
    const staleDate = new Date(); staleDate.setDate(staleDate.getDate()-3);
    const stalePRs = (db.purchaseRequests||[]).filter(r=>r.status==='submitted'&&r.createdAt&&new Date(r.createdAt)<staleDate);
    if (stalePRs.length > 0) alerts.push(`🟡 <b>คำขอซื้อรออนุมัติ ${stalePRs.length} รายการ</b> (เกิน 3 วัน)`);
    // Expiry ภายใน 7 วัน
    const urgentExp = (db.itemLots||[]).filter(l=>{
      if (!l.expiryDate||l.qtyRemaining<=0) return false;
      const diff = Math.ceil((new Date(l.expiryDate)-new Date())/86400000);
      return diff>=0 && diff<=7;
    });
    if (urgentExp.length > 0) alerts.push(`🟠 <b>สินค้าหมดอายุใน 7 วัน ${urgentExp.length} Lot</b>`);
    // Billable reqs ยังไม่ออกบิล
    const unbilledPats = new Set((db.requisitions||[]).filter(r=>r.status==='approved').map(r=>r.patientId)).size;
    if (unbilledPats > 0) alerts.push(`🔵 <b>${unbilledPats} ผู้รับบริการ</b> มีรายการเบิกที่ยังไม่ออกบิล`);

    if (alerts.length > 0) {
      alertSection.style.display = '';
      alertBody.innerHTML = alerts.map(a=>`<div style="padding:8px 0;border-bottom:0.5px solid var(--border);font-size:13px;">${a}</div>`).join('');
    } else {
      alertSection.style.display = 'none';
    }
  }

  // ── Cost Summary ──────────────────────────────────────────
  const costEl = document.getElementById('dash-cost-summary');
  if (costEl) {
    const monthPurchases = (db.purchases||[]).filter(p=>(p.date||'').startsWith(monthStr));
    const totalCost = monthPurchases.reduce((s,p)=>s+(p.cost||0)*(p.qty||0),0);
    const monthReqs  = (db.requisitions||[]).filter(r=>(r.date||'').startsWith(monthStr)&&r.status==='approved');
    const billableAmt = monthReqs.reduce((s,r)=>{
      const item = db.items.find(i=>i.id==r.itemId);
      return s + (item?.isBillable!==false ? (item?.price||item?.cost||0)*(r.qty||0) : 0);
    },0);
    costEl.innerHTML =
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">` +
      `<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text3);">รับสินค้า</div><div style="font-size:20px;font-weight:600;">฿${totalCost.toLocaleString()}</div></div>` +
      `<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text3);">ค่าใช้จ่าย Billable</div><div style="font-size:20px;font-weight:600;color:var(--green);">฿${billableAmt.toLocaleString()}</div></div>` +
      `</div>`;
  }

  // ── PR Summary ────────────────────────────────────────────
  const prEl = document.getElementById('dash-pr-summary');
  if (prEl) {
    const prs = db.purchaseRequests||[];
    const statusLabel = {draft:'ร่าง',submitted:'รอ',approved:'อนุมัติ',rejected:'ไม่อนุมัติ',ordered:'สั่งแล้ว',received:'รับแล้ว',closed:'ปิด'};
    const counts = {};
    prs.forEach(r=>{counts[r.status]=(counts[r.status]||0)+1;});
    if (Object.keys(counts).length===0) {
      prEl.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">ยังไม่มีคำขอซื้อ</div>';
    } else {
      prEl.innerHTML = Object.entries(counts).map(([s,n])=>
        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:13px;"><span>${statusLabel[s]||s}</span><span style="font-weight:600;">${n}</span></div>`
      ).join('');
    }
  }
}  // end renderAdminDashboard

// ── Pending Requisitions Dashboard Widget ─────────────────────
async function renderDashPendingReqs() {
  const card  = document.getElementById('dash-pending-req-card');
  const tb    = document.getElementById('dash-pending-req-table');
  const statEl= document.getElementById('stat-req-pending');
  const statCard = document.getElementById('stat-card-req-pending');
  if (!card || !tb) return;

  // โหลดล่าสุดจาก Supabase เสมอ
  const { data } = await supa
    .from('requisition_headers')
    .select('*, requisition_lines(*)')
    .eq('status', 'pending')
    .order('id', { ascending: false })
    .limit(20);

  const pending = (data || []).map(mapReq);

  // อัปเดต stat card
  if (statEl) statEl.textContent = pending.length;
  if (statCard) {
    statCard.style.display = canApproveReq() || pending.length > 0 ? '' : 'none';
    statCard.style.opacity = pending.length === 0 ? '0.5' : '1';
  }

  if (pending.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = '';

  tb.innerHTML = pending.map(r => {
    // รวมชื่อรายการจาก lines ถ้ามี
    const itemSummary = r.lines?.length > 0
      ? r.lines.map(l => `${l.itemName} (${l.qty} ${l.unit})`).join(', ')
      : `${r.itemName || '-'} (${r.qty || 0} ${r.unit || ''})`;

    return `<tr>
      <td style="font-size:12px;white-space:nowrap;">${r.date || '-'}</td>
      <td style="font-family:monospace;font-size:12px;">${r.refNo || '#' + r.id}</td>
      <td style="font-weight:600;">${r.patientName || '-'}</td>
      <td style="font-size:12px;">${itemSummary}</td>
      <td style="font-size:12px;">${r.staffName || '-'}</td>
      <td style="white-space:nowrap;">
        ${canApproveReq() ? `
          <button class="btn btn-primary btn-sm" onclick="approveReq('${r.id}');setTimeout(renderDashPendingReqs,600)" style="font-size:11px;">✅ อนุมัติ</button>
          <button class="btn btn-sm" style="background:#e74c3c22;color:#e74c3c;font-size:11px;" onclick="openRejectModal('${r.id}')">❌ ไม่อนุมัติ</button>
        ` : `<button class="btn btn-ghost btn-sm" onclick="showPage('history');setTimeout(()=>switchHistoryTab('approval'),300)" style="font-size:11px;">ดูรายละเอียด</button>`}
      </td>
    </tr>`;
  }).join('');
}