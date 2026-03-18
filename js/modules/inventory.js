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
  // สร้าง barcode SVG จาก JsBarcode ที่โหลดแล้วใน index.html (ไม่ต้องพึ่ง CDN อีกครั้ง)
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
    if (search && !item.name.toLowerCase().includes(search)) return false;
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

    return `<tr class="${rowClass}">
      <td style="color:var(--text3);font-size:12px;" class="number">${i+1}</td>
      <td style="padding:6px 8px;">${photoEl}</td>
      <td style="font-weight:600;">${item.name}<br>${billableBadge}</td>
      <td><span style="font-family:monospace;font-size:11px;color:var(--text3);">${item.barcode||'—'}</span></td>
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
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editItem('${item.id}')" style="margin-right:4px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteItem('${item.id}')">🗑️</button>
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

// ===== ITEM MASTER =====
function renderItemMaster() {
  const search = (document.getElementById('itemSearch')?.value || '').toLowerCase();
  let items = db.items.filter(i => !search || i.name.toLowerCase().includes(search));
  const catBadges = { ยา:'badge-red', เวชภัณฑ์:'badge-orange', ของใช้:'badge-blue', บริการ:'badge-purple' };
  const tb = document.getElementById('itemMasterTable');
  tb.innerHTML = items.map((item, i) => {
    const photoEl = item.photo
      ? `<img src="${item.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;" onclick="showItemPhoto('${item.id}')" title="${item.name}">`
      : `<div style="width:40px;height:40px;border-radius:6px;border:2px dashed var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;" onclick="editItem('${item.id}')" title="เพิ่มรูปภาพ">📷</div>`;
    const qtyColor = item.qty === 0 ? 'color:#e74c3c;font-weight:700;' : item.qty <= item.reorder ? 'color:#e67e22;font-weight:600;' : '';
    return `<tr>
    <td style="color:var(--text3);" class="number">${i+1}</td>
    <td style="padding:6px 8px;">${photoEl}</td>
    <td style="font-weight:600;">${item.name}</td>
    <td><span class="badge ${catBadges[item.category]||'badge-gray'}">${item.category}</span></td>
    <td>${item.unit}</td>
    <td class="number" style="${qtyColor}">${item.qty}</td>
    <td class="number" style="font-size:12px;">${item.cost > 0 ? item.cost.toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
    <td class="number" style="font-size:12px;">${item.price > 0 ? item.price.toLocaleString('th-TH',{minimumFractionDigits:2}) : '-'}</td>
    <td class="number">${item.reorder}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="editItem('${item.id}')" style="margin-right:4px;">✏️</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteItem('${item.id}')">🗑️</button>
    </td>
  </tr>`;
  }).join('');
}

// ===== ITEM CRUD =====
function openAddItemModal() {
  document.getElementById('editItemIdx').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-cat').value = 'ยา';
  document.getElementById('item-unit').value = 'เม็ด';
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
    qty: parseInt(document.getElementById('item-qty').value) || 0,
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
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    const item = db.items.find(i => i.id == editId);
    Object.assign(item, { ...data, purchaseUnit, dispenseUnit, conversionFactor: convFactor, isBillable });
    if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
    toast('แก้ไขรายการเรียบร้อย', 'success');
  } else {
    const { data: inserted, error } = await supa.from('items').insert(data).select().single();
    if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
    db.items.push(mapItem({ ...data, id: inserted.id }));
    if (typeof buildBarcodeMap === 'function') buildBarcodeMap();
    toast('เพิ่มรายการเรียบร้อย', 'success');
  }
  closeModal('modal-addItem');
  renderPage(currentPage);
}

async function deleteItem(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  const { error } = await supa.from('items').delete().eq('id', id);
  if (error) { toast('เกิดข้อผิดพลาด: ' + error.message, 'error'); return; }
  db.items = db.items.filter(i => i.id !== id);
  if (typeof buildBarcodeMap === "function") buildBarcodeMap();
  toast('ลบรายการเรียบร้อย');
  renderPage(currentPage);
}

// ===== RECEIVE =====
function openReceiveModal() {
  const sel = document.getElementById('recv-item');
  sel.innerHTML = db.items.map(i => `<option value="${i.id}">${i.name} (คงเหลือ: ${i.qty} ${i.dispenseUnit||i.unit})</option>`).join('');
  document.getElementById('recv-qty').value = '';
  document.getElementById('recv-cost').value = '';
  document.getElementById('recv-note').value = '';
  document.getElementById('recv-lot').value = '';
  document.getElementById('recv-mfg-date').value = '';
  document.getElementById('recv-expiry').value = '';
  document.getElementById('recv-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('recv-po').value = '';
  document.getElementById('recv-supplier').value = '';
  onRecvItemChange();
  openModal('modal-receive');
}

async function receiveItem() {
  const itemId  = document.getElementById('recv-item').value;
  const qty     = parseFloat(document.getElementById('recv-qty').value);
  const cost    = parseFloat(document.getElementById('recv-cost').value) || 0;
  const lotNum  = document.getElementById('recv-lot').value.trim();
  const mfgDate = document.getElementById('recv-mfg-date').value || null;
  const expiry  = document.getElementById('recv-expiry').value || null;
  const recvDate= document.getElementById('recv-date').value || new Date().toISOString().slice(0,10);
  const po      = document.getElementById('recv-po').value.trim();
  const supplier= document.getElementById('recv-supplier').value.trim();
  const note    = document.getElementById('recv-note').value.trim();

  if (!qty || qty < 1) { toast('กรุณาระบุจำนวนที่รับเข้า', 'warning'); return; }
  const item = db.items.find(i => i.id == itemId);
  if (!item) return;

  // คำนวณ qty เป็นหน่วยเบิกจ่าย
  const factor = item.conversionFactor || 1;
  const qtyDispense = qty * factor;
  const newQty = item.qty + qtyDispense;

  // 1. อัปเดต items.qty
  const { error: errItem } = await supa.from('items').update({ qty: newQty }).eq('id', itemId);
  if (errItem) { toast('เกิดข้อผิดพลาด: ' + errItem.message, 'error'); return; }

  // 2. บันทึก lot ใน item_lots
  const lotData = {
    item_id: itemId,
    lot_number: lotNum || `LOT-${recvDate}-${itemId}`,
    manufacturing_date: mfgDate,
    expiry_date: expiry,
    qty_in_lot: qtyDispense,
    qty_remaining: qtyDispense,
    received_date: recvDate,
    notes: note,
  };
  const { data: lotInserted, error: errLot } = await supa.from('item_lots').insert(lotData).select().single();
  if (errLot) { console.warn('item_lots insert failed:', errLot.message); }
  else { db.itemLots.push(mapLot(lotInserted)); }

  // 3. บันทึก purchases
  const purchaseData = {
    item_id: itemId, item_name: item.name,
    unit: item.purchaseUnit || item.unit,
    qty, cost, date: recvDate,
    po, supplier, note, by_user: currentUser?.username || '',
  };
  const { data: pInserted, error: errP } = await supa.from('purchases').insert(purchaseData).select().single();
  if (!errP && pInserted) db.purchases.unshift(mapPurchase(pInserted));

  item.qty = newQty;
  const dispUnit = item.dispenseUnit || item.unit;
  toast(`✅ รับเข้าคลัง ${item.name} ${qty} ${item.purchaseUnit||item.unit} = ${qtyDispense} ${dispUnit}${expiry ? ' | หมดอายุ: ' + expiry : ''}`, 'success');
  closeModal('modal-receive');
  renderPage(currentPage);
}

// ===== PURCHASE / RECEIVE HELPERS =====
function onRecvItemChange() {
  const id = document.getElementById('recv-item').value;
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
    ['#', 'สินค้า', 'หน่วย', 'จำนวน', 'วันหมดอายุ', 'หมายเหตุ']
  ];
  db.itemLots.forEach((lot, i) => {
    const item = db.items.find(x => x.id == lot.itemId);
    rows.push([
      i+1, item?.name || '', item?.unit || '',
      lot.qty || 0, lot.expiryDate || '', lot.note || ''
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
