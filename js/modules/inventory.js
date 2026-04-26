// ===== INVENTORY MODULE =====

// ===== STOCK =====

// ===== BARCODE FUNCTIONS =====
function generateBarcode(category) {
  // หมายเหตุ: รหัสสร้างจาก local cache (db.items)
  // ความเสี่ยง: ถ้าหลายคนสร้างสินค้าพร้อมกัน อาจได้รหัสซ้ำกันได้
  // แนะนำ: ย้ายการสร้างรหัสไปทำที่ Supabase (function/trigger) ในอนาคต
  const prefixMap = { 'ยา':'MED', 'เวชภัณฑ์':'SUP', 'ของใช้':'GEN', 'บริการ':'SVC' };
  const prefix = prefixMap[category] || 'OTH';
  const existing = new Set(db.items.filter(i => i.barcode).map(i => i.barcode));
  let seq = db.items.filter(i => i.category === category && i.barcode).length + 1;
  let code;
  do {
    code = `NVS-${prefix}-${String(seq).padStart(3,'0')}`;
    seq++;
  } while (existing.has(code));
  return code;
}

function onItemCategoryChange() {
  const cat = document.getElementById('item-cat').value;
  const editId = document.getElementById('editItemIdx').value;
  if (!editId) {
    const bc = document.getElementById('item-barcode');
    if (!bc.value) bc.value = generateBarcode(cat);
  }
}



function printItemBarcode() {
  const code = document.getElementById('item-barcode').value.trim();
  const name = document.getElementById('item-name').value.trim();
  if (!code) { toast('ไม่มีรหัสบาร์โค้ด', 'warning'); return; }
  _doPrintBarcode(code, name);
}

// พิมพ์บาร์โค้ดจากตารางสินค้าโดยตรง (ไม่ต้องเปิด modal)
function printBarcodeById(itemId) {
  const item = db.items.find(i => i.id == itemId);
  if (!item || !item.barcode) { toast('ไม่มีรหัสบาร์โค้ด', 'warning'); return; }
  _doPrintBarcode(item.barcode, item.name);
}

// ฟังก์ชันกลางสำหรับพิมพ์บาร์โค้ด
function _doPrintBarcode(code, name) {
  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(tmpSvg);
  try {
    JsBarcode(tmpSvg, code, { format:'CODE128', width:2, height:60, displayValue:false, margin:8 });
  } catch(e) {
    document.body.removeChild(tmpSvg);
    toast('สร้างบาร์โค้ดไม่สำเร็จ: ' + e.message, 'error');
    return;
  }
  const svgHtml = tmpSvg.outerHTML;
  document.body.removeChild(tmpSvg);
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safeCode = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const win = window.open('', '_blank', 'width=340,height=220');
  win.document.write(`<!DOCTYPE html><html><head><title>Barcode</title>
    <style>
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}
      .code{font-size:13px;font-weight:600;letter-spacing:1.5px;margin-top:2px;}
      .name{font-size:10px;color:#555;margin-top:2px;max-width:220px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    </style>
    </head><body>
    ${svgHtml}
    <div class="code">${safeCode}</div>
    <div class="name">${safeName}</div>
    <script>setTimeout(() => window.print(), 300);<\/script>
    </body></html>`);
  win.document.close();
}

function renderStock() {
  const search = (document.getElementById('stockSearch')?.value || '').toLowerCase();
  const catFilter = document.getElementById('stockCatFilter')?.value || '';
  const statusFilter = document.getElementById('stockStatusFilter')?.value || '';

  let items = db.items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search) &&
        !(item.barcode||'').toLowerCase().includes(search) &&
        !(item.barcodeExternal||'').toLowerCase().includes(search)) return false;
    if (catFilter && item.category !== catFilter) return false;
    if (statusFilter === 'out' && item.qty > 0) return false;
    if (statusFilter === 'low' && (item.qty === 0 || item.qty > item.reorder)) return false;
    if (statusFilter === 'ok' && item.qty <= item.reorder) return false;
    return true;
  });

  document.getElementById('stockCount').textContent = `รายการทั้งหมด: ${items.length}`;

  const catBadges = { ยา:'badge-red', เวชภัณฑ์:'badge-orange', ของใช้:'badge-blue', บริการ:'badge-purple' };
  const tb = document.getElementById('stockTable');
  if (items.length === 0) {
    tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text3);">ไม่พบรายการ</td></tr>';
    return;
  }
  tb.innerHTML = items.map((item, i) => {
    const pct = Math.min(100, (item.qty / Math.max(item.reorder * 2, 1)) * 100);
    let statusBadge, rowClass = '';
    if (item.qty === 0) { statusBadge = '<span class="badge badge-red">หมดแล้ว</span>'; rowClass = 'critical-stock'; }
    else if (item.qty <= item.reorder) { statusBadge = '<span class="badge badge-orange">ใกล้หมด</span>'; rowClass = 'low-stock'; }
    else { statusBadge = '<span class="badge badge-green">ปกติ</span>'; }

    const fillColor = item.qty === 0 ? 'var(--red)' : item.qty <= item.reorder ? 'var(--orange)' : 'var(--green)';
    const photoEl = item.photo
      ? `<img src="${item.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;" onclick="showItemPhoto('${item.id}')" title="${item.name}">`
      : `<div style="width:40px;height:40px;border-radius:6px;border:2px dashed var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;" onclick="editItem('${item.id}')" title="เพิ่มรูปภาพ">📷</div>`;

    // Lot info
    const lots = getLotsForItem(item.id);
    const nearExpLots = lots.filter(l => getLotStatus(l.expiryDate) !== 'ok');
    const lotBadge = nearExpLots.length > 0
      ? `<span class="badge badge-red" title="${nearExpLots.length} lot ใกล้/หมดอายุ" style="cursor:pointer;" onclick="showLotDetail('${item.id}')">🚨 ${nearExpLots.length} lot</span>`
      : lots.length > 0
        ? `<span class="badge badge-gray" style="cursor:pointer;font-size:10px;" onclick="showLotDetail('${item.id}')">${lots.length} lot</span>`
        : '';

    // Unit conversion badge
    const pUnit = item.purchaseUnit || item.unit;
    const dUnit = item.dispenseUnit || item.unit;
    const factor = item.conversionFactor || 1;
    const unitTxt = factor > 1 || pUnit !== dUnit
      ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;">${dUnit} (${factor}/${pUnit})</div>`
      : `<div style="font-size:12px;color:var(--text2);">${item.unit}</div>`;

    // Billable badge
    const billableBadge = item.isBillable !== false
      ? '<span style="font-size:10px;color:#27ae60;font-weight:600;">💰 Billable</span>'
      : '<span style="font-size:10px;color:#95a5a6;">🏥 Non-Bill</span>';

    // Barcode SVG แบบขีดๆ (สร้างจาก JsBarcode)
    let barcodeSvg = '';
    if (item.barcode && typeof JsBarcode !== 'undefined') {
      try {
        const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(tmpSvg);
        JsBarcode(tmpSvg, item.barcode, { format:'CODE128', width:1.2, height:28, displayValue:false, margin:2 });
        barcodeSvg = tmpSvg.outerHTML;
        document.body.removeChild(tmpSvg);
      } catch(e) { barcodeSvg = ''; }
    }

    return `<tr class="${rowClass}">
      <td style="color:var(--text3);font-size:12px;" class="number">${i+1}</td>
      <td style="padding:6px 8px;">${photoEl}</td>
      <td style="font-weight:600;">${item.name}<br>${billableBadge}</td>
      <td>
        ${barcodeSvg ? `<div style="line-height:0;">${barcodeSvg}</div>` : ''}
        <span style="font-family:monospace;font-size:10px;color:var(--text3);">${item.barcode||'—'}</span>
      </td>
      <td><span class="badge ${catBadges[item.category]||'badge-gray'}">${item.category}</span></td>
      <td>
        <div class="number" style="font-weight:600;">${item.qty}</div>
        <div class="stock-bar" style="width:80px;"><div class="stock-fill" style="width:${pct}%;background:${fillColor};"></div></div>
      </td>
      <td>${unitTxt}</td>
      <td class="number" style="color:var(--text2);">${item.reorder}</td>
      <td class="number" style="font-size:12px;color:var(--text2);">${item.cost > 0 ? item.cost.toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
      <td class="number" style="font-size:12px;color:var(--text2);">${item.price > 0 ? item.price.toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
      <td>${statusBadge}${lotBadge ? '<br>'+lotBadge : ''}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm" onclick="openReceiveForItem('${item.id}')" style="background:var(--sage);color:#fff;margin-right:4px;" title="รับสินค้าเข้า">➕ รับ</button>
        <button class="btn btn-ghost btn-sm" onclick="editItem('${item.id}')" style="margin-right:4px;" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="printBarcodeById('${item.id}')" style="margin-right:4px;" title="พิมพ์บาร์โค้ด">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteItem('${item.id}')" title="ลบ">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function showLotDetail(itemId) {
  const item = db.items.find(i => i.id == itemId);
  if (!item) return;
  const lots = (db.itemLots || []).filter(l => l.itemId == itemId).sort((a,b)=>(a.expiryDate||'zzz').localeCompare(b.expiryDate||'zzz'));
  const warnDays = getExpiryWarnDays();
  const rows = lots.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px;">ยังไม่มีข้อมูล Lot</td></tr>'
    : lots.map(l => {
        const status = getLotStatus(l.expiryDate);
        const badge = status === 'expired' ? '<span class="badge badge-red">หมดอายุ</span>'
          : status === 'expiring' ? '<span class="badge badge-orange">ใกล้หมด</span>'
          : l.expiryDate ? '<span class="badge badge-green">ปกติ</span>'
          : '<span class="badge badge-gray">ไม่ระบุ</span>';
        const dispUnit = item.dispenseUnit || item.unit;
        return `<tr style="${status==='expired'?'background:#fff5f5':status==='expiring'?'background:#fff8f0':''}">
          <td style="font-family:monospace;font-size:12px;">${l.lotNumber||'-'}</td>
          <td>${l.receivedDate||'-'}</td>
          <td style="font-family:monospace;color:${status==='expired'?'#c0392b':status==='expiring'?'#e67e22':'inherit'};">${l.expiryDate||'-'}</td>
          <td class="number">${l.qtyInLot}</td>
          <td class="number" style="font-weight:600;">${l.qtyRemaining} ${dispUnit}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('');
  const pUnit = item.purchaseUnit || item.unit;
  const dUnit = item.dispenseUnit || item.unit;
  const factor = item.conversionFactor || 1;
  document.getElementById('lot-detail-title').textContent = `🏷️ Lot ทั้งหมด — ${item.name}`;
  document.getElementById('lot-detail-unit').textContent = factor > 1 ? `ซื้อ: ${pUnit} | เบิก: ${dUnit} | 1 ${pUnit} = ${factor} ${dUnit}` : `หน่วย: ${dUnit}`;
  document.getElementById('lot-detail-body').innerHTML = rows;
  openModal('modal-lot-detail');
}

// ===== ITEM CRUD =====
function openAddItemModal() {
  document.getElementById('editItemIdx').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-cat').value = 'ยา';
  document.getElementById('item-unit').value = '';
  document.getElementById('item-qty').value = 0;
  document.getElementById('item-reorder').value = 10;
  document.getElementById('item-cost').value  = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-photo-data').value = '';
  document.getElementById('item-photo-preview').innerHTML = '📷';
  document.getElementById('item-purchase-unit').value = '';
  document.getElementById('item-dispense-unit').value = '';
  document.getElementById('item-conversion').value = 1;
  document.getElementById('item-billable').checked = true;
  document.getElementById('item-barcode').value = '';
  document.getElementById('item-barcode-ext').value = '';
  document.getElementById('btn-print-barcode').style.display = 'none';
  document.querySelector('.modal-overlay#modal-addItem .modal-title').textContent = 'เพิ่มรายการสินค้า';
  openModal('modal-addItem');
}

function editItem(id) {
  const item = db.items.find(i => i.id === id);
  if (!item) return;
  document.getElementById('editItemIdx').value = id;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-cat').value = item.category;
  document.getElementById('item-unit').value = item.unit;
  document.getElementById('item-qty').value = item.qty;
  document.getElementById('item-reorder').value = item.reorder;
  document.getElementById('item-cost').value  = item.cost  || '';
  document.getElementById('item-price').value = item.price || '';
  document.getElementById('item-purchase-unit').value = item.purchaseUnit || item.unit || '';
  document.getElementById('item-dispense-unit').value = item.dispenseUnit || item.unit || '';
  document.getElementById('item-conversion').value = item.conversionFactor || 1;
  document.getElementById('item-billable').checked = item.isBillable !== false;
  const photoData = item.photo || '';
  document.getElementById('item-photo-data').value = photoData;
  const prev = document.getElementById('item-photo-preview');
  prev.innerHTML = photoData ? `<img src="${photoData}" style="width:80px;height:80px;object-fit:cover;">` : '📷';
  document.getElementById('item-barcode').value = item.barcode || '';
  document.getElementById('item-barcode-ext').value = item.barcodeExternal || '';
  document.getElementById('btn-print-barcode').style.display = item.barcode ? '' : 'none';
  document.querySelector('.modal-overlay#modal-addItem .modal-title').textContent = 'แก้ไขรายการสินค้า';
  openModal('modal-addItem');
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อรายการ', 'warning'); return; }
  const editId = document.getElementById('editItemIdx').value;
  const photoEl = document.getElementById('item-photo-data');
  let photoVal = photoEl.value;
  if (photoVal === '__pending__' && photoEl._pendingFile) {
    try { photoVal = await uploadPhotoToStorage(photoEl._pendingFile, 'items'); }
    catch(e) { toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message, 'error'); return; }
  } else if (photoVal === '__pending__') { photoVal = ''; }
  const costVal  = parseFloat(document.getElementById('item-cost').value) || 0;
  const priceVal = parseFloat(document.getElementById('item-price').value) || 0;
  const unitVal  = document.getElementById('item-unit').value;
  const purchaseUnit = document.getElementById('item-purchase-unit').value.trim() || unitVal;
  const dispenseUnit = document.getElementById('item-dispense-unit').value.trim() || unitVal;
  const convFactor   = parseFloat(document.getElementById('item-conversion').value) || 1;
  const isBillable   = document.getElementById('item-billable').checked;
  const barcodeVal = document.getElementById('item-barcode').value.trim();
  const barcodeExt = document.getElementById('item-barcode-ext').value.trim();
  // ตรวจ duplicate barcode
  if (barcodeVal) {
    const dup = db.items.find(i => i.barcode === barcodeVal && i.id != editId);
    if (dup) { toast(`รหัสบาร์โค้ด "${barcodeVal}" ซ้ำกับ "${dup.name}"`, 'error'); return; }
  }
  if (barcodeExt) {
    const dupExt = db.items.find(i => i.barcodeExternal === barcodeExt && i.id != editId);
    if (dupExt) { toast(`บาร์โค้ดผู้ผลิต "${barcodeExt}" ซ้ำกับ "${dupExt.name}"`, 'error'); return; }
  }
  const data = {
    name, category: document.getElementById('item-cat').value,
    ...(barcodeVal ? { barcode: barcodeVal } : {}),
    ...(barcodeExt ? { barcode_external: barcodeExt } : {}),
    unit: unitVal,
    qty: editId ? (parseInt(document.getElementById('item-qty').value) || 0) : 0,
    reorder: parseInt(document.getElementById('item-reorder').value) || 10,
    cost: costVal, price: priceVal,
    purchase_unit: purchaseUnit,
    dispense_unit: dispenseUnit,
    conversion_factor: convFactor,
    is_billable: isBillable,
    ...(photoVal ? { photo: photoVal } : {}),
  };
  if (editId) {
    const { error } = await supa.from('items').update(data).eq('id', editId);
    if (error) {
      if (error.code === '23505' || (error.message && error.message.includes('duplicate'))) {
        toast('รหัสบาร์โค้ดซ้ำกับสินค้าอื่น กรุณาเปลี่ยนรหัสแล้วบันทึกใหม่', 'error');
      } else {
        toast('เกิดข้อผิดพลาด: ' + error.message, 'error');
      }
      return;
    }
    const item = db.items.find(i => i.id == editId);
    Object.assign(item, { ...data, purchaseUnit, dispenseUnit, conversionFactor: convFactor, isBillable });
    if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
    logAudit(AUDIT_MODULES.INVENTORY, AUDIT_ACTIONS.UPDATE, editId, { name: data.name, barcode: data.barcode });
    toast('แก้ไขรายการเรียบร้อย', 'success');
  } else {
    let insertData = { ...data };
    let { data: inserted, error } = await supa.from('items').insert(insertData).select().single();
    // ถ้าเกิด unique conflict (23505) ให้ generate รหัสใหม่แล้ว retry 1 ครั้ง
    if (error && (error.code === '23505' || (error.message && error.message.includes('duplicate')))) {
      const newCode = generateBarcode(insertData.category || '');
      insertData = { ...insertData, barcode: newCode };
      const retry = await supa.from('items').insert(insertData).select().single();
      inserted = retry.data;
      error = retry.error;
      if (error) { toast('รหัสบาร์โค้ดซ้ำ กรุณาตรวจสอบแล้วบันทึกใหม่', 'error'); return; }
      toast('รหัสบาร์โค้ดซ้ำ ระบบสร้างรหัสใหม่ให้อัตโนมัติ (' + newCode + ')', 'warning');
    } else if (error) {
      toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return;
    }
    if (!inserted) { toast('บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error'); return; }
    db.items.push(mapItem({ ...inserted }));
    if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
    logAudit(AUDIT_MODULES.INVENTORY, AUDIT_ACTIONS.CREATE, inserted.id, { name: insertData.name, barcode: insertData.barcode });
    toast('เพิ่มรายการเรียบร้อย', 'success');
  }
  closeModal('modal-addItem');
  renderPage(currentPage);
}

async function deleteItem(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  const deleted = db.items.find(i => i.id === id);
  const { error } = await supa.from('items').delete().eq('id', id);
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
  logAudit(AUDIT_MODULES.INVENTORY, AUDIT_ACTIONS.DELETE, id, { item_name: deleted?.name, barcode: deleted?.barcode });
  db.items = db.items.filter(i => i.id !== id);
  if (typeof buildBarcodeMap === "function") buildBarcodeMap();
  toast('ลบรายการเรียบร้อย');
  renderPage(currentPage);
}

// ===== RECEIVE =====
function openReceiveForItem(itemId) {
  openReceiveModal();
  setTimeout(function() {
    var item = (db.items||[]).find(function(i){return i.id==itemId;});
    if (!item) return;
    document.getElementById('ta-ri-inp').value = item.name||'';
    document.getElementById('ta-ri-id').value = item.id;
    if (typeof onRecvItemChange==='function') onRecvItemChange();
  }, 200);
}

function openReceiveModal() {
  makeTypeahead({inputId:'ta-ri-inp',listId:'ta-ri-list',hiddenId:'ta-ri-id',dataFn:()=>(db.items||[]).sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(x=>({id:x.id,label:x.name||String(x.id),sub:x.qty>0?'คงเหลือ '+x.qty+' '+(x.dispenseUnit||''):'ยังไม่มีสต็อก'})),onSelect:()=>{if(typeof onRecvItemChange==='function')onRecvItemChange();}});
  document.getElementById('recv-qty').value = '';
  document.getElementById('recv-cost').value = '';
  document.getElementById('recv-note').value = '';
  document.getElementById('recv-lot').value = '';
  document.getElementById('recv-mfg-date').value = '';
  document.getElementById('recv-expiry').value = '';
  document.getElementById('recv-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('recv-po').value = '';
  document.getElementById('recv-supplier').value = '';
  document.getElementById('recv-sup-hidden').value = '';
  makeTypeahead({inputId:'recv-supplier',listId:'recv-sup-list',hiddenId:'recv-sup-hidden',
    dataFn:()=>(db.suppliers||[]).filter(s=>s.status!=='inactive').sort((a,b)=>(a.supplierName||'').localeCompare(b.supplierName||'')).map(s=>({id:s.id,label:s.supplierName||'',sub:(s.contactName||'')+' '+(s.phone||'')})),
    allowFreeText:true});
  // populate PR link dropdown
  const prSel = document.getElementById('recv-pr-link');
  if (prSel) {
    prSel.innerHTML = '<option value="">-- ไม่อ้างอิง --</option>' +
      (db.purchaseRequests||[]).filter(r=>['approved','ordered'].includes(r.status))
        .map(r=>`<option value="${r.id}">${r.refNo}${r.supplierName ? ' ('+r.supplierName+')' : ''}</option>`).join('');
  }
  onRecvItemChange();
  openModal('modal-receive');
}

function toggleNewItemForm() {
  const form = document.getElementById('new-item-inline-form');
  const btn  = document.getElementById('btn-toggle-new-item');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : '';
  btn.textContent = isOpen ? '️ สินค้าใหม่ (ยังไม่มีในระบบ)' : '❌ ยกเลิกอ่านสินค้าใหม่';
  if (!isOpen) {
    document.getElementById('new-item-name').value = '';
    setTimeout(() => document.getElementById('new-item-name').focus(), 100);
  }
}

async function saveNewItemInline() {
  const name = document.getElementById('new-item-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อสินค้า', 'warning'); return; }
  const category = document.getElementById('new-item-cat').value;
  const unit     = document.getElementById('new-item-unit').value;
  const reorder  = parseInt(document.getElementById('new-item-reorder').value) || 10;
  const barcode  = generateBarcode(category);
  const data = {
    name, category, unit,
    purchase_unit: unit, dispense_unit: unit, conversion_factor: 1,
    qty: 0, reorder, cost: 0, price: 0, is_billable: true, barcode,
  };
  const { data: inserted, error } = await supa.from('items').insert(data).select().single();
  if (error) { toast('เพิ่มสินค้าไม่สำเร็จ: ' + error.message, 'error'); return; }
  const newItem = mapItem({ ...data, id: inserted.id });
  db.items.push(newItem);
  if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
  // refresh dropdown และเลือกสินค้าใหม่
  const sel = document.getElementById('recv-item');
  const opt = document.createElement('option');
  opt.value = inserted.id;
  opt.textContent = name + ' (คงเหลือ: 0 ' + unit + ')';
  sel.appendChild(opt);
  sel.value = inserted.id;
  onRecvItemChange();
  toggleNewItemForm();
  logAudit(AUDIT_MODULES.INVENTORY, AUDIT_ACTIONS.CREATE, inserted.id, { name });
  toast('✅ สร้างสินค้า "' + name + '" เรียบร้อย เลือกไว้ใน dropdown แล้ว', 'success');
}


async function receiveItem() {
  const itemId  = document.getElementById('ta-ri-id').value;
  const qty     = parseFloat(document.getElementById('recv-qty').value);
  const cost    = parseFloat(document.getElementById('recv-cost').value) || 0;
  const lotNum  = document.getElementById('recv-lot').value.trim();
  const mfgDate = document.getElementById('recv-mfg-date').value || null;
  const expiry  = document.getElementById('recv-expiry').value || null;
  const recvDate= document.getElementById('recv-date').value || new Date().toISOString().slice(0,10);
  const po      = document.getElementById('recv-po').value.trim();
  const supplier= document.getElementById('recv-supplier').value.trim();
  const note    = document.getElementById('recv-note').value.trim();
  const prId    = document.getElementById('recv-pr-link')?.value || null;

  // Validation
  if (!itemId)  { toast('กรุณาเลือกสินค้า', 'warning'); return; }
  if (!qty || qty < 1) { toast('กรุณาระบุจำนวนที่รับเข้า (ต้องมากกว่า 0)', 'warning'); return; }
  if (!Number.isFinite(qty)) { toast('จำนวนไม่ถูกต้อง', 'warning'); return; }

  const item = db.items.find(i => i.id == itemId);
  if (!item) { toast('ไม่พบสินค้านี้ในระบบ', 'error'); return; }

  const factor      = item.conversionFactor || 1;
  const qtyDispense = qty * factor;

  showLoadingOverlay(true);
  try {
    // ใช้ RPC atomic (single transaction)
    const { data: rpcResult, error: rpcErr } = await supa.rpc('receive_stock_v2', {
      p_item_id:      item.id,
      p_qty_purchase: qty,
      p_qty_dispense: qtyDispense,
      p_cost:         cost,
      p_lot_number:   lotNum   || null,
      p_mfg_date:     mfgDate  || null,
      p_expiry_date:  expiry   || null,
      p_recv_date:    recvDate,
      p_po:           po       || null,
      p_supplier:     supplier || null,
      p_pr_id:        prId     || null,
      p_note:         note     || null,
      p_created_by:   currentUser?.username || '',
    });

    if (rpcErr || !rpcResult?.ok) {
      const errMsg = rpcErr?.message || rpcResult?.error || 'unknown error';
      // ตรวจว่า RPC ยังไม่ได้รันใน Supabase (function does not exist)
      const rpcMissing = errMsg.includes('does not exist') || errMsg.includes('Could not find');
      if (rpcMissing) {
        // RPC ยังไม่ได้รัน — แจ้ง admin และใช้ fallback พร้อม warning
        console.warn('[receiveItem] RPC receive_stock_v2 ไม่พบ — ใช้ fallback (รัน receive_stock_v2 ใน Supabase)');
        toast('⚠️ กำลังใช้ fallback mode — กรุณารัน receive_stock_atomic_rpc.sql ใน Supabase', 'warning');
        await _receiveItemFallback(item, qty, qtyDispense, cost, lotNum, mfgDate, expiry, recvDate, po, supplier, note);
      } else {
        // RPC มีแต่เกิด error จริง — หยุดทันที ไม่ fallback
        toast('❌ รับสินค้าไม่สำเร็จ: ' + errMsg, 'error');
        console.error('[receiveItem] RPC error:', errMsg);
      }
      return;
    }

    // อัปเดต local cache
    const newQty = rpcResult.new_qty;
    item.qty = newQty;
    if (typeof buildBarcodeMap === 'function') buildBarcodeMap();

    // reload lots จาก Supabase
    const { data: lotsData } = await supa.from('item_lots').select('*').eq('item_id', item.id);
    if (lotsData) {
      db.itemLots = db.itemLots.filter(l => l.itemId != item.id);
      lotsData.forEach(l => db.itemLots.push(mapLot(l)));
    }

    const dispUnit = item.dispenseUnit || item.unit;
    toast(`✅ รับเข้าคลัง ${item.name} ${qty} ${item.purchaseUnit||item.unit} = ${qtyDispense} ${dispUnit}`, 'success');
    closeModal('modal-receive');
    renderPage(currentPage);
  } finally {
    showLoadingOverlay(false);
  }
}

async function _receiveItemFallback(item, qty, qtyDispense, cost, lotNum, mfgDate, expiry, recvDate, po, supplier, note) {
  // Fallback แบบ multi-step (ใช้ถ้า RPC ยังไม่ได้รัน)
  const newQty = item.qty + qtyDispense;

  const { error: errItem } = await supa.from('items').update({ qty: newQty }).eq('id', item.id);
  if (errItem) { toast('เกิดข้อผิดพลาด: ' + errItem.message, 'error'); return; }

  const lotData = {
    item_id: item.id,
    lot_number: lotNum || `LOT-${recvDate}-${item.id}`,
    manufacturing_date: mfgDate, expiry_date: expiry,
    qty_in_lot: qtyDispense, qty_remaining: qtyDispense,
    received_date: recvDate, notes: note,
  };
  const { data: lotInserted, error: errLot } = await supa.from('item_lots').insert(lotData).select().single();
  if (errLot) { toast('⚠️ บันทึก lot ไม่สำเร็จ (fallback): ' + errLot.message, 'warning'); }
  else if (lotInserted) db.itemLots.push(mapLot(lotInserted));

  const purchaseData = {
    item_id: item.id, item_name: item.name,
    unit: item.purchaseUnit || item.unit,
    qty, cost, date: recvDate, po, supplier, note,
    by_user: currentUser?.username || '',
  };
  const { data: pInserted, error: errP } = await supa.from('purchases').insert(purchaseData).select().single();
  if (errP) { toast('⚠️ บันทึก purchase ไม่สำเร็จ (fallback): ' + errP.message, 'warning'); }
  else if (pInserted) db.purchases.unshift(mapPurchase(pInserted));

  const movData = {
    item_id: item.id, barcode: item.barcode || null,
    movement_type: 'receive', quantity: qtyDispense,
    before_qty: item.qty, after_qty: newQty,
    lot_no: lotNum || null, expiry_date: expiry || null, cost,
    note: [supplier ? 'ผู้จำหน่าย: '+supplier : '', po ? 'PO: '+po : '', note].filter(Boolean).join(' | ') || null,
    ref_id: (!errP && pInserted) ? pInserted.id : null,
    ref_type: 'purchase', created_by: currentUser?.username || '',
  };
  const { data: movInserted, error: _movErr1 } = await supa.from('stock_movements').insert(movData).select().single();
  if (_movErr1) { toast('⚠️ บันทึก stock movement ไม่สำเร็จ (fallback): ' + _movErr1.message, 'warning'); }
  else if (movInserted) db.stockMovements.unshift(mapStockMovement(movInserted));

  item.qty = newQty;
  if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
  logAudit(AUDIT_MODULES.INVENTORY, AUDIT_ACTIONS.RECEIVE, item.id, {
    item_name: item.name, qty_dispense: qtyDispense,
    before_qty: newQty - qtyDispense, after_qty: newQty,
    supplier, po, lot: lotNum, fallback: true,
  });
  const dispUnit = item.dispenseUnit || item.unit;
  toast(`✅ รับเข้าคลัง ${item.name} ${qty} ${item.purchaseUnit||item.unit} = ${qtyDispense} ${dispUnit}`, 'success');
  closeModal('modal-receive');
  renderPage(currentPage);
}

// ===== PURCHASE / RECEIVE HELPERS =====
function onRecvItemChange() {
const recvItemEl = document.getElementById('recv-item'); if (!recvItemEl) return; const id = recvItemEl.value;
  const item = db.items.find(i => i.id == id);
  if (!item) return;
  if (item.cost) document.getElementById('recv-cost').value = item.cost;
  // แสดงข้อมูล unit conversion
  const infoBox  = document.getElementById('recv-unit-info');
  const infoText = document.getElementById('recv-unit-text');
  const unitLabel= document.getElementById('recv-unit-label');
  const pUnit = item.purchaseUnit || item.unit;
  const dUnit = item.dispenseUnit || item.unit;
  const factor = item.conversionFactor || 1;
  if (factor > 1 || pUnit !== dUnit) {
    infoBox.style.display = 'block';
    infoText.textContent = `ซื้อเป็น "${pUnit}" | เบิกเป็น "${dUnit}" | 1 ${pUnit} = ${factor} ${dUnit}`;
    unitLabel.textContent = `(${pUnit})`;
  } else {
    infoBox.style.display = 'none';
    unitLabel.textContent = `(${pUnit})`;
  }
}

async function renderPurchaseHistory() {
  if (!db.purchases) db.purchases = [];
  const monthVal   = document.getElementById('ph-month')?.value || '';
  const itemFilter = document.getElementById('ph-item-filter')?.value || '';

  // Populate item filter from db.items (not db.purchases)
  const itemSel = document.getElementById('ph-item-filter');
  if (itemSel) {
    const cur = itemSel.value;
    const names = db.items.map(i=>i.name).sort();
    itemSel.innerHTML = '<option value="">ทุกรายการ</option>' +
      names.map(n => `<option value="${n}" ${cur===n?'selected':''}>${n}</option>`).join('');
    if (cur) itemSel.value = cur;
  }

  const tb = document.getElementById('ph-table');
  if(tb) tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3);">⏳ กำลังโหลด...</td></tr>';

  // Query Supabase directly
  let q = supa.from('purchases').select('*').order('date',{ascending:false}).limit(500);
  if (monthVal) {
    const [y,m] = monthVal.split('-');
    q = q.gte('date',`${y}-${m}-01`).lte('date', new Date(parseInt(y),parseInt(m),0).toISOString().split('T')[0]);
  } else {
    q = q.gte('date', new Date(Date.now()-90*86400000).toISOString().split('T')[0]);
  }
  if (itemFilter) q = q.eq('item_name', itemFilter);

  const {data} = await q;
  let rows = (data||[]).map(mapPurchase);

  const totalQty  = rows.reduce((s,r) => s + (r.qty||0), 0);
  const totalCost = rows.reduce((s,r) => s + ((r.qty||0)*(r.cost||0)), 0);
  const [y,m] = monthVal ? monthVal.split('-') : [null,null];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthLabel = y ? `${MONTHS[parseInt(m)-1]} ${parseInt(y)+543}` : '90 วันล่าสุด';

  const summaryEl = document.getElementById('ph-summary');
  if (summaryEl) summaryEl.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
    <div style="background:var(--sage-light);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📅 ${monthLabel}</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📦 <strong>${rows.length}</strong> รายการ</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">📊 รวม <strong>${totalQty.toLocaleString()}</strong> หน่วย</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;">💰 ต้นทุนรวม <strong>${totalCost.toLocaleString('th-TH',{minimumFractionDigits:2})} ฿</strong></div>
  </div>`;

  if (!tb) return;
  if (rows.length === 0) { tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">ยังไม่มีประวัติการสั่งซื้อ</td></tr>'; return; }
  tb.innerHTML = rows.map(r => `<tr>
    <td class="number" style="white-space:nowrap;font-size:12px;">${thDateShort(r.date)}</td>
    <td style="font-weight:600;">${r.itemName}</td>
    <td class="number">${r.qty}</td>
    <td style="font-size:12px;color:var(--text2);">${r.unit||''}</td>
    <td class="number" style="font-size:12px;">${r.cost > 0 ? r.cost.toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
    <td class="number" style="font-size:12px;font-weight:600;">${r.cost > 0 ? ((r.qty||0)*(r.cost||0)).toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
    <td style="font-size:12px;color:var(--text2);">${r.po||'-'}</td>
    <td style="font-size:12px;color:var(--text2);">${r.supplier||'-'}</td>
    <td style="font-size:12px;color:var(--text2);">${r.by||'-'}</td>
    <td style="font-size:12px;color:var(--text2);">${r.note||'-'}</td>
  </tr>`).join('');
}

function exportInventoryExcel() {
  const rows = [
    ['#', 'ชื่อสินค้า', 'ประเภท', 'หน่วย', 'คงเหลือ', 'จุดสั่งซื้อ', 'ราคาทุน', 'ราคาขาย', 'สถานะ']
  ];
  db.items.forEach((item, i) => {
    const status = item.qty <= 0 ? 'หมด' : item.qty <= item.reorder ? 'ใกล้หมด' : 'ปกติ';
    rows.push([
      i+1, item.name || '', item.category || '', item.unit || '',
      item.qty || 0, item.reorder || 0,
      item.cost || 0, item.price || 0, status
    ]);
  });
  _xlsxDownload(rows, 'คลังสินค้า', 'navasri_inventory_' + new Date().toISOString().slice(0,10));
}

function exportItemLotsExcel() {
  const rows = [
    ['#', 'สินค้า', 'หน่วย', 'รับมาทั้งหมด', 'คงเหลือ', 'วันหมดอายุ', 'สถานะ']
  ];
  db.itemLots.forEach((lot, i) => {
    const item = db.items.find(x => x.id == lot.itemId);
    const today = new Date(); today.setHours(0,0,0,0);
    const exp   = lot.expiryDate ? new Date(lot.expiryDate) : null;
    const diff  = exp ? Math.ceil((exp - today) / 86400000) : null;
    const status = !exp ? 'ไม่ระบุ' : diff < 0 ? 'หมดอายุแล้ว' : diff <= 30 ? `ใกล้หมด (${diff} วัน)` : 'ปกติ';
    rows.push([
      i+1, item?.name || '', item?.unit || '',
      lot.qtyInLot || 0, lot.qtyRemaining || 0,
      lot.expiryDate || '', status
    ]);
  });
  _xlsxDownload(rows, 'Lot สินค้า', 'navasri_item_lots_' + new Date().toISOString().slice(0,10));
}

// ===== BARCODE SCAN FOR RECEIVE MODAL =====
function onRecvBarcodeScan() {
  const el = document.getElementById('recv-barcode-scan');
  if (!el) return;
  const code = el.value.trim();
  if (!code) return;
  // รอ Enter หรือ debounce 300ms (บาร์โค้ดส่ง suffix Enter)
  clearTimeout(el._scanTimer);
  el._scanTimer = setTimeout(() => {
    const item = lookupItemByBarcode(code);
    if (item) {
      const sel = document.getElementById('recv-item');
      if (sel) {
        sel.value = item.id;
        onRecvItemChange();
        toast(`พบสินค้า: ${item.name}`, 'success');
      }
      el.value = '';
    } else if (code.length >= 4) {
      toast(`ไม่พบสินค้า: ${code}`, 'warning');
      el.value = '';
    }
  }, 300);
}

// ===== STOCK MOVEMENT HISTORY =====
async function renderMovementHistory() {
  const tb = document.getElementById('mv-table');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">กำลังโหลด...</td></tr>';

  const monthVal = document.getElementById('mv-month')?.value || '';
  const typeVal  = document.getElementById('mv-type-filter')?.value || '';

  let q = supa.from('stock_movements')
    .select('*, items(name,barcode)')
    .order('created_at', {ascending: false})
    .limit(200);

  if (monthVal) {
    const [y, m] = monthVal.split('-');
    q = q.gte('created_at', `${y}-${m}-01`).lte('created_at', `${y}-${m}-31`);
  }
  if (typeVal) q = q.eq('movement_type', typeVal);

  const { data, error } = await q;
  if (error) { tb.innerHTML = '<tr><td colspan="7" style="color:red;padding:16px;">โหลดข้อมูลไม่สำเร็จ</td></tr>'; return; }

  const typeLabel = { receive:'รับเข้า', issue:'เบิกจ่าย', adjust:'ปรับ', return:'คืน' };
  const typeBadge = { receive:'badge-green', issue:'badge-orange', adjust:'badge-blue', return:'badge-gray' };

  if (!data || data.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">ไม่มีข้อมูล</td></tr>';
    return;
  }

  tb.innerHTML = data.map(r => {
    const name = r.items?.name || '-';
    const bc   = r.items?.barcode || r.barcode || '-';
    const qty  = r.movement_type === 'issue' ? '-'+r.quantity : '+'+r.quantity;
    const qtyColor = r.movement_type === 'issue' ? 'color:var(--red)' : 'color:var(--green)';
    const badge = '<span class="badge ' + (typeBadge[r.movement_type]||'badge-gray') + '">' + (typeLabel[r.movement_type]||r.movement_type) + '</span>';
    const date = r.created_at ? r.created_at.slice(0,16).replace('T',' ') : '-';
    return '<tr>' +
      '<td style="font-size:12px;color:var(--text2);">' + date + '</td>' +
      '<td style="font-weight:600;">' + name + '<br><span style="font-family:monospace;font-size:10px;color:var(--text3);">' + bc + '</span></td>' +
      '<td>' + badge + '</td>' +
      '<td style="text-align:right;font-weight:600;' + qtyColor + '">' + qty + '</td>' +
      '<td style="text-align:right;font-size:12px;color:var(--text2);">' + (r.before_qty||0) + ' → ' + (r.after_qty||0) + '</td>' +
      '<td style="font-size:12px;color:var(--text2);">' + (r.lot_no||'-') + '</td>' +
      '<td style="font-size:11px;color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (r.note||'') + '</td>' +
      '</tr>';
  }).join('');
}

// ===== PURCHASE HISTORY TABS =====
function switchPhTab(tab) {
  const tabs = ['purchase', 'movement'];
  tabs.forEach(t => {
    const el = document.getElementById('ph-section-' + t);
    const btn = document.getElementById('ph-tab-' + t);
    if (!el || !btn) return;
    if (t === tab) {
      el.style.display = '';
      btn.style.borderBottom = '2px solid var(--accent)';
      btn.style.marginBottom = '-2px';
      btn.style.color = 'var(--accent)';
      btn.style.fontWeight = '600';
    } else {
      el.style.display = 'none';
      btn.style.borderBottom = 'none';
      btn.style.marginBottom = '0';
      btn.style.color = 'var(--text2)';
      btn.style.fontWeight = '400';
    }
  });
  if (tab === 'movement') renderMovementHistory();
}

// ===== QUICK DISPENSE =====
function openQuickDispenseModal() {
  // populate patients
  makeTypeahead({inputId:'ta-qd-inp',listId:'ta-qd-list',hiddenId:'ta-qd-id',dataFn:()=>taPatients(true)});
  // populate staff
  makeTypeahead({inputId:'ta-qds-inp',listId:'ta-qds-list',hiddenId:'ta-qds-id',dataFn:()=>taStaff()});
  (function(){var me=(db.staff||[]).find(s=>s.name===currentUser?.displayName);if(me){var _h=document.getElementById('ta-qds-id');var _i=document.getElementById('ta-qds-inp');if(_h)_h.value=me.id;if(_i)_i.value=me.name;}})();
  // reset
  const fields = ['qd-barcode','qd-note'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('qd-qty').value = 1;
  document.getElementById('qd-item-id').value = '';
  document.getElementById('qd-item-info').style.display = 'none';
  openModal('modal-quick-dispense');
  setTimeout(() => document.getElementById('qd-barcode')?.focus(), 200);
}

function onQdBarcodeScan() {
  const el = document.getElementById('qd-barcode');
  if (!el) return;
  clearTimeout(el._scanTimer);
  el._scanTimer = setTimeout(() => {
    const code = el.value.trim();
    if (!code) return;
    const item = lookupItemByBarcode(code);
    if (item) {
      document.getElementById('qd-item-id').value = item.id;
      document.getElementById('qd-item-name').textContent = item.name;
      document.getElementById('qd-item-qty').textContent = item.qty;
      document.getElementById('qd-item-unit').textContent = item.unit || '';
      document.getElementById('qd-item-billable').textContent = item.isBillable !== false ? '💰 เรียกเก็บได้' : '🏥 ไม่เรียกเก็บ';
      document.getElementById('qd-item-info').style.display = '';
      document.getElementById('qd-qty').focus();
    } else if (code.length >= 4) {
      toast('ไม่พบสินค้ารหัส: ' + code, 'warning');
      el.value = '';
    }
  }, 300);
}

async function saveQuickDispense() {
  const itemId  = document.getElementById('qd-item-id').value;
  const patId   = document.document.getElementById('ta-qd-id').value;
  const staffId = document.document.getElementById('ta-qds-id').value;
  const qty     = parseFloat(document.getElementById('qd-qty').value);
  const note    = document.getElementById('qd-note').value.trim();

  // Validation
  if (!itemId)  { toast('กรุณาระบุสินค้า (ยิงบาร์โค้ดหรือพิมพ์รหัส)', 'warning'); return; }
  if (!patId)   { toast('กรุณาเลือกผู้รับบริการ', 'warning'); return; }
  if (!qty || qty < 1) { toast('กรุณาระบุจำนวน (ต้องมากกว่า 0)', 'warning'); return; }

  const item    = db.items.find(i => i.id == itemId);
  const patient = db.patients.find(p => p.id == patId);
  const staff   = db.staff.find(s => s.id == staffId);
  if (!item)    { toast('ไม่พบสินค้านี้ในระบบ', 'error'); return; }
  if (!patient) { toast('ไม่พบผู้รับบริการนี้ในระบบ', 'error'); return; }
  if (item.qty < qty) {
    toast(`สต็อกไม่พอ (คงเหลือ ${item.qty} ${item.unit})`, 'warning'); return;
  }

  showLoadingOverlay(true);
  try {
    const actor = currentUser?.username || '';
    const date  = new Date().toISOString().slice(0, 10);

    // 1. บันทึกใบเบิก (requisition) แล้ว approve ทันที
    const { data: rpcResult, error: rpcErr } = await supa.rpc('create_and_approve_quick_dispense', {
      p_patient_id:   patId,
      p_patient_name: patient.name,
      p_item_id:      itemId,
      p_item_name:    item.name,
      p_qty:          qty,
      p_unit:         item.dispenseUnit || item.unit,
      p_staff_id:     staffId || null,
      p_staff_name:   staff?.name || actor,
      p_note:         note || null,
      p_created_by:   actor,
      p_date:         date,
    });

    if (rpcErr || !rpcResult?.ok) {
      // Fallback: บันทึก movement log โดยตรงถ้า RPC ไม่มี
      await _saveQuickDispenseFallback(item, patient, staff, qty, note, actor, date);
    } else {
      // อัปเดต local cache
      item.qty = rpcResult.new_qty ?? (item.qty - qty);
      if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
      toast(`✅ เบิกด่วน ${item.name} ${qty} ${item.unit} ให้ ${patient.name}`, 'success');
    }

    closeModal('modal-quick-dispense');
    renderPage(currentPage);
  } finally {
    showLoadingOverlay(false);
  }
}

async function _saveQuickDispenseFallback(item, patient, staff, qty, note, actor, date) {
  // Fallback: ใช้ Supabase ตรงถ้า RPC ยังไม่ได้สร้าง
  const beforeQty = item.qty;
  const afterQty  = item.qty - qty;

  // อัปเดต items.qty
  const { error: errItem } = await supa.from('items').update({ qty: afterQty }).eq('id', item.id);
  if (errItem) { toast('เกิดข้อผิดพลาด: ' + errItem.message, 'error'); return; }

  // บันทึก stock_movements (issue)
  const movData = {
    item_id:       item.id,
    barcode:       item.barcode || null,
    movement_type: 'issue',
    quantity:      qty,
    before_qty:    beforeQty,
    after_qty:     afterQty,
    note:          `เบิกด่วนให้ ${patient.name}` + (note ? ` | ${note}` : ''),
    ref_type:      'quick_dispense',
    created_by:    actor,
  };
  const { data: movInserted, error: _movErr2 } = await supa.from('stock_movements').insert(movData).select().single();
  if (_movErr2) console.error('[navasri] stock_movement insert fail (quick_dispense):', _movErr2.message);
  if (movInserted) db.stockMovements.unshift(mapStockMovement(movInserted));

  item.qty = afterQty;
  if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
  toast(`✅ เบิกด่วน ${item.name} ${qty} ${item.unit} ให้ ${patient.name}`, 'success');
}

// ===== CAMERA SCAN (Phase 5 — ZXing lazy load) =====
let _zxingReader = null;
let _cameraStream = null;

async function loadZXing() {
  if (window.ZXing) return true;
  return new Promise((resolve) => {
    const s = document.createElement('script');
    // โหลด local ก่อน (วางไฟล์ที่ js/lib/zxing-browser.min.js)
    // ดาวน์โหลดได้จาก: https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/umd/index.min.js
    s.src = 'js/lib/zxing-browser.min.js';
    s.onload = () => resolve(true);
    s.onerror = () => {
      // local ไม่มี → fallback CDN พร้อม warning
      console.warn('[ZXing] local file not found, falling back to CDN');
      const f = document.createElement('script');
      f.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/umd/index.min.js';
      f.onload  = () => resolve(true);
      f.onerror = () => { toast('โหลด Camera Scanner ไม่สำเร็จ — วางไฟล์ zxing-browser.min.js ใน js/lib/', 'error'); resolve(false); };
      document.head.appendChild(f);
    };
    document.head.appendChild(s);
  });
}

async function openCameraScanner(targetInputId, onFound) {
  const ok = await loadZXing();
  if (!ok) return;

  // สร้าง overlay
  let overlay = document.getElementById('camera-scan-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'camera-scan-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    overlay.innerHTML =
      '<div style="color:#fff;font-size:14px;margin-bottom:12px;">📷 วางบาร์โค้ดในกรอบ</div>' +
      '<video id="camera-scan-video" style="width:min(320px,90vw);border-radius:12px;border:3px solid #4CAF50;"></video>' +
      '<button onclick="closeCameraScanner()" style="margin-top:16px;padding:10px 28px;background:#e53935;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">✕ ปิด</button>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  try {
    const ZXingBrowser = window.ZXing;
    const codeReader = new ZXingBrowser.BrowserMultiFormatReader();
    _zxingReader = codeReader;
    const videoEl = document.getElementById('camera-scan-video');
    const devices  = await ZXingBrowser.BrowserMultiFormatReader.listVideoInputDevices();
    const deviceId = devices.length > 1 ? devices[devices.length-1].deviceId : undefined;

    await codeReader.decodeFromVideoDevice(deviceId, videoEl, (result, err) => {
      if (result) {
        const code = result.getText();
        closeCameraScanner();
        const targetEl = document.getElementById(targetInputId);
        if (targetEl) { targetEl.value = code; targetEl.dispatchEvent(new Event('input')); }
        if (typeof onFound === 'function') onFound(code);
      }
    });
  } catch(e) {
    closeCameraScanner();
    toast('ไม่สามารถเปิดกล้องได้: ' + e.message, 'error');
  }
}

function closeCameraScanner() {
  if (_zxingReader) { try { _zxingReader.reset(); } catch(e) {} _zxingReader = null; }
  const overlay = document.getElementById('camera-scan-overlay');
  if (overlay) overlay.style.display = 'none';
}
