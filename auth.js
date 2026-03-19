// ===== BUSINESS INTELLIGENCE MODULE =====
// นวศรี เนอร์สซิ่งโฮม — BI & Profit Analysis
// Data sources: db.invoices, db.payments, db.requisitions,
//               db.items, db.itemLots, db.patients, db.rooms, db.beds

// ── Helpers ──────────────────────────────────────────────────
function _monthStr(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

function _thb(n) {
  return '฿' + (Math.round(n || 0)).toLocaleString();
}

function _pct(num, den) {
  if (!den) return '0%';
  return Math.round(num / den * 100) + '%';
}

// หา room ของ patient ปัจจุบัน
function _getPatientZone(patient) {
  if (!patient?.currentBedId) return 'ไม่ระบุ';
  const bed  = (db.beds||[]).find(b => b.id == patient.currentBedId);
  const room = (db.rooms||[]).find(r => r.id == bed?.roomId);
  return room?.zone || room?.name || 'ไม่ระบุ';
}

// ── BI: แหล่งข้อมูล ──────────────────────────────────────────
function _biMonth() {
  return document.getElementById('bi-month')?.value || _monthStr(0);
}

function _invoicesMonth(month) {
  return (db.invoices||[]).filter(inv =>
    (inv.date||'').startsWith(month) && inv.status !== 'draft'
  );
}

function _paymentsMonth(month) {
  return (db.payments||[]).filter(p =>
    (p.paymentDate||'').startsWith(month)
  );
}

function _reqsMonth(month) {
  return (db.requisitions||[]).filter(r =>
    r.status === 'approved' && (r.date||'').startsWith(month)
  );
}

// ── Main render ───────────────────────────────────────────────
function renderBI() {
  const month = _biMonth();
  renderBIKPICards(month);
  renderBIRevenueBreakdown(month);
  renderBICostPerPatient(month);
  renderBIProfitByZone(month);
  renderBIPredictiveStock();
}

// ── 1. KPI Cards ──────────────────────────────────────────────
function renderBIKPICards(month) {
  const activePats  = (db.patients||[]).filter(p => p.status === 'active' || p.status === 'hospital');
  const totalBeds   = (db.beds||[]).length;
  const occupiedBeds= (db.beds||[]).filter(b => b.status === 'occupied').length;
  const invs        = _invoicesMonth(month);
  const pays        = _paymentsMonth(month);

  const revenue     = invs.reduce((s,i) => s + (i.grandTotal||0), 0);
  const collected   = pays.reduce((s,p) => s + (p.amount||0), 0);
  const reqs        = _reqsMonth(month);
  const costItems   = reqs.reduce((s,r) => {
    const item = db.items.find(i => i.id == r.itemId);
    return s + (item?.cost||0) * (r.qty||0);
  }, 0);
  const grossProfit = revenue - costItems;
  const occupancy   = totalBeds > 0 ? occupiedBeds / totalBeds * 100 : 0;
  const revPerPat   = activePats.length > 0 ? revenue / activePats.length : 0;

  const el = document.getElementById('bi-kpi-cards');
  if (!el) return;

  const cards = [
    { label: 'ผู้รับบริการ (Active)', value: activePats.length + ' คน', icon: '👥', color: 'blue', sub: `อัตราใช้เตียง ${_pct(occupiedBeds, totalBeds)} (${occupiedBeds}/${totalBeds})` },
    { label: 'รายรับรวมเดือนนี้', value: _thb(revenue), icon: '💰', color: 'green', sub: `เก็บแล้ว ${_thb(collected)}` },
    { label: 'ต้นทุนสินค้าเดือนนี้', value: _thb(costItems), icon: '📦', color: 'orange', sub: `${reqs.length} รายการเบิก` },
    { label: 'กำไรขั้นต้น', value: _thb(grossProfit), icon: grossProfit >= 0 ? '📈' : '📉', color: grossProfit >= 0 ? 'green' : 'red', sub: `Margin ${_pct(grossProfit, revenue)}` },
    { label: 'รายรับ/ผู้รับบริการ', value: _thb(revPerPat), icon: '🏥', color: 'purple', sub: `เฉลี่ยต่อคน` },
    { label: 'อัตราการใช้เตียง', value: Math.round(occupancy) + '%', icon: '🛏️', color: occupancy >= 80 ? 'green' : occupancy >= 50 ? 'orange' : 'red', sub: `${occupiedBeds} จาก ${totalBeds} เตียง` },
  ];

  const colorMap = { blue:'#2980b9', green:'#27ae60', orange:'#e67e22', red:'#e74c3c', purple:'#8e44ad' };
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">` +
    cards.map(c => {
      const col = colorMap[c.color] || '#888';
      return `<div style="background:#fff;border-radius:12px;padding:16px;border-left:4px solid ${col};box-shadow:0 1px 6px rgba(0,0,0,0.07);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${c.label}</div>
          <span style="font-size:20px;">${c.icon}</span>
        </div>
        <div style="font-size:24px;font-weight:700;color:${col};margin:6px 0 4px;">${c.value}</div>
        <div style="font-size:11px;color:var(--text2);">${c.sub}</div>
      </div>`;
    }).join('') + `</div>`;
}

// ── 2. Revenue Breakdown ──────────────────────────────────────
function renderBIRevenueBreakdown(month) {
  const el = document.getElementById('bi-revenue-breakdown');
  if (!el) return;
  const invs = _invoicesMonth(month);
  if (invs.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">ไม่มีข้อมูลในเดือนที่เลือก</div>';
    return;
  }

  const roomRev  = invs.reduce((s,i) => s + (i.roomTotal||0), 0);
  const medRev   = invs.reduce((s,i) => s + (i.medTotal||0), 0);
  const ptRev    = invs.reduce((s,i) => s + (i.ptTotal||0), 0);
  const otherRev = invs.reduce((s,i) => s + (i.otherTotal||0), 0);
  const total    = roomRev + medRev + ptRev + otherRev;

  const categories = [
    { label: '🛏️ ค่าห้องพัก', value: roomRev, color: '#2980b9' },
    { label: '💊 ค่ายา/เวชภัณฑ์', value: medRev, color: '#e74c3c' },
    { label: '🤸 กายภาพบำบัด', value: ptRev, color: '#27ae60' },
    { label: '📋 อื่นๆ', value: otherRev, color: '#8e44ad' },
  ].filter(c => c.value > 0);

  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">` +
    categories.map(c => {
      const pct = _pct(c.value, total);
      const barW = total > 0 ? Math.round(c.value / total * 100) : 0;
      return `<div style="background:var(--surface2);border-radius:8px;padding:12px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;">${c.label}</div>
        <div style="font-size:20px;font-weight:700;color:${c.color};">${_thb(c.value)}</div>
        <div style="margin-top:6px;background:var(--border);border-radius:4px;height:6px;">
          <div style="background:${c.color};border-radius:4px;height:6px;width:${barW}%;"></div>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px;">${pct} ของรายรับทั้งหมด</div>
      </div>`;
    }).join('') + `</div>`;
}

// ── 3. Cost & Profit per Patient ──────────────────────────────
function renderBICostPerPatient(month) {
  const el = document.getElementById('bi-cost-per-patient');
  if (!el) return;

  const invs = _invoicesMonth(month);
  const reqs = _reqsMonth(month);

  // รายรับ per patient
  const revByPat = {};
  invs.forEach(inv => {
    const pid = String(inv.patientId);
    if (!revByPat[pid]) revByPat[pid] = { name: inv.patientName, revenue: 0 };
    revByPat[pid].revenue += inv.grandTotal || 0;
  });

  // ต้นทุนสินค้า per patient
  const costByPat = {};
  reqs.forEach(r => {
    const pid = String(r.patientId);
    const item = db.items.find(i => i.id == r.itemId);
    const cost = (item?.cost || 0) * (r.qty || 0);
    if (!costByPat[pid]) costByPat[pid] = { name: r.patientName, cost: 0 };
    costByPat[pid].cost += cost;
  });

  // รวม
  const allPids = new Set([...Object.keys(revByPat), ...Object.keys(costByPat)]);
  const rows = [];
  allPids.forEach(pid => {
    const rev  = revByPat[pid]?.revenue || 0;
    const cost = costByPat[pid]?.cost   || 0;
    const name = revByPat[pid]?.name || costByPat[pid]?.name || '-';
    if (rev > 0 || cost > 0) rows.push({ pid, name, rev, cost, profit: rev - cost });
  });

  rows.sort((a, b) => b.profit - a.profit);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  const totalRev    = rows.reduce((s,r) => s + r.rev, 0);
  const totalCost   = rows.reduce((s,r) => s + r.cost, 0);
  const totalProfit = totalRev - totalCost;

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>ผู้รับบริการ</th>
      <th style="text-align:right;">รายรับ</th>
      <th style="text-align:right;">ต้นทุนสินค้า</th>
      <th style="text-align:right;">กำไรขั้นต้น</th>
      <th style="text-align:right;">Margin</th>
    </tr></thead><tbody>` +
    rows.slice(0, 20).map(r => {
      const profitColor = r.profit >= 0 ? 'var(--green)' : 'var(--red)';
      return `<tr>
        <td style="font-weight:500;">${r.name}</td>
        <td style="text-align:right;">${_thb(r.rev)}</td>
        <td style="text-align:right;color:var(--orange);">${_thb(r.cost)}</td>
        <td style="text-align:right;font-weight:600;color:${profitColor};">${_thb(r.profit)}</td>
        <td style="text-align:right;font-size:12px;color:var(--text2);">${_pct(r.profit, r.rev)}</td>
      </tr>`;
    }).join('') +
    `<tr style="background:var(--surface2);font-weight:700;">
      <td>รวม</td>
      <td style="text-align:right;">${_thb(totalRev)}</td>
      <td style="text-align:right;color:var(--orange);">${_thb(totalCost)}</td>
      <td style="text-align:right;color:${totalProfit>=0?'var(--green)':'var(--red)'};">${_thb(totalProfit)}</td>
      <td style="text-align:right;">${_pct(totalProfit, totalRev)}</td>
    </tr>
    </tbody></table></div>`;
}

// ── 4. Profit by Zone ─────────────────────────────────────────
function renderBIProfitByZone(month) {
  const el = document.getElementById('bi-profit-by-zone');
  if (!el) return;

  const invs = _invoicesMonth(month);
  const reqs = _reqsMonth(month);
  const activePats = (db.patients||[]).filter(p => p.status === 'active' || p.status === 'hospital');

  const zoneData = {};

  invs.forEach(inv => {
    const pat  = activePats.find(p => String(p.id) === String(inv.patientId));
    const zone = _getPatientZone(pat) || 'ไม่ระบุ';
    if (!zoneData[zone]) zoneData[zone] = { revenue: 0, cost: 0, patients: new Set() };
    zoneData[zone].revenue += inv.grandTotal || 0;
    if (pat) zoneData[zone].patients.add(String(pat.id));
  });

  reqs.forEach(r => {
    const pat  = activePats.find(p => String(p.id) === String(r.patientId));
    const zone = _getPatientZone(pat) || 'ไม่ระบุ';
    const item = db.items.find(i => i.id == r.itemId);
    if (!zoneData[zone]) zoneData[zone] = { revenue: 0, cost: 0, patients: new Set() };
    zoneData[zone].cost += (item?.cost || 0) * (r.qty || 0);
  });

  const rows = Object.entries(zoneData)
    .map(([zone, d]) => ({
      zone, revenue: d.revenue, cost: d.cost,
      profit: d.revenue - d.cost, patients: d.patients.size,
    }))
    .sort((a, b) => b.profit - a.profit);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>อาคาร/โซน</th><th style="text-align:right;">ผู้รับบริการ</th>
      <th style="text-align:right;">รายรับ</th>
      <th style="text-align:right;">ต้นทุน</th>
      <th style="text-align:right;">กำไร</th>
      <th style="text-align:right;">Margin</th>
    </tr></thead><tbody>` +
    rows.map(r => `<tr>
      <td style="font-weight:600;">${r.zone}</td>
      <td style="text-align:right;">${r.patients}</td>
      <td style="text-align:right;">${_thb(r.revenue)}</td>
      <td style="text-align:right;color:var(--orange);">${_thb(r.cost)}</td>
      <td style="text-align:right;font-weight:600;color:${r.profit>=0?'var(--green)':'var(--red)'};">${_thb(r.profit)}</td>
      <td style="text-align:right;font-size:12px;">${_pct(r.profit, r.revenue)}</td>
    </tr>`).join('') +
    `</tbody></table></div>`;
}

// ── 5. Predictive Stock ───────────────────────────────────────
function renderBIPredictiveStock() {
  const el = document.getElementById('bi-predictive-stock');
  if (!el) return;

  // คำนวณ avg daily usage จาก 30 วันที่ผ่านมา
  const today   = new Date();
  const cutoff  = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const reqs30 = (db.requisitions||[]).filter(r =>
    r.status === 'approved' && (r.date||'') >= cutoffStr
  );

  // รวม usage per item
  const usageMap = {};
  reqs30.forEach(r => {
    const key = String(r.itemId);
    if (!usageMap[key]) usageMap[key] = { itemId: r.itemId, itemName: r.itemName, totalQty: 0 };
    usageMap[key].totalQty += r.qty || 0;
  });

  const rows = (db.items||[])
    .filter(item => item.qty >= 0 && usageMap[String(item.id)])
    .map(item => {
      const u = usageMap[String(item.id)];
      const avgDaily = u ? u.totalQty / 30 : 0;
      const daysLeft = avgDaily > 0 ? Math.floor(item.qty / avgDaily) : null;
      return { item, avgDaily, daysLeft };
    })
    .filter(r => r.avgDaily > 0)
    .sort((a, b) => {
      // เรียงตาม daysLeft (น้อยสุดขึ้นก่อน) null ไว้ท้าย
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    })
    .slice(0, 30);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ยังไม่มีข้อมูลการเบิกเพียงพอสำหรับการพยากรณ์</div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>สินค้า</th><th style="text-align:right;">คงเหลือ</th>
      <th style="text-align:right;">ใช้เฉลี่ย/วัน</th>
      <th style="text-align:right;">คาดหมดใน</th>
      <th>สถานะ</th>
    </tr></thead><tbody>` +
    rows.map(r => {
      const d = r.daysLeft;
      let badge, rowStyle = '';
      if (d === null)    { badge = '<span class="badge badge-gray">ไม่ทราบ</span>'; }
      else if (d <= 0)   { badge = '<span class="badge badge-red">หมดแล้ว</span>'; rowStyle = 'background:#fff5f5;'; }
      else if (d <= 7)   { badge = '<span class="badge badge-red">< 7 วัน</span>'; rowStyle = 'background:#fff5f5;'; }
      else if (d <= 14)  { badge = '<span class="badge badge-orange">< 14 วัน</span>'; rowStyle = 'background:#fff8f0;'; }
      else if (d <= 30)  { badge = '<span class="badge badge-orange">< 30 วัน</span>'; }
      else               { badge = '<span class="badge badge-green">ปกติ</span>'; }

      const daysText = d === null ? '-' : d <= 0 ? 'หมดแล้ว' : `${d} วัน`;
      return `<tr style="${rowStyle}">
        <td style="font-weight:500;">${r.item.name}</td>
        <td style="text-align:right;">${r.item.qty} ${r.item.unit||''}</td>
        <td style="text-align:right;font-size:12px;color:var(--text2);">${r.avgDaily.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600;">${daysText}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('') +
    `</tbody></table></div>`;
}

// ── Top Used Items ─────────────────────────────────────────────
function renderBITopItems(month) {
  const el = document.getElementById('bi-top-items');
  if (!el) return;
  const reqs = _reqsMonth(month);
  const map = {};
  reqs.forEach(r => {
    const k = String(r.itemId);
    if (!map[k]) map[k] = { name: r.itemName||'-', qty: 0, cost: 0 };
    const item = db.items.find(i => i.id == r.itemId);
    map[k].qty  += r.qty || 0;
    map[k].cost += (item?.cost||0) * (r.qty||0);
  });
  const rows = Object.values(map).sort((a,b) => b.qty - a.qty).slice(0, 10);
  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>สินค้า</th><th style="text-align:right;">จำนวนรวม</th><th style="text-align:right;">มูลค่า (฿)</th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr>
      <td style="color:var(--text3);">${i+1}</td>
      <td style="font-weight:500;">${r.name}</td>
      <td style="text-align:right;">${r.qty.toLocaleString()}</td>
      <td style="text-align:right;font-weight:600;">${_thb(r.cost)}</td>
    </tr>`).join('') + `</tbody></table></div>`;
}

// ── Trend (3 months) ─────────────────────────────────────────
function renderBITrend() {
  const el = document.getElementById('bi-trend');
  if (!el) return;
  const months = [-2, -1, 0].map(i => _monthStr(i));
  const rows = months.map(m => {
    const invs = _invoicesMonth(m);
    const reqs = _reqsMonth(m);
    const revenue = invs.reduce((s,i) => s + (i.grandTotal||0), 0);
    const cost    = reqs.reduce((s,r) => {
      const item = db.items.find(i => i.id == r.itemId);
      return s + (item?.cost||0) * (r.qty||0);
    }, 0);
    return { month: m, revenue, cost, profit: revenue - cost };
  });

  const maxVal = Math.max(...rows.map(r => r.revenue), 1);

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">` +
    rows.map(r => {
      const [y, m] = r.month.split('-');
      const label = `${m}/${y.slice(2)}`;
      const barH = Math.round(r.revenue / maxVal * 80);
      const profitColor = r.profit >= 0 ? 'var(--green)' : 'var(--red)';
      return `<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;">เดือน ${label}</div>
        <div style="display:flex;align-items:flex-end;justify-content:center;gap:4px;height:80px;margin-bottom:8px;">
          <div title="รายรับ" style="width:28px;background:#2980b9;border-radius:4px 4px 0 0;height:${barH}px;"></div>
          <div title="ต้นทุน" style="width:28px;background:#e67e22;border-radius:4px 4px 0 0;height:${Math.round(r.cost/maxVal*80)}px;"></div>
        </div>
        <div style="font-size:13px;font-weight:600;color:#2980b9;">${_thb(r.revenue)}</div>
        <div style="font-size:11px;color:var(--orange);">ต้นทุน ${_thb(r.cost)}</div>
        <div style="font-size:12px;font-weight:700;color:${profitColor};margin-top:4px;">กำไร ${_thb(r.profit)}</div>
      </div>`;
    }).join('') + `</div>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:11px;color:var(--text2);">
      <span>🟦 รายรับ</span><span>🟧 ต้นทุนสินค้า</span>
    </div>`;
}

// ── Full BI page render ───────────────────────────────────────
function renderBIPage() {
  const month = _biMonth();
  renderBIKPICards(month);
  renderBITrend();
  renderBIRevenueBreakdown(month);
  renderBICostPerPatient(month);
  renderBIProfitByZone(month);
  renderBITopItems(month);
  renderBIPredictiveStock();
}

// ===== SMART DECISION SYSTEM (Phase: Advanced BI) =====

// ── Rolling average helper ────────────────────────────────────
function _rollingUsage(itemId, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const reqs = (db.requisitions||[]).filter(r =>
    r.status === 'approved' &&
    String(r.itemId) === String(itemId) &&
    (r.date||'') >= cutoffStr
  );
  const total = reqs.reduce((s, r) => s + (r.qty||0), 0);
  return total / days; // avg per day
}

// ── 1. Advanced Forecast ──────────────────────────────────────
function renderAdvancedForecast() {
  const el = document.getElementById('bi-forecast');
  if (!el) return;

  const rows = (db.items||[])
    .filter(item => item.qty >= 0 && item.category !== 'บริการ')
    .map(item => {
      const avg7  = _rollingUsage(item.id, 7);
      const avg14 = _rollingUsage(item.id, 14);
      const avg30 = _rollingUsage(item.id, 30);
      if (avg30 === 0) return null;

      // trend: เพิ่ม/ลด โดยเทียบ avg7 vs avg30
      const trendRatio = avg30 > 0 ? avg7 / avg30 : 1;
      const trend = trendRatio > 1.3 ? 'up' : trendRatio < 0.7 ? 'down' : 'stable';

      // days remaining โดยใช้ avg14 (balanced)
      const daysLeft = avg14 > 0 ? Math.floor(item.qty / avg14) : null;

      // abnormal: avg7 > 2× avg30
      const abnormal = avg7 > 0 && avg30 > 0 && (avg7 / avg30) > 2;

      return { item, avg7, avg14, avg30, trendRatio, trend, daysLeft, abnormal };
    })
    .filter(r => r !== null)
    .sort((a, b) => {
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    })
    .slice(0, 25);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ยังไม่มีข้อมูลการเบิกเพียงพอ (ต้องการอย่างน้อย 14 วัน)</div>';
    return;
  }

  const trendIcon = { up:'📈', down:'📉', stable:'➡️' };
  const trendColor = { up:'var(--red)', down:'var(--green)', stable:'var(--text2)' };

  el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>สินค้า</th>' +
    '<th style="text-align:right;">คงเหลือ</th>' +
    '<th style="text-align:right;">avg/วัน (7d)</th>' +
    '<th style="text-align:right;">avg/วัน (30d)</th>' +
    '<th style="text-align:right;">คาดหมดใน</th>' +
    '<th>Trend</th><th>สถานะ</th>' +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const d = r.daysLeft;
      let badge, rowStyle = '';
      if (d === null || d < 0) { badge = '<span class="badge badge-gray">ไม่ทราบ</span>'; }
      else if (d <= 7)  { badge = '<span class="badge badge-red">⚠️ < 7 วัน</span>'; rowStyle = 'background:#fff5f5;'; }
      else if (d <= 14) { badge = '<span class="badge badge-orange">< 14 วัน</span>'; rowStyle = 'background:#fff8f0;'; }
      else if (d <= 30) { badge = '<span class="badge badge-orange">< 30 วัน</span>'; }
      else              { badge = '<span class="badge badge-green">ปกติ</span>'; }

      const abnBadge = r.abnormal ? ' <span class="badge badge-red" title="ใช้ผิดปกติ: avg 7d สูงกว่า 30d มากกว่า 2×">❗ผิดปกติ</span>' : '';
      const dText = d === null ? '-' : d <= 0 ? 'หมดแล้ว' : d + ' วัน';
      return `<tr style="${rowStyle}">
        <td style="font-weight:500;">${r.item.name}${abnBadge}</td>
        <td style="text-align:right;">${r.item.qty} ${r.item.unit||''}</td>
        <td style="text-align:right;font-size:12px;">${r.avg7.toFixed(2)}</td>
        <td style="text-align:right;font-size:12px;color:var(--text2);">${r.avg30.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600;">${dText}</td>
        <td style="font-size:16px;color:${trendColor[r.trend]};" title="ratio ${r.trendRatio.toFixed(2)}">${trendIcon[r.trend]}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('') + '</tbody></table></div>';
}

// ── 2. Pricing Analysis ───────────────────────────────────────
function renderPricingAnalysis() {
  const el = document.getElementById('bi-pricing');
  if (!el) return;

  const month = _biMonth();
  const reqs  = _reqsMonth(month);

  // รวม qty used per item เดือนนี้
  const usedMap = {};
  reqs.forEach(r => {
    const k = String(r.itemId);
    if (!usedMap[k]) usedMap[k] = 0;
    usedMap[k] += r.qty || 0;
  });

  const rows = (db.items||[])
    .filter(item => item.price > 0 && item.cost >= 0 && item.isBillable !== false)
    .map(item => {
      const cost   = item.cost || 0;
      const price  = item.price || 0;
      const margin = price > 0 ? (price - cost) / price * 100 : 0;
      const used   = usedMap[String(item.id)] || 0;
      const revenue = used * price;
      const totalCost = used * cost;
      const profit = revenue - totalCost;

      // แนะนำราคา: ให้ margin อย่างน้อย 20%
      const suggestedPrice = cost > 0 ? Math.ceil(cost / 0.8 / 5) * 5 : price;

      return { item, cost, price, margin, used, revenue, totalCost, profit, suggestedPrice };
    })
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 30);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  const totRev    = rows.reduce((s, r) => s + r.revenue, 0);
  const totCost   = rows.reduce((s, r) => s + r.totalCost, 0);
  const totProfit = totRev - totCost;
  const lossCount = rows.filter(r => r.margin < 0).length;
  const lowCount  = rows.filter(r => r.margin >= 0 && r.margin < 20).length;

  el.innerHTML =
    `<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
      <div style="background:${lossCount>0?'#fff5f5':'var(--surface2)'};border-radius:8px;padding:10px 16px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">สินค้า Loss</div>
        <div style="font-size:20px;font-weight:700;color:${lossCount>0?'var(--red)':'var(--green)'};">${lossCount}</div>
      </div>
      <div style="background:${lowCount>0?'#fff8f0':'var(--surface2)'};border-radius:8px;padding:10px 16px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">Margin < 20%</div>
        <div style="font-size:20px;font-weight:700;color:var(--orange);">${lowCount}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px 16px;text-align:center;">
        <div style="font-size:11px;color:var(--text3);">กำไรรวมเดือนนี้</div>
        <div style="font-size:20px;font-weight:700;color:${totProfit>=0?'var(--green)':'var(--red)'};">${_thb(totProfit)}</div>
      </div>
    </div>` +
    '<div class="table-wrap"><table><thead><tr>' +
    '<th>สินค้า</th>' +
    '<th style="text-align:right;">ต้นทุน</th>' +
    '<th style="text-align:right;">ราคาขาย</th>' +
    '<th style="text-align:right;">Margin</th>' +
    '<th style="text-align:right;">ใช้ (เดือนนี้)</th>' +
    '<th style="text-align:right;">กำไร</th>' +
    '<th>คำแนะนำ</th>' +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const marginColor = r.margin < 0 ? 'var(--red)' : r.margin < 20 ? 'var(--orange)' : 'var(--green)';
      const rowStyle = r.margin < 0 ? 'background:#fff5f5;' : r.margin < 20 ? 'background:#fff8f0;' : '';
      let suggestion = '';
      if (r.margin < 0) suggestion = `<span class="badge badge-red">ปรับราคาเป็น ฿${r.suggestedPrice}</span>`;
      else if (r.margin < 20) suggestion = `<span class="badge badge-orange">แนะนำ ฿${r.suggestedPrice}</span>`;
      else suggestion = '<span class="badge badge-green">ปกติ</span>';

      return `<tr style="${rowStyle}">
        <td style="font-weight:500;">${r.item.name}</td>
        <td style="text-align:right;font-size:12px;">฿${r.cost.toLocaleString()}</td>
        <td style="text-align:right;font-size:12px;">฿${r.price.toLocaleString()}</td>
        <td style="text-align:right;font-weight:600;color:${marginColor};">${Math.round(r.margin)}%</td>
        <td style="text-align:right;font-size:12px;">${r.used}</td>
        <td style="text-align:right;font-weight:600;color:${r.profit>=0?'var(--green)':'var(--red)'};">${_thb(r.profit)}</td>
        <td>${suggestion}</td>
      </tr>`;
    }).join('') + '</tbody></table></div>';
}

// ── 3. Decision Recommendations ──────────────────────────────
function renderDecisionRecommendations() {
  const el = document.getElementById('bi-recommendations');
  if (!el) return;

  const month = _biMonth();
  const recs  = [];

  // A. Low stock items
  const lowItems = (db.items||[]).filter(i => i.qty <= i.reorder && i.category !== 'บริการ');
  if (lowItems.length > 0) {
    recs.push({
      type: 'danger',
      icon: '🔴',
      title: `สินค้าใกล้หมด ${lowItems.length} รายการ`,
      detail: lowItems.slice(0,3).map(i => `${i.name} (เหลือ ${i.qty})`).join(', ') + (lowItems.length > 3 ? ` และอีก ${lowItems.length-3}` : ''),
      action: 'สั่งซื้อทันที',
      actionFn: "showPage('purchaserequests')",
    });
  }

  // B. Near-expiry lots
  const warnDate = new Date(); warnDate.setDate(warnDate.getDate() + 30);
  const warnStr  = warnDate.toISOString().slice(0,10);
  const expiryLots = (db.itemLots||[]).filter(l =>
    l.expiryDate && l.expiryDate <= warnStr && l.qtyRemaining > 0
  );
  if (expiryLots.length > 0) {
    recs.push({
      type: 'warning',
      icon: '🟡',
      title: `สินค้าใกล้หมดอายุ ${expiryLots.length} Lot (ภายใน 30 วัน)`,
      detail: expiryLots.slice(0,2).map(l => {
        const item = db.items.find(i => i.id == l.itemId);
        return `${item?.name||'?'} (${l.expiryDate})`;
      }).join(', '),
      action: 'ดูรายการ',
      actionFn: "switchStockReportTab('expiry'); showPage('stockreport')",
    });
  }

  // C. Abnormal usage (avg7 > 2× avg30)
  const abnItems = (db.items||[]).filter(item => {
    const avg7  = _rollingUsage(item.id, 7);
    const avg30 = _rollingUsage(item.id, 30);
    return avg30 > 0 && avg7 / avg30 > 2;
  });
  if (abnItems.length > 0) {
    recs.push({
      type: 'warning',
      icon: '🟡',
      title: `การใช้งานผิดปกติ ${abnItems.length} รายการ (usage สูงกว่าเฉลี่ย 2×)`,
      detail: abnItems.slice(0,3).map(i => i.name).join(', '),
      action: 'ตรวจสอบ',
      actionFn: "showPage('bi'); setTimeout(()=>renderAdvancedForecast(),300)",
    });
  }

  // D. Loss-making items (cost > price)
  const lossItems = (db.items||[]).filter(i => i.price > 0 && i.cost > i.price && i.isBillable !== false);
  if (lossItems.length > 0) {
    recs.push({
      type: 'danger',
      icon: '🔴',
      title: `สินค้า ${lossItems.length} รายการ ต้นทุนสูงกว่าราคาขาย (loss)`,
      detail: lossItems.slice(0,3).map(i => `${i.name} (ทุน ฿${i.cost} ขาย ฿${i.price})`).join(', '),
      action: 'ปรับราคา',
      actionFn: "showPage('bi'); setTimeout(()=>renderPricingAnalysis(),300)",
    });
  }

  // E. Low-margin billable items
  const lowMargin = (db.items||[]).filter(i => i.price > 0 && i.cost > 0 && i.isBillable !== false && (i.price - i.cost) / i.price < 0.2 && i.cost <= i.price);
  if (lowMargin.length > 5) {
    recs.push({
      type: 'info',
      icon: '🔵',
      title: `${lowMargin.length} รายการ มี Margin ต่ำกว่า 20%`,
      detail: 'ควรทบทวนราคาขายเพื่อเพิ่มกำไร',
      action: 'วิเคราะห์ Pricing',
      actionFn: "showPage('bi'); setTimeout(()=>renderPricingAnalysis(),300)",
    });
  }

  // F. Unbilled patients
  const reqs  = _reqsMonth(month);
  const billed = new Set((db.invoices||[]).filter(i=>(i.date||'').startsWith(month)).map(i=>String(i.patientId)));
  const unbilledPats = new Set(reqs.filter(r => !billed.has(String(r.patientId))).map(r => r.patientId));
  if (unbilledPats.size > 0) {
    recs.push({
      type: 'info',
      icon: '🔵',
      title: `${unbilledPats.size} ผู้รับบริการ มีการเบิกแต่ยังไม่ออกบิลเดือนนี้`,
      detail: 'ตรวจสอบ tab เบิกสินค้าในหน้า patient profile',
      action: 'ไปหน้า Billing',
      actionFn: "showPage('billing')",
    });
  }

  // G. PR pending too long
  const stalePRs = (db.purchaseRequests||[]).filter(r => {
    if (!['draft','submitted'].includes(r.status)) return false;
    const created = new Date(r.createdAt||r.date);
    return (new Date() - created) / 86400000 > 3;
  });
  if (stalePRs.length > 0) {
    recs.push({
      type: 'warning',
      icon: '🟡',
      title: `คำขอซื้อ ${stalePRs.length} รายการ รออนุมัติเกิน 3 วัน`,
      detail: stalePRs.slice(0,2).map(r => r.refNo||'?').join(', '),
      action: 'อนุมัติ',
      actionFn: "showPage('purchaserequests')",
    });
  }

  if (recs.length === 0) {
    el.innerHTML = '<div style="padding:12px;color:var(--green);font-size:13px;">✅ ไม่มีรายการที่ต้องดำเนินการในขณะนี้</div>';
    return;
  }

  const colorMap = { danger:'#e74c3c', warning:'#e67e22', info:'#2980b9' };
  const bgMap    = { danger:'#fff5f5', warning:'#fff8f0', info:'#f0f7ff' };

  el.innerHTML = recs.map(r => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:8px;background:${bgMap[r.type]};border-left:3px solid ${colorMap[r.type]};margin-bottom:8px;">
      <span style="font-size:18px;flex-shrink:0;">${r.icon}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;color:${colorMap[r.type]};">${r.title}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">${r.detail}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;border:1px solid ${colorMap[r.type]};color:${colorMap[r.type]};" onclick="${r.actionFn}">${r.action} →</button>
    </div>
  `).join('');
}

// ── 4a. Profit per Bed ────────────────────────────────────────
function renderProfitPerBed() {
  const el = document.getElementById('bi-profitbed');
  if (!el) return;

  const month    = _biMonth();
  const invs     = _invoicesMonth(month);
  const reqs     = _reqsMonth(month);
  const activePat = (db.patients||[]).filter(p => p.status==='active'||p.status==='hospital');

  // zone → beds count
  const zoneBeds = {};
  (db.rooms||[]).forEach(room => {
    const zone = room.zone || room.name || 'ไม่ระบุ';
    const bedsInRoom = (db.beds||[]).filter(b => b.roomId == room.id);
    if (!zoneBeds[zone]) zoneBeds[zone] = { total: 0, occupied: 0 };
    zoneBeds[zone].total    += bedsInRoom.length;
    zoneBeds[zone].occupied += bedsInRoom.filter(b => b.status==='occupied').length;
  });

  // zone → revenue/cost
  const zoneRevenue = {};
  const zoneCost    = {};
  invs.forEach(inv => {
    const pat  = activePat.find(p => String(p.id)===String(inv.patientId));
    const zone = _getPatientZone(pat);
    if (!zoneRevenue[zone]) zoneRevenue[zone] = 0;
    zoneRevenue[zone] += inv.grandTotal || 0;
  });
  reqs.forEach(r => {
    const pat  = activePat.find(p => String(p.id)===String(r.patientId));
    const zone = _getPatientZone(pat);
    const item = db.items.find(i => i.id==r.itemId);
    if (!zoneCost[zone]) zoneCost[zone] = 0;
    zoneCost[zone] += (item?.cost||0) * (r.qty||0);
  });

  const allZones = new Set([...Object.keys(zoneBeds), ...Object.keys(zoneRevenue)]);
  const rows = [];
  allZones.forEach(zone => {
    const beds    = zoneBeds[zone] || { total:0, occupied:0 };
    const rev     = zoneRevenue[zone] || 0;
    const cost    = zoneCost[zone]    || 0;
    const profit  = rev - cost;
    const perBed  = beds.occupied > 0 ? profit / beds.occupied : 0;
    const occPct  = beds.total > 0 ? Math.round(beds.occupied/beds.total*100) : 0;
    rows.push({ zone, ...beds, rev, cost, profit, perBed, occPct });
  });
  rows.sort((a, b) => b.perBed - a.perBed);

  if (rows.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>โซน</th><th style="text-align:right;">เตียงใช้/ทั้งหมด</th>' +
    '<th style="text-align:right;">Occupancy</th><th style="text-align:right;">กำไรรวม</th>' +
    '<th style="text-align:right;">กำไร/เตียง</th>' +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const perBedColor = r.perBed < 0 ? 'var(--red)' : r.perBed < 5000 ? 'var(--orange)' : 'var(--green)';
      return `<tr>
        <td style="font-weight:600;">${r.zone}</td>
        <td style="text-align:right;">${r.occupied}/${r.total}</td>
        <td style="text-align:right;font-weight:600;">${r.occPct}%</td>
        <td style="text-align:right;">${_thb(r.profit)}</td>
        <td style="text-align:right;font-weight:700;color:${perBedColor};">${_thb(r.perBed)}</td>
      </tr>`;
    }).join('') + '</tbody></table></div>';
}

// ── 4b. Scenario Simulation ───────────────────────────────────
function renderScenarioSim() {
  const el = document.getElementById('sim-result');
  if (!el) return;

  const extraBeds  = parseInt(document.getElementById('sim-extra-beds')?.value  || 0);
  const pricePct   = parseFloat(document.getElementById('sim-price-pct')?.value || 0);
  const month      = _biMonth();

  const invs       = _invoicesMonth(month);
  const activePats = (db.patients||[]).filter(p => p.status==='active'||p.status==='hospital');
  const totalBeds  = (db.beds||[]).length;
  const occBeds    = (db.beds||[]).filter(b => b.status==='occupied').length;
  const occRate    = totalBeds > 0 ? occBeds / totalBeds : 0;

  // current
  const curRev      = invs.reduce((s,i) => s + (i.grandTotal||0), 0);
  const curRoomRev  = invs.reduce((s,i) => s + (i.roomTotal||0), 0);
  const revPerPat   = activePats.length > 0 ? curRev / activePats.length : 0;

  // simulation
  const newBeds    = totalBeds + extraBeds;
  const newOcc     = Math.round(newBeds * occRate);
  const addedPats  = newOcc - occBeds;
  const addedRev   = addedPats > 0 ? addedPats * revPerPat : 0;
  const priceAdj   = curRoomRev * (pricePct / 100);
  const projRev    = curRev + addedRev + priceAdj;
  const delta      = projRev - curRev;

  const sign = delta >= 0 ? '+' : '';
  const color = delta >= 0 ? 'var(--green)' : 'var(--red)';

  el.innerHTML = `
    <div style="background:var(--surface2);border-radius:8px;padding:14px;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px;">ผลการจำลอง:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
        <div>เตียงทั้งหมด</div><div style="font-weight:600;">${totalBeds} → ${newBeds}</div>
        <div>ผู้รับบริการคาด</div><div style="font-weight:600;">${occBeds} → ${newOcc}</div>
        <div>รายรับปัจจุบัน</div><div>${_thb(curRev)}</div>
        <div>รายรับที่คาด</div><div style="font-weight:700;color:${color};">${_thb(projRev)}</div>
        <div>เปลี่ยนแปลง</div><div style="font-weight:700;color:${color};">${sign}${_thb(delta)}</div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px;">*คำนวณจาก avg revenue/patient เดือนนี้ และ occupancy rate ปัจจุบัน</div>
    </div>`;
}

// ── Override renderBIPage เพิ่ม new sections ─────────────────
const _origRenderBIPage = renderBIPage;
function renderBIPage() {
  const month = _biMonth();
  renderBIKPICards(month);
  renderBITrend();
  renderBIRevenueBreakdown(month);
  renderBICostPerPatient(month);
  renderBIProfitByZone(month);
  renderBITopItems(month);
  renderBIPredictiveStock();
  // New smart decision functions
  renderDecisionRecommendations();
  renderAdvancedForecast();
  renderPricingAnalysis();
  renderProfitPerBed();
  renderScenarioSim();
}

// ===== ADVANCED DECISION LAYER =====

// ── BI Tab switching ──────────────────────────────────────────
function switchBITab(tab) {
  const tabs = ['analytics','case','roi','investor'];
  tabs.forEach(t => {
    const sec = document.getElementById('bi-section-'+t);
    const btn = document.querySelector(`.bi-tab[data-tab="${t}"]`);
    if (!sec || !btn) return;
    const active = t === tab;
    sec.style.display = active ? '' : 'none';
    btn.style.borderBottom = active ? '2px solid var(--accent)' : 'none';
    btn.style.marginBottom = active ? '-2px' : '0';
    btn.style.color        = active ? 'var(--accent)' : 'var(--text2)';
    btn.style.fontWeight   = active ? '600' : '400';
  });
  if (tab === 'case')     runCaseAcceptance();
  if (tab === 'roi')      runROICalc();
  if (tab === 'investor') renderInvestorDashboard();
}

// ── Helper: avg monthly cost/revenue from real data ──────────
function _avgMonthlyCostPerPatient() {
  // คำนวณจาก 3 เดือนที่ผ่านมา
  let totalCost = 0, totalMonths = 0;
  [-2,-1,0].forEach(offset => {
    const m = _monthStr(offset);
    const reqs = _reqsMonth(m);
    if (reqs.length === 0) return;
    const cost = reqs.reduce((s,r) => {
      const item = db.items.find(i=>i.id==r.itemId);
      return s + (item?.cost||0)*(r.qty||0);
    }, 0);
    const pats = new Set(reqs.map(r=>r.patientId)).size;
    if (pats > 0) { totalCost += cost/pats; totalMonths++; }
  });
  return totalMonths > 0 ? totalCost/totalMonths : 8000; // fallback 8k
}

function _avgMonthlyRevenuePerPatient() {
  let totalRev = 0, totalMonths = 0;
  [-2,-1,0].forEach(offset => {
    const m = _monthStr(offset);
    const invs = _invoicesMonth(m);
    if (invs.length === 0) return;
    const rev  = invs.reduce((s,i)=>s+(i.grandTotal||0), 0);
    const pats = new Set(invs.map(i=>i.patientId)).size;
    if (pats > 0) { totalRev += rev/pats; totalMonths++; }
  });
  return totalMonths > 0 ? totalRev/totalMonths : 25000;
}

// ── 1. Case Acceptance Decision ───────────────────────────────
function runCaseAcceptance() {
  const el = document.getElementById('ca-result');
  if (!el) return;

  const roomType   = document.getElementById('ca-room-type')?.value    || 'single';
  const adl        = parseInt(document.getElementById('ca-adl')?.value  || 3);
  const ptSessions = parseFloat(document.getElementById('ca-pt')?.value || 3);
  const medCost    = parseFloat(document.getElementById('ca-med-cost')?.value || 2000);
  const offered    = parseFloat(document.getElementById('ca-offered')?.value  || 25000);
  const complexity = document.getElementById('ca-complexity')?.value || 'low';

  // ── ประมาณต้นทุน ────────────────────────────────────────────
  // 1. ค่าห้อง (จาก db.rooms หรือ benchmark)
  const roomRates = { single: 0, double: 0, ward: 0 };
  (db.rooms||[]).forEach(r => {
    const rt = r.roomType||'';
    if (rt.includes('เดี่ยว')||rt.includes('single')) roomRates.single = Math.max(roomRates.single, r.monthlyRate||0);
    else if (rt.includes('คู่')||rt.includes('double')) roomRates.double = Math.max(roomRates.double, r.monthlyRate||0);
    else roomRates.ward = Math.max(roomRates.ward, r.monthlyRate||0);
  });
  const roomCost  = roomRates[roomType] || { single:20000, double:16000, ward:12000 }[roomType];

  // 2. ค่าแรงพยาบาล — scale by ADL
  const baseNursingCost = 6000;
  const nursingCost     = baseNursingCost * (0.5 + adl * 0.3); // ADL1=0.8×, ADL5=2×

  // 3. PT cost
  const ptRate    = (db.patients||[]).reduce((s,p)=>s+(p.physioRatePerHour||0),0) /
                    Math.max((db.patients||[]).filter(p=>p.physioRatePerHour>0).length,1) || 300;
  const ptCost    = ptSessions * 4 * ptRate; // 4 weeks/month

  // 4. ยาและเวชภัณฑ์ (จาก input + ADL factor)
  const totalMedCost = medCost * (0.8 + adl * 0.1);

  // 5. complexity multiplier
  const complexMult = { low:1.0, medium:1.25, high:1.6 }[complexity] || 1;

  // 6. ค่าดำเนินการอื่น (overheads ~15%)
  const variableCost = (nursingCost + ptCost + totalMedCost) * complexMult;
  const overhead     = variableCost * 0.15;
  const totalCost    = roomCost + variableCost + overhead;

  // ── คำนวณกำไร ────────────────────────────────────────────────
  const avgRev     = _avgMonthlyRevenuePerPatient();
  const effectiveRev = offered > 0 ? offered : avgRev;
  const profit     = effectiveRev - totalCost;
  const margin     = effectiveRev > 0 ? profit / effectiveRev * 100 : 0;

  // ── แนะนำราคา (target 25% margin) ────────────────────────────
  const suggestedPrice = Math.ceil(totalCost / 0.75 / 500) * 500;

  // ── Decision ─────────────────────────────────────────────────
  let decision, decisionColor, decisionIcon, actions = [];
  if (margin >= 20) {
    decision = 'รับได้ — ผลกำไรดี';
    decisionColor = '#27ae60'; decisionIcon = '✅';
  } else if (margin >= 5) {
    decision = 'รับได้ แต่ควรปรับราคา';
    decisionColor = '#e67e22'; decisionIcon = '⚠️';
    actions.push(`เสนอราคา ฿${suggestedPrice.toLocaleString()}/เดือน`);
  } else if (margin >= 0) {
    decision = 'ความเสี่ยงสูง — กำไรน้อยมาก';
    decisionColor = '#e74c3c'; decisionIcon = '🔶';
    actions.push(`ปรับราคาเป็น ฿${suggestedPrice.toLocaleString()}/เดือน`);
    actions.push('ประเมินความสามารถชำระของครอบครัวก่อน');
  } else {
    decision = 'ไม่แนะนำ — ขาดทุน';
    decisionColor = '#c0392b'; decisionIcon = '❌';
    actions.push(`ราคาขั้นต่ำที่รับได้: ฿${suggestedPrice.toLocaleString()}/เดือน`);
    if (complexity === 'high') actions.push('พิจารณาส่งต่อสถานพยาบาลที่เหมาะสมกว่า');
  }

  // ── Render ────────────────────────────────────────────────────
  const costBreakdown = [
    { label: '🛏️ ค่าห้องพัก', value: roomCost },
    { label: '👩‍⚕️ ค่าแรงการพยาบาล (ADL-adjusted)', value: nursingCost * complexMult },
    { label: '🤸 กายภาพบำบัด', value: ptCost * complexMult },
    { label: '💊 ยาและเวชภัณฑ์', value: totalMedCost * complexMult },
    { label: '⚙️ Overhead (15%)', value: overhead },
  ];

  el.innerHTML = `
    <div class="card" style="border-top:4px solid ${decisionColor};">
      <div class="card-header" style="background:${decisionColor}15;">
        <div style="font-size:22px;font-weight:700;color:${decisionColor};">${decisionIcon} ${decision}</div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);">ต้นทุนรวม/เดือน</div>
            <div style="font-size:22px;font-weight:700;color:var(--red);">${_thb(totalCost)}</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);">กำไร/เดือน</div>
            <div style="font-size:22px;font-weight:700;color:${profit>=0?'var(--green)':'var(--red)'};">${_thb(profit)}</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);">Margin</div>
            <div style="font-size:22px;font-weight:700;color:${margin>=20?'var(--green)':margin>=0?'var(--orange)':'var(--red)'};">${Math.round(margin)}%</div>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px;">รายละเอียดต้นทุน</div>
          ${costBreakdown.map(c => `
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:13px;">
              <span>${c.label}</span><span style="font-weight:600;">${_thb(c.value)}</span>
            </div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-weight:700;font-size:14px;">
            <span>รวมต้นทุน</span><span style="color:var(--red);">${_thb(totalCost)}</span>
          </div>
        </div>
        ${actions.length > 0 ? `
          <div style="background:#fff8f0;border-radius:8px;padding:12px;border-left:3px solid var(--orange);">
            <div style="font-size:12px;font-weight:600;color:var(--orange);margin-bottom:6px;">📋 คำแนะนำ</div>
            ${actions.map(a=>`<div style="font-size:13px;padding:2px 0;">• ${a}</div>`).join('')}
          </div>` : ''}
        <div style="font-size:10px;color:var(--text3);margin-top:10px;">
          *ประมาณการจากต้นทุนจริงในระบบ · ราคาแนะนำ = target margin 25%
        </div>
      </div>
    </div>`;
}

// ── 2. ROI Calculator ─────────────────────────────────────────
function runROICalc() {
  const el = document.getElementById('roi-result');
  if (!el) return;

  const beds    = parseFloat(document.getElementById('roi-beds')?.value   || 10);
  const capex   = parseFloat(document.getElementById('roi-capex')?.value  || 2000000);
  const rate    = parseFloat(document.getElementById('roi-rate')?.value   || 25000);
  const opex    = parseFloat(document.getElementById('roi-opex')?.value   || 12000);
  const occA    = parseFloat(document.getElementById('roi-occ-a')?.value  || 70) / 100;
  const occB    = parseFloat(document.getElementById('roi-occ-b')?.value  || 90) / 100;

  function calcScenario(occ) {
    const monthlyRev     = beds * occ * rate;
    const monthlyOpex    = beds * occ * opex;
    const monthlyProfit  = monthlyRev - monthlyOpex;
    const annualProfit   = monthlyProfit * 12;
    const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(capex / monthlyProfit) : null;
    const roi3yr         = capex > 0 ? ((annualProfit * 3 - capex) / capex * 100) : 0;
    return { occ, monthlyRev, monthlyOpex, monthlyProfit, annualProfit, breakEvenMonths, roi3yr };
  }

  const sA = calcScenario(occA);
  const sB = calcScenario(occB);

  function scenarioCard(s, label, color) {
    const beText = s.breakEvenMonths
      ? s.breakEvenMonths < 12
        ? `${s.breakEvenMonths} เดือน`
        : `${(s.breakEvenMonths/12).toFixed(1)} ปี`
      : 'ไม่คุ้มทุน';
    return `
      <div style="background:#fff;border-radius:12px;padding:16px;border-top:4px solid ${color};box-shadow:0 1px 6px rgba(0,0,0,0.07);">
        <div style="font-weight:700;font-size:14px;color:${color};margin-bottom:12px;">${label} (Occupancy ${Math.round(s.occ*100)}%)</div>
        <div style="display:grid;gap:8px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>ผู้รับบริการ/เดือน</span><span style="font-weight:600;">${Math.round(beds*s.occ)} คน</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>รายรับ/เดือน</span><span style="font-weight:600;color:var(--green);">${_thb(s.monthlyRev)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>ต้นทุน/เดือน</span><span style="font-weight:600;color:var(--red);">${_thb(s.monthlyOpex)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;border-top:1px solid var(--border);padding-top:6px;">
            <span>กำไร/เดือน</span><span style="color:${s.monthlyProfit>=0?'var(--green)':'var(--red)'};">${_thb(s.monthlyProfit)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>กำไรต่อปี</span><span style="font-weight:600;">${_thb(s.annualProfit)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>Break-even</span><span style="font-weight:700;color:${color};">${beText}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>ROI 3 ปี</span><span style="font-weight:700;color:${s.roi3yr>=0?'var(--green)':'var(--red)'};">${s.roi3yr.toFixed(1)}%</span>
          </div>
        </div>
      </div>`;
  }

  const diff = sB.monthlyProfit - sA.monthlyProfit;

  el.innerHTML = `
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        ${scenarioCard(sA, 'Scenario A', '#2980b9')}
        ${scenarioCard(sB, 'Scenario B', '#27ae60')}
      </div>
      <div class="card">
        <div class="card-body">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📊 เปรียบเทียบ Scenario A vs B</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:11px;color:var(--text3);">ส่วนต่างกำไร/เดือน</div>
              <div style="font-size:18px;font-weight:700;color:var(--green);">+${_thb(diff)}</div>
            </div>
            <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:11px;color:var(--text3);">Occupancy เพิ่ม</div>
              <div style="font-size:18px;font-weight:700;">${Math.round((occB-occA)*100)}%</div>
            </div>
            <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:11px;color:var(--text3);">เงินลงทุน</div>
              <div style="font-size:18px;font-weight:700;">${_thb(capex)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── 3. Investor Dashboard ─────────────────────────────────────
function renderInvestorDashboard() {
  const el = document.getElementById('investor-content');
  if (!el) return;

  const month      = document.getElementById('inv-month')?.value || _monthStr(0);
  const invs       = _invoicesMonth(month);
  const pays       = _paymentsMonth(month);
  const reqs       = _reqsMonth(month);
  const activePats = (db.patients||[]).filter(p=>p.status==='active'||p.status==='hospital');
  const totalBeds  = (db.beds||[]).length;
  const occBeds    = (db.beds||[]).filter(b=>b.status==='occupied').length;

  const revenue    = invs.reduce((s,i)=>s+(i.grandTotal||0),0);
  const collected  = pays.reduce((s,p)=>s+(p.amount||0),0);
  const cogs       = reqs.reduce((s,r)=>{
    const item=db.items.find(i=>i.id==r.itemId);
    return s+(item?.cost||0)*(r.qty||0);
  },0);
  const grossProfit = revenue - cogs;
  const margin      = revenue > 0 ? grossProfit/revenue*100 : 0;
  const costPerPat  = activePats.length > 0 ? cogs/activePats.length : 0;
  const revPerPat   = activePats.length > 0 ? revenue/activePats.length : 0;
  const occRate     = totalBeds > 0 ? occBeds/totalBeds*100 : 0;

  // 6-month trend
  const trend = [-5,-4,-3,-2,-1,0].map(i => {
    const m   = _monthStr(i);
    const r   = _invoicesMonth(m).reduce((s,x)=>s+(x.grandTotal||0),0);
    const c   = _reqsMonth(m).reduce((s,x)=>{
      const it=db.items.find(ii=>ii.id==x.itemId);
      return s+(it?.cost||0)*(x.qty||0);
    },0);
    const [y,mo] = m.split('-');
    return { label:`${mo}/${y.slice(2)}`, rev:r, profit:r-c };
  });
  const maxTrend = Math.max(...trend.map(t=>t.rev),1);

  const [y,mo] = month.split('-');
  const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthLabel = `${MONTHS_TH[parseInt(mo)-1]} ${parseInt(y)+543}`;

  el.innerHTML = `
    <div style="font-family:sans-serif;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--border);">
        <div>
          <div style="font-size:20px;font-weight:700;">🏥 นวศรี เนอร์สซิ่งโฮม</div>
          <div style="font-size:13px;color:var(--text2);">Investor Summary Report — ${monthLabel}</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">สร้างวันที่ ${new Date().toLocaleDateString('th-TH')}</div>
      </div>

      <!-- KPI Row -->
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px;">
        ${[
          {label:'ผู้รับบริการ',value:activePats.length+' คน',sub:`Occupancy ${Math.round(occRate)}%`,color:'#2980b9'},
          {label:'รายรับรวม',value:_thb(revenue),sub:`เก็บแล้ว ${_thb(collected)}`,color:'#27ae60'},
          {label:'ต้นทุนสินค้า',value:_thb(cogs),sub:`${reqs.length} รายการ`,color:'#e67e22'},
          {label:'กำไรขั้นต้น',value:_thb(grossProfit),sub:`Margin ${Math.round(margin)}%`,color:grossProfit>=0?'#27ae60':'#e74c3c'},
          {label:'Rev/Patient',value:_thb(revPerPat),sub:'เฉลี่ยต่อคน',color:'#8e44ad'},
          {label:'Cost/Patient',value:_thb(costPerPat),sub:'ต้นทุนต่อคน',color:'#16a085'},
        ].map(k=>`
          <div style="background:#fff;border-radius:10px;padding:12px;border-bottom:3px solid ${k.color};box-shadow:0 1px 4px rgba(0,0,0,0.06);text-align:center;">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">${k.label}</div>
            <div style="font-size:18px;font-weight:700;color:${k.color};margin:4px 0;">${k.value}</div>
            <div style="font-size:10px;color:var(--text2);">${k.sub}</div>
          </div>`).join('')}
      </div>

      <!-- 6-Month Trend -->
      <div style="background:#fff;border-radius:10px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;">📈 แนวโน้ม 6 เดือน</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:100px;">
          ${trend.map(t=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
              <div style="width:100%;display:flex;align-items:flex-end;gap:2px;height:80px;">
                <div title="รายรับ" style="flex:1;background:#2980b9;border-radius:3px 3px 0 0;height:${Math.round(t.rev/maxTrend*80)}px;"></div>
                <div title="กำไร" style="flex:1;background:${t.profit>=0?'#27ae60':'#e74c3c'};border-radius:3px 3px 0 0;height:${Math.round(Math.abs(t.profit)/maxTrend*80)}px;"></div>
              </div>
              <div style="font-size:10px;color:var(--text3);">${t.label}</div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:12px;font-size:10px;color:var(--text3);margin-top:6px;">
          <span>🟦 รายรับ</span><span>🟩 กำไร</span>
        </div>
      </div>

      <!-- Occupancy + Margin Summary -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;">🛏️ อัตราการใช้เตียง</div>
          <div style="background:var(--border);border-radius:6px;height:12px;overflow:hidden;">
            <div style="background:${occRate>=80?'#27ae60':occRate>=60?'#e67e22':'#e74c3c'};height:100%;width:${Math.round(occRate)}%;border-radius:6px;transition:width .5s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;">
            <span>${occBeds} เตียงที่ใช้อยู่</span><span style="font-weight:700;">${Math.round(occRate)}%</span>
          </div>
        </div>
        <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;">💹 Gross Margin</div>
          <div style="background:var(--border);border-radius:6px;height:12px;overflow:hidden;">
            <div style="background:${margin>=25?'#27ae60':margin>=10?'#e67e22':'#e74c3c'};height:100%;width:${Math.max(0,Math.round(margin))}%;border-radius:6px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;">
            <span>กำไร ${_thb(grossProfit)}</span><span style="font-weight:700;">${Math.round(margin)}%</span>
          </div>
        </div>
      </div>

      <div style="font-size:10px;color:var(--text3);margin-top:12px;text-align:center;">
        *กำไรขั้นต้น = รายรับ − ต้นทุนสินค้าและยา (ไม่รวมค่าแรงและ overhead)
      </div>
    </div>`;
}
