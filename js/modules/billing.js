// ===== BILLING MODULE =====

// ===== INVOICE RESET =====
function openInvoiceResetModal(id) {
  // ตรวจสิทธิ์
  const role = currentUser?.role;
  if (!['admin','manager','officer'].includes(role)) {
    toast('❌ ไม่มีสิทธิ์ Reset บิล', 'error'); return;
  }
  const inv = (db.invoices||[]).find(i=>i.id===id);
  if (!inv) return;

  document.getElementById('reset-invoice-id').value = id;
  document.getElementById('reset-invoice-reason').value = '';
  document.getElementById('reset-invoice-status').value = 'sent';

  const dynStatus = getDynamicInvoiceStatus(inv);
  const STATUS_LABELS = { draft:'ร่าง', sent:'รอชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ' };
  const paid = getInvoicePaidAmount(id);
  document.getElementById('reset-invoice-info').innerHTML =
    `<div>เลขที่: <strong>${inv.docNo||'-'}</strong></div>
     <div>สถานะปัจจุบัน: <strong style="color:#c0392b;">${STATUS_LABELS[dynStatus]||dynStatus}</strong></div>
     <div>ยอดรับชำระแล้ว: <strong>${formatThb(paid)}</strong> / ${formatThb(inv.grandTotal||0)}</div>`;

  openModal('modal-invoice-reset');
}

async function saveInvoiceReset() {
  const id     = document.getElementById('reset-invoice-id').value;
  const newStatus = document.getElementById('reset-invoice-status').value;
  const reason = document.getElementById('reset-invoice-reason').value.trim();

  if (!reason) { toast('กรุณาระบุเหตุผล', 'warning'); return; }

  const inv = (db.invoices||[]).find(i=>i.id===id);
  if (!inv) return;

  const dynStatus = getDynamicInvoiceStatus(inv);
  const paid = getInvoicePaidAmount(id);

  // บันทึก Log ก่อน
  const logData = {
    invoice_id:     id,
    doc_no:         inv.docNo || '-',
    patient_name:   inv.patientName || '-',
    old_status:     dynStatus,
    new_status:     newStatus,
    old_paid_amount: paid,
    grand_total:    inv.grandTotal || 0,
    reason:         reason,
    reset_by:       currentUser?.displayName || currentUser?.username || '',
    reset_by_role:  currentUser?.role || '',
    reset_at:       new Date().toISOString()
  };
  const { error: logErr } = await supa.from('invoice_reset_logs').insert(logData);
  if (logErr) console.warn('reset log error:', logErr.message);

  // ถ้า reset เป็น draft หรือ sent → ลบประวัติการชำระทั้งหมดของบิลนี้ออก
  if (newStatus === 'draft' || newStatus === 'sent') {
    await supa.from('payments').delete().eq('invoice_id', id);
    db.payments = (db.payments||[]).filter(p => p.invoiceId != id);
  }

  // อัปเดตสถานะบิล
  await supa.from('invoices').update({ status: newStatus }).eq('id', id);
  inv.status = newStatus;

  // บันทึก log ใน local
  if (!db.invoiceResetLogs) db.invoiceResetLogs = [];
  db.invoiceResetLogs.unshift(logData);

  toast(`✅ Reset บิล ${inv.docNo} เรียบร้อย → ${newStatus}`, 'success');
  closeModal('modal-invoice-reset');
  renderBilling();
}

function openInvoiceResetLogModal() {
  renderInvoiceResetLog();
  openModal('modal-invoice-reset-log');
}

function renderInvoiceResetLog() {
  const logs = db.invoiceResetLogs || [];
  const el = document.getElementById('invoice-reset-log-list');
  const STATUS_LABELS = { draft:'ร่าง', sent:'รอชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ' };

  if (!logs.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">ยังไม่มีประวัติการ Reset</div>';
    return;
  }

  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:var(--bg2);position:sticky;top:0;">
      <th style="padding:10px 12px;text-align:left;">เวลา</th>
      <th style="padding:10px 12px;text-align:left;">เลขที่บิล</th>
      <th style="padding:10px 12px;text-align:left;">ผู้รับบริการ</th>
      <th style="padding:10px 12px;text-align:left;">สถานะเดิม</th>
      <th style="padding:10px 12px;text-align:left;">Reset เป็น</th>
      <th style="padding:10px 12px;text-align:right;">ยอดชำระเดิม</th>
      <th style="padding:10px 12px;text-align:left;">เหตุผล</th>
      <th style="padding:10px 12px;text-align:left;">ผู้ Reset</th>
    </tr></thead>
    <tbody>${logs.map(l => `<tr style="border-top:1px solid var(--border);">
      <td style="padding:9px 12px;font-size:11px;color:var(--text3);">${l.reset_at ? new Date(l.reset_at).toLocaleString('th-TH') : '-'}</td>
      <td style="padding:9px 12px;font-weight:600;font-family:monospace;">${l.doc_no||'-'}</td>
      <td style="padding:9px 12px;">${l.patient_name||'-'}</td>
      <td style="padding:9px 12px;"><span style="color:#c0392b;font-weight:600;">${STATUS_LABELS[l.old_status]||l.old_status||'-'}</span></td>
      <td style="padding:9px 12px;"><span style="color:#27ae60;font-weight:600;">${STATUS_LABELS[l.new_status]||l.new_status||'-'}</span></td>
      <td style="padding:9px 12px;text-align:right;">${l.old_paid_amount ? formatThb(l.old_paid_amount) : '-'}</td>
      <td style="padding:9px 12px;color:var(--text2);">${l.reason||'-'}</td>
      <td style="padding:9px 12px;font-size:12px;">${l.reset_by||'-'} <span style="color:var(--text3);">(${l.reset_by_role||'-'})</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}


// =====================================================
// ===== BILLING / ACCOUNTING MODULE ===================
// =====================================================

const DEFAULT_BILLING_SETTINGS = {
  company: 'นวศรี เนอร์สซิ่งโฮม', address: '', taxId: '',
  phone: '', email: '', docPrefix: 'BL', docPrefixExp: 'EXP', vatRate: 0
};

function getBillingSettings() { return db.billingSettings || { ...DEFAULT_BILLING_SETTINGS }; }

// ── Page extra routing ──────────────────────────────
function renderPageExtra(page) {
  if (page === 'billing-settings') loadBillingSettingsUI();
  if (page === 'billing') renderBilling();
}

// ── Init ─────────────────────────────────────────────
function initBilling() {
  if (!db.invoices) db.invoices = [];
  if (!db.expenses) db.expenses = [];
}

// ── Month filter ─────────────────────────────────────
function initBillingMonthFilter() {
  const sel = document.getElementById('billing-filter-month');
  if (!sel) return;
  const months = new Set();
  (db.invoices || []).forEach(i => { if (i.date) months.add(i.date.slice(0,7)); });
  (db.expenses || []).forEach(e => { if (e.date) months.add(e.date.slice(0,7)); });
  const sorted = Array.from(months).sort().reverse();
  sel.innerHTML = '<option value="">ทุกเดือน</option>' + sorted.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ── Render billing page ───────────────────────────────
function renderBilling() {
  initBilling();
  initBillingMonthFilter();

  const typeFilter   = document.getElementById('billing-filter-type')?.value || '';
  const statusFilter = document.getElementById('billing-filter-status')?.value || '';
  const monthFilter  = document.getElementById('billing-filter-month')?.value || '';
  const search       = (document.getElementById('billing-search')?.value || '').toLowerCase();

  // Invoices
  let invList = db.invoices;
  if (typeFilter && typeFilter !== 'expense') invList = invList.filter(i => i.type === typeFilter);
  else if (typeFilter === 'expense') invList = [];
  if (statusFilter) invList = invList.filter(i => i.status === statusFilter);
  if (monthFilter)  invList = invList.filter(i => i.date?.startsWith(monthFilter));
  if (search)       invList = invList.filter(i => (i.patientName||'').toLowerCase().includes(search));

  // Expenses
  let expList = (!typeFilter || typeFilter === 'expense') ? (db.expenses||[]) : [];
  if (statusFilter) expList = [];
  if (monthFilter)  expList = expList.filter(e => e.date?.startsWith(monthFilter));
  if (search)       expList = expList.filter(e => (e.job||e.vendorName||'').toLowerCase().includes(search));

  const allInvoiceTotal = (db.invoices||[]).reduce((s,i)=>s+(i.grandTotal||0),0);
  const allExpTotal     = (db.expenses||[]).reduce((s,e)=>s+(e.net||0),0);
  const pendingTotal    = invList.filter(i=>i.status==='sent'||i.status==='draft').reduce((s,i)=>s+(i.grandTotal||0),0);
  const paidTotal       = invList.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.grandTotal||0),0);

  document.getElementById('billing-total-amount').textContent   = formatThb(allInvoiceTotal);
  document.getElementById('billing-pending-amount').textContent  = formatThb(pendingTotal);
  document.getElementById('billing-paid-amount').textContent     = formatThb(paidTotal);
  document.getElementById('billing-doc-count').textContent       = invList.length + expList.length;
  const expCard = document.getElementById('billing-exp-amount');
  if(expCard) expCard.textContent = formatThb(allExpTotal);

  const TYPE_LABELS   = { invoice:'ใบแจ้งหนี้', receipt:'ใบเสร็จ', quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี', expense:'ค่าใช้จ่าย' };
  const STATUS_COLORS = { draft:'#888', sent:'#e67e22', partial:'#3498db', paid:'#27ae60', cancelled:'#e74c3c' };
  const STATUS_LABELS = { draft:'ร่าง', sent:'รอชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ', cancelled:'ยกเลิก' };

  const TYPE_ORDER = {quotation:1, invoice:2, tax_invoice:3, receipt:4};
  const invRows = [...invList].sort((a,b)=>{
    const td = (TYPE_ORDER[a.type]||9) - (TYPE_ORDER[b.type]||9);
    if(td !== 0) return td;
    return (b.date||'').localeCompare(a.date||'');
  }).map(inv => {
    const paid     = getInvoicePaidAmount(inv.id);
    const balance  = (inv.grandTotal||0) - paid;
    const dynStatus = getInvoicePaymentStatus(inv);
    const isOverdue = inv.dueDate && inv.dueDate < new Date().toISOString().split('T')[0] && dynStatus !== 'paid';
    return `
    <tr style="${isOverdue?'background:#fff8f8;':''}">
      <td style="font-family:monospace;font-size:12px;">${inv.docNo||'-'}${inv.contractId?'<span style="font-size:10px;color:var(--accent);margin-left:4px;">🤖</span>':''}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(90,158,122,.15);color:var(--accent);">${TYPE_LABELS[inv.type]||inv.type}</span></td>
      <td>${inv.patientName||'-'}</td>
      <td style="font-size:12px;">${inv.date||'-'}</td>
      <td style="font-size:12px;color:${isOverdue?'#e74c3c':'var(--text2)'};">${inv.dueDate||'-'}${isOverdue?' ⚠️':''}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(inv.grandTotal||0)}</td>
      <td style="text-align:right;color:#27ae60;">${paid>0?formatThb(paid):'-'}</td>
      <td style="text-align:right;font-weight:${balance>0?'700':'400'};color:${balance>0?'#e67e22':'var(--text3)'};">${balance>0?formatThb(balance):'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${STATUS_COLORS[dynStatus]||'#888'}22;color:${STATUS_COLORS[dynStatus]||'#888'};">${STATUS_LABELS[dynStatus]||dynStatus}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${inv.id}','invoice')" title="ดู Preview">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="printInvoice('${inv.id}')" title="พิมพ์">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="exportInvoicePDF('${inv.id}')" title="Export PDF" style="color:#e74c3c;">📄</button>
        <button class="btn btn-ghost btn-sm" onclick="editInvoice('${inv.id}')" title="แก้ไข">✏️</button>
        ${dynStatus!=='paid'?`<button class="btn btn-primary btn-sm" onclick="openRecordPaymentModal('${inv.id}')" title="รับชำระ" style="font-size:11px;">💳 รับชำระ</button>`:''}
        ${['admin','manager','officer'].includes(currentUser?.role) && (dynStatus==='paid'||dynStatus==='partial') ? `<button class="btn btn-ghost btn-sm" onclick="openInvoiceResetModal('${inv.id}')" title="Reset บิล" style="color:#8e44ad;font-size:11px;">🔄 Reset</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteInvoice('${inv.id}')" style="color:#e74c3c;">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  const expRows = [...expList].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(exp => `
    <tr>
      <td style="font-family:monospace;font-size:12px;">${exp.docNo||'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#e67e2222;color:#e67e22;">ค่าใช้จ่าย</span></td>
      <td style="font-size:13px;">${exp.vendorName||exp.job||'-'}</td>
      <td style="font-size:12px;">${exp.date||'-'}</td>
      <td style="font-size:12px;color:var(--text2);">${exp.payDate||'-'}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(exp.net||0)}</td>
      <td>-</td><td>-</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#27ae6022;color:#27ae60;">บันทึกแล้ว</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${exp.id}','expense')" title="ดู Preview">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="printExpense('${exp.id}')" title="พิมพ์">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="exportExpensePDF('${exp.id}')" title="Export PDF" style="color:#e74c3c;">📄</button>
        <button class="btn btn-ghost btn-sm" onclick="editExpense('${exp.id}')" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteExpense('${exp.id}')" style="color:#e74c3c;">🗑️</button>
      </td>
    </tr>`).join('');

  const tb = document.getElementById('billing-table-body');
  const allRows = invRows + expRows;
  tb.innerHTML = allRows || '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:40px;">ไม่มีเอกสาร</td></tr>';
}

// ── Format ───────────────────────────────────────────
function formatThb(n) {
  return (n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ฿';
}

// ── DocNo generation ─────────────────────────────────
function generateDocNo(type) {
  // Prefix per document type
  const TYPE_PREFIX = {
    invoice:     'BL',
    receipt:     'RE',
    quotation:   'QT',
    tax_invoice: 'TX',
    expense:     'EXP',
  };
  const prefix = TYPE_PREFIX[type] || 'DOC';
  const now  = new Date();
  const year = now.getFullYear();
  const mon  = String(now.getMonth()+1).padStart(2,'0');
  const ym   = `${year}${mon}`;

  // Find highest existing sequence number for this type+month, then +1
  // This prevents duplicate numbers even if user manually edits a doc number
  let pool;
  if (type === 'expense') {
    pool = (db.expenses||[])
      .filter(e => (e.date||'').startsWith(`${year}-${mon}`))
      .map(e => {
        const m = (e.docNo||'').match(/(\d{4})$/);
        return m ? parseInt(m[1], 10) : 0;
      });
  } else {
    pool = (db.invoices||[])
      .filter(i => i.type===type && (i.date||'').startsWith(`${year}-${mon}`))
      .map(i => {
        const m = (i.docNo||'').match(/(\d{4})$/);
        return m ? parseInt(m[1], 10) : 0;
      });
  }
  const maxSeq = pool.length > 0 ? Math.max(...pool) : 0;
  return `${prefix}${ym}${String(maxSeq + 1).padStart(4,'0')}`;
}

// ─────────────────────────────────────────────────────
// ── INVOICE MODAL ────────────────────────────────────
// ─────────────────────────────────────────────────────
function openCreateInvoiceModal() {
  initBilling();
  document.getElementById('inv-edit-id').value = '';
  document.getElementById('inv-type').value    = 'invoice';
  document.getElementById('inv-docno').value   = generateDocNo('invoice');
  document.getElementById('inv-date').value    = new Date().toISOString().slice(0,10);
  document.getElementById('inv-due-date').value = '';
  document.getElementById('inv-job-name').value = '';
  document.getElementById('inv-room-label').value = '';
  document.getElementById('inv-room-type').value  = 'monthly';
  document.getElementById('inv-room-qty').value   = '1';
  document.getElementById('inv-room-rate').value  = '0';
  document.getElementById('inv-room-total').value = '0.00';
  document.getElementById('inv-room-enabled').checked = true;
  document.getElementById('inv-room-autofill').style.display = 'none';
  document.getElementById('inv-pt-type').value   = 'monthly';
  document.getElementById('inv-pt-qty').value    = '1';
  document.getElementById('inv-pt-rate').value   = '0';
  document.getElementById('inv-pt-total').value  = '0.00';
  document.getElementById('inv-pt-enabled').checked = false;
  document.getElementById('inv-note').value      = '';
  document.getElementById('inv-req-items-data').value   = '[]';
  document.getElementById('inv-other-items-data').value = '[]';
  document.getElementById('inv-hide-items').checked = false;
  const bs = getBillingSettings();
  document.getElementById('inv-vat-rate').value = bs.vatRate || 0;
  document.getElementById('inv-wht-rate').value = '0';

  const now = new Date();
  const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('inv-med-from').value = ym;
  document.getElementById('inv-med-to').value   = ym;

  const sel = document.getElementById('inv-patient');
  sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

  renderInvoiceItems();
  renderOtherItems();
  recalcInvoice();
  updateInvoiceTitle();
  openModal('modal-createInvoice');
}

function updateInvoiceTitle() {
  const LABELS = { invoice:'ใบแจ้งหนี้ / วางบิล', receipt:'ใบเสร็จรับเงิน', quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี' };
  const type   = document.getElementById('inv-type')?.value || 'invoice';
  const editId = document.getElementById('inv-edit-id')?.value;
  document.getElementById('modal-invoice-title').textContent = (editId?'แก้ไข':'สร้าง') + ' ' + (LABELS[type]||'');
  if (!editId) document.getElementById('inv-docno').value = generateDocNo(type);
}

function onInvoicePatientChange() {
  const patId = document.getElementById('inv-patient').value;
  if (!patId) return;
  const p = db.patients.find(p=>String(p.id)===String(patId));
  if (!p) return;

  const room = getPatientRoom(p);
  const bed  = getPatientBed(p);
  const autoDiv  = document.getElementById('inv-room-autofill');
  const autoText = document.getElementById('inv-room-autofill-text');

  if (room || bed) {
    const bedLabel  = bed  ? `เตียง ${bed.bedCode}` : '';
    const roomLabel = room ? `${room.name} (${room.roomType})` : '';
    const rateMonthly = room?.monthlyRate || 0;
    const rateDaily   = room?.dailyRate   || 0;
    const rateText = [
      rateMonthly ? `${rateMonthly.toLocaleString('th-TH')} ฿/เดือน` : '',
      rateDaily   ? `${rateDaily.toLocaleString('th-TH')} ฿/วัน` : '',
    ].filter(Boolean).join(' · ') || 'ไม่ระบุราคา';

    autoText.textContent = `${roomLabel}${bedLabel ? ' · '+bedLabel : ''} · ${rateText}`;
    autoDiv.style.display = 'flex';

    // Auto-apply rate: prefer monthly, fallback to daily
    if (rateMonthly) {
      applyRoomRate('monthly', room, bed);
    } else if (rateDaily) {
      applyRoomRate('daily', room, bed);
    }
  } else {
    autoDiv.style.display = 'none';
    // Fallback to old monthlyFee/dailyFee fields
    if (p.monthlyFee) { document.getElementById('inv-room-type').value='monthly'; document.getElementById('inv-room-rate').value=p.monthlyFee; }
    else if (p.dailyFee) { document.getElementById('inv-room-type').value='daily'; document.getElementById('inv-room-rate').value=p.dailyFee; }
  }

  // Show payer info if available
  const payer = (p.contacts||[]).find(c => c.isPayer);
  const payerEl = document.getElementById('inv-payer-info');
  if (payerEl) {
    if (payer) {
      payerEl.innerHTML = `💰 ส่งบิลถึง: <strong>${payer.name}</strong> (${payer.relation}) · 📞 ${payer.phone}`;
      payerEl.style.display = 'block';
    } else {
      payerEl.style.display = 'none';
    }
  }
  recalcInvoice();
}

function applyRoomRate(type, roomObj, bedObj) {
  // ถ้าไม่ส่ง room/bed มา ให้หาจาก patient ที่เลือกอยู่
  if (!roomObj) {
    const patId = document.getElementById('inv-patient').value;
    const p = db.patients.find(x => String(x.id)===String(patId));
    roomObj = getPatientRoom(p);
    bedObj  = getPatientBed(p);
  }
  const rate = type === 'monthly'
    ? (roomObj?.monthlyRate || 0)
    : (roomObj?.dailyRate   || 0);
  document.getElementById('inv-room-type').value = type;
  document.getElementById('inv-room-rate').value = rate;
  onInvRoomTypeChange();
  // Auto-fill label
  const now = new Date();
  const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const monthName = MONTHS[now.getMonth()];
  const year = now.getFullYear() + 543;
  const roomName = roomObj?.name || '';
  const bedCode  = bedObj?.bedCode  || '';
  const label = type === 'monthly'
    ? `ค่าห้อง${roomName ? ' '+roomName : ''}${bedCode ? ' เตียง '+bedCode : ''} เดือน${monthName} ${year}`
    : `ค่าห้อง${roomName ? ' '+roomName : ''}${bedCode ? ' เตียง '+bedCode : ''} (รายวัน)`;
  document.getElementById('inv-room-label').value = label;
  recalcInvoice();
}

function onInvRoomTypeChange() {
  const type = document.getElementById('inv-room-type').value;
  const qtyLabel = document.getElementById('inv-room-qty-label');
  if (qtyLabel) qtyLabel.textContent = type === 'daily' ? 'จำนวน (วัน)' : 'จำนวน (เดือน)';
  recalcInvoice();
}

// ── Load requisitions ────────────────────────────────
async function loadRequisitionsForInvoice() {
  const patId = document.getElementById('inv-patient').value;
  const from  = document.getElementById('inv-med-from').value;
  const to    = document.getElementById('inv-med-to').value;
  if (!patId) { toast('กรุณาเลือกผู้รับบริการก่อน','warning'); return; }
  const fromDate = from ? from+'-01' : '2000-01-01';
  const toDate   = to   ? to+'-31'   : '2099-12-31';
  const reqs = (db.requisitions||[]).filter(r => {
    if (!r.patientId || String(r.patientId)!==String(patId)) return false;
    const d = r.date || r.createdAt || '';
    return d >= fromDate && d <= toDate && r.status === 'approved';
  });
  const itemMap = {};
  reqs.forEach(req => {
    (req.items||[]).forEach(ri => {
      const item = db.items.find(it=>String(it.id)===String(ri.itemId));
      // กรองเฉพาะ Billable items
      if (item && item.isBillable === false) return;
      const key  = ri.itemId || ri.name;
      const price= item ? (item.price||item.cost||0) : 0;
      const unit = item?.dispenseUnit || item?.unit || '';
      if (!itemMap[key]) itemMap[key] = { name: ri.name||item?.name||key, qty:0, price, unit };
      itemMap[key].qty += ri.qty||1;
    });
  });
  const items = Object.values(itemMap);
  document.getElementById('inv-req-items-data').value = JSON.stringify(items);
  renderInvoiceItems();
  recalcInvoice();
  toast(items.length===0 ? 'ไม่พบรายการเบิกที่อนุมัติแล้ว' : `พบ ${items.length} รายการ`, items.length===0?'warning':'success');
}

// ── Render requisition items ─────────────────────────
function renderInvoiceItems() {
  const container = document.getElementById('inv-items-container');
  const hide = document.getElementById('inv-hide-items')?.checked;
  let items = [];
  try { items = JSON.parse(document.getElementById('inv-req-items-data').value||'[]'); } catch(e){}
  const total = items.reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);
  document.getElementById('inv-items-total').textContent = formatThb(total);
  if (items.length===0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:12px;font-size:13px;">ยังไม่มีรายการ</div>';
    recalcInvoice(); return;
  }
  if (hide) {
    container.innerHTML = `<div style="padding:10px;background:var(--surface2);border-radius:6px;text-align:center;color:var(--text2);font-size:13px;">🔒 ซ่อนรายการ ${items.length} รายการ — รวม ${formatThb(total)}</div>`;
    recalcInvoice(); return;
  }
  // แยกหมวดหมู่
  const CAT_LABELS = { 'ยา':'💊 ยา', 'เวชภัณฑ์':'🩺 เวชภัณฑ์', 'ของใช้':'🧴 ของใช้', 'บริการ':'🔧 บริการ' };
  const CAT_ORDER  = ['ยา','เวชภัณฑ์','ของใช้','บริการ'];
  const grouped = {};
  items.forEach((it,idx) => {
    const cat = it.category || 'เวชภัณฑ์';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({...it, _idx: idx});
  });
  const itemRow = (it) => `<tr style="border-bottom:1px solid var(--border);">
    <td style="padding:5px 6px;">
      <input type="text" value="${(it.name||'').replace(/"/g,'&quot;')}" onchange="updateInvItem(${it._idx},'name',this.value)"
        style="width:100%;border:none;background:transparent;color:var(--text1);font-size:13px;">
    </td>
    <td style="padding:5px 6px;">
      <input type="number" value="${it.qty||0}" min="0" oninput="updateInvItem(${it._idx},'qty',this.value)"
        style="width:65px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;">
    </td>
    <td style="padding:5px 6px;">
      <input type="number" value="${it.price||0}" min="0" oninput="updateInvItem(${it._idx},'price',this.value)"
        style="width:80px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;">
    </td>
    <td style="padding:5px 6px;text-align:right;font-weight:600;" id="inv-item-row-${it._idx}">${formatThb((it.qty||0)*(it.price||0))}</td>
    <td><button onclick="removeInvItem(${it._idx})" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">✕</button></td>
  </tr>`;
  const allCats = [...CAT_ORDER, ...Object.keys(grouped).filter(c=>!CAT_ORDER.includes(c))];
  let html = '';
  allCats.forEach(cat => {
    if (!grouped[cat]?.length) return;
    const catTotal = grouped[cat].reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);
    html += `<div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--accent);padding:4px 6px;background:var(--surface2);border-radius:4px;display:flex;justify-content:space-between;">
        <span>${CAT_LABELS[cat]||cat}</span><span style="color:var(--text2)">${formatThb(catTotal)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:var(--text2);border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:3px 6px;">รายการ</th>
          <th style="text-align:right;padding:3px 6px;width:70px;">จำนวน</th>
          <th style="text-align:right;padding:3px 6px;width:80px;">ราคา/หน่วย</th>
          <th style="text-align:right;padding:3px 6px;width:90px;">มูลค่า</th>
          <th style="width:24px;"></th>
        </tr></thead><tbody>
        ${grouped[cat].map(it=>itemRow(it)).join('')}
        </tbody>
      </table>
    </div>`;
  });
  container.innerHTML = html;
  recalcInvoice();
}

function updateInvItem(idx,field,value) {
  let items=[]; try{items=JSON.parse(document.getElementById('inv-req-items-data').value||'[]');}catch(e){}
  if(!items[idx]) return;
  if(field==='qty'||field==='price') value=parseFloat(value)||0;
  items[idx][field]=value;
  document.getElementById('inv-req-items-data').value=JSON.stringify(items);
  const cell=document.getElementById(`inv-item-row-${idx}`);
  if(cell) cell.textContent=formatThb(items[idx].qty*items[idx].price);
  document.getElementById('inv-items-total').textContent=formatThb(items.reduce((s,it)=>s+(it.qty*it.price),0));
  recalcInvoice();
}

function removeInvItem(idx) {
  let items=[]; try{items=JSON.parse(document.getElementById('inv-req-items-data').value||'[]');}catch(e){}
  items.splice(idx,1);
  document.getElementById('inv-req-items-data').value=JSON.stringify(items);
  renderInvoiceItems();
}

function addManualInvoiceItem() {
  let items=[]; try{items=JSON.parse(document.getElementById('inv-req-items-data').value||'[]');}catch(e){}
  items.push({name:'',qty:1,price:0});
  document.getElementById('inv-req-items-data').value=JSON.stringify(items);
  renderInvoiceItems();
}

// ── Other items ──────────────────────────────────────
function renderOtherItems() {
  const container = document.getElementById('inv-other-container');
  let items=[]; try{items=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}
  if(items.length===0){
    container.innerHTML='<div style="text-align:center;color:var(--text3);padding:10px;font-size:13px;">กด + เพิ่มรายการ</div>';
    document.getElementById('inv-other-total').textContent='0.00 ฿'; recalcInvoice(); return;
  }
  container.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="color:var(--text2);border-bottom:1px solid var(--border);">
      <th style="text-align:left;padding:4px 6px;">รายการ</th>
      <th style="text-align:right;padding:4px 6px;width:70px;">จำนวน</th>
      <th style="text-align:right;padding:4px 6px;width:80px;">ราคา/หน่วย</th>
      <th style="text-align:right;padding:4px 6px;width:90px;">มูลค่า</th>
      <th style="width:24px;"></th>
    </tr></thead><tbody>
    ${items.map((it,idx)=>`<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 6px;"><input type="text" value="${(it.name||'').replace(/"/g,'&quot;')}" onchange="updateOtherItem(${idx},'name',this.value)" style="width:100%;border:none;background:transparent;color:var(--text1);font-size:13px;"></td>
      <td style="padding:5px 6px;"><input type="number" value="${it.qty||1}" min="0" oninput="updateOtherItem(${idx},'qty',this.value)" style="width:65px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;"></td>
      <td style="padding:5px 6px;"><input type="number" value="${it.price||0}" min="0" oninput="updateOtherItem(${idx},'price',this.value)" style="width:80px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;"></td>
      <td style="padding:5px 6px;text-align:right;font-weight:600;" id="inv-other-row-${idx}">${formatThb((it.qty||1)*(it.price||0))}</td>
      <td><button onclick="removeOtherItem(${idx})" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">✕</button></td>
    </tr>`).join('')}
    </tbody></table>`;
  document.getElementById('inv-other-total').textContent=formatThb(items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0));
  recalcInvoice();
}

function updateOtherItem(idx,field,value) {
  let items=[]; try{items=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}
  if(!items[idx]) return;
  if(field==='qty'||field==='price') value=parseFloat(value)||0;
  items[idx][field]=value;
  document.getElementById('inv-other-items-data').value=JSON.stringify(items);
  const cell=document.getElementById(`inv-other-row-${idx}`);
  if(cell) cell.textContent=formatThb((items[idx].qty||1)*(items[idx].price||0));
  document.getElementById('inv-other-total').textContent=formatThb(items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0));
  recalcInvoice();
}
function removeOtherItem(idx){
  let items=[]; try{items=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}
  items.splice(idx,1); document.getElementById('inv-other-items-data').value=JSON.stringify(items); renderOtherItems();
}
function addOtherItem(){
  let items=[]; try{items=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}
  items.push({name:'',qty:1,price:0}); document.getElementById('inv-other-items-data').value=JSON.stringify(items); renderOtherItems();
}

// ── Recalculate invoice totals ───────────────────────
function recalcInvoice() {
  // ค่าห้อง
  const roomEnabled = document.getElementById('inv-room-enabled')?.checked;
  const roomQty  = parseFloat(document.getElementById('inv-room-qty')?.value||0);
  const roomRate = parseFloat(document.getElementById('inv-room-rate')?.value||0);
  const roomTotal = roomEnabled ? roomQty*roomRate : 0;
  if(document.getElementById('inv-room-total')) document.getElementById('inv-room-total').value = roomTotal.toFixed(2);

  // ค่ากายภาพ
  const ptEnabled = document.getElementById('inv-pt-enabled')?.checked;
  const ptQty  = parseFloat(document.getElementById('inv-pt-qty')?.value||0);
  const ptRate = parseFloat(document.getElementById('inv-pt-rate')?.value||0);
  const ptTotal = ptEnabled ? ptQty*ptRate : 0;
  if(document.getElementById('inv-pt-total')) document.getElementById('inv-pt-total').value = ptTotal.toFixed(2);

  // ค่าเวชภัณฑ์
  let medItems=[]; try{medItems=JSON.parse(document.getElementById('inv-req-items-data')?.value||'[]');}catch(e){}
  const medTotal = medItems.reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);

  // ค่าอื่นๆ
  let otherItems=[]; try{otherItems=JSON.parse(document.getElementById('inv-other-items-data')?.value||'[]');}catch(e){}
  const otherTotal = otherItems.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0);

  const subtotal   = roomTotal + ptTotal + medTotal + otherTotal;
  const vatRate    = parseFloat(document.getElementById('inv-vat-rate')?.value||0)/100;
  const vatAmt     = subtotal * vatRate;
  const beforeWht  = subtotal + vatAmt;
  const whtRate    = parseFloat(document.getElementById('inv-wht-rate')?.value||0)/100;
  const whtAmt     = beforeWht * whtRate;
  const grandTotal = beforeWht - whtAmt;

  if(document.getElementById('inv-subtotal'))    document.getElementById('inv-subtotal').textContent    = formatThb(subtotal);
  if(document.getElementById('inv-vat-amount'))  document.getElementById('inv-vat-amount').textContent  = formatThb(vatAmt);
  if(document.getElementById('inv-before-wht'))  document.getElementById('inv-before-wht').textContent  = formatThb(beforeWht);
  if(document.getElementById('inv-wht-amount'))  document.getElementById('inv-wht-amount').textContent  = formatThb(whtAmt);
  if(document.getElementById('inv-grand-total')) document.getElementById('inv-grand-total').textContent = formatThb(grandTotal);
}

// ── Save invoice ─────────────────────────────────────
async function saveInvoice(status) {
  const patId = document.getElementById('inv-patient').value;
  if (!patId) { toast('กรุณาเลือกผู้รับบริการ','warning'); return; }
  // Check duplicate doc number
  const editId_ = document.getElementById('inv-edit-id').value;
  const docNo_  = document.getElementById('inv-docno').value.trim();
  if (docNo_) {
    const dup = (db.invoices||[]).find(i => i.docNo === docNo_ && i.id !== editId_);
    if (dup) {
      const proceed = confirm(`⚠️ เลขที่เอกสาร "${docNo_}" ซ้ำกับเอกสารที่มีอยู่แล้ว!\n\nเอกสารเดิม: ${dup.patientName || '-'} (${dup.date || '-'})\n\nต้องการบันทึกทับหรือไม่?`);
      if (!proceed) return;
    }
  }
  const patient = db.patients.find(p=>String(p.id)===String(patId));
  let medItems=[],otherItems=[];
  try{medItems=JSON.parse(document.getElementById('inv-req-items-data').value||'[]');}catch(e){}
  try{otherItems=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}

  const roomEnabled = document.getElementById('inv-room-enabled').checked;
  const roomQty  = parseFloat(document.getElementById('inv-room-qty').value||0);
  const roomRate = parseFloat(document.getElementById('inv-room-rate').value||0);
  const roomTotal = roomEnabled ? roomQty*roomRate : 0;

  const ptEnabled = document.getElementById('inv-pt-enabled').checked;
  const ptQty  = parseFloat(document.getElementById('inv-pt-qty').value||0);
  const ptRate = parseFloat(document.getElementById('inv-pt-rate').value||0);
  const ptTotal = ptEnabled ? ptQty*ptRate : 0;

  const medTotal   = medItems.reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);
  const otherTotal = otherItems.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0);
  const subtotal   = roomTotal+ptTotal+medTotal+otherTotal;
  const vatRate    = parseFloat(document.getElementById('inv-vat-rate').value||0);
  const vatAmt     = subtotal*(vatRate/100);
  const beforeWht  = subtotal+vatAmt;
  const whtRate    = parseFloat(document.getElementById('inv-wht-rate').value||0);
  const whtAmt     = beforeWht*(whtRate/100);
  const grandTotal = beforeWht-whtAmt;

  const editId = document.getElementById('inv-edit-id').value;
  const inv = {
    id: editId||('inv_'+Date.now()),
    type:        document.getElementById('inv-type').value,
    docNo:       document.getElementById('inv-docno').value || generateDocNo(document.getElementById('inv-type').value),
    patientId:   patId, patientName: patient?.name||'',
    date:        document.getElementById('inv-date').value,
    dueDate:     document.getElementById('inv-due-date').value,
    jobName:     document.getElementById('inv-job-name').value,
    roomEnabled, roomType: document.getElementById('inv-room-type').value, roomQty, roomRate, roomTotal,
    roomLabel: document.getElementById('inv-room-label').value.trim(),
    ptEnabled,   ptType:   document.getElementById('inv-pt-type').value,   ptQty,  ptRate,  ptTotal,
    medItems, medTotal, hideItems: document.getElementById('inv-hide-items').checked,
    otherItems, otherTotal,
    subtotal, vatRate, vatAmt, beforeWht, whtRate, whtAmt, grandTotal,
    note: document.getElementById('inv-note').value,
    status, updatedAt: new Date().toISOString(),
    createdAt: editId ? undefined : new Date().toISOString(),
  };

  if(!db.invoices) db.invoices=[];
  const row = {
    id: inv.id, type: inv.type, doc_no: inv.docNo,
    patient_id: inv.patientId||null, patient_name: inv.patientName||'',
    date: inv.date||null, due_date: inv.dueDate||null, job_name: inv.jobName||'',
    room_enabled: inv.roomEnabled, room_type: inv.roomType, room_qty: inv.roomQty,
    room_rate: inv.roomRate, room_total: inv.roomTotal, room_label: inv.roomLabel||'',
    pt_enabled: inv.ptEnabled, pt_type: inv.ptType, pt_qty: inv.ptQty,
    pt_rate: inv.ptRate, pt_total: inv.ptTotal,
    med_items: inv.medItems||[], med_total: inv.medTotal||0,
    hide_items: inv.hideItems||false,
    other_items: inv.otherItems||[], other_total: inv.otherTotal||0,
    subtotal: inv.subtotal||0, vat_rate: inv.vatRate||0, vat_amt: inv.vatAmt||0,
    before_wht: inv.beforeWht||0, wht_rate: inv.whtRate||0, wht_amt: inv.whtAmt||0,
    grand_total: inv.grandTotal||0,
    note: inv.note||'', status: inv.status||'draft',
    contract_id: inv.contractId||null,
    updated_at: new Date().toISOString(),
  };
  if (!editId) row.created_at = new Date().toISOString();
  const { error: saveErr } = await supa.from('invoices').upsert(row);
  if (saveErr) { toast('บันทึกไม่สำเร็จ: '+saveErr.message,'error'); return; }
  if(editId) { const idx=db.invoices.findIndex(i=>i.id===editId); if(idx>=0) db.invoices[idx]={...db.invoices[idx],...inv}; else db.invoices.unshift(inv); }
  else db.invoices.unshift(inv);
  toast(status==='draft'?'บันทึกร่างแล้ว':'บันทึกเอกสารแล้ว','success');
  closeModal('modal-createInvoice');
  renderBilling();
}

// ── Edit invoice ─────────────────────────────────────
function editInvoice(id) {
  const inv=(db.invoices||[]).find(i=>i.id===id);
  if(!inv) return;
  if (inv.status === 'paid') {
    toast('❌ ไม่สามารถแก้ไขบิลที่ชำระแล้วได้ — หากต้องการแก้ไขให้ยกเลิกบิลแล้วออกใหม่', 'error');
    return;
  }
  if (inv.status === 'partial') {
    if (!confirm('⚠️ บิลนี้มีการรับเงินบางส่วนแล้ว การแก้ไขอาจทำให้ยอดไม่ตรงกับใบเสร็จ\nต้องการแก้ไขต่อหรือไม่?')) return;
  }
  document.getElementById('inv-edit-id').value   = inv.id;
  document.getElementById('inv-type').value       = inv.type;
  document.getElementById('inv-docno').value      = inv.docNo;
  document.getElementById('inv-date').value       = inv.date||'';
  document.getElementById('inv-due-date').value   = inv.dueDate||'';
  document.getElementById('inv-job-name').value   = inv.jobName||'';
  document.getElementById('inv-room-enabled').checked = inv.roomEnabled!==false;
  document.getElementById('inv-room-type').value  = inv.roomType||'monthly';
  document.getElementById('inv-room-qty').value   = inv.roomQty||1;
  document.getElementById('inv-room-rate').value  = inv.roomRate||0;
  document.getElementById('inv-room-label').value = inv.roomLabel||'';
  // Restore autofill strip from patient
  const editPat = db.patients.find(p=>String(p.id)===String(inv.patientId));
  const editRoom = editPat ? getPatientRoom(editPat) : null;
  const editBed  = editPat ? getPatientBed(editPat)  : null;
  const autoDiv  = document.getElementById('inv-room-autofill');
  const autoText = document.getElementById('inv-room-autofill-text');
  if (editRoom || editBed) {
    const rM = editRoom?.monthlyRate||0, rD = editRoom?.dailyRate||0;
    const rateText = [rM?rM.toLocaleString('th-TH')+' ฿/เดือน':'', rD?rD.toLocaleString('th-TH')+' ฿/วัน':''].filter(Boolean).join(' · ')||'ไม่ระบุราคา';
    autoText.textContent = `${editRoom?.name||''} (${editRoom?.roomType||''})${editBed?' · เตียง '+editBed.bedCode:''} · ${rateText}`;
    autoDiv.style.display = 'flex';
  } else { autoDiv.style.display = 'none'; }
  onInvRoomTypeChange();
  document.getElementById('inv-pt-enabled').checked = inv.ptEnabled||false;
  document.getElementById('inv-pt-type').value    = inv.ptType||'monthly';
  document.getElementById('inv-pt-qty').value     = inv.ptQty||1;
  document.getElementById('inv-pt-rate').value    = inv.ptRate||0;
  document.getElementById('inv-hide-items').checked = inv.hideItems||false;
  document.getElementById('inv-req-items-data').value   = JSON.stringify(inv.medItems||[]);
  document.getElementById('inv-other-items-data').value = JSON.stringify(inv.otherItems||[]);
  document.getElementById('inv-vat-rate').value   = inv.vatRate||0;
  document.getElementById('inv-wht-rate').value   = inv.whtRate||0;
  document.getElementById('inv-note').value       = inv.note||'';

  const sel = document.getElementById('inv-patient');
  sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  sel.value = inv.patientId||'';

  const now = new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('inv-med-from').value = ym;
  document.getElementById('inv-med-to').value   = ym;

  renderInvoiceItems(); renderOtherItems(); recalcInvoice(); updateInvoiceTitle();
  openModal('modal-createInvoice');
}

async function deleteInvoice(id) {
  if(!confirm('ลบเอกสารนี้หรือไม่?')) return;
  const { error } = await supa.from('invoices').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.invoices=(db.invoices||[]).filter(i=>i.id!==id);
  toast('ลบแล้ว','success'); renderBilling();
}

async function markInvoicePaid(id) {
  // Legacy quick-mark — open payment modal instead
  openRecordPaymentModal(id);
}

// ─────────────────────────────────────────────────────
// ── BILLING TABS ─────────────────────────────────────
// ─────────────────────────────────────────────────────
function switchBillingTab(tab) {
  ['invoices','contracts','payments'].forEach(t => {
    const panel = document.getElementById('billing-tab-'+t);
    if(panel) panel.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('.billing-tab').forEach((el,i) => {
    const tabs = ['invoices','contracts','payments'];
    const active = tabs[i]===tab;
    el.style.color      = active ? 'var(--accent)' : 'var(--text2)';
    el.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    el.style.marginBottom = '-2px';
  });
  if (tab === 'contracts') renderContracts();
  if (tab === 'payments')  renderPaymentsTab();
}

// ─────────────────────────────────────────────────────
// ── PAYMENT TRACKING ─────────────────────────────────
// ─────────────────────────────────────────────────────
function getInvoicePaidAmount(invoiceId) {
  return (db.payments||[])
    .filter(p => p.invoiceId === invoiceId)
    .reduce((s,p) => s+p.amount, 0);
}
function getInvoiceBalance(inv) {
  return (inv.grandTotal||0) - getInvoicePaidAmount(inv.id);
}
function getInvoicePaymentStatus(inv) {
  const balance = getInvoiceBalance(inv);
  if (balance <= 0) return 'paid';
  const paid = getInvoicePaidAmount(inv.id);
  if (paid > 0) return 'partial';
  return inv.status === 'draft' ? 'draft' : 'sent';
}

function openRecordPaymentModal(invoiceId) {
  const inv = (db.invoices||[]).find(i=>i.id===invoiceId);
  if (!inv) return;
  document.getElementById('pay-invoice-id').value = invoiceId;
  const paid    = getInvoicePaidAmount(invoiceId);
  const balance = (inv.grandTotal||0) - paid;
  document.getElementById('pay-invoice-info').innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${inv.docNo} · ${inv.patientName}</div>
    <div style="display:flex;gap:16px;font-size:12px;">
      <span>ยอดรวม: <strong>${formatThb(inv.grandTotal||0)}</strong></span>
      <span style="color:#27ae60;">ชำระแล้ว: <strong>${formatThb(paid)}</strong></span>
      <span style="color:#e67e22;">คงค้าง: <strong>${formatThb(balance)}</strong></span>
    </div>`;
  document.getElementById('pay-amount').value = balance.toFixed(2);
  document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('pay-ref').value = '';
  document.getElementById('pay-note').value = '';
  document.getElementById('pay-by').value = currentUser?.displayName || currentUser?.username || '';
  // Reset radio
  document.querySelector('input[name="pay-method"][value="โอนเงิน"]').checked = true;
  document.getElementById('pay-method-other-wrap').style.display = 'none';
  document.getElementById('pay-method-other').value = '';
  openModal('modal-record-payment');
}

function togglePayOther() {
  const isOther = document.querySelector('input[name="pay-method"]:checked')?.value === 'อื่นๆ';
  const wrap = document.getElementById('pay-method-other-wrap');
  if (wrap) {
    wrap.style.display = isOther ? '' : 'none';
    if (isOther) document.getElementById('pay-method-other').focus();
  }
}

async function savePayment() {
  const invoiceId = document.getElementById('pay-invoice-id').value;
  const amount    = parseFloat(document.getElementById('pay-amount').value||0);
  const date      = document.getElementById('pay-date').value;
  if (!amount || amount <= 0) { toast('กรุณาระบุจำนวนเงิน','warning'); return; }
  if (!date) { toast('กรุณาระบุวันที่','warning'); return; }
  const methodRaw = document.querySelector('input[name="pay-method"]:checked')?.value || 'โอนเงิน';
  const method = methodRaw === 'อื่นๆ'
    ? (document.getElementById('pay-method-other').value.trim() || 'อื่นๆ')
    : methodRaw;
  const inv = (db.invoices||[]).find(i=>i.id===invoiceId);

  // Generate receipt number
  const now = new Date();
  const receiptNo = `REC${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;

  const payData = {
    invoice_id:   invoiceId,
    patient_id:   inv?.patientId||null,
    patient_name: inv?.patientName||'',
    amount, payment_date: date, method,
    reference:    document.getElementById('pay-ref').value.trim(),
    received_by:  document.getElementById('pay-by').value.trim(),
    note:         document.getElementById('pay-note').value.trim(),
    receipt_no:   receiptNo,
  };
  const { data: ins, error } = await supa.from('payments').insert(payData).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  if(!db.payments) db.payments=[];
  db.payments.unshift(mapPayment(ins));

  // Auto-update invoice status
  const newBalance = getInvoiceBalance(inv);
  const newStatus  = newBalance <= 0 ? 'paid' : 'partial';
  if (inv && inv.status !== newStatus) {
    inv.status = newStatus;
    await supa.from('invoices').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', inv.id);
  }

  toast(`✅ รับชำระ ${formatThb(amount)} (${receiptNo}) เรียบร้อย`, 'success');
  closeModal('modal-record-payment');
  renderBilling();

  // Ask to print receipt
  if (confirm(`บันทึกสำเร็จ! ต้องการพิมพ์ใบเสร็จรับเงิน ${receiptNo} หรือไม่?`)) {
    printReceipt(ins.id || payData.receipt_no);
  }
}

function renderPaymentsTab() {
  const payments = (db.payments||[]).slice(0, 100);
  const container = document.getElementById('payments-list');
  if (!container) return;

  const totalReceived = payments.reduce((s,p)=>s+p.amount,0);
  const byMethod = {};
  payments.forEach(p => { byMethod[p.method] = (byMethod[p.method]||0) + p.amount; });

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:#f0fff4;border:1px solid #27ae60;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#27ae60;margin-bottom:4px;">รับชำระรวมทั้งหมด</div>
        <div style="font-size:18px;font-weight:700;color:#27ae60;">${formatThb(totalReceived)}</div>
      </div>
      ${Object.entries(byMethod).map(([m,v])=>`
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${m}</div>
          <div style="font-size:16px;font-weight:700;">${formatThb(v)}</div>
        </div>`).join('')}
    </div>
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
          <th>ใบเสร็จ</th><th>วันที่</th><th>ผู้รับบริการ</th>
          <th>เลขที่บิล</th><th style="text-align:right;">จำนวนเงิน</th>
          <th>ช่องทาง</th><th>อ้างอิง</th><th>รับโดย</th><th></th>
        </tr></thead>
        <tbody>
          ${payments.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">ยังไม่มีรายการ</td></tr>' :
            payments.map(p => {
              const inv = (db.invoices||[]).find(i=>i.id===p.invoiceId);
              return `<tr>
                <td style="font-family:monospace;font-size:12px;color:var(--accent);">${p.receiptNo||'-'}</td>
                <td style="font-size:12px;">${p.paymentDate||'-'}</td>
                <td style="font-weight:500;">${p.patientName||'-'}</td>
                <td style="font-size:12px;color:var(--text2);">${inv?.docNo||'-'}</td>
                <td style="text-align:right;font-weight:700;color:#27ae60;">${formatThb(p.amount)}</td>
                <td><span style="background:var(--surface2);border-radius:4px;padding:2px 8px;font-size:12px;">${p.method}</span></td>
                <td style="font-size:12px;color:var(--text3);">${p.reference||'-'}</td>
                <td style="font-size:12px;">${p.receivedBy||'-'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="printReceiptById('${p.id}')" title="พิมพ์ใบเสร็จ">🖨️</button>
                  <button class="btn btn-ghost btn-sm" onclick="deletePayment('${p.id}')" style="color:#e74c3c;">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deletePayment(id) {
  if(!confirm('ลบรายการชำระนี้? ยอดค้างชำระในบิลจะเพิ่มขึ้น')) return;
  const { error } = await supa.from('payments').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ','error'); return; }
  db.payments = (db.payments||[]).filter(p=>p.id!=id);
  toast('ลบแล้ว'); renderBilling(); renderPaymentsTab();
}

// ─────────────────────────────────────────────────────
// ── PATIENT CONTRACTS ────────────────────────────────
// ─────────────────────────────────────────────────────
let _contractItems = [];

function openAddContractModal(editId=null) {
  _contractItems = editId ? [] : [{ name:'ค่าดูแลรายเดือน', amount:0 }];
  document.getElementById('contract-edit-id').value = editId||'';
  document.getElementById('modal-contract-title').textContent = editId ? '✏️ แก้ไขแพ็กเกจ' : '📋 เพิ่มแพ็กเกจรายเดือน';
  // Populate patient select
  const sel = document.getElementById('contract-patient');
  sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if (editId) {
    const c = (db.contracts||[]).find(x=>x.id==editId);
    if (c) {
      sel.value = c.patientId;
      document.getElementById('contract-name').value = c.name;
      document.getElementById('contract-billing-day').value = c.billingDay;
      document.getElementById('contract-due-days').value = c.dueDays;
      document.getElementById('contract-start').value = c.startDate||'';
      document.getElementById('contract-end').value   = c.endDate||'';
      document.getElementById('contract-note').value  = c.note||'';
      _contractItems = c.items||[];
    }
  } else {
    document.getElementById('contract-name').value = 'ค่าบริการรายเดือน';
    document.getElementById('contract-billing-day').value = '1';
    document.getElementById('contract-due-days').value = '7';
    document.getElementById('contract-start').value = new Date().toISOString().split('T')[0];
    document.getElementById('contract-end').value   = '';
    document.getElementById('contract-note').value  = '';
  }
  renderContractItems();
  openModal('modal-add-contract');
}

function renderContractItems() {
  const container = document.getElementById('contract-items-container');
  container.innerHTML = _contractItems.map((item,i) => `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:8px;">
      <input class="form-control" value="${item.name||''}" placeholder="ชื่อรายการ เช่น ค่าดูแลรายเดือน"
        oninput="_contractItems[${i}].name=this.value;updateContractTotal()">
      <input class="form-control number" type="number" value="${item.amount||0}" placeholder="0" style="width:130px;"
        oninput="_contractItems[${i}].amount=parseFloat(this.value)||0;updateContractTotal()">
      <button class="btn btn-ghost btn-sm" onclick="_contractItems.splice(${i},1);renderContractItems()">✕</button>
    </div>`).join('');
  updateContractTotal();
}

function addContractItem() {
  _contractItems.push({ name:'', amount:0 });
  renderContractItems();
}

function updateContractTotal() {
  const total = _contractItems.reduce((s,x)=>s+(x.amount||0),0);
  const el = document.getElementById('contract-total-display');
  if(el) el.textContent = formatThb(total);
}

async function saveContract() {
  const editId     = document.getElementById('contract-edit-id').value;
  const patientId  = document.getElementById('contract-patient').value;
  const name       = document.getElementById('contract-name').value.trim();
  if (!patientId) { toast('กรุณาเลือกผู้รับบริการ','warning'); return; }
  if (!name)      { toast('กรุณาระบุชื่อแพ็กเกจ','warning'); return; }
  const patient = db.patients.find(p=>String(p.id)===String(patientId));
  const total = _contractItems.reduce((s,x)=>s+(x.amount||0),0);
  const data = {
    patient_id: patientId, patient_name: patient?.name||'',
    name, items: _contractItems, total_monthly: total,
    billing_day: parseInt(document.getElementById('contract-billing-day').value)||1,
    due_days:    parseInt(document.getElementById('contract-due-days').value)||7,
    start_date:  document.getElementById('contract-start').value||null,
    end_date:    document.getElementById('contract-end').value||null,
    is_active:   true,
    note:        document.getElementById('contract-note').value.trim(),
  };
  if (editId) {
    const { error } = await supa.from('patient_contracts').update(data).eq('id', editId);
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    const idx = (db.contracts||[]).findIndex(c=>c.id==editId);
    if(idx>=0) db.contracts[idx] = mapContract({id:editId,...data});
    toast('แก้ไขแพ็กเกจแล้ว','success');
  } else {
    const { data: ins, error } = await supa.from('patient_contracts').insert(data).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if(!db.contracts) db.contracts=[];
    db.contracts.unshift(mapContract(ins));
    toast(`เพิ่มแพ็กเกจ "${name}" เรียบร้อย`,'success');
  }
  closeModal('modal-add-contract');
  renderContracts();
}

async function deleteContract(id) {
  if(!confirm('ลบแพ็กเกจนี้?')) return;
  const { error } = await supa.from('patient_contracts').delete().eq('id', id);
  if(error) { toast('ลบไม่สำเร็จ','error'); return; }
  db.contracts = (db.contracts||[]).filter(c=>c.id!=id);
  toast('ลบแล้ว'); renderContracts();
}

function renderContracts() {
  const container = document.getElementById('contracts-list');
  if (!container) return;
  const contracts = (db.contracts||[]).filter(c=>c.isActive);
  if (!contracts.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">ยังไม่มีแพ็กเกจ กด "+ เพิ่มแพ็กเกจ" เพื่อเริ่มต้น</div>`;
    return;
  }
  const totalMonthly = contracts.reduce((s,c)=>s+c.totalMonthly,0);
  container.innerHTML = `
    <div style="background:var(--accent-light);border:1px solid #b8d9c5;border-radius:10px;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;">
      <span style="font-size:13px;color:var(--accent-dark);">📊 รายได้คาดหวังรายเดือน (${contracts.length} สัญญา)</span>
      <span style="font-size:18px;font-weight:700;color:var(--accent);">${formatThb(totalMonthly)}</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
          <th>ผู้รับบริการ</th><th>ชื่อแพ็กเกจ</th><th>รายการ</th>
          <th style="text-align:right;">ยอด/เดือน</th>
          <th>วันออกบิล</th><th>ครั้งถัดไป</th><th></th>
        </tr></thead>
        <tbody>
          ${contracts.map(c => {
            const nextBill = getNextBillingDate(c);
            const daysUntil = Math.ceil((new Date(nextBill)-new Date())/(1000*60*60*24));
            return `<tr>
              <td style="font-weight:600;">${c.patientName}</td>
              <td>${c.name}</td>
              <td style="font-size:12px;color:var(--text2);">${(c.items||[]).map(i=>i.name).join(', ')}</td>
              <td style="text-align:right;font-weight:700;color:var(--accent);">${formatThb(c.totalMonthly)}</td>
              <td style="text-align:center;">วันที่ ${c.billingDay}</td>
              <td>
                <span style="font-size:12px;">${nextBill}</span>
                <span style="font-size:11px;color:${daysUntil<=3?'#e74c3c':daysUntil<=7?'#e67e22':'var(--text3)'};">
                  (${daysUntil<=0?'ถึงกำหนดแล้ว!':daysUntil+' วัน'})
                </span>
              </td>
              <td style="white-space:nowrap;">
                <button class="btn btn-primary btn-sm" onclick="generateContractInvoice(${c.id})">🧾 ออกบิล</button>
                <button class="btn btn-ghost btn-sm" onclick="openAddContractModal(${c.id})">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteContract(${c.id})" style="color:#e74c3c;">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function getNextBillingDate(contract) {
  const today = new Date();
  const day = contract.billingDay;
  let d = new Date(today.getFullYear(), today.getMonth(), day);
  if (d <= today) d = new Date(today.getFullYear(), today.getMonth()+1, day);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────
// ── AUTO BILLING ─────────────────────────────────────
// ─────────────────────────────────────────────────────
async function runAutoBilling() {
  const today = new Date();
  const todayDay = today.getDate();
  const todayStr = today.toISOString().split('T')[0];
  const ym = todayStr.slice(0,7); // YYYY-MM

  const activeContracts = (db.contracts||[]).filter(c => {
    if (!c.isActive) return false;
    if (c.endDate && c.endDate < todayStr) return false;
    if (c.startDate && c.startDate > todayStr) return false;
    return c.billingDay === todayDay;
  });

  if (activeContracts.length === 0) {
    toast(`ไม่มีแพ็กเกจที่ถึงกำหนดออกบิลวันนี้ (วันที่ ${todayDay})`, 'info');
    return;
  }

  // Check which ones don't already have a bill this month
  const toCreate = activeContracts.filter(c => {
    return !(db.invoices||[]).find(inv =>
      inv.patientId === c.patientId &&
      inv.date?.startsWith(ym) &&
      inv.contractId === c.id
    );
  });

  if (toCreate.length === 0) {
    toast(`บิลรายเดือนสำหรับเดือน ${ym} ออกไปแล้วทั้งหมด`, 'info');
    return;
  }

  const confirm_ = confirm(`จะสร้างร่างบิลอัตโนมัติสำหรับ ${toCreate.length} สัญญา ใช่ไหม?\n\n${toCreate.map(c=>`• ${c.patientName} — ${formatThb(c.totalMonthly)}`).join('\n')}`);
  if (!confirm_) return;

  let created = 0;
  for (const c of toCreate) {
    await generateContractInvoice(c.id, true);
    created++;
  }
  toast(`✅ สร้างร่างบิลอัตโนมัติ ${created} ใบเรียบร้อย`, 'success');
  renderBilling();
}

async function generateContractInvoice(contractId, silent=false) {
  const c = (db.contracts||[]).find(x=>x.id==contractId);
  if (!c) return;
  const today = new Date();
  const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const monthTH = MONTHS[today.getMonth()];
  const yearTH  = today.getFullYear()+543;
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + c.dueDays);

  // Build invoice items from contract items
  const otherItems = (c.items||[]).map(item => ({ name:item.name, qty:1, price:item.amount }));

  const inv = {
    id: 'inv_'+Date.now()+'_'+contractId,
    contractId: c.id,
    type: 'invoice',
    docNo: generateDocNo('invoice'),
    patientId: c.patientId, patientName: c.patientName,
    date: today.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0],
    jobName: `${c.name} เดือน${monthTH} ${yearTH}`,
    roomEnabled:false, roomType:'monthly', roomQty:1, roomRate:0, roomTotal:0, roomLabel:'',
    ptEnabled:false, ptType:'monthly', ptQty:1, ptRate:0, ptTotal:0,
    medItems:[], medTotal:0,
    otherItems,
    otherTotal: c.totalMonthly,
    subtotal: c.totalMonthly,
    vatRate:0, vatAmt:0, beforeWht:c.totalMonthly,
    whtRate:0, whtAmt:0, grandTotal:c.totalMonthly,
    note: `ออกบิลอัตโนมัติจากแพ็กเกจ: ${c.name}`,
    status: 'draft',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if(!db.invoices) db.invoices=[];
  const row = {
    id: inv.id, type: inv.type, doc_no: inv.docNo,
    patient_id: inv.patientId||null, patient_name: inv.patientName||'',
    date: inv.date||null, due_date: inv.dueDate||null, job_name: inv.jobName||'',
    room_enabled: false, pt_enabled: false,
    med_items: [], med_total: 0, hide_items: false,
    other_items: inv.otherItems||[], other_total: inv.otherTotal||0,
    subtotal: inv.subtotal||0, vat_rate: 0, vat_amt: 0,
    before_wht: inv.subtotal||0, wht_rate: 0, wht_amt: 0,
    grand_total: inv.grandTotal||0,
    note: inv.note||'', status: 'draft',
    contract_id: inv.contractId||null,
    created_at: inv.createdAt, updated_at: inv.updatedAt,
  };
  const { error: autoErr } = await supa.from('invoices').upsert(row);
  if (autoErr) { toast('สร้างบิลอัตโนมัติไม่สำเร็จ: '+autoErr.message,'error'); return; }
  db.invoices.unshift(inv);
  if (!silent) {
    toast(`สร้างร่างบิล ${inv.docNo} สำหรับ ${c.patientName} เรียบร้อย`, 'success');
    switchBillingTab('invoices');
    renderBilling();
  }
}

// ─────────────────────────────────────────────────────
// ── RECEIPT PRINT ────────────────────────────────────
// ─────────────────────────────────────────────────────
function printReceiptById(paymentId) {
  const p = (db.payments||[]).find(x=>x.id==paymentId);
  if (p) printReceiptData(p);
}

function printReceipt(paymentIdOrNo) {
  const p = (db.payments||[]).find(x=>x.id==paymentIdOrNo||x.receiptNo==paymentIdOrNo);
  if (p) printReceiptData(p);
}

function printReceiptData(p) {
  const inv = (db.invoices||[]).find(i=>i.id===p.invoiceId);
  const bs  = getBillingSettings();
  const win = window.open('','_blank','width=420,height=600');
  const METHODS = {'เงินสด':'💵 เงินสด','โอนเงิน':'🏦 โอนเงิน','บัตรเครดิต':'💳 บัตรเครดิต','เช็ค':'📝 เช็ค'};
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap');
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#1a1a1a;padding:24px; }
      .logo { font-size:18px;font-weight:700;color:#2d4a38;text-align:center;margin-bottom:4px; }
      .center { text-align:center; }
      .divider { border:none;border-top:1px dashed #ccc;margin:12px 0; }
      .row { display:flex;justify-content:space-between;padding:3px 0;font-size:13px; }
      .total-row { display:flex;justify-content:space-between;padding:6px 0;font-size:16px;font-weight:700;color:#2d4a38; }
      .badge { background:#f0fff4;border:1px solid #27ae60;border-radius:6px;padding:6px 12px;text-align:center;margin:12px 0;color:#27ae60;font-weight:700; }
      @media print { body { padding:0; } }
    </style>
  </head><body>
    <div class="logo">${bs.company||'นวศรี เนอร์สซิ่งโฮม'}</div>
    <div class="center" style="font-size:11px;color:#666;margin-bottom:12px;">${bs.address||''}</div>
    <div class="center" style="font-size:16px;font-weight:700;margin-bottom:2px;">ใบเสร็จรับเงิน</div>
    <div class="center" style="font-size:13px;color:#666;margin-bottom:12px;">Receipt</div>
    <hr class="divider">
    <div class="row"><span style="color:#666;">เลขที่ใบเสร็จ</span><strong>${p.receiptNo}</strong></div>
    <div class="row"><span style="color:#666;">วันที่รับชำระ</span><span>${p.paymentDate}</span></div>
    <div class="row"><span style="color:#666;">ชื่อผู้ชำระ</span><strong>${p.patientName}</strong></div>
    ${inv ? `<div class="row"><span style="color:#666;">อ้างอิงบิล</span><span>${inv.docNo}</span></div>` : ''}
    ${inv ? `<div class="row"><span style="color:#666;">รายการ</span><span>${inv.jobName||''}</span></div>` : ''}
    <hr class="divider">
    <div class="total-row"><span>จำนวนเงินที่รับ</span><span>${formatThb(p.amount)}</span></div>
    <hr class="divider">
    <div class="row"><span style="color:#666;">ช่องทาง</span><span>${METHODS[p.method]||p.method}</span></div>
    ${p.reference?`<div class="row"><span style="color:#666;">เลขอ้างอิง</span><span>${p.reference}</span></div>`:''}
    <div class="row"><span style="color:#666;">รับโดย</span><span>${p.receivedBy||'-'}</span></div>
    <div class="badge">✅ ได้รับชำระเรียบร้อยแล้ว</div>
    <div class="center" style="font-size:11px;color:#999;margin-top:12px;">ขอบคุณที่ไว้วางใจใช้บริการ</div>
    <scr` + `ipt>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

// ─────────────────────────────────────────────────────
// ── EXPENSE MODULE ───────────────────────────────────
// ─────────────────────────────────────────────────────
function openExpenseModal() {
  initBilling();
  document.getElementById('exp-edit-id').value   = '';
  document.getElementById('exp-docno').value     = generateDocNo('expense');
  document.getElementById('exp-date').value      = new Date().toISOString().slice(0,10);
  document.getElementById('exp-preparer').value  = '';
  document.getElementById('exp-job').value       = '';
  document.getElementById('exp-vendor-name').value  = '';
  document.getElementById('exp-vendor-addr').value  = '';
  document.getElementById('exp-vendor-taxid').value = '';
  document.getElementById('exp-bank').value      = '';
  document.getElementById('exp-bank-no').value   = '';
  document.getElementById('exp-pay-date').value  = '';
  document.getElementById('exp-note').value      = '';
  document.getElementById('exp-wht-rate').value  = '0';
  document.getElementById('exp-pay-cash').checked = true;
  document.getElementById('exp-items-data').value = '[]';
  renderExpenseItems(); recalcExpense();
  document.getElementById('modal-expense-title').textContent = 'บันทึกค่าใช้จ่าย';
  openModal('modal-expense');
}

function renderExpenseItems() {
  const container = document.getElementById('exp-items-container');
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data').value||'[]');}catch(e){}
  if(items.length===0){
    container.innerHTML='<div style="text-align:center;color:var(--text3);padding:12px;font-size:13px;">กด + เพิ่มรายการ</div>';
    document.getElementById('exp-items-total').textContent='0.00 ฿'; recalcExpense(); return;
  }
  // Category options
  const cats = ['ค่าน้ำมัน/แก๊ส/รถยนต์','ค่าอาหาร','ค่าสาธารณูปโภค','ค่าโทรศัพท์','ค่าอุปกรณ์สำนักงาน','ค่าซ่อมบำรุง','ค่าเดินทาง','อื่นๆ'];
  const catOpts = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  container.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="color:var(--text2);border-bottom:1px solid var(--border);">
      <th style="text-align:left;padding:4px 6px;">รายละเอียด</th>
      <th style="text-align:left;padding:4px 6px;width:160px;">หมวดหมู่</th>
      <th style="text-align:right;padding:4px 6px;width:65px;">จำนวน</th>
      <th style="text-align:right;padding:4px 6px;width:90px;">ราคา/หน่วย</th>
      <th style="text-align:right;padding:4px 6px;width:90px;">ยอดรวม</th>
      <th style="width:24px;"></th>
    </tr></thead><tbody>
    ${items.map((it,idx)=>`<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:4px 6px;"><input type="text" value="${(it.desc||'').replace(/"/g,'&quot;')}" onchange="updateExpItem(${idx},'desc',this.value)" style="width:100%;border:none;background:transparent;color:var(--text1);font-size:12px;"></td>
      <td style="padding:4px 6px;"><select onchange="updateExpItem(${idx},'cat',this.value)" style="width:100%;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);font-size:12px;padding:2px 4px;">${cats.map(c=>`<option value="${c}" ${it.cat===c?'selected':''}>${c}</option>`).join('')}</select></td>
      <td style="padding:4px 6px;"><input type="number" value="${it.qty||1}" min="0" oninput="updateExpItem(${idx},'qty',this.value)" style="width:60px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:12px;"></td>
      <td style="padding:4px 6px;"><input type="number" value="${it.price||0}" min="0" oninput="updateExpItem(${idx},'price',this.value)" style="width:85px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:12px;"></td>
      <td style="padding:4px 6px;text-align:right;font-weight:600;" id="exp-row-${idx}">${formatThb((it.qty||1)*(it.price||0))}</td>
      <td><button onclick="removeExpItem(${idx})" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">✕</button></td>
    </tr>`).join('')}
    </tbody></table>`;
  document.getElementById('exp-items-total').textContent=formatThb(items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0));
  recalcExpense();
}

function updateExpItem(idx,field,value) {
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data').value||'[]');}catch(e){}
  if(!items[idx]) return;
  if(field==='qty'||field==='price') value=parseFloat(value)||0;
  items[idx][field]=value;
  document.getElementById('exp-items-data').value=JSON.stringify(items);
  const cell=document.getElementById(`exp-row-${idx}`);
  if(cell) cell.textContent=formatThb((items[idx].qty||1)*(items[idx].price||0));
  document.getElementById('exp-items-total').textContent=formatThb(items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0));
  recalcExpense();
}
function removeExpItem(idx){
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data').value||'[]');}catch(e){}
  items.splice(idx,1); document.getElementById('exp-items-data').value=JSON.stringify(items); renderExpenseItems();
}
function addExpenseItem(){
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data').value||'[]');}catch(e){}
  items.push({desc:'',cat:'อื่นๆ',qty:1,price:0}); document.getElementById('exp-items-data').value=JSON.stringify(items); renderExpenseItems();
}

function recalcExpense() {
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data')?.value||'[]');}catch(e){}
  const subtotal = items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0);
  // Expense: VAT is included in price (back-calculate)
  const vatIncluded = subtotal * (7/107);
  const beforeVat   = subtotal - vatIncluded;
  const whtRate = parseFloat(document.getElementById('exp-wht-rate')?.value||0)/100;
  const whtAmt  = subtotal * whtRate;
  const net     = subtotal - whtAmt;

  if(document.getElementById('exp-subtotal'))  document.getElementById('exp-subtotal').textContent  = formatThb(beforeVat);
  if(document.getElementById('exp-vat'))       document.getElementById('exp-vat').textContent       = formatThb(vatIncluded);
  if(document.getElementById('exp-total-vat')) document.getElementById('exp-total-vat').textContent = formatThb(subtotal);
  if(document.getElementById('exp-wht'))       document.getElementById('exp-wht').textContent       = formatThb(whtAmt);
  if(document.getElementById('exp-net'))       document.getElementById('exp-net').textContent       = formatThb(net);
}

async function saveExpense() {
  const date = document.getElementById('exp-date').value;
  if(!date) { toast('กรุณาระบุวันที่','warning'); return; }
  // Check duplicate doc number
  const editId_ = document.getElementById('exp-edit-id').value;
  const docNo_  = document.getElementById('exp-docno').value.trim();
  if (docNo_) {
    const dup = (db.expenses||[]).find(e => e.docNo === docNo_ && e.id !== editId_);
    if (dup) {
      const proceed = confirm(`⚠️ เลขที่เอกสาร "${docNo_}" ซ้ำกับรายการที่มีอยู่แล้ว!\n\nรายการเดิม: ${dup.vendorName || dup.job || '-'} (${dup.date || '-'})\n\nต้องการบันทึกทับหรือไม่?`);
      if (!proceed) return;
    }
  }
  let items=[]; try{items=JSON.parse(document.getElementById('exp-items-data').value||'[]');}catch(e){}
  const subtotal    = items.reduce((s,it)=>s+(it.qty||1)*(it.price||0),0);
  const vatIncluded = subtotal*(7/107);
  const whtRate     = parseFloat(document.getElementById('exp-wht-rate').value||0);
  const whtAmt      = subtotal*(whtRate/100);
  const net         = subtotal-whtAmt;
  const payMethod   = document.querySelector('input[name="exp-payment"]:checked')?.value||'cash';
  const editId      = document.getElementById('exp-edit-id').value;

  const exp = {
    id: editId||('exp_'+Date.now()),
    docNo:       document.getElementById('exp-docno').value||generateDocNo('expense'),
    date,
    preparer:    document.getElementById('exp-preparer').value,
    job:         document.getElementById('exp-job').value,
    vendorName:  document.getElementById('exp-vendor-name').value,
    vendorAddr:  document.getElementById('exp-vendor-addr').value,
    vendorTaxId: document.getElementById('exp-vendor-taxid').value,
    items, subtotal: subtotal-(subtotal*(7/107)), vatAmt: vatIncluded, totalVat: subtotal,
    whtRate, whtAmt, net,
    payMethod, bank: document.getElementById('exp-bank').value,
    bankNo: document.getElementById('exp-bank-no').value,
    payDate: document.getElementById('exp-pay-date').value,
    note: document.getElementById('exp-note').value,
    updatedAt: new Date().toISOString(),
    createdAt: editId ? undefined : new Date().toISOString(),
  };

  if(!db.expenses) db.expenses=[];
  const expRow = {
    id: exp.id, doc_no: exp.docNo||null,
    date: exp.date||null, preparer: exp.preparer||null, job: exp.job||null,
    vendor_name: exp.vendorName||null, vendor_addr: exp.vendorAddr||null,
    vendor_tax_id: exp.vendorTaxId||null,
    items: exp.items||[],
    subtotal: exp.subtotal||0, vat_amt: exp.vatAmt||0, total_vat: exp.totalVat||0,
    wht_rate: exp.whtRate||0, wht_amt: exp.whtAmt||0, net: exp.net||0,
    pay_method: exp.payMethod||'cash', bank: exp.bank||null, bank_no: exp.bankNo||null,
    pay_date: exp.payDate||null, note: exp.note||null,
    updated_at: new Date().toISOString(),
  };
  if (!editId) expRow.created_at = new Date().toISOString();
  const { error: expErr } = await supa.from('expenses').upsert(expRow);
  if (expErr) { toast('บันทึกไม่สำเร็จ: '+expErr.message,'error'); return; }
  if(editId){ const idx=db.expenses.findIndex(e=>e.id===editId); if(idx>=0) db.expenses[idx]={...db.expenses[idx],...exp}; else db.expenses.unshift(exp); }
  else db.expenses.unshift(exp); toast('บันทึกค่าใช้จ่ายแล้ว','success');
  closeModal('modal-expense'); renderBilling();
}

function editExpense(id) {
  const exp=(db.expenses||[]).find(e=>e.id===id); if(!exp) return;
  document.getElementById('exp-edit-id').value      = exp.id;
  document.getElementById('exp-docno').value        = exp.docNo||'';
  document.getElementById('exp-date').value         = exp.date||'';
  document.getElementById('exp-preparer').value     = exp.preparer||'';
  document.getElementById('exp-job').value          = exp.job||'';
  document.getElementById('exp-vendor-name').value  = exp.vendorName||'';
  document.getElementById('exp-vendor-addr').value  = exp.vendorAddr||'';
  document.getElementById('exp-vendor-taxid').value = exp.vendorTaxId||'';
  document.getElementById('exp-bank').value         = exp.bank||'';
  document.getElementById('exp-bank-no').value      = exp.bankNo||'';
  document.getElementById('exp-pay-date').value     = exp.payDate||'';
  document.getElementById('exp-note').value         = exp.note||'';
  document.getElementById('exp-wht-rate').value     = exp.whtRate||0;
  document.getElementById('exp-items-data').value   = JSON.stringify(exp.items||[]);
  const payEl = document.getElementById(`exp-pay-${exp.payMethod||'cash'}`);
  if(payEl) payEl.checked=true;
  renderExpenseItems(); recalcExpense();
  document.getElementById('modal-expense-title').textContent='แก้ไขค่าใช้จ่าย';
  openModal('modal-expense');
}

async function deleteExpense(id) {
  if(!confirm('ลบรายการค่าใช้จ่ายนี้หรือไม่?')) return;
  const { error } = await supa.from('expenses').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.expenses=(db.expenses||[]).filter(e=>e.id!==id);
  toast('ลบแล้ว','success'); renderBilling();
}

// ─────────────────────────────────────────────────────
// ── PREVIEW / EXPORT FUNCTIONS ───────────────────────
// ─────────────────────────────────────────────────────

// Track current preview context
let _previewId   = null;
let _previewType = null; // 'invoice' | 'expense'

function previewDoc(id, type) {
  _previewId   = id;
  _previewType = type;

  const html  = type === 'expense' ? buildExpenseHTML(id) : buildInvoiceHTML(id);
  const title = type === 'expense' ? 'บันทึกค่าใช้จ่าย' : getInvoiceTypeLabel(id);

  document.getElementById('preview-modal-title').textContent = '👁️ Preview — ' + title;
  document.getElementById('preview-doc-body').innerHTML = html;
  // Hide excel for expense if needed (keep for all)
  openModal('modal-doc-preview');
}

function getInvoiceTypeLabel(id) {
  const inv = (db.invoices||[]).find(i=>i.id===id);
  const LABELS = {invoice:'ใบแจ้งหนี้/วางบิล', receipt:'ใบเสร็จรับเงิน', quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี'};
  return LABELS[inv?.type] || 'เอกสาร';
}

function printFromPreview() {
  if (!_previewId) return;
  if (_previewType === 'expense') printExpense(_previewId);
  else printInvoice(_previewId);
}

function pdfFromPreview() {
  if (!_previewId) return;
  if (_previewType === 'expense') exportExpensePDF(_previewId);
  else exportInvoicePDF(_previewId);
}

function excelFromPreview() {
  if (!_previewId) return;
  if (_previewType === 'expense') exportExpenseExcel(_previewId);
  else exportInvoiceExcel(_previewId);
}

// ── Build inline HTML (for preview & PDF) ────────────
function buildInvoiceHTML(id, copyMode=false) {
  const inv     = (db.invoices||[]).find(i=>i.id===id); if(!inv) return '';
  const bs      = getBillingSettings();
  const patient = db.patients.find(p=>String(p.id)===String(inv.patientId));
  const LABELS  = {invoice:'ใบวางบิล / ใบแจ้งหนี้', receipt:'ใบเสร็จรับเงิน', quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี'};
  const ENG_LBL = {invoice:'Invoice', receipt:'Official Receipt', quotation:'Quotation', tax_invoice:'Tax Invoice'};
  const THEMES  = {
    invoice:     {orig:'#2d4a38',copy:'#1a6b4a',origL:'#e8f5ee',copyL:'#e9f7ef',origB:'#c8e6d5',copyB:'#a9dfbf'},
    receipt:     {orig:'#1a5276',copy:'#117a8b',origL:'#eaf3fb',copyL:'#e8f8f5',origB:'#aed6f1',copyB:'#a2d9ce'},
    quotation:   {orig:'#b94000',copy:'#c0770a',origL:'#fef0e7',copyL:'#fef9e7',origB:'#f0b27a',copyB:'#f9e79f'},
    tax_invoice: {orig:'#6c3483',copy:'#9b59b6',origL:'#f5eef8',copyL:'#fdf2ff',origB:'#d2b4de',copyB:'#dda0dd'},
  };
  const th = THEMES[inv.type] || THEMES.invoice;
  const logoSrc = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAfQB9ADASIAAhEBAxEB/8QAHQABAAIDAQEBAQAAAAAAAAAAAAgJBQYHBAMCAf/EAFoQAQABAwICBQYGDQgHBwQBBQABAgMEBQYHEQgSITFBCRNRYXGBFBUiN3WRFhgyQlKCkpShsbKz0SM4VVZicsHSFzM0c3SitCQ2Q1RXdpNTY8Lw4fElNYNE/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJlgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/9k=`;
  const coName = bs.company || 'นวศรี เนอร์สซิ่งโฮม';

  const buildDoc = (isCopy) => {
    const c  = isCopy ? th.copy  : th.orig;
    const cl = isCopy ? th.copyL : th.origL;
    const cb = isCopy ? th.copyB : th.origB;
    const tag = isCopy ? 'สำเนา / Copy' : 'ต้นฉบับ / Original';
    const docLabel = LABELS[inv.type] || inv.type;
    const docEng   = ENG_LBL[inv.type] || '';

    // ── rows ──────────────────────────────────────────
    const rows = [];
    if(inv.roomEnabled && inv.roomTotal>0) {
      const u = inv.roomType==='daily'?'วัน':'เดือน';
      const rName = inv.roomLabel || `ค่าห้องและค่าดูแล (${inv.roomType==='daily'?'รายวัน':'รายเดือน'})`;
      rows.push({name:rName, qty:inv.roomQty, unit:u, price:inv.roomRate, total:inv.roomTotal});
    }
    if(inv.ptEnabled && inv.ptTotal>0) {
      const u = inv.ptType==='session'?'ครั้ง':inv.ptType==='daily'?'วัน':'เดือน';
      rows.push({name:'ค่ากายภาพบำบัด', qty:inv.ptQty, unit:u, price:inv.ptRate, total:inv.ptTotal});
    }
    const CAT_NAMES_DOC = { 'ยา':'💊 ยา', 'เวชภัณฑ์':'🩺 เวชภัณฑ์', 'ของใช้':'🧴 ของใช้', 'บริการ':'🔧 บริการ' };
    const CAT_ORDER_DOC = ['ยา','เวชภัณฑ์','ของใช้','บริการ'];
    if(!inv.hideItems) {
      const catGroups = {};
      (inv.medItems||[]).forEach(it => {
        const cat = it.category || 'เวชภัณฑ์';
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(it);
      });
      const sortedCats = [...CAT_ORDER_DOC, ...Object.keys(catGroups).filter(c=>!CAT_ORDER_DOC.includes(c))];
      sortedCats.forEach(cat => {
        if (!catGroups[cat]?.length) return;
        catGroups[cat].forEach(it => rows.push({
          name: it.name, sub: CAT_NAMES_DOC[cat] || cat,
          qty: it.qty||1, unit: it.unit||'', price: it.price||0, total: (it.qty||1)*(it.price||0)
        }));
      });
    } else if(inv.medTotal>0) {
      rows.push({name:'ค่าเวชภัณฑ์ / ยา / ของใช้ / บริการ', sub:'', qty:1, unit:'', price:inv.medTotal, total:inv.medTotal});
    }
    (inv.otherItems||[]).filter(it=>(it.price||0)>0).forEach(it=>rows.push({name:it.name, qty:it.qty||1, unit:it.unit||'', price:it.price||0, total:(it.qty||1)*(it.price||0)}));

    const rowsHtml = rows.map((r,i)=>`<tr>
      <td style="border-bottom:1px solid #f0f0f0;padding:8px 11px;text-align:center;color:#999;">${i+1}</td>
      <td style="border-bottom:1px solid #f0f0f0;padding:8px 11px;font-weight:500;">${r.name}${r.sub?`<span style="margin-left:6px;font-size:10px;color:#888;font-weight:400;">${r.sub}</span>`:''}</td>
      <td style="border-bottom:1px solid #f0f0f0;padding:8px 11px;text-align:center;font-family:monospace;">${r.qty}${r.unit?' '+r.unit:''}</td>
      <td style="border-bottom:1px solid #f0f0f0;padding:8px 11px;text-align:right;font-family:monospace;">${(r.price||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
      <td style="border-bottom:1px solid #f0f0f0;padding:8px 11px;text-align:right;font-family:monospace;font-weight:700;">${(r.total||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="padding:16px;text-align:center;color:#999;">ไม่มีรายการ</td></tr>`;

    const vatLine = (inv.vatRate||0)>0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:${c}">VAT ${inv.vatRate}%</span><span style="font-family:monospace">${formatThb(inv.vatAmt||0)}</span></div>` : '';
    const whtLine = (inv.whtRate||0)>0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#c0392b">หัก ณ ที่จ่าย ${inv.whtRate}%</span><span style="font-family:monospace;color:#c0392b">-${formatThb(inv.whtAmt||0)}</span></div>` : '';
    const dueRow  = inv.dueDate ? `<tr><td style="color:#999;padding:3px 8px;text-align:right;">กำหนดชำระ</td><td style="font-weight:600;font-family:monospace;">${inv.dueDate}</td></tr>` : '';

    return `<div style="font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#222;background:white;overflow:hidden;border-radius:4px;">
      <div style="height:6px;background:${c};"></div>
      <!-- HEADER: 3 คอลัมน์ -->
      <div style="display:grid;grid-template-columns:200px 1fr 200px;gap:0;padding:22px 36px 18px;border-bottom:1px solid #eee;align-items:start;">
        <!-- ซ้าย: โลโก้บน + ที่อยู่ใต้ -->
        <div>
          <img src="${logoSrc}" style="height:62px;width:auto;object-fit:contain;display:block;margin-bottom:8px;" alt="logo">
          <div style="font-size:11px;color:#555;line-height:1.85;">
            <div style="font-size:12px;font-weight:700;color:${c};margin-bottom:2px;">${coName}</div>
            ${bs.address?bs.address.split('\n').join('<br>'):''}
            ${bs.taxId?`<br>เลขผู้เสียภาษี ${bs.taxId}`:''}
            ${bs.phone?`<br>โทร. ${bs.phone}`:''}
          </div>
        </div>
        <!-- กลาง: ชื่อเอกสาร + tag ต้นฉบับ/สำเนา -->
        <div style="text-align:center;padding-top:4px;">
          <div style="font-size:24px;font-weight:700;color:${c};line-height:1.2;">${docLabel}</div>
          <div style="font-size:11px;color:#bbb;font-style:italic;margin:3px 0 10px;">${docEng}</div>
          <div style="display:inline-block;padding:4px 20px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.07em;background:${cl};color:${c};border:1.5px solid ${cb};">${tag}</div>
        </div>
        <!-- ขวา: เลขที่/วันที่ -->
        <div style="text-align:right;padding-top:4px;">
          <table style="font-size:12px;border-collapse:collapse;margin-left:auto;">
            <tr><td style="color:#999;padding:3px 8px;text-align:right;">เลขที่</td><td style="font-weight:700;font-family:monospace;color:${c};">${inv.docNo||'-'}</td></tr>
            <tr><td style="color:#999;padding:3px 8px;text-align:right;">วันที่</td><td style="font-weight:600;font-family:monospace;">${inv.date||'-'}</td></tr>
            ${dueRow}
          </table>
        </div>
      </div>
      <!-- BODY -->
      <div style="padding:18px 36px 40px;">
        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <div style="flex:1.4;border-radius:7px;padding:12px 14px;background:${cl};border:1px solid ${cb};">
            <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">ลูกค้า / Customer</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:3px;">${inv.patientName||'-'}</div>
            ${patient?.address?`<div style="font-size:11px;color:#666;margin-top:2px;">${patient.address}</div>`:''}
            ${patient?.phone?`<div style="font-size:11px;color:#666;">โทร. ${patient.phone}</div>`:''}
            ${patient?.idcard?`<div style="font-size:11px;color:#999;">เลขประจำตัว ${patient.idcard}</div>`:''}
          </div>
          ${inv.jobName?`<div style="flex:1;border-radius:7px;padding:12px 14px;background:${cl};border:1px solid ${cb};">
            <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">ชื่องาน / Project</div>
            <div style="font-size:13px;font-weight:700;">${inv.jobName}</div>
          </div>`:''}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px;">
          <thead><tr style="background:${c};color:white;">
            <th style="padding:8px 11px;font-size:12px;width:34px;text-align:center;">#</th>
            <th style="padding:8px 11px;font-size:12px;text-align:left;">รายละเอียด / Description</th>
            <th style="padding:8px 11px;font-size:12px;width:88px;text-align:center;">จำนวน</th>
            <th style="padding:8px 11px;font-size:12px;width:105px;text-align:right;">ราคาต่อหน่วย</th>
            <th style="padding:8px 11px;font-size:12px;width:105px;text-align:right;">มูลค่า</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:16px;">
          <div style="flex:1;font-size:12px;color:#555;padding:10px 14px;border-radius:6px;line-height:1.7;background:${cl};border-left:4px solid ${c};">
            <strong>จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)</strong><br>
            <span style="font-size:13px;color:${c};font-weight:600;">${bahtText(inv.grandTotal||0)}</span>
          </div>
          <div style="width:275px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:#666">รวมเป็นเงิน</span><span style="font-family:monospace">${formatThb(inv.subtotal||0)}</span></div>
            ${vatLine}
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;border-top:1px solid #ddd;margin-top:4px;"><span>รวมทั้งสิ้น</span><span style="font-family:monospace;color:${c}">${formatThb(inv.beforeWht||inv.grandTotal||0)}</span></div>
            ${whtLine}
            <div style="display:flex;justify-content:space-between;padding:10px 14px;border-radius:7px;margin-top:6px;font-size:14px;font-weight:700;color:white;background:${c};">
              <span>ยอดชำระ</span><span style="font-family:monospace">${formatThb(inv.grandTotal||0)}</span>
            </div>
          </div>
        </div>
        ${inv.note?`<div style="font-size:12px;color:#666;border-top:1px dashed #ddd;padding-top:10px;margin-bottom:18px;line-height:1.7;"><strong>หมายเหตุ:</strong> ${inv.note}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:44px;">
          <div style="text-align:center;width:175px;">
            <div style="height:50px;"></div>
            <div style="border-top:1.5px solid #444;padding-top:8px;">
              <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">( ผู้รับวางบิล )</div>
              <div style="font-size:11px;color:#999;">วันที่ ................................</div>
            </div>
          </div>
          <div style="text-align:center;padding-bottom:4px;">
            <div style="font-size:10px;color:#bbb;margin-bottom:6px;">ตราประทับ</div>
            <div style="width:78px;height:78px;border:1px dashed #ccc;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:10px;">ตราประทับ</div>
          </div>
          <div style="text-align:center;width:175px;">
            <div style="height:50px;"></div>
            <div style="border-top:1.5px solid #444;padding-top:8px;">
              <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">( ผู้วางบิล )</div>
              <div style="font-size:11px;color:#999;">วันที่ ................................</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  };

  return buildDoc(false) + '<div style="page-break-before:always;margin-top:36px;"></div>' + buildDoc(true);
}

function buildInvoiceHTML_copy(inv, bs, patient, rows, rowsHtml, docLabel) {
  return ''; // legacy stub — buildInvoiceHTML generates both pages
}

// helper: baht text (simple)
function bahtText(n) {
  if (!n || n===0) return 'ศูนย์บาทถ้วน';
  // ใช้ Intl หรือ fallback
  try {
    return n.toLocaleString('th-TH',{style:'currency',currency:'THB'}).replace('฿','') + ' บาท';
  } catch(e) { return n.toLocaleString() + ' บาท'; }
}


function buildExpenseHTML(id) {
  const exp = (db.expenses||[]).find(e=>e.id===id); if(!exp) return '';
  const bs  = getBillingSettings();
  const PAY = {cash:'เงินสด', transfer:'โอนเงิน', cheque:'เช็ค'};

  const rowsHtml = (exp.items||[]).map((it,i)=>`<tr>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:center;">${i+1}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;">${it.desc||''}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;">${it.cat||''}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:center;">${it.qty||1}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;">${(it.price||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;font-weight:600;">${((it.qty||1)*(it.price||0)).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
  </tr>`).join('');

  return `
  <div style="font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#222;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5a9e7a;padding-bottom:14px;margin-bottom:16px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#2d4a38;">${bs.company||'นวศรี เนอร์สซิ่งโฮม'}</div>
        <div style="font-size:11px;color:#555;line-height:1.7;margin-top:4px;">
          ${bs.taxId?`เลขประจำตัวผู้เสียภาษี ${bs.taxId}<br>`:''}
          ${bs.phone?`โทร. ${bs.phone}<br>`:''}${bs.email?`อีเมล ${bs.email}`:''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:#2d4a38;">บันทึกค่าใช้จ่าย</div>
        <div style="font-size:11px;color:#777;font-style:italic;">Expense Note</div>
        <table style="margin-top:6px;font-size:12px;border-collapse:collapse;">
          <tr><td style="color:#777;padding:2px 8px;">เลขที่</td><td style="font-weight:600;font-family:monospace;">${exp.docNo||'-'}</td></tr>
          <tr><td style="color:#777;padding:2px 8px;">วันที่</td><td style="font-weight:600;">${exp.date||'-'}</td></tr>
          ${exp.preparer?`<tr><td style="color:#777;padding:2px 8px;">ผู้จัดทำ</td><td style="font-weight:600;">${exp.preparer}</td></tr>`:''}
          ${exp.job?`<tr><td style="color:#777;padding:2px 8px;">ชื่องาน</td><td style="font-weight:600;">${exp.job}</td></tr>`:''}
        </table>
      </div>
    </div>

    ${exp.vendorName?`<div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:6px;padding:12px;margin-bottom:14px;">
      <div style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:4px;">ผู้จำหน่าย / Vendor</div>
      <div style="font-weight:700;font-size:14px;">${exp.vendorName}</div>
      ${exp.vendorAddr?`<div style="font-size:11px;color:#666;margin-top:2px;">${exp.vendorAddr}</div>`:''}
      ${exp.vendorTaxId?`<div style="font-size:11px;color:#666;">เลขประจำตัวผู้เสียภาษี ${exp.vendorTaxId}</div>`:''}
    </div>`:''}

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#2d4a38;color:white;">
        <th style="padding:8px 10px;font-size:12px;width:36px;text-align:center;">#</th>
        <th style="padding:8px 10px;font-size:12px;text-align:left;">รายละเอียด</th>
        <th style="padding:8px 10px;font-size:12px;text-align:left;width:150px;">หมวดหมู่</th>
        <th style="padding:8px 10px;font-size:12px;text-align:center;width:60px;">จำนวน</th>
        <th style="padding:8px 10px;font-size:12px;text-align:right;width:110px;">ราคาต่อหน่วย</th>
        <th style="padding:8px 10px;font-size:12px;text-align:right;width:110px;">ยอดรวม</th>
      </tr></thead>
      <tbody>${rowsHtml||'<tr><td colspan="6" style="text-align:center;color:#999;padding:16px;">ไม่มีรายการ</td></tr>'}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <div style="width:280px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;"><span style="color:#555;">ราคาไม่รวม VAT</span><span>${formatThb(exp.subtotal||0)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;"><span style="color:#555;">VAT 7%</span><span>${formatThb(exp.vatAmt||0)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:700;border-top:1px solid #ddd;margin-top:4px;"><span>จำนวนเงินรวมทั้งสิ้น</span><span>${formatThb(exp.totalVat||0)}</span></div>
        ${(exp.whtRate||0)>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;"><span style="color:#c0392b;">หัก ณ ที่จ่าย ${exp.whtRate}%</span><span style="color:#c0392b;">${formatThb(exp.whtAmt||0)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;font-size:15px;font-weight:700;background:#2d4a38;color:white;border-radius:6px;margin-top:6px;"><span>ยอดชำระ</span><span>${formatThb(exp.net||0)}</span></div>
      </div>
    </div>

    <div style="background:#f8f8f8;border:1px solid #e8e8e8;border-radius:6px;padding:12px;margin-bottom:14px;font-size:12px;">
      <strong>การชำระเงิน:</strong>
      ${PAY[exp.payMethod]||exp.payMethod||'-'}
      ${exp.bank?` | ธนาคาร: ${exp.bank}`:''}
      ${exp.bankNo?` | เลขที่: ${exp.bankNo}`:''}
      ${exp.payDate?` | วันที่ชำระ: ${exp.payDate}`:''}
      | ยอดชำระ: <strong>${formatThb(exp.net||0)}</strong>
    </div>

    ${exp.note?`<div style="font-size:12px;color:#666;border-top:1px solid #eee;padding-top:10px;"><strong>หมายเหตุ:</strong> ${exp.note}</div>`:''}

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:50px;">
      <div style="text-align:center;width:175px;"><div style="height:50px;"></div><div style="border-top:1.5px solid #444;padding-top:8px;"><div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">( ผู้รับเงิน )</div><div style="font-size:11px;color:#999;">วันที่ ................................</div></div></div>
      <div style="text-align:center;width:175px;"><div style="height:50px;"></div><div style="border-top:1.5px solid #444;padding-top:8px;"><div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">( ผู้จัดทำ )</div><div style="font-size:11px;color:#999;">วันที่ ................................</div></div></div>
      <div style="text-align:center;width:175px;"><div style="height:50px;"></div><div style="border-top:1.5px solid #444;padding-top:8px;"><div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">( ผู้อนุมัติ )</div><div style="font-size:11px;color:#999;">วันที่ ................................</div></div></div>
    </div>
  </div>`;
}

// ── Export PDF ────────────────────────────────────────
async function exportInvoicePDF(id) {
  const inv = (db.invoices||[]).find(i=>i.id===id); if(!inv) return;
  await _exportDocPDF(buildInvoiceHTML(id), inv.docNo||'invoice');
}
async function exportExpensePDF(id) {
  const exp = (db.expenses||[]).find(e=>e.id===id); if(!exp) return;
  await _exportDocPDF(buildExpenseHTML(id), exp.docNo||'expense');
}

async function _exportDocPDF(html, filename) {
  toast('กำลังสร้าง PDF...', 'info');
  // Create hidden container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:white;padding:32px;font-family:"IBM Plex Sans Thai",sans-serif;';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');
    if (pdfH <= 297) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    } else {
      // Multi-page
      let yPos = 0;
      const pageH = 297;
      while (yPos < pdfH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yPos, pdfW, pdfH);
        yPos += pageH;
      }
    }
    pdf.save(`${filename}.pdf`);
    toast('ดาวน์โหลด PDF แล้ว', 'success');
  } catch(e) {
    console.error(e);
    toast('สร้าง PDF ไม่สำเร็จ', 'error');
  } finally {
    document.body.removeChild(container);
  }
}

// ── Export Excel ──────────────────────────────────────
function exportInvoiceExcel(id) {
  const inv = (db.invoices||[]).find(i=>i.id===id); if(!inv) return;
  const bs  = getBillingSettings();
  const LABELS = {invoice:'ใบแจ้งหนี้/วางบิล', receipt:'ใบเสร็จรับเงิน', quotation:'ใบเสนอราคา', tax_invoice:'ใบกำกับภาษี'};

  const rows = [
    [bs.company||'นวศรี เนอร์สซิ่งโฮม'],
    [LABELS[inv.type]||inv.type],
    ['เลขที่', inv.docNo||'', 'วันที่', inv.date||'', 'กำหนดชำระ', inv.dueDate||''],
    ['ลูกค้า', inv.patientName||''],
    inv.jobName ? ['ชื่องาน', inv.jobName] : null,
    [],
    ['#', 'รายละเอียด', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย', 'มูลค่า'],
  ].filter(Boolean);

  let lineNo = 1;
  if(inv.roomEnabled && inv.roomTotal>0) {
    const u = inv.roomType==='daily'?'วัน':'เดือน';
    const rName = inv.roomLabel || `ค่าห้องและค่าดูแล (${inv.roomType==='daily'?'รายวัน':'รายเดือน'})`;
    rows.push([lineNo++, rName, inv.roomQty, u, inv.roomRate, inv.roomTotal]);
  }
  if(inv.ptEnabled && inv.ptTotal>0) {
    const u = inv.ptType==='session'?'ครั้ง':inv.ptType==='daily'?'วัน':'เดือน';
    rows.push([lineNo++, 'ค่ากายภาพบำบัด', inv.ptQty, u, inv.ptRate, inv.ptTotal]);
  }
  (inv.medItems||[]).forEach(it => rows.push([lineNo++, it.name, it.qty, '', it.price, it.qty*it.price]));
  (inv.otherItems||[]).forEach(it => rows.push([lineNo++, it.name, it.qty||1, '', it.price||0, (it.qty||1)*(it.price||0)]));

  rows.push([]);
  rows.push(['', '', '', '', 'รวมเป็นเงิน', inv.subtotal||0]);
  if((inv.vatRate||0)>0) rows.push(['', '', '', '', `VAT ${inv.vatRate}%`, inv.vatAmt||0]);
  rows.push(['', '', '', '', 'จำนวนเงินรวมทั้งสิ้น', inv.beforeWht||inv.grandTotal||0]);
  if((inv.whtRate||0)>0) rows.push(['', '', '', '', `หัก ณ ที่จ่าย ${inv.whtRate}%`, -(inv.whtAmt||0)]);
  rows.push(['', '', '', '', 'ยอดชำระ', inv.grandTotal||0]);
  if(inv.note) { rows.push([]); rows.push(['หมายเหตุ', inv.note]); }

  _downloadExcel(rows, inv.docNo||'invoice');
}

function exportExpenseExcel(id) {
  const exp = (db.expenses||[]).find(e=>e.id===id); if(!exp) return;
  const bs  = getBillingSettings();

  const rows = [
    [bs.company||'นวศรี เนอร์สซิ่งโฮม'],
    ['บันทึกค่าใช้จ่าย (Expense Note)'],
    ['เลขที่', exp.docNo||'', 'วันที่', exp.date||''],
    exp.preparer ? ['ผู้จัดทำ', exp.preparer] : null,
    exp.job      ? ['ชื่องาน', exp.job]       : null,
    exp.vendorName ? ['ผู้จำหน่าย', exp.vendorName, exp.vendorTaxId||''] : null,
    [],
    ['#', 'รายละเอียด', 'หมวดหมู่', 'จำนวน', 'ราคาต่อหน่วย', 'ยอดรวม'],
  ].filter(Boolean);

  (exp.items||[]).forEach((it,i) => rows.push([i+1, it.desc||'', it.cat||'', it.qty||1, it.price||0, (it.qty||1)*(it.price||0)]));

  rows.push([]);
  rows.push(['', '', '', '', 'ราคาไม่รวม VAT', exp.subtotal||0]);
  rows.push(['', '', '', '', 'VAT 7%', exp.vatAmt||0]);
  rows.push(['', '', '', '', 'จำนวนเงินรวมทั้งสิ้น', exp.totalVat||0]);
  if((exp.whtRate||0)>0) rows.push(['', '', '', '', `หัก ณ ที่จ่าย ${exp.whtRate}%`, -(exp.whtAmt||0)]);
  rows.push(['', '', '', '', 'ยอดชำระ', exp.net||0]);
  rows.push([]);
  rows.push(['ช่องทางชำระ', exp.payMethod||'', 'ธนาคาร', exp.bank||'', 'เลขที่', exp.bankNo||'', 'วันที่ชำระ', exp.payDate||'']);
  if(exp.note) { rows.push([]); rows.push(['หมายเหตุ', exp.note]); }

  _downloadExcel(rows, exp.docNo||'expense');
}

function _downloadExcel(rows, filename) {
  if (typeof XLSX === 'undefined') { toast('ไม่พบ SheetJS กรุณา refresh หน้า', 'error'); return; }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Document');
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast('ดาวน์โหลด Excel แล้ว', 'success');
}

// ─────────────────────────────────────────────────────
// ── QUICK INVOICE (สร้างใบวางบิลจากผู้รับบริการ) ────
// ─────────────────────────────────────────────────────

function openQuickInvoiceModal() {
  // Check role permission
  const role = currentUser?.role;
  if (!['admin','manager','officer'].includes(role)) {
    toast('ไม่มีสิทธิ์สร้างใบวางบิล','error'); return;
  }
  initBilling();

  // Populate patient dropdown
  const sel = document.getElementById('qi-patient');
  sel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p=>p.status==='active')
      .map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

  // Default date range = current month
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = String(now.getMonth()+1).padStart(2,'0');
  const lastD = new Date(y, now.getMonth()+1, 0).getDate();
  document.getElementById('qi-date-from').value = `${y}-${m}-01`;
  document.getElementById('qi-date-to').value   = `${y}-${m}-${String(lastD).padStart(2,'0')}`;

  openModal('modal-quick-invoice');
}

async function confirmQuickInvoice() {
  const patId    = document.getElementById('qi-patient').value;
  const dateFrom = document.getElementById('qi-date-from').value;
  const dateTo   = document.getElementById('qi-date-to').value;

  if (!patId)    { toast('กรุณาเลือกผู้รับบริการ','warning'); return; }
  if (!dateFrom) { toast('กรุณาระบุวันที่เริ่มต้น','warning'); return; }
  if (!dateTo)   { toast('กรุณาระบุวันที่สิ้นสุด','warning'); return; }
  if (dateFrom > dateTo) { toast('วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด','warning'); return; }

  const patient = db.patients.find(p=>String(p.id)===String(patId));
  if (!patient) { toast('ไม่พบข้อมูลผู้รับบริการ','error'); return; }

  closeModal('modal-quick-invoice');

  // ── ดึงรายการเบิกสินค้าที่อนุมัติแล้วในช่วงวันที่ ──
  const reqs = (db.requisitions||[]).filter(r =>
    String(r.patientId || r.patient_id) === String(patId) &&
    r.status === 'approved' &&
    r.date >= dateFrom && r.date <= dateTo
  );

  // รวมจาก reqGroups ด้วย
  const groupItems = [];
  (db.reqGroups||[]).forEach(g => {
    if (String(g.patientId || g.patient_id) === String(patId) &&
        g.status === 'approved' &&
        g.date >= dateFrom && g.date <= dateTo) {
      (g.items||[]).forEach(it => groupItems.push({
        name: it.name || it.itemName || '',
        qty:  it.qty  || it.quantity || 1,
        price: it.price || it.unitPrice || 0,
      }));
    }
  });

  // สร้าง medItems รวมรายการที่ชื่อเดียวกัน พร้อมแนบ category
  const medMap = {};
  const getItemCategory = (name) => {
    // หา category จาก db.items ตามชื่อ
    const found = (db.items||[]).find(i => i.name === name);
    return found ? (found.category || 'เวชภัณฑ์') : 'เวชภัณฑ์';
  };
  reqs.forEach(r => {
    const key = r.itemName || r.name || '';
    if (!key) return;
    if (!medMap[key]) medMap[key] = { name: key, qty: 0, price: r.price || r.unit_price || 0, category: r.category || getItemCategory(key) };
    medMap[key].qty += r.quantity || r.qty || 1;
  });
  groupItems.forEach(it => {
    const key = it.name;
    if (!key) return;
    if (!medMap[key]) medMap[key] = { name: key, qty: 0, price: it.price || 0, category: it.category || getItemCategory(key) };
    medMap[key].qty += it.qty;
  });
  const medItems = Object.values(medMap).filter(i => i.name);

  // คำนวณช่วงวันที่
  const dFrom = new Date(dateFrom);
  const dTo   = new Date(dateTo);
  const days  = Math.round((dTo - dFrom) / (1000*60*60*24)) + 1;

  const fmtDate = d => {
    if (!d) return '';
    const [y,m,day] = d.split('-');
    return `${day}/${m}/${parseInt(y)+543}`;  // แปลงเป็น พ.ศ.
  };
  const jobName = `${patient.name} — ${fmtDate(dateFrom)} ถึง ${fmtDate(dateTo)}`;

  // ── เปิด modal ใบวางบิล พร้อม pre-fill ──
  initBilling();
  document.getElementById('inv-edit-id').value  = '';
  document.getElementById('inv-type').value     = 'invoice';
  document.getElementById('inv-docno').value    = generateDocNo('invoice');
  document.getElementById('inv-date').value     = new Date().toISOString().slice(0,10);
  document.getElementById('inv-due-date').value = '';
  document.getElementById('inv-job-name').value = jobName;
  document.getElementById('inv-note').value     = '';
  document.getElementById('inv-vat-rate').value = getBillingSettings().vatRate || 0;
  document.getElementById('inv-wht-rate').value = '0';

  // ค่าห้อง/ค่าดูแล — ปิดไว้ก่อน ให้กรอกเอง
  document.getElementById('inv-room-enabled').checked = false;
  document.getElementById('inv-room-type').value      = 'monthly';
  document.getElementById('inv-room-qty').value       = '1';
  document.getElementById('inv-room-rate').value      = '0';
  document.getElementById('inv-room-total').value     = '0.00';
  document.getElementById('inv-room-label').value     = '';
  document.getElementById('inv-room-autofill').style.display = 'none';

  // ค่ากายภาพ — ปิดไว้ก่อน
  document.getElementById('inv-pt-enabled').checked = false;
  document.getElementById('inv-pt-qty').value       = '1';
  document.getElementById('inv-pt-rate').value      = '0';
  document.getElementById('inv-pt-total').value     = '0.00';
  document.getElementById('inv-pt-type').value      = 'monthly';

  // ช่วงเดือนสำหรับเวชภัณฑ์
  document.getElementById('inv-med-from').value = dateFrom.slice(0,7);
  document.getElementById('inv-med-to').value   = dateTo.slice(0,7);

  // เลือกผู้รับบริการ
  const patSel = document.getElementById('inv-patient');
  patSel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p=>p.status==='active')
      .map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  patSel.value = String(patId);
  // Auto-fill room rate + label from patient's bed
  onInvoicePatientChange();
  // Enable room checkbox if rate was found
  const roomRate = parseFloat(document.getElementById('inv-room-rate').value||0);
  if (roomRate > 0) document.getElementById('inv-room-enabled').checked = true;

  // ใส่รายการเบิกสินค้าที่ดึงมา
  document.getElementById('inv-req-items-data').value   = JSON.stringify(medItems);
  // ค่าอื่นๆ — เพิ่ม placeholder ให้ 1 รายการว่างสำหรับกรอกเอง
  const defaultOther = [
    { name:'ค่ารถพยาบาล', qty:1, price:0 },
    { name:'ค่าใช้จ่ายอื่นๆ', qty:1, price:0 },
  ];
  document.getElementById('inv-other-items-data').value = JSON.stringify(defaultOther);
  document.getElementById('inv-hide-items').checked = false;

  updateInvoiceTitle();
  renderInvoiceItems();
  renderOtherItems();
  recalcInvoice();
  openModal('modal-createInvoice');

  const medCount = medItems.length;
  if (medCount > 0) {
    toast(`✅ ดึงรายการเบิกสินค้าสำเร็จ: ${medCount} รายการ (${days} วัน)`, 'success');
  } else {
    toast(`⚠️ ไม่พบรายการเบิกสินค้าในช่วงวันที่เลือก (${days} วัน) — กรอกรายการเองได้เลย`, 'warning');
  }
}

// ── Duplicate doc number check (real-time) ───────────
function checkDocNoDuplicate(val, pool) {
  if (!val) return;
  const editId = document.getElementById(pool==='expense' ? 'exp-edit-id' : 'inv-edit-id')?.value;
  let dup;
  if (pool === 'expense') {
    dup = (db.expenses||[]).find(e => e.docNo === val && e.id !== editId);
  } else {
    dup = (db.invoices||[]).find(i => i.docNo === val && i.id !== editId);
  }
  const inputEl = document.getElementById(pool==='expense' ? 'exp-docno' : 'inv-docno');
  const warnId  = pool==='expense' ? 'exp-docno-warn' : 'inv-docno-warn';
  // Remove old warning
  const old = document.getElementById(warnId);
  if (old) old.remove();
  if (dup) {
    inputEl.style.borderColor = '#e74c3c';
    const warn = document.createElement('div');
    warn.id = warnId;
    warn.style.cssText = 'color:#e74c3c;font-size:11px;margin-top:3px;';
    warn.textContent = `⚠️ เลขที่ซ้ำกับ: ${dup.patientName||dup.vendorName||dup.job||'-'} (${dup.date||'-'})`;
    inputEl.parentNode.appendChild(warn);
  } else {
    inputEl.style.borderColor = '';
  }
}

// ─────────────────────────────────────────────────────
// ── SAVE / LOAD ──────────────────────────────────────
// ─────────────────────────────────────────────────────
async function saveBillingDB() {
  // invoices & expenses now saved row-by-row — only persist billingSettings here
  try {
    await supa.from('settings').upsert({ key:'billingSettings', value: db.billingSettings||{} });
  } catch(e) { console.error('saveBillingDB',e); toast('บันทึกการตั้งค่าไม่สำเร็จ','error'); }
}

function loadBillingFromSettings(settingsData) {
  const find = key => (settingsData||[]).find(s=>s.key===key)?.value;
  // invoices & expenses now loaded from their own tables in loadDB()
  db.billingSettings = find('billingSettings') || { ...DEFAULT_BILLING_SETTINGS };
}

// ─────────────────────────────────────────────────────
// ── BILLING SETTINGS ─────────────────────────────────
// ─────────────────────────────────────────────────────
function loadBillingSettingsUI() {
  const bs = getBillingSettings();
  document.getElementById('bs-company').value    = bs.company||'';
  document.getElementById('bs-address').value    = bs.address||'';
  document.getElementById('bs-taxid').value      = bs.taxId||'';
  document.getElementById('bs-phone').value      = bs.phone||'';
  document.getElementById('bs-email').value      = bs.email||'';
  document.getElementById('bs-doc-prefix').value = bs.docPrefix||'INV';
  document.getElementById('bs-expiry-warn').value= bs.expiryWarnDays||30;

}

async function saveBillingSettings() {
  const bs = {
    company:   document.getElementById('bs-company').value.trim(),
    address:   document.getElementById('bs-address').value.trim(),
    taxId:     document.getElementById('bs-taxid').value.trim(),
    phone:     document.getElementById('bs-phone').value.trim(),
    email:     document.getElementById('bs-email').value.trim(),
    docPrefix: document.getElementById('bs-doc-prefix').value.trim()||'INV',
    expiryWarnDays: parseInt(document.getElementById('bs-expiry-warn').value) || 30,
    vatRate:   0,
  };
  db.billingSettings=bs;
  await saveBillingDB();
  toast('บันทึกการตั้งค่าแล้ว','success');
}

// ─────────────────────────────────────────────────────
// ── PRINT: INVOICE ───────────────────────────────────
// ─────────────────────────────────────────────────────
function printInvoice(id) {
  const inv=(db.invoices||[]).find(i=>i.id===id); if(!inv) return;
  const bs=getBillingSettings();
  const patient=db.patients.find(p=>String(p.id)===String(inv.patientId));
  const TYPE_LABELS={invoice:'ใบแจ้งหนี้ / วางบิล',receipt:'ใบเสร็จรับเงิน',quotation:'ใบเสนอราคา',tax_invoice:'ใบกำกับภาษี'};

  // Build rows table
  const rows = [];
  if(inv.roomEnabled && inv.roomTotal>0) {
    const roomLabel = inv.roomLabel || `ค่าห้องและค่าดูแล (${inv.roomType==='daily'?'รายวัน':'รายเดือน'})`;
    rows.push({name:roomLabel, qty:inv.roomQty, unit:inv.roomType==='daily'?'วัน':'เดือน', price:inv.roomRate, total:inv.roomTotal});
  }
  if(inv.ptEnabled && inv.ptTotal>0) {
    const ptLabel = inv.ptType==='session'?'ครั้ง':inv.ptType==='daily'?'วัน':'เดือน';
    rows.push({name:'ค่ากายภาพบำบัด', qty:inv.ptQty, unit:ptLabel, price:inv.ptRate, total:inv.ptTotal});
  }
  if(!inv.hideItems) {
    (inv.medItems||[]).forEach(it=>rows.push({name:it.name,qty:it.qty,unit:'',price:it.price,total:it.qty*it.price}));
  } else if(inv.medTotal>0) {
    rows.push({name:'ค่าเวชภัณฑ์ / ยา',qty:1,unit:'รายการ',price:inv.medTotal,total:inv.medTotal});
  }
  (inv.otherItems||[]).forEach(it=>rows.push({name:it.name,qty:it.qty||1,unit:'',price:it.price||0,total:(it.qty||1)*(it.price||0)}));

  const rowsHtml = rows.map((r,i)=>`<tr>
    <td style="border:1px solid #ddd;padding:7px 10px;">${i+1}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;">${r.name}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:center;">${r.qty} ${r.unit}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;">${r.price.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;">${r.total.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
  </tr>`).join('');

  // Number in Thai words (simple)
  function thaiNum(n) {
    const s=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const u=['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
    if(n===0) return 'ศูนย์บาทถ้วน';
    const intPart=Math.floor(n), decPart=Math.round((n-intPart)*100);
    let str=''; let tmp=intPart; let pos=0;
    while(tmp>0){const d=tmp%10;if(d>0||pos>0)str=(d===1&&pos===1?'สิบ':d===2&&pos===1?'ยี่สิบ':s[d]+u[pos])+str;tmp=Math.floor(tmp/10);pos++;}
    str+='บาท'; if(decPart>0){let ds='';let dt=decPart;let dp=0;while(dt>0){const d=dt%10;if(d>0)ds=(s[d]+u[dp])+ds;dt=Math.floor(dt/10);dp++;}str+=ds+'สตางค์';}else str+='ถ้วน';
    return str;
  }

  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><title>${TYPE_LABELS[inv.type]||''} ${inv.docNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#222;background:#fff;padding:28px;max-width:820px;margin:0 auto;}
    .print-btn{position:fixed;top:12px;right:12px;background:#5a9e7a;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit;z-index:99;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5a9e7a;padding-bottom:16px;margin-bottom:18px;}
    .co-name{font-size:16px;font-weight:700;color:#2d4a38;margin-bottom:4px;}
    .co-sub{font-size:11px;color:#555;line-height:1.7;}
    .doc-box{text-align:right;}
    .doc-title{font-size:22px;font-weight:700;color:#2d4a38;}
    .doc-sub{font-size:11px;color:#777;margin-top:2px;font-style:italic;}
    .meta-table{width:100%;font-size:12px;margin-bottom:4px;}
    .meta-table td{padding:2px 6px;}
    .meta-label{color:#777;white-space:nowrap;width:90px;}
    .meta-val{font-weight:600;}
    .to-box{background:#f8f8f8;border:1px solid #e8e8e8;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:13px;}
    .to-label{font-size:11px;color:#999;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em;}
    .to-name{font-weight:700;font-size:15px;margin-bottom:3px;}
    .to-sub{font-size:11px;color:#666;}
    .items-table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    .items-table th{background:#2d4a38;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;}
    .items-table td{border:1px solid #ddd;padding:7px 10px;font-size:13px;vertical-align:top;}
    .items-table tr:nth-child(even) td{background:#fafafa;}
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:16px;}
    .totals-box{width:300px;}
    .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
    .tot-row.sep{border-top:1px solid #ddd;margin-top:4px;padding-top:8px;}
    .tot-row.grand{font-weight:700;font-size:15px;color:#2d4a38;}
    .tot-row.net{font-weight:700;font-size:16px;background:#2d4a38;color:#fff;padding:8px 12px;border-radius:6px;margin-top:6px;}
    .amount-words{font-size:12px;color:#555;margin-bottom:16px;font-style:italic;}
    .note-box{border-top:1px solid #eee;padding-top:10px;margin-bottom:20px;font-size:12px;color:#666;}
    .sign-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:44px;}
    .sign-box{text-align:center;width:180px;}
    .sign-line{border-top:1.5px solid #444;margin-top:56px;padding-top:8px;}
    .sign-name{font-size:12px;color:#333;font-weight:600;margin-bottom:8px;}
    .sign-date{font-size:11px;color:#999;}
    @media print{.print-btn{display:none;}body{padding:15px;}}
  </style>
  </head><body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์</button>
  <div class="header">
    <div>
      <div class="co-name">${bs.company||'นวศรี เนอร์สซิ่งโฮม'}</div>
      <div class="co-sub">
        ${bs.address?bs.address.split('\n').join('<br>'):''}
        ${bs.taxId?`<br>เลขประจำตัวผู้เสียภาษี ${bs.taxId}`:''}
        ${bs.phone?`<br>โทร. ${bs.phone}`:''}
        ${bs.email?`<br>อีเมล ${bs.email}`:''}
      </div>
    </div>
    <div class="doc-box">
      <div class="doc-title">${TYPE_LABELS[inv.type]||inv.type}</div>
      <div class="doc-sub">ต้นฉบับ</div>
      <table class="meta-table" style="margin-top:8px;">
        <tr><td class="meta-label">เลขที่</td><td class="meta-val" style="font-family:monospace;">${inv.docNo||'-'}</td></tr>
        <tr><td class="meta-label">วันที่</td><td class="meta-val">${inv.date||'-'}</td></tr>
        ${inv.dueDate?`<tr><td class="meta-label">กำหนดชำระ</td><td class="meta-val">${inv.dueDate}</td></tr>`:''}
      </table>
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:16px;">
    <div class="to-box" style="flex:1;">
      <div class="to-label">ลูกค้า / Customer</div>
      <div class="to-name">${inv.patientName||'-'}</div>
      ${patient?.address?`<div class="to-sub">${patient.address}</div>`:''}
      ${patient?.phone?`<div class="to-sub">โทร. ${patient.phone}</div>`:''}
    </div>
    ${inv.jobName?`<div class="to-box" style="flex:1;"><div class="to-label">ชื่องาน</div><div style="font-weight:600;margin-top:4px;">${inv.jobName}</div></div>`:''}
  </div>

  <table class="items-table">
    <thead><tr>
      <th style="width:36px;text-align:center;">#</th>
      <th style="text-align:left;">รายละเอียด</th>
      <th style="text-align:center;width:100px;">จำนวน</th>
      <th style="text-align:right;width:110px;">ราคาต่อหน่วย</th>
      <th style="text-align:right;width:110px;">มูลค่า</th>
    </tr></thead>
    <tbody>${rowsHtml||'<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">ไม่มีรายการ</td></tr>'}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="tot-row"><span>รวมเป็นเงิน</span><span>${formatThb(inv.subtotal||0)}</span></div>
      ${(inv.vatRate||0)>0?`<div class="tot-row"><span>ภาษีมูลค่าเพิ่ม ${inv.vatRate}%</span><span>${formatThb(inv.vatAmt||0)}</span></div>`:''}
      <div class="tot-row sep grand"><span>จำนวนเงินรวมทั้งสิ้น</span><span>${formatThb(inv.beforeWht||inv.grandTotal||0)}</span></div>
      ${(inv.whtRate||0)>0?`<div class="tot-row"><span style="color:#c0392b;">หัก ณ ที่จ่าย ${inv.whtRate}%</span><span style="color:#c0392b;">${formatThb(inv.whtAmt||0)}</span></div>`:''}
      <div class="tot-row net"><span>ยอดชำระ</span><span>${formatThb(inv.grandTotal||0)}</span></div>
    </div>
  </div>
  <div class="amount-words">(${thaiNum(inv.grandTotal||0)})</div>

  ${inv.note?`<div class="note-box"><strong>หมายเหตุ:</strong> ${inv.note}</div>`:''}

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line"><div class="sign-name">( ผู้รับวางบิล )</div><div class="sign-date">วันที่ ................................</div></div></div>
    <div style="text-align:center;padding-bottom:4px;"><div style="font-size:10px;color:#bbb;margin-bottom:6px;">ตราประทับ</div><div style="width:74px;height:74px;border:1px dashed #ccc;border-radius:50%;margin:0 auto;"></div></div>
    <div class="sign-box"><div class="sign-line"><div class="sign-name">( ผู้วางบิล )</div><div class="sign-date">วันที่ ................................</div></div></div>
  </div>
  </body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────────────
// ── PRINT: EXPENSE ───────────────────────────────────
// ─────────────────────────────────────────────────────
function printExpense(id) {
  const exp=(db.expenses||[]).find(e=>e.id===id); if(!exp) return;
  const bs=getBillingSettings();
  const PAY_LABELS={cash:'เงินสด',transfer:'โอนเงิน',cheque:'เช็ค'};
  const rowsHtml=(exp.items||[]).map((it,i)=>`<tr>
    <td style="border:1px solid #ddd;padding:7px 10px;">${i+1}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;">${it.desc||''}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;">${it.cat||''}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:center;">${it.qty||1}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;">${(it.price||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
    <td style="border:1px solid #ddd;padding:7px 10px;text-align:right;">${((it.qty||1)*(it.price||0)).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
  </tr>`).join('');

  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><title>บันทึกค่าใช้จ่าย ${exp.docNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#222;background:#fff;padding:28px;max-width:820px;margin:0 auto;}
    .print-btn{position:fixed;top:12px;right:12px;background:#5a9e7a;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5a9e7a;padding-bottom:16px;margin-bottom:18px;}
    .co-name{font-size:16px;font-weight:700;color:#2d4a38;margin-bottom:4px;}
    .co-sub{font-size:11px;color:#555;line-height:1.7;}
    .doc-box{text-align:right;}
    .doc-title{font-size:22px;font-weight:700;color:#2d4a38;}
    .doc-sub{font-size:11px;color:#777;margin-top:2px;font-style:italic;}
    .meta-table{width:100%;font-size:12px;margin-top:8px;}
    .meta-table td{padding:2px 6px;}
    .items-table{width:100%;border-collapse:collapse;margin:14px 0;}
    .items-table th{background:#2d4a38;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;}
    .items-table td{border:1px solid #ddd;padding:7px 10px;font-size:13px;}
    .items-table tr:nth-child(even) td{background:#fafafa;}
    .totals-wrap{display:flex;justify-content:flex-end;}
    .totals-box{width:280px;}
    .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
    .tot-row.sep{border-top:1px solid #ddd;margin-top:4px;padding-top:8px;}
    .tot-row.net{font-weight:700;font-size:15px;background:#2d4a38;color:#fff;padding:8px 12px;border-radius:6px;margin-top:6px;}
    .pay-section{background:#f8f8f8;border:1px solid #e8e8e8;border-radius:6px;padding:12px 16px;margin-top:16px;font-size:13px;}
    .sign-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:44px;}
    .sign-box{text-align:center;width:180px;}
    .sign-line{border-top:1.5px solid #444;margin-top:56px;padding-top:8px;}
    .sign-name{font-size:12px;color:#333;font-weight:600;margin-bottom:8px;}
    .sign-date{font-size:11px;color:#999;}
    @media print{.print-btn{display:none;}}
  </style>
  </head><body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์</button>
  <div class="header">
    <div>
      <div class="co-name">${bs.company||'นวศรี เนอร์สซิ่งโฮม'}</div>
      <div class="co-sub">
        ${bs.taxId?`เลขประจำตัวผู้เสียภาษี ${bs.taxId}<br>`:''}
        ${bs.phone?`โทร. ${bs.phone}<br>`:''}
        ${bs.email?`อีเมล ${bs.email}`:''}
      </div>
    </div>
    <div class="doc-box">
      <div class="doc-title">บันทึกค่าใช้จ่าย</div>
      <div class="doc-sub">Expense Note</div>
      <table class="meta-table">
        <tr><td style="color:#777;width:80px;">เลขที่</td><td style="font-weight:600;font-family:monospace;">${exp.docNo||'-'}</td></tr>
        <tr><td style="color:#777;">วันที่</td><td style="font-weight:600;">${exp.date||'-'}</td></tr>
        ${exp.preparer?`<tr><td style="color:#777;">ผู้จัดทำ</td><td style="font-weight:600;">${exp.preparer}</td></tr>`:''}
        ${exp.job?`<tr><td style="color:#777;">ชื่องาน</td><td style="font-weight:600;">${exp.job}</td></tr>`:''}
      </table>
    </div>
  </div>

  ${exp.vendorName?`<div style="background:#f8f8f8;border:1px solid #e8e8e8;border-radius:6px;padding:12px 16px;margin-bottom:14px;">
    <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">ผู้จำหน่าย / Vendor</div>
    <div style="font-weight:700;font-size:14px;">${exp.vendorName}</div>
    ${exp.vendorAddr?`<div style="font-size:12px;color:#666;margin-top:2px;">${exp.vendorAddr}</div>`:''}
    ${exp.vendorTaxId?`<div style="font-size:12px;color:#666;">เลขประจำตัวผู้เสียภาษี ${exp.vendorTaxId}</div>`:''}
  </div>`:''}

  <table class="items-table">
    <thead><tr>
      <th style="text-align:center;width:36px;">#</th>
      <th style="text-align:left;">รายละเอียด</th>
      <th style="text-align:left;width:150px;">หมวดหมู่</th>
      <th style="text-align:center;width:60px;">จำนวน</th>
      <th style="text-align:right;width:110px;">ราคาต่อหน่วย</th>
      <th style="text-align:right;width:110px;">ยอดรวม</th>
    </tr></thead>
    <tbody>${rowsHtml||'<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">ไม่มีรายการ</td></tr>'}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="tot-row"><span>ราคาไม่รวม VAT</span><span>${formatThb(exp.subtotal||0)}</span></div>
      <div class="tot-row"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${formatThb(exp.vatAmt||0)}</span></div>
      <div class="tot-row sep" style="font-weight:600;"><span>จำนวนเงินรวมทั้งสิ้น</span><span>${formatThb(exp.totalVat||0)}</span></div>
      ${(exp.whtRate||0)>0?`<div class="tot-row"><span style="color:#c0392b;">หัก ณ ที่จ่าย ${exp.whtRate}%</span><span style="color:#c0392b;">${formatThb(exp.whtAmt||0)}</span></div>`:''}
      <div class="tot-row net"><span>ยอดชำระ</span><span>${formatThb(exp.net||0)}</span></div>
    </div>
  </div>

  <div class="pay-section">
    <strong>รายละเอียดการชำระเงิน:</strong>
    ช่องทาง: ${PAY_LABELS[exp.payMethod]||exp.payMethod||'-'}
    ${exp.bank?` &nbsp;|&nbsp; ธนาคาร: ${exp.bank}`:''}
    ${exp.bankNo?` &nbsp;|&nbsp; เลขที่: ${exp.bankNo}`:''}
    ${exp.payDate?` &nbsp;|&nbsp; วันที่ชำระ: ${exp.payDate}`:''}
    &nbsp;|&nbsp; ยอดชำระ: <strong>${formatThb(exp.net||0)}</strong>
    ${exp.whtAmt>0?` &nbsp;|&nbsp; หัก ณ ที่จ่าย: ${formatThb(exp.whtAmt)}`:''}
  </div>

  ${exp.note?`<div style="margin-top:12px;font-size:12px;color:#666;"><strong>หมายเหตุ:</strong> ${exp.note}</div>`:''}

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line"><div class="sign-name">ผู้รับเงิน</div><div class="sign-date">วันที่ ................................</div></div></div>
    <div class="sign-box"><div class="sign-line">ผู้จัดทำ / วันที่</div></div>
    <div class="sign-box"><div class="sign-line">ผู้อนุมัติ / วันที่</div></div>
  </div>
  </body></html>`);
  w.document.close();
}


// ═══════════════════════════════════════════════════════
// ── INCIDENT & WOUND CARE SYSTEM ────────────────────────
// ═══════════════════════════════════════════════════════

function switchIncidentTab(tab) {
  document.getElementById('incident-tab-incidents').style.display = tab==='incidents' ? '' : 'none';
  document.getElementById('incident-tab-wounds').style.display = tab==='wounds' ? '' : 'none';
  document.querySelectorAll('#incident-tabs .tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&tab==='incidents')||(i===1&&tab==='wounds'));
  });
}

function openIncidentModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('incident-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('incident-edit-id').value = id||'';
  document.getElementById('modal-incident-title').textContent = id ? '✏️ แก้ไขรายงานอุบัติเหตุ' : '⚠️ บันทึกอุบัติเหตุ / ความเสี่ยง';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0,5);
  if (id) {
    const inc = (db.incidents||[]).find(x=>x.id==id);
    if (inc) {
      document.getElementById('incident-patient').value = inc.patientId;
      document.getElementById('incident-type').value = inc.type;
      document.getElementById('incident-date').value = inc.date;
      document.getElementById('incident-time').value = inc.time||'';
      document.getElementById('incident-location').value = inc.location||'';
      document.getElementById('incident-detail').value = inc.detail||'';
      document.getElementById('incident-firstaid').value = inc.firstAid||'';
      document.getElementById('incident-severity').value = inc.severity||'เล็กน้อย';
      document.getElementById('incident-recorder').value = inc.recorder||'';
      document.getElementById('incident-notified').value = inc.notified||'ยังไม่แจ้ง';
    }
  } else {
    document.getElementById('incident-date').value = today;
    document.getElementById('incident-time').value = now;
    document.getElementById('incident-detail').value = '';
    document.getElementById('incident-firstaid').value = '';
    document.getElementById('incident-location').value = '';
    document.getElementById('incident-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-incident');
}

async function saveIncident() {
  const patientId = document.getElementById('incident-patient').value;
  const detail = document.getElementById('incident-detail').value.trim();
  if (!patientId||!detail) { toast('กรุณากรอกข้อมูลที่จำเป็น','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    type: document.getElementById('incident-type').value,
    date: document.getElementById('incident-date').value,
    time: document.getElementById('incident-time').value,
    location: document.getElementById('incident-location').value,
    detail, first_aid: document.getElementById('incident-firstaid').value,
    severity: document.getElementById('incident-severity').value,
    recorder: document.getElementById('incident-recorder').value,
    notified: document.getElementById('incident-notified').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('incident-edit-id').value;
  if (editId) {
    if (supa) await supa.from('incident_reports').update(row).eq('id', editId);
    const idx = (db.incidents||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.incidents[idx] = {...db.incidents[idx], ...mapIncident({id:editId,...row})};
  } else {
    if (supa) { const {data} = await supa.from('incident_reports').insert(row).select().single(); if(data){if(!db.incidents)db.incidents=[];db.incidents.unshift(mapIncident(data));} }
    else { if(!db.incidents)db.incidents=[]; db.incidents.unshift(mapIncident({id:Date.now(),...row})); }
  }
  closeModal('modal-incident');
  renderIncidentPage();
  toast('บันทึกรายงานอุบัติเหตุแล้ว','success');
}

function mapIncident(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, type:r.type, date:r.date, time:r.time, location:r.location, detail:r.detail, firstAid:r.first_aid, severity:r.severity, recorder:r.recorder, notified:r.notified };
}

async function deleteIncident(id) {
  if (!confirm('ลบรายงานอุบัติเหตุนี้?')) return;
  if (supa) await supa.from('incident_reports').delete().eq('id', id);
  db.incidents = (db.incidents||[]).filter(x=>x.id!=id);
  renderIncidentPage(); toast('ลบแล้ว','success');
}

function openWoundModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('wound-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('wound-edit-id').value = id||'';
  document.getElementById('modal-wound-title').textContent = id ? '✏️ แก้ไขบันทึกแผล' : '🩹 บันทึกการทำแผล / แผลกดทับ';
  if (id) {
    const w = (db.wounds||[]).find(x=>x.id==id);
    if (w) {
      document.getElementById('wound-patient').value = w.patientId;
      document.getElementById('wound-date').value = w.date;
      document.getElementById('wound-location').value = w.location;
      document.getElementById('wound-stage').value = w.stage;
      document.getElementById('wound-width').value = w.width||'';
      document.getElementById('wound-length').value = w.length||'';
      document.getElementById('wound-depth').value = w.depth||'';
      document.getElementById('wound-appearance').value = w.appearance||'';
      document.getElementById('wound-treatment').value = w.treatment||'';
      document.getElementById('wound-trend').value = w.trend||'คงที่';
      document.getElementById('wound-recorder').value = w.recorder||'';
      document.getElementById('wound-note').value = w.note||'';
    }
  } else {
    document.getElementById('wound-date').value = new Date().toISOString().split('T')[0];
    ['width','length','depth'].forEach(f=>document.getElementById('wound-'+f).value='');
    document.getElementById('wound-appearance').value='';
    document.getElementById('wound-treatment').value='';
    document.getElementById('wound-note').value='';
    document.getElementById('wound-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-wound');
}

async function saveWound() {
  const patientId = document.getElementById('wound-patient').value;
  const location = document.getElementById('wound-location').value;
  if (!patientId||!location) { toast('กรุณาเลือกผู้ป่วยและตำแหน่งแผล','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    date: document.getElementById('wound-date').value,
    location, stage: document.getElementById('wound-stage').value,
    width: parseFloat(document.getElementById('wound-width').value)||0,
    length: parseFloat(document.getElementById('wound-length').value)||0,
    depth: parseFloat(document.getElementById('wound-depth').value)||0,
    appearance: document.getElementById('wound-appearance').value,
    treatment: document.getElementById('wound-treatment').value,
    trend: document.getElementById('wound-trend').value,
    recorder: document.getElementById('wound-recorder').value,
    note: document.getElementById('wound-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('wound-edit-id').value;
  if (editId) {
    if (supa) await supa.from('wound_care_logs').update(row).eq('id', editId);
    const idx = (db.wounds||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.wounds[idx] = {...db.wounds[idx], ...mapWound({id:editId,...row})};
  } else {
    if (supa) { const {data} = await supa.from('wound_care_logs').insert(row).select().single(); if(data){if(!db.wounds)db.wounds=[];db.wounds.unshift(mapWound(data));} }
    else { if(!db.wounds)db.wounds=[]; db.wounds.unshift(mapWound({id:Date.now(),...row})); }
  }
  closeModal('modal-wound');
  renderIncidentPage();
  toast('บันทึกข้อมูลแผลแล้ว','success');
}

function mapWound(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, date:r.date, location:r.location, stage:r.stage, width:r.width, length:r.length, depth:r.depth, appearance:r.appearance, treatment:r.treatment, trend:r.trend, recorder:r.recorder, note:r.note };
}

async function deleteWound(id) {
  if (!confirm('ลบบันทึกแผลนี้?')) return;
  if (supa) await supa.from('wound_care_logs').delete().eq('id', id);
  db.wounds = (db.wounds||[]).filter(x=>x.id!=id);
  renderIncidentPage(); toast('ลบแล้ว','success');
}

function renderIncidentPage() {
  const SEV = {เล็กน้อย:'badge-green',ปานกลาง:'badge-orange',รุนแรง:'badge-red'};
  const TREND = {ดีขึ้น:'📈',คงที่:'➡️',แย่ลง:'📉','ใหม่':'🆕'};
  const month = document.getElementById('incident-filter-month')?.value||'';
  const incidents = (db.incidents||[]).filter(x=>!month||x.date?.startsWith(month));
  const wounds = (db.wounds||[]).filter(x=>!month||x.date?.startsWith(month));

  const incTb = document.getElementById('incident-table-body');
  if (incTb) incTb.innerHTML = incidents.length ? incidents.map(x=>`<tr>
    <td><div style="font-weight:600;">${x.date||''}</div><div style="font-size:11px;color:var(--text2);">${x.time||''}</div></td>
    <td>${x.patientName||''}</td>
    <td><span class="badge badge-orange">${x.type||''}</span></td>
    <td style="font-size:12px;">${x.location||'-'}</td>
    <td style="font-size:12px;max-width:200px;">${x.detail||''}</td>
    <td style="font-size:12px;max-width:150px;">${x.firstAid||'-'}</td>
    <td style="font-size:12px;">${x.recorder||'-'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openIncidentModal(${x.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteIncident(${x.id})">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="8"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">ยังไม่มีรายงานอุบัติเหตุ</div></div></td></tr>`;

  const woundTb = document.getElementById('wound-table-body');
  if (woundTb) woundTb.innerHTML = wounds.length ? wounds.map(x=>`<tr>
    <td>${x.date||''}</td>
    <td>${x.patientName||''}</td>
    <td>${x.location||''}</td>
    <td><span class="badge ${x.stage?.includes('4')?'badge-red':x.stage?.includes('3')?'badge-orange':'badge-blue'}">${x.stage||''}</span></td>
    <td style="font-size:12px;">${x.width||0}×${x.length||0}×${x.depth||0}</td>
    <td style="font-size:12px;">${x.appearance||'-'}</td>
    <td style="font-size:12px;max-width:160px;">${x.treatment||'-'}</td>
    <td style="font-size:12px;">${x.recorder||'-'} ${TREND[x.trend]||''}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openWoundModal(${x.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteWound(${x.id})">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🩹</div><div class="empty-text">ยังไม่มีบันทึกแผลกดทับ</div></div></td></tr>`;
}

// ═══════════════════════════════════════════════════════
// ── DIETARY & TUBE FEEDING SYSTEM ───────────────────────
// ═══════════════════════════════════════════════════════

function switchDietTab(tab) {
  document.getElementById('diet-tab-diets').style.display = tab==='diets' ? '' : 'none';
  document.getElementById('diet-tab-tubefeed').style.display = tab==='tubefeed' ? '' : 'none';
  document.querySelectorAll('#page-dietary .tabs .tab').forEach((t,i)=>{
    t.classList.toggle('active',(i===0&&tab==='diets')||(i===1&&tab==='tubefeed'));
  });
  if (tab==='tubefeed') renderTubeFeedTable();
}

function openDietModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('diet-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('diet-edit-id').value = id||'';
  document.getElementById('modal-diet-title').textContent = id ? '✏️ แก้ไขแผนอาหาร' : '🍽️ กำหนดแผนอาหารผู้ป่วย';
  // reset checkboxes
  document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]').forEach(cb=>cb.checked=false);
  if (id) {
    const d = (db.diets||[]).find(x=>x.id==id);
    if (d) {
      document.getElementById('diet-patient').value = d.patientId;
      document.getElementById('diet-type').value = d.dietType;
      document.getElementById('diet-meals').value = d.meals||'3 มื้อ';
      document.getElementById('diet-note').value = d.note||'';
      const restrictions = d.restrictions||[];
      document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]').forEach(cb=>{
        if(restrictions.includes(cb.value)) cb.checked=true;
      });
    }
  } else {
    document.getElementById('diet-note').value='';
  }
  openModal('modal-diet');
}

async function saveDiet() {
  const patientId = document.getElementById('diet-patient').value;
  const dietType = document.getElementById('diet-type').value;
  if (!patientId) { toast('กรุณาเลือกผู้ป่วย','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const restrictions = [...document.querySelectorAll('#diet-restrictions-wrap input[type=checkbox]:checked')].map(cb=>cb.value);
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    diet_type: dietType, meals: document.getElementById('diet-meals').value,
    restrictions: JSON.stringify(restrictions),
    note: document.getElementById('diet-note').value,
    updated_at: new Date().toISOString()
  };
  const editId = document.getElementById('diet-edit-id').value;
  if (editId) {
    if (supa) await supa.from('patient_diets').update(row).eq('id', editId);
    const idx = (db.diets||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.diets[idx] = mapDiet({id:editId,...row});
  } else {
    row.created_at = new Date().toISOString();
    if (supa) { const {data} = await supa.from('patient_diets').insert(row).select().single(); if(data){if(!db.diets)db.diets=[];db.diets.unshift(mapDiet(data));} }
    else { if(!db.diets)db.diets=[]; db.diets.unshift(mapDiet({id:Date.now(),...row})); }
  }
  closeModal('modal-diet');
  renderDietaryPage();
  toast('บันทึกแผนอาหารแล้ว','success');
}

function mapDiet(r) {
  let restrictions = [];
  try { restrictions = typeof r.restrictions==='string' ? JSON.parse(r.restrictions) : (r.restrictions||[]); } catch(e){}
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, dietType:r.diet_type, meals:r.meals, restrictions, note:r.note, updatedAt:r.updated_at };
}

async function deleteDiet(id) {
  if (!confirm('ลบแผนอาหารนี้?')) return;
  if (supa) await supa.from('patient_diets').delete().eq('id', id);
  db.diets = (db.diets||[]).filter(x=>x.id!=id);
  renderDietaryPage(); toast('ลบแล้ว','success');
}

function openTubeFeedModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('tubefeed-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('tubefeed-edit-id').value = id||'';
  document.getElementById('modal-tubefeed-title').textContent = id ? '✏️ แก้ไขบันทึก' : '🧪 บันทึกการให้อาหารทางสายยาง';
  if (id) {
    const t = (db.tubeFeeds||[]).find(x=>x.id==id);
    if (t) {
      document.getElementById('tubefeed-patient').value = t.patientId;
      document.getElementById('tubefeed-date').value = t.date;
      document.getElementById('tubefeed-time').value = t.time||'';
      document.getElementById('tubefeed-meal').value = t.meal||'เช้า';
      document.getElementById('tubefeed-formula').value = t.formula||'';
      document.getElementById('tubefeed-volume').value = t.volume||'';
      document.getElementById('tubefeed-water').value = t.water||'';
      document.getElementById('tubefeed-residual').value = t.residual||'';
      document.getElementById('tubefeed-recorder').value = t.recorder||'';
      document.getElementById('tubefeed-note').value = t.note||'';
    }
  } else {
    const now = new Date();
    document.getElementById('tubefeed-date').value = now.toISOString().split('T')[0];
    document.getElementById('tubefeed-time').value = now.toTimeString().slice(0,5);
    ['formula','volume','water','residual','note'].forEach(f=>document.getElementById('tubefeed-'+f).value='');
    document.getElementById('tubefeed-recorder').value = db.currentUser?.name||'';
  }
  openModal('modal-tubefeed');
}

async function saveTubeFeed() {
  const patientId = document.getElementById('tubefeed-patient').value;
  if (!patientId) { toast('กรุณาเลือกผู้ป่วย','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    date: document.getElementById('tubefeed-date').value,
    time: document.getElementById('tubefeed-time').value,
    meal: document.getElementById('tubefeed-meal').value,
    formula: document.getElementById('tubefeed-formula').value,
    volume: parseFloat(document.getElementById('tubefeed-volume').value)||0,
    water: parseFloat(document.getElementById('tubefeed-water').value)||0,
    residual: parseFloat(document.getElementById('tubefeed-residual').value)||0,
    recorder: document.getElementById('tubefeed-recorder').value,
    note: document.getElementById('tubefeed-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('tubefeed-edit-id').value;
  if (editId) {
    if (supa) await supa.from('tube_feeding_logs').update(row).eq('id', editId);
    const idx = (db.tubeFeeds||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.tubeFeeds[idx] = mapTubeFeed({id:editId,...row});
  } else {
    if (supa) { const {data} = await supa.from('tube_feeding_logs').insert(row).select().single(); if(data){if(!db.tubeFeeds)db.tubeFeeds=[];db.tubeFeeds.unshift(mapTubeFeed(data));} }
    else { if(!db.tubeFeeds)db.tubeFeeds=[]; db.tubeFeeds.unshift(mapTubeFeed({id:Date.now(),...row})); }
  }
  closeModal('modal-tubefeed');
  renderTubeFeedTable();
  toast('บันทึกการให้อาหารทางสายแล้ว','success');
}

function mapTubeFeed(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, date:r.date, time:r.time, meal:r.meal, formula:r.formula, volume:r.volume, water:r.water, residual:r.residual, recorder:r.recorder, note:r.note };
}

async function deleteTubeFeed(id) {
  if (!confirm('ลบบันทึกนี้?')) return;
  if (supa) await supa.from('tube_feeding_logs').delete().eq('id', id);
  db.tubeFeeds = (db.tubeFeeds||[]).filter(x=>x.id!=id);
  renderTubeFeedTable(); toast('ลบแล้ว','success');
}

function renderDietaryPage() {
  // populate filter dropdown
  const sel = document.getElementById('tubefeed-filter-patient');
  if (sel) {
    const patients = (db.patients||[]).filter(p=>p.status==='active');
    sel.innerHTML = '<option value="">— เลือกผู้ป่วย —</option>' + patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  }
  const DIET_LABELS = {'ธรรมดา':'🍚','สับละเอียด':'🔪','ปั่นละเอียด':'🥣','อาหารเหลวใส':'🫗','สายยาง (Tube Feed)':'🧪'};
  const tb = document.getElementById('diet-table-body');
  const diets = db.diets||[];
  if (tb) tb.innerHTML = diets.length ? diets.map(d=>`<tr>
    <td style="font-weight:600;">${d.patientName||''}</td>
    <td>${DIET_LABELS[d.dietType]||''} ${d.dietType||''}</td>
    <td style="font-size:12px;">${(d.restrictions||[]).join(', ')||'—'}</td>
    <td>${d.meals||'3 มื้อ'}</td>
    <td style="font-size:12px;">${d.note||'—'}</td>
    <td style="font-size:11px;color:var(--text2);">${(d.updatedAt||'').slice(0,10)}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openDietModal(${d.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDiet(${d.id})">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">🍽️</div><div class="empty-text">ยังไม่มีแผนอาหาร</div></div></td></tr>`;
}

function renderTubeFeedTable() {
  const patientId = document.getElementById('tubefeed-filter-patient')?.value||'';
  const date = document.getElementById('tubefeed-filter-date')?.value||'';
  let feeds = (db.tubeFeeds||[]);
  if (patientId) feeds = feeds.filter(x=>String(x.patientId)===String(patientId));
  if (date) feeds = feeds.filter(x=>x.date===date);
  const tb = document.getElementById('tubefeed-table-body');
  if (tb) tb.innerHTML = feeds.length ? feeds.map(x=>`<tr>
    <td><div style="font-weight:600;">${x.date||''}</div><div style="font-size:11px;color:var(--text2);">${x.time||''} ${x.meal||''}</div></td>
    <td>${x.patientName||''}</td>
    <td style="font-size:12px;">${x.formula||'—'}</td>
    <td style="text-align:center;">${x.volume||0}</td>
    <td style="text-align:center;">${x.water||0}</td>
    <td style="text-align:center;${(x.residual||0)>150?'color:var(--red);font-weight:700;':''}">${x.residual||0}</td>
    <td style="font-size:12px;">${x.recorder||'—'}</td>
    <td style="font-size:12px;">${x.note||'—'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openTubeFeedModal(${x.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteTubeFeed(${x.id})">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🧪</div><div class="empty-text">ยังไม่มีบันทึก</div></div></td></tr>`;
}

function printDietaryReport() {
  const diets = db.diets||[];
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบจัดอาหารประจำวัน</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;padding:24px;}
  h1{font-size:18px;color:#2d4a38;margin-bottom:4px;}h2{font-size:12px;color:#888;margin-bottom:16px;font-weight:400;}
  table{width:100%;border-collapse:collapse;}th{background:#2d4a38;color:#fff;padding:8px 10px;font-size:12px;}
  td{border:1px solid #ddd;padding:7px 10px;}.print-btn{position:fixed;top:12px;right:12px;background:#5a9e7a;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;}
  @media print{.print-btn{display:none;}}</style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์</button>
  <h1>🍽️ ใบจัดอาหารประจำวัน — นวศรี เนอร์สซิ่งโฮม</h1>
  <h2>วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</h2>
  <table><thead><tr><th>#</th><th>ผู้ป่วย</th><th>ประเภทอาหาร</th><th>มื้อ</th><th>ข้อจำกัด</th><th>หมายเหตุ</th></tr></thead><tbody>
  ${diets.map((d,i)=>`<tr><td style="text-align:center;">${i+1}</td><td style="font-weight:600;">${d.patientName||''}</td><td>${d.dietType||''}</td><td>${d.meals||'3 มื้อ'}</td><td>${(d.restrictions||[]).join(', ')||'—'}</td><td>${d.note||'—'}</td></tr>`).join('')}
  </tbody></table></body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════
// ── DEPOSITS SYSTEM ─────────────────────────────────────
// ═══════════════════════════════════════════════════════

function openDepositModal(id) {
  const patients = (db.patients||[]).filter(p=>p.status==='active');
  document.getElementById('deposit-patient').innerHTML = patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('deposit-edit-id').value = id||'';
  document.getElementById('modal-deposit-title').textContent = id ? '✏️ แก้ไขรายการมัดจำ' : '🏦 บันทึกเงินมัดจำ / เงินประกัน';
  if (id) {
    const dep = (db.deposits||[]).find(x=>x.id==id);
    if (dep) {
      document.getElementById('deposit-patient').value = dep.patientId;
      document.getElementById('deposit-type').value = dep.type;
      document.getElementById('deposit-amount').value = dep.amount;
      document.getElementById('deposit-date-in').value = dep.dateIn;
      document.getElementById('deposit-pay-method').value = dep.payMethod;
      document.getElementById('deposit-status').value = dep.status;
      document.getElementById('deposit-date-out').value = dep.dateOut||'';
      document.getElementById('deposit-note').value = dep.note||'';
    }
  } else {
    document.getElementById('deposit-date-in').value = new Date().toISOString().split('T')[0];
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-date-out').value = '';
    document.getElementById('deposit-note').value = '';
    document.getElementById('deposit-status').value = 'active';
  }
  document.getElementById('deposit-return-group').style.display = document.getElementById('deposit-status').value!=='active' ? '' : 'none';
  document.getElementById('deposit-status').onchange = function(){ document.getElementById('deposit-return-group').style.display = this.value!=='active'?'':'none'; };
  openModal('modal-deposit');
}

async function saveDeposit() {
  const patientId = document.getElementById('deposit-patient').value;
  const amount = parseFloat(document.getElementById('deposit-amount').value)||0;
  if (!patientId||!amount) { toast('กรุณากรอกข้อมูลที่จำเป็น','error'); return; }
  const patient = (db.patients||[]).find(p=>String(p.id)===String(patientId));
  const row = {
    patient_id: patientId, patient_name: patient?.name||'',
    type: document.getElementById('deposit-type').value,
    amount, date_in: document.getElementById('deposit-date-in').value,
    pay_method: document.getElementById('deposit-pay-method').value,
    status: document.getElementById('deposit-status').value,
    date_out: document.getElementById('deposit-date-out').value||null,
    note: document.getElementById('deposit-note').value,
    created_at: new Date().toISOString()
  };
  const editId = document.getElementById('deposit-edit-id').value;
  if (editId) {
    if (supa) await supa.from('patient_deposits').update(row).eq('id', editId);
    const idx = (db.deposits||[]).findIndex(x=>x.id==editId);
    if (idx>=0) db.deposits[idx] = mapDeposit({id:editId,...row});
  } else {
    if (supa) { const {data} = await supa.from('patient_deposits').insert(row).select().single(); if(data){if(!db.deposits)db.deposits=[];db.deposits.unshift(mapDeposit(data));} }
    else { if(!db.deposits)db.deposits=[]; db.deposits.unshift(mapDeposit({id:Date.now(),...row})); }
  }
  closeModal('modal-deposit');
  renderDeposits();
  toast('บันทึกเงินมัดจำแล้ว','success');
}

function mapDeposit(r) {
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, type:r.type, amount:r.amount, dateIn:r.date_in, payMethod:r.pay_method, status:r.status, dateOut:r.date_out, note:r.note };
}

async function deleteDeposit(id) {
  if (!confirm('ลบรายการมัดจำนี้?')) return;
  if (supa) await supa.from('patient_deposits').delete().eq('id', id);
  db.deposits = (db.deposits||[]).filter(x=>x.id!=id);
  renderDeposits(); toast('ลบแล้ว','success');
}

function renderDeposits() {
  const search = (document.getElementById('deposit-search')?.value||'').toLowerCase();
  const statusFilter = document.getElementById('deposit-filter-status')?.value||'';
  let deps = (db.deposits||[]).filter(d=>{
    const matchSearch = !search || (d.patientName||'').toLowerCase().includes(search);
    const matchStatus = !statusFilter || d.status===statusFilter;
    return matchSearch && matchStatus;
  });
  const total = (db.deposits||[]).reduce((s,d)=>s+d.amount,0);
  const active = (db.deposits||[]).filter(d=>d.status==='active').reduce((s,d)=>s+d.amount,0);
  const done = (db.deposits||[]).filter(d=>d.status!=='active').reduce((s,d)=>s+d.amount,0);
  const fmt = v=>'฿'+v.toLocaleString('th-TH',{minimumFractionDigits:0});
  document.getElementById('dep-stat-total').textContent = fmt(total);
  document.getElementById('dep-stat-active').textContent = fmt(active);
  document.getElementById('dep-stat-done').textContent = fmt(done);
  const STATUS_BADGE = {active:'badge-blue',refunded:'badge-green',deducted:'badge-orange'};
  const STATUS_LABEL = {active:'💼 ถือครอง',refunded:'✅ คืนแล้ว',deducted:'🔄 หักชำระ'};
  const tb = document.getElementById('deposit-table-body');
  if (tb) tb.innerHTML = deps.length ? deps.map(d=>`<tr>
    <td style="font-weight:600;">${d.patientName||''}</td>
    <td style="font-size:12px;">${d.type||''}</td>
    <td style="font-weight:700;color:var(--green);">${fmt(d.amount||0)}</td>
    <td>${d.dateIn||''}</td>
    <td style="font-size:12px;">${d.payMethod||''}</td>
    <td><span class="badge ${STATUS_BADGE[d.status]||'badge-gray'}">${STATUS_LABEL[d.status]||d.status}</span></td>
    <td style="font-size:12px;">${d.dateOut||'—'}</td>
    <td style="font-size:12px;max-width:150px;">${d.note||'—'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openDepositModal(${d.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDeposit(${d.id})">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🏦</div><div class="empty-text">ยังไม่มีรายการมัดจำ</div></div></td></tr>`;
}

// ═══════════════════════════════════════════════════════
// ── HOOK INTO showPage & loadData ───────────────────────
// ═══════════════════════════════════════════════════════

// Patch renderPage to handle new pages
// Hook new pages into existing renderPage
const _renderPageOrig = renderPage;
renderPage = function(page) {
  _renderPageOrig(page);
  if (page==='incident') {
    const el = document.getElementById('incident-filter-month');
    if (el && !el.value) el.value = new Date().toISOString().slice(0,7);
    renderIncidentPage();
  } else if (page==='dietary') {
    renderDietaryPage();
  } else if (page==='deposits') {
    renderDeposits();
  }
};

// Add new page titles to existing showPage titles object

// Load new tables from Supabase on init
const _origLoadData = typeof loadData==='function' ? loadData : null;
async function loadNewTables() {
  if (!supa) return;
  try {
    const [inc, wnd, diets, feeds, deps] = await Promise.all([
      supa.from('incident_reports').select('*').order('date',{ascending:false}),
      supa.from('wound_care_logs').select('*').order('date',{ascending:false}),
      supa.from('patient_diets').select('*').order('updated_at',{ascending:false}),
      supa.from('tube_feeding_logs').select('*').order('date',{ascending:false}),
      supa.from('patient_deposits').select('*').order('date_in',{ascending:false}),
    ]);
    db.incidents = (inc.data||[]).map(mapIncident);
    db.wounds = (wnd.data||[]).map(mapWound);
    db.diets = (diets.data||[]).map(mapDiet);
    db.tubeFeeds = (feeds.data||[]).map(mapTubeFeed);
    db.deposits = (deps.data||[]).map(mapDeposit);
  } catch(e) {
    db.incidents=[]; db.wounds=[]; db.diets=[]; db.tubeFeeds=[]; db.deposits=[];
  }
}
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(loadNewTables, 2000); });

</script>