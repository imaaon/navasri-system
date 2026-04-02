// ===== SUPPLIER MANAGEMENT MODULE =====
// นวศรี เนอร์สซิ่งโฮม — Phase 3 ERP

// ── Render ────────────────────────────────────────────────────
function renderSuppliers() {
  const search = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const statusF = document.getElementById('supplierStatusFilter')?.value || '';
  const tb = document.getElementById('supplierTable');
  if (!tb) return;

  let list = (db.suppliers || []).filter(s => {
    if (search && !s.name.toLowerCase().includes(search) &&
        !(s.code||'').toLowerCase().includes(search) &&
        !(s.phone||'').includes(search)) return false;
    if (statusF && s.status !== statusF) return false;
    return true;
  });

  document.getElementById('supplierCount').textContent = `ทั้งหมด: ${list.length} ราย`;

  if (list.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบข้อมูล</td></tr>';
    return;
  }

  tb.innerHTML = list.map((s, i) => `<tr>
    <td style="color:var(--text3);font-size:12px;">${i+1}</td>
    <td style="font-family:monospace;font-size:12px;">${s.code||'-'}</td>
    <td style="font-weight:600;">${s.name}<br><span style="font-size:11px;color:var(--text3);">${s.contactName||''}</span></td>
    <td style="font-size:12px;">${s.phone||'-'}</td>
    <td style="font-size:12px;color:var(--text2);">${s.email||'-'}</td>
    <td>${s.status==='active'?'<span class="badge badge-green">ใช้งาน</span>':'<span class="badge badge-gray">ปิด</span>'}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="editSupplier('${s.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteSupplier('${s.id}')">🗑️</button>
    </td>
  </tr>`).join('');
}

// ── Modal ─────────────────────────────────────────────────────
function openAddSupplierModal() {
  document.getElementById('editSupplierId').value = '';
  ['supplier-code','supplier-name','supplier-contact','supplier-phone',
   'supplier-email','supplier-address','supplier-taxid','supplier-note',
   'supplier-mobile','supplier-website','supplier-bank-name','supplier-bank-account-name','supplier-bank-account-no',
   'supplier-credit-days'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('supplier-status').value = 'active';
  document.querySelector('.modal-overlay#modal-addSupplier .modal-title').textContent = '+ เพิ่มผู้จำหน่าย';
  openModal('modal-addSupplier');
}

function editSupplier(id) {
  const s = (db.suppliers || []).find(x => x.id == id);
  if (!s) return;
  document.getElementById('editSupplierId').value = s.id;
  document.getElementById('supplier-code').value    = s.code || '';
  document.getElementById('supplier-name').value    = s.name;
  document.getElementById('supplier-contact').value = s.contactName || '';
  document.getElementById('supplier-phone').value   = s.phone || '';
  document.getElementById('supplier-email').value   = s.email || '';
  document.getElementById('supplier-address').value = s.address || '';
  document.getElementById('supplier-taxid').value   = s.taxId || '';
  document.getElementById('supplier-status').value  = s.status || 'active';
  document.getElementById('supplier-note').value    = s.note || '';
  document.querySelector('.modal-overlay#modal-addSupplier .modal-title').textContent = '✏️ แก้ไขผู้จำหน่าย';
  openModal('modal-addSupplier');
}

async function saveSupplier() {
  const editId = document.getElementById('editSupplierId').value;
  const name   = document.getElementById('supplier-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อผู้จำหน่าย', 'warning'); return; }

  const data = {
    supplier_code:  document.getElementById('supplier-code').value.trim() || null,
    supplier_name:  name,
    contact_name:   document.getElementById('supplier-contact').value.trim() || null,
    phone:          document.getElementById('supplier-phone').value.trim() || null,
    email:          document.getElementById('supplier-email').value.trim() || null,
    address:        document.getElementById('supplier-address').value.trim() || null,
    tax_id:         document.getElementById('supplier-taxid').value.trim() || null,
    status:         document.getElementById('supplier-status').value,
    note:           document.getElementById('supplier-note').value.trim() || null,
    entity_type:    document.getElementById('supplier-entity-type').value || 'นิติบุคคล',
    credit_days:    parseInt(document.getElementById('supplier-credit-days').value) || null,
    mobile:         document.getElementById('supplier-mobile').value.trim() || null,
    website:        document.getElementById('supplier-website').value.trim() || null,
    bank_name:      document.getElementById('supplier-bank-name').value.trim() || null,
    bank_account_name: document.getElementById('supplier-bank-account-name').value.trim() || null,
    bank_account_no:   document.getElementById('supplier-bank-account-no').value.trim() || null,
    updated_at:     new Date().toISOString(),
  };

  if (editId) {
    const { error } = await supa.from('suppliers').update(data).eq('id', editId);
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    const s = db.suppliers.find(x => x.id == editId);
    if (s) Object.assign(s, mapSupplier({ ...data, id: editId, created_at: s.createdAt }));
    toast('แก้ไขผู้จำหน่ายเรียบร้อย', 'success');
  } else {
    data.created_by = currentUser?.username || '';
    const { data: inserted, error } = await supa.from('suppliers').insert(data).select().single();
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    if (inserted) db.suppliers.push(mapSupplier(inserted));
    toast('เพิ่มผู้จำหน่ายเรียบร้อย', 'success');
  }
  closeModal('modal-addSupplier');
  renderSuppliers();
}

async function deleteSupplier(id) {
  if (!confirm('ลบผู้จำหน่ายนี้?')) return;
  const { error } = await supa.from('suppliers').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.suppliers = db.suppliers.filter(s => s.id != id);
  toast('ลบผู้จำหน่ายแล้ว', 'success');
  renderSuppliers();
}

// ── Purchase Request ──────────────────────────────────────────
let prItems = [];

function renderPurchaseRequests() {
  const statusF = document.getElementById('prStatusFilter')?.value || '';
  const tb = document.getElementById('prTable');
  if (!tb) return;

  let list = (db.purchaseRequests || []).filter(r =>
    !statusF || r.status === statusF
  );

  if (list.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3);">ไม่มีรายการ</td></tr>';
    return;
  }

  const urgencyBadge = u => u === 'urgent'   ? '<span class="badge badge-orange">ด่วน</span>'
                           : u === 'critical' ? '<span class="badge badge-red">เร่งด่วน</span>'
                           : '<span class="badge badge-gray">ปกติ</span>';
  const statusBadge = s => ({
    draft:     '<span class="badge badge-gray">ร่าง</span>',
    submitted: '<span class="badge badge-blue">ส่งแล้ว</span>',
    approved:  '<span class="badge badge-green">อนุมัติ</span>',
    rejected:  '<span class="badge badge-red">ไม่อนุมัติ</span>',
    ordered:   '<span class="badge badge-orange">สั่งซื้อแล้ว</span>',
    received:  '<span class="badge badge-green">รับแล้ว</span>',
    closed:    '<span class="badge badge-gray">ปิด</span>',
  }[s] || '<span class="badge badge-gray">'+s+'</span>');

  tb.innerHTML = list.map((r, i) => `<tr>
    <td style="font-size:12px;">${r.date||'-'}</td>
    <td style="font-family:monospace;font-size:12px;">${r.refNo||'-'}</td>
    <td style="font-weight:500;">${r.requesterName||'-'}</td>
    <td style="font-size:12px;">${r.supplierName||'-'}</td>
    <td>${urgencyBadge(r.urgency)}</td>
    <td>${statusBadge(r.status)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="viewPurchaseRequest('${r.id}')">👁</button>
      ${['draft','submitted'].includes(r.status) ? `<button class="btn btn-ghost btn-sm" onclick="approvePR('${r.id}')">✅</button>` : ''}
      ${r.status === 'draft' ? `<button class="btn btn-ghost btn-sm" onclick="deletePR('${r.id}')">🗑️</button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddPRModal() {
  prItems = [];
  document.getElementById('editPRId').value = '';
  document.getElementById('pr-requester').value = currentUser?.displayName || currentUser?.username || '';
  document.getElementById('pr-urgency').value = 'normal';
  document.getElementById('pr-note').value = '';
  // populate suppliers
  const sel = document.getElementById('pr-supplier');
  if (sel) {
    sel.innerHTML = '<option value="">-- ผู้จำหน่าย (ถ้าทราบ) --</option>' +
      (db.suppliers||[]).filter(s=>s.status==='active')
        .map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }
  renderPRItems();
  openModal('modal-addPR');
}

function renderPRItems() {
  const container = document.getElementById('pr-items-container');
  if (!container) return;
  if (prItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">ยังไม่มีรายการ — กดเพิ่ม</div>';
    return;
  }
  container.innerHTML = prItems.map((it, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <select class="form-control" style="flex:3;" onchange="prItemSelect(${i},this.value)">
        <option value="">-- เลือกสินค้า --</option>
        ${(db.items||[]).map(item=>`<option value="${item.id}" ${it.itemId==item.id?'selected':''}>${item.name}</option>`).join('')}
      </select>
      <input class="form-control number" type="number" min="1" value="${it.qty||1}" style="width:70px;"
        oninput="prItemQty(${i},this.value)" placeholder="จำนวน">
      <span style="font-size:12px;color:var(--text2);min-width:40px;">${it.unit||''}</span>
      <button class="btn btn-ghost btn-sm" onclick="removePRItem(${i})">✕</button>
    </div>`).join('');
}

function addPRItem() {
  prItems.push({ itemId: '', itemName: '', qty: 1, unit: '' });
  renderPRItems();
}

function prItemSelect(i, itemId) {
  const item = db.items.find(x => x.id == itemId);
  if (item) {
    prItems[i].itemId   = item.id;
    prItems[i].itemName = item.name;
    prItems[i].unit     = item.purchaseUnit || item.unit;
  }
  renderPRItems();
}

function prItemQty(i, val) {
  prItems[i].qty = parseFloat(val) || 1;
}

function removePRItem(i) {
  prItems.splice(i, 1);
  renderPRItems();
}

async function savePR(status = 'draft') {
  const requester = document.getElementById('pr-requester').value.trim();
  if (!requester) { toast('กรุณาระบุผู้ขอ', 'warning'); return; }

  const validItems = prItems.filter(it => it.itemId && it.qty > 0);
  if (validItems.length === 0) { toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'warning'); return; }

  const supplierId = document.getElementById('pr-supplier')?.value || null;
  const supplier   = supplierId ? db.suppliers.find(s => s.id == supplierId) : null;

  const { data: refData } = await supa.rpc('next_pr_ref_no').then(r => r).catch(() => ({ data: null }));
  const refNo = refData || ('PR-' + Date.now());

  const prData = {
    ref_no:         refNo,
    request_date:   new Date().toISOString().slice(0,10),
    requester_name: requester,
    supplier_id:    supplierId || null,
    supplier_name:  supplier?.name || null,
    urgency:        document.getElementById('pr-urgency').value,
    note:           document.getElementById('pr-note').value.trim() || null,
    required_date:  document.getElementById('pr-required-date').value || null,
    reason:         document.getElementById('pr-reason').value.trim() || null,
    status,
    created_by:     currentUser?.username || '',
  };

  const { data: inserted, error } = await supa.from('purchase_requests').insert(prData).select().single();
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }

  // บันทึก lines
  const lines = validItems.map(it => ({
    request_id:    inserted.id,
    item_id:       it.itemId,
    item_name:     it.itemName,
    qty_requested: it.qty,
    unit:          it.unit || '',
  }));
  await supa.from('purchase_request_lines').insert(lines);

  const pr = mapPurchaseRequest(inserted);
  pr.lines = lines;
  db.purchaseRequests.unshift(pr);

  toast(`บันทึกคำขอซื้อ ${refNo} เรียบร้อย`, 'success');
  closeModal('modal-addPR');
  renderPurchaseRequests();
}

async function approvePR(id) {
  if (!canApproveReq()) { toast('ไม่มีสิทธิ์อนุมัติ', 'error'); return; }
  const pr = db.purchaseRequests.find(r => r.id == id);
  if (!pr) return;
  const actor = currentUser?.displayName || currentUser?.username || '';
  const { error } = await supa.from('purchase_requests').update({
    status: 'approved', approved_by: actor, approved_at: new Date().toISOString()
  }).eq('id', id);
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
  pr.status = 'approved'; pr.approvedBy = actor;
  toast('อนุมัติคำขอซื้อแล้ว', 'success');
  renderPurchaseRequests();
}

async function deletePR(id) {
  if (!confirm('ลบคำขอซื้อนี้?')) return;
  const { error } = await supa.from('purchase_requests').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.purchaseRequests = db.purchaseRequests.filter(r => r.id != id);
  toast('ลบคำขอซื้อแล้ว', 'success');
  renderPurchaseRequests();
}

function viewPurchaseRequest(id) {
  const pr = db.purchaseRequests.find(r => r.id == id);
  if (!pr) return;
  toast(`${pr.refNo} — ${pr.status} (${pr.requesterName})`, 'info');
}

// ── Operational Reports ───────────────────────────────────────
async function renderStockReport() {
  const tab = document.getElementById('stock-report-tabs')?.dataset?.active || 'lowstock';
  renderStockReportTab(tab);
}

function switchStockReportTab(tab) {
  document.querySelectorAll('.sr-tab').forEach(el => {
    el.style.borderBottom = el.dataset.tab === tab ? '2px solid var(--accent)' : 'none';
    el.style.color = el.dataset.tab === tab ? 'var(--accent)' : 'var(--text2)';
    el.style.fontWeight = el.dataset.tab === tab ? '600' : '400';
  });
  document.querySelectorAll('.sr-section').forEach(el => {
    el.style.display = el.id === 'sr-' + tab ? '' : 'none';
  });
  renderStockReportTab(tab);
}

function renderStockReportTab(tab) {
  if (tab === 'lowstock')   renderLowStockReport();
  if (tab === 'expiry')     renderExpiryReport();
  if (tab === 'movement')   renderMovementSummary();
  if (tab === 'bysupplier') renderBySupplierReport();
  if (tab === 'trace') { document.getElementById('sr-trace-result').innerHTML = '<div style="padding:16px;color:var(--text3);">กรอกรหัสบาร์โค้ดแล้วกดค้นหา</div>'; }
}

function renderLowStockReport() {
  const el = document.getElementById('sr-lowstock');
  if (!el) return;
  const items = (db.items || []).filter(i => i.qty <= i.reorder).sort((a,b) => a.qty - b.qty);
  if (items.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);">ไม่มีสินค้าที่ต้องเติม 🎉</div>';
    return;
  }
  el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>รหัส</th><th>สินค้า</th><th>ประเภท</th>' +
    '<th style="text-align:right;">คงเหลือ</th>' +
    '<th style="text-align:right;">จุดสั่ง</th><th>สถานะ</th>' +
    '</tr></thead><tbody>' +
    items.map(i => {
      const status = i.qty <= 0 ? '<span class="badge badge-red">หมด</span>'
        : '<span class="badge badge-orange">ใกล้หมด</span>';
      return `<tr><td class="mono" style="font-size:11px;">${i.barcode||'-'}</td>` +
        `<td style="font-weight:500;">${i.name}</td>` +
        `<td style="font-size:12px;">${i.category||'-'}</td>` +
        `<td style="text-align:right;font-weight:600;color:var(--red);">${i.qty}</td>` +
        `<td style="text-align:right;color:var(--text2);">${i.reorder}</td>` +
        `<td>${status}</td></tr>`;
    }).join('') + '</tbody></table></div>';
}

function renderExpiryReport() {
  const el = document.getElementById('sr-expiry');
  if (!el) return;
  const today = new Date();
  const warn  = new Date(today); warn.setDate(warn.getDate() + 90);

  const lots = (db.itemLots || []).filter(l => {
    if (!l.expiryDate || l.qtyRemaining <= 0) return false;
    const exp = new Date(l.expiryDate);
    return exp <= warn;
  }).sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (lots.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);">ไม่มี lot ที่ใกล้หมดอายุ 🎉</div>';
    return;
  }

  el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>สินค้า</th><th>Lot</th><th>วันหมดอายุ</th>' +
    '<th style="text-align:right;">คงเหลือ</th><th>สถานะ</th>' +
    '</tr></thead><tbody>' +
    lots.map(l => {
      const item = db.items.find(i => i.id == l.itemId);
      const exp  = new Date(l.expiryDate);
      const diff = Math.ceil((exp - today) / 86400000);
      const status = diff <= 0 ? '<span class="badge badge-red">หมดอายุ</span>'
        : diff <= 30 ? '<span class="badge badge-red">< 30 วัน</span>'
        : '<span class="badge badge-orange">< 90 วัน</span>';
      return `<tr><td style="font-weight:500;">${item?.name||'-'}</td>` +
        `<td style="font-size:12px;">${l.lotNumber||'-'}</td>` +
        `<td style="font-size:12px;">${l.expiryDate}</td>` +
        `<td style="text-align:right;">${l.qtyRemaining} ${item?.unit||''}</td>` +
        `<td>${status}</td></tr>`;
    }).join('') + '</tbody></table></div>';
}

async function renderMovementSummary() {
  const el = document.getElementById('sr-movement');
  if (!el) return;
  const month = document.getElementById('sr-month')?.value || new Date().toISOString().slice(0,7);
  el.innerHTML = '<div style="text-align:center;padding:16px;">กำลังโหลด...</div>';

  const [y, m] = month.split('-');
  const { data } = await supa.from('stock_movements')
    .select('movement_type, quantity, items(name)')
    .gte('created_at', `${y}-${m}-01`).lte('created_at', `${y}-${m}-31`);

  if (!data || data.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  // สรุปตามประเภท
  const summary = {};
  data.forEach(r => {
    if (!summary[r.movement_type]) summary[r.movement_type] = 0;
    summary[r.movement_type] += parseFloat(r.quantity || 0);
  });

  const typeLabel = { receive:'รับเข้า', issue:'เบิกจ่าย', adjust:'ปรับ', return:'คืน' };
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">' +
    Object.entries(summary).map(([type, total]) =>
      `<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">` +
      `<div style="font-size:11px;color:var(--text3);">${typeLabel[type]||type}</div>` +
      `<div style="font-size:22px;font-weight:600;">${Math.round(total)}</div></div>`
    ).join('') + '</div>' +
    `<div style="font-size:12px;color:var(--text2);">รายการทั้งหมด: ${data.length} รายการในเดือนที่เลือก</div>`;
}

async function renderBySupplierReport() {
  const el = document.getElementById('sr-bysupplier');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:16px;">กำลังโหลด...</div>';

  const { data } = await supa.from('purchases')
    .select('supplier, cost, qty, item_name, date')
    .order('date', {ascending: false}).limit(500);

  if (!data || data.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);">ไม่มีข้อมูล</div>';
    return;
  }

  // สรุปตาม supplier
  const bySupplier = {};
  data.forEach(r => {
    const key = r.supplier || 'ไม่ระบุ';
    if (!bySupplier[key]) bySupplier[key] = { count: 0, total: 0 };
    bySupplier[key].count++;
    bySupplier[key].total += (r.cost||0) * (r.qty||0);
  });

  el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
    '<th>ผู้จำหน่าย</th><th style="text-align:right;">จำนวนครั้ง</th>' +
    '<th style="text-align:right;">มูลค่ารวม (฿)</th>' +
    '</tr></thead><tbody>' +
    Object.entries(bySupplier)
      .sort((a,b) => b[1].total - a[1].total)
      .map(([name, d]) =>
        `<tr><td style="font-weight:500;">${name}</td>` +
        `<td style="text-align:right;">${d.count}</td>` +
        `<td style="text-align:right;font-weight:600;">฿${d.total.toLocaleString()}</td></tr>`
      ).join('') + '</tbody></table></div>';
}

// ── Traceability ──────────────────────────────────────────────
async function renderTraceability() {
  const code = (document.getElementById('trace-barcode')?.value || '').trim();
  const el   = document.getElementById('sr-trace-result');
  if (!el) return;
  if (!code) { el.innerHTML = '<div style="padding:16px;color:var(--text3);">กรอกรหัสบาร์โค้ดหรือชื่อสินค้าแล้วกดค้นหา</div>'; return; }

  el.innerHTML = '<div style="padding:16px;text-align:center;">กำลังโหลด...</div>';

  // หา item จาก barcode หรือชื่อ
  const item = lookupItemByBarcode(code) ||
    (db.items||[]).find(i => i.name.toLowerCase().includes(code.toLowerCase()));

  if (!item) {
    el.innerHTML = '<div style="padding:16px;color:var(--red);">ไม่พบสินค้ารหัส/ชื่อ: ' + code + '</div>';
    return;
  }

  // ดึง stock_movements
  const { data: movements } = await supa.from('stock_movements')
    .select('*').eq('item_id', item.id).order('created_at', {ascending: false}).limit(50);

  // ดึง requisitions
  const reqs = (db.requisitions||[]).filter(r => r.itemId == item.id).slice(0,20);

  // ดึง purchases
  const purchases = (db.purchases||[]).filter(p => p.itemId == item.id).slice(0,10);

  const typeLabel = { receive:'รับเข้า', issue:'เบิกจ่าย', adjust:'ปรับ', return:'คืน', quick_dispense:'เบิกด่วน' };
  const typeBadge = { receive:'badge-green', issue:'badge-orange', adjust:'badge-blue', return:'badge-gray' };

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px;">' +
      '<div class="card-header"><div class="card-title" style="font-size:14px;">' +
        '📦 ' + item.name +
        ' <span style="font-family:monospace;font-size:12px;color:var(--text3);">' + (item.barcode||'') + '</span>' +
      '</div></div>' +
      '<div class="card-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">' +
        '<div style="text-align:center;"><div style="font-size:11px;color:var(--text3);">คงเหลือ</div>' +
          '<div style="font-size:20px;font-weight:600;">' + item.qty + ' ' + (item.unit||'') + '</div></div>' +
        '<div style="text-align:center;"><div style="font-size:11px;color:var(--text3);">รับเข้าทั้งหมด</div>' +
          '<div style="font-size:20px;font-weight:600;">' + purchases.length + ' ครั้ง</div></div>' +
        '<div style="text-align:center;"><div style="font-size:11px;color:var(--text3);">เบิกออกทั้งหมด</div>' +
          '<div style="font-size:20px;font-weight:600;">' + reqs.filter(r=>r.status==='approved').length + ' ครั้ง</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-header"><div class="card-title" style="font-size:13px;">📊 ประวัติการเคลื่อนไหว</div></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>วันที่</th><th>ประเภท</th><th style="text-align:right;">จำนวน</th>' +
        '<th style="text-align:right;">ก่อน→หลัง</th><th>หมายเหตุ</th>' +
      '</tr></thead><tbody>' +
      (movements && movements.length > 0
        ? movements.map(m => {
            const qty  = m.movement_type === 'issue' || m.movement_type === 'quick_dispense'
              ? '<span style="color:var(--red);">-' + m.quantity + '</span>'
              : '<span style="color:var(--green);">+' + m.quantity + '</span>';
            const badge = '<span class="badge ' + (typeBadge[m.movement_type]||'badge-gray') + '">' + (typeLabel[m.movement_type]||m.movement_type) + '</span>';
            const date = m.created_at ? m.created_at.slice(0,16).replace('T',' ') : '-';
            return '<tr><td style="font-size:12px;">' + date + '</td>' +
              '<td>' + badge + '</td>' +
              '<td style="text-align:right;font-weight:600;">' + qty + '</td>' +
              '<td style="text-align:right;font-size:12px;color:var(--text2);">' + (m.before_qty||0) + '→' + (m.after_qty||0) + '</td>' +
              '<td style="font-size:11px;color:var(--text3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (m.note||'') + '</td></tr>';
          }).join('')
        : '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล movement</td></tr>'
      ) +
      '</tbody></table></div>' +
    '</div>';
}

// ===== SUPPLIER INVOICE TRACKING (Phase 5) =====

function renderSupplierInvoices() {
  const statusF = document.getElementById('supInvStatusFilter')?.value || '';
  const suppF   = document.getElementById('supInvSupplierFilter')?.value || '';
  const tb = document.getElementById('supInvTable');
  if (!tb) return;

  let list = (db.supplierInvoices || []).filter(r => {
    if (statusF && r.status !== statusF) return false;
    if (suppF   && String(r.supplierId) !== String(suppF)) return false;
    return true;
  });

  document.getElementById('supInvCount').textContent = `ทั้งหมด: ${list.length} ใบ`;

  if (list.length === 0) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3);">ไม่มีข้อมูล</td></tr>';
    return;
  }

  const statusBadge = s => ({
    pending:   '<span class="badge badge-orange">รอจ่าย</span>',
    paid:      '<span class="badge badge-green">จ่ายแล้ว</span>',
    overdue:   '<span class="badge badge-red">เกินกำหนด</span>',
    cancelled: '<span class="badge badge-gray">ยกเลิก</span>',
  }[s] || '<span class="badge badge-gray">'+s+'</span>');

  tb.innerHTML = list.map(r => `<tr>
    <td style="font-size:12px;">${r.date||'-'}</td>
    <td style="font-family:monospace;font-size:12px;">${r.invoiceNo}</td>
    <td style="font-weight:500;">${r.supplierName}</td>
    <td style="text-align:right;">฿${(r.subtotal||0).toLocaleString()}</td>
    <td style="text-align:right;font-size:12px;color:var(--text2);">฿${(r.vatAmt||0).toLocaleString()}</td>
    <td style="text-align:right;font-weight:600;">฿${(r.total||0).toLocaleString()}</td>
    <td>${statusBadge(r.status)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="editSupplierInvoice('${r.id}')">✏️</button>
      ${r.status === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="markInvoicePaid('${r.id}')">✅ จ่ายแล้ว</button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddSupplierInvoiceModal() {
  document.getElementById('editSupInvId').value = '';
  document.getElementById('supinv-no').value    = 'INV-' + Date.now().toString().slice(-6);
  document.getElementById('supinv-date').value  = new Date().toISOString().slice(0,10);
  document.getElementById('supinv-due').value   = '';
  document.getElementById('supinv-note').value  = '';
  document.getElementById('supinv-subtotal').value = '';
  document.getElementById('supinv-vat').value   = '7';
  document.getElementById('supinv-total').value = '';
  // populate suppliers
  const sel = document.getElementById('supinv-supplier');
  if (sel) {
    sel.innerHTML = '<option value="">-- เลือกผู้จำหน่าย --</option>' +
      (db.suppliers||[]).filter(s=>s.status==='active')
        .map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }
  // populate PRs
  const prSel = document.getElementById('supinv-pr');
  if (prSel) {
    prSel.innerHTML = '<option value="">-- อ้างอิงคำขอซื้อ (ถ้ามี) --</option>' +
      (db.purchaseRequests||[]).filter(r=>['approved','ordered'].includes(r.status))
        .map(r=>`<option value="${r.id}">${r.refNo} - ${r.supplierName||'ไม่ระบุ'}</option>`).join('');
  }
  document.getElementById('supinv-status').value = 'pending';
  openModal('modal-addSupInv');
}

function calcSupInvTotal() {
  const sub = parseFloat(document.getElementById('supinv-subtotal').value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat').value) || 0;
  const vatAmt = sub * vat / 100;
  document.getElementById('supinv-total').value = (sub + vatAmt).toFixed(2);
}

async function saveSupplierInvoice() {
  const editId     = document.getElementById('editSupInvId').value;
  const invNo      = document.getElementById('supinv-no').value.trim();
  const supplierId = document.getElementById('supinv-supplier').value;
  const subtotal   = parseFloat(document.getElementById('supinv-subtotal').value) || 0;
  const vatRate    = parseFloat(document.getElementById('supinv-vat').value) || 0;

  if (!invNo)      { toast('กรุณาระบุเลขที่ใบแจ้งหนี้', 'warning'); return; }
  const supplierNameManual = document.getElementById('supinv-supplier-manual')?.value.trim() || '';
  if (!supplierId && !supplierNameManual) { toast('กรุณาเลือกหรือระบุชื่อผู้จำหน่าย', 'warning'); return; }
  if (subtotal <= 0) { toast('กรุณาระบุมูลค่า', 'warning'); return; }

  const supplier = db.suppliers.find(s => s.id == supplierId);
  const vatAmt   = subtotal * vatRate / 100;
  const total    = subtotal + vatAmt;

  const data = {
    invoice_no:          invNo,
    invoice_date:        document.getElementById('supinv-date').value,
    due_date:            document.getElementById('supinv-due').value || null,
    supplier_id:         supplierId,
    supplier_name:       supplier?.name || supplierNameManual || '',
    purchase_request_id: document.getElementById('supinv-pr').value || null,
    subtotal, vat_rate: vatRate, vat_amt: vatAmt, total,
    status:              document.getElementById('supinv-status').value,
    note:                document.getElementById('supinv-note').value.trim() || null,
    job_name:            document.getElementById('supinv-job-name').value.trim() || null,
    wht_rate:            parseFloat(document.getElementById('supinv-wht-rate').value) || 0,
    wht_amt:             (() => { const s2 = parseFloat(document.getElementById('supinv-subtotal').value)||0; const w = parseFloat(document.getElementById('supinv-wht-rate').value)||0; return s2 * w / 100; })(),
    net_payable:         (() => { const tot = parseFloat(document.getElementById('supinv-total').value)||0; const s2 = parseFloat(document.getElementById('supinv-subtotal').value)||0; const w = parseFloat(document.getElementById('supinv-wht-rate').value)||0; return tot - (s2 * w / 100); })(),
    updated_at:          new Date().toISOString(),
  };

  if (editId) {
    const { error } = await supa.from('supplier_invoices').update(data).eq('id', editId);
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    const inv = db.supplierInvoices.find(x => x.id == editId);
    if (inv) Object.assign(inv, mapSupplierInvoice({ ...data, id: editId, created_at: inv.createdAt }));
    if (typeof logAudit === 'function') logAudit('supplier', 'update', editId, { invoice_no: data.invoice_no, supplier: data.supplier_name, total: data.total });
    toast('แก้ไขใบแจ้งหนี้เรียบร้อย', 'success');
  } else {
    data.created_by = currentUser?.username || '';
    const { data: inserted, error } = await supa.from('supplier_invoices').insert(data).select().single();
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    if (inserted) db.supplierInvoices.unshift(mapSupplierInvoice(inserted));
    if (typeof logAudit === 'function') logAudit('supplier', 'create', inserted?.id || 'new', { invoice_no: data.invoice_no, supplier: data.supplier_name, total: data.total });
    toast('บันทึกใบแจ้งหนี้เรียบร้อย', 'success');
  }
  closeModal('modal-addSupInv');
  renderSupplierInvoices();
}

function editSupplierInvoice(id) {
  const inv = db.supplierInvoices.find(x => x.id == id);
  if (!inv) return;
  document.getElementById('editSupInvId').value    = inv.id;
  document.getElementById('supinv-no').value       = inv.invoiceNo;
  document.getElementById('supinv-date').value     = inv.date || '';
  document.getElementById('supinv-due').value      = inv.dueDate || '';
  document.getElementById('supinv-subtotal').value = inv.subtotal;
  document.getElementById('supinv-vat').value      = inv.vatRate;
  document.getElementById('supinv-total').value    = inv.total;
  document.getElementById('supinv-status').value   = inv.status;
  document.getElementById('supinv-note').value     = inv.note || '';
  const sel = document.getElementById('supinv-supplier');
  if (sel) { sel.innerHTML = '<option value="">--</option>' +
    (db.suppliers||[]).map(s=>`<option value="${s.id}" ${s.id==inv.supplierId?'selected':''}>${s.name}</option>`).join(''); }
  openModal('modal-addSupInv');
}

async function markInvoicePaid(id) {
  const inv = db.supplierInvoices.find(x => x.id == id);
  if (!inv) return;
  const paidDate = new Date().toISOString().slice(0,10);
  const { error } = await supa.from('supplier_invoices')
    .update({ status: 'paid', paid_date: paidDate, paid_amount: inv.total })
    .eq('id', id);
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
  inv.status = 'paid'; inv.paidDate = paidDate; inv.paidAmount = inv.total;
  toast('บันทึกการจ่ายเงินแล้ว', 'success');
  renderSupplierInvoices();
}

function populateSupInvFilters() {
  const sel = document.getElementById('supInvSupplierFilter');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">ทุกผู้จำหน่าย</option>' +
    (db.suppliers||[]).map(s=>`<option value="${s.id}" ${s.id==cur?'selected':''}>${s.name}</option>`).join('');
  if (cur) sel.value = cur;
}
