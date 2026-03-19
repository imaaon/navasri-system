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