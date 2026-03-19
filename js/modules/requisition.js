// ===== REQUISITION MODULE =====

// ===== REQUISITION =====
let reqItems = [];
function onReqPatientChange() {
  const patId = document.getElementById('req-patient').value;
  const alertDiv = document.getElementById('req-allergy-alert');
  const bedDiv   = document.getElementById('req-bed-info');
  const bedText  = document.getElementById('req-bed-text');
  if (!patId) {
    alertDiv.style.display = 'none';
    bedDiv.style.display = 'none';
    return;
  }
  const patient = db.patients.find(p => p.id == patId);
  if (!patient) return;
  // Allergy alert
  if (patient.allergies?.length) {
    alertDiv.innerHTML = renderAllergyBanner(patient, false);
    alertDiv.style.display = 'block';
  } else {
    alertDiv.style.display = 'none';
  }
  // Bed info
  const bed = getPatientBed(patient);
  if (bed) {
    const room = getPatientRoom(patient);
    bedText.textContent = `ห้อง: ${room?.name||'-'} · เตียง: ${bed.bedCode} · ประเภท: ${room?.roomType||'-'} · ค่าห้อง: ${room?.monthlyRate ? room.monthlyRate.toLocaleString('th-TH')+'฿/เดือน' : '-'}`;
    bedDiv.style.display = 'block';
  } else {
    bedDiv.style.display = 'none';
  }
}

function initReq() {
  // Populate selects
  const patSel = document.getElementById('req-patient');
  patSel.innerHTML = '<option value="">-- เลือกผู้รับบริการ --</option>' +
    db.patients.filter(p => p.status === 'active').map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const staffSel = document.getElementById('req-staff');
  staffSel.innerHTML = '<option value="">-- เลือกพนักงาน --</option>' +
    db.staff.map(s => `<option value="${s.id}">${s.name}${s.nickname ? ' ('+s.nickname+')' : ''}</option>`).join('');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('req-date').value = today;

  if (reqItems.length === 0) {
    for (let i = 0; i < 5; i++) addReqItem();
  } else renderReqItems();
}

function addReqItem() {
  reqItems.push({ itemId: '', qty: 1, unit: '' });
  renderReqItems();
}

function renderReqItems() {
  const container = document.getElementById('reqItems');
  const UNITS = ['เม็ด','กล่อง','ขวด','ชิ้น','ชุด','Amp','Vial','ซอง','ถุง','ใบ','แผ่น','ม้วน','เส้น','หลอด','ห่อ','ก้อน','ก้าน'];
  container.innerHTML = reqItems.map((ri, idx) => {
    const item = ri.itemId ? db.items.find(i => i.id == ri.itemId) : null;
    // Auto-fill unit from item if not set
    const unitVal = ri.unit || (item ? item.unit : '');
    return `<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;background:var(--bg);padding:10px 12px;border-radius:8px;border:1px solid var(--border);">
      <div style="min-width:24px;text-align:center;padding-bottom:8px;font-size:12px;color:var(--text3);font-weight:600;">${idx+1}</div>
      <div class="form-group" style="flex:4;margin:0;">
        <label class="form-label" style="font-size:11px;">รายการสินค้า / ยา / เวชภัณฑ์</label>
        <select class="form-control" onchange="updateReqItem(${idx},'itemId',this.value)">
          <option value="">-- เลือกรายการ --</option>
          ${db.items.map(i => `<option value="${i.id}" ${ri.itemId == i.id ? 'selected' : ''}>${i.name} (คงเหลือ: ${i.qty} ${i.unit})</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1;margin:0;min-width:72px;">
        <label class="form-label" style="font-size:11px;">จำนวน</label>
        <input class="form-control number" type="number" min="1" value="${ri.qty}" onchange="updateReqItem(${idx},'qty',this.value)" style="text-align:center;">
      </div>
      <div class="form-group" style="flex:1;margin:0;min-width:90px;">
        <label class="form-label" style="font-size:11px;">หน่วยนับ</label>
        <select class="form-control" onchange="updateReqItem(${idx},'unit',this.value)">
          <option value="">-</option>
          ${UNITS.map(u => `<option value="${u}" ${unitVal===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="removeReqItem(${idx})" style="margin-bottom:2px;padding:5px 8px;color:var(--text3);" title="ลบรายการ">✕</button>
    </div>`;
  }).join('');
}

function updateReqItem(idx, field, value) {
  reqItems[idx][field] = field === 'qty' ? parseInt(value) : value;
  if (field === 'itemId') {
    // Auto-fill unit from selected item
    const item = db.items.find(i => i.id == value);
    if (item) reqItems[idx].unit = item.unit;
    renderReqItems();
  }
}

function removeReqItem(idx) {
  reqItems.splice(idx, 1);
  renderReqItems();
}

async function submitReq() {
  const patId   = document.getElementById('req-patient').value;
  const staffId = document.getElementById('req-staff').value;
  const date    = document.getElementById('req-date').value;
  const note    = document.getElementById('req-note').value;

  if (!patId)   { toast('กรุณาเลือกผู้รับบริการ', 'warning'); return; }
  if (!staffId) { toast('กรุณาเลือกผู้เบิก', 'warning'); return; }

  const validItems = reqItems.filter(ri => ri.itemId && ri.qty > 0);
  if (validItems.length === 0) { toast('กรุณาเพิ่มรายการที่ต้องการเบิก', 'warning'); return; }

  const patient = db.patients.find(p => p.id == patId);
  const staff   = db.staff.find(s => s.id == staffId);

  // เช็คสต็อกก่อน
  const errors = [];
  validItems.forEach(ri => {
    const item = db.items.find(i => i.id == ri.itemId);
    if (item && item.qty < ri.qty) errors.push(`${item.name}: คงเหลือ ${item.qty} ${item.unit}`);
  });
  if (errors.length > 0) { toast('สินค้าไม่เพียงพอ: ' + errors.join(', '), 'error'); return; }

  showLoadingOverlay(true);
  try {
    // ใช้ RPC submit_requisition — บันทึก header + lines แบบ atomic
    const lines = validItems.map(ri => {
      const item = db.items.find(i => i.id == ri.itemId);
      return { item_id: item.id, item_name: item.name, qty_requested: ri.qty, unit: ri.unit || item.unit };
    });

    const { data: rpcResult, error: rpcErr } = await supa.rpc('submit_requisition', {
      p_patient_id:   patId,
      p_patient_name: patient.name,
      p_staff_id:     staffId,
      p_staff_name:   staff.name,
      p_date:         date,
      p_note:         note || '',
      p_created_by:   currentUser?.username || '',
      p_lines:        lines,
    });

    if (rpcErr) { toast('บันทึกไม่สำเร็จ: ' + rpcErr.message, 'error'); return; }

    const refNo    = rpcResult.ref_no;
    const headerId = rpcResult.header_id;

    // อัปเดต local cache (db.requisitions) เพื่อให้ approval panel เห็นทันที
    validItems.forEach(ri => {
      const item = db.items.find(i => i.id == ri.itemId);
      if (!item) return;
      db.requisitions.unshift({
        id: headerId, refNo, date,
        patientId: patId, patientName: patient.name,
        itemId: item.id, itemName: item.name,
        qty: ri.qty, unit: ri.unit || item.unit,
        staffId, staffName: staff.name, note, status: 'pending'
      });
    });

    toast(`บันทึกการเบิก ${validItems.length} รายการเรียบร้อย (${refNo})`, 'success');

    // Line notification
    sendLineNotify('new_requisition', buildLineMsg('new_requisition', {
      refNo, patient: patient.name, itemCount: validItems.length, staff: staff.name
    }), { patientName: patient.name, itemCount: validItems.length });

    // Low stock check
    validItems.forEach(ri => {
      const item = db.items.find(i => i.id == ri.itemId);
      if (item && item.qty <= item.reorder) {
        sendLineNotify('low_stock', buildLineMsg('low_stock', {
          itemName: item.name, qty: item.qty, unit: item.unit, reorder: item.reorder
        }), { itemName: item.name, qty: item.qty });
      }
    });

    clearReq();
  } catch(e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    showLoadingOverlay(false);
  }
}

function clearReq() {
  reqItems = [];
  document.getElementById('req-patient').value = '';
  document.getElementById('req-staff').value = '';
  document.getElementById('req-note').value = '';
  document.getElementById('req-date').value = new Date().toISOString().split('T')[0];
  for (let i = 0; i < 5; i++) reqItems.push({ itemId: '', qty: 1, unit: '' });
  renderReqItems();
}

// ===== HISTORY =====
function populateHistFilters() {
  const patSel = document.getElementById('histPatient');
  const staffSel = document.getElementById('histStaff');
  if (!patSel || !staffSel) return;
  const curPat = patSel.value, curStaff = staffSel.value;
  const patients = db.patients.map(p=>p.name).sort();
  const staffs   = db.staff.map(s=>s.name).sort();
  patSel.innerHTML   = '<option value="">ทั้งหมด</option>' + patients.map(p => `<option value="${p}" ${curPat===p?'selected':''}>${p}</option>`).join('');
  staffSel.innerHTML = '<option value="">ทั้งหมด</option>' + staffs.map(s => `<option value="${s}" ${curStaff===s?'selected':''}>${s}</option>`).join('');
}

function resetHistFilters() {
  document.getElementById('histSearch').value = '';
  document.getElementById('histMonth').value  = '';
  document.getElementById('histPatient').value = '';
  document.getElementById('histStaff').value   = '';
  const hs = document.getElementById('histStatus'); if(hs) hs.value='';
  renderHistory();
}

// ─────────────────────────────────────────────────────
// ── HISTORY TABS ─────────────────────────────────────
// ─────────────────────────────────────────────────────
function switchHistoryTab(tab) {
  ['list','approval','returns'].forEach(t => {
    const panel = document.getElementById('history-tab-'+t);
    if(panel) panel.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('.history-tab').forEach((el,i) => {
    const tabs = ['list','approval','returns'];
    const active = tabs[i]===tab;
    el.style.color = active ? 'var(--accent)' : 'var(--text2)';
    el.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    el.style.marginBottom = '-2px';
  });
  if (tab === 'approval') renderApprovalPanel();
  if (tab === 'returns')  renderReturnsTab();
}

// ─────────────────────────────────────────────────────
// ── APPROVAL WORKFLOW ─────────────────────────────────
// ─────────────────────────────────────────────────────
// Single-level approval: only 'officer' (ธุรการ) can approve/reject
// pending → approved (stock cut on approval)



function getPendingForMe() {
  if (canApproveReq()) {
    return (db.requisitions||[]).filter(r => r.status === 'pending');
  }
  return [];
}

function updateApprovalBadge() {
  const count = getPendingForMe().length;
  const badge = document.getElementById('approval-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

function renderApprovalPanel() {
  const container = document.getElementById('approval-panel-content');
  if (!container) return;

  const pending    = (db.requisitions||[]).filter(r => r.status === 'pending');
  const recentLogs = (db.approvalLogs||[]).slice(0,30);

  const STATUS_PILL = (s) => {
    const map = { pending:'#e67e22|รออนุมัติ', approved:'#27ae60|อนุมัติแล้ว', rejected:'#e74c3c|ไม่อนุมัติ', forward:'#3498db|รออนุมัติ' };
    const [color,label] = (map[s]||'#888|ไม่ทราบ').split('|');
    return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${color}22;color:${color};">${label}</span>`;
  };

  const reqRows = pending.map(r => `
    <tr>
      <td style="font-size:12px;">${r.date||'-'}</td>
      <td style="font-weight:600;">${r.patientName}</td>
      <td>${r.itemName}</td>
      <td class="number">${r.qty} ${r.unit}</td>
      <td style="font-size:12px;">${r.staffName}</td>
      <td>${STATUS_PILL(r.status)}</td>
      <td style="white-space:nowrap;">
        ${canApproveReq() ? `
          <button class="btn btn-primary btn-sm" onclick="approveReq('${r.id}')" style="font-size:11px;">✅ อนุมัติ</button>
          <button class="btn btn-sm" style="background:#e74c3c22;color:#e74c3c;font-size:11px;" onclick="openRejectModal('${r.id}')">❌ ไม่อนุมัติ</button>
        ` : '<span style="font-size:12px;color:var(--text3);">ไม่มีสิทธิ์</span>'}
        <button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')">🖨️</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="background:rgba(230,126,34,.08);">
        <div class="card-title" style="color:#e67e22;">⏳ รออนุมัติ — ธุรการ (${pending.length} รายการ)</div>
        ${canApproveReq()&&pending.length>0?`<button class="btn btn-sm" style="background:#27ae60;color:#fff;font-size:11px;" onclick="approveAllReq()">✅ อนุมัติทั้งหมด (${pending.length})</button>`:''}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วันที่</th><th>ผู้รับบริการ</th><th>รายการ</th><th>จำนวน</th><th>ผู้เบิก</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>${pending.length ? reqRows : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">ไม่มีรายการรออนุมัติ</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📜 Audit Trail — ประวัติการอนุมัติล่าสุด</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วันเวลา</th><th>ใบเบิก</th><th>การดำเนินการ</th><th>ผู้ดำเนินการ</th><th>เหตุผล</th></tr></thead>
          <tbody>
            ${recentLogs.length===0 ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">ยังไม่มีประวัติ</td></tr>' :
              recentLogs.map(l => {
                const ACTION_MAP   = { approved:'✅ อนุมัติ + ตัดสต็อก', reject:'❌ ไม่อนุมัติ' };
                const ACTION_COLOR = { approved:'#27ae60', reject:'#e74c3c' };
                return `<tr>
                  <td style="font-size:11px;">${l.createdAt?.replace('T',' ').slice(0,16)||'-'}</td>
                  <td style="font-size:12px;">req#${l.reqId}</td>
                  <td><span style="color:${ACTION_COLOR[l.action]||'#888'};font-weight:600;">${ACTION_MAP[l.action]||l.action}</span></td>
                  <td style="font-size:12px;">${l.actorName}</td>
                  <td style="font-size:12px;color:var(--text2);">${l.reason||'-'}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function approveReq(reqId) {
  const req = (db.requisitions||[]).find(r=>r.id==reqId);
  if (!req) return;
  if (!canApproveReq()) { toast('ไม่มีสิทธิ์อนุมัติ','error'); return; }

  const actor     = currentUser?.displayName || currentUser?.username || '';
  const actorRole = currentUser?.role || '';

  showLoadingOverlay(true);
  try {
    // ใช้ RPC approve_requisition — ตัดสต็อก FEFO + audit แบบ atomic
    const { data: rpcResult, error: rpcErr } = await supa.rpc('approve_requisition', {
      p_header_id:      reqId,
      p_approved_by:    actor,
      p_approved_role:  actorRole,
    });

    if (rpcErr || !rpcResult?.ok) {
      toast('❌ อนุมัติไม่สำเร็จ: ' + (rpcErr?.message || rpcResult?.error), 'error');
      return;
    }

    // อัปเดต local cache
    req.status = 'approved';
    const item = db.items.find(i => i.id == req.itemId);
    if (item) {
      // sync item qty จาก Supabase
      const { data: updItem } = await supa.from('items').select('qty').eq('id', item.id).single();
      if (updItem) item.qty = updItem.qty;
      // sync lots
      const { data: lotsData } = await supa.from('item_lots').select('*').eq('item_id', item.id);
      if (lotsData) {
        db.itemLots = db.itemLots.filter(l => l.itemId != item.id);
        lotsData.forEach(l => db.itemLots.push({
          id: l.id, itemId: l.item_id, lotNo: l.lot_no,
          qtyInLot: l.qty_in_lot, qtyRemaining: l.qty_remaining,
          expiryDate: l.expiry_date, note: l.note
        }));
      }
    }

    sendLineNotify('approved', buildLineMsg('approved', {
      refNo: req.refNo||('REQ#'+reqId), patient: req.patientName, itemCount: 1
    }), { patientName: req.patientName, itemCount: 1 });

    // บันทึก stock_movements (issue) เพื่อ traceability
    if (typeof mapStockMovement === 'function') {
      const beforeQty = item ? (item.qty + req.qty) : 0;
      const afterQty  = item ? item.qty : 0;
      const movData = {
        item_id:       req.itemId,
        barcode:       item?.barcode || null,
        movement_type: 'issue',
        quantity:      req.qty || 0,
        before_qty:    beforeQty,
        after_qty:     afterQty,
        note:          `อนุมัติใบเบิก ${req.refNo||reqId} — ${req.patientName||''}`,
        ref_type:      'requisition',
        ref_id:        reqId,
        created_by:    actor,
      };
      supa.from('stock_movements').insert(movData).select().single().then(({ data }) => {
        if (data) db.stockMovements.unshift(mapStockMovement(data));
      });
    }
    logAudit(AUDIT_MODULES.REQUISITION, AUDIT_ACTIONS.APPROVE, reqId, {
      ref_no: req.refNo, patient: req.patientName, item: req.itemName, qty: req.qty, actor,
    });
    toast(`✅ อนุมัติใบเบิก ${req.refNo||reqId} — ตัดสต็อกเรียบร้อย`, 'success');
    updateApprovalBadge();
    renderApprovalPanel();
    renderHistory();
  } finally {
    showLoadingOverlay(false);
  }
}

async function approveAllReq() {
  const pending = (db.requisitions||[]).filter(r=>r.status==='pending');
  if (!pending.length) return;
  if (!confirm(`อนุมัติ + ตัดสต็อกทั้งหมด ${pending.length} รายการ?`)) return;
  for (const r of pending) await approveReq(r.id);
}

async function approveAllL1() { await approveAllReq(); }
async function approveAllL2() { await approveAllReq(); }

function openRejectModal(reqId) {
  const req = (db.requisitions||[]).find(r=>r.id==reqId);
  if (!req) return;
  document.getElementById('reject-req-ids').value = reqId;
  document.getElementById('reject-req-summary').innerHTML =
    `<div style="font-weight:600;margin-bottom:4px;">${req.patientName} — ${req.itemName}</div>
     <div style="font-size:12px;color:var(--text2);">จำนวน: ${req.qty} ${req.unit} · วันที่: ${req.date}</div>`;
  document.getElementById('reject-reason').value = '';
  openModal('modal-reject-req');
}

async function confirmRejectReq() {
  const reqId  = document.getElementById('reject-req-ids').value;
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { toast('กรุณาระบุเหตุผล','warning'); return; }
  const req = (db.requisitions||[]).find(r=>r.id==reqId);
  if (!req) return;
  const actor = currentUser?.displayName || currentUser?.username || '';

  // ใช้ RPC reject_requisition — บันทึก audit ด้วย
  const { data: rpcRes, error: rpcErr } = await supa.rpc('reject_requisition', {
    p_header_id:   reqId,
    p_rejected_by: actor,
    p_reason:      reason,
  });
  if (rpcErr || !rpcRes?.ok) {
    toast('❌ ไม่สำเร็จ: ' + (rpcErr?.message || rpcRes?.error), 'error'); return;
  }
  req.status = 'rejected';

  // Send Line notification
  sendLineNotify('rejected', buildLineMsg('rejected', {
    refNo: req.refNo||('REQ#'+reqId), patient: req.patientName, reason
  }), { patientName: req.patientName, reason });

  toast(`❌ ไม่อนุมัติ req#${reqId} — ${reason}`, 'success');
  closeModal('modal-reject-req');
  updateApprovalBadge();
  renderApprovalPanel();
  renderHistory();
}

// ─────────────────────────────────────────────────────
// ── RETURN TO STOCK ───────────────────────────────────
// ─────────────────────────────────────────────────────
function openReturnModal() {
  // Populate req select — only approved reqs
  const sel = document.getElementById('return-req-id');
  const approved = (db.requisitions||[]).filter(r=>r.status==='approved');
  sel.innerHTML = '<option value="">-- เลือกใบเบิกต้นฉบับ --</option>' +
    approved.map(r=>`<option value="${r.id}">${r.date} · ${r.patientName} · ${r.itemName} (${r.qty} ${r.unit})</option>`).join('');
  document.getElementById('return-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('return-qty').value = '';
  document.getElementById('return-req-info').style.display = 'none';
  document.getElementById('return-note').value = '';
  document.querySelectorAll('input[name="return-reason-preset"]').forEach(r=>r.checked=false);
  document.getElementById('return-other-wrap').style.display = 'none';
  openModal('modal-return-item');
}

function onReturnReqChange() {
  const reqId = document.getElementById('return-req-id').value;
  const req = (db.requisitions||[]).find(r=>r.id==reqId);
  const infoEl = document.getElementById('return-req-info');
  const unitEl = document.getElementById('return-unit-label');
  const maxEl  = document.getElementById('return-max-label');
  if (!req) { infoEl.style.display='none'; return; }
  const alreadyReturned = (db.returnItems||[]).filter(x=>x.reqId==reqId).reduce((s,x)=>s+x.qtyReturned,0);
  const canReturn = req.qty - alreadyReturned;
  infoEl.style.display = '';
  infoEl.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <span>🏥 <strong>${req.patientName}</strong></span>
      <span>📦 ${req.itemName}</span>
      <span>เบิกไป: <strong>${req.qty} ${req.unit}</strong></span>
      <span style="color:${canReturn<=0?'#e74c3c':'#27ae60'};">คืนได้: <strong>${canReturn} ${req.unit}</strong></span>
    </div>`;
  unitEl.textContent = req.unit;
  maxEl.textContent = `สูงสุด ${canReturn} ${req.unit}`;
  document.getElementById('return-qty').max = canReturn;
}

function toggleReturnOther() {
  const val = document.querySelector('input[name="return-reason-preset"]:checked')?.value;
  document.getElementById('return-other-wrap').style.display = val==='อื่นๆ' ? '' : 'none';
}

async function saveReturnItem() {
  const reqId   = document.getElementById('return-req-id').value;
  const qty     = parseFloat(document.getElementById('return-qty').value)||0;
  const dateVal = document.getElementById('return-date').value;
  const reasonPreset = document.querySelector('input[name="return-reason-preset"]:checked')?.value;
  const reasonOther  = document.getElementById('return-reason-other').value.trim();
  const reason = reasonPreset === 'อื่นๆ' ? (reasonOther||'อื่นๆ') : (reasonPreset||'');

  if (!reqId) { toast('กรุณาเลือกใบเบิกต้นฉบับ','warning'); return; }
  if (qty <= 0) { toast('กรุณาระบุจำนวนที่คืน','warning'); return; }
  if (!reason)  { toast('กรุณาระบุเหตุผลการคืน','warning'); return; }

  const req  = (db.requisitions||[]).find(r=>r.id==reqId);
  if (!req) return;
  const item = db.items.find(i=>i.id==req.itemId);
  const refNo = 'RET-'+Date.now().toString().slice(-6);

  // Restore stock — ใช้ RPC เพื่อป้องกัน Race Condition (Atomic)
  if (item) {
    const { data: rpcResult, error: rpcErr } = await supa.rpc('return_stock', {
      p_item_id: item.id,
      p_qty: qty
    });
    if (rpcErr) {
      toast('❌ ระบบขัดข้อง: ' + rpcErr.message + ' — กรุณาบันทึกใหม่อีกครั้ง', 'error');
      return;
    } else {
      if (rpcResult?.new_qty !== undefined) item.qty = rpcResult.new_qty;
    }
  }

  // Save return record
  const returnData = {
    req_id: reqId, ref_no: refNo,
    patient_id: req.patientId, patient_name: req.patientName,
    item_id: req.itemId, item_name: req.itemName,
    qty_returned: qty, unit: req.unit,
    unit_price: 0, total_credit: 0,
    reason, note: document.getElementById('return-note').value.trim(),
    credit_note_id: '',
    return_date: dateVal,
    created_by: currentUser?.displayName||currentUser?.username||'',
  };
  const { data: ins, error } = await supa.from('return_items').insert(returnData).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
  if(!db.returnItems) db.returnItems=[];
  db.returnItems.unshift(mapReturnItem(ins));

  toast(`↩️ คืน ${qty} ${req.unit} ${req.itemName} — สต็อกอัปเดตแล้ว`, 'success');
  closeModal('modal-return-item');
  renderReturnsTab();
}


function renderReturnsTab() {
  const container = document.getElementById('returns-list');
  if (!container) return;
  const returns = (db.returnItems||[]);
  if (!returns.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">ยังไม่มีรายการคืนสินค้า</div>`;
    return;
  }
  const totalQty = returns.reduce((s,r)=>s+r.qtyReturned,0);
  container.innerHTML = `
    <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;">
      <span style="font-size:13px;">↩️ คืนสินค้าทั้งหมด ${returns.length} รายการ</span>
      <span style="font-size:16px;font-weight:700;color:var(--accent);">รวม ${totalQty} หน่วย</span>
    </div>
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr>
          <th>เลขที่คืน</th><th>วันที่</th><th>ผู้รับบริการ</th>
          <th>รายการ</th><th>จำนวนที่คืน</th>
          <th>เหตุผล</th><th>บันทึกโดย</th><th>หมายเหตุ</th>
        </tr></thead>
        <tbody>
          ${returns.map(r=>`<tr>
            <td style="font-family:monospace;font-size:12px;">${r.refNo}</td>
            <td style="font-size:12px;">${r.returnDate}</td>
            <td style="font-weight:600;">${r.patientName}</td>
            <td>${r.itemName}</td>
            <td class="number">${r.qtyReturned} ${r.unit}</td>
            <td style="font-size:12px;">${r.reason}</td>
            <td style="font-size:12px;">${r.createdBy}</td>
            <td style="font-size:12px;color:var(--text2);">${r.note||'-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
}

async function renderHistory() {
  populateHistFilters();
  const search      = (document.getElementById('histSearch')?.value || '').toLowerCase();
  const monthFilter = document.getElementById('histMonth')?.value  || '';
  const patFilter   = document.getElementById('histPatient')?.value || '';
  const staffFilter = document.getElementById('histStaff')?.value   || '';
  const statusFilter= document.getElementById('histStatus')?.value  || '';

  const tb    = document.getElementById('histTable');
  const strip = document.getElementById('histSummaryStrip');
  const title = document.getElementById('histTableTitle');
  if(tb) tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3);">⏳ กำลังโหลด...</td></tr>';

  // Build Supabase query with server-side filters
  let q = supa.from('requisitions').select('*').order('id', {ascending:false}).limit(500);

  if (monthFilter) {
    const [y,m] = monthFilter.split('-');
    const firstDay = `${y}-${m}-01`;
    const lastDay  = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];
    q = q.gte('date', firstDay).lte('date', lastDay);
  } else {
    // Default: last 90 days
    const cutoff = new Date(Date.now()-90*86400000).toISOString().split('T')[0];
    q = q.gte('date', cutoff);
  }
  if (patFilter)    q = q.eq('patient_name', patFilter);
  if (staffFilter)  q = q.eq('staff_name', staffFilter);
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) { if(tb) tb.innerHTML=`<tr><td colspan="9" style="text-align:center;color:#e74c3c;">เกิดข้อผิดพลาด: ${error.message}</td></tr>`; return; }

  let reqs = (data||[]).map(mapReq);
  // caregiver / staff role sees only their own records
  if (!canSeeAllHistory() && currentUser) {
    reqs = reqs.filter(r => r.staffName === currentUser.displayName);
  }
  if (search) reqs = reqs.filter(r =>
    r.itemName.toLowerCase().includes(search) ||
    r.patientName.toLowerCase().includes(search) ||
    r.staffName.toLowerCase().includes(search));

  // Sync recent records back to db.requisitions (for approval panel etc.)
  reqs.forEach(r => { if(!db.requisitions.find(x=>x.id===r.id)) db.requisitions.unshift(r); });

  // Summary strip
  if (reqs.length > 0) {
    const totalQty = reqs.reduce((s,r) => s + (r.qty||0), 0);
    const uniqueItems = new Set(reqs.map(r => r.itemName)).size;
    let label = 'ประวัติการเบิกสินค้า';
    if (monthFilter) { const [y,m] = monthFilter.split('-'); label += ` — ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][parseInt(m)-1]} ${parseInt(y)+543}`; }
    if (patFilter)   label += ` — ${patFilter}`;
    if (staffFilter) label += ` — ${staffFilter}`;
    if (title) title.textContent = label;
    if (strip) strip.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">
        📋 <strong>${reqs.length}</strong> รายการ
      </div>
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">
        📦 รวม <strong>${totalQty}</strong> ชิ้น/หน่วย
      </div>
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">
        🗂️ <strong>${uniqueItems}</strong> ชนิดสินค้า
      </div>
    </div>`;
  } else {
    if (title) title.textContent = 'ประวัติการเบิกสินค้า';
    if (strip) strip.innerHTML = '';
  }

  if (!tb) return;
  if (reqs.length === 0) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบรายการ</td></tr>'; return; }
  const STATUS_COLOR = { pending:'#e67e22', forward:'#3498db', approved:'#27ae60', rejected:'#e74c3c' };
  const STATUS_LABEL = { pending:'รอธุรการ', forward:'รออนุมัติ L2', approved:'✅ อนุมัติ', rejected:'❌ ไม่อนุมัติ' };
  tb.innerHTML = reqs.map(r => `<tr>
    <td class="number" style="white-space:nowrap;">${r.date}</td>
    <td>${r.patientName}</td>
    <td style="font-weight:500;">${r.itemName}</td>
    <td class="number">${r.qty}</td>
    <td>${r.unit}</td>
    <td>${r.staffName}</td>
    <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${STATUS_COLOR[r.status]||'#888'}22;color:${STATUS_COLOR[r.status]||'#888'};">${STATUS_LABEL[r.status]||r.status}</span></td>
    <td style="color:var(--text2);font-size:12px;">${r.note || '-'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="openReqForm('${r.id}')" title="ดูใบเบิก">🖨️</button></td>
  </tr>`).join('');
}

// ===== REPORT =====
let reportTab = 'summary';

function populateReportFilters() {
  const patSel   = document.getElementById('reportPatient');
  const staffSel = document.getElementById('reportStaff');
  if (!patSel || !staffSel) return;
  const curPat = patSel.value, curStaff = staffSel.value;
  const patients = db.patients.map(p=>p.name).sort();
  const staffs   = db.staff.map(s=>s.name).sort();
  patSel.innerHTML   = '<option value="">ทั้งหมด</option>' + patients.map(p => `<option value="${p}" ${curPat===p?'selected':''}>${p}</option>`).join('');
  staffSel.innerHTML = '<option value="">ทั้งหมด</option>' + staffs.map(s => `<option value="${s}" ${curStaff===s?'selected':''}>${s}</option>`).join('');
}

function resetReportFilters() {
  document.getElementById('reportMonth').value   = '';
  document.getElementById('reportPatient').value = '';
  document.getElementById('reportStaff').value   = '';
  renderReport();
}

async function getFilteredReqs() {
  const monthFilter = document.getElementById('reportMonth')?.value  || '';
  const patFilter   = document.getElementById('reportPatient')?.value || '';
  const staffFilter = document.getElementById('reportStaff')?.value   || '';

  let q = supa.from('requisitions').select('*').order('id', {ascending:false}).limit(1000);
  if (monthFilter) {
    const [y,m] = monthFilter.split('-');
    q = q.gte('date',`${y}-${m}-01`).lte('date', new Date(parseInt(y),parseInt(m),0).toISOString().split('T')[0]);
  } else {
    q = q.gte('date', new Date(Date.now()-365*86400000).toISOString().split('T')[0]);
  }
  if (patFilter)   q = q.eq('patient_name', patFilter);
  if (staffFilter) q = q.eq('staff_name', staffFilter);

  const {data} = await q;
  let reqs = (data||[]).map(mapReq);
  if (!canSeeAllHistory() && currentUser) reqs = reqs.filter(r => r.staffName === currentUser.displayName);
  return reqs;
}

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function switchReportTab(tab) {
  reportTab = tab;
  const allTabs = ['summary','bypatient','byitem','bystaff','cost'];
  document.querySelectorAll('#reportTabs .tab').forEach((t, i) => {
    t.classList.toggle('active', allTabs[i] === tab);
  });
  allTabs.forEach(t => {
    const el = document.getElementById('report-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'cost') renderCostReport();
  else renderReport();
}

async function renderReport() {
  populateReportFilters();
  // Show loading
  ['summary','bypatient','byitem','bystaff'].forEach(t => {
    const el = document.getElementById('report-'+t);
    if(el && el.style.display!=='none') el.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);">⏳ กำลังโหลด...</div>';
  });
  const reqs = await getFilteredReqs();
  const monthFilter = document.getElementById('reportMonth')?.value  || '';
  const patFilter   = document.getElementById('reportPatient')?.value || '';
  const staffFilter = document.getElementById('reportStaff')?.value   || '';

  // Summary strip
  const strip = document.getElementById('reportSummaryStrip');
  if (strip && reqs.length > 0) {
    const totalQty    = reqs.reduce((s,r) => s + (r.qty||0), 0);
    const uniqueItems = new Set(reqs.map(r => r.itemName)).size;
    const uniquePats  = new Set(reqs.map(r => r.patientName)).size;
    let monthLabel = '';
    if (monthFilter) { const [y,m] = monthFilter.split('-'); monthLabel = `${MONTHS_TH[parseInt(m)-1]} ${parseInt(y)+543}`; }
    strip.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
      ${monthLabel ? `<div style="background:var(--accent-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;color:var(--accent);">📅 ${monthLabel}</div>` : ''}
      ${patFilter   ? `<div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🏥 ${patFilter}</div>` : ''}
      ${staffFilter ? `<div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">👤 ${staffFilter}</div>` : ''}
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📋 <strong>${reqs.length}</strong> รายการ</div>
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📦 รวม <strong>${totalQty}</strong> หน่วย</div>
      <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">🗂️ <strong>${uniqueItems}</strong> ชนิด / <strong>${uniquePats}</strong> คน</div>
    </div>`;
  } else if (strip) { strip.innerHTML = ''; }

  const empty = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบรายการ</td></tr>';

  if (reportTab === 'summary') {
    const tb = document.getElementById('reportTable');
    tb.innerHTML = reqs.length === 0 ? empty : reqs.map(r => `<tr>
      <td class="number" style="white-space:nowrap;">${r.date}</td>
      <td style="font-weight:500;">${r.itemName}</td>
      <td>${r.patientName}</td>
      <td class="number">${r.qty}</td>
      <td>${r.unit}</td>
      <td>${r.staffName}</td>
    </tr>`).join('');
  }

  if (reportTab === 'bypatient') {
    const map = {};
    reqs.forEach(r => {
      if (!map[r.patientName]) map[r.patientName] = { count: 0, items: new Set(), last: r.date };
      map[r.patientName].count++;
      map[r.patientName].items.add(r.itemName);
      if (r.date > map[r.patientName].last) map[r.patientName].last = r.date;
    });
    const tb = document.getElementById('reportByPatient');
    tb.innerHTML = Object.keys(map).length === 0 ? empty :
      Object.entries(map).sort((a,b) => b[1].count - a[1].count).map(([name, v]) =>
        `<tr>
          <td style="font-weight:500;">${name}</td>
          <td class="number">${v.count} ครั้ง</td>
          <td style="font-size:12px;color:var(--text2);">${[...v.items].join(', ')}</td>
          <td class="number" style="white-space:nowrap;">${v.last}</td>
        </tr>`
      ).join('');
  }

  if (reportTab === 'byitem') {
    const map = {};
    reqs.forEach(r => {
      if (!map[r.itemName]) map[r.itemName] = { total: 0, unit: r.unit, count: 0 };
      map[r.itemName].total += r.qty;
      map[r.itemName].count++;
    });
    const tb = document.getElementById('reportByItem');
    tb.innerHTML = Object.keys(map).length === 0 ? empty :
      Object.entries(map).sort((a,b) => b[1].total - a[1].total).map(([name, v]) =>
        `<tr>
          <td style="font-weight:500;">${name}</td>
          <td class="number">${v.total}</td>
          <td>${v.unit}</td>
          <td class="number">${v.count} ครั้ง</td>
        </tr>`
      ).join('');
  }

  if (reportTab === 'bystaff') {
    const map = {};
    reqs.forEach(r => {
      if (!map[r.staffName]) map[r.staffName] = { count: 0, items: new Set(), last: r.date };
      map[r.staffName].count++;
      map[r.staffName].items.add(r.itemName);
      if (r.date > map[r.staffName].last) map[r.staffName].last = r.date;
    });
    const tb = document.getElementById('reportByStaff');
    tb.innerHTML = Object.keys(map).length === 0 ? empty :
      Object.entries(map).sort((a,b) => b[1].count - a[1].count).map(([name, v]) =>
        `<tr>
          <td style="font-weight:500;">${name}</td>
          <td class="number">${v.count} ครั้ง</td>
          <td style="font-size:12px;color:var(--text2);">${[...v.items].slice(0,5).join(', ')}${v.items.size > 5 ? ` +${v.items.size-5} อื่นๆ` : ''}</td>
          <td class="number" style="white-space:nowrap;">${v.last}</td>
        </tr>`
      ).join('');
  }
}

// ===== REQUISITION FORM (printable) =====

// Render a single requisition as a printable form and navigate to it
function openReqForm(reqId) {
  const group = db.reqGroups ? db.reqGroups.find(g => g.id === reqId) : null;
  // Fallback: build from individual requisitions with same id
  const reqs = group
    ? group.items.map(ri => ({ ...ri, patientName: group.patientName, staffName: group.staffName, date: group.date, note: group.note, status: group.status, refNo: group.refNo }))
    : db.requisitions.filter(r => r.groupId === reqId || r.id === reqId);

  if (!reqs.length) { toast('ไม่พบข้อมูลใบเบิก', 'warning'); return; }

  const first = reqs[0];
  renderReqForm({ reqs, first, group });
  document.getElementById('reqFormPageTitle').textContent = `ใบเบิกสินค้า — ${first.refNo || ('#' + first.id)}`;
  showPage('reqform');
}

function renderReqForm({ reqs, first, group }) {
  const statusLabel = { pending:'รอหัวหน้าตรวจสอบ', forward:'รออนุมัติ (L2)', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ', '':'รอดำเนินการ' };
  const statusClass = { pending:'rq-status-pending', forward:'rq-status-pending', approved:'rq-status-approved', rejected:'rq-status-rejected', '':'rq-status-pending' };
  const status    = group?.status    || first.status    || 'pending';
  const refNo     = group?.refNo     || first.refNo     || ('#' + first.id);
  const patient   = group?.patientName || first.patientName || '-';
  const staffName = group?.staffName  || first.staffName  || (currentUser?.displayName || '-');
  const date      = group?.date       || first.date       || new Date().toISOString().split('T')[0];
  const note      = group?.note       || first.note       || '';
  const approverName = group?.approvedBy  || first.approvedBy  || '';
  const reviewerName = group?.reviewedBy  || first.reviewedBy  || '';
  const approvedDate = group?.approvedAt  ? group.approvedAt.split('T')[0]  : (first.approvedAt ? first.approvedAt.split('T')[0] : '');
  const printDate = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });

  // Format Thai date
  const thDate = (d) => {
    if (!d) return '...............';
    try {
      return new Date(d).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    } catch(e) { return d; }
  };

  // Workflow step states
  const wfMap = { pending:1, forward:2, approved:3, rejected:3 };
  const currentStep = wfMap[status] || 1;
  const wfSteps = [
    { label:'สร้างใบเบิก',       sub: thDate(date) },
    { label:'หัวหน้าตรวจสอบ',   sub: reviewerName || (currentStep >= 2 ? '✓' : '...') },
    { label:'อนุมัติ / ตัดสต็อก', sub: approverName || (currentStep >= 3 ? (status==='rejected'?'ไม่อนุมัติ':'✓') : '...') },
  ];

  const minRows = 8;
  const padRows = Math.max(0, minRows - reqs.length);

  document.getElementById('reqFormContent').innerHTML = `
    <!-- == HEADER == -->
    <div class="rq-print-header">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="img/logo.png" alt="Navasri Logo" style="width:70px;height:70px;object-fit:contain;border-radius:8px;background:#e8f4ee;padding:6px;flex-shrink:0;border:1px solid #cce8d8;">
        <div>
          <div class="rq-hospital-name">นวศรี เนอร์สซิ่งโฮม</div>
          <div class="rq-hospital-sub">Navasri Nursing Home</div>
          <div class="rq-hospital-sub">ระบบบริหารสต็อก · Stock Management System</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:4px;">ใบเบิกสินค้า</div>
        <div style="font-size:11px;font-family:monospace;color:#555;margin-bottom:6px;">${refNo}</div>
        <span class="rq-status-badge ${statusClass[status] || 'rq-status-pending'}">${statusLabel[status] || status}</span>
        <div style="font-size:10px;color:#888;margin-top:5px;">พิมพ์: ${printDate}</div>
      </div>
    </div>

    <!-- == DOC INFO == -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #ccc;border-radius:4px;margin:10px 0;font-size:12.5px;overflow:hidden;">
      <div style="padding:7px 12px;border-right:1px solid #ccc;border-bottom:1px solid #ccc;">
        <span style="color:#666;">เลขที่ใบเบิก:</span> <strong style="font-family:monospace;">${refNo}</strong>
      </div>
      <div style="padding:7px 12px;border-bottom:1px solid #ccc;">
        <span style="color:#666;">วันที่:</span> <strong>${thDate(date)}</strong>
      </div>
      <div style="padding:7px 12px;border-right:1px solid #ccc;">
        <span style="color:#666;">ผู้รับบริการ:</span> <strong>${patient}</strong>
      </div>
      <div style="padding:7px 12px;">
        <span style="color:#666;">ผู้เบิก:</span> <strong>${staffName}</strong>
      </div>
    </div>

    <!-- == WORKFLOW TIMELINE == -->
    <div style="border:1px solid #e0e0e0;border-radius:4px;padding:10px 16px;margin:10px 0;background:#fafafa;">
      <div style="font-size:10px;color:#888;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">สถานะ Workflow</div>
      <div class="rq-timeline">
        ${wfSteps.map((s,i) => {
          const done   = i+1 < currentStep;
          const active = i+1 === currentStep;
          const rej    = status === 'rejected' && i+1 === currentStep;
          const circleClass = rej ? 'active' : done ? 'done' : active ? 'active' : '';
          const circleText  = done ? '✓' : rej ? '✕' : (i+1);
          return `<div class="rq-tl-step">
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div class="rq-tl-circle ${circleClass}" style="${rej?'background:#c0392b;border-color:#c0392b;':''}">${circleText}</div>
              <div style="font-size:10px;color:#444;text-align:center;line-height:1.4;margin-top:3px;font-weight:600;">${s.label}</div>
              <div style="font-size:9.5px;color:#888;text-align:center;">${s.sub}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- == ITEMS TABLE == -->
    <table class="rq-table">
      <thead>
        <tr>
          <th style="width:34px;">ลำดับ</th>
          <th style="text-align:left;">รายการสินค้า / ยา / เวชภัณฑ์</th>
          <th style="width:72px;">จำนวนขอ</th>
          <th style="width:52px;">หน่วย</th>
          <th style="width:72px;">จำนวนจ่าย</th>
          <th style="width:52px;">หน่วย</th>
          <th style="width:80px;">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${reqs.map((r,i) => `<tr>
          <td class="center" style="color:#555;">${i+1}</td>
          <td style="font-weight:500;">${r.itemName}</td>
          <td class="center" style="font-weight:700;">${r.qty}</td>
          <td class="center" style="color:#555;">${r.unit}</td>
          <td class="center" style="color:#aaa;">______</td>
          <td class="center" style="color:#555;">${r.unit}</td>
          <td style="color:#aaa;">____________</td>
        </tr>`).join('')}
        ${Array.from({length: padRows}, (_,i) => `<tr style="height:26px;">
          <td class="center" style="color:#ddd;">${reqs.length+i+1}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <!-- == NOTE == -->
    <div style="margin-top:8px;font-size:12px;">
      <strong>หมายเหตุ / Note:</strong>
      <div class="rq-note-box">${note || '&nbsp;'}</div>
    </div>

    <!-- == SIGNATURES == -->
    <div class="rq-sign-row" style="margin-top:20px;">
      <div class="rq-sign-box">
        <div class="rq-sign-line"></div>
        <div class="rq-sign-label">ผู้เบิก / Requested by</div>
        <div class="rq-sign-name">${staffName ? '('+staffName+')' : '(.............................)'}</div>
        <div style="font-size:10.5px;color:#888;margin-top:3px;">วันที่: ${thDate(date)}</div>
      </div>
      <div class="rq-sign-box">
        <div class="rq-sign-line"></div>
        <div class="rq-sign-label">ผู้ตรวจสอบ / Reviewed by</div>
        <div class="rq-sign-name">${reviewerName ? '('+reviewerName+')' : '(.............................)'}</div>
        <div style="font-size:10.5px;color:#888;margin-top:3px;">วันที่: ${currentStep >= 2 ? thDate(approvedDate||date) : '...............'}</div>
      </div>
      <div class="rq-sign-box">
        <div class="rq-sign-line"></div>
        <div class="rq-sign-label">ผู้อนุมัติ / Approved by</div>
        <div class="rq-sign-name">${approverName ? '('+approverName+')' : '(.............................)'}</div>
        <div style="font-size:10.5px;color:#888;margin-top:3px;">
          ${status==='approved' ? '<span style="color:#2a7a4f;font-weight:600;">✓ อนุมัติ</span> ' + thDate(approvedDate) :
            status==='rejected' ? '<span style="color:#c0392b;font-weight:600;">✕ ไม่อนุมัติ</span>' :
            'วันที่: ...............'}
        </div>
      </div>
    </div>

    <!-- == FOOTER == -->
    <div style="margin-top:18px;padding-top:8px;border-top:1px dashed #ccc;display:flex;justify-content:space-between;font-size:10px;color:#aaa;">
      <span>เอกสารสร้างโดยระบบบริหารสต็อก นวศรี เนอร์สซิ่งโฮม</span>
      <span>${refNo} · ${new Date().toLocaleString('th-TH')}</span>
    </div>
  `;
}

function printReqForm() {
  const content = document.getElementById('reqFormContent').innerHTML;
  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>ใบเบิกสินค้า</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'IBM Plex Sans Thai', sans-serif; background: white; padding: 18mm; }
      ${getReqPrintCSS()}
    </style>
  </head><body>${content}
</body></html>`);
  printWin.document.close();
  printWin.onload = () => { printWin.focus(); printWin.print(); };
}

async function exportReqPDF() {
  const btn = document.getElementById('btnExportPDF');
  const spinner = document.getElementById('pdfSpinner');
  btn.disabled = true;
  spinner.style.display = 'inline';

  try {
    const el = document.getElementById('reqFormContent');
    // Temporarily fix width for capture
    const origStyle = el.style.cssText;
    el.style.width = '794px'; // A4 width at 96dpi
    el.style.maxWidth = '794px';

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 900,
    });

    el.style.cssText = origStyle;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
    } else {
      // Multi-page: slice canvas
      const pageImgH = pageH - margin * 2;
      const canvasPageH = (pageImgH * canvas.width) / imgW;
      let y = 0;
      while (y < canvas.height) {
        if (y > 0) pdf.addPage();
        const sliceH = Math.min(canvasPageH, canvas.height - y);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceImgH = (sliceH * imgW) / canvas.width;
        pdf.addImage(sliceData, 'JPEG', margin, margin, imgW, sliceImgH);
        y += canvasPageH;
      }
    }

    // Get refNo for filename
    const refEl = document.getElementById('reqFormPageTitle');
    const refNo = refEl ? refEl.textContent.replace('ใบเบิกสินค้า — ', '').trim() : 'REQ';
    pdf.save(`ใบเบิก_${refNo}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast('✅ Export PDF สำเร็จ', 'success');
  } catch(e) {
    console.error(e);
    toast('❌ Export PDF ผิดพลาด: ' + e.message, 'error');
  }

  btn.disabled = false;
  spinner.style.display = 'none';
}

function getReqPrintCSS() {
  // Extract .rq-* CSS from the main stylesheet for the print window
  const sheets = Array.from(document.styleSheets);
  let css = '';
  try {
    for (const sheet of sheets) {
      const rules = Array.from(sheet.cssRules || []);
      for (const rule of rules) {
        if (rule.selectorText && (rule.selectorText.includes('.rq-') || rule.selectorText.includes('table') || rule.selectorText.includes('body'))) {
          css += rule.cssText + '\n';
        }
      }
    }
  } catch(e) {}
  return css || `
    table { width:100%;border-collapse:collapse; }
    th,td { border:1px solid #bbb;padding:6px 10px;font-size:12.5px; }
    th { background:#f0f0f0;font-weight:700;text-align:center; }
    .rq-print-header { display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:10px;border-bottom:2px solid #000;margin-bottom:12px; }
    .rq-hospital-name { font-size:16px;font-weight:700; }
    .rq-hospital-sub { font-size:11px;color:#444; }
    .rq-sign-row { display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:24px; }
    .rq-sign-box { text-align:center; }
    .rq-sign-line { border-bottom:1px solid #000;margin:32px 10px 6px; }
    .rq-sign-label { font-size:11.5px;color:#444; }
    .rq-sign-name { font-size:12px;font-weight:600;margin-top:2px; }
    .rq-status-badge { display:inline-block;padding:3px 12px;border-radius:20px;font-size:11.5px;font-weight:700;border:1.5px solid; }
    .rq-status-pending { color:#d4760a;border-color:#d4760a;background:#fef3e0; }
    .rq-status-approved { color:#2a7a4f;border-color:#2a7a4f;background:#e8f5ee; }
    .rq-status-rejected { color:#c0392b;border-color:#c0392b;background:#fdecea; }
    .rq-note-box { border:1px solid #ccc;border-radius:4px;padding:8px 10px;min-height:36px;margin-top:6px;font-size:12px;color:#444; }
    .rq-timeline { display:flex;align-items:flex-start;margin:8px 0; }
    .rq-tl-step { flex:1;text-align:center;position:relative; }
    .rq-tl-step:not(:last-child)::after { content:'';position:absolute;top:10px;left:50%;width:100%;height:1.5px;background:#bbb;z-index:0; }
    .rq-tl-circle { width:20px;height:20px;border-radius:50%;background:#eee;border:1.5px solid #bbb;color:#888;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;position:relative;z-index:1;margin-bottom:4px; }
    .rq-tl-circle.done { background:#2a7a4f;border-color:#2a7a4f;color:white; }
    .rq-tl-circle.active { background:#d4760a;border-color:#d4760a;color:white; }
    .center { text-align:center; }
  `;
}

function exportRequisitionExcel() {
  const rows = [
    ['#', 'วันที่', 'เลขอ้างอิง', 'ผู้รับบริการ', 'สินค้า', 'จำนวน', 'หน่วย', 'ผู้เบิก', 'สถานะ', 'หมายเหตุ']
  ];
  db.requisitions.forEach((r, i) => {
    const statusLabel = r.status === 'approved' ? 'อนุมัติแล้ว' : r.status === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ';
    rows.push([
      i+1, r.date || '', r.refNo || r.id || '',
      r.patientName || '', r.itemName || '',
      r.qty || 0, r.unit || '',
      r.staffName || '', statusLabel, r.note || ''
    ]);
  });
  _xlsxDownload(rows, 'ใบเบิกสินค้า', 'navasri_requisitions_' + new Date().toISOString().slice(0,10));
}

// ===== BARCODE SCAN FOR REQUISITION =====
function onReqBarcodeScan() {
  const el = document.getElementById('req-barcode-scan');
  if (!el) return;
  clearTimeout(el._scanTimer);
  el._scanTimer = setTimeout(() => {
    const code = el.value.trim();
    if (!code) return;
    const item = lookupItemByBarcode(code);
    if (!item) {
      if (code.length >= 4) toast('ไม่พบสินค้ารหัส: ' + code, 'warning');
      el.value = '';
      return;
    }
    addReqItemByBarcode(item);
    el.value = '';
    el.focus();
  }, 300);
}

function addReqItemByBarcode(item) {
  // ตรวจว่ามีในรายการแล้วไหม
  const existing = reqItems.find(r => r.itemId === item.id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
    renderReqItems();
    toast(`เพิ่ม ${item.name} (${existing.qty} ${item.unit})`, 'success');
    return;
  }
  reqItems.push({ itemId: item.id, itemName: item.name, qty: 1, unit: item.dispenseUnit || item.unit });
  renderReqItems();
  toast(`เพิ่ม ${item.name} ✅`, 'success');
}

// ===== COST ANALYSIS REPORT (Phase 4) =====
function renderCostReport() {
  const monthFilter = document.getElementById('reportMonth')?.value || '';
  const reqs = (db.requisitions || []).filter(r => {
    if (r.status !== 'approved') return false;
    if (monthFilter && !(r.date||'').startsWith(monthFilter)) return false;
    return true;
  });

  // ── Cost by patient ──────────────────────────────────────
  const byPatEl = document.getElementById('cost-bypatient');
  if (byPatEl) {
    const patMap = {};
    reqs.forEach(r => {
      const item  = db.items.find(i => i.id == r.itemId);
      const price = item?.price || item?.cost || 0;
      const amt   = (r.qty || 0) * price;
      const billable = item?.isBillable !== false;
      if (!patMap[r.patientId]) patMap[r.patientId] = { name: r.patientName || '-', bill: 0, nonBill: 0 };
      if (billable) patMap[r.patientId].bill += amt;
      else          patMap[r.patientId].nonBill += amt;
    });
    const sorted = Object.entries(patMap).sort((a,b) => (b[1].bill+b[1].nonBill) - (a[1].bill+a[1].nonBill));
    if (sorted.length === 0) {
      byPatEl.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</td></tr>';
    } else {
      byPatEl.innerHTML = sorted.map(([, d]) => {
        const total = d.bill + d.nonBill;
        return '<tr>' +
          '<td style="font-weight:500;">' + d.name + '</td>' +
          '<td style="text-align:right;color:var(--green);">฿' + d.bill.toLocaleString() + '</td>' +
          '<td style="text-align:right;color:var(--text2);">฿' + d.nonBill.toLocaleString() + '</td>' +
          '<td style="text-align:right;font-weight:600;">฿' + total.toLocaleString() + '</td></tr>';
      }).join('');
    }
  }

  // ── Top items ────────────────────────────────────────────
  const topEl = document.getElementById('cost-topitems');
  if (topEl) {
    const itemMap = {};
    reqs.forEach(r => {
      const item  = db.items.find(i => i.id == r.itemId);
      const price = item?.price || item?.cost || 0;
      if (!itemMap[r.itemId]) itemMap[r.itemId] = { name: r.itemName || '-', qty: 0, value: 0 };
      itemMap[r.itemId].qty   += (r.qty || 0);
      itemMap[r.itemId].value += (r.qty || 0) * price;
    });
    const sorted = Object.entries(itemMap).sort((a,b) => b[1].value - a[1].value).slice(0, 10);
    if (sorted.length === 0) {
      topEl.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text3);">ไม่มีข้อมูล</td></tr>';
    } else {
      topEl.innerHTML = sorted.map(([, d]) =>
        '<tr><td style="font-weight:500;">' + d.name + '</td>' +
        '<td style="text-align:right;">' + d.qty.toLocaleString() + '</td>' +
        '<td style="text-align:right;font-weight:600;">฿' + d.value.toLocaleString() + '</td></tr>'
      ).join('');
    }
  }

  // ── Billable vs Non-billable summary ─────────────────────
  const billEl = document.getElementById('cost-billable-summary');
  if (billEl) {
    let billAmt = 0, nonBillAmt = 0;
    reqs.forEach(r => {
      const item  = db.items.find(i => i.id == r.itemId);
      const price = item?.price || item?.cost || 0;
      const amt   = (r.qty || 0) * price;
      if (item?.isBillable !== false) billAmt += amt;
      else nonBillAmt += amt;
    });
    const total = billAmt + nonBillAmt;
    const billPct    = total > 0 ? Math.round(billAmt / total * 100) : 0;
    const nonBillPct = 100 - billPct;
    billEl.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">' +
        '<div style="background:var(--surface2);border-radius:8px;padding:14px;text-align:center;">' +
          '<div style="font-size:11px;color:var(--text3);">💰 Billable</div>' +
          '<div style="font-size:22px;font-weight:600;color:var(--green);">฿' + billAmt.toLocaleString() + '</div>' +
          '<div style="font-size:12px;color:var(--text2);">' + billPct + '%</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:14px;text-align:center;">' +
          '<div style="font-size:11px;color:var(--text3);">🏥 Non-Billable</div>' +
          '<div style="font-size:22px;font-weight:600;color:var(--text2);">฿' + nonBillAmt.toLocaleString() + '</div>' +
          '<div style="font-size:12px;color:var(--text2);">' + nonBillPct + '%</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:14px;text-align:center;">' +
          '<div style="font-size:11px;color:var(--text3);">รวมทั้งหมด</div>' +
          '<div style="font-size:22px;font-weight:600;">฿' + total.toLocaleString() + '</div>' +
          '<div style="font-size:12px;color:var(--text2);">' + reqs.length + ' รายการ</div>' +
        '</div>' +
      '</div>';
  }
}
