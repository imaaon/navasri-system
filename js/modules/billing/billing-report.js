// ===== BILLING REPORT =====

function openQuickInvoiceModal() {
  // Check role permission
  const role = currentUser?.role;
  if (!['admin','manager','officer'].includes(role)) {
    toast('ไม่มีสิทธิ์สร้างใบวางบิล','error'); return;
  }
  initBilling();

  // Reset typeahead patient
  const qiInp = document.getElementById('ta-qi-inp');
  const qiHid = document.getElementById('ta-qi-id');
  if(qiInp) qiInp.value = '';
  if(qiHid) qiHid.value = '';
  if(typeof makeTypeahead==='function') makeTypeahead({inputId:'ta-qi-inp',listId:'ta-qi-list',hiddenId:'ta-qi-id',dataFn:()=>taPatients(true)});

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
  const patId    = document.getElementById('ta-qi-id').value;
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
    r.date >= dateFrom && r.date <= dateTo && !r.invoiceId
  );

  // รวมจาก reqGroups ด้วย
  const groupItems = [];
  (db.reqGroups||[]).forEach(g => {
    if (String(g.patientId || g.patient_id) === String(patId) &&
        g.status === 'approved' &&
        g.date >= dateFrom && g.date <= dateTo) {
      (g.items||[]).forEach(it => groupItems.push({
        itemId: it.itemId || it.item_id || null,
        name: it.name || it.itemName || '',
        qty:  it.qty  || it.quantity || 1,
        price: it.price || it.unitPrice || 0,
      }));
    }
  });

  // === Phase 1 fix: รวม logic เดียวกับ loadRequisitionsForInvoice() ===
  // Phase 1.5 fix: package logic override isBillable
  //   - ถ้า item อยู่ใน package → ใช้ package logic (qty_limit) — ไม่สนใจ isBillable
  //   - ถ้าไม่อยู่ใน package + isBillable=false → ฟรีตลอด ไม่ขึ้นในบิล
  const contract = (typeof getActiveContract === 'function') ? getActiveContract(patId) : null;
  const includedProducts = contract ? getIncludedProducts(contract.items||[]) : [];
  const packagedItemIds = new Set((includedProducts||[]).map(p => String(p.item_id)));

  // Phase 0: รองรับใบเบิกหลายรายการ — flatten lines
  const allItems = [];
  reqs.forEach(r => {
    const lines = (r.lines && r.lines.length > 0)
      ? r.lines
      : [{ itemId: r.itemId, itemName: r.itemName||r.name, qty: r.quantity||r.qty||1, unitPrice: r.price||r.unit_price||0 }];
    lines.forEach(l => {
      const iid = l.itemId || l.item_id;
      const item = (db.items||[]).find(i => String(i.id) === String(iid) || i.name === l.itemName);
      // Phase 1.5: package items override isBillable check
      // Phase 1.6: ทุกรายการเข้าใบบิล — นอก package คิดเงินทุกชิ้น (เลิกใช้ isBillable filter)
      const key = item?.id || l.itemName || '';
      if (!key) return;
      const price = l.unitPrice || (item?.price) || (item?.cost) || 0;
      allItems.push({
        itemId: iid,
        name: l.itemName || item?.name || key,
        qty: l.qty || 1,
        price: price,
        unit: l.unit || item?.dispenseUnit || item?.unit || '',
        category: item?.category || 'เวชภัณฑ์'
      });
    });
  });
  // Group items (legacy) — ตรวจ isBillable + package override เหมือนกัน
  groupItems.forEach(it => {
    const item = (db.items||[]).find(i => String(i.id) === String(it.itemId) || i.name === it.name);
    // Phase 1.6: ทุกรายการเข้าบิล (เลิกใช้ isBillable filter)
    allItems.push({
      itemId: it.itemId,
      name: it.name,
      qty: it.qty,
      price: it.price,
      unit: '',
      category: item?.category || 'เวชภัณฑ์'
    });
  });

  // แยก package items (free/charged) ออกจาก billable items
  const allocated = (typeof allocateIncludedProducts === 'function')
    ? allocateIncludedProducts(allItems, includedProducts)
    : { billable: allItems, included: [] };

  // รวม billable items ที่ชื่อเดียวกัน (จาก allocated.billable + charge_qty ของ included)
  const medMap = {};
  const getItemCategory = (name) => {
    const found = (db.items||[]).find(i => i.name === name);
    return found ? (found.category || 'เวชภัณฑ์') : 'เวชภัณฑ์';
  };
  allocated.billable.forEach(it => {
    const key = it.name || '';
    if (!key) return;
    if (!medMap[key]) medMap[key] = { name: key, qty: 0, price: it.price || 0, category: it.category || getItemCategory(key) };
    medMap[key].qty += (it.qty || 0);
  });
  // included items ที่ qty_limit เกิน → charge_qty ส่วนที่เกินก็ต้องคิดเงิน
  const includedMap = {};
  allocated.included.forEach(it => {
    const key = it.name || '';
    if (!key) return;
    if (!includedMap[key]) includedMap[key] = { name: key, qty: 0, price: it.price || 0, unit: it.unit, category: it.category || getItemCategory(key), is_included: true };
    includedMap[key].qty += (it.free_qty || 0);
    // Phase 1.6 fix: ลบการนับ charge_qty (มีอยู่ใน allocated.billable แล้ว)
  });
  const medItems = Object.values(medMap).filter(i => i.name && i.qty > 0);
  const includedItems = Object.values(includedMap).filter(i => i.name && i.qty > 0);

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

  // เลือกผู้รับบริการ (ผ่าน typeahead)
  const taInvId = document.getElementById('ta-inv-id');
  const taInvInp = document.getElementById('ta-inv-inp');
  if (taInvId) taInvId.value = String(patId);
  if (taInvInp) {
    const pat = db.patients.find(p=>String(p.id)===String(patId));
    taInvInp.value = pat ? pat.name : '';
  }
  // Auto-fill room rate + label from patient's bed
  onInvoicePatientChange();
  // Enable room checkbox if rate was found
  const roomRate = parseFloat(document.getElementById('inv-room-rate').value||0);
  // ===== Issue 2: ตรวจค่าห้องซ้ำในเดือนเดียวกัน (Step 4) =====
  // ตรวจ invoice เก่าที่ทับซ้อน period — ถ้ามี room_total > 0 → ไม่ติ๊ก
  var roomDup = (db.invoices || []).find(function(inv) {
    if (inv.patientId !== patId) return false;
    if (!inv.roomEnabled || (parseFloat(inv.roomTotal) || 0) <= 0) return false;
    // ทับซ้อน period: ใช้ inv.date เทียบ — ถ้า dateFrom <= inv.date <= dateTo ถือว่าซ้ำ
    if (!inv.date) return false;
    return inv.date >= dateFrom && inv.date <= dateTo;
  });
  var roomBlocked = !!roomDup;
  if (roomBlocked) {
    toast('ค่าห้องในช่วงนี้ถูกเรียกเก็บในใบบิล ' + (roomDup.docNo || '-') + ' แล้วค่ะ', 'info');
  }
  if (roomRate > 0 && !roomBlocked) document.getElementById('inv-room-enabled').checked = true;

  // ใส่รายการเบิกสินค้าที่ดึงมา (Phase 1 fix: รวม included items ที่ฟรีตามแพ็คเกจด้วย)
  document.getElementById('inv-req-items-data').value   = JSON.stringify(medItems);
  const incEl = document.getElementById('inv-included-items-data');
  if (incEl) incEl.value = JSON.stringify(includedItems);
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
  // ===== Step 4.5: Auto-load physio sessions ใน Quick =====
  // เรียกหลัง openModal — ให้ autoFillPhysio ทำงานเอง (handle case ไม่มี session, แล้วซ้ำ ฯลฯ)
  setTimeout(function() {
    if (typeof autoFillPhysioToInvoice === 'function') {
      autoFillPhysioToInvoice();
    }
  }, 250);

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
  // Bug A+B fix: settings.value เก็บเป็น TEXT (JSON string) ใน DB
  // ต้อง parse string → object ก่อนใช้ (pattern เดียวกับ lineSettings ใน db.js)
  const find = key => {
    const raw = (settingsData||[]).find(s=>s.key===key)?.value;
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;  // already parsed
    try { return JSON.parse(raw); } catch(e) {
      console.warn('[loadBillingFromSettings] failed to parse '+key+':', e);
      return null;
    }
  };
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
  // Bug 2.2 fix: load banks list
  _bsBanks = Array.isArray(bs.banks) ? JSON.parse(JSON.stringify(bs.banks)) : [];
  bsRenderBanks();
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
    // Bug 2.2 fix: persist banks
    banks: Array.isArray(_bsBanks) ? _bsBanks : [],
  };
  db.billingSettings=bs;
  await saveBillingDB();
  toast('บันทึกการตั้งค่าแล้ว','success');
}

// ── BANK ACCOUNTS (Bug 2.2 fix) ──────────────────────
let _bsBanks = [];
let _bsBankFormOpen = false;

function bsRenderBanks() {
  const container = document.getElementById('bs-banks-list');
  if (!container) return;
  // Inline escape helper — กัน XSS เผื่อ ในกรณีนี้ความเสี่ยงต่ำ (admin-only)
  const _esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  if (!Array.isArray(_bsBanks) || _bsBanks.length === 0) {
    container.innerHTML = _bsBankFormOpen ? '' : '<div style="color:var(--muted);font-size:13px;padding:8px 0;">ยังไม่มีบัญชีธนาคาร — กด "+ เพิ่มธนาคาร" เพื่อเริ่ม</div>';
    if (_bsBankFormOpen) container.innerHTML += bsBankFormHtml();
    return;
  }
  const rows = _bsBanks.map((b, i) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--bg-card,#fff);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">
            ${b.primary ? '<span style="color:var(--green,#27ae60);font-size:12px;">★ บัญชีหลัก</span> ' : ''}
            ${_esc(b.bankName||'-')} • ${_esc(b.accountNo||'-')}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">
            ชื่อบัญชี: ${_esc(b.accountName||'-')}
            ${b.accountType ? ' • ' + _esc(b.accountType) : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="bsRemoveBank(${i})" title="ลบ" style="color:var(--red,#e74c3c);">✕</button>
      </div>
    </div>
  `).join('');
  container.innerHTML = rows + (_bsBankFormOpen ? bsBankFormHtml() : '');
}

function bsBankFormHtml() {
  return `
    <div id="bs-bank-form" style="border:1px dashed var(--primary,#1abc9c);border-radius:8px;padding:12px;margin-top:8px;background:var(--bg-soft,#f7fafa);">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;">เพิ่มบัญชีธนาคารใหม่</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:12px;">ธนาคาร *</label>
          <input class="form-control" id="bs-bank-name" placeholder="เช่น ธ.กสิกรไทย">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:12px;">เลขที่บัญชี *</label>
          <input class="form-control" id="bs-bank-no" placeholder="เช่น 123-4-56789-0">
        </div>
        <div class="form-group" style="margin:0;grid-column:span 2;">
          <label class="form-label" style="font-size:12px;">ชื่อบัญชี *</label>
          <input class="form-control" id="bs-bank-account-name" placeholder="เช่น บริษัท นวศรี เนอร์สซิ่งโฮม จำกัด">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:12px;">ประเภทบัญชี</label>
          <select class="form-control" id="bs-bank-type">
            <option value="ออมทรัพย์">ออมทรัพย์</option>
            <option value="กระแสรายวัน">กระแสรายวัน</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;display:flex;align-items:flex-end;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="bs-bank-primary"> เป็นบัญชีหลัก
          </label>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="bsSaveBank()">บันทึก</button>
        <button class="btn btn-ghost btn-sm" onclick="bsCancelBank()">ยกเลิก</button>
      </div>
    </div>
  `;
}

function bsAddBank() {
  if (_bsBankFormOpen) return; // already open
  _bsBankFormOpen = true;
  bsRenderBanks();
  setTimeout(()=>{ document.getElementById('bs-bank-name')?.focus(); }, 50);
}

function bsCancelBank() {
  _bsBankFormOpen = false;
  bsRenderBanks();
}

function bsSaveBank() {
  const bankName = document.getElementById('bs-bank-name')?.value.trim() || '';
  const accountNo = document.getElementById('bs-bank-no')?.value.trim() || '';
  const accountName = document.getElementById('bs-bank-account-name')?.value.trim() || '';
  const accountType = document.getElementById('bs-bank-type')?.value || 'ออมทรัพย์';
  const primary = !!document.getElementById('bs-bank-primary')?.checked;

  if (!bankName) { toast('กรุณาระบุชื่อธนาคาร','warning'); return; }
  if (!accountNo) { toast('กรุณาระบุเลขที่บัญชี','warning'); return; }
  if (!accountName) { toast('กรุณาระบุชื่อบัญชี','warning'); return; }

  // ถ้า primary=true ให้ uncheck primary ของบัญชีเก่า (มีได้แค่ 1 บัญชีหลัก)
  if (primary) {
    _bsBanks.forEach(b => { b.primary = false; });
  }

  _bsBanks.push({ bankName, accountNo, accountName, accountType, primary });
  _bsBankFormOpen = false;
  bsRenderBanks();
  toast('เพิ่มบัญชีธนาคารแล้ว — กด "บันทึก" เพื่อจัดเก็บ','info');
}

function bsRemoveBank(idx) {
  if (!Array.isArray(_bsBanks) || idx < 0 || idx >= _bsBanks.length) return;
  if (!confirm('ลบบัญชีธนาคารนี้?')) return;
  _bsBanks.splice(idx, 1);
  bsRenderBanks();
  toast('ลบแล้ว — กด "บันทึก" เพื่อจัดเก็บ','info');
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


// =======================================================
// ── INCIDENT & WOUND CARE SYSTEM ────────────────────────
// =======================================================