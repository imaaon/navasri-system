// ===== NAVASRI FEATURES MODULE =====
// 1. Dashboard สรุปรายได้/รายจ่ายรายเดือน
// 2. แจ้งเตือน LINE เมื่อบิลครบกำหนด
// 3. แจ้งเตือนสต็อกใกล้หมด
// 4. Export รายงานเป็น Excel
// 5. Backup ข้อมูลทั้งหมด

// ─────────────────────────────────────────────────────────────
// SECTION 1: DASHBOARD สรุปรายได้/รายจ่ายรายเดือน
// ─────────────────────────────────────────────────────────────

function renderMonthlySummaryCard(targetElementId, monthStr) {
  const el = document.getElementById(targetElementId);
  if (!el) return;

  // ใช้เดือนปัจจุบันถ้าไม่ระบุ
  const month = monthStr || new Date().toISOString().slice(0, 7);

  // รายได้: จาก invoices ที่ paid ในเดือนนี้ + payments ที่รับในเดือนนี้
  const paidPayments = (db.payments || []).filter(p =>
    (p.paymentDate || '').startsWith(month)
  );
  const totalRevenue = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // รายจ่าย: expenses + supplier invoices ที่จ่ายแล้วในเดือนนี้
  const monthExpenses = (db.expenses || []).filter(e =>
    (e.date || '').startsWith(month)
  );
  const expenseTotal = monthExpenses.reduce((s, e) => s + (e.net || 0), 0);

  const monthSupInv = (db.supplierInvoices || []).filter(si =>
    (si.paidDate || '').startsWith(month) && si.status === 'paid'
  );
  const supInvTotal = monthSupInv.reduce((s, si) => s + (si.total || 0), 0);

  const totalExpense = expenseTotal + supInvTotal;
  const netProfit    = totalRevenue - totalExpense;

  // บิลค้างชำระในเดือนนี้
  const overdueInvoices = (db.invoices || []).filter(inv => {
    if (!inv.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    const status = getInvoicePaymentStatus ? getInvoicePaymentStatus(inv) : inv.status;
    return inv.dueDate < today && status !== 'paid' && status !== 'cancelled';
  });
  const overdueTotal = overdueInvoices.reduce((s, inv) => {
    const paid = typeof getInvoicePaidAmount === 'function' ? getInvoicePaidAmount(inv.id) : 0;
    return s + Math.max(0, (inv.grandTotal || 0) - paid);
  }, 0);

  // สร้าง bar chart 6 เดือนย้อนหลัง
  const chartData = _buildMonthlyChartData(6);

  const profitColor = netProfit >= 0 ? '#27ae60' : '#e74c3c';
  const profitIcon  = netProfit >= 0 ? '📈' : '📉';

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="card-title">💰 สรุปการเงินเดือน ${_thaiMonth(month)}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="month" value="${month}" onchange="renderMonthlySummaryCard('${targetElementId}', this.value)"
            style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text1);">
          <button class="btn btn-ghost btn-sm" onclick="exportMonthlyExcel('${month}')" title="Export Excel">📥 Export</button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
        <div style="background:#eafaf1;border:1px solid #a9dfbf;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#27ae60;font-weight:600;margin-bottom:4px;">💵 รายได้รวม</div>
          <div style="font-size:20px;font-weight:800;color:#27ae60;">${_thb(totalRevenue)}</div>
          <div style="font-size:10px;color:#7dcea0;margin-top:2px;">${paidPayments.length} รายการ</div>
        </div>
        <div style="background:#fdedec;border:1px solid #f1948a;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#e74c3c;font-weight:600;margin-bottom:4px;">💸 รายจ่ายรวม</div>
          <div style="font-size:20px;font-weight:800;color:#e74c3c;">${_thb(totalExpense)}</div>
          <div style="font-size:10px;color:#f1948a;margin-top:2px;">ค่าใช้จ่าย + จัดซื้อ</div>
        </div>
        <div style="background:${netProfit>=0?'#eafaf1':'#fdedec'};border:1px solid ${netProfit>=0?'#a9dfbf':'#f1948a'};border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:${profitColor};font-weight:600;margin-bottom:4px;">${profitIcon} กำไรสุทธิ</div>
          <div style="font-size:20px;font-weight:800;color:${profitColor};">${_thb(netProfit)}</div>
          <div style="font-size:10px;color:${profitColor}99;margin-top:2px;">${netProfit>=0?'กำไร':'ขาดทุน'}</div>
        </div>
        ${overdueTotal > 0 ? `
        <div style="background:#fef9e7;border:1px solid #f9e79f;border-radius:10px;padding:14px;text-align:center;cursor:pointer;" onclick="showPage('billing')">
          <div style="font-size:11px;color:#e67e22;font-weight:600;margin-bottom:4px;">⏰ ค้างชำระ</div>
          <div style="font-size:20px;font-weight:800;color:#e67e22;">${_thb(overdueTotal)}</div>
          <div style="font-size:10px;color:#f0b27a;margin-top:2px;">${overdueInvoices.length} บิล</div>
        </div>` : ''}
      </div>

      <!-- Bar Chart 6 เดือน -->
      <div style="margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px;">📊 รายได้-รายจ่าย 6 เดือนล่าสุด</div>
        ${_renderBarChart(chartData)}
      </div>

      <!-- Expense Breakdown -->
      ${monthExpenses.length > 0 ? `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;">📋 รายจ่ายประจำเดือน</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:var(--surface2);">
            <th style="text-align:left;padding:6px 10px;">รายการ</th>
            <th style="text-align:right;padding:6px 10px;">จำนวน</th>
            <th style="text-align:left;padding:6px 10px;color:var(--text3);">วันที่</th>
          </tr></thead>
          <tbody>
            ${monthExpenses.slice(0,10).map(e => `
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:6px 10px;">${e.vendorName||e.job||'-'}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;color:#e74c3c;">${_thb(e.net||0)}</td>
              <td style="padding:6px 10px;font-size:12px;color:var(--text3);">${e.date||'-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;
}

function _buildMonthlyChartData(months) {
  const data = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const rev = (db.payments||[]).filter(p=>(p.paymentDate||'').startsWith(m))
                                 .reduce((s,p)=>s+(p.amount||0),0);
    const exp = (db.expenses||[]).filter(e=>(e.date||'').startsWith(m))
                                 .reduce((s,e)=>s+(e.net||0),0) +
                (db.supplierInvoices||[]).filter(si=>(si.paidDate||'').startsWith(m)&&si.status==='paid')
                                         .reduce((s,si)=>s+(si.total||0),0);
    data.push({ month: m, label: _shortMonth(m), revenue: rev, expense: exp });
  }
  return data;
}

function _renderBarChart(data) {
  if (!data || data.length === 0) return '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">ไม่มีข้อมูล</div>';
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expense)), 1);
  const barH   = 80;
  const colW   = Math.floor(560 / data.length);

  const bars = data.map((d, i) => {
    const rH = Math.round((d.revenue / maxVal) * barH);
    const eH = Math.round((d.expense / maxVal) * barH);
    const x  = i * colW;
    const bW = Math.floor(colW * 0.35);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
        <div style="display:flex;align-items:flex-end;gap:2px;height:${barH}px;">
          <div title="รายได้ ${_thb(d.revenue)}" style="width:${bW}px;background:#27ae60;border-radius:3px 3px 0 0;height:${rH}px;min-height:${d.revenue>0?2:0}px;transition:height .3s;"></div>
          <div title="รายจ่าย ${_thb(d.expense)}" style="width:${bW}px;background:#e74c3c;border-radius:3px 3px 0 0;height:${eH}px;min-height:${d.expense>0?2:0}px;transition:height .3s;"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px;text-align:center;">${d.label}</div>
      </div>`;
  }).join('');

  return `
    <div>
      <div style="display:flex;gap:12px;margin-bottom:6px;">
        <span style="font-size:11px;color:#27ae60;">■ รายได้</span>
        <span style="font-size:11px;color:#e74c3c;">■ รายจ่าย</span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:4px;padding:0 4px;border-bottom:1px solid var(--border);">
        ${bars}
      </div>
    </div>`;
}

function _thaiMonth(monthStr) {
  if (!monthStr) return '';
  const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [y, m] = monthStr.split('-');
  return `${MONTHS[parseInt(m)]} ${parseInt(y)+543}`;
}

function _shortMonth(monthStr) {
  if (!monthStr) return '';
  const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [, m] = monthStr.split('-');
  return MONTHS[parseInt(m)];
}

function _thb(n) {
  return (n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ฿';
}

// ─────────────────────────────────────────────────────────────
// SECTION 2: แจ้งเตือน LINE เมื่อบิลครบกำหนด + สต็อกใกล้หมด
// หมายเหตุ: ใช้ sendLineNotify(event, message, data) จาก ui.js
// ─────────────────────────────────────────────────────────────

async function checkAndNotifyOverdueBills() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl || !ls.notifyOverdueBills) return;

  const today = new Date().toISOString().split('T')[0];
  const overdueList = (db.invoices || []).filter(inv => {
    if (!inv.dueDate || inv.dueDate > today) return false;
    const status = typeof getInvoicePaymentStatus === 'function'
      ? getInvoicePaymentStatus(inv) : inv.status;
    return status !== 'paid' && status !== 'cancelled';
  });

  if (overdueList.length === 0) return;

  const lines = overdueList.slice(0, 10).map(inv => {
    const balance = typeof getInvoicePaidAmount === 'function'
      ? (inv.grandTotal||0) - getInvoicePaidAmount(inv.id)
      : (inv.grandTotal||0);
    return `• ${inv.patientName} (${inv.docNo}) ค้าง ${_thb(balance)} ครบ ${inv.dueDate}`;
  });

  const msg = `⏰ แจ้งเตือนบิลค้างชำระ ${overdueList.length} รายการ\n━━━━━━━━━━━━━━\n${lines.join('\n')}${overdueList.length > 10 ? `\n...และอีก ${overdueList.length-10} รายการ` : ''}\n\n🔗 กรุณาตรวจสอบในระบบบัญชี`;

  await sendLineNotify('overdue_bills', msg, { count: overdueList.length });
}

async function checkAndNotifyLowStockDaily() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl || !ls.notifyLowStockDaily) return;

  const lowItems = (db.items || []).filter(i => i.qty <= i.reorder && i.qty >= 0);
  if (lowItems.length === 0) return;

  const outItems  = lowItems.filter(i => i.qty <= 0);
  const nearItems = lowItems.filter(i => i.qty > 0);

  let msg = `📦 แจ้งเตือนสต็อกสินค้าประจำวัน\n━━━━━━━━━━━━━━`;
  if (outItems.length > 0) {
    msg += `\n🔴 หมดสต็อก ${outItems.length} รายการ:\n` +
      outItems.slice(0,5).map(i => `• ${i.name} (เหลือ 0 ${i.unit})`).join('\n');
    if (outItems.length > 5) msg += `\n  ...และอีก ${outItems.length-5} รายการ`;
  }
  if (nearItems.length > 0) {
    msg += `\n🟡 ใกล้หมด ${nearItems.length} รายการ:\n` +
      nearItems.slice(0,5).map(i => `• ${i.name} (เหลือ ${i.qty}/${i.reorder} ${i.unit})`).join('\n');
    if (nearItems.length > 5) msg += `\n  ...และอีก ${nearItems.length-5} รายการ`;
  }
  msg += `\n\n🛒 กรุณาสั่งซื้อเพิ่มในระบบ`;

  await sendLineNotify('low_stock_daily', msg, { outCount: outItems.length, nearCount: nearItems.length });
}

// เรียกอัตโนมัติตอนเปิดระบบ วันละครั้ง
async function runDailyLineNotifications() {
  const today = new Date().toISOString().split('T')[0];
  const lastRun = localStorage.getItem('_navasri_line_notify_date');
  if (lastRun === today) return;
  await Promise.all([
    checkAndNotifyOverdueBills(),
    checkAndNotifyLowStockDaily(),
  ]);
  localStorage.setItem('_navasri_line_notify_date', today);
}

// ปุ่มส่งแจ้งเตือนด้วยตนเอง
async function manualNotifyLowStock() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl) {
    toast('ยังไม่ได้ตั้งค่า LINE Webhook', 'warning'); return;
  }
  // ใช้ low_stock event ที่มีอยู่แล้วใน buildLineMsg
  const lowItems = (db.items || []).filter(i => i.qty <= i.reorder);
  if (lowItems.length === 0) { toast('ไม่มีสินค้าใกล้หมดในขณะนี้', 'info'); return; }
  for (const i of lowItems.slice(0, 5)) {
    await sendLineNotify('low_stock', buildLineMsg('low_stock', {
      itemName: i.name, qty: i.qty, unit: i.unit, reorder: i.reorder
    }), { itemId: i.id });
  }
  if (lowItems.length > 5) toast(`ส่งแจ้งเตือนสินค้า 5/${lowItems.length} รายการแล้ว`, 'success');
}

async function manualNotifyOverdueBills() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl) {
    toast('ยังไม่ได้ตั้งค่า LINE Webhook', 'warning'); return;
  }
  const saved = ls.notifyOverdueBills;
  db.lineSettings.notifyOverdueBills = true; // force send
  await checkAndNotifyOverdueBills();
  db.lineSettings.notifyOverdueBills = saved;
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: EXPORT MONTHLY EXCEL
// ─────────────────────────────────────────────────────────────

function exportMonthlyExcel(monthStr) {
  const month = monthStr || new Date().toISOString().slice(0, 7);
  if (typeof XLSX === 'undefined') { toast('ไม่พบ SheetJS', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: รายรับ (payments)
  const payRows = [
    ['#','วันที่รับ','เลขบิล','ผู้รับบริการ','จำนวนเงิน','วิธีชำระ','ผู้รับ','เลขใบเสร็จ']
  ];
  (db.payments||[]).filter(p=>(p.paymentDate||'').startsWith(month)).forEach((p,i) => {
    const inv = (db.invoices||[]).find(inv=>inv.id===p.invoiceId);
    payRows.push([i+1,p.paymentDate,inv?.docNo||'-',p.patientName||inv?.patientName||'-',
      p.amount||0,p.method||'-',p.receivedBy||'-',p.receiptNo||'-']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), 'รายรับ');

  // Sheet 2: รายจ่าย (expenses)
  const expRows = [['#','วันที่','เลขเอกสาร','รายการ','จำนวนเงิน','หมายเหตุ']];
  (db.expenses||[]).filter(e=>(e.date||'').startsWith(month)).forEach((e,i) => {
    expRows.push([i+1,e.date,e.docNo||'-',e.vendorName||e.job||'-',e.net||0,e.note||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'รายจ่าย');

  // Sheet 3: ใบแจ้งหนี้ทั้งหมด
  const invRows = [['#','เลขที่','ประเภท','ผู้รับบริการ','วันที่','ครบกำหนด','ยอดรวม','ชำระแล้ว','คงค้าง','สถานะ']];
  (db.invoices||[]).filter(inv=>(inv.date||'').startsWith(month)).forEach((inv,i) => {
    const paid = typeof getInvoicePaidAmount==='function' ? getInvoicePaidAmount(inv.id) : 0;
    const status = typeof getInvoicePaymentStatus==='function' ? getInvoicePaymentStatus(inv) : inv.status;
    const statusLabel = {draft:'ร่าง',sent:'รอชำระ',partial:'ชำระบางส่วน',paid:'ชำระครบ',cancelled:'ยกเลิก'}[status]||status;
    invRows.push([i+1,inv.docNo,inv.type,inv.patientName,inv.date,inv.dueDate||'-',
      inv.grandTotal||0,paid,Math.max(0,(inv.grandTotal||0)-paid),statusLabel]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invRows), 'ใบแจ้งหนี้');

  XLSX.writeFile(wb, `navasri_report_${month}.xlsx`);
  toast(`ดาวน์โหลด Excel รายงานเดือน ${_thaiMonth(month)} แล้ว ✅`, 'success');
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: BACKUP ข้อมูลทั้งหมด
// ─────────────────────────────────────────────────────────────

async function backupAllData() {
  if (!confirm('ต้องการสำรองข้อมูลทั้งหมดออกเป็นไฟล์ Excel หรือไม่?\n\nอาจใช้เวลาสักครู่...')) return;

  if (typeof XLSX === 'undefined') { toast('ไม่พบ SheetJS', 'error'); return; }

  toast('⏳ กำลังสร้างไฟล์ Backup...', 'info');

  await new Promise(r => setTimeout(r, 100)); // ให้ toast ขึ้นก่อน

  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0,10);

  // ── Sheet: ผู้รับบริการ ──────────────────────────────────
  const patRows = [['#','ชื่อ-นามสกุล','HN','ประเภทบัตร','เลขบัตร',
    'วันเกิด','อายุ','เพศ','วันรับบริการ','วันสิ้นสุด',
    'ระยะเวลา','สถานะ','โทรศัพท์','ผู้ติดต่อฉุกเฉิน','ที่อยู่','หมายเหตุ']];
  (db.patients||[]).forEach((p,i) => {
    const statusLabel = {active:'พักอยู่',hospital:'อยู่โรงพยาบาล',inactive:'ออกแล้ว'}[p.status]||p.status||'';
    const age = p.dob ? Math.floor((new Date()-new Date(p.dob))/(365.25*24*3600*1000))+'ปี' : '-';
    const bed = (db.beds||[]).find(b=>b.id===p.currentBedId);
    const room = bed ? (db.rooms||[]).find(r=>r.id===bed.roomId) : null;
    patRows.push([i+1,p.name||'',p.hn||'',p.idType||'',p.idcard||p.idCard||'',
      p.dob||'',age,p.gender||'',p.admitDate||'',p.endDate||'',
      p.admitDate ? _calcDuration(p.admitDate, p.endDate) : '-',
      statusLabel,p.phone||'',p.emergency||'',p.address||'',p.note||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(patRows), 'ผู้รับบริการ');

  // ── Sheet: พนักงาน ────────────────────────────────────────
  const staffRows = [['#','ชื่อ-นามสกุล','ตำแหน่ง','แผนก','เบอร์โทร','อีเมล','วันเริ่มงาน','สถานะ']];
  (db.staff||[]).forEach((s,i) => {
    const active = !s.endDate || s.endDate > today;
    staffRows.push([i+1,s.name||s.displayName||'',s.position||'',s.department||'',
      s.phone||'',s.email||'',s.startDate||'',active?'ทำงานอยู่':'ออกแล้ว']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(staffRows), 'พนักงาน');

  // ── Sheet: ห้องพัก/เตียง ──────────────────────────────────
  const roomRows = [['#','ชื่อห้อง','ประเภท','ราคารายเดือน','ราคารายวัน','สถานะ']];
  (db.rooms||[]).forEach((r,i) => {
    roomRows.push([i+1,r.name||'',r.roomType||'',r.monthlyRate||0,r.dailyRate||0,r.status||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roomRows), 'ห้องพัก');

  const bedRows = [['#','รหัสเตียง','ห้อง','สถานะ','ผู้รับบริการปัจจุบัน']];
  (db.beds||[]).forEach((b,i) => {
    const room = (db.rooms||[]).find(r=>r.id===b.roomId);
    const pat  = (db.patients||[]).find(p=>p.currentBedId===b.id&&p.status==='active');
    bedRows.push([i+1,b.bedCode||'',room?.name||'',b.status||'',pat?.name||'ว่าง']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bedRows), 'เตียง');

  // ── Sheet: สินค้า/คลังสต็อก ──────────────────────────────
  const itemRows = [['#','ชื่อสินค้า','ประเภท','บาร์โค้ด','คงเหลือ','หน่วยจ่าย',
    'จุดสั่งซื้อ','ราคาทุน','ราคาขาย','Billable','สถานะ']];
  (db.items||[]).forEach((item,i) => {
    const status = item.qty<=0?'หมด':item.qty<=item.reorder?'ใกล้หมด':'ปกติ';
    itemRows.push([i+1,item.name||'',item.category||'',item.barcode||'',
      item.qty||0,item.unit||'',item.reorder||0,item.cost||0,item.price||0,
      item.isBillable!==false?'ใช่':'ไม่',status]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'สินค้า');

  // ── Sheet: Lot สินค้า ────────────────────────────────────
  const lotRows = [['#','สินค้า','Lot Number','วันรับ','วันหมดอายุ','จำนวนรับ','คงเหลือ','ราคาทุน/หน่วย','สถานะ']];
  (db.itemLots||[]).forEach((lot,i) => {
    const item = (db.items||[]).find(x=>x.id==lot.itemId);
    const today2 = new Date(); today2.setHours(0,0,0,0);
    const exp = lot.expiryDate ? new Date(lot.expiryDate) : null;
    const diff = exp ? Math.ceil((exp-today2)/86400000) : null;
    const status = !exp ? 'ไม่ระบุ' : diff<0?'หมดอายุแล้ว':diff<=30?`อีก ${diff} วัน`:`${lot.expiryDate}`;
    lotRows.push([i+1,item?.name||'-',lot.lotNumber||'-',lot.receivedDate||'-',
      lot.expiryDate||'-',lot.qty||0,lot.qtyRemaining||0,lot.cost||0,status]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lotRows), 'Lot สินค้า');

  // ── Sheet: ใบแจ้งหนี้ ────────────────────────────────────
  const invRows = [['#','เลขที่','ประเภท','ผู้รับบริการ','วันที่','ครบกำหนด',
    'ยอดรวม','ชำระแล้ว','คงค้าง','สถานะ']];
  (db.invoices||[]).forEach((inv,i) => {
    const paid = typeof getInvoicePaidAmount==='function' ? getInvoicePaidAmount(inv.id) : 0;
    const status = typeof getInvoicePaymentStatus==='function' ? getInvoicePaymentStatus(inv) : inv.status;
    const statusLabel = {draft:'ร่าง',sent:'รอชำระ',partial:'ชำระบางส่วน',paid:'ชำระครบ',cancelled:'ยกเลิก'}[status]||status;
    invRows.push([i+1,inv.docNo||'-',inv.type||'-',inv.patientName||'-',
      inv.date||'-',inv.dueDate||'-',inv.grandTotal||0,paid,
      Math.max(0,(inv.grandTotal||0)-paid),statusLabel]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invRows), 'ใบแจ้งหนี้');

  // ── Sheet: การชำระเงิน ───────────────────────────────────
  const payRows = [['#','วันที่','เลขใบเสร็จ','ผู้รับบริการ','จำนวนเงิน','วิธีชำระ','ผู้รับเงิน','หมายเหตุ']];
  (db.payments||[]).forEach((p,i) => {
    payRows.push([i+1,p.paymentDate||'-',p.receiptNo||'-',p.patientName||'-',
      p.amount||0,p.method||'-',p.receivedBy||'-',p.note||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), 'การชำระเงิน');

  // ── Sheet: ค่าใช้จ่าย ────────────────────────────────────
  const expRows = [['#','วันที่','เลขเอกสาร','รายการ','จำนวนเงิน','ผู้จัดทำ','หมายเหตุ']];
  (db.expenses||[]).forEach((e,i) => {
    expRows.push([i+1,e.date||'-',e.docNo||'-',e.vendorName||e.job||'-',
      e.net||0,e.createdBy||'-',e.note||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'ค่าใช้จ่าย');

  // ── Sheet: การเบิกสินค้า ─────────────────────────────────
  const reqRows = [['#','เลขที่ใบเบิก','วันที่','ผู้รับบริการ','ผู้เบิก','รายการ','จำนวน','หน่วย','สถานะ']];
  (db.requisitions||[]).forEach((r,i) => {
    const statusLabel = {pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ'}[r.status]||r.status||'';
    (r.items||[{name:r.itemName,qty:r.qty,unit:r.unit}]).forEach((it, j) => {
      reqRows.push([j===0?i+1:'',j===0?r.refNo||r.id||'-':'',j===0?r.date||'-':'',
        j===0?r.patientName||'-':'',j===0?r.staffName||'-':'',
        it.name||'-',it.qty||0,it.unit||'-',j===0?statusLabel:'']);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reqRows), 'การเบิกสินค้า');

  // ── Sheet: รายงานอุบัติเหตุ ──────────────────────────────
  const incRows = [['#','วันที่','ผู้รับบริการ','ประเภทเหตุการณ์','รายละเอียด','การจัดการ','บันทึกโดย']];
  (db.incidentReports||[]).forEach((r,i) => {
    incRows.push([i+1,r.date||'-',r.patientName||'-',r.incidentType||'-',
      r.description||'-',r.action||'-',r.recordedBy||'-']);
  });
  if ((db.incidentReports||[]).length > 0)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'อุบัติเหตุ');

  // ── Sheet: ผู้จำหน่าย ────────────────────────────────────
  const supRows = [['#','รหัส','ชื่อบริษัท','ผู้ติดต่อ','เบอร์โทร','อีเมล','เลขภาษี','สถานะ']];
  (db.suppliers||[]).forEach((s,i) => {
    supRows.push([i+1,s.code||'',s.name||'',s.contactName||'',
      s.phone||'',s.email||'',s.taxId||'',s.status||'active']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supRows), 'ผู้จำหน่าย');

  // ── Sheet: Summary (สรุปภาพรวม) ─────────────────────────
  const sumRows = [
    ['📊 สรุปข้อมูล นวศรี เนอร์สซิ่งโฮม'],
    ['วันที่สำรองข้อมูล', today],
    [''],
    ['หมวดหมู่', 'จำนวน'],
    ['ผู้รับบริการทั้งหมด', (db.patients||[]).length],
    ['ผู้รับบริการปัจจุบัน', (db.patients||[]).filter(p=>p.status==='active').length],
    ['พนักงาน', (db.staff||[]).length],
    ['ห้องพัก', (db.rooms||[]).length],
    ['เตียง', (db.beds||[]).length],
    ['สินค้าในระบบ', (db.items||[]).length],
    ['สินค้าใกล้หมด/หมดแล้ว', (db.items||[]).filter(i=>i.qty<=i.reorder).length],
    ['ใบแจ้งหนี้ทั้งหมด', (db.invoices||[]).length],
    ['บิลค้างชำระ', (db.invoices||[]).filter(i=>{
      const s = typeof getInvoicePaymentStatus==='function' ? getInvoicePaymentStatus(i) : i.status;
      return s !== 'paid' && s !== 'cancelled';
    }).length],
    ['รายการเบิกสินค้า', (db.requisitions||[]).length],
    ['ผู้จำหน่าย', (db.suppliers||[]).length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'สรุป');

  // ส่ง Sheet สรุปไปหน้าแรก
  wb.SheetNames.unshift(wb.SheetNames.pop());

  XLSX.writeFile(wb, `navasri_backup_${today}.xlsx`);
  toast(`✅ Backup สำเร็จ! ดาวน์โหลดแล้ว (${wb.SheetNames.length} sheets)`, 'success');
}

function _calcDuration(startDate, endDate) {
  if (!startDate) return '-';
  const start = new Date(startDate);
  const end   = endDate ? new Date(endDate) : new Date();
  const days  = Math.floor((end - start) / (1000*60*60*24));
  if (days < 0) return '-';
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rem    = days % 30;
  if (years > 0)  return `${years} ปี ${months} เดือน`;
  if (months > 0) return `${months} เดือน ${rem} วัน`;
  return `${days} วัน`;
}

// ─────────────────────────────────────────────────────────────
// SECTION 5: LINE SETTINGS — เพิ่ม toggle สำหรับ features ใหม่
// ─────────────────────────────────────────────────────────────

// เรียกใช้ใน loadLineSettingsUI() เพื่อเพิ่ม toggle ใหม่
function extendLineSettingsUI() {
  const container = document.getElementById('line-extra-settings');
  if (!container) return;
  const ls = db.lineSettings || {};
  container.innerHTML = `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px;">🔔 การแจ้งเตือนเพิ่มเติม</div>
      <label style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;">
        <input type="checkbox" id="ls-notify-overdue" ${ls.notifyOverdueBills?'checked':''}
          onchange="updateLineSetting('notifyOverdueBills', this.checked)" style="width:16px;height:16px;">
        <span style="font-size:13px;">⏰ แจ้งเตือนบิลค้างชำระรายวัน</span>
      </label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:10px;">
        <input type="checkbox" id="ls-notify-stock" ${ls.notifyLowStock?'checked':''}
          onchange="updateLineSetting('notifyLowStock', this.checked)" style="width:16px;height:16px;">
        <span style="font-size:13px;">📦 แจ้งเตือนสต็อกสินค้าใกล้หมด/หมดอายุ</span>
      </label>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="manualNotifyOverdueBills()" style="background:#e67e2222;color:#e67e22;border:1px solid #e67e22;">
          ⏰ ทดสอบส่งแจ้งบิลค้าง
        </button>
        <button class="btn btn-sm" onclick="manualNotifyLowStock()" style="background:#3498db22;color:#3498db;border:1px solid #3498db;">
          📦 ทดสอบส่งแจ้งสต็อก
        </button>
      </div>
    </div>`;
}

async function updateLineSetting(key, value) {
  db.lineSettings = db.lineSettings || {};
  db.lineSettings[key] = value;
  // บันทึกลง Supabase settings
  await supa.from('settings').upsert({ key: 'lineSettings', value: db.lineSettings });
}

// ─────────────────────────────────────────────────────────────
// INIT: Hook เข้า renderPageExtra ที่มีอยู่แล้ว
// ─────────────────────────────────────────────────────────────

// เก็บ reference ของ renderPageExtra เดิม (จาก billing-core.js)
// แล้วต่อท้าย logic ของ features.js เข้าไป
(function() {
  const _prev = typeof window._renderPageExtraOrig === 'function'
    ? window._renderPageExtraOrig
    : (typeof renderPageExtra === 'function' ? renderPageExtra : null);

  window._renderPageExtraOrig = _prev;

  window.renderPageExtra = function(page) {
    // เรียก renderPageExtra เดิม (billing-core.js)
    if (_prev && _prev !== window.renderPageExtra) {
      try { _prev(page); } catch(e) { console.warn('renderPageExtra prev error', e); }
    }
    // เพิ่ม features ใหม่
    if (page === 'dashboard') {
      setTimeout(() => {
        const el = document.getElementById('dash-monthly-summary');
        if (el) renderMonthlySummaryCard('dash-monthly-summary');
        runDailyLineNotifications();
      }, 400);
    }
    if (page === 'settings') {
      setTimeout(extendLineSettingsUI, 300);
    }
  };
})();

