// ===== EXPENSES MODULE =====
'use strict';

const EXP_CATEGORY_LABEL = {
  utilities:'สาธารณูปโภค', maintenance:'ซ่อมแซม', salary:'เงินเดือน/บุคลากร',
  rent:'ค่าเช่า', professional:'ค่าบริการวิชาชีพ', medical_supply:'วัสดุการแพทย์',
  consumable:'วัสดุสิ้นเปลือง', food:'อาหาร/วัตถุดิบ', insurance:'ประกันภัย',
  tax_fee:'ค่าธรรมเนียม/ภาษี', training:'อบรม/สัมมนา', transport:'เดินทาง/น้ำมัน',
  asset:'ครุภัณฑ์', inventory:'สินค้า', operational:'ปฏิบัติการ', other:'อื่นๆ'
};
const EXP_STATUS_BADGE = {
  paid:    '<span class="badge badge-green">จ่ายแล้ว</span>',
  unpaid:  '<span class="badge badge-orange">ค้างชำระ</span>',
  overdue: '<span class="badge badge-red">เกินกำหนด</span>',
  cancelled:'<span class="badge badge-gray">ยกเลิก</span>',
};

function renderExpenses() {
  const catF    = document.getElementById('exp-filter-category')?.value || '';
  const statusF = document.getElementById('exp-filter-status')?.value   || '';
  const monthF  = document.getElementById('exp-filter-month')?.value    || '';
  const q       = (document.getElementById('exp-search')?.value||'').toLowerCase();
  const tb      = document.getElementById('expTable');
  if (!tb) return;

  // populate month filter
  const monthSel = document.getElementById('exp-filter-month');
  if (monthSel && monthSel.options.length <= 1) {
    const now = new Date();
    for (let y = now.getFullYear(); y >= now.getFullYear()-2; y--) {
      for (let m = 12; m >= 1; m--) {
        const opt = document.createElement('option');
        const thY = y + 543;
        const thM = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][m-1];
        opt.value = y+'-'+m;
        opt.textContent = thM + ' ' + thY;
        monthSel.appendChild(opt);
      }
    }
  }

  let list = (db.expenses||[]).filter(r => {
    if (catF    && r.expenseType !== catF)    return false;
    if (statusF && r.status      !== statusF) return false;
    if (monthF) {
      const [fy,fm] = monthF.split('-');
      if (String(r.periodYear) !== fy || String(r.periodMonth) !== fm) return false;
    }
    if (q && !((r.job||'')+(r.vendorName||'')+(r.docNo||'')+(r.note||'')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // stats
  const now = new Date(); const cy = now.getFullYear(); const cm = now.getMonth()+1;
  const thisMonth = (db.expenses||[]).filter(r=>r.periodYear==cy&&r.periodMonth==cm||(!r.periodYear&&r.date?.startsWith(cy+'-'+String(cm).padStart(2,'0'))));
  document.getElementById('exp-stat-total').textContent  = '฿'+thisMonth.reduce((s,r)=>s+(parseFloat(r.net)||0),0).toLocaleString('th',{maximumFractionDigits:2});
  document.getElementById('exp-stat-unpaid').textContent = '฿'+(db.expenses||[]).filter(r=>r.status==='unpaid').reduce((s,r)=>s+(parseFloat(r.net)||0),0).toLocaleString('th',{maximumFractionDigits:2});
  document.getElementById('exp-stat-paid').textContent   = '฿'+thisMonth.filter(r=>r.status==='paid').reduce((s,r)=>s+(parseFloat(r.net)||0),0).toLocaleString('th',{maximumFractionDigits:2});
  document.getElementById('exp-count').textContent = 'ทั้งหมด: '+list.length+' รายการ';

  if (!list.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">ไม่มีข้อมูล</td></tr>'; return; }

  tb.innerHTML = list.map(r => `<tr>
    <td style="font-size:12px;">${r.date||'-'}</td>
    <td style="font-family:monospace;font-size:12px;">${r.docNo||'-'}</td>
    <td><span class="badge" style="background:var(--surface2);color:var(--text2);">${EXP_CATEGORY_LABEL[r.expenseType]||r.expenseType||'-'}</span></td>
    <td style="font-weight:500;">${r.job||'-'}${r.referenceNo?'<br><span style="font-size:11px;color:var(--text3);">'+r.referenceNo+'</span>':''}</td>
    <td style="font-size:12px;">${r.vendorName||'-'}</td>
    <td style="text-align:right;font-weight:700;">฿${(parseFloat(r.net)||0).toLocaleString('th',{maximumFractionDigits:2})}</td>
    <td>${EXP_STATUS_BADGE[r.status]||r.status}</td>
    <td style="font-size:12px;">${r.paidBy||'-'}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="printExpense('${r.id}')" title="พิมพ์ใบสำคัญจ่าย">🖨️</button>
      <button class="btn btn-ghost btn-sm" style="color:#e74c3c;" onclick="exportExpensePDF('${r.id}')" title="Export PDF">📄</button>
      <button class="btn btn-ghost btn-sm" onclick="editExpense('${r.id}')" title="แก้ไข">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteExpense('${r.id}')" title="ลบ">🗑️</button>
    </td>
  </tr>`).join('');
}

function openAddExpenseModal() {
  document.getElementById('editExpenseId').value = '';
  document.getElementById('addExpenseModalTitle').textContent = '💸 บันทึกค่าใช้จ่าย';
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('exp-date').value = today;
  document.getElementById('exp-doc-no').value = '';
  document.getElementById('exp-type').value = 'utilities';
  document.getElementById('exp-job').value = '';
  document.getElementById('exp-vendor').value = '';
  document.getElementById('exp-ref-no').value = '';
  document.getElementById('exp-period-month').value = new Date().getMonth()+1;
  document.getElementById('exp-period-year').value = new Date().getFullYear();
  document.getElementById('exp-due-date').value = '';
  document.getElementById('exp-subtotal').value = '';
  document.getElementById('exp-vat-rate').value = '0';
  document.getElementById('exp-wht-rate').value = '0';
  document.getElementById('exp-net').value = '';
  document.getElementById('exp-pay-method').value = 'transfer';
  document.getElementById('exp-status').value = 'paid';
  document.getElementById('exp-paid-by').value = currentUser?.displayName||'';
  document.getElementById('exp-is-recurring').checked = false;
  document.getElementById('exp-recurring-block').style.display = 'none';
  document.getElementById('exp-note').value = '';
  // Phase 4 Step E: reset fields ใหม่ + ปิด details ทั้งหมด (เริ่มจาก collapsed state)
  const reset2 = (id) => { const el = document.getElementById(id); if (el) el.value = ''; };
  reset2('exp2-vendor-addr'); reset2('exp2-vendor-taxid');
  reset2('exp2-bank'); reset2('exp2-bank-no'); reset2('exp2-pay-date');
  const itemsEl = document.getElementById('exp2-items-data'); if (itemsEl) itemsEl.value = '[]';
  if (typeof renderExpenseLineItems === 'function') renderExpenseLineItems();
  // ปิด collapsible sections ทั้งหมด
  document.querySelectorAll('#modal-addExpense details').forEach(d => d.open = false);
  
  openModal('modal-addExpense');
}

function calcExpTotal() {
  const sub = parseFloat(document.getElementById('exp-subtotal')?.value)||0;
  const vat = parseFloat(document.getElementById('exp-vat-rate')?.value)||0;
  const wht = parseFloat(document.getElementById('exp-wht-rate')?.value)||0;
  const vatAmt = sub * vat / 100;
  const whtAmt = sub * wht / 100;
  const net    = sub + vatAmt - whtAmt;
  document.getElementById('exp-net').value = net.toFixed(2);
}

function toggleRecurring() {
  const block = document.getElementById('exp-recurring-block');
  if (block) block.style.display = document.getElementById('exp-is-recurring')?.checked ? '' : 'none';
}

function onExpTypeChange() { /* placeholder สำหรับ logic เพิ่มเติมตามประเภท */ }

// Helper: อ่านรายการย่อย (line items) จาก hidden field
function _readExpenseLineItems() {
  const el = document.getElementById('exp2-items-data');
  if (!el) return [];
  try { return JSON.parse(el.value || '[]'); } catch(_) { return []; }
}

// Helper: เขียนรายการย่อยลง hidden field + re-render
function _writeExpenseLineItems(items) {
  const el = document.getElementById('exp2-items-data');
  if (!el) return;
  el.value = JSON.stringify(items || []);
  renderExpenseLineItems();
}

// เพิ่มรายการย่อยใหม่
function addExpenseLineItem() {
  const items = _readExpenseLineItems();
  items.push({ desc: '', cat: 'อื่นๆ', qty: 1, price: 0 });
  _writeExpenseLineItems(items);
}

// อัปเดต field ของรายการ
function _updateExpenseLineItem(idx, field, value) {
  const items = _readExpenseLineItems();
  if (!items[idx]) return;
  if (field === 'qty' || field === 'price') value = parseFloat(value) || 0;
  items[idx][field] = value;
  // เขียนกลับโดยไม่ re-render ทั้ง table (กัน cursor หลุด)
  const el = document.getElementById('exp2-items-data');
  if (el) el.value = JSON.stringify(items);
  // อัปเดตเฉพาะ row total + grand total
  const rowEl = document.getElementById('exp2-row-' + idx);
  if (rowEl) rowEl.textContent = ((items[idx].qty||1) * (items[idx].price||0)).toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2});
  _recalcExpenseLineItemsTotal();
}

// ลบรายการ
function _removeExpenseLineItem(idx) {
  const items = _readExpenseLineItems();
  items.splice(idx, 1);
  _writeExpenseLineItems(items);
}

// คำนวณ total ของ line items
function _recalcExpenseLineItemsTotal() {
  const items = _readExpenseLineItems();
  const total = items.reduce((s, it) => s + (it.qty||1) * (it.price||0), 0);
  const el = document.getElementById('exp2-items-total');
  if (el) el.textContent = total.toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ฿';
}

// Render line items table
function renderExpenseLineItems() {
  const container = document.getElementById('exp2-items-container');
  if (!container) return;
  const items = _readExpenseLineItems();
  
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:8px;font-size:12px;">ยังไม่มีรายการย่อย</div>';
    _recalcExpenseLineItemsTotal();
    return;
  }
  
  const cats = ['ค่าน้ำมัน/แก๊ส/รถยนต์','ค่าอาหาร','ค่าสาธารณูปโภค','ค่าโทรศัพท์','ค่าอุปกรณ์สำนักงาน','ค่าซ่อมบำรุง','ค่าเดินทาง','อื่นๆ'];
  
  const escapeAttr = (s) => String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  
  container.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="color:var(--text2);border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left;padding:4px 6px;">รายละเอียด</th>' +
    '<th style="text-align:left;padding:4px 6px;width:140px;">หมวดหมู่</th>' +
    '<th style="text-align:right;padding:4px 6px;width:55px;">จำนวน</th>' +
    '<th style="text-align:right;padding:4px 6px;width:80px;">ราคา/หน่วย</th>' +
    '<th style="text-align:right;padding:4px 6px;width:80px;">ยอดรวม</th>' +
    '<th style="width:24px;"></th>' +
    '</tr></thead><tbody>' +
    items.map((it, idx) =>
      '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:4px 6px;"><input type="text" value="' + escapeAttr(it.desc||'') + '" oninput="_updateExpenseLineItem(' + idx + ', \'desc\', this.value)" style="width:100%;border:none;background:transparent;color:var(--text1);font-size:12px;"></td>' +
        '<td style="padding:4px 6px;"><select onchange="_updateExpenseLineItem(' + idx + ', \'cat\', this.value)" style="width:100%;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);font-size:12px;padding:2px 4px;">' +
          cats.map(c => '<option value="' + escapeAttr(c) + '" ' + (it.cat === c ? 'selected' : '') + '>' + c + '</option>').join('') +
        '</select></td>' +
        '<td style="padding:4px 6px;"><input type="number" value="' + (it.qty || 1) + '" min="0" oninput="_updateExpenseLineItem(' + idx + ', \'qty\', this.value)" style="width:50px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:12px;"></td>' +
        '<td style="padding:4px 6px;"><input type="number" value="' + (it.price || 0) + '" min="0" step="0.01" oninput="_updateExpenseLineItem(' + idx + ', \'price\', this.value)" style="width:75px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text1);padding:2px 4px;font-size:12px;"></td>' +
        '<td style="padding:4px 6px;text-align:right;font-weight:600;" id="exp2-row-' + idx + '">' + ((it.qty||1) * (it.price||0)).toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
        '<td><button type="button" onclick="_removeExpenseLineItem(' + idx + ')" style="border:none;background:none;cursor:pointer;color:#e74c3c;font-size:13px;">✕</button></td>' +
      '</tr>'
    ).join('') +
    '</tbody></table>';
  
  _recalcExpenseLineItemsTotal();
}

async function saveExpense(opts) {
  opts = opts || {};
  const printAfterSave = opts.print === true;
  
  await ensureSecondaryDB();
  const id     = document.getElementById('editExpenseId').value;
  const date   = document.getElementById('exp-date').value;
  const expType= document.getElementById('exp-type').value;
  const job    = document.getElementById('exp-job').value.trim();
  const _subEl = document.getElementById('exp-subtotal'); const sub = parseFloat(_subEl?.value || _subEl?.textContent?.replace(/[^0-9.]/g,''))||0;
  if (!date)    { toast('กรุณาระบุวันที่', 'warning'); return; }
  if (!job)     { toast('กรุณาระบุรายการ/ชื่องาน', 'warning'); return; }
  if (sub <= 0) { toast('กรุณาระบุยอดก่อน VAT (ต้องมากกว่า 0)', 'warning'); return; }

  const vatRate = parseFloat(document.getElementById('exp-vat-rate').value)||0;
  const whtRate = parseFloat(document.getElementById('exp-wht-rate').value)||0;
  const vatAmt  = sub * vatRate / 100;
  const whtAmt  = sub * whtRate / 100;
  const net     = sub + vatAmt - whtAmt;

  // Phase 4 Step E: รวม fields ของ flow เก่า — vendor info, items, bank
  const items = _readExpenseLineItems();

  const payload = {
    date, expense_type: expType,
    job,
    vendor_name:  document.getElementById('exp-vendor').value.trim()||null,
    vendor_addr:  document.getElementById('exp2-vendor-addr')?.value?.trim()||null,
    vendor_tax_id: document.getElementById('exp2-vendor-taxid')?.value?.trim()||null,
    reference_no: document.getElementById('exp-ref-no').value.trim()||null,
    period_month: parseInt(document.getElementById('exp-period-month').value)||null,
    period_year:  parseInt(document.getElementById('exp-period-year').value)||null,
    due_date:     document.getElementById('exp-due-date').value||null,
    subtotal: sub, vat_amt: vatAmt, wht_rate: whtRate, wht_amt: whtAmt, net,
    items: items.length > 0 ? items : null,
    pay_method:   document.getElementById('exp-pay-method').value,
    bank:         document.getElementById('exp2-bank')?.value?.trim()||null,
    bank_no:      document.getElementById('exp2-bank-no')?.value?.trim()||null,
    pay_date:     document.getElementById('exp2-pay-date')?.value||null,
    status:       document.getElementById('exp-status').value,
    paid_by:      document.getElementById('exp-paid-by').value.trim()||null,
    is_recurring: document.getElementById('exp-is-recurring').checked,
    recur_interval: document.getElementById('exp-is-recurring').checked ? parseInt(document.getElementById('exp-recur-interval').value)||null : null,
    note:         document.getElementById('exp-note').value.trim()||null,
    preparer:     currentUser?.displayName||'',
  };

  let savedId = id;
  let savedRecord = null;
  if (id) {
    const { data, error } = await supa.from('expenses').update(payload).eq('id',id).select().single();
    if (error) { toast('แก้ไขไม่สำเร็จ: '+error.message,'error'); return; }
    const idx = (db.expenses||[]).findIndex(r=>r.id===id);
    if (idx>=0) db.expenses[idx] = mapExpense(data);
    savedRecord = data;
  } else {
    // auto doc_no
  let docNo = null; try { const { data: seq } = await supa.rpc('get_next_doc_no',{p_module:'expense', p_category:null, p_year:null}); if(seq) docNo = seq; } catch(_){}
  if (docNo) payload.doc_no = docNo;
    const { data, error } = await supa.from('expenses').insert(payload).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if (!db.expenses) db.expenses = [];
    db.expenses.unshift(mapExpense(data));
    savedId = data.id;
    savedRecord = data;
  }
  toast(id?'แก้ไขค่าใช้จ่ายแล้ว':'บันทึกค่าใช้จ่ายแล้ว','success');
  logAudit('expenses', id?'edit':'add', id||'new', {job,type:expType,net});
  closeModal('modal-addExpense');
  // Defensive refresh: เรียก render ของหน้าที่ mounted อยู่เท่านั้น
  if (document.getElementById('expTable') && typeof renderExpenses === 'function') renderExpenses();
  if (document.getElementById('billing-table-body') && typeof renderBilling === 'function') renderBilling();
  
  // Phase 4 Step E: print after save (สำหรับปุ่ม "🖨️ บันทึก + พิมพ์ใบสำคัญจ่าย")
  if (printAfterSave && savedId && typeof printExpense === 'function') {
    setTimeout(() => { printExpense(savedId); }, 300);
  }
}

function editExpense(id) {
  const r = (db.expenses||[]).find(x=>x.id===id); if(!r) return;
  const modal = document.getElementById('modal-addExpense');
  const q = (eid) => modal ? modal.querySelector('#'+eid) : document.getElementById(eid);
  document.getElementById('editExpenseId').value = id;
  document.getElementById('addExpenseModalTitle').textContent = '✏️ แก้ไขค่าใช้จ่าย';
  q('exp-date').value         = r.date||'';
  q('exp-doc-no').value       = r.docNo||'';
  q('exp-type').value         = r.expenseType||'other';
  q('exp-job').value          = r.job||'';
  q('exp-vendor').value       = r.vendorName||'';
  q('exp-ref-no').value       = r.referenceNo||'';
  q('exp-period-month').value = r.periodMonth||'';
  q('exp-period-year').value  = r.periodYear||'';
  q('exp-due-date').value     = r.dueDate||'';
  q('exp-subtotal').value     = r.subtotal||'';
  q('exp-vat-rate').value     = r.vatAmt&&r.subtotal ? Math.round(r.vatAmt/r.subtotal*100) : '0';
  q('exp-wht-rate').value     = r.whtAmt&&r.subtotal ? Math.round(r.whtAmt/r.subtotal*100) : '0';
  q('exp-net').value          = r.net||'';
  q('exp-pay-method').value   = r.payMethod||'cash';
  q('exp-status').value       = r.status||'paid';
  q('exp-paid-by').value      = r.paidBy||'';
  q('exp-is-recurring').checked = r.isRecurring||false;
  q('exp-recurring-block').style.display = r.isRecurring?'':'none';
  q('exp-note').value         = r.note||'';
  
  // Phase 4 Step E: load fields ใหม่ (collapsible sections)
  // Vendor info
  if (q('exp2-vendor-addr'))  q('exp2-vendor-addr').value  = r.vendorAddr||'';
  if (q('exp2-vendor-taxid')) q('exp2-vendor-taxid').value = r.vendorTaxId||'';
  // Bank info
  if (q('exp2-bank'))    q('exp2-bank').value    = r.bank||'';
  if (q('exp2-bank-no')) q('exp2-bank-no').value = r.bankNo||'';
  if (q('exp2-pay-date')) q('exp2-pay-date').value = r.payDate||'';
  // Items (line items)
  if (q('exp2-items-data')) {
    const items = Array.isArray(r.items) ? r.items : [];
    q('exp2-items-data').value = JSON.stringify(items);
    if (typeof renderExpenseLineItems === 'function') renderExpenseLineItems();
  }
  // Auto-expand details ถ้ามีข้อมูล (UX: user เห็นเลยว่ามี vendor/items/bank)
  setTimeout(() => {
    const details = modal?.querySelectorAll('details') || [];
    details.forEach((d, idx) => {
      // idx 0 = vendor, 1 = items, 2 = bank
      if (idx === 0 && (r.vendorAddr || r.vendorTaxId)) d.open = true;
      else if (idx === 1 && Array.isArray(r.items) && r.items.length > 0) d.open = true;
      else if (idx === 2 && (r.bank || r.bankNo || r.payDate)) d.open = true;
    });
  }, 50);
  
  openModal('modal-addExpense');
}

async function deleteExpense(id) {
  await ensureSecondaryDB();
  const r = (db.expenses||[]).find(x=>x.id===id); if(!r) return;
  if (!confirm('ลบค่าใช้จ่าย "'+r.job+'" ?')) return;
  const { error } = await supa.from('expenses').delete().eq('id',id);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.expenses = (db.expenses||[]).filter(x=>x.id!==id);
  toast('ลบแล้ว','success');
  // Defensive refresh: เรียก render ของหน้าที่ mounted อยู่เท่านั้น
  if (document.getElementById('expTable') && typeof renderExpenses === 'function') renderExpenses();
  if (document.getElementById('billing-table-body') && typeof renderBilling === 'function') renderBilling();
}

function mapExpense(r) {
  return {
    id: r.id, docNo: r.doc_no||'', date: r.date||'',
    expenseType: r.expense_type||'operational', job: r.job||'',
    // Vendor info (จาก flow เก่า)
    vendorName: r.vendor_name||'', vendorAddr: r.vendor_addr||'', vendorTaxId: r.vendor_tax_id||'',
    // Reference + period (จาก flow ใหม่)
    referenceNo: r.reference_no||'',
    periodMonth: r.period_month, periodYear: r.period_year,
    dueDate: r.due_date||'', paidDate: r.paid_date||'', paidBy: r.paid_by||'',
    // Items (line items สำหรับใบสำคัญจ่าย)
    items: r.items||[],
    // Amounts
    subtotal: r.subtotal||0, vatAmt: r.vat_amt||0, totalVat: r.total_vat||0,
    whtRate: r.wht_rate||0, whtAmt: r.wht_amt||0, net: r.net||0,
    // Payment
    payMethod: r.pay_method||'cash', bank: r.bank||'', bankNo: r.bank_no||'',
    payDate: r.pay_date||'',
    status: r.status||'paid',
    // Recurring
    isRecurring: r.is_recurring||false, recurInterval: r.recur_interval,
    // Misc
    assetId: r.asset_id, note: r.note||'', preparer: r.preparer||'',
    createdAt: r.created_at||'', updatedAt: r.updated_at||'',
  };
}
