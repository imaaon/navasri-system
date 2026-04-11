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
        <div style="font-size:28px;font-weight:800;color:#f5a453;">${upcomingAppts.length}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;">📅 นัดหมายสัปดาห์นี้</div>
      </div>
      <div class="card" style="padding:18px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:var(--red);">${missedMeds.length}</div>
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
      <div class="card-header"><div class="card-title" style="color:var(--red);">💊 ยาที่ยังไม่บันทึกวันนี้</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--red-light);">
          <th style="padding:8px 12px;text-align:left;">ผู้รับบริการ</th>
          <th style="padding:8px 12px;text-align:left;">ยา</th>
        </tr></thead>
        <tbody>${missedMeds.slice(0,15).map(m => `<tr style="border-top:1px solid var(--border);">
          <td style="padding:8px 12px;font-weight:600;">${m.patient}</td>
          <td style="padding:8px 12px;color:var(--red);">💊 ${m.med}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="card" style="padding:20px;text-align:center;color:#0a3626;">✅ บันทึกการให้ยาครบทุกรายการแล้ววันนี้</div>`}
  `;
}

function renderAdminDashboard() {
  const lowItems = db.items.filter(i => i.qty <= i.reorder);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReqs = db.requisitions.filter(r => r.date === todayStr);

  const _st=document.getElementById('stat-total'); if(_st) _st.textContent = db.items.length;
  const _sl=document.getElementById('stat-low'); if(_sl) _sl.textContent = lowItems.length;
  const _sd=document.getElementById('stat-today'); if(_sd) _sd.textContent = todayReqs.length;
  const _sp=document.getElementById('stat-patients'); if(_sp) _sp.textContent = db.patients.filter(p => p.status === 'active').length;

  // Low stock table
  const lowTb = document.getElementById('lowStockTable'); if(!lowTb) return;
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
  const recent = [...db.requisitions].sort((a,b) => (b.createdAt||b.date||'').localeCompare(a.createdAt||a.date||'')).slice(0, 8);
  if (recent.length === 0) {
    tl.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">ยังไม่มีการเบิก</div></div>';
  } else {
    tl.innerHTML = recent.map(r => {
      const catColors = { ยา:'#f4a7b9', เวชภัณฑ์:'#f5a453', ของใช้:'#7ab8d4', บริการ:'#b39ddb' };
      // รองรับทั้ง schema ใหม่ (lines[]) และเก่า (itemId/itemName)
      const displayLines = (r.lines && r.lines.length > 0) ? r.lines : [{ itemName: r.itemName, qty: r.qty, unit: r.unit, itemId: r.itemId }];
      const firstLine = displayLines[0] || {};
      const item = db.items.find(i => i.id === (firstLine.itemId || r.itemId));
      const color = item ? (catColors[item.category] || '#888') : '#888';
      const moreLines = displayLines.length > 1 ? ` <span style="font-size:11px;color:var(--text3);">+${displayLines.length-1} รายการ</span>` : '';
      return `<div class="tl-item">
        <div class="tl-dot" style="background:${color}20;color:${color};">📦</div>
        <div class="tl-content">
          <div class="tl-title">${firstLine.itemName||r.itemName||'-'} <span class="tag">${firstLine.qty||r.qty||0} ${firstLine.unit||r.unit||''}</span>${moreLines}</div>
          <div class="tl-meta">${r.patientName||'-'} · ${r.staffName||'-'} · ${r.date||'-'}</div>
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
      return `<tr style="${status==='expired'?'background:var(--red-light)':'background:var(--orange-light)'}">
        <td style="font-weight:600;">${item?.name||'-'}</td>
        <td style="font-family:monospace;font-size:12px;">${lot.lotNumber||'-'}</td>
        <td class="number">${lot.qtyRemaining}</td>
        <td>${item?.dispenseUnit||item?.unit||''}</td>
        <td style="font-family:monospace;">${lot.expiryDate} <span style="font-size:11px;color:${status==='expired'?'var(--red)':'#f5a453'};">(${diffTxt})</span></td>
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
    const billableAmt = monthReqs.reduce((s, r) => {
      // รองรับทั้ง schema ใหม่ (lines[]) และเก่า (itemId/qty)
      const linesToCheck = (r.lines && r.lines.length > 0) ? r.lines : [{ itemId: r.itemId, qty: r.qty||0 }];
      return s + linesToCheck.reduce((ls, line) => {
        const item = db.items.find(i => i.id == line.itemId);
        return ls + (item?.isBillable !== false ? (item?.price||item?.cost||0) * (line.qty||0) : 0);
      }, 0);
    }, 0);
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

  // ---- Widget: ครุภัณฑ์ใกล้ถึงเวลาซ่อม ----
  const _maintEl = document.getElementById('dash-maintenance-widget');
  if (_maintEl && db.assets && db.assets.length) {
    const _today = new Date();
    const _soon  = new Date(_today); _soon.setDate(_today.getDate()+30);
    const _soonStr = _soon.toISOString().slice(0,10);
    const _due = db.assets.filter(a=>a.status==='active'&&a.next_maintenance_date&&a.next_maintenance_date<=_soonStr)
      .sort((a,b)=>a.next_maintenance_date.localeCompare(b.next_maintenance_date));
    if (!_due.length) {
      _maintEl.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">ไม่มีครุภัณฑ์ใกล้ถึงเวลาซ่อม</div>';
    } else {
      _maintEl.innerHTML = _due.slice(0,5).map(a=>{
        const d = Math.ceil((new Date(a.next_maintenance_date)-_today)/864e5);
        const col = d<0?'var(--red)':d<=7?'#f5a453':'#f5c842';
        const lbl = d<0?'เลยกำหนด '+Math.abs(d)+' วัน':'อีก '+d+' วัน';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:0.5px solid var(--border);font-size:13px;cursor:pointer;" onclick="showPage(\'assets\')">'+
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+a.asset_no+' '+a.name+'</span>'+
          '<span style="color:'+col+';font-weight:600;white-space:nowrap;margin-left:8px;">'+lbl+'</span></div>';
      }).join('');
      if (_due.length>5) _maintEl.innerHTML += '<div style="font-size:12px;color:var(--text2);text-align:center;padding:6px;">และอีก '+(_due.length-5)+' รายการ</div>';
    }
  }
  }
  renderIncidentWidget();
}  // end renderAdminDashboard

function renderIncidentWidget() {
  const el = document.getElementById('dash-incident-widget');
  if (!el) return;
  const now = new Date();
  const tz7 = new Date(now.getTime() + 7*60*60*1000);
  const y = tz7.getUTCFullYear(), m = String(tz7.getUTCMonth()+1).padStart(2,'0');
  const monthStr = y+'-'+m;
  const todayStr = tz7.toISOString().slice(0,10);
  const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthLabel = thMonth[tz7.getUTCMonth()] + ' ' + (y+543);
  const incidents = (db.incidentReports || []);

  // --- Card 1: อุบัติเหตุประจำเดือน ---
  const monthInc = incidents.filter(r => (r.date||'').startsWith(monthStr));
  const prevM = new Date(Date.UTC(y, tz7.getUTCMonth()-1, 1));
  const prevStr = prevM.getUTCFullYear()+'-'+String(prevM.getUTCMonth()+1).padStart(2,'0');
  const prevCount = incidents.filter(r => (r.date||'').startsWith(prevStr)).length;
  const diff = monthInc.length - prevCount;
  const diffTxt = diff === 0 ? 'เท่ากับเดือนก่อน' : (diff > 0 ? '▲ เพิ่มขึ้น '+diff : '▼ ลดลง '+Math.abs(diff));
  const diffColor = diff > 0 ? 'var(--red)' : diff < 0 ? '#5ecba1' : '#888';
  const numColor = monthInc.length === 0 ? '#5ecba1' : 'var(--red)';

  // --- Card 2: วันที่ไม่เกิดอุบัติเหตุ ---
  const sorted = [...incidents].filter(r=>r.date).sort((a,b)=>b.date.localeCompare(a.date));
  const lastInc = sorted[0];
  let streakDays = 0, lastIncDate = '-', streakColor = '#5ecba1', streakBorder = '#5ecba1';
  if (lastInc) {
    const last = new Date(lastInc.date + 'T00:00:00+07:00');
    const today = new Date(todayStr + 'T00:00:00+07:00');
    streakDays = Math.max(0, Math.floor((today - last) / 86400000));
    lastIncDate = lastInc.date;
    if (streakDays === 0) { streakColor = 'var(--red)'; streakBorder = 'var(--red)'; }
    else if (streakDays < 7) { streakColor = '#f5a453'; streakBorder = '#f5a453'; }
  } else {
    // ไม่เคยมีอุบัติเหตุ — นับตั้งแต่ admit แรกสุด หรือ 0
    streakDays = 0;
  }

  // --- Bar chart 6 เดือนย้อนหลัง ---
  const months6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, tz7.getUTCMonth()-i, 1));
    months6.push({ str: d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'), label: thMonth[d.getUTCMonth()] });
  }
  const barData = months6.map(m => ({ label: m.label, count: incidents.filter(r=>(r.date||'').startsWith(m.str)).length }));
  const maxBar = Math.max(...barData.map(b=>b.count), 1);

  const barHtml = barData.map(b => {
    const pct = Math.round((b.count / maxBar) * 100);
    const color = b.count === 0 ? 'var(--surface2)' : 'var(--red)';
    const numColor2 = b.count === 0 ? '#5ecba1' : 'var(--red)';
    return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;">'
      +'<span style="width:30px;color:var(--text3);">'+b.label+'</span>'
      +'<div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">'
      +(b.count > 0 ? '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:4px;"></div>' : '')
      +'</div>'
      +'<span style="width:20px;text-align:right;color:'+numColor2+';font-weight:'+(b.count===0?'400':'500')+';">'+b.count+'</span>'
      +'</div>';
  }).join('');

  const streakBg = streakDays === 0 ? 'var(--red-light)' : streakDays < 7 ? 'var(--orange-light)' : '#e0f7ec';
  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'
    // card รายเดือน
    +'<div style="background:var(--surface2);border-radius:8px;padding:14px;">'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">อุบัติเหตุ — '+monthLabel+'</div>'
    +'<div style="font-size:32px;font-weight:500;color:'+numColor+';line-height:1;">'+monthInc.length+'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-top:4px;">ครั้ง</div>'
    +'<div style="font-size:11px;color:'+diffColor+';margin-top:6px;">'+diffTxt+'</div>'
    +'<div style="font-size:11px;color:var(--text3);">เดือนก่อน: '+prevCount+' ครั้ง</div>'
    +'</div>'
    // card streak
    +'<div style="background:'+streakBg+';border-radius:8px;padding:14px;">'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">วันที่ไม่เกิดอุบัติเหตุ</div>'
    +'<div style="display:flex;align-items:center;gap:12px;">'
    +'<div style="width:54px;height:54px;border-radius:50%;border:2.5px solid '+streakBorder+';background:var(--background);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">'
    +'<span style="font-size:20px;font-weight:500;color:'+streakColor+';line-height:1;">'+streakDays+'</span>'
    +'<span style="font-size:9px;color:'+streakColor+';">วัน</span>'
    +'</div>'
    +'<div>'
    +'<div style="font-size:12px;color:var(--text2);">นับตั้งแต่ครั้งล่าสุด</div>'
    +(lastIncDate !== '-' ? '<div style="font-size:11px;color:var(--text3);">'+lastIncDate+'</div>' : '<div style="font-size:11px;color:#5ecba1;">ยังไม่เคยมีบันทึก</div>')
    +'</div></div></div>'
    +'</div>'
    // bar chart
    +'<div style="border-top:0.5px solid var(--border);padding-top:14px;">'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">แนวโน้ม 6 เดือน</div>'
    +'<div style="display:flex;flex-direction:column;gap:5px;">'+barHtml+'</div>'
    +'</div>';
}
