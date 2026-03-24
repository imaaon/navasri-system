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
// SECTION 4: BACKUP ข้อมูลทั้งหมด (ใช้ ExcelJS สำหรับ styling เต็มรูปแบบ)
// ─────────────────────────────────────────────────────────────

// สีประจำแต่ละ sheet
const BACKUP_THEMES = {
  'สรุป':          { dark:'1B4F72', mid:'2E86C1', light:'D6EAF8', title:'📊 สรุปภาพรวม' },
  'ผู้รับบริการ':  { dark:'145A32', mid:'1E8449', light:'D5F5E3', title:'🏥 ผู้รับบริการ' },
  'พนักงาน':       { dark:'4A235A', mid:'7D3C98', light:'E8DAEF', title:'👤 พนักงาน' },
  'ห้องพัก':       { dark:'7E5109', mid:'B7770D', light:'FDEBD0', title:'🛏️ ห้องพัก' },
  'เตียง':         { dark:'1A5276', mid:'2471A3', light:'D6EAF8', title:'🛏️ เตียง' },
  'สินค้า':        { dark:'0E6655', mid:'17A589', light:'D1F2EB', title:'📦 สินค้า' },
  'Lot สินค้า':    { dark:'117A65', mid:'148F77', light:'D1F2EB', title:'📦 Lot สินค้า' },
  'ใบแจ้งหนี้':    { dark:'7B241C', mid:'C0392B', light:'FADBD8', title:'💰 ใบแจ้งหนี้' },
  'การชำระเงิน':   { dark:'186A3B', mid:'239B56', light:'D5F5E3', title:'💳 การชำระเงิน' },
  'ค่าใช้จ่าย':    { dark:'6E2F1A', mid:'CA6F1E', light:'FAE5D3', title:'💸 ค่าใช้จ่าย' },
  'การเบิกสินค้า': { dark:'154360', mid:'1F618D', light:'D6EAF8', title:'📋 การเบิกสินค้า' },
  'อุบัติเหตุ':    { dark:'515A5A', mid:'717D7E', light:'EAECEE', title:'⚠️ อุบัติเหตุ' },
  'ผู้จำหน่าย':    { dark:'212F3D', mid:'566573', light:'EAECEE', title:'🏭 ผู้จำหน่าย' },
};

function _exjsColor(hex) {
  return { argb: 'FF' + hex.replace('#','').toUpperCase() };
}

function _exjsThinBorder() {
  const s = { style: 'thin', color: { argb: 'FFCCCCCC' } };
  return { top: s, bottom: s, left: s, right: s };
}

function _exjsApplySheet(wb, sheetName, headers, dataRows, theme) {
  const { dark, mid, light, title } = theme;
  const ws = wb.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FF' + dark } },
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  const today_th = (() => {
    const d = new Date();
    const M = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()+543}`;
  
  const ncols = headers.length;

  // Row 1: Title
  const r1 = ws.addRow([`นวศรี เนอร์สซิ่งโฮม  ·  ${title}  ·  ${today_th}`]);
  r1.height = 28;
  ws.mergeCells(1, 1, 1, ncols);
  const c1 = r1.getCell(1);
  c1.fill = { type:'pattern', pattern:'solid', fgColor: _exjsColor(dark) };
  c1.font = { name:'Arial', size:13, bold:true, color:{ argb:'FFFFFFFF' } };
  c1.alignment = { horizontal:'center', vertical:'middle' };

  // Row 2: Subtitle
  const r2 = ws.addRow([`ข้อมูล ณ วันที่ ${today_th}  |  จำนวน ${dataRows.length} รายการ`]);
  r2.height = 16;
  ws.mergeCells(2, 1, 2, ncols);
  const c2 = r2.getCell(1);
  c2.fill = { type:'pattern', pattern:'solid', fgColor: _exjsColor(mid) };
  c2.font = { name:'Arial', size:9, italic:true, color:{ argb:'FFFFFFFF' } };
  c2.alignment = { horizontal:'center', vertical:'middle' };

  // Row 3: Header
  const r3 = ws.addRow(headers);
  r3.height = 22;
  r3.eachCell(cell => {
    cell.fill = { type:'pattern', pattern:'solid', fgColor: _exjsColor(dark) };
    cell.font = { name:'Arial', size:10, bold:true, color:{ argb:'FFFFFFFF' } };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.border = _exjsThinBorder();
  });

  // Data rows
  dataRows.forEach((row, i) => {
    const dr = ws.addRow(row);
    dr.height = 17;
    const bg = i % 2 === 0 ? light : 'FFFFFF';
    dr.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type:'pattern', pattern:'solid', fgColor: _exjsColor(bg) };
      cell.font = { name:'Arial', size:9 };
      cell.alignment = { horizontal:'left', vertical:'middle', wrapText:true };
      cell.border = _exjsThinBorder();
    });
  });

  // Column widths
  headers.forEach((h, i) => {
    let maxLen = h ? h.length * 1.5 : 6;
    dataRows.forEach(row => {
      const v = row[i] ? String(row[i]) : '';
      const w = [...v].reduce((s,c) => s + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
      maxLen = Math.max(maxLen, w);
    });
    ws.getColumn(i + 1).width = Math.min(40, Math.max(7, maxLen * 0.85 + 2));
  });
}

async function backupAllData() {
  if (!confirm('ต้องการสำรองข้อมูลทั้งหมดออกเป็นไฟล์ Excel หรือไม่?\n\nจะดาวน์โหลดข้อมูลทุกตาราง 30+ ตาราง รวมถึง\nวันนัดหมาย, vital signs, ยาประจำ, แพ้อาหาร, ทรัพย์สิน,\nกายภาพบำบัด, บันทึกพยาบาล, MAR, อุบัติเหตุ, แผล และอื่นๆ')) return;

  toast('⏳ กำลังสร้างไฟล์ Excel (อาจใช้เวลา 10-20 วินาที)...', 'info');

  try {
    const key = window._supabaseKey || window.SUPABASE_ANON_KEY ||
      (typeof supa !== 'undefined' && supa.supabaseKey) || '';

    const res = await fetch(
      'https://umueucsxowjaurlaubwa.supabase.co/functions/v1/backup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({})
      }
    );

    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'navasri_backup_' + new Date().toISOString().slice(0,10) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('✅ Backup สำเร็จ! ดาวน์โหลด Excel แล้ว (ครบทุกตาราง)', 'success');
  } catch(e) {
    console.error('Backup error:', e);
    toast('❌ Backup ล้มเหลว: ' + e.message, 'error');
  }
}
} catch(e) {
    console.error('Backup error:', e);
    toast('❌ Backup ล้มเหลว: ' + e.message, 'error');
  }
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
  if (years > 0)  return years + ' ปี ' + months + ' เดือน';
  if (months > 0) return months + ' เดือน ' + rem + ' วัน';
  return days + ' วัน';
}

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
  await supa.from('settings').upsert({ key: 'lineSettings', value: db.lineSettings });
}

const _origRenderPageExtra = typeof renderPageExtra === 'function' ? renderPageExtra : null;
function renderPageExtra(page) {
  if (_origRenderPageExtra) _origRenderPageExtra(page);
  if (page === 'dashboard') {
    const dashEl = document.getElementById('dash-monthly-summary');
    if (dashEl) renderMonthlySummaryCard('dash-monthly-summary');
    setTimeout(runDailyLineNotifications, 3000);
  }
  if (page === 'settings') {
    setTimeout(extendLineSettingsUI, 200);
  }
}
  // ผู้รับบริการ (พร้อมห้อง/เตียง/ประเภท/โซน)
  const patData = (db.patients||[]).map((p,i) => {
    const sl  = {active:'พักอยู่',hospital:'อยู่โรงพยาบาล',inactive:'ออกแล้ว'}[p.status]||p.status||'';
    const age = p.dob ? Math.floor((new Date()-new Date(p.dob))/(365.25*24*3600*1000))+'ปี' : '-';
    const bed = (db.beds||[]).find(b=>b.id===p.currentBedId);
    const rm  = bed ? (db.rooms||[]).find(r=>r.id===bed.roomId) : null;
    return [i+1,p.name||'',p.hn||'',p.idType||'',p.idcard||p.idCard||'',
      p.dob||'',age,p.gender||'',p.admitDate||'',p.endDate||'',
      p.admitDate ? _calcDuration(p.admitDate,p.endDate) : '-', sl,
      rm?.name||'-', rm?.roomType||'-', rm?.zone||'-', bed?.bedCode||'-',
      p.phone||'',p.emergency||'',p.address||'',p.note||''];
  });
  _exjsApplySheet(wb, 'ผู้รับบริการ',
    ['#','ชื่อ-นามสกุล','HN','ประเภทบัตร','เลขบัตร','วันเกิด','อายุ','เพศ',
     'วันรับบริการ','วันสิ้นสุด','ระยะเวลา','สถานะ',
     'ห้องปัจจุบัน','ประเภทห้อง','โซน','เตียง',
     'โทรศัพท์','ผู้ติดต่อฉุกเฉิน','ที่อยู่','หมายเหตุ'],
    patData, BACKUP_THEMES['ผู้รับบริการ']);

  // พนักงาน
  const staffData = (db.staff||[]).map((s,i) => {
    const active = !s.endDate || s.endDate > today;
    return [i+1,s.name||s.displayName||'',s.position||'',s.department||'',
      s.phone||'',s.email||'',s.startDate||'',active?'ทำงานอยู่':'ออกแล้ว'];
  });
  _exjsApplySheet(wb, 'พนักงาน',
    ['#','ชื่อ-นามสกุล','ตำแหน่ง','แผนก','เบอร์โทร','อีเมล','วันเริ่มงาน','สถานะ'],
    staffData, BACKUP_THEMES['พนักงาน']);

  // ห้องพัก
  const roomData = (db.rooms||[]).map((r,i) =>
    [i+1,r.name||'',r.roomType||'',r.zone||'-',r.monthlyRate||0,r.dailyRate||0,r.status||'']);
  _exjsApplySheet(wb, 'ห้องพัก',
    ['#','ชื่อห้อง','ประเภท','โซน','ราคารายเดือน','ราคารายวัน','สถานะ'],
    roomData, BACKUP_THEMES['ห้องพัก']);

  // เตียง
  const bedData = (db.beds||[]).map((b,i) => {
    const rm  = (db.rooms||[]).find(r=>r.id===b.roomId);
    const pat = (db.patients||[]).find(p=>p.currentBedId===b.id&&p.status==='active');
    return [i+1,b.bedCode||'',rm?.name||'',rm?.roomType||'-',rm?.zone||'-',b.status||'',pat?.name||'ว่าง'];
  });
  _exjsApplySheet(wb, 'เตียง',
    ['#','รหัสเตียง','ห้อง','ประเภทห้อง','โซน','สถานะ','ผู้รับบริการปัจจุบัน'],
    bedData, BACKUP_THEMES['เตียง']);

  // สินค้า
  const itemData = (db.items||[]).map((item,i) => {
    const st = item.qty<=0?'หมด':item.qty<=item.reorder?'ใกล้หมด':'ปกติ';
    return [i+1,item.name||'',item.category||'',item.barcode||'',
      item.qty||0,item.unit||'',item.reorder||0,item.cost||0,item.price||0,
      item.isBillable!==false?'ใช่':'ไม่',st];
  });
  _exjsApplySheet(wb, 'สินค้า',
    ['#','ชื่อสินค้า','ประเภท','บาร์โค้ด','คงเหลือ','หน่วยจ่าย','จุดสั่งซื้อ','ราคาทุน','ราคาขาย','Billable','สถานะ'],
    itemData, BACKUP_THEMES['สินค้า']);

  // Lot สินค้า
  const lotData = (db.itemLots||[]).map((lot,i) => {
    const item = (db.items||[]).find(x=>x.id==lot.itemId);
    const now  = new Date(); now.setHours(0,0,0,0);
    const exp  = lot.expiryDate ? new Date(lot.expiryDate) : null;
    const diff = exp ? Math.ceil((exp-now)/86400000) : null;
    const st   = !exp?'ไม่ระบุ':diff<0?'หมดอายุแล้ว':diff<=30?`อีก ${diff} วัน`:lot.expiryDate;
    return [i+1,item?.name||'-',lot.lotNumber||'-',lot.receivedDate||'-',
      lot.expiryDate||'-',lot.qtyInLot||0,lot.qtyRemaining||0,lot.cost||0,st];
  });
  _exjsApplySheet(wb, 'Lot สินค้า',
    ['#','สินค้า','Lot Number','วันรับ','วันหมดอายุ','จำนวนรับ','คงเหลือ','ราคาทุน/หน่วย','สถานะ'],
    lotData, BACKUP_THEMES['Lot สินค้า']);

  // ใบแจ้งหนี้
  const invData = (db.invoices||[]).map((inv,i) => {
    const paid = typeof getInvoicePaidAmount==='function' ? getInvoicePaidAmount(inv.id) : 0;
    const st   = typeof getInvoicePaymentStatus==='function' ? getInvoicePaymentStatus(inv) : inv.status;
    const lbl  = {draft:'ร่าง',sent:'รอชำระ',partial:'ชำระบางส่วน',paid:'ชำระครบ',cancelled:'ยกเลิก'}[st]||st;
    return [i+1,inv.docNo||'-',inv.type||'-',inv.patientName||'-',
      inv.date||'-',inv.dueDate||'-',inv.grandTotal||0,paid,Math.max(0,(inv.grandTotal||0)-paid),lbl];
  });
  _exjsApplySheet(wb, 'ใบแจ้งหนี้',
    ['#','เลขที่','ประเภท','ผู้รับบริการ','วันที่','ครบกำหนด','ยอดรวม','ชำระแล้ว','คงค้าง','สถานะ'],
    invData, BACKUP_THEMES['ใบแจ้งหนี้']);

  // การชำระเงิน
  const payData = (db.payments||[]).map((p,i) =>
    [i+1,p.paymentDate||'-',p.receiptNo||'-',p.patientName||'-',
      p.amount||0,p.method||'-',p.receivedBy||'-',p.note||'']);
  _exjsApplySheet(wb, 'การชำระเงิน',
    ['#','วันที่','เลขใบเสร็จ','ผู้รับบริการ','จำนวนเงิน','วิธีชำระ','ผู้รับเงิน','หมายเหตุ'],
    payData, BACKUP_THEMES['การชำระเงิน']);

  // ค่าใช้จ่าย
  const expData = (db.expenses||[]).map((e,i) =>
    [i+1,e.date||'-',e.docNo||'-',e.vendorName||e.job||'-',e.net||0,e.createdBy||'-',e.note||'']);
  _exjsApplySheet(wb, 'ค่าใช้จ่าย',
    ['#','วันที่','เลขเอกสาร','รายการ','จำนวนเงิน','ผู้จัดทำ','หมายเหตุ'],
    expData, BACKUP_THEMES['ค่าใช้จ่าย']);

  // การเบิกสินค้า
  const reqData = [];
  (db.requisitions||[]).forEach((r,i) => {
    const lbl   = {pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ'}[r.status]||r.status||'';
    const lines = r.lines?.length ? r.lines : [{itemName:r.itemName,qty:r.qty,unit:r.unit}];
    lines.forEach((it,j) => reqData.push([
      j===0?i+1:'', j===0?r.refNo||r.id||'-':'', j===0?r.date||'-':'',
      j===0?r.patientName||'-':'', j===0?r.staffName||'-':'',
      it.itemName||it.name||'-', it.qty||0, it.unit||'-', j===0?lbl:'']));
  });
  _exjsApplySheet(wb, 'การเบิกสินค้า',
    ['#','เลขที่ใบเบิก','วันที่','ผู้รับบริการ','ผู้เบิก','รายการ','จำนวน','หน่วย','สถานะ'],
    reqData, BACKUP_THEMES['การเบิกสินค้า']);

  // อุบัติเหตุ (ถ้ามี)
  const incData = (db.incidents||[]).map((r,i) =>
    [i+1,r.date||'-',r.time||'-',r.patientName||'-',r.type||'-',
      r.location||'-',r.detail||'-',r.firstAid||'-',r.severity||'-',r.recorder||'-']);
  if (incData.length > 0)
    _exjsApplySheet(wb, 'อุบัติเหตุ',
      ['#','วันที่','เวลา','ผู้รับบริการ','ประเภท','สถานที่','รายละเอียด','การปฐมพยาบาล','ความรุนแรง','บันทึกโดย'],
      incData, BACKUP_THEMES['อุบัติเหตุ']);

  // ผู้จำหน่าย
  const supData = (db.suppliers||[]).map((s,i) =>
    [i+1,s.code||'',s.name||'',s.contactName||'',s.phone||'',s.email||'',s.taxId||'',s.status||'active']);
  _exjsApplySheet(wb, 'ผู้จำหน่าย',
    ['#','รหัส','ชื่อบริษัท','ผู้ติดต่อ','เบอร์โทร','อีเมล','เลขภาษี','สถานะ'],
    supData, BACKUP_THEMES['ผู้จำหน่าย']);

  // Export
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `navasri_backup_${today}.xlsx`; a.click();
  URL.revokeObjectURL(url);
  toast(`✅ Backup สำเร็จ! ดาวน์โหลดแล้ว (${wb.worksheets.length} sheets)`, 'success');
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


