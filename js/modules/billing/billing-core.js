// ===== BILLING: CORE (Invoice + Payment) =====

// =====================================================
// ===== BILLING / ACCOUNTING MODULE ===================
// =====================================================

const DEFAULT_BILLING_SETTINGS = {
  company: 'à¸à¸§à¸¨à¸£à¸µ à¹à¸à¸­à¸£à¹à¸ªà¸à¸´à¹à¸à¹à¸®à¸¡', address: '', taxId: '',
  phone: '', email: '', docPrefix: 'BL', docPrefixExp: 'EXP', vatRate: 0
};

function getBillingSettings() { return db.billingSettings || { ...DEFAULT_BILLING_SETTINGS }; }

// ââ Page extra routing ââââââââââââââââââââââââââââââ
function renderPageExtra(page) {
  if (page === 'billing-settings') loadBillingSettingsUI();
  if (page === 'billing') renderBilling();
}

// ââ Init âââââââââââââââââââââââââââââââââââââââââââââ
async function initBilling() {
  await ensureSecondaryDB();
  if (!db.invoices) db.invoices = [];
  if (!db.expenses) db.expenses = [];
}

// ââ Month filter âââââââââââââââââââââââââââââââââââââ
function initBillingMonthFilter() {
  const sel = document.getElementById('billing-filter-month');
  if (!sel) return;
  const months = new Set();
  (db.invoices || []).forEach(i => { if (i.date) months.add(i.date.slice(0,7)); });
  (db.expenses || []).forEach(e => { if (e.date) months.add(e.date.slice(0,7)); });
  const sorted = Array.from(months).sort().reverse();
  sel.innerHTML = '<option value="">à¸à¸¸à¸à¹à¸à¸·à¸­à¸</option>' + sorted.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ââ Render billing page âââââââââââââââââââââââââââââââ
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

  const TYPE_LABELS   = { invoice:'à¹à¸à¹à¸à¹à¸à¸«à¸à¸µà¹', receipt:'à¹à¸à¹à¸ªà¸£à¹à¸', quotation:'à¹à¸à¹à¸ªà¸à¸­à¸£à¸²à¸à¸²', tax_invoice:'à¹à¸à¸à¸³à¸à¸±à¸à¸ à¸²à¸©à¸µ', expense:'à¸à¹à¸²à¹à¸à¹à¸à¹à¸²à¸¢' };
  const STATUS_COLORS = { draft:'#888', sent:'#e67e22', partial:'#3498db', paid:'#27ae60', cancelled:'#e74c3c' };
  const STATUS_LABELS = { draft:'à¸£à¹à¸²à¸', sent:'à¸£à¸­à¸à¸³à¸£à¸°', partial:'à¸à¸³à¸£à¸°à¸à¸²à¸à¸ªà¹à¸§à¸', paid:'à¸à¸³à¸£à¸°à¸à¸£à¸', cancelled:'à¸¢à¸à¹à¸¥à¸´à¸' };

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
      <td style="font-family:monospace;font-size:12px;">${inv.docNo||'-'}${inv.contractId?'<span style="font-size:10px;color:var(--accent);margin-left:4px;">ð¤</span>':''}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(90,158,122,.15);color:var(--accent);">${TYPE_LABELS[inv.type]||inv.type}</span></td>
      <td>${inv.patientName||'-'}</td>
      <td style="font-size:12px;">${inv.date||'-'}</td>
      <td style="font-size:12px;color:${isOverdue?'#e74c3c':'var(--text2)'};">${inv.dueDate||'-'}${isOverdue?' â ï¸':''}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(inv.grandTotal||0)}</td>
      <td style="text-align:right;color:#27ae60;">${paid>0?formatThb(paid):'-'}</td>
      <td style="text-align:right;font-weight:${balance>0?'700':'400'};color:${balance>0?'#e67e22':'var(--text3)'};">${balance>0?formatThb(balance):'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${STATUS_COLORS[dynStatus]||'#888'}22;color:${STATUS_COLORS[dynStatus]||'#888'};">${STATUS_LABELS[dynStatus]||dynStatus}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${inv.id}','invoice')" title="à¸à¸¹ Preview">ðï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="printInvoice('${inv.id}')" title="à¸à¸´à¸¡à¸à¹">ð¨ï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="exportInvoicePDF('${inv.id}')" title="Export PDF" style="color:#e74c3c;">ð</button>
        <button class="btn btn-ghost btn-sm" onclick="editInvoice('${inv.id}')" title="à¹à¸à¹à¹à¸">âï¸</button>
        ${dynStatus!=='paid'?`<button class="btn btn-primary btn-sm" onclick="openRecordPaymentModal('${inv.id}')" title="à¸£à¸±à¸à¸à¸³à¸£à¸°" style="font-size:11px;">ð³ à¸£à¸±à¸à¸à¸³à¸£à¸°</button>`:''}
        ${['admin','manager','officer'].includes(currentUser?.role) && (dynStatus==='paid'||dynStatus==='partial') ? `<button class="btn btn-ghost btn-sm" onclick="openInvoiceResetModal('${inv.id}')" title="Reset à¸à¸´à¸¥" style="color:#8e44ad;font-size:11px;">ð Reset</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteInvoice('${inv.id}')" style="color:#e74c3c;">ðï¸</button>
      </td>
    </tr>`;
  }).join('');

  const expRows = [...expList].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(exp => `
    <tr>
      <td style="font-family:monospace;font-size:12px;">${exp.docNo||'-'}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#e67e2222;color:#e67e22;">à¸à¹à¸²à¹à¸à¹à¸à¹à¸²à¸¢</span></td>
      <td style="font-size:13px;">${exp.vendorName||exp.job||'-'}</td>
      <td style="font-size:12px;">${exp.date||'-'}</td>
      <td style="font-size:12px;color:var(--text2);">${exp.payDate||'-'}</td>
      <td style="text-align:right;font-weight:600;">${formatThb(exp.net||0)}</td>
      <td>-</td><td>-</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#27ae6022;color:#27ae60;">à¸à¸±à¸à¸à¸¶à¸à¹à¸¥à¹à¸§</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="previewDoc('${exp.id}','expense')" title="à¸à¸¹ Preview">ðï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="printExpense('${exp.id}')" title="à¸à¸´à¸¡à¸à¹">ð¨ï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="exportExpensePDF('${exp.id}')" title="Export PDF" style="color:#e74c3c;">ð</button>
        <button class="btn btn-ghost btn-sm" onclick="editExpense('${exp.id}')" title="à¹à¸à¹à¹à¸">âï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteExpense('${exp.id}')" style="color:#e74c3c;">ðï¸</button>
      </td>
    </tr>`).join('');

  const tb = document.getElementById('billing-table-body');
  const allRows = invRows + expRows;
  tb.innerHTML = allRows || '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:40px;">à¹à¸¡à¹à¸¡à¸µà¹à¸­à¸à¸ªà¸²à¸£</td></tr>';
}

// ââ Format âââââââââââââââââââââââââââââââââââââââââââ
function formatThb(n) {
  return (n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' à¸¿';
}

// ââ DocNo generation âââââââââââââââââââââââââââââââââ
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

// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// ââ INVOICE MODAL ââââââââââââââââââââââââââââââââââââ
// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // clear typeahead patient
  const _taId = document.getElementById('ta-inv-id');
  const _taInp = document.getElementById('ta-inv-inp');
  if (_taId) _taId.value = '';
  if (_taInp) _taInp.value = '';

  renderInvoiceItems();
  renderOtherItems();
  recalcInvoice();
  updateInvoiceTitle();
  makeTypeahead({inputId:'ta-inv-inp',listId:'ta-inv-list',hiddenId:'ta-inv-id',dataFn:()=>taPatients(true)});
  openModal('modal-createInvoice');
}

function updateInvoiceTitle() {
  const LABELS = { invoice:'à¹à¸à¹à¸à¹à¸à¸«à¸à¸µà¹ / à¸§à¸²à¸à¸à¸´à¸¥', receipt:'à¹à¸à¹à¸ªà¸£à¹à¸à¸£à¸±à¸à¹à¸à¸´à¸', quotation:'à¹à¸à¹à¸ªà¸à¸­à¸£à¸²à¸à¸²', tax_invoice:'à¹à¸à¸à¸³à¸à¸±à¸à¸ à¸²à¸©à¸µ' };
  const type   = document.getElementById('inv-type')?.value || 'invoice';
  const editId = document.getElementById('inv-edit-id')?.value;
  document.getElementById('modal-invoice-title').textContent = (editId?'à¹à¸à¹à¹à¸':'à¸ªà¸£à¹à¸²à¸') + ' ' + (LABELS[type]||'');
  if (!editId) document.getElementById('inv-docno').value = generateDocNo(type);
}

function onInvoicePatientChange() {
  const patId = document.getElementById("ta-inv-id").value;
  if (!patId) return;
  const p = db.patients.find(p=>String(p.id)===String(patId));
  if (!p) return;

  const room = getPatientRoom(p);
  const bed  = getPatientBed(p);
  const autoDiv  = document.getElementById('inv-room-autofill');
  const autoText = document.getElementById('inv-room-autofill-text');

  if (room || bed) {
    const bedLabel  = bed  ? `à¹à¸à¸µà¸¢à¸ ${bed.bedCode}` : '';
    const roomLabel = room ? `${room.name} (${room.roomType})` : '';
    const rateMonthly = room?.monthlyRate || 0;
    const rateDaily   = room?.dailyRate   || 0;
    const rateText = [
      rateMonthly ? `${rateMonthly.toLocaleString('th-TH')} à¸¿/à¹à¸à¸·à¸­à¸` : '',
      rateDaily   ? `${rateDaily.toLocaleString('th-TH')} à¸¿/à¸§à¸±à¸` : '',
    ].filter(Boolean).join(' Â· ') || 'à¹à¸¡à¹à¸£à¸°à¸à¸¸à¸£à¸²à¸à¸²';

    autoText.textContent = `${roomLabel}${bedLabel ? ' Â· '+bedLabel : ''} Â· ${rateText}`;
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
      payerEl.innerHTML = `ð° à¸ªà¹à¸à¸à¸´à¸¥à¸à¸¶à¸: <strong>${payer.name}</strong> (${payer.relation}) Â· ð ${payer.phone}`;
      payerEl.style.display = 'block';
    } else {
      payerEl.style.display = 'none';
    }
  }
  recalcInvoice();
}

function applyRoomRate(type, roomObj, bedObj) {
  // à¸à¹à¸²à¹à¸¡à¹à¸ªà¹à¸ room/bed à¸¡à¸² à¹à¸«à¹à¸«à¸²à¸à¸²à¸ patient à¸à¸µà¹à¹à¸¥à¸·à¸­à¸à¸­à¸¢à¸¹à¹
  if (!roomObj) {
    const patId = document.getElementById("ta-inv-id").value;
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
  const MONTHS = ['à¸¡à¸à¸£à¸²à¸à¸¡','à¸à¸¸à¸¡à¸ à¸²à¸à¸±à¸à¸à¹','à¸¡à¸µà¸à¸²à¸à¸¡','à¹à¸¡à¸©à¸²à¸¢à¸','à¸à¸¤à¸©à¸ à¸²à¸à¸¡','à¸¡à¸´à¸à¸¸à¸à¸²à¸¢à¸','à¸à¸£à¸à¸à¸²à¸à¸¡','à¸ªà¸´à¸à¸«à¸²à¸à¸¡','à¸à¸±à¸à¸¢à¸²à¸¢à¸','à¸à¸¸à¸¥à¸²à¸à¸¡','à¸à¸¤à¸¨à¸à¸´à¸à¸²à¸¢à¸','à¸à¸±à¸à¸§à¸²à¸à¸¡'];
  const monthName = MONTHS[now.getMonth()];
  const year = now.getFullYear() + 543;
  const roomName = roomObj?.name || '';
  const bedCode  = bedObj?.bedCode  || '';
  const label = type === 'monthly'
    ? `à¸à¹à¸²à¸«à¹à¸­à¸${roomName ? ' '+roomName : ''}${bedCode ? ' à¹à¸à¸µà¸¢à¸ '+bedCode : ''} à¹à¸à¸·à¸­à¸${monthName} ${year}`
    : `à¸à¹à¸²à¸«à¹à¸­à¸${roomName ? ' '+roomName : ''}${bedCode ? ' à¹à¸à¸µà¸¢à¸ '+bedCode : ''} (à¸£à¸²à¸¢à¸§à¸±à¸)`;
  document.getElementById('inv-room-label').value = label;
  recalcInvoice();
}

function onInvRoomTypeChange() {
  const type = document.getElementById('inv-room-type').value;
  const qtyLabel = document.getElementById('inv-room-qty-label');
  if (qtyLabel) qtyLabel.textContent = type === 'daily' ? 'à¸à¸³à¸à¸§à¸ (à¸§à¸±à¸)' : 'à¸à¸³à¸à¸§à¸ (à¹à¸à¸·à¸­à¸)';
  recalcInvoice();
}

// ââ Load requisitions ââââââââââââââââââââââââââââââââ
async function loadRequisitionsForInvoice() {
  const patId = document.getElementById("ta-inv-id").value;
  const from  = document.getElementById('inv-med-from').value;
  const to    = document.getElementById('inv-med-to').value;
  if (!patId) { toast('à¸à¸£à¸¸à¸à¸²à¹à¸¥à¸·à¸­à¸à¸à¸¹à¹à¸£à¸±à¸à¸à¸£à¸´à¸à¸²à¸£à¸à¹à¸­à¸','warning'); return; }
  const fromDate = from ? from+'-01' : '2000-01-01';
  const toDate   = to   ? to+'-31'   : '2099-12-31';
  const contract = getActiveContract(patId);
  const includedProducts = contract ? getIncludedProducts(contract.items||[]) : [];
  const reqs = (db.requisitions||[]).filter(r => {
    if (!r.patientId || String(r.patientId)!==String(patId)) return false;
    const d = r.date || r.createdAt || '';
    return d >= fromDate && d <= toDate && r.status === 'approved';
  });
  const allItems = [];
  // Phase 1.5 fix: à¸ªà¸£à¹à¸²à¸ Set à¸à¸­à¸ item IDs à¸à¸µà¹à¸­à¸¢à¸¹à¹à¹à¸ package à¹à¸à¸·à¹à¸­à¹à¸à¹ override isBillable check
  // à¸à¸à¹à¸«à¸¡à¹: à¸à¹à¸² item à¸­à¸¢à¸¹à¹à¹à¸ package â à¹à¸à¹ package logic (qty_limit) à¹à¸¡à¹ isBillable=false à¸à¹à¸à¸²à¸¡
  //         à¸à¹à¸² item à¹à¸¡à¹à¸­à¸¢à¸¹à¹à¹à¸ package â à¹à¸à¹ isBillable à¸à¸²à¸¡à¹à¸à¸´à¸¡
  const packagedItemIds = new Set((includedProducts||[]).map(p => String(p.item_id)));

  reqs.forEach(req => {
    // à¸£à¸­à¸à¸£à¸±à¸à¸à¸±à¹à¸ flat record (itemId/qty) à¹à¸¥à¸° lines/items array
    const lines = (req.lines && req.lines.length > 0) ? req.lines :
                  (req.items && req.items.length > 0) ? req.items :
                  (req.itemId ? [{ itemId: req.itemId, name: req.itemName, qty: req.qty||1, unit: req.unit }] : []);
    lines.forEach(ri => {
      const iid = ri.itemId || ri.item_id;
      const item = db.items.find(it=>String(it.id)===String(iid));
      // Phase 1.5: à¸à¹à¸² item à¸­à¸¢à¸¹à¹à¹à¸ package â à¸à¸¥à¹à¸­à¸¢à¸à¹à¸²à¸ (package logic à¸à¸°à¸à¸±à¸à¸à¸²à¸£ qty_limit à¹à¸­à¸)
      //            à¸à¹à¸²à¹à¸¡à¹à¸­à¸¢à¸¹à¹à¹à¸ package + isBillable=false â à¸à¸£à¸µà¸à¸¥à¸­à¸ à¹à¸¡à¹à¸à¸¶à¹à¸à¹à¸à¸à¸´à¸¥
      // Phase 1.6: ทุกรายการเข้าใบบิล — นอก package คิดเงินทุกชิ้น (เลิกใช้ isBillable filter)
      allItems.push({ itemId: iid, name: ri.name||ri.itemName||item?.name||iid,
        qty: ri.qty||1, price: item ? (item.price||item.cost||0) : 0,
        unit: ri.unit||item?.dispenseUnit||item?.unit||'' });
    });
  });
  const allocated = allocateIncludedProducts(allItems, includedProducts);
  const billableMap = {}, includedMap = {};
  allocated.billable.forEach(function(ri) {
    const key = ri.itemId||ri.name;
    if (!billableMap[key]) billableMap[key] = { name:ri.name, qty:0, price:ri.price, unit:ri.unit };
    billableMap[key].qty += ri.qty||1;
  });
  allocated.included.forEach(function(ri) {
    const key = ri.itemId||ri.name;
    if (!includedMap[key]) includedMap[key] = { name:ri.name, qty:0, price:ri.price, unit:ri.unit, is_included:true };
    includedMap[key].qty += ri.free_qty||0;
    // Phase 1.6 fix: ลบการนับ charge_qty ออก (มีอยู่ใน allocated.billable แล้ว — นับซ้ำทำให้ qty × 2)
  });
  const billableItems = Object.values(billableMap);
  const includedItems = Object.values(includedMap);
  document.getElementById('inv-req-items-data').value = JSON.stringify(billableItems);
  const incEl = document.getElementById('inv-included-items-data');
  if (incEl) incEl.value = JSON.stringify(includedItems);
  renderInvoiceItems();
  recalcInvoice();
  const msg = 'à¸à¸à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸à¸´à¸ '+billableItems.length+' à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸´à¸à¹à¸à¸´à¸'+(includedItems.length>0?' + '+includedItems.length+' à¸£à¸²à¸¢à¸à¸²à¸£à¸£à¸§à¸¡à¹à¸ package':'');
  toast(billableItems.length===0&&includedItems.length===0?'à¹à¸¡à¹à¸à¸à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸à¸´à¸à¸à¸µà¹à¸­à¸à¸¸à¸¡à¸±à¸à¸´à¹à¸¥à¹à¸§':msg,
    billableItems.length===0&&includedItems.length===0?'warning':'success');
}


// ââ Render requisition items âââââââââââââââââââââââââ
function renderInvoiceItems() {
  const container = document.getElementById('inv-items-container');
  const hide = document.getElementById('inv-hide-items')?.checked;
  let items = [];
  try { items = JSON.parse(document.getElementById('inv-req-items-data').value||'[]'); } catch(e){}
  const total = items.reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);
  document.getElementById('inv-items-total').textContent = formatThb(total);
  if (items.length===0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:12px;font-size:13px;">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£</div>';
    recalcInvoice(); return;
  }
  if (hide) {
    container.innerHTML = `<div style="padding:10px;background:var(--surface2);border-radius:6px;text-align:center;color:var(--text2);font-size:13px;">ð à¸à¹à¸­à¸à¸£à¸²à¸¢à¸à¸²à¸£ ${items.length} à¸£à¸²à¸¢à¸à¸²à¸£ â à¸£à¸§à¸¡ ${formatThb(total)}</div>`;
    recalcInvoice(); return;
  }
  // à¹à¸¢à¸à¸«à¸¡à¸§à¸à¸«à¸¡à¸¹à¹
  const CAT_LABELS = { 'à¸¢à¸²':'ð à¸¢à¸²', 'à¹à¸§à¸à¸ à¸±à¸à¸à¹':'ð©º à¹à¸§à¸à¸ à¸±à¸à¸à¹', 'à¸à¸­à¸à¹à¸à¹':'ð§´ à¸à¸­à¸à¹à¸à¹', 'à¸à¸£à¸´à¸à¸²à¸£':'ð§ à¸à¸£à¸´à¸à¸²à¸£' };
  const CAT_ORDER  = ['à¸¢à¸²','à¹à¸§à¸à¸ à¸±à¸à¸à¹','à¸à¸­à¸à¹à¸à¹','à¸à¸£à¸´à¸à¸²à¸£'];
  const grouped = {};
  items.forEach((it,idx) => {
    const cat = it.category || 'à¹à¸§à¸à¸ à¸±à¸à¸à¹';
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
    <td><button onclick="removeInvItem('${it._idx}')" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">â</button></td>
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
          <th style="text-align:left;padding:3px 6px;">à¸£à¸²à¸¢à¸à¸²à¸£</th>
          <th style="text-align:right;padding:3px 6px;width:70px;">à¸à¸³à¸à¸§à¸</th>
          <th style="text-align:right;padding:3px 6px;width:80px;">à¸£à¸²à¸à¸²/à¸«à¸à¹à¸§à¸¢</th>
          <th style="text-align:right;padding:3px 6px;width:90px;">à¸¡à¸¹à¸¥à¸à¹à¸²</th>
          <th style="width:24px;"></th>
        </tr></thead><tbody>
        ${grouped[cat].map(it=>itemRow(it)).join('')}
        </tbody>
      </table>
    </div>`;
  });
  // à¹à¸ªà¸à¸ included items section
  let _incItems = []; try { _incItems = JSON.parse(document.getElementById('inv-included-items-data')?.value||'[]'); } catch(e){}
  const _showInc = document.getElementById('inv-show-included')?.checked;
  let _existInc = document.getElementById('inv-included-section');
  if (_existInc) _existInc.remove();
  container.innerHTML = html;
  if (_incItems.length > 0) {
    const _incDiv = document.createElement('div');
    _incDiv.id = 'inv-included-section';
    _incDiv.style.marginTop = '8px';
    if (_showInc) {
      let _ih = '<div style="font-size:11px;font-weight:700;color:#3a6a3a;padding:4px 6px;background:#f0fff4;border-radius:4px;display:flex;justify-content:space-between;margin-bottom:4px;"><span>ð¦ à¸ªà¸´à¸à¸à¹à¸²à¸£à¸§à¸¡à¹à¸ package â à¹à¸¡à¹à¸à¸´à¸à¹à¸à¸´à¸ ('+_incItems.length+' à¸£à¸²à¸¢à¸à¸²à¸£)</span><span style="color:#888;">à¸¿0.00</span></div><table style="width:100%;border-collapse:collapse;font-size:12px;color:var(--text2);"><tbody>';
      _incItems.forEach(function(it){ _ih += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:3px 6px;">'+it.name+'</td><td style="padding:3px 6px;text-align:right;">'+(it.qty||0)+' '+(it.unit||'')+'</td><td style="padding:3px 6px;text-align:right;color:#27ae60;">à¸£à¸§à¸¡à¹à¸ package</td></tr>'; });
      _ih += '</tbody></table>';
      _incDiv.innerHTML = _ih;
    } else {
      _incDiv.innerHTML = '<div style="font-size:12px;color:#3a6a3a;padding:4px 6px;background:#f0fff4;border-radius:4px;cursor:pointer;" onclick="document.getElementById(\'inv-show-included\').checked=true;renderInvoiceItems()">ð¦ à¸¡à¸µà¸ªà¸´à¸à¸à¹à¸²à¸£à¸§à¸¡à¹à¸ package '+_incItems.length+' à¸£à¸²à¸¢à¸à¸²à¸£ â <span style="text-decoration:underline;">à¸à¸¥à¸´à¸à¹à¸à¸·à¹à¸­à¸à¸¹</span></div>';
    }
    container.after(_incDiv);
  }
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

// ââ Other items ââââââââââââââââââââââââââââââââââââââ
function renderOtherItems() {
  const container = document.getElementById('inv-other-container');
  let items=[]; try{items=JSON.parse(document.getElementById('inv-other-items-data').value||'[]');}catch(e){}
  if(items.length===0){
    container.innerHTML='<div style="text-align:center;color:var(--text3);padding:10px;font-size:13px;">à¸à¸ + à¹à¸à¸´à¹à¸¡à¸£à¸²à¸¢à¸à¸²à¸£</div>';
    document.getElementById('inv-other-total').textContent='0.00 à¸¿'; recalcInvoice(); return;
  }
  container.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="color:var(--text2);border-bottom:1px solid var(--border);">
      <th style="text-align:left;padding:4px 6px;">à¸£à¸²à¸¢à¸à¸²à¸£</th>
      <th style="text-align:right;padding:4px 6px;width:70px;">à¸à¸³à¸à¸§à¸</th>
      <th style="text-align:right;padding:4px 6px;width:80px;">à¸£à¸²à¸à¸²/à¸«à¸à¹à¸§à¸¢</th>
      <th style="text-align:right;padding:4px 6px;width:90px;">à¸¡à¸¹à¸¥à¸à¹à¸²</th>
      <th style="width:24px;"></th>
    </tr></thead><tbody>
    ${items.map((it,idx)=>`<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 6px;"><input type="text" value="${(it.name||'').replace(/"/g,'&quot;')}" onchange="updateOtherItem(${idx},'name',this.value)" style="width:100%;border:none;background:transparent;color:var(--text1);font-size:13px;"></td>
      <td style="padding:5px 6px;"><input type="number" value="${it.qty||1}" min="0" oninput="updateOtherItem(${idx},'qty',this.value)" style="width:65px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;"></td>
      <td style="padding:5px 6px;"><input type="number" value="${it.price||0}" min="0" oninput="updateOtherItem(${idx},'price',this.value)" style="width:80px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:13px;"></td>
      <td style="padding:5px 6px;text-align:right;font-weight:600;" id="inv-other-row-${idx}">${formatThb((it.qty||1)*(it.price||0))}</td>
      <td><button onclick="removeOtherItem(${idx})" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">â</button></td>
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

// ââ Recalculate invoice totals âââââââââââââââââââââââ
function recalcInvoice() {
  // à¸à¹à¸²à¸«à¹à¸­à¸
  const roomEnabled = document.getElementById('inv-room-enabled')?.checked;
  const roomQty  = parseFloat(document.getElementById('inv-room-qty')?.value||0);
  const roomRate = parseFloat(document.getElementById('inv-room-rate')?.value||0);
  const roomTotal = roomEnabled ? roomQty*roomRate : 0;
  if(document.getElementById('inv-room-total')) document.getElementById('inv-room-total').value = roomTotal.toFixed(2);

  // à¸à¹à¸²à¸à¸²à¸¢à¸ à¸²à¸
  const ptEnabled = document.getElementById('inv-pt-enabled')?.checked;
  const ptQty  = parseFloat(document.getElementById('inv-pt-qty')?.value||0);
  const ptRate = parseFloat(document.getElementById('inv-pt-rate')?.value||0);
  const ptTotal = ptEnabled ? ptQty*ptRate : 0;
  if(document.getElementById('inv-pt-total')) document.getElementById('inv-pt-total').value = ptTotal.toFixed(2);

  // à¸à¹à¸²à¹à¸§à¸à¸ à¸±à¸à¸à¹
  let medItems=[]; try{medItems=JSON.parse(document.getElementById('inv-req-items-data')?.value||'[]');}catch(e){}
  const medTotal = medItems.reduce((s,it)=>s+(it.qty||0)*(it.price||0),0);

  // à¸à¹à¸²à¸­à¸·à¹à¸à¹
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

// ââ Save invoice âââââââââââââââââââââââââââââââââââââ
async function saveInvoice(status) {
  const patId = document.getElementById("ta-inv-id").value;
  if (!patId) { toast('à¸à¸£à¸¸à¸à¸²à¹à¸¥à¸·à¸­à¸à¸à¸¹à¹à¸£à¸±à¸à¸à¸£à¸´à¸à¸²à¸£','warning'); return; }
  // Check duplicate doc number
  const editId_ = document.getElementById('inv-edit-id').value;
  const docNo_  = document.getElementById('inv-docno').value.trim();
  if (docNo_) {
    const dup = (db.invoices||[]).find(i => i.docNo === docNo_ && i.id !== editId_);
    if (dup) {
      const proceed = confirm(`â ï¸ à¹à¸¥à¸à¸à¸µà¹à¹à¸­à¸à¸ªà¸²à¸£ "${docNo_}" à¸à¹à¸³à¸à¸±à¸à¹à¸­à¸à¸ªà¸²à¸£à¸à¸µà¹à¸¡à¸µà¸­à¸¢à¸¹à¹à¹à¸¥à¹à¸§!\n\nà¹à¸­à¸à¸ªà¸²à¸£à¹à¸à¸´à¸¡: ${dup.patientName || '-'} (${dup.date || '-'})\n\nà¸à¹à¸­à¸à¸à¸²à¸£à¸à¸±à¸à¸à¸¶à¸à¸à¸±à¸à¸«à¸£à¸·à¸­à¹à¸¡à¹?`);
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
    showIncluded: document.getElementById('inv-show-included')?.checked||false,
    includedItems: (function(){ try{ return JSON.parse(document.getElementById('inv-included-items-data')?.value||'[]'); }catch(e){ return []; } })(),
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
    included_items: inv.includedItems||[], show_included: inv.showIncluded||false,
    subtotal: inv.subtotal||0, vat_rate: inv.vatRate||0, vat_amt: inv.vatAmt||0,
    before_wht: inv.beforeWht||0, wht_rate: inv.whtRate||0, wht_amt: inv.whtAmt||0,
    grand_total: inv.grandTotal||0,
    note: inv.note||'', status: inv.status||'draft',
    contract_id: inv.contractId||null,
    updated_at: new Date().toISOString(),
  };
  if (!editId) row.created_at = new Date().toISOString();
  const { error: saveErr } = await supa.from('invoices').upsert(row);
  if (saveErr) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+saveErr.message,'error'); return; }
  if(editId) { const idx=db.invoices.findIndex(i=>i.id===editId); if(idx>=0) db.invoices[idx]={...db.invoices[idx],...inv}; else db.invoices.unshift(inv); }
  else db.invoices.unshift(inv);
  logAudit(AUDIT_MODULES.BILLING, editId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
    editId || row.doc_no,
    { doc_no: row.doc_no, patient: row.patient_name, status, total: row.grand_total });
  toast(status==='draft'?'à¸à¸±à¸à¸à¸¶à¸à¸£à¹à¸²à¸à¹à¸¥à¹à¸§':'à¸à¸±à¸à¸à¸¶à¸à¹à¸­à¸à¸ªà¸²à¸£à¹à¸¥à¹à¸§','success');
  closeModal('modal-createInvoice');
  renderBilling();
}

// ââ Edit invoice âââââââââââââââââââââââââââââââââââââ
function editInvoice(id) {
  const inv=(db.invoices||[]).find(i=>i.id===id);
  if(!inv) return;
  if (inv.status === 'paid') {
    toast('â à¹à¸¡à¹à¸ªà¸²à¸¡à¸²à¸£à¸à¹à¸à¹à¹à¸à¸à¸´à¸¥à¸à¸µà¹à¸à¸³à¸£à¸°à¹à¸¥à¹à¸§à¹à¸à¹ â à¸«à¸²à¸à¸à¹à¸­à¸à¸à¸²à¸£à¹à¸à¹à¹à¸à¹à¸«à¹à¸¢à¸à¹à¸¥à¸´à¸à¸à¸´à¸¥à¹à¸¥à¹à¸§à¸­à¸­à¸à¹à¸«à¸¡à¹', 'error');
    return;
  }
  if (inv.status === 'partial') {
    if (!confirm('â ï¸ à¸à¸´à¸¥à¸à¸µà¹à¸¡à¸µà¸à¸²à¸£à¸£à¸±à¸à¹à¸à¸´à¸à¸à¸²à¸à¸ªà¹à¸§à¸à¹à¸¥à¹à¸§ à¸à¸²à¸£à¹à¸à¹à¹à¸à¸­à¸²à¸à¸à¸³à¹à¸«à¹à¸¢à¸­à¸à¹à¸¡à¹à¸à¸£à¸à¸à¸±à¸à¹à¸à¹à¸ªà¸£à¹à¸\nà¸à¹à¸­à¸à¸à¸²à¸£à¹à¸à¹à¹à¸à¸à¹à¸­à¸«à¸£à¸·à¸­à¹à¸¡à¹?')) return;
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
    const rateText = [rM?rM.toLocaleString('th-TH')+' à¸¿/à¹à¸à¸·à¸­à¸':'', rD?rD.toLocaleString('th-TH')+' à¸¿/à¸§à¸±à¸':''].filter(Boolean).join(' Â· ')||'à¹à¸¡à¹à¸£à¸°à¸à¸¸à¸£à¸²à¸à¸²';
    autoText.textContent = `${editRoom?.name||''} (${editRoom?.roomType||''})${editBed?' Â· à¹à¸à¸µà¸¢à¸ '+editBed.bedCode:''} Â· ${rateText}`;
    autoDiv.style.display = 'flex';
  } else { autoDiv.style.display = 'none'; }
  onInvRoomTypeChange();
  document.getElementById('inv-pt-enabled').checked = inv.ptEnabled||false;
  document.getElementById('inv-pt-type').value    = inv.ptType||'monthly';
  document.getElementById('inv-pt-qty').value     = inv.ptQty||1;
  document.getElementById('inv-pt-rate').value    = inv.ptRate||0;
  document.getElementById('inv-hide-items').checked = inv.hideItems||false;
  const _showIncEl = document.getElementById('inv-show-included'); if(_showIncEl) _showIncEl.checked = inv.showIncluded||false;
  const _incDataEl = document.getElementById('inv-included-items-data'); if(_incDataEl) _incDataEl.value = JSON.stringify(inv.includedItems||[]);
  document.getElementById('inv-req-items-data').value   = JSON.stringify(inv.medItems||[]);
  document.getElementById('inv-other-items-data').value = JSON.stringify(inv.otherItems||[]);
  document.getElementById('inv-vat-rate').value   = inv.vatRate||0;
  document.getElementById('inv-wht-rate').value   = inv.whtRate||0;
  document.getElementById('inv-note').value       = inv.note||'';

  // set patient à¸à¹à¸²à¸ typeahead
  const taId = document.getElementById('ta-inv-id');
  const taInp = document.getElementById('ta-inv-inp');
  if (taId) taId.value = inv.patientId||'';
  if (taInp) {
    const invPat = db.patients.find(p=>String(p.id)===String(inv.patientId));
    taInp.value = invPat ? invPat.name : (inv.patientName||'');
  }

  const now = new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('inv-med-from').value = ym;
  document.getElementById('inv-med-to').value   = ym;

  renderInvoiceItems(); renderOtherItems(); recalcInvoice(); updateInvoiceTitle();
  openModal('modal-createInvoice');
}

async function deleteInvoice(id) {
  if(!confirm('à¸¥à¸à¹à¸­à¸à¸ªà¸²à¸£à¸à¸µà¹à¸«à¸£à¸·à¸­à¹à¸¡à¹?')) return;
  const { error } = await supa.from('invoices').delete().eq('id', id);
  if (error) { toast('à¸¥à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
  db.invoices=(db.invoices||[]).filter(i=>i.id!==id);
  toast('à¸¥à¸à¹à¸¥à¹à¸§','success'); renderBilling();
}

async function markInvoicePaid(id) {
  // Legacy quick-mark â open payment modal instead
  openRecordPaymentModal(id);
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// ââ BILLING TABS âââââââââââââââââââââââââââââââââââââ
// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
function switchBillingTab(tab) {
  ['invoices','contracts','payments','physio'].forEach(t => {
    const panel = document.getElementById('billing-tab-'+t);
    if(panel) panel.style.display = t===tab ? 'block' : 'none';
  });
  document.querySelectorAll('.billing-tab').forEach((el,i) => {
    const tabs = ['invoices','contracts','payments','physio'];
    const active = tabs[i]===tab;
    el.style.color      = active ? 'var(--accent)' : 'var(--text2)';
    el.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    el.style.marginBottom = '-2px';
  });
  if (tab === 'contracts') renderContracts();
  if (tab === 'payments')  renderPaymentsTab();
  if (tab === 'physio')    renderPhysioPackagesTab();
  if (tab === 'physio') renderPhysioPackagesTab();
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// ââ PAYMENT TRACKING âââââââââââââââââââââââââââââââââ
// âââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
    <div style="font-weight:700;margin-bottom:4px;">${inv.docNo} Â· ${inv.patientName}</div>
    <div style="display:flex;gap:16px;font-size:12px;">
      <span>à¸¢à¸­à¸à¸£à¸§à¸¡: <strong>${formatThb(inv.grandTotal||0)}</strong></span>
      <span style="color:#27ae60;">à¸à¸³à¸£à¸°à¹à¸¥à¹à¸§: <strong>${formatThb(paid)}</strong></span>
      <span style="color:#e67e22;">à¸à¸à¸à¹à¸²à¸: <strong>${formatThb(balance)}</strong></span>
    </div>`;
  document.getElementById('pay-amount').value = balance.toFixed(2);
  document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('pay-ref').value = '';
  document.getElementById('pay-note').value = '';
  document.getElementById('pay-by').value = currentUser?.displayName || currentUser?.username || '';
  // Reset radio
  document.querySelector('input[name="pay-method"][value="à¹à¸­à¸à¹à¸à¸´à¸"]').checked = true;
  document.getElementById('pay-method-other-wrap').style.display = 'none';
  document.getElementById('pay-method-other').value = '';
  openModal('modal-record-payment');
}

function togglePayOther() {
  const isOther = document.querySelector('input[name="pay-method"]:checked')?.value === 'à¸­à¸·à¹à¸à¹';
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
  if (!amount || amount <= 0) { toast('à¸à¸£à¸¸à¸à¸²à¸£à¸°à¸à¸¸à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸','warning'); return; }
  if (!date) { toast('à¸à¸£à¸¸à¸à¸²à¸£à¸°à¸à¸¸à¸§à¸±à¸à¸à¸µà¹','warning'); return; }
  const methodRaw = document.querySelector('input[name="pay-method"]:checked')?.value || 'à¹à¸­à¸à¹à¸à¸´à¸';
  const method = methodRaw === 'à¸­à¸·à¹à¸à¹'
    ? (document.getElementById('pay-method-other').value.trim() || 'à¸­à¸·à¹à¸à¹')
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
  if (error) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
  if(!db.payments) db.payments=[];
  db.payments.unshift(mapPayment(ins));

  // Auto-update invoice status
  const newBalance = getInvoiceBalance(inv);
  const newStatus  = newBalance <= 0 ? 'paid' : 'partial';
  if (inv && inv.status !== newStatus) {
    const { error: _statusErr } = await supa.from('invoices').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', inv.id);
    if (_statusErr) { console.error('[billing] invoice status update fail:', _statusErr.message); }
    else { inv.status = newStatus; }
  }

  toast(`â à¸£à¸±à¸à¸à¸³à¸£à¸° ${formatThb(amount)} (${receiptNo}) à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢`, 'success');
  closeModal('modal-record-payment');
  renderBilling();

  // Ask to print receipt
  if (confirm(`à¸à¸±à¸à¸à¸¶à¸à¸ªà¸³à¹à¸£à¹à¸! à¸à¹à¸­à¸à¸à¸²à¸£à¸à¸´à¸¡à¸à¹à¹à¸à¹à¸ªà¸£à¹à¸à¸£à¸±à¸à¹à¸à¸´à¸ ${receiptNo} à¸«à¸£à¸·à¸­à¹à¸¡à¹?`)) {
    printReceipt(ins.id || payData.receipt_no);
  }
}