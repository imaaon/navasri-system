// ===== BILLING PRINT =====

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
    invoice:     {orig:'#2d4a38',copy:'#1a6b4a',origL:'#e8f5ee',copyL:'#e9f7ef',origB:'#c8e6d5',copyB:'#a9dfbf'},
    receipt:     {orig:'#1a5276',copy:'#117a8b',origL:'#eaf3fb',copyL:'#e8f8f5',origB:'#aed6f1',copyB:'#a2d9ce'},
    quotation:   {orig:'#b94000',copy:'#c0770a',origL:'#fef0e7',copyL:'#fef9e7',origB:'#f0b27a',copyB:'#f9e79f'},
    tax_invoice: {orig:'#6c3483',copy:'#9b59b6',origL:'#f5eef8',copyL:'#fdf2ff',origB:'#d2b4de',copyB:'#dda0dd'},
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
    // included items (ถ้า showIncluded = true)
    if (inv.showIncluded && (inv.includedItems||[]).length > 0) {
      rows.push({ name:'――― รายการที่รวมใน package (ไม่คิดเงิน) ―――', qty:'', unit:'', price:'', total:'' });
      (inv.includedItems||[]).forEach(function(it){
        rows.push({ name:it.name, qty:it.qty_limit||'-', unit:'', price:0, total:0, _included:true });
      });
    }

    const rowsHtml = rows.map((r,i)=>r.name.startsWith('―') ? `<tr><td colspan="5" style="padding:4px 11px;font-size:11px;color:#888;border-bottom:1px solid #f0f0f0;">${r.name}</td></tr>` : r._included ? `<tr><td style="border-bottom:1px solid #f0f0f0;padding:5px 11px;text-align:center;color:#999;font-size:11px;">✓</td><td colspan="3" style="border-bottom:1px solid #f0f0f0;padding:5px 11px;font-size:12px;color:#555;">${r.name}</td><td style="border-bottom:1px solid #f0f0f0;padding:5px 11px;text-align:right;font-size:11px;color:#27ae60;">รวมใน package</td></tr>` : `<tr>
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