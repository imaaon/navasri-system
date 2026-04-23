// ===== BILLING: CONTRACTS & RECEIPTS =====

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
  // ใช้ typeahead แทน select
  makeTypeahead({inputId:'ta-con-inp',listId:'ta-con-list',hiddenId:'ta-con-id',dataFn:()=>db.patients.filter(p=>p.status==='active').map(p=>({id:p.id,label:p.name}))});
  if (editId) {
    const c = (db.contracts||[]).find(x=>x.id==editId);
    if (c) {
      // set typeahead value
      const taInp = document.getElementById('ta-con-inp');
      const taId = document.getElementById('ta-con-id');
      if (taInp && taId) { taId.value = c.patientId; taInp.value = c.patientName||''; }
      document.getElementById('contract-name').value = c.name;
      document.getElementById('contract-billing-day').value = c.billingDay;
      document.getElementById('contract-due-days').value = c.dueDays;
      document.getElementById('contract-start').value = c.startDate||'';
      document.getElementById('contract-end').value   = c.endDate||'';
      document.getElementById('contract-note').value  = c.note||'';
      _contractItems = normalizeContractItems(c.items||[]);
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

// renderContractItems และ addContractItem อยู่ใน section ด้านล่าง

function updateContractTotal() {
  const total = getChargeItems(_contractItems).reduce((s,x)=>s+(x.amount||0),0);
  const el = document.getElementById('contract-total-display');
  if(el) el.textContent = formatThb(total);
}

async function saveContract() {
  const editId     = document.getElementById('contract-edit-id').value;
  const patientId  = document.getElementById('ta-con-id')?.value || document.getElementById('contract-patient')?.value || '';
  const name       = document.getElementById('contract-name').value.trim();
  if (!patientId) { toast('กรุณาเลือกผู้รับบริการ','warning'); return; }
  if (!name)      { toast('กรุณาระบุชื่อแพ็กเกจ','warning'); return; }
  if (!editId) {
    const existing = (db.contracts||[]).find(c => String(c.patientId)===String(patientId) && c.isActive);
    if (existing) { toast('ผู้รับบริการนี้มีแพ็กเกจ active อยู่แล้ว กรุณาปิดอันเก่าก่อนค่ะ','error'); return; }
  }
  const patient = db.patients.find(p=>String(p.id)===String(patientId));
  _contractItems = normalizeContractItems(_contractItems);
  const total = getChargeItems(_contractItems).reduce((s,x)=>s+(x.amount||0),0);
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
                <button class="btn btn-primary btn-sm" onclick="generateContractInvoice('${c.id}')">🧾 ออกบิล</button>
                <button class="btn btn-ghost btn-sm" onclick="openAddContractModal('${c.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteContract('${c.id}')" style="color:#e74c3c;">🗑️</button>
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

  // Build invoice items จาก charge items เท่านั้น (ไม่รวม included)
  const otherItems = getChargeItems(c.items||[]).map(item => ({ name:item.name, qty:1, price:item.amount }));

  // คำนวณ physio ส่วนเกิน package
  const physioRule = getPhysioRule(c.items||[]);
  if (physioRule && physioRule.sessions_included > 0) {
    const period = getBillingPeriod(c);
    if (period) {
      const { data: physioSessions } = await supa.from('physio_sessions').select('*')
        .eq('patient_id', c.patientId).is('invoice_id', null)
        .gte('session_date', period.start).lte('session_date', period.end);
      if (physioSessions && physioSessions.length > 0) {
        const allocated = allocatePhysioSessions(physioSessions, physioRule);
        if (allocated.extra_amount > 0) {
          const mins = allocated.charged.reduce(function(s,x){ return s+(x.duration_minutes||0); }, 0);
          otherItems.push({ name: 'กายภาพเกิน package '+allocated.charged.length+' sessions ('+mins+' นาที)', qty:1, price:allocated.extra_amount });
        }
        window._pendingPhysioSessions = physioSessions.map(function(s){ return s.id; });
      }
    }
  }

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
  // mark physio sessions
  if (window._pendingPhysioSessions && window._pendingPhysioSessions.length > 0) {
    await supa.from('physio_sessions').update({ invoice_id: inv.id, billed: true }).in('id', window._pendingPhysioSessions);
    window._pendingPhysioSessions = null;
  }
  if (!silent) {
    toast(`สร้างร่างบิล ${inv.docNo} สำหรับ ${c.patientName} เรียบร้อย`, 'success');
    switchBillingTab('invoices');
    renderBilling();
  }
}

// ===== CONTRACT PACKAGE UI =====

function renderContractItems() {
  var container = document.getElementById('contract-items-container');
  var normalized = normalizeContractItems(_contractItems);
  _contractItems = normalized;
  var chargeItems = _contractItems.map(function(item,i){ return {item,i}; }).filter(function(x){ return x.item.type==='charge'; });
  var productItems = _contractItems.map(function(item,i){ return {item,i}; }).filter(function(x){ return x.item.type==='product_included'; });
  var physioItem = _contractItems.map(function(item,i){ return {item,i}; }).find(function(x){ return x.item.type==='physio_included'; });

  var chargeHTML = chargeItems.map(function(x){
    var i = x.i; var item = x.item;
    return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<input class="form-control" value="'+(item.name||'')+'" placeholder="ชื่อรายการ เช่น ค่าดูแลรายเดือน" oninput="_contractItems['+i+'].name=this.value;updateContractTotal()">' +
      '<input class="form-control number" type="number" value="'+(item.amount||0)+'" placeholder="0" style="width:130px;" oninput="_contractItems['+i+'].amount=parseFloat(this.value)||0;updateContractTotal()">' +
      '<button class="btn btn-ghost btn-sm" onclick="_contractItems.splice('+i+',1);renderContractItems()">✕</button>' +
      '</div>';
  }).join('');

  var productHTML = productItems.map(function(x){
    var i = x.i; var item = x.item;
    var qtyVal = item.qty_limit !== null && item.qty_limit !== undefined ? item.qty_limit : '';
    return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<div style="font-size:13px;font-weight:500;">'+(item.name||'-')+'<div style="font-size:11px;color:var(--text3);">'+item.item_id+'</div></div>' +
      '<div style="font-size:12px;color:var(--text2);">จำกัด:</div>' +
      '<input class="form-control number" type="number" value="'+qtyVal+'" placeholder="ไม่จำกัด" style="width:100px;" oninput="_contractItems['+i+'].qty_limit=this.value?parseInt(this.value):null">' +
      '<button class="btn btn-ghost btn-sm" onclick="_contractItems.splice('+i+',1);renderContractItems()">✕</button>' +
      '</div>';
  }).join('');

  var physioHTML = '';
  if (physioItem) {
    var pi = physioItem.i; var pitem = physioItem.item;
    physioHTML = '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:8px;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;">' +
        '<div class="form-group" style="margin:0;">' +
          '<label style="font-size:11px;color:var(--text3);">จำนวน session ที่รวม</label>' +
          '<input class="form-control number" type="number" value="'+(pitem.sessions_included||0)+'" min="0" oninput="_contractItems['+pi+'].sessions_included=parseInt(this.value)||0">' +
        '</div>' +
        '<div class="form-group" style="margin:0;">' +
          '<label style="font-size:11px;color:var(--text3);">ราคา/ชม. ที่เกิน (บาท)</label>' +
          '<input class="form-control number" type="number" value="'+(pitem.rate_per_hour_extra||0)+'" min="0" oninput="_contractItems['+pi+'].rate_per_hour_extra=parseFloat(this.value)||0">' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" style="margin-top:18px;" onclick="_contractItems.splice('+pi+',1);renderContractItems()">✕</button>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML =
    '<div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;">• รายการคิดเงิน</div>' +
    (chargeHTML || '<div style="font-size:12px;color:var(--text3);padding:6px;">ยังไม่มีรายการ</div>') +
    '<button class="btn btn-ghost btn-sm" onclick="addChargeItem()" style="margin-bottom:12px;">+ เพิ่มรายการคิดเงิน</button>' +
    '<div style="font-size:12px;font-weight:700;color:var(--text3);margin:4px 0 6px;">• สินค้าที่รวมใน package (ไม่คิดเงิน)</div>' +
    (productHTML || '<div style="font-size:12px;color:var(--text3);padding:6px;">ยังไม่มีรายการ</div>') +
    '<button class="btn btn-ghost btn-sm" onclick="openAddIncludedProductModal()" style="margin-bottom:12px;">+ เพิ่มสินค้าใน package</button>' +
    '<div style="font-size:12px;font-weight:700;color:var(--text3);margin:4px 0 6px;">• กายภาพที่รวมใน package</div>' +
    (physioHTML || '<div style="font-size:12px;color:var(--text3);padding:6px;">ยังไม่มี</div>') +
    (!physioItem ? '<button class="btn btn-ghost btn-sm" onclick="addPhysioIncluded()">+ เพิ่มกายภาพใน package</button>' : '');

  updateContractTotal();
}

function addChargeItem() {
  _contractItems.push({ type:'charge', name:'', amount:0 });
  renderContractItems();
}

function addPhysioIncluded() {
  var existing = _contractItems.find(function(i){ return i.type === 'physio_included'; });
  if (existing) { toast('มีกายภาพใน package อยู่แล้วค่ะ', 'warning'); return; }
  _contractItems.push({ type:'physio_included', sessions_included:0, rate_per_hour_extra:0 });
  renderContractItems();
}

function openAddIncludedProductModal() {
  var items = db.items || [];
  var opts = items.map(function(it){ return '<option value="'+it.id+'">'+it.name+'</option>'; }).join('');
  var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:8px;" id="add-included-panel">' +
    '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">เลือกสินค้าจากระบบ</div>' +
    '<select id="inc-item-select" class="form-control" style="margin-bottom:8px;"><option value="">เลือกสินค้า...</option>'+opts+'</select>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<label style="font-size:12px;white-space:nowrap;">จำนวนจำกัด (0 = ไม่จำกัด):</label>' +
      '<input type="number" id="inc-qty-limit" class="form-control number" min="0" value="0" style="width:100px;">' +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-primary btn-sm" onclick="confirmAddIncludedProduct()">เพิ่ม</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'add-included-panel\').remove()">ยกเลิก</button>' +
    '</div>' +
  '</div>';
  var container = document.getElementById('contract-items-container');
  var panel = document.createElement('div');
  panel.innerHTML = html;
  container.appendChild(panel);
}

function confirmAddIncludedProduct() {
  var sel = document.getElementById('inc-item-select');
  var itemId = sel.value;
  var qtyLimit = parseInt(document.getElementById('inc-qty-limit').value) || 0;
  if (!itemId) { toast('กรุณาเลือกสินค้า', 'warning'); return; }
  var item = (db.items||[]).find(function(it){ return String(it.id) === String(itemId); });
  if (!item) return;
  var already = _contractItems.find(function(ci){ return ci.type==='product_included' && String(ci.item_id)===String(itemId); });
  if (already) { toast('สินค้านี้มีอยู่ใน package แล้วค่ะ', 'warning'); return; }
  _contractItems.push({ type:'product_included', item_id:itemId, name:item.name, qty_limit: qtyLimit > 0 ? qtyLimit : null });
  renderContractItems();
}
