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
     <div>สถานะปัจจุบัน: <strong style="color:var(--red);">${STATUS_LABELS[dynStatus]||dynStatus}</strong></div>
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
      <td style="padding:9px 12px;"><span style="color:var(--red);font-weight:600;">${STATUS_LABELS[l.old_status]||l.old_status||'-'}</span></td>
      <td style="padding:9px 12px;"><span style="color:#5ecba1;font-weight:600;">${STATUS_LABELS[l.new_status]||l.new_status||'-'}</span></td>
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
  const STATUS_COLORS = { draft:'#888', sent:'#f5a453', partial:'var(--blue)', paid:'#5ecba1', cancelled:'var(--red)' };
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
    <tr style="${isOverdue?'background:var(--red-light);':''}">
      <td style="font-family:monospace;font-size:12px;">${inv.docNo||'-'}${inv.contractId?'<span style="font-size:10px;color:var(--accent);margin-left:4px;">🤖</span>':''}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(46,196,182,0.12);color:var(--accent);">${TYPE_LABELS[inv.type]||inv.type}</span></td>
      <td>${inv.patientName||'-'}</td>
      <td style="font-size:12px;">${inv.date||'-'}</td>
      <td style="font-size:12px;color:${isOverdue?'var(--red)':'var(--text2)'};">${inv.dueDate||'-'}${isOverdue?' ⚠️':''}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(inv.grandTotal||0)}</td>
      <td style="text-align:right;color:#5ecba1;">${paid>0?formatThb(paid):'-'}</td>
      <td style="text-align:right;font-weight:${balance>0?'700':'400'};color:${balance>0?'#f5a453':'var(--text3)'};">${balance>0?formatThb(balance):'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${STATUS_COLORS[dynStatus]||'#888'}22;color:${STATUS_COLORS[dynStatus]||'#888'};">${STATUS_LABELS[dynStatus]||dynStatus}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${inv.id}','invoice')" title="ดู Preview">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="printInvoice('${inv.id}')" title="พิมพ์">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="exportInvoicePDF('${inv.id}')" title="Export PDF" style="color:var(--red);">📄</button>
        <button class="btn btn-ghost btn-sm" onclick="editInvoice('${inv.id}')" title="แก้ไข">✏️</button>
        ${dynStatus!=='paid'?`<button class="btn btn-primary btn-sm" onclick="openRecordPaymentModal('${inv.id}')" title="รับชำระ" style="font-size:11px;">💳 รับชำระ</button>`:''}
        ${['admin','manager','officer'].includes(currentUser?.role) && (dynStatus==='paid'||dynStatus==='partial') ? `<button class="btn btn-ghost btn-sm" onclick="openInvoiceResetModal('${inv.id}')" title="Reset บิล" style="color:#8e44ad;font-size:11px;">🔄 Reset</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteInvoice('${inv.id}')" style="color:var(--red);">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  const expRows = [...expList].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(exp => `
    <tr>
      <td style="font-family:monospace;font-size:12px;">${exp.docNo||'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#f5a45322;color:#f5a453;">ค่าใช้จ่าย</span></td>
      <td style="font-size:13px;">${exp.vendorName||exp.job||'-'}</td>
      <td style="font-size:12px;">${exp.date||'-'}</td>
      <td style="font-size:12px;color:var(--text2);">${exp.payDate||'-'}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(exp.net||0)}</td>
      <td>-</td><td>-</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#5ecba122;color:#5ecba1;">บันทึกแล้ว</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${exp.id}','expense')" title="ดู Preview">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="printExpense('${exp.id}')" title="พิมพ์">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="exportExpensePDF('${exp.id}')" title="Export PDF" style="color:var(--red);">📄</button>
        <button class="btn btn-ghost btn-sm" onclick="editExpense('${exp.id}')" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteExpense('${exp.id}')" style="color:var(--red);">🗑️</button>
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
  // Phase 0: รองรับทั้ง schema ใหม่ (lines[]) และเก่า (items jsonb / flat itemId)
  reqs.forEach(req => {
    const lines = (req.lines && req.lines.length > 0) ? req.lines :
                  (req.items && req.items.length > 0) ? req.items :
                  (req.itemId ? [{ itemId: req.itemId, name: req.itemName, qty: req.qty||1, unit: req.unit }] : []);
    lines.forEach(ri => {
      const iid = ri.itemId || ri.item_id;
      const item = db.items.find(it=>String(it.id)===String(iid));
      // กรองเฉพาะ Billable items
      if (item && item.isBillable === false) return;
      const key  = iid || ri.name || ri.itemName;
      if (!key) return;
      const price= item ? (item.price||item.cost||0) : 0;
      const unit = item?.dispenseUnit || item?.unit || ri.unit || '';
      if (!itemMap[key]) itemMap[key] = { name: ri.name||ri.itemName||item?.name||key, qty:0, price, unit };
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
    <td><button onclick="removeInvItem('${it._idx}')" style="border:none;background:none;cursor:pointer;color:var(--red);font-size:13px;">✕</button></td>
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
      <td><button onclick="removeOtherItem(${idx})" style="border:none;background:none;cursor:pointer;color:var(--red);font-size:13px;">✕</button></td>
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
      <span style="color:#5ecba1;">ชำระแล้ว: <strong>${formatThb(paid)}</strong></span>
      <span style="color:#f5a453;">คงค้าง: <strong>${formatThb(balance)}</strong></span>
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
      <div style="background:#e0f7ec;border:1px solid #5ecba1;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#5ecba1;margin-bottom:4px;">รับชำระรวมทั้งหมด</div>
        <div style="font-size:18px;font-weight:700;color:#5ecba1;">${formatThb(totalReceived)}</div>
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
                <td style="text-align:right;font-weight:700;color:#5ecba1;">${formatThb(p.amount)}</td>
                <td><span style="background:var(--surface2);border-radius:4px;padding:2px 8px;font-size:12px;">${p.method}</span></td>
                <td style="font-size:12px;color:var(--text3);">${p.reference||'-'}</td>
                <td style="font-size:12px;">${p.receivedBy||'-'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="printReceiptById('${p.id}')" title="พิมพ์ใบเสร็จ">🖨️</button>
                  <button class="btn btn-ghost btn-sm" onclick="deletePayment('${p.id}')" style="color:var(--red);">🗑️</button>
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
                <span style="font-size:11px;color:${daysUntil<=3?'var(--red)':daysUntil<=7?'#f5a453':'var(--text3)'};">
                  (${daysUntil<=0?'ถึงกำหนดแล้ว!':daysUntil+' วัน'})
                </span>
              </td>
              <td style="white-space:nowrap;">
                <button class="btn btn-primary btn-sm" onclick="generateContractInvoice('${c.id}')">🧾 ออกบิล</button>
                <button class="btn btn-ghost btn-sm" onclick="openAddContractModal('${c.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteContract('${c.id}')" style="color:var(--red);">🗑️</button>
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
      body { font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;color:#1e2533;padding:24px; }
      .logo { font-size:18px;font-weight:700;color:#1e2533;text-align:center;margin-bottom:4px; }
      .center { text-align:center; }
      .divider { border:none;border-top:1px dashed #ccc;margin:12px 0; }
      .row { display:flex;justify-content:space-between;padding:3px 0;font-size:13px; }
      .total-row { display:flex;justify-content:space-between;padding:6px 0;font-size:16px;font-weight:700;color:#1e2533; }
      .badge { background:#e0f7ec;border:1px solid #5ecba1;border-radius:6px;padding:6px 12px;text-align:center;margin:12px 0;color:#5ecba1;font-weight:700; }
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
  // inject scan button
  setTimeout(() => {
    if (!document.getElementById('scan-expense-btn')) {
      const hdr = document.querySelector('#modal-expense .modal-header');
      if (hdr) {
        const btn = document.createElement('button');
        btn.id = 'scan-expense-btn';
        btn.className = 'btn btn-ghost btn-sm';
        btn.style.cssText = 'margin-right:8px;font-size:13px;display:flex;align-items:center;';
        btn.innerHTML = '📷 สแกนบิล';
        btn.onclick = function() { scanExpense(); };
        hdr.insertBefore(btn, hdr.querySelector('.modal-close'));
      }
    }
  }, 50);
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
      <td><button onclick="removeExpItem(${idx})" style="border:none;background:none;cursor:pointer;color:var(--red);font-size:13px;">✕</button></td>
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

  if(document.getElementById('expv-subtotal'))  document.getElementById('expv-subtotal').textContent  = formatThb(beforeVat);
  if(document.getElementById('exp-vat'))       document.getElementById('exp-vat').textContent       = formatThb(vatIncluded);
  if(document.getElementById('exp-total-vat')) document.getElementById('exp-total-vat').textContent = formatThb(subtotal);
  if(document.getElementById('exp-wht'))       document.getElementById('exp-wht').textContent       = formatThb(whtAmt);
  if(document.getElementById('expv-net'))       document.getElementById('expv-net').textContent       = formatThb(net);
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
    invoice:     {orig:'#1e2533',copy:'#0d6b5c',origL:'#e0f7ec',copyL:'#e0f7ec',origB:'#f4a7b9',copyB:'#f4a7b9'},
    receipt:     {orig:'#0c2840',copy:'#0d6b5c',origL:'var(--blue-light)',copyL:'#e0f7ec',origB:'#7ab8d4',copyB:'#a2d9ce'},
    quotation:   {orig:'#c05500',copy:'#b06500',origL:'#fef0e7',copyL:'#fef9e7',origB:'#f5c842',copyB:'#f5c842'},
    tax_invoice: {orig:'#2d1b5e',copy:'#b39ddb',origL:'#ede9fe',copyL:'#ede9fe',origB:'#b39ddb',copyB:'#b39ddb'},
  };
  const th = THEMES[inv.type] || THEMES.invoice;
  const logoSrc = 'img/logo.png';
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
      <td style="border-bottom:1px solid var(--surface2);padding:8px 11px;text-align:center;color:#999;">${i+1}</td>
      <td style="border-bottom:1px solid var(--surface2);padding:8px 11px;font-weight:500;">${r.name}${r.sub?`<span style="margin-left:6px;font-size:10px;color:#888;font-weight:400;">${r.sub}</span>`:''}</td>
      <td style="border-bottom:1px solid var(--surface2);padding:8px 11px;text-align:center;font-family:monospace;">${r.qty}${r.unit?' '+r.unit:''}</td>
      <td style="border-bottom:1px solid var(--surface2);padding:8px 11px;text-align:right;font-family:monospace;">${(r.price||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
      <td style="border-bottom:1px solid var(--surface2);padding:8px 11px;text-align:right;font-family:monospace;font-weight:700;">${(r.total||0).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="padding:16px;text-align:center;color:#999;">ไม่มีรายการ</td></tr>`;

    const vatLine = (inv.vatRate||0)>0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:${c}">VAT ${inv.vatRate}%</span><span style="font-family:monospace">${formatThb(inv.vatAmt||0)}</span></div>` : '';
    const whtLine = (inv.whtRate||0)>0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--red)">หัก ณ ที่จ่าย ${inv.whtRate}%</span><span style="font-family:monospace;color:var(--red)">-${formatThb(inv.whtAmt||0)}</span></div>` : '';
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
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2ec4b6;padding-bottom:14px;margin-bottom:16px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#1e2533;">${bs.company||'นวศรี เนอร์สซิ่งโฮม'}</div>
        <div style="font-size:11px;color:#555;line-height:1.7;margin-top:4px;">
          ${bs.taxId?`เลขประจำตัวผู้เสียภาษี ${bs.taxId}<br>`:''}
          ${bs.phone?`โทร. ${bs.phone}<br>`:''}${bs.email?`อีเมล ${bs.email}`:''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:#1e2533;">บันทึกค่าใช้จ่าย</div>
        <div style="font-size:11px;color:#777;font-style:italic;">Expense Note</div>
        <table style="margin-top:6px;font-size:12px;border-collapse:collapse;">
          <tr><td style="color:#777;padding:2px 8px;">เลขที่</td><td style="font-weight:600;font-family:monospace;">${exp.docNo||'-'}</td></tr>
          <tr><td style="color:#777;padding:2px 8px;">วันที่</td><td style="font-weight:600;">${exp.date||'-'}</td></tr>
          ${exp.preparer?`<tr><td style="color:#777;padding:2px 8px;">ผู้จัดทำ</td><td style="font-weight:600;">${exp.preparer}</td></tr>`:''}
          ${exp.job?`<tr><td style="color:#777;padding:2px 8px;">ชื่องาน</td><td style="font-weight:600;">${exp.job}</td></tr>`:''}
        </table>
      </div>
    </div>

    ${exp.vendorName?`<div style="background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
      <div style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:4px;">ผู้จำหน่าย / Vendor</div>
      <div style="font-weight:700;font-size:14px;">${exp.vendorName}</div>
      ${exp.vendorAddr?`<div style="font-size:11px;color:#666;margin-top:2px;">${exp.vendorAddr}</div>`:''}
      ${exp.vendorTaxId?`<div style="font-size:11px;color:#666;">เลขประจำตัวผู้เสียภาษี ${exp.vendorTaxId}</div>`:''}
    </div>`:''}

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#1e2533;color:white;">
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
        ${(exp.whtRate||0)>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;"><span style="color:var(--red);">หัก ณ ที่จ่าย ${exp.whtRate}%</span><span style="color:var(--red);">${formatThb(exp.whtAmt||0)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;font-size:15px;font-weight:700;background:#1e2533;color:white;border-radius:6px;margin-top:6px;"><span>ยอดชำระ</span><span>${formatThb(exp.net||0)}</span></div>
      </div>
    </div>

    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;font-size:12px;">
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
  // Phase 0: รองรับใบเบิกหลายรายการ — flatten lines
  reqs.forEach(r => {
    const lines = (r.lines && r.lines.length > 0) 
      ? r.lines 
      : [{ itemName: r.itemName||r.name, qty: r.quantity||r.qty||1, unitPrice: r.price||r.unit_price||0, itemId: r.itemId }];
    lines.forEach(l => {
      const key = l.itemName || '';
      if (!key) return;
      const item = (db.items||[]).find(i => i.id == l.itemId || i.name === key);
      const price = l.unitPrice || (item?.price) || (item?.cost) || 0;
      if (!medMap[key]) medMap[key] = { name: key, qty: 0, price: price, category: (item?.category) || getItemCategory(key) };
      medMap[key].qty += (l.qty || 1);
    });
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
    inputEl.style.borderColor = 'var(--red)';
    const warn = document.createElement('div');
    warn.id = warnId;
    warn.style.cssText = 'color:var(--red);font-size:11px;margin-top:3px;';
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
    .print-btn{position:fixed;top:12px;right:12px;background:#2ec4b6;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit;z-index:99;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2ec4b6;padding-bottom:16px;margin-bottom:18px;}
    .co-name{font-size:16px;font-weight:700;color:#1e2533;margin-bottom:4px;}
    .co-sub{font-size:11px;color:#555;line-height:1.7;}
    .doc-box{text-align:right;}
    .doc-title{font-size:22px;font-weight:700;color:#1e2533;}
    .doc-sub{font-size:11px;color:#777;margin-top:2px;font-style:italic;}
    .meta-table{width:100%;font-size:12px;margin-bottom:4px;}
    .meta-table td{padding:2px 6px;}
    .meta-label{color:#777;white-space:nowrap;width:90px;}
    .meta-val{font-weight:600;}
    .to-box{background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:13px;}
    .to-label{font-size:11px;color:#999;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em;}
    .to-name{font-weight:700;font-size:15px;margin-bottom:3px;}
    .to-sub{font-size:11px;color:#666;}
    .items-table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    .items-table th{background:#1e2533;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;}
    .items-table td{border:1px solid #ddd;padding:7px 10px;font-size:13px;vertical-align:top;}
    .items-table tr:nth-child(even) td{background:#f8fafc;}
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:16px;}
    .totals-box{width:300px;}
    .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
    .tot-row.sep{border-top:1px solid #ddd;margin-top:4px;padding-top:8px;}
    .tot-row.grand{font-weight:700;font-size:15px;color:#1e2533;}
    .tot-row.net{font-weight:700;font-size:16px;background:#1e2533;color:#fff;padding:8px 12px;border-radius:6px;margin-top:6px;}
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
      ${(inv.whtRate||0)>0?`<div class="tot-row"><span style="color:var(--red);">หัก ณ ที่จ่าย ${inv.whtRate}%</span><span style="color:var(--red);">${formatThb(inv.whtAmt||0)}</span></div>`:''}
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
    .print-btn{position:fixed;top:12px;right:12px;background:#2ec4b6;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2ec4b6;padding-bottom:16px;margin-bottom:18px;}
    .co-name{font-size:16px;font-weight:700;color:#1e2533;margin-bottom:4px;}
    .co-sub{font-size:11px;color:#555;line-height:1.7;}
    .doc-box{text-align:right;}
    .doc-title{font-size:22px;font-weight:700;color:#1e2533;}
    .doc-sub{font-size:11px;color:#777;margin-top:2px;font-style:italic;}
    .meta-table{width:100%;font-size:12px;margin-top:8px;}
    .meta-table td{padding:2px 6px;}
    .items-table{width:100%;border-collapse:collapse;margin:14px 0;}
    .items-table th{background:#1e2533;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;}
    .items-table td{border:1px solid #ddd;padding:7px 10px;font-size:13px;}
    .items-table tr:nth-child(even) td{background:#f8fafc;}
    .totals-wrap{display:flex;justify-content:flex-end;}
    .totals-box{width:280px;}
    .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
    .tot-row.sep{border-top:1px solid #ddd;margin-top:4px;padding-top:8px;}
    .tot-row.net{font-weight:700;font-size:15px;background:#1e2533;color:#fff;padding:8px 12px;border-radius:6px;margin-top:6px;}
    .pay-section{background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-top:16px;font-size:13px;}
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

  ${exp.vendorName?`<div style="background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-bottom:14px;">
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
      ${(exp.whtRate||0)>0?`<div class="tot-row"><span style="color:var(--red);">หัก ณ ที่จ่าย ${exp.whtRate}%</span><span style="color:var(--red);">${formatThb(exp.whtAmt||0)}</span></div>`:''}
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


// =======================================================
// ── INCIDENT & WOUND CARE SYSTEM ────────────────────────
// =======================================================

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
      <button class="btn btn-ghost btn-sm" onclick="openIncidentModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteIncident('${x.id}')">🗑️</button>
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
      <button class="btn btn-ghost btn-sm" onclick="openWoundModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteWound('${x.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🩹</div><div class="empty-text">ยังไม่มีบันทึกแผลกดทับ</div></div></td></tr>`;
}

// =======================================================
// ── DIETARY & TUBE FEEDING SYSTEM ───────────────────────
// =======================================================

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
    recorder: (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '',
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
  return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, dietType:r.diet_type, meals:r.meals, restrictions, note:r.note, updatedAt:r.updated_at, date:r.date, recorder:r.recorder, calories:r.calories, protein:r.protein };
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
    <td style="font-size:12px;">${d.recorder||'—'}</td>
    <td style="font-size:11px;color:var(--text2);">${(d.updatedAt||'').slice(0,10)}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="openDietModal('${d.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDiet('${d.id}')">🗑️</button>
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
      <button class="btn btn-ghost btn-sm" onclick="openTubeFeedModal('${x.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteTubeFeed('${x.id}')">🗑️</button>
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🧪</div><div class="empty-text">ยังไม่มีบันทึก</div></div></td></tr>`;
}

function printDietaryReport() {
  const diets = db.diets||[];
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบจัดอาหารประจำวัน</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'IBM Plex Sans Thai',sans-serif;font-size:13px;padding:24px;}
  h1{font-size:18px;color:#1e2533;margin-bottom:4px;}h2{font-size:12px;color:#888;margin-bottom:16px;font-weight:400;}
  table{width:100%;border-collapse:collapse;}th{background:#1e2533;color:#fff;padding:8px 10px;font-size:12px;}
  td{border:1px solid #ddd;padding:7px 10px;}.print-btn{position:fixed;top:12px;right:12px;background:#2ec4b6;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;}
  @media print{.print-btn{display:none;}}</style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์</button>
  <h1>🍽️ ใบจัดอาหารประจำวัน — นวศรี เนอร์สซิ่งโฮม</h1>
  <h2>วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</h2>
  <table><thead><tr><th>#</th><th>ผู้ป่วย</th><th>ประเภทอาหาร</th><th>มื้อ</th><th>ข้อจำกัด</th><th>หมายเหตุ</th></tr></thead><tbody>
  ${diets.map((d,i)=>`<tr><td style="text-align:center;">${i+1}</td><td style="font-weight:600;">${d.patientName||''}</td><td>${d.dietType||''}</td><td>${d.meals||'3 มื้อ'}</td><td>${(d.restrictions||[]).join(', ')||'—'}</td><td>${d.note||'—'}</td></tr>`).join('')}
  </tbody></table></body></html>`);
  w.document.close();
}

// =======================================================
// ── DEPOSITS SYSTEM ─────────────────────────────────────
// =======================================================

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
      ${['admin','manager','officer'].includes(currentUser?.role) ? `
      <button class="btn btn-ghost btn-sm" onclick="openDepositModal('${d.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDeposit('${d.id}')">🗑️</button>
      ` : ''}
    </td>
  </tr>`).join('') : `<tr><td colspan="9"><div class="empty"><div class="empty-icon">🏦</div><div class="empty-text">ยังไม่มีรายการมัดจำ</div></div></td></tr>`;
}

// =======================================================
// ── HOOK INTO showPage & loadData ───────────────────────
// =======================================================

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
// loadNewTables ถูกเรียกจาก loadDB ใน db.js แล้ว

// ── Scan Expense ───────────────────────────────────
function scanExpense() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,application/pdf';
  inp.onchange = async function() {
    const file = inp.files[0];
    if (!file) return;
    const btn = document.getElementById('scan-expense-btn');
    if (btn) { btn.innerHTML = '⏳ กำลังอ่าน...'; btn.disabled = true; }
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('อ่านไฟล์ไม่สำเร็จ'));
        r.readAsDataURL(file);
      });
      const mediaType = file.type || 'image/jpeg';
      const resp = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType, mode: 'expense' }),
      });
      const result = await resp.json();
      if (!result.ok || !result.data) {
        toast('อ่านบิลไม่สำเร็จ: ' + (result.error || 'ไม่ทราบสาเหตุ'), 'error'); return;
      }
      const d = result.data;
      if (d.invoice_date) document.getElementById('exp-date').value = d.invoice_date;
      if (d.supplier_name) document.getElementById('exp-vendor-name').value = d.supplier_name;
      if (d.supplier_address) document.getElementById('exp-vendor-addr').value = d.supplier_address;
      if (d.supplier_tax_id) document.getElementById('exp-vendor-taxid').value = d.supplier_tax_id;
      if (d.job_name) document.getElementById('exp-job').value = d.job_name;
      if (d.note) document.getElementById('exp-note').value = d.note;
      if (d.wht_rate != null) document.getElementById('exp-wht-rate').value = d.wht_rate;
      // ใส่รายการสินค้าถ้ามี
      if (d.items && d.items.length > 0) {
        const expItems = d.items.map(it => ({
          name: it.item_name || '',
          qty: it.qty || 1,
          unit: it.unit || '',
          price: it.unit_price || 0,
          total: it.total || 0,
        }));
        document.getElementById('exp-items-data').value = JSON.stringify(expItems);
        renderExpenseItems();
        recalcExpense();
      }
      toast('อ่านบิลเรียบร้อย กรุณาตรวจสอบและแก้ไขก่อนบันทึก', 'success');
    } catch(e) {
      toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    } finally {
      if (btn) { btn.innerHTML = '📷 สแกนบิล'; btn.disabled = false; }
    }
  };
  inp.click();
}