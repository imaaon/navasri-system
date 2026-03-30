// ===== NAVASRI FEATURES MODULE =====
// 1. Dashboard สรุปรายได้/รายจ่ายรายเดือน
// 2. แจ้งเตือน LINE เมื่อบิลครบกำหนด
// 3. แจ้งเตือนสต็อกใกล้หมด
// 4. Export รายงานเป็น Excel
// 5. Backup ข้อมูลทั้งหมด

function renderMonthlySummaryCard(targetElementId, monthStr) {
  const el = document.getElementById(targetElementId);
  if (!el) return;
  const month = monthStr || new Date().toISOString().slice(0, 7);
  const paidPayments = (db.payments || []).filter(p => (p.paymentDate || '').startsWith(month));
  const totalRevenue = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const monthExpenses = (db.expenses || []).filter(e => (e.date || '').startsWith(month));
  const expenseTotal = monthExpenses.reduce((s, e) => s + (e.net || 0), 0);
  const monthSupInv = (db.supplierInvoices || []).filter(si => (si.paidDate || '').startsWith(month) && si.status === 'paid');
  const supInvTotal = monthSupInv.reduce((s, si) => s + (si.total || 0), 0);
  const totalExpense = expenseTotal + supInvTotal;
  const netProfit = totalRevenue - totalExpense;
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
  const chartData = _buildMonthlyChartData(6);
  const profitColor = netProfit >= 0 ? '#27ae60' : '#e74c3c';
  const profitIcon = netProfit >= 0 ? '📈' : '📉';
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="card-title">💰 สรุปการเงินเดือน ${_thaiMonth(month)}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="month" value="${month}" onchange="renderMonthlySummaryCard('${targetElementId}', this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;background:var(--surface2);color:var(--text1);">
          <button class="btn btn-ghost btn-sm" onclick="exportMonthlyExcel('${month}')" title="Export Excel">📥 Export</button>
        </div>
      </div>
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
        ${overdueTotal > 0 ? `<div style="background:#fef9e7;border:1px solid #f9e79f;border-radius:10px;padding:14px;text-align:center;cursor:pointer;" onclick="showPage('billing')"><div style="font-size:11px;color:#e67e22;font-weight:600;margin-bottom:4px;">⏰ ค้างชำระ</div><div style="font-size:20px;font-weight:800;color:#e67e22;">${_thb(overdueTotal)}</div><div style="font-size:10px;color:#f0b27a;margin-top:2px;">${overdueInvoices.length} บิล</div></div>` : ''}
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px;">📊 รายได้-รายจ่าย 6 เดือนล่าสุด</div>
        ${_renderBarChart(chartData)}
      </div>
    </div>`;
}

function _buildMonthlyChartData(months) {
  const data = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const rev = (db.payments||[]).filter(p=>(p.paymentDate||'').startsWith(m)).reduce((s,p)=>s+(p.amount||0),0);
    const exp = (db.expenses||[]).filter(e=>(e.date||'').startsWith(m)).reduce((s,e)=>s+(e.net||0),0)
      + (db.supplierInvoices||[]).filter(si=>(si.paidDate||'').startsWith(m)&&si.status==='paid').reduce((s,si)=>s+(si.total||0),0);
    data.push({ month: m, label: _shortMonth(m), revenue: rev, expense: exp });
  }
  return data;
}

function _renderBarChart(data) {
  if (!data || data.length === 0) return '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">ไม่มีข้อมูล</div>';
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expense)), 1);
  const barH = 80;
  const bars = data.map(d => {
    const rH = Math.round((d.revenue / maxVal) * barH);
    const eH = Math.round((d.expense / maxVal) * barH);
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;"><div style="display:flex;align-items:flex-end;gap:2px;height:${barH}px;"><div style="width:18px;background:#27ae60;border-radius:3px 3px 0 0;height:${rH}px;min-height:${d.revenue>0?2:0}px;"></div><div style="width:18px;background:#e74c3c;border-radius:3px 3px 0 0;height:${eH}px;min-height:${d.expense>0?2:0}px;"></div></div><div style="font-size:10px;color:var(--text3);margin-top:4px;">${d.label}</div></div>`;
  }).join('');
  return `<div><div style="display:flex;gap:12px;margin-bottom:6px;"><span style="font-size:11px;color:#27ae60;">■ รายได้</span><span style="font-size:11px;color:#e74c3c;">■ รายจ่าย</span></div><div style="display:flex;align-items:flex-end;gap:4px;padding:0 4px;border-bottom:1px solid var(--border);">${bars}</div></div>`;
}

function _thaiMonth(monthStr) {
  if (!monthStr) return '';
  const M = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [y, m] = monthStr.split('-');
  return M[parseInt(m)] + ' ' + (parseInt(y)+543);
}

function _shortMonth(monthStr) {
  if (!monthStr) return '';
  const M = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return M[parseInt(monthStr.split('-')[1])];
}

function _thb(n) {
  return (n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ฿';
}

async function checkAndNotifyOverdueBills() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl || !ls.notifyOverdueBills) return;
  const today = new Date().toISOString().split('T')[0];
  const overdueList = (db.invoices || []).filter(inv => {
    if (!inv.dueDate || inv.dueDate > today) return false;
    const status = typeof getInvoicePaymentStatus === 'function' ? getInvoicePaymentStatus(inv) : inv.status;
    return status !== 'paid' && status !== 'cancelled';
  });
  if (overdueList.length === 0) return;
  const lines = overdueList.slice(0, 10).map(inv => {
    const balance = typeof getInvoicePaidAmount === 'function' ? (inv.grandTotal||0) - getInvoicePaidAmount(inv.id) : (inv.grandTotal||0);
    return '• ' + inv.patientName + ' (' + inv.docNo + ') ค้าง ' + _thb(balance) + ' ครบ ' + inv.dueDate;
  });
  const msg = '⏰ แจ้งเตือนบิลค้างชำระ ' + overdueList.length + ' รายการ\n' + lines.join('\n');
  await sendLineNotify('overdue_bills', msg, { count: overdueList.length });
}

async function checkAndNotifyLowStockDaily() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl || !ls.notifyLowStockDaily) return;
  const lowItems = (db.items || []).filter(i => i.qty <= i.reorder && i.qty >= 0);
  if (lowItems.length === 0) return;
  const msg = '📦 แจ้งเตือนสต็อกสินค้า ' + lowItems.length + ' รายการใกล้หมด/หมด';
  await sendLineNotify('low_stock_daily', msg, { count: lowItems.length });
}

async function runDailyLineNotifications() {
  const today = new Date().toISOString().split('T')[0];
  const lastRun = localStorage.getItem('_navasri_line_notify_date');
  if (lastRun === today) return;
  await Promise.all([checkAndNotifyOverdueBills(), checkAndNotifyLowStockDaily()]);
  localStorage.setItem('_navasri_line_notify_date', today);
}

async function manualNotifyLowStock() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl) { toast('ยังไม่ได้ตั้งค่า LINE Webhook', 'warning'); return; }
  const lowItems = (db.items || []).filter(i => i.qty <= i.reorder);
  if (lowItems.length === 0) { toast('ไม่มีสินค้าใกล้หมดในขณะนี้', 'info'); return; }
  for (const i of lowItems.slice(0, 5)) {
    await sendLineNotify('low_stock', buildLineMsg('low_stock', { itemName: i.name, qty: i.qty, unit: i.unit, reorder: i.reorder }), { itemId: i.id });
  }
  toast('ส่งแจ้งเตือนแล้ว', 'success');
}

async function manualNotifyOverdueBills() {
  const ls = db.lineSettings || {};
  if (!ls.enabled || !ls.webhookUrl) { toast('ยังไม่ได้ตั้งค่า LINE Webhook', 'warning'); return; }
  const saved = ls.notifyOverdueBills;
  db.lineSettings.notifyOverdueBills = true;
  await checkAndNotifyOverdueBills();
  db.lineSettings.notifyOverdueBills = saved;
}

function exportMonthlyExcel(monthStr) {
  const month = monthStr || new Date().toISOString().slice(0, 7);
  if (typeof XLSX === 'undefined') { toast('ไม่พบ SheetJS', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const payRows = [['#','วันที่รับ','เลขบิล','ผู้รับบริการ','จำนวนเงิน','วิธีชำระ']];
  (db.payments||[]).filter(p=>(p.paymentDate||'').startsWith(month)).forEach((p,i) => {
    const inv = (db.invoices||[]).find(inv=>inv.id===p.invoiceId);
    payRows.push([i+1,p.paymentDate,inv?.docNo||'-',p.patientName||'-',p.amount||0,p.method||'-']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), 'รายรับ');
  XLSX.writeFile(wb, 'navasri_report_' + month + '.xlsx');
  toast('ดาวน์โหลด Excel แล้ว ✅', 'success');
}

async function backupAllData() {
  if (!confirm('ต้องการสำรองข้อมูลทั้งหมดออกเป็นไฟล์ Excel หรือไม่?')) return;
  toast('⏳ กำลังสร้างไฟล์ Excel...', 'info');
  try {
    const key = (typeof supa !== 'undefined' && supa.supabaseKey) || '';
    const res = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/backup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': key }, body: '{}'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'navasri_backup_' + new Date().toISOString().slice(0,10) + '.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✅ Backup สำเร็จ!', 'success');
  } catch(e) { toast('❌ Backup ล้มเหลว: ' + e.message, 'error'); }
}

function _calcDuration(startDate, endDate) {
  if (!startDate) return '-';
  const days = Math.floor((new Date(endDate||Date.now()) - new Date(startDate)) / 86400000);
  if (days < 0) return '-';
  const y = Math.floor(days/365), m = Math.floor((days%365)/30), d = days%30;
  if (y > 0) return y + ' ปี ' + m + ' เดือน';
  if (m > 0) return m + ' เดือน ' + d + ' วัน';
  return days + ' วัน';
}

function extendLineSettingsUI() {
  const container = document.getElementById('line-extra-settings');
  if (!container) return;
  const ls = db.lineSettings || {};
  container.innerHTML = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px;">🔔 การแจ้งเตือนเพิ่มเติม</div><label style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;"><input type="checkbox" ${ls.notifyOverdueBills?'checked':''} onchange="updateLineSetting('notifyOverdueBills', this.checked)" style="width:16px;height:16px;"><span style="font-size:13px;">⏰ แจ้งเตือนบิลค้างชำระรายวัน</span></label><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-sm" onclick="manualNotifyOverdueBills()" style="background:#e67e2222;color:#e67e22;border:1px solid #e67e22;">⏰ ทดสอบส่งแจ้งบิลค้าง</button><button class="btn btn-sm" onclick="manualNotifyLowStock()" style="background:#3498db22;color:#3498db;border:1px solid #3498db;">📦 ทดสอบส่งแจ้งสต็อก</button></div></div>`;
}

async function updateLineSetting(key, value) {
  db.lineSettings = db.lineSettings || {};
  db.lineSettings[key] = value;
  await supa.from('settings').upsert({ key: 'lineSettings', value: db.lineSettings });
}

(function() {
  const _prev = typeof renderPageExtra === 'function' ? renderPageExtra : null;
  window.renderPageExtra = function(page) {
    if (_prev && _prev !== window.renderPageExtra) { try { _prev(page); } catch(e) {} }
    if (page === 'dashboard') {
      setTimeout(() => {
        const el = document.getElementById('dash-monthly-summary');
        if (el) renderMonthlySummaryCard('dash-monthly-summary');
        runDailyLineNotifications();
      }, 400);
    }
    if (page === 'settings') { setTimeout(extendLineSettingsUI, 300); }
  };
})();
