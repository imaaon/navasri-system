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
      <button class="btn btn-ghost btn-sm" onclick="editExpense('${r.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteExpense('${r.id}')">🗑️</button>
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

async function saveExpense() {
  const id     = document.getElementById('editExpenseId').value;
  const date   = document.getElementById('exp-date').value;
  const expType= document.getElementById('exp-type').value;
  const job    = document.getElementById('exp-job').value.trim();
  const _subEl = document.getElementById('exp-subtotal'); const sub = parseFloat(_subEl?.value || _subEl?.textContent?.replace(/[^0-9.]/g,''))||0;
  if (!date || !job || sub <= 0) { toast('กรุณากรอกวันที่ รายการ และยอดเงิน', 'error'); return; }

  const vatRate = parseFloat(document.getElementById('exp-vat-rate').value)||0;
  const whtRate = parseFloat(document.getElementById('exp-wht-rate').value)||0;
  const vatAmt  = sub * vatRate / 100;
  const whtAmt  = sub * whtRate / 100;
  const net     = sub + vatAmt - whtAmt;

  const payload = {
    date, expense_type: expType,
    job,
    vendor_name:  document.getElementById('exp-vendor').value.trim()||null,
    reference_no: document.getElementById('exp-ref-no').value.trim()||null,
    period_month: parseInt(document.getElementById('exp-period-month').value)||null,
    period_year:  parseInt(document.getElementById('exp-period-year').value)||null,
    due_date:     document.getElementById('exp-due-date').value||null,
    subtotal: sub, vat_amt: vatAmt, wht_amt: whtAmt, net,
    pay_method:   document.getElementById('exp-pay-method').value,
    status:       document.getElementById('exp-status').value,
    paid_by:      document.getElementById('exp-paid-by').value.trim()||null,
    is_recurring: document.getElementById('exp-is-recurring').checked,
    recur_interval: document.getElementById('exp-is-recurring').checked ? parseInt(document.getElementById('exp-recur-interval').value)||null : null,
    note:         document.getElementById('exp-note').value.trim()||null,
    preparer:     currentUser?.displayName||'',
  };

  if (id) {
    const { data, error } = await supa.from('expenses').update(payload).eq('id',id).select().single();
    if (error) { toast('แก้ไขไม่สำเร็จ: '+error.message,'error'); return; }
    const idx = (db.expenses||[]).findIndex(r=>r.id===id);
    if (idx>=0) db.expenses[idx] = mapExpense(data);
  } else {
    // auto doc_no
  let docNo = null; try { const { data: seq } = await supa.rpc('get_next_doc_no',{p_module:'expense'}); if(seq) docNo = seq; } catch(_){}
  if (docNo) payload.doc_no = docNo;
    const { data, error } = await supa.from('expenses').insert(payload).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if (!db.expenses) db.expenses = [];
    db.expenses.unshift(mapExpense(data));
  }
  toast(id?'แก้ไขค่าใช้จ่ายแล้ว':'บันทึกค่าใช้จ่ายแล้ว','success');
  logAudit('expenses', id?'edit':'add', id||'new', {job,type:expType,net});
  closeModal('modal-addExpense');
  // Defensive refresh: เรียก render ของหน้าที่ mounted อยู่เท่านั้น
  if (document.getElementById('expTable') && typeof renderExpenses === 'function') renderExpenses();
  if (document.getElementById('billing-table-body') && typeof renderBilling === 'function') renderBilling();
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
  openModal('modal-addExpense');
}

async function deleteExpense(id) {
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
    id: r.id, docNo: r.doc_no, date: r.date,
    expenseType: r.expense_type, job: r.job,
    vendorName: r.vendor_name, referenceNo: r.reference_no,
    periodMonth: r.period_month, periodYear: r.period_year,
    dueDate: r.due_date, paidDate: r.paid_date, paidBy: r.paid_by,
    subtotal: r.subtotal, vatAmt: r.vat_amt, whtAmt: r.wht_amt, net: r.net,
    payMethod: r.pay_method, status: r.status,
    isRecurring: r.is_recurring, recurInterval: r.recur_interval,
    assetId: r.asset_id, note: r.note, preparer: r.preparer,
    createdAt: r.created_at,
  };
}
