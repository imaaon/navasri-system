// ===== ASSETS MODULE =====
'use strict';

const ASSET_CAT_LABEL = {
  medical_equipment:'เครื่องมือแพทย์', furniture:'เฟอร์นิเจอร์/เตียง',
  building_system:'ระบบอาคาร', kitchen_laundry:'ครัว/ซักล้าง',
  vehicle:'ยานพาหนะ', it_telecom:'IT/สื่อสาร', other:'อื่นๆ'
};
const ASSET_STATUS_BADGE = {
  active:       '<span class="badge badge-green">ใช้งานปกติ</span>',
  under_repair: '<span class="badge badge-orange">ส่งซ่อม</span>',
  retired:      '<span class="badge badge-gray">เลิกใช้</span>',
  lost:         '<span class="badge badge-red">สูญหาย</span>',
};

function renderAssets() {
  const catF    = document.getElementById('asset-filter-category')?.value||'';
  const statusF = document.getElementById('asset-filter-status')?.value||'';
  const q       = (document.getElementById('asset-search')?.value||'').toLowerCase();
  const tb      = document.getElementById('assetTable'); if(!tb) return;
  // ซ่อนปุ่มเพิ่มครุภัณฑ์สำหรับ nurse และ caregiver
  const addBtn = document.getElementById('btn-add-asset');
  if (addBtn) addBtn.style.display = hasRole('admin','manager','officer') ? '' : 'none';

  // Alert: ถึงรอบซ่อม หรือประกันใกล้หมด
  const today = new Date(); const soon7 = new Date(today); soon7.setDate(soon7.getDate()+7);
  const soon30= new Date(today); soon30.setDate(soon30.getDate()+30);
  const alerts = (db.assets||[]).filter(a => {
    if (a.status==='retired'||a.status==='lost') return false;
    const nm = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate) : null;
    const we = a.warrantyExpiry     ? new Date(a.warrantyExpiry)       : null;
    return (nm&&nm<=soon7) || (we&&we<=soon30);
  });
  const alertCard = document.getElementById('asset-alert-card');
  const alertList = document.getElementById('asset-alert-list');
  if (alertCard && alertList) {
    if (alerts.length) {
      alertCard.style.display='';
      alertList.innerHTML = alerts.map(a=>{
        const nm = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate) : null;
        const we = a.warrantyExpiry     ? new Date(a.warrantyExpiry)       : null;
        const parts = [];
        if (nm&&nm<=soon7) parts.push('ถึงรอบซ่อม '+(a.nextMaintenanceDate));
        if (we&&we<=soon30) parts.push('ประกันหมด '+(a.warrantyExpiry));
        return `<div style="margin-bottom:4px;">🔔 <b>${a.name}</b> (${a.assetNo}) — ${parts.join(' | ')}</div>`;
      }).join('');
    } else { alertCard.style.display='none'; }
  }

  let list = (db.assets||[]).filter(a=>{
    if (catF    && a.category!==catF)    return false;
    if (statusF && a.status  !==statusF) return false;
    if (q && !((a.name||'')+(a.assetNo||'')+(a.location||'')+(a.brand||'')+(a.model||'')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(a.assetNo||'').localeCompare(b.assetNo||''));

  document.getElementById('asset-count').textContent = 'ทั้งหมด: '+list.length+' รายการ';

  if (!list.length) { tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">ไม่มีข้อมูล</td></tr>'; return; }

  const today2 = today.toISOString().slice(0,10);
  tb.innerHTML = list.map(a=>{
    const nmCls = a.nextMaintenanceDate && a.nextMaintenanceDate <= today2 ? 'color:var(--red);font-weight:700' : (a.nextMaintenanceDate&&a.nextMaintenanceDate<=soon7.toISOString().slice(0,10)?'color:#f5a453;font-weight:600':'');
    const weCls = a.warrantyExpiry && a.warrantyExpiry <= soon30.toISOString().slice(0,10) ? 'color:#f5a453' : '';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;">${a.assetNo||'-'}${a.isCritical?'<span style="color:var(--red);margin-left:4px;" title="อุปกรณ์สำคัญ">⚠️</span>':''}</td>
      <td style="font-weight:500;">${a.name}<br><span style="font-size:11px;color:var(--text3);">${a.brand||''} ${a.model||''}</span></td>
      <td><span class="badge" style="background:var(--surface2);color:var(--text2);">${ASSET_CAT_LABEL[a.category]||a.category}</span></td>
      <td style="font-size:12px;">${a.location||'-'}</td>
      <td style="font-size:12px;">${a.lastMaintenanceDate||'-'}</td>
      <td style="font-size:12px;${nmCls}">${a.nextMaintenanceDate||'-'}</td>
      <td style="font-size:12px;${weCls}">${a.warrantyExpiry||'-'}</td>
      <td>${ASSET_STATUS_BADGE[a.status]||a.status}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openMaintenanceHistoryModal('${a.id}')" title="ประวัติการซ่อม">📋</button>
        ${hasRole('admin','manager','officer') ? `
        <button class="btn btn-ghost btn-sm" onclick="openAddMaintenanceModal('${a.id}')">🛠️</button>
        <button class="btn btn-ghost btn-sm" onclick="editAsset('${a.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteAsset('${a.id}')">🗑️</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
}

// helper: แปลง category → code สำหรับเลขครุภัณฑ์
function getAssetCatCode(cat) {
  const map = {
    medical_equipment: 'MED', furniture: 'FUR', building_system: 'BLD',
    kitchen_laundry: 'KIT', vehicle: 'VHC', it_telecom: 'ITC',
    electrical: 'ELC', other: 'OTH'
  };
  return map[cat] || 'OTH';
}

// re-generate asset no เมื่อ category หรือ purchase_date เปลี่ยน
function reGenAssetNo() {
  const catEl = document.getElementById('asset-category');
  const noEl  = document.getElementById('asset-no');
  if (!catEl || !noEl) return;
  const cat  = catEl.value === 'other'
    ? (document.getElementById('asset-category-custom')?.value?.trim() || 'other')
    : catEl.value;
  const code = getAssetCatCode(cat);
  const year = new Date().getFullYear() + 543;
  noEl.value = 'กำลังสร้าง...';
  supa.rpc('get_next_doc_no', { p_module: 'asset', p_category: code, p_year: year })
    .then(({ data, error }) => { if (!error && data && noEl) noEl.value = data; });
}

function onAssetCategoryChange(sel) {
  var wrap = document.getElementById('asset-category-custom-wrap');
  if (wrap) wrap.style.display = sel.value === 'other' ? 'block' : 'none';
  reGenAssetNo();
}

function openAddAssetModal() {
  document.getElementById('editAssetId').value='';
  document.getElementById('addAssetModalTitle').textContent='🔧 เพิ่มครุภัณฑ์';
  ['asset-name','asset-brand','asset-model','asset-serial','asset-internal-code','asset-location','asset-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('asset-category').value='medical_equipment';
  const customWrap = document.getElementById('asset-category-custom-wrap');
  if (customWrap) { customWrap.style.display='none'; }
  const customInp = document.getElementById('asset-category-custom');
  if (customInp) customInp.value = '';
  document.getElementById('asset-status').value='active';
  document.getElementById('asset-purchase-date').value='';
  document.getElementById('asset-purchase-cost').value='';
  document.getElementById('asset-warranty-expiry').value='';
  document.getElementById('asset-lifespan').value='';
  document.getElementById('asset-maint-interval').value='';
  document.getElementById('asset-is-critical').checked=false;
  // auto-generate asset no
  reGenAssetNo();
  const assetNoEl2 = document.getElementById('asset-no');
  if (assetNoEl2) assetNoEl2.readOnly = false;
  openModal('modal-addAsset');
}

async function saveAsset() {
  await ensureSecondaryDB();
  const id   = document.getElementById('editAssetId').value;
  const name = document.getElementById('asset-name').value.trim();
  const loc  = document.getElementById('asset-location').value.trim();
  if (!name||!loc) { toast('กรุณากรอกชื่ออุปกรณ์และตำแหน่ง','error'); return; }

  const mi = parseInt(document.getElementById('asset-maint-interval').value)||null;
  const pd = document.getElementById('asset-purchase-date').value||null;
  const nextMaint = mi&&pd ? new Date(new Date(pd).getTime()+mi*864e5).toISOString().slice(0,10) : null;

  const payload = {
    name, location: loc,
    asset_no:              document.getElementById('asset-no')?.value?.trim()||null,
  category: (function(){ var c=document.getElementById('asset-category').value; return c==='other'?(document.getElementById('asset-category-custom').value.trim()||'other'):c; })(),
    brand:                 document.getElementById('asset-brand').value.trim()||null,
    model:                 document.getElementById('asset-model').value.trim()||null,
    serial_number:         document.getElementById('asset-serial').value.trim()||null,
    internal_code:         document.getElementById('asset-internal-code').value.trim()||null,
    status:                document.getElementById('asset-status').value,
    purchase_date:         pd,
    purchase_cost:         parseFloat(document.getElementById('asset-purchase-cost').value)||0,
    warranty_expiry:       document.getElementById('asset-warranty-expiry').value||null,
    expected_lifespan_yr:  parseFloat(document.getElementById('asset-lifespan').value)||null,
    maintenance_interval:  mi,
    next_maintenance_date: nextMaint,
    is_critical:           document.getElementById('asset-is-critical').checked,
    note:                  document.getElementById('asset-note').value.trim()||null,
    created_by:            currentUser?.displayName||'',
  };

  if (id) {
    const { data, error } = await supa.from('assets').update(payload).eq('id',id).select().single();
    if (error) { toast('แก้ไขไม่สำเร็จ: '+error.message,'error'); return; }
    const idx = (db.assets||[]).findIndex(r=>String(r.id)===String(id));
    if (idx>=0) db.assets[idx]=mapAsset(data);
  } else {
    const { data, error } = await supa.from('assets').insert(payload).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    if (!db.assets) db.assets=[];
    db.assets.unshift(mapAsset(data));
  }
  toast(id?'แก้ไขครุภัณฑ์แล้ว':'เพิ่มครุภัณฑ์แล้ว','success');
  logAudit('assets',id?'edit':'add',id||'new',{name});
  closeModal('modal-addAsset');
  renderAssets();
}

function editAsset(id) {
  const a=(db.assets||[]).find(x=>String(x.id)===String(id)); if(!a) return;
  document.getElementById('editAssetId').value=id;
  document.getElementById('addAssetModalTitle').textContent='✏️ แก้ไขครุภัณฑ์';
  document.getElementById('asset-name').value=a.name||'';
  (function(){ var known=["medical_equipment","furniture","building_system","kitchen_laundry","vehicle","it_telecom","electrical","other"]; var cat=a.category||'other'; if(known.includes(cat)){ document.getElementById('asset-category').value=cat; var w=document.getElementById('asset-category-custom-wrap'); if(w)w.style.display='none'; } else { document.getElementById('asset-category').value='other'; var w2=document.getElementById('asset-category-custom-wrap'); if(w2)w2.style.display='block'; var ci=document.getElementById('asset-category-custom'); if(ci)ci.value=cat; } })();
  document.getElementById('asset-brand').value=a.brand||'';
  document.getElementById('asset-model').value=a.model||'';
  document.getElementById('asset-serial').value=a.serialNumber||'';
  document.getElementById('asset-internal-code').value=a.internalCode||'';
  document.getElementById('asset-location').value=a.location||'';
  document.getElementById('asset-status').value=a.status||'active';
  document.getElementById('asset-purchase-date').value=a.purchaseDate||'';
  document.getElementById('asset-purchase-cost').value=a.purchaseCost||'';
  document.getElementById('asset-warranty-expiry').value=a.warrantyExpiry||'';
  document.getElementById('asset-lifespan').value=a.expectedLifespanYr||'';
  document.getElementById('asset-maint-interval').value=a.maintenanceInterval||'';
  document.getElementById('asset-is-critical').checked=a.isCritical||false;
  document.getElementById('asset-note').value=a.note||'';
  const assetNoEdit = document.getElementById('asset-no'); if(assetNoEdit){ assetNoEdit.value=a.assetNo||''; assetNoEdit.readOnly=false; }
  openModal('modal-addAsset');
}

async function deleteAsset(id) {
  await ensureSecondaryDB();
  const a=(db.assets||[]).find(x=>String(x.id)===String(id)); if(!a) return;
  if(!confirm('ลบครุภัณฑ์ "'+a.name+'" และประวัติซ่อมทั้งหมด?')) return;
  const {error}=await supa.from('assets').delete().eq('id',id);
  if(error){toast('ลบไม่สำเร็จ: '+error.message,'error');return;}
  db.assets=(db.assets||[]).filter(x=>String(x.id)!==String(id));
  db.assetMaintenanceLogs=(db.assetMaintenanceLogs||[]).filter(x=>String(x.assetId)!==String(id));
  toast('ลบแล้ว','success'); renderAssets();
}

function openAddMaintenanceModal(assetId) {
  const a=(db.assets||[]).find(x=>String(x.id)===String(assetId)); if(!a) return;
  document.getElementById('maintAssetId').value=assetId;
  document.getElementById('maint-asset-name-badge').textContent='🔧 '+a.name+' ('+a.assetNo+')';
  document.getElementById('maint-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('maint-type').value='preventive';
  ['maint-desc','maint-parts','maint-tech-name','maint-tech-phone','maint-tech-addr','maint-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('maint-cost').value='';
  document.getElementById('maint-duration').value='';
  document.getElementById('maint-downtime').value='';
  document.getElementById('maint-next-date').value='';
  if(a.maintenanceInterval){
    const nd=new Date(); nd.setDate(nd.getDate()+a.maintenanceInterval);
    document.getElementById('maint-next-date').value=nd.toISOString().slice(0,10);
  }
  document.getElementById('maint-resolved').checked=true;
  document.getElementById('maint-followup').checked=false;
  openModal('modal-addMaintenance');
}

async function saveMaintenance() {
  await ensureSecondaryDB();
  const assetId = document.getElementById('maintAssetId').value;
  const date    = document.getElementById('maint-date').value;
  const desc    = document.getElementById('maint-desc').value.trim();
  if (!assetId||!date||!desc) { toast('กรุณากรอกวันที่และรายละเอียด','error'); return; }

  const payload = {
    asset_id:             parseInt(assetId),
    maintenance_date:     date,
    maintenance_type:     document.getElementById('maint-type').value,
    description:          desc,
    parts_replaced:       document.getElementById('maint-parts').value.trim()||null,
    cost:                 parseFloat(document.getElementById('maint-cost').value)||0,
    technician_name:      document.getElementById('maint-tech-name').value.trim()||null,
    technician_phone:     document.getElementById('maint-tech-phone').value.trim()||null,
    technician_address:   document.getElementById('maint-tech-addr').value.trim()||null,
    next_maintenance_date:document.getElementById('maint-next-date').value||null,
    duration_hours:       parseFloat(document.getElementById('maint-duration').value)||null,
    downtime_hours:       parseFloat(document.getElementById('maint-downtime').value)||null,
    is_resolved:          document.getElementById('maint-resolved').checked,
    follow_up_required:   document.getElementById('maint-followup').checked,
    note:                 document.getElementById('maint-note').value.trim()||null,
    created_by:           currentUser?.displayName||'',
  };

  const {data,error}=await supa.from('asset_maintenance_logs').insert(payload).select().single();
  if (error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
  if(!db.assetMaintenanceLogs) db.assetMaintenanceLogs=[];
  db.assetMaintenanceLogs.unshift(data);

  // อัปเดต local db.assets
  const a=(db.assets||[]).find(x=>String(x.id)===String(assetId));
  if(a){
    a.lastMaintenanceDate=date;
    if(payload.next_maintenance_date) a.nextMaintenanceDate=payload.next_maintenance_date;
    if(payload.is_resolved) a.status='active'; else a.status='under_repair';
  }
  toast('บันทึกการซ่อมแล้ว','success');
  logAudit('assets','maintenance',assetId,{date,desc:desc.slice(0,50)});
  closeModal('modal-addMaintenance');
  renderAssets();
}

function mapAsset(r) {
  return {
    id:r.id, assetNo:r.asset_no, name:r.name, category:r.category,
    brand:r.brand, model:r.model, serialNumber:r.serial_number,
    internalCode:r.internal_code, location:r.location,
    purchaseDate:r.purchase_date, purchaseCost:r.purchase_cost,
    supplierId:r.supplier_id, warrantyExpiry:r.warranty_expiry,
    expectedLifespanYr:r.expected_lifespan_yr, depreciationRate:r.depreciation_rate,
    maintenanceInterval:r.maintenance_interval,
    lastMaintenanceDate:r.last_maintenance_date,
    nextMaintenanceDate:r.next_maintenance_date,
    status:r.status, isCritical:r.is_critical,
    note:r.note, createdAt:r.created_at,
  };
}

// ===== MAINTENANCE HISTORY MODAL =====
function openMaintenanceHistoryModal(assetId) {
  const a = (db.assets||[]).find(x => String(x.id) === String(assetId));
  if (!a) return;
  const logs = (db.assetMaintenanceLogs||[]).filter(x => String(x.asset_id) === String(assetId));
  const canDelete = hasRole('admin','manager','officer');
  const TYPE_LABEL = { preventive:'ซ่อมบำรุงตามแผน', corrective:'ซ่อมฉุกเฉิน', inspection:'ตรวจสอบ', cleaning:'ทำความสะอาด', other:'อื่นๆ' };
  const TYPE_COLOR = { preventive:'success', corrective:'warning', inspection:'info', cleaning:'info', other:'secondary' };
  const rows = logs.length === 0
    ? '<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px;">ยังไม่มีประวัติการซ่อมบำรุง</div>'
    : logs.map(function(l) {
        const typeLabel = TYPE_LABEL[l.maintenance_type] || l.maintenance_type || '-';
        const typeColor = TYPE_COLOR[l.maintenance_type] || 'secondary';
        const cost = l.cost ? Number(l.cost).toLocaleString('th-TH') + ' บาท' : '-';
        const tech = l.technician_name || 'ช่างภายใน';
        const delBtn = canDelete ? '<button class="btn btn-ghost btn-sm" style="color:var(--danger);flex-shrink:0;" onclick="deleteMaintenanceLog('+l.id+','+assetId+')" title="ลบ">🗑️</button>' : '';
        return '<div style="padding:12px 0;border-bottom:0.5px solid var(--border-color);">' +
          '<div style="display:flex;align-items:flex-start;gap:8px;">' +
            '<div style="flex:1;">' +
              '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">' +
                '<span class="badge badge-'+typeColor+'" style="font-size:11px;">'+typeLabel+'</span>' +
                '<span style="font-size:12px;color:var(--text2);">'+(l.maintenance_date||'-')+'</span>' +
              '</div>' +
              '<div style="font-size:13px;font-weight:500;margin-bottom:2px;">'+(l.description||'-')+'</div>' +
              '<div style="font-size:12px;color:var(--text2);">ช่าง: '+tech+' &nbsp;&middot;&nbsp; ค่าใช้จ่าย: '+cost+'</div>' +
              (l.created_by ? '<div style="font-size:11px;color:var(--text3);margin-top:2px;">บันทึกโดย: '+l.created_by+'</div>' : '') +
            '</div>' + delBtn +
          '</div>' +
        '</div>';
      }).join('');
  document.getElementById('maint-history-asset-name').textContent = a.name + ' (' + (a.assetNo||a.asset_no||'-') + ')';
  document.getElementById('maint-history-body').innerHTML = rows;
  document.getElementById('maint-history-asset-id').value = assetId;
  openModal('modal-maintenance-history');
}

async function deleteMaintenanceLog(logId, assetId) {
  await ensureSecondaryDB();
  if (!hasRole('admin','manager','officer')) { toast('ไม่มีสิทธิ์ลบ','error'); return; }
  if (!confirm('ลบประวัติการซ่อมรายการนี้?')) return;
  const { error } = await supa.from('asset_maintenance_logs').delete().eq('id', logId);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.assetMaintenanceLogs = (db.assetMaintenanceLogs||[]).filter(x => x.id !== logId);
  toast('ลบแล้ว','success');
  openMaintenanceHistoryModal(assetId);
}
