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
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบข้อมูล</td></tr>';
    return;
  }

  tb.innerHTML = list.map((s, i) => `<tr>
    <td style="color:var(--text3);font-size:12px;">${i+1}</td>
    <td style="font-family:monospace;font-size:12px;">${s.code||'-'}</td>
    <td style="font-weight:600;">${s.name}<br><span style="font-size:11px;color:var(--text3);">${s.contactName||''}</span></td>
    <td style="font-size:12px;">${s.entityType||'-'}</td>
    <td style="font-size:12px;">${s.phone||'-'}</td>
    <td style="font-size:12px;">${s.mobile||'-'}</td>
    <td style="font-size:12px;color:var(--text2);">${s.email||'-'}</td>
    <td style="font-size:12px;">${s.taxId||'-'}</td>
    <td style="font-size:12px;text-align:center;white-space:nowrap;">${s.creditDays!=null?s.creditDays+' วัน':'-'}</td>
    <td style="font-size:12px;">${s.bankName||'-'}</td>
    <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.address||''}">${s.address||'-'}</td>
    <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.note||''}">${s.note||'-'}</td>
    <td>${s.status==='active'?'<span class="badge badge-green">ใช้งาน</span>':'<span class="badge badge-gray">ปิด</span>'}</td>
    <td>
            <button class="btn btn-ghost btn-sm" title="ดูรายละเอียด" onclick="viewSupplier('${s.id}')">&#128065;</button>
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
  document.getElementById('supplier-entity-type').value        = s.entityType || 'นิติบุคคล';
  document.getElementById('supplier-credit-days').value        = s.creditDays != null ? s.creditDays : '';
  if(document.getElementById('supplier-mobile')) document.getElementById('supplier-mobile').value = s.mobile || '';
  if(document.getElementById('supplier-website')) document.getElementById('supplier-website').value = s.website || '';
  document.getElementById('supplier-bank-name').value          = s.bankName || '';
  document.getElementById('supplier-bank-account-name').value  = s.bankAccountName || '';
  document.getElementById('supplier-bank-account-no').value    = s.bankAccountNo || '';
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
    mobile:         document.getElementById('supplier-mobile')?.value?.trim() || null,
    website:        document.getElementById('supplier-website')?.value?.trim() || null,
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

// ── PR Permission ──────────────────────────────────
function canApproveReq() {
  return true;
}

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
    <td style="font-size:12px;white-space:nowrap;">${r.requiredDate||'-'}</td>
    <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.reason||''}">${r.reason||''-''}</td>
    <td>${statusBadge(r.status)}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" title="ดูรายละเอียด" onclick="viewPurchaseRequest('${r.id}')">&#128065;</button>
      <button class="btn btn-ghost btn-sm" title="แก้ไข" onclick="editPR('${r.id}')">&#9999;&#65039;</button>
      ${['draft','submitted'].includes(r.status) ? `<button class="btn btn-ghost btn-sm" title="อนุมัติ" onclick="approvePR('${r.id}')">&#9989;</button>` : ''}
      ${['draft','submitted'].includes(r.status) ? `<button class="btn btn-ghost btn-sm" title="ปฏิเสธ" onclick="rejectPR('${r.id}')">&#10060;</button>` : ''}
      ${(r.status !== 'approved' || canApproveReq()) ? `<button class="btn btn-ghost btn-sm" title="ลบ" onclick="deletePR('${r.id}')">&#128465;&#65039;</button>` : ''}
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
  const sel = document.getElementById("ta-prs-id");
  if (sel) {
    sel.innerHTML = '<option value="">-- ผู้จำหน่าย (ถ้าทราบ) --</option>' +
      (db.suppliers||[]).filter(s=>s.status==='active')
        .map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }
  renderPRItems();
  updatePRRequesterList();
  const rdEl = document.getElementById('pr-required-date'); if(rdEl) rdEl.value = '';
  const rsEl = document.getElementById('pr-reason'); if(rsEl) rsEl.value = '';
  ensureSuppliersLoaded('ta-prs-inp','ta-prs-list','ta-prs-id');
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
    <div style="margin-bottom:10px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <select class="form-control" style="flex:1;min-width:0;" onchange="prItemSelect(${i},this.value)">
          <option value="">-- เลือกจากคลังสินค้า --</option>
          ${(db.items||[]).map(item=>`<option value="${item.id}" ${it.itemId==item.id?'selected':''}>${item.name}</option>`).join('')}
        </select>
        <input class="form-control" type="number" min="1" value="${it.qty||1}" style="width:72px;flex-shrink:0;"
          oninput="prItemQty(${i},this.value)" placeholder="จำนวน">
        <span style="font-size:12px;color:var(--text2);min-width:24px;flex-shrink:0;">${it.unit||''}</span>
        <button class="btn btn-ghost btn-sm" style="flex-shrink:0;" onclick="removePRItem(${i})">&#10005;</button>
      </div>
      <input class="form-control" type="text" placeholder="หรือพิมพ์ชื่อรายการเอง..." value="${it.customName||''}"
        oninput="prItemCustomName(${i},this.value)" style="font-size:12px;margin-top:4px;">
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
    prItems[i].customName = '';
  }
  renderPRItems();
}

function prItemQty(i, val) {
  prItems[i].qty = parseFloat(val) || 1;
}

function prItemCustomName(i, val) {
  prItems[i].customName = val;
  if (val.trim()) prItems[i].itemName = val.trim();
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
  const supplierId = document.getElementById("ta-prs-id")?.value || null;
  const supplier = supplierId ? db.suppliers.find(s => s.id == supplierId) : null;
  const editId = document.getElementById('editPRId')?.value || null;
  const prData = {
    request_date: new Date().toISOString().slice(0,10),
    requester_name: requester,
    supplier_id: supplierId || null,
    supplier_name: supplier?.name || null,
    urgency: document.getElementById('pr-urgency').value,
    note: document.getElementById('pr-note').value.trim() || null,
    required_date: document.getElementById('pr-required-date').value || null,
    reason: document.getElementById('pr-reason').value.trim() || null,
    status,
  };
  let prId = editId;
  let refNo = '';
  if (editId) {
    const { error } = await supa.from('purchase_requests').update(prData).eq('id', editId);
    if (error) { toast('แก้ไขไม่สำเร็จ: ' + error.message, 'error'); return; }
    const pr = db.purchaseRequests.find(r => r.id == editId);
    if (pr) {
      Object.assign(pr, mapPurchaseRequest({...prData, id: editId, ref_no: pr.refNo,
        approved_by: pr.approvedBy, approved_at: pr.approvedAt,
        reject_reason: pr.rejectReason, created_by: pr.createdBy, created_at: pr.createdAt}));
    }
    refNo = db.purchaseRequests.find(r => r.id == editId)?.refNo || String(editId);
    await supa.from('purchase_request_lines').delete().eq('request_id', editId);
  } else {
    const { data: refData } = await supa.rpc('next_pr_ref_no').then(r => r).catch(() => ({ data: null }));
    refNo = refData || ('PR-' + Date.now());
    const insertData = { ...prData, ref_no: refNo, created_by: currentUser?.username || '' };
    const { data: inserted, error } = await supa.from('purchase_requests').insert(insertData).select().single();
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    prId = inserted.id;
    refNo = inserted.ref_no || refNo;
    const pr = mapPurchaseRequest(inserted);
    pr.lines = [];
    db.purchaseRequests.unshift(pr);
  }
  const linesData = validItems.map(it => ({
    request_id: prId,
    item_id: it.itemId,
    item_name: it.itemName,
    qty_requested: it.qty,
    unit: it.unit || '',
  }));
  await supa.from('purchase_request_lines').insert(linesData);
  toast('บันทึกคำขอซื้อ ' + refNo + ' เรียบร้อย', 'success');
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
  const pr = db.purchaseRequests.find(r => r.id == id);
  if (!pr) return;
  if (pr.status === 'approved' && !canApproveReq()) {
    toast('เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้นที่ลบคำขอที่อนุมัติแล้วได้', 'error'); return;
  }
  if (!confirm('ลบคำขอซื้อ ' + (pr.refNo || id) + '?')) return;
  await supa.from('purchase_request_lines').delete().eq('request_id', id);
  const { error } = await supa.from('purchase_requests').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.purchaseRequests = db.purchaseRequests.filter(r => r.id != id);
  toast('ลบคำขอซื้อแล้ว', 'success');
  renderPurchaseRequests();
}

function viewPurchaseRequest(id) {
  const pr = db.purchaseRequests.find(r => r.id == id); if (!pr) return;
  const smap = {draft:'ร่าง',submitted:'ยื่นยันแล้ว',approved:'✅ อนุมัติ',rejected:'❌ ปฏิเสธ',ordered:'สั่งซื้อแล้ว',received:'รับแล้ว',cancelled:'ยกเลิก'};
  const urgMap = {normal:'ปกติ',urgent:'ด่วน',critical:'ด่วนมาก'};
  const field=(lb,val)=>val?`<div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:11px;color:var(--text3);">${lb}</span><span style="font-size:13px;font-weight:500;">${val}</span></div>`:'';
  const items=(pr.items||[]);
  const itemsHtml=items.length?items.map(it=>`<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--border);font-size:12px;"><span>${it.itemName||it.item_name||'-'}</span><span style="color:var(--text3);">${it.qty||0} ${it.unit||''}</span><span style="font-weight:500;text-align:right;">${it.note||''}</span></div>`).join(''):'<p style="font-size:12px;color:var(--text3);">ไม่มีรายการ</p>';
  document.getElementById('view-pr-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${field('เลขที่',pr.refNo)}${field('วันที่สร้าง',pr.createdAt?.slice(0,10)||pr.date||'')}
      ${field('สถานะ',smap[pr.status]||pr.status)}${field('ความเร่งด่วน',urgMap[pr.urgency]||pr.urgency)}
      ${field('ผู้ขอ',pr.requesterName)}${field('ผู้จำหน่าย',pr.supplierName||'-')}
      ${field('วันต้องการรับ',pr.requiredDate||'-')}${field('อนุมัติ/ปฏิเสธโดย',pr.approvedBy||'-')}
    </div>
    ${pr.reason?`<div style="margin-bottom:14px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">เหตุผล</div><div style="font-size:13px;background:var(--surface2);padding:10px 12px;border-radius:6px;line-height:1.6;">${pr.reason}</div></div>`:''}
    ${pr.rejectReason?`<div style="margin-bottom:14px;"><div style="font-size:11px;color:#c0392b;margin-bottom:4px;">เหตุผลปฏิเสธ</div><div style="font-size:13px;background:#fdf2f2;padding:10px 12px;border-radius:6px;color:#c0392b;">${pr.rejectReason}</div></div>`:''}
    ${items.length?`<hr style="margin:12px 0;border-color:var(--border);"><div style="font-size:12px;font-weight:500;margin-bottom:8px;">📦 รายการสินค้า</div>${itemsHtml}`:''}
  `;
  openModal('modal-view-pr');
}

async function editPR(id) {
  const pr = db.purchaseRequests.find(r => r.id == id);
  if (!pr) return;
  const { data: linesData } = await supa.from('purchase_request_lines').select('*').eq('request_id', id);
  prItems = (linesData || []).map(l => ({
    itemId: l.item_id, itemName: l.item_name,
    qty: l.qty_requested, unit: l.unit || '',
  }));
  const sel = document.getElementById("ta-prs-id");
  if (sel) {
    sel.innerHTML = '<option value="">― ผู้จำหน่าย (ถ้าทราบ) ―</option>' +
      (db.suppliers||[]).filter(s=>s.status==='active')
        .map(s=>'<option value="' + s.id + '">' + s.name + '</option>').join('');
  }
  updatePRRequesterList();
  document.getElementById('editPRId').value = id;
  document.getElementById('pr-requester').value = pr.requesterName || '';
  if (sel) sel.value = pr.supplierId || '';
  document.getElementById('pr-urgency').value = pr.urgency || 'normal';
  document.getElementById('pr-note').value = pr.note || '';
  const rdEl = document.getElementById('pr-required-date'); if (rdEl) rdEl.value = pr.requiredDate || '';
  const rsEl = document.getElementById('pr-reason'); if (rsEl) rsEl.value = pr.reason || '';
  renderPRItems();
  openModal('modal-addPR');
}

async function rejectPR(id) {
  const pr = db.purchaseRequests.find(r => r.id == id);
  if (!pr) return;
  if (!canApproveReq()) { toast('ไม่มีสิทธิ์ปฏิเสธคำขอ', 'error'); return; }
  const ex = document.getElementById('modal-reject-pr');
  if (ex) ex.remove();
  const overlay = document.createElement('div');
  overlay.id = 'modal-reject-pr';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface,#fff);border-radius:12px;padding:24px;width:420px;max-width:95vw;';
  box.innerHTML =
    '<div style="font-size:15px;font-weight:600;margin-bottom:16px;">❌ ปฏิเสธคำขอซื้อ: ' + pr.refNo + '</div>' +
    '<div class="form-group"><label class="form-label">เหตุผลที่ปฏิเสธ *</label>' +
    '<textarea class="form-control" id="reject-reason-input" rows="3" placeholder="ระบุเหตุผล..." style="margin-top:6px;"></textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">' +
    '<button class="btn btn-ghost" id="reject-cancel-btn">ยกเลิก</button>' +
    '<button class="btn btn-primary" id="reject-confirm-btn" style="background:#e74c3c;border-color:#e74c3c;">ปฏิเสธ</button></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.getElementById('reject-cancel-btn').onclick = function() { overlay.remove(); };
  document.getElementById('reject-confirm-btn').onclick = async function() {
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) { toast('กรุณาระบุเหตุผล', 'warning'); return; }
    const actor = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
    const { error } = await supa.from('purchase_requests').update({
      status: 'rejected', reject_reason: reason,
      approved_by: actor, approved_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    pr.status = 'rejected'; pr.rejectReason = reason; pr.approvedBy = actor;
    overlay.remove();
    toast('ปฏิเสธคำขอซื้อแล้ว', 'success');
    renderPurchaseRequests();
  };
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

  document.getElementById('supInvCount').textContent = 'ทั้งหมด: ' + list.length + ' ใบ';

  if (list.length === 0) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">ไม่มีข้อมูล</td></tr>';
    return;
  }

  const statusBadge = s => ({
    draft:     '<span class="badge" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);">ร่าง</span>',
    confirmed: '<span class="badge" style="background:#e3f0ff;color:#1a5fb4;">&#9989; รับแล้ว</span>',
    pending:   '<span class="badge badge-orange">รอจ่าย</span>',
    paid:      '<span class="badge badge-green">จ่ายแล้ว</span>',
    overdue:   '<span class="badge badge-red">เกินกำหนด</span>',
    cancelled: '<span class="badge badge-gray">ยกเลิก</span>',
  }[s] || '<span class="badge badge-gray">'+s+'</span>');

  tb.innerHTML = list.map(r => {
    const lines = (db.supplierInvoiceLines||[]).filter(l=>l.invoice_id==r.id||l.invoiceId==r.id)
    const linesHtml = lines.length ? lines.map(l=>{
      const typeLabel = {product:'สินค้า',shipping:'ค่าขนส่ง',service:'บริการ',discount:'ส่วนลด',other:'อื่นๆ'}[l.line_type||l.lineType]||'สินค้า'
      const stockMark = (l.update_stock||l.updateStock) ? '&#128230;' : ''
      return '<tr style="background:var(--surface2);font-size:12px;">'+
        '<td colspan="2" style="padding:4px 8px;color:var(--text3);">'+stockMark+' '+typeLabel+'</td>'+
        '<td style="padding:4px 8px;">'+( l.item_name||l.itemName||'-')+'</td>'+
        '<td colspan="2" style="padding:4px 8px;text-align:right;">'+
          (l.qty||0)+' '+(l.unit||'')+' × &#3647;'+(l.unit_price||l.unitPrice||0).toLocaleString()+
        '</td>'+
        '<td style="padding:4px 8px;text-align:right;font-weight:600;">&#3647;'+(l.total||0).toLocaleString()+'</td>'+
        '<td colspan="3" style="padding:4px 8px;color:var(--text3);font-size:11px;">'+
          (l.lot_number||l.lotNumber?'Lot: '+(l.lot_number||l.lotNumber)+' ':'')+
          (l.expiry_date||l.expiryDate?'หมดอายุ: '+(l.expiry_date||l.expiryDate):'')+'</td>'+
        '</tr>'
    }).join('') : ''
    const stockUpdatedBadge = r.isStockUpdated
      ? '<span style="font-size:11px;color:#1a5fb4;">&#128230;สต็อกแล้ว</span>'
      : (r.status==='draft'?'<span style="font-size:11px;color:var(--text3);">ยังไม่รับ</span>':'')
    return '<tr>'+
      '<td style="font-size:12px;">'+(r.date||'-')+'</td>'+
      '<td style="font-family:monospace;font-size:12px;min-width:130px;white-space:nowrap;">'+r.invoiceNo+'</td>'+
      '<td style="font-weight:500;min-width:180px;">'+r.supplierName+'<br><span style="font-size:11px;color:var(--text3);">'+(r.receivedBy?'ผู้รับ: '+r.receivedBy:'')+'</span></td>'+
      '<td style="text-align:right;">&#3647;'+(r.subtotal||0).toLocaleString()+'</td>'+
      '<td style="text-align:right;font-size:12px;color:var(--text2);">&#3647;'+(r.vatAmt||0).toLocaleString()+'</td>'+
      '<td style="text-align:right;font-weight:600;">&#3647;'+(r.total||0).toLocaleString()+'</td>'+
      '<td>'+statusBadge(r.status)+'<br>'+stockUpdatedBadge+'</td>'+
      '<td>'+
        '<button class="btn btn-ghost btn-sm" title="ดูรายละเอียด" onclick="viewSupInv('+r.id+')">&#128065;</button>'+'<button class="btn btn-ghost btn-sm" onclick="editSupplierInvoice('+r.id+')">&#9998;</button>'+
        (r.status==='draft'?'<button class="btn btn-ghost btn-sm" style="color:var(--primary)" onclick="confirmInvoiceStock('+r.id+')">&#128230; ยืนยัน</button>':'')+
        (r.status==='pending'||r.status==='confirmed'?'<button class="btn btn-ghost btn-sm" onclick="markInvoicePaid('+r.id+')">&#9989; จ่าย</button>':'')+
        (r.status==='draft'&&(currentUser?.role==='admin'||currentUser?.role==='manager')?'<button class="btn btn-ghost btn-sm" style="color:#e74c3c;" onclick="deleteSupplierInvoice('+r.id+',\''+r.invoiceNo+'\')">&#128465;</button>':'')+
      '</td>'+
      '</tr>'+
      linesHtml
  }).join('');
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
  const sel = document.getElementById("ta-sis-id");
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
  document.getElementById('supinv-status').value = 'draft';
  // reset new fields
  (function(){var _v='';var _h=document.getElementById("ta-sis-id");if(_h)_h.value=_v||"";var _i=document.getElementById("ta-sis-inp");if(_i){var _all=(db.patients||[]).concat(db.staff||[]).concat(db.suppliers||[]);var _p=_all.find(x=>String(x.id)===String(_v));_i.value=_p?(_p.name||""):"";}})();
  document.getElementById('supinv-received-date').value  = new Date().toISOString().slice(0,10);
  document.getElementById('supinv-received-by').value    = '';
  document.getElementById('supinv-job-name').value       = '';
  document.getElementById('supinv-wht-rate').value       = '0';
  document.getElementById('supinv-net-payable').value    = '';
  const lc = document.getElementById('supinv-lines-container'); if(lc) lc.innerHTML = '';
  const ls = document.getElementById('supinv-lines-summary'); if(ls) ls.textContent = '';
  ensureSuppliersLoaded('ta-sis-inp','ta-sis-list','ta-sis-id');
  openModal('modal-addSupInv');
  // inject scan button
  setTimeout(() => {
    if (!document.getElementById('scan-supinv-btn')) {
      const hdr = document.querySelector('#modal-addSupInv .modal-header');
      if (hdr) {
        const btn = document.createElement('button');
        btn.id = 'scan-supinv-btn';
        btn.className = 'btn btn-ghost btn-sm';
        btn.style.cssText = 'margin-right:8px;font-size:13px;gap:4px;display:flex;align-items:center;';
        btn.innerHTML = '📷 สแกนใบแจ้งหนี้';
        btn.onclick = function() { scanSupplierInvoice(); };
        hdr.insertBefore(btn, hdr.querySelector('.modal-close'));
      }
    }
  }, 50);
}

function calcSupInvTotal() {
  const sub = parseFloat(document.getElementById('supinv-subtotal').value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat').value) || 0;
  const vatAmt = sub * vat / 100;
  document.getElementById('supinv-total').value = (sub + vatAmt).toFixed(2);
}

function calcSupInvNet() {
  const sub = parseFloat(document.getElementById('supinv-subtotal')?.value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat')?.value) || 0;
  const wht = parseFloat(document.getElementById('supinv-wht-rate')?.value) || 0;
  const total = sub * (1 + vat/100);
  const whtAmt = sub * wht / 100;
  const net = total - whtAmt;
  const el = document.getElementById('supinv-net-payable');
  if (el) el.value = net.toFixed(2);
}

function updatePRRequesterList() {
  const dl = document.getElementById('pr-requester-list');
  if (!dl) return;
  const staff = (db.staff || []).filter(s => s.status === 'active' || !s.status);
  dl.innerHTML = staff.map(s => `<option value="${s.name}">`).join('');
}

function calcSupInvNet() {
  const sub = parseFloat(document.getElementById('supinv-subtotal')?.value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat')?.value) || 0;
  const wht = parseFloat(document.getElementById('supinv-wht-rate')?.value) || 0;
  const total = sub * (1 + vat/100);
  const whtAmt = sub * wht / 100;
  const net = total - whtAmt;
  const el = document.getElementById('supinv-net-payable');
  if (el) el.value = net.toFixed(2);
}

function updatePRRequesterList() {
  const dl = document.getElementById('pr-requester-list');
  if (!dl) return;
  const staff = (db.staff || []).filter(s => s.status === 'active' || !s.status);
  dl.innerHTML = staff.map(s => `<option value="${s.name}">`).join('');
}

function calcSupInvNet() {
  const sub = parseFloat(document.getElementById('supinv-subtotal')?.value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat')?.value) || 0;
  const wht = parseFloat(document.getElementById('supinv-wht-rate')?.value) || 0;
  const total = sub * (1 + vat/100);
  const whtAmt = sub * wht / 100;
  const net = total - whtAmt;
  const el = document.getElementById('supinv-net-payable');
  if (el) el.value = net.toFixed(2);
}

function updatePRRequesterList() {
  const dl = document.getElementById('pr-requester-list');
  if (!dl) return;
  const staff = (db.staff || []).filter(s => s.status === 'active' || !s.status);
  dl.innerHTML = staff.map(s => `<option value="${s.name}">`).join('');
}

function calcSupInvNet() {
  const sub = parseFloat(document.getElementById('supinv-subtotal')?.value) || 0;
  const vat = parseFloat(document.getElementById('supinv-vat')?.value) || 0;
  const wht = parseFloat(document.getElementById('supinv-wht-rate')?.value) || 0;
  const total = sub * (1 + vat/100);
  const whtAmt = sub * wht / 100;
  const net = total - whtAmt;
  const el = document.getElementById('supinv-net-payable');
  if (el) el.value = net.toFixed(2);
}

function updatePRRequesterList() {
  const dl = document.getElementById('pr-requester-list');
  if (!dl) return;
  const staff = (db.staff || []).filter(s => s.status === 'active' || !s.status);
  dl.innerHTML = staff.map(s => `<option value="${s.name}">`).join('');
}

function viewSupInv(id) {
  const r = db.supplierInvoices.find(x => x.id == id); if (!r) return;
  const lines = (db.supplierInvoiceLines||[]).filter(l=>l.invoice_id==r.id||l.invoiceId==r.id);
  const smap = {'draft':'ร่าง','confirmed':'✅ รับสินค้าแล้ว','pending':'รอจ่าย','paid':'จ่ายแล้ว','overdue':'เกินกำหนด','cancelled':'ยกเลิก'};
  const field = (lb,val) => val ? `<div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:11px;color:var(--text3);">${lb}</span><span style="font-size:13px;font-weight:500;">${val}</span></div>` : '';
  const linesHtml = lines.length ? lines.map(l=>`<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--border);font-size:12px;"><span>${l.item_name||'-'}</span><span style="color:var(--text3);">${l.qty||0} ${l.unit||''}</span><span style="font-weight:500;text-align:right;">&#3647;${(l.total||0).toLocaleString()}</span></div>`).join('') : '<p style="font-size:12px;color:var(--text3);">ไม่มีรายการ</p>';
  document.getElementById('view-supinv-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${field('เลขที่ใบแจ้งหนี้',r.invoiceNo)}${field('วันที่',r.date)}${field('ผู้จำหน่าย',r.supplierName)}${field('ชื่องาน',r.jobName)}${field('วันครบกำหนด',r.dueDate)}${field('ผู้รับสินค้า',r.receivedBy)}${field('สถานะ',smap[r.status]||r.status)}
    </div>
    <hr style="margin:12px 0;border-color:var(--border);">
    <div style="font-size:12px;font-weight:500;margin-bottom:8px;">📦 รายการสินค้า</div>
    ${linesHtml}
    <div style="display:flex;justify-content:flex-end;gap:20px;margin-top:10px;font-size:13px;">
      <span style="color:var(--text3);">ก่อน VAT <b>&#3647;${(r.subtotal||0).toLocaleString()}</b></span>
      <span style="color:var(--text3);">VAT <b>&#3647;${(r.vatAmt||0).toLocaleString()}</b></span>
      <span style="font-size:14px;font-weight:600;">ยอดชำระ &#3647;${(r.netPayable||r.total||0).toLocaleString()}</span>
    </div>`;
  openModal('modal-view-supinv');
}

function viewSupplier(id) {
  const s = db.suppliers.find(x => x.id == id); if (!s) return;
  const field = (lb,val) => val ? `<div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:11px;color:var(--text3);">${lb}</span><span style="font-size:13px;font-weight:500;">${val}</span></div>` : '';
  document.getElementById('view-supplier-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${field('รหัส',s.supplierCode)}${field('ประเภท',s.entityType)}${field('ชื่อ / ผู้ติดต่อ',s.name)}${field('เลขภาษี',s.taxId)}${field('โทร',s.phone)}${field('มือถือ',s.mobile)}${field('อีเมล',s.email)}${field('เครดิต',s.creditDays!=null?s.creditDays+' วัน':'')}${field('ธนาคาร',s.bankName)}${field('สถานะ',s.status==='active'?'ใช้งาน':'ปิด')}
    </div>
    <hr style="margin:12px 0;border-color:var(--border);">
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${field('ที่อยู่',s.address)}${field('หมายเหตุ',s.note)}
    </div>`;
  openModal('modal-view-supplier');
}

async function saveSupplierInvoice(andConfirm = false) {
  const editId     = document.getElementById('editSupInvId').value;
  const invNo      = document.getElementById('supinv-no').value.trim();
  const supplierId = document.getElementById("ta-sis-id").value;
  const supplierNameManual = document.getElementById('supinv-supplier-manual')?.value.trim() || '';
  if (!invNo) { toast('กรุณาระบุเลขที่ใบแจ้งหนี้', 'warning'); return; }
  if (!supplierId && !supplierNameManual) { toast('กรุณาเลือกหรือระบุชื่อผู้จำหน่าย', 'warning'); return; }

  const supplier   = db.suppliers.find(s => s.id == supplierId);
  const subtotal   = parseFloat(document.getElementById('supinv-subtotal').value) || 0;
  const vatRate    = parseFloat(document.getElementById('supinv-vat').value) || 0;
  const vatAmt     = subtotal * vatRate / 100;
  const total      = subtotal + vatAmt;
  const whtRate    = parseFloat(document.getElementById('supinv-wht-rate').value) || 0;
  const whtAmt     = subtotal * whtRate / 100;
  const netPayable = total - whtAmt;

  // status: ถ้า andConfirm ให้เป็น 'confirmed', ไม่งั้นใช้ค่าใน select
  let status = document.getElementById('supinv-status').value;
  if (andConfirm) status = 'confirmed';

  const prId = document.getElementById('supinv-pr').value || null;

  const data = {
    invoice_no:          invNo,
    invoice_date:        document.getElementById('supinv-date').value,
    due_date:            document.getElementById('supinv-due').value || null,
    supplier_id:         supplierId || null,
    supplier_name:       supplier?.name || supplierNameManual || '',
    purchase_request_id: prId,
    subtotal, vat_rate: vatRate, vat_amt: vatAmt, total,
    status,
    note:                document.getElementById('supinv-note').value.trim() || null,
    job_name:            document.getElementById('supinv-job-name').value.trim() || null,
    wht_rate:            whtRate, wht_amt: whtAmt, net_payable: netPayable,
    received_date:       andConfirm ? (document.getElementById('supinv-received-date').value || new Date().toISOString().slice(0,10)) : (document.getElementById('supinv-received-date').value || null),
    received_by:         document.getElementById('supinv-received-by').value.trim() || null,
    is_stock_updated:    andConfirm,
    updated_at:          new Date().toISOString(),
  };

  let invoiceId = editId;

  if (editId) {
    const { error } = await supa.from('supplier_invoices').update(data).eq('id', editId);
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    const inv = db.supplierInvoices.find(x => x.id == editId);
    if (inv) Object.assign(inv, mapSupplierInvoice({ ...data, id: editId, created_at: inv.createdAt }));
    if (typeof logAudit === 'function') logAudit('supplier', 'update', editId, { invoice_no: data.invoice_no, total: data.total });
    toast('แก้ไขใบแจ้งหนี้เรียบร้อย', 'success');
  } else {
    data.created_by = currentUser?.username || '';
    const { data: inserted, error } = await supa.from('supplier_invoices').insert(data).select().single();
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    if (inserted) { db.supplierInvoices.unshift(mapSupplierInvoice(inserted)); invoiceId = inserted.id; }
    if (typeof logAudit === 'function') logAudit('supplier', 'create', inserted?.id || 'new', { invoice_no: data.invoice_no, total: data.total });
    toast(andConfirm ? 'บันทึกและเพิ่มสต็อกเรียบร้อย' : 'บันทึกร่างเรียบร้อย', 'success');
  }

  // บันทึก invoice lines (ถ้ามี) และ stock movements (ถ้า confirm)
  if (invoiceId) {
    await saveSupInvLines(invoiceId, andConfirm);
    // ถ้ามี PO ให้ link ด้วย
    if (prId && !editId) {
      await supa.from('supplier_invoice_links').upsert(
        { invoice_id: invoiceId, purchase_request_id: prId, linked_by: currentUser?.username || '' },
        { onConflict: 'invoice_id,purchase_request_id', ignoreDuplicates: true }
      );
    }
  }

  closeModal('modal-addSupInv');
  renderSupplierInvoices();
}

async function saveSupInvLines(invoiceId, updateStock) {
  const container = document.getElementById('supinv-lines-container');
  if (!container) return;
  const rows = container.querySelectorAll('.supinv-line-row');
  if (!rows.length) return;

  // ลบ lines เดิมของ invoice นี้ก่อน (ถ้ามี)
  await supa.from('supplier_invoice_lines').delete().eq('invoice_id', invoiceId);

  const linesToInsert = [];
  rows.forEach(row => {
    const itemId    = row.getAttribute('data-item-id') || null;
    const itemName  = row.querySelector('.siline-name')?.value.trim() || '';
    const qty       = parseFloat(row.querySelector('.siline-qty')?.value) || 0;
    const unit      = row.querySelector('.siline-unit')?.value.trim() || '';
    const unitPrice = parseFloat(row.querySelector('.siline-price')?.value) || 0;
    const lineType  = row.querySelector('.siline-type')?.value || 'product';
    const lotNumber = row.querySelector('.siline-lot')?.value.trim() || null;
    const expiryDate = row.querySelector('.siline-expiry')?.value || null;
    if (!itemName || qty <= 0) return;
    linesToInsert.push({
      invoice_id: invoiceId,
      item_id:    itemId || null,
      item_name:  itemName,
      qty, unit, unit_price: unitPrice,
      total:      qty * unitPrice,
      line_type:  lineType,
      update_stock: (lineType === 'product') && updateStock,
      lot_number: lotNumber,
      expiry_date: expiryDate || null,
    });
  });

  if (!linesToInsert.length) return;
  const { data: insertedLines, error } = await supa.from('supplier_invoice_lines').insert(linesToInsert).select();
  if (error) { toast('เกิดข้อผิดพลาดบันทึกรายการ: ' + error.message, 'error'); return; }

  // ถ้า updateStock ให้สร้าง stock_movements และ item_lots
  if (updateStock && insertedLines) {
    for (const line of insertedLines) {
      if (!line.update_stock || !line.item_id) continue;
      const item = db.items.find(x => x.id === line.item_id);
      if (!item) continue;
      const beforeQty = parseFloat(item.qty) || 0;
      const afterQty  = beforeQty + parseFloat(line.qty);

      // สร้าง stock_movement (trigger จะ sync items.qty อัตโนมัติ)
      await supa.from('stock_movements').insert({
        item_id:             line.item_id,
        movement_type:       'receive',
        quantity:            line.qty,
        before_qty:          beforeQty,
        after_qty:           afterQty,
        supplier_invoice_id: invoiceId,
        lot_no:              line.lot_number || null,
        expiry_date:         line.expiry_date || null,
        cost:                line.unit_price || 0,
        ref_id:              invoiceId,
        ref_type:            'supplier_invoice',
        created_by:          currentUser?.username || '',
        note:                'รับสินค้าจาก invoice ' + (document.getElementById('supinv-no')?.value || ''),
      });

      // สร้าง item_lot
      if (line.lot_number || line.expiry_date) {
        await supa.from('item_lots').insert({
          item_id:            line.item_id,
          lot_number:         line.lot_number || ('LOT-' + Date.now()),
          expiry_date:        line.expiry_date || null,
          qty_in_lot:         line.qty,
          qty_remaining:      line.qty,
          unit_cost:          line.unit_price || 0,
          supplier_invoice_id: invoiceId,
          invoice_line_id:    line.id,
          received_by:        currentUser?.username || '',
          received_date:      new Date().toISOString().slice(0,10),
        });
      }

      // update local db.items
      item.qty = afterQty;
    }
  }

  // ── Cost Allocation (ระดับ 2): กระจายค่าจัดส่ง/บริการลงสินค้าตามสัดส่วน ──
  if (updateStock && insertedLines) {
    const shippingLines = insertedLines.filter(l => l.line_type === 'shipping' || l.line_type === 'service');
    const productLines  = insertedLines.filter(l => l.line_type === 'product' && l.update_stock && l.item_id);
    const totalShipping = shippingLines.reduce((s, l) => s + parseFloat(l.total || 0), 0);
    if (totalShipping > 0 && productLines.length > 0) {
      const productSubtotal = productLines.reduce((s, l) => s + parseFloat(l.total || 0), 0);
      for (const pl of productLines) {
        if (productSubtotal <= 0) break;
        const ratio       = parseFloat(pl.total || 0) / productSubtotal;
        const allocCost   = totalShipping * ratio;
        const allocPerUnit= pl.qty > 0 ? allocCost / pl.qty : 0;
        const finalUnitCost = parseFloat(pl.unit_price || 0) + allocPerUnit;
        // อัปเดต unit_cost ใน item_lots ที่เพิ่งสร้าง
        if (pl.lot_number || pl.expiry_date) {
          await supa.from('item_lots')
            .update({ unit_cost: parseFloat(finalUnitCost.toFixed(4)) })
            .eq('invoice_line_id', pl.id);
        }
      }
    }
  }
}

function addSupInvLine(itemId, itemName, qty, unit, unitPrice, lineType, lotNumber, expiryDate) {
  const container = document.getElementById('supinv-lines-container');
  if (!container) return;
  const items = db.items || [];
  const isManual = !itemId && !!itemName;

  const row = document.createElement('div');
  row.className = 'supinv-line-row';
  row.setAttribute('data-item-id', itemId || '');
  row.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:2px;';

  // แถวบน: เลือกสินค้า | ประเภท | badge | ลบ
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:end;';

  // --- dropdown สินค้า ---
  const selWrap = document.createElement('div');
  const selLabel = document.createElement('div');
  selLabel.style.cssText = 'font-size:11px;color:var(--text2);margin-bottom:3px;';
  selLabel.textContent = 'สินค้า';
  const sel = document.createElement('select');
  sel.className = 'form-control form-control-sm siline-item';
  sel.style.fontSize = '12px';
  sel.setAttribute('onchange', 'onSupInvItemChange(this)');
  const optBlank = document.createElement('option');
  optBlank.value = ''; optBlank.textContent = '-- เลือกสินค้า --';
  sel.appendChild(optBlank);
  items.forEach(function(it) {
    const o = document.createElement('option');
    o.value = it.id; o.textContent = it.name;
    if (it.id === (itemId || '')) o.selected = true;
    sel.appendChild(o);
  });
  const optManual = document.createElement('option');
  optManual.value = '__manual__';
  optManual.textContent = 'พิมพ์ชื่อเอง (ไม่ตัดสต็อก)';
  if (isManual) optManual.selected = true;
  sel.appendChild(optManual);
  selWrap.appendChild(selLabel); selWrap.appendChild(sel);

  // --- ประเภท ---
  const typeWrap = document.createElement('div');
  const typeLabel = document.createElement('div');
  typeLabel.style.cssText = 'font-size:11px;color:var(--text2);margin-bottom:3px;';
  typeLabel.textContent = 'ประเภท';
  const selType = document.createElement('select');
  selType.className = 'form-control form-control-sm siline-type';
  selType.style.fontSize = '12px';
  selType.setAttribute('onchange', 'calcSupInvLinesTotal()');
  [['product','สินค้า'],['shipping','ค่าขนส่ง'],['service','ค่าบริการ'],['discount','ส่วนลด'],['other','อื่นๆ']].forEach(function(pair) {
    const o = document.createElement('option');
    o.value = pair[0]; o.textContent = pair[1];
    if ((lineType || 'product') === pair[0]) o.selected = true;
    selType.appendChild(o);
  });
  typeWrap.appendChild(typeLabel); typeWrap.appendChild(selType);

  // --- badge ---
  const badge = document.createElement('div');
  badge.className = 'siline-badge';
  badge.style.cssText = 'font-size:11px;padding:3px 8px;border-radius:5px;white-space:nowrap;align-self:center;margin-top:14px;';
  if (isManual) {
    badge.textContent = 'ไม่ตัดสต็อก';
    badge.style.background = 'var(--surface3)'; badge.style.color = 'var(--text2)';
  } else if (itemId) {
    badge.textContent = 'ตัดสต็อก';
    badge.style.background = '#e8f5e9'; badge.style.color = '#2d7a4f';
  }

  // --- ปุ่มลบ ---
  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-ghost btn-sm';
  delBtn.type = 'button';
  delBtn.style.cssText = 'color:var(--danger);padding:4px 8px;margin-top:14px;';
  delBtn.textContent = 'x';
  delBtn.setAttribute('onclick', 'removeSupInvLine(this)');

  row1.appendChild(selWrap); row1.appendChild(typeWrap); row1.appendChild(badge); row1.appendChild(delBtn);

  // manual input row (แสดงเมื่อเลือก "พิมพ์เอง")
  const manualWrap = document.createElement('div');
  manualWrap.className = 'siline-manual-wrap';
  manualWrap.style.display = isManual ? 'block' : 'none';
  const manualLabel = document.createElement('div');
  manualLabel.style.cssText = 'font-size:11px;color:var(--text2);margin-bottom:3px;';
  manualLabel.textContent = 'ชื่อสินค้า (จะไม่ตัดสต็อก)';
  const manualInput = document.createElement('input');
  manualInput.className = 'form-control form-control-sm siline-name';
  manualInput.style.fontSize = '12px';
  manualInput.placeholder = 'พิมพ์ชื่อสินค้า...';
  manualInput.value = isManual ? (itemName || '') : '';
  manualInput.setAttribute('oninput', '_supInvFuzzyMatch(this)');
  const fuzzyHint = document.createElement('div');
  fuzzyHint.className = 'siline-fuzzy-hint';
  fuzzyHint.style.cssText = 'font-size:11px;color:var(--accent-dark);margin-top:3px;display:none;';
  manualWrap.appendChild(manualLabel); manualWrap.appendChild(manualInput); manualWrap.appendChild(fuzzyHint);

  // แถวล่าง: จำนวน | หน่วย | ราคา/หน่วย | Lot | วันหมดอายุ
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:0.7fr 0.7fr 1fr 1fr 1.2fr;gap:6px;align-items:end;';
  function makeField(labelText, inputAttrs) {
    const wrap = document.createElement('div');
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:11px;color:var(--text2);margin-bottom:3px;';
    lbl.textContent = labelText;
    const inp = document.createElement('input');
    inp.className = 'form-control form-control-sm ' + (inputAttrs.cls || '');
    inp.style.fontSize = '12px';
    Object.keys(inputAttrs).forEach(function(k) {
      if (k !== 'cls') inp.setAttribute(k, inputAttrs[k]);
    });
    wrap.appendChild(lbl); wrap.appendChild(inp);
    return wrap;
  }
  row2.appendChild(makeField('จำนวน',       {cls:'siline-qty',    type:'number', min:'0.01', step:'0.01', value:qty||1, oninput:'calcSupInvLinesTotal()'}));
  row2.appendChild(makeField('หน่วย',       {cls:'siline-unit',   placeholder:'หน่วย', value:unit||''}));
  row2.appendChild(makeField('ราคา/หน่วย (฿)',{cls:'siline-price', type:'number', min:'0', step:'0.01', placeholder:'0.00', value:unitPrice||'', oninput:'calcSupInvLinesTotal()'}));
  row2.appendChild(makeField('Lot',         {cls:'siline-lot',    placeholder:'Lot', value:lotNumber||''}));
  row2.appendChild(makeField('วันหมดอายุ',  {cls:'siline-expiry', type:'date', value:expiryDate||''}));

  row.appendChild(row1); row.appendChild(manualWrap); row.appendChild(row2);
  container.appendChild(row);
  calcSupInvLinesTotal();
}

function onSupInvItemChange(sel) {
  const row = sel.closest('.supinv-line-row');
  if (!row) return;
  const manualWrap = row.querySelector('.siline-manual-wrap');
  const badge      = row.querySelector('.siline-badge');
  if (sel.value === '__manual__') {
    row.setAttribute('data-item-id', '');
    if (manualWrap) manualWrap.style.display = 'block';
    if (badge) { badge.textContent = 'ไม่ตัดสต็อก'; badge.style.background = 'var(--surface3)'; badge.style.color = 'var(--text2)'; }
    const nameInput = row.querySelector('.siline-name');
    if (nameInput) nameInput.focus();
  } else {
    const item = db.items.find(function(x) { return x.id === sel.value; });
    row.setAttribute('data-item-id', item ? item.id : '');
    if (manualWrap) manualWrap.style.display = 'none';
    if (badge) {
      badge.textContent = item ? 'ตัดสต็อก' : '';
      badge.style.background = item ? '#e8f5e9' : 'transparent';
      badge.style.color = item ? '#2d7a4f' : '';
    }
    if (item) {
      row.querySelector('.siline-unit').value  = item.dispenseUnit || item.unit || '';
      row.querySelector('.siline-price').value = item.cost || '';
    }
  }
  calcSupInvLinesTotal();
}

var _supInvFuzzyTimer = null;
function _supInvFuzzyMatch(input) {
  clearTimeout(_supInvFuzzyTimer);
  _supInvFuzzyTimer = setTimeout(function() {
    var q = input.value.trim().toLowerCase();
    var hint = input.closest('.siline-manual-wrap') && input.closest('.siline-manual-wrap').querySelector('.siline-fuzzy-hint');
    if (!hint) return;
    if (q.length < 2) { hint.style.display = 'none'; return; }
    var matches = (db.items || []).filter(function(i) { return i.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 3);
    if (!matches.length) { hint.style.display = 'none'; return; }
    hint.style.display = 'block';
    hint.innerHTML = '';
    var prefix = document.createTextNode('คล้ายกับ: ');
    hint.appendChild(prefix);
    matches.forEach(function(m, idx) {
      if (idx > 0) hint.appendChild(document.createTextNode(', '));
      var span = document.createElement('span');
      span.style.cssText = 'cursor:pointer;color:var(--accent);text-decoration:underline;';
      span.textContent = m.name;
      span.setAttribute('data-match-id', m.id);
      span.onclick = function() { _supInvFuzzySelect(span, m.id); };
      hint.appendChild(span);
    });
    var suffix = document.createTextNode(' — คลิกเพื่อเชื่อมสต็อก');
    hint.appendChild(suffix);
  }, 300);
}

function _supInvFuzzySelect(el, itemId) {
  var row = el.closest('.supinv-line-row');
  if (!row) return;
  var sel = row.querySelector('.siline-item');
  if (sel) { sel.value = itemId; onSupInvItemChange(sel); }
}

function removeSupInvLine(btn) {
  btn.closest('.supinv-line-row')?.remove();
  calcSupInvLinesTotal();
}

function calcSupInvLinesTotal() {
  const rows = document.querySelectorAll('.supinv-line-row');
  let subtotal = 0;
  rows.forEach(row => {
    const qty   = parseFloat(row.querySelector('.siline-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.siline-price')?.value) || 0;
    const type  = row.querySelector('.siline-type')?.value || 'product';
    const lineTotal = qty * price;
    subtotal += (type === 'discount') ? -lineTotal : lineTotal;
  });
  const subEl = document.getElementById('supinv-subtotal');
  if (subEl && rows.length > 0) {
    subEl.value = subtotal.toFixed(2);
    calcSupInvTotal();
  }
  const summary = document.getElementById('supinv-lines-summary');
  if (summary) summary.textContent = rows.length + ' รายการ รวม ' + subtotal.toLocaleString('th-TH', {minimumFractionDigits:2}) + ' บาท';
}

function autoFillSupInvFromPO() {
  const prId = document.getElementById('supinv-pr')?.value;
  if (!prId) return;
  const pr = (db.purchaseRequests || []).find(x => x.id == prId);
  if (!pr) return;
  const container = document.getElementById('supinv-lines-container');
  if (!container) return;
  // ดู PO lines
  const prLines = (db.purchaseRequestLines || []).filter(l => l.requestId == prId);
  if (!prLines.length) { toast('ไม่พบรายการใน PO นี้', 'warning'); return; }
  // clear และ fill
  container.innerHTML = '';
  prLines.forEach(pl => {
    addSupInvLine(pl.itemId, pl.itemName, pl.qtyRequested, pl.unit, pl.unitCost, 'product');
  });
  toast('Auto-fill จาก PO เรียบร้อย (' + prLines.length + ' รายการ)', 'success');
}

async function confirmInvoiceStock(id) {
  if (!confirm('ยืนยันรับสินค้าและเพิ่มสต็อก? ไม่สามารถยกเลิกได้')) return;
  const inv = db.supplierInvoices.find(x => x.id == id);
  if (!inv) return;
  const { error } = await supa.from('supplier_invoices')
    .update({ status: 'confirmed', is_stock_updated: true, received_date: new Date().toISOString().slice(0,10) })
    .eq('id', id);
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
  inv.status = 'confirmed'; inv.isStockUpdated = true;
  // update stock จาก invoice lines ที่มีอยู่
  const { data: invLines } = await supa.from('supplier_invoice_lines')
    .select('*').eq('invoice_id', id).eq('update_stock', false).eq('line_type', 'product');
  if (invLines?.length) {
    for (const line of invLines) {
      if (!line.item_id) continue;
      const item = db.items.find(x => x.id === line.item_id);
      const beforeQty = parseFloat(item?.qty) || 0;
      const afterQty  = beforeQty + parseFloat(line.qty);
      await supa.from('stock_movements').insert({
        item_id: line.item_id, movement_type: 'receive',
        quantity: line.qty, before_qty: beforeQty, after_qty: afterQty,
        supplier_invoice_id: id, cost: line.unit_price || 0,
        ref_id: id, ref_type: 'supplier_invoice',
        created_by: currentUser?.username || '',
      });
      await supa.from('supplier_invoice_lines').update({ update_stock: true }).eq('id', line.id);
      if (item) item.qty = afterQty;
    }
  }
  // สรุปผลการเพิ่มสต็อก
  const _added   = (invLines||[]).filter(l=>l.update_stock&&l.item_id);
  const _skipped = (invLines||[]).filter(l=>l.line_type==='product'&&!l.item_id);
  if (_skipped.length > 0) {
    const names = _skipped.map(l=>'  • '+(l.item_name||'?ไม่ระบุ')).join('\n');
    alert('✅ เพิ่มสต็อกแล้ว: '+_added.length+' รายการ\n⚠️ ไม่ได้เพิ่มสต็อก (พิมพ์ชื่อเอง): '+_skipped.length+' รายการ\n'+names+'\n\n→ กรุณาไปเพิ่มสต็อคด้วยตนเองที่ 📦 คลังสต็อค');
  }
  toast('เพิ่มสต็อกเรียบร้อย', 'success');
  renderSupplierInvoices();
}

async function deleteSupplierInvoice(id, invoiceNo) {
  const role = currentUser?.role;
  if (role !== 'admin' && role !== 'manager') { toast('ไม่มีสิทธิ์ลบรายการ', 'error'); return; }
  const inv = db.supplierInvoices.find(x => x.id == id);
  if (!inv) return;
  if (inv.status !== 'draft') { toast('ลบได้เฉพาะใบที่ยังไม่ยืนยัน (ร่าง) เท่านั้น', 'error'); return; }
  if (!confirm('ยืนยันลบใบแจ้งหนี้ ' + invoiceNo + ' ?\nลบแล้วไม่สามารถกู้คืนได้')) return;
  // audit log ก่อนลบ
  if (typeof logAudit === 'function') logAudit('supplier_invoice', 'delete', String(id), {
    invoice_no: inv.invoiceNo, supplier_name: inv.supplierName,
    total: inv.total, status: inv.status, deleted_by: currentUser?.username
  });
  // reset PR ถ้าผูกไว้
  if (inv.purchaseRequestId) {
    await supa.from('purchase_requests').update({ status: 'approved' }).eq('id', inv.purchaseRequestId);
    const pr = db.purchaseRequests?.find(x => x.id == inv.purchaseRequestId);
    if (pr) pr.status = 'approved';
  }
  // ลบจาก DB (lines ถูก cascade delete อัตโนมัติ)
  const { error } = await supa.from('supplier_invoices').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.supplierInvoices = (db.supplierInvoices || []).filter(x => x.id != id);
  toast('ลบใบแจ้งหนี้ ' + invoiceNo + ' เรียบร้อย', 'success');
  renderSupplierInvoices();
}

async function editSupplierInvoice(id) {
  const inv = db.supplierInvoices.find(x => x.id == id);
  if (!inv) return;
  // populate header fields
  document.getElementById('editSupInvId').value          = inv.id;
  document.getElementById('supinv-no').value             = inv.invoiceNo;
  document.getElementById('supinv-date').value           = inv.date || '';
  document.getElementById('supinv-due').value            = inv.dueDate || '';
  document.getElementById('supinv-subtotal').value       = inv.subtotal;
  document.getElementById('supinv-vat').value            = inv.vatRate;
  document.getElementById('supinv-total').value          = inv.total;
  document.getElementById('supinv-status').value         = inv.status;
  document.getElementById('supinv-note').value           = inv.note || '';
  document.getElementById('supinv-job-name').value       = inv.jobName || '';
  document.getElementById('supinv-wht-rate').value       = inv.whtRate || 0;
  document.getElementById('supinv-net-payable').value    = inv.netPayable != null ? inv.netPayable : '';
  (function(){var _v=inv.supplierName || '';var _h=document.getElementById("ta-sis-id");if(_h)_h.value=_v||"";var _i=document.getElementById("ta-sis-inp");if(_i){var _all=(db.patients||[]).concat(db.staff||[]).concat(db.suppliers||[]);var _p=_all.find(x=>String(x.id)===String(_v));_i.value=_p?(_p.name||""):"";}})();
  document.getElementById('supinv-received-date').value  = inv.receivedDate || '';
  document.getElementById('supinv-received-by').value    = inv.receivedBy || '';
  // populate supplier dropdown
  const sel = document.getElementById("ta-sis-id");
  if (sel) { sel.innerHTML = '<option value="">-- เลือกผู้จำหน่าย --</option>' +
    (db.suppliers||[]).map(s=>'<option value="'+s.id+'" '+(s.id==inv.supplierId?'selected':'')+'>'+s.name+'</option>').join(''); }
  // populate PR dropdown
  const prSel = document.getElementById('supinv-pr');
  if (prSel) { prSel.innerHTML = '<option value="">-- อ้างอิง PO (ถ้ามี) --</option>' +
    (db.purchaseRequests||[]).filter(r=>['approved','ordered'].includes(r.status))
      .map(r=>'<option value="'+r.id+'">'+r.refNo+' - '+(r.supplierName||'')+'</option>').join(''); }
  // โหลด invoice lines จาก DB แล้ว render ใน modal
  const lc = document.getElementById('supinv-lines-container');
  const ls = document.getElementById('supinv-lines-summary');
  if (lc) { lc.innerHTML = ''; if(ls) ls.textContent = ''; }
  openModal('modal-addSupInv');
  // โหลด lines จาก Supabase
  const { data: invLines } = await supa.from('supplier_invoice_lines')
    .select('*').eq('invoice_id', id);
  if (invLines && lc) {
    invLines.forEach(l => addSupInvLine(
      l.item_id, l.item_name, l.qty, l.unit, l.unit_price, l.line_type, l.lot_number, l.expiry_date
    ));
  }
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


// ── Scan Invoice ─────────────────────────────────────
function scanSupplierInvoice() {
  // สร้าง input สำหรับเลือกไฟล์
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,application/pdf';
  inp.onchange = async function() {
    const file = inp.files[0];
    if (!file) return;
    // แสดงสถานะกำลังอ่าน
    const btn = document.getElementById('scan-supinv-btn');
    if (btn) { btn.innerHTML = '⏳ กำลังอ่าน...'; btn.disabled = true; }
    try {
      // แปลงไฟล์เป็น base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('อ่านไฟล์ไม่สำเร็จ'));
        r.readAsDataURL(file);
      });
      const mediaType = file.type || 'image/jpeg';
      // ส่งไปอ่าน
      const resp = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const result = await resp.json();
      if (!result.ok || !result.data) {
        toast('อ่านใบแจ้งหนี้ไม่สำเร็จ: ' + (result.error || 'ไม่ทราบสาเหตุ'), 'error'); return;
      }
      const d = result.data;
      // เติมข้อมูลลงฟอร์ม
      if (d.invoice_no) document.getElementById('supinv-no').value = d.invoice_no;
      if (d.invoice_date) document.getElementById('supinv-date').value = d.invoice_date;
      if (d.due_date) document.getElementById('supinv-due').value = d.due_date;
      if (d.job_name) document.getElementById('supinv-job-name').value = d.job_name;
      if (d.note) document.getElementById('supinv-note').value = d.note;
      if (d.subtotal != null) document.getElementById('supinv-subtotal').value = d.subtotal;
      if (d.vat_rate != null) document.getElementById('supinv-vat').value = d.vat_rate;
      if (d.wht_rate != null) document.getElementById('supinv-wht-rate').value = d.wht_rate;
      calcSupInvTotal();
      // จับคู่ชื่อผู้จำหน่าย
      if (d.supplier_name) {
        const sel = document.getElementById("ta-sis-id");
        const matched = Array.from(sel.options).find(o => o.text.includes(d.supplier_name) || d.supplier_name.includes(o.text));
        if (matched) {
          sel.value = matched.value;
        } else {
          const manualEl = document.getElementById('supinv-supplier-manual');
          if (manualEl) manualEl.value = d.supplier_name;
        }
      }
      // แสดงรายการสินค้าถ้ามี
      if (d.items && d.items.length > 0) {
        const summary = d.items.map(it => it.item_name + ' ' + it.qty + ' ' + (it.unit||'')).join(', ');
        toast('อ่านสำเร็จ! รายการ: ' + summary, 'success');
      } else {
        toast('อ่านข้อมูลเรียบร้อย กรุณาตรวจสอบและแก้ไขก่อนบันทึก', 'success');
      }
    } catch(e) {
      toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    } finally {
      if (btn) { btn.innerHTML = '📷 สแกนใบแจ้งหนี้'; btn.disabled = false; }
    }
  };
  inp.click();
}