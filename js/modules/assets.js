// ===== ASSETS MODULE =====
'use strict';

const ASSET_CAT_LABEL = {
  medical_equipment:'à¹à¸à¸£à¸·à¹à¸­à¸à¸¡à¸·à¸­à¹à¸à¸à¸¢à¹', furniture:'à¹à¸à¸­à¸£à¹à¸à¸´à¹à¸à¸­à¸£à¹/à¹à¸à¸µà¸¢à¸',
  building_system:'à¸£à¸°à¸à¸à¸­à¸²à¸à¸²à¸£', kitchen_laundry:'à¸à¸£à¸±à¸§/à¸à¸±à¸à¸¥à¹à¸²à¸',
  vehicle:'à¸¢à¸²à¸à¸à¸²à¸«à¸à¸°', it_telecom:'IT/à¸ªà¸·à¹à¸­à¸ªà¸²à¸£', other:'à¸­à¸·à¹à¸à¹'
};
const ASSET_STATUS_BADGE = {
  active:       '<span class="badge badge-green">à¹à¸à¹à¸à¸²à¸à¸à¸à¸à¸´</span>',
  under_repair: '<span class="badge badge-orange">à¸ªà¹à¸à¸à¹à¸­à¸¡</span>',
  retired:      '<span class="badge badge-gray">à¹à¸¥à¸´à¸à¹à¸à¹</span>',
  lost:         '<span class="badge badge-red">à¸ªà¸¹à¸à¸«à¸²à¸¢</span>',
};

function renderAssets() {
  const catF    = document.getElementById('asset-filter-category')?.value||'';
  const statusF = document.getElementById('asset-filter-status')?.value||'';
  const q       = (document.getElementById('asset-search')?.value||'').toLowerCase();
  const tb      = document.getElementById('assetTable'); if(!tb) return;

  // Alert: à¸à¸¶à¸à¸£à¸­à¸à¸à¹à¸­à¸¡ à¸«à¸£à¸·à¸­à¸à¸£à¸°à¸à¸±à¸à¹à¸à¸¥à¹à¸«à¸¡à¸
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
        if (nm&&nm<=soon7) parts.push('à¸à¸¶à¸à¸£à¸­à¸à¸à¹à¸­à¸¡ '+(a.nextMaintenanceDate));
        if (we&&we<=soon30) parts.push('à¸à¸£à¸°à¸à¸±à¸à¸«à¸¡à¸ '+(a.warrantyExpiry));
        return `<div style="margin-bottom:4px;">ð <b>${a.name}</b> (${a.assetNo}) â ${parts.join(' | ')}</div>`;
      }).join('');
    } else { alertCard.style.display='none'; }
  }

  let list = (db.assets||[]).filter(a=>{
    if (catF    && a.category!==catF)    return false;
    if (statusF && a.status  !==statusF) return false;
    if (q && !((a.name||'')+(a.assetNo||'')+(a.location||'')+(a.brand||'')+(a.model||'')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(a.assetNo||'').localeCompare(b.assetNo||''));

  document.getElementById('asset-count').textContent = 'à¸à¸±à¹à¸à¸«à¸¡à¸: '+list.length+' à¸£à¸²à¸¢à¸à¸²à¸£';

  if (!list.length) { tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3);">à¹à¸¡à¹à¸¡à¸µà¸à¹à¸­à¸¡à¸¹à¸¥</td></tr>'; return; }

  const today2 = today.toISOString().slice(0,10);
  tb.innerHTML = list.map(a=>{
    const nmCls = a.nextMaintenanceDate && a.nextMaintenanceDate <= today2 ? 'color:#c0392b;font-weight:700' : (a.nextMaintenanceDate&&a.nextMaintenanceDate<=soon7.toISOString().slice(0,10)?'color:#e67e22;font-weight:600':'');
    const weCls = a.warrantyExpiry && a.warrantyExpiry <= soon30.toISOString().slice(0,10) ? 'color:#e67e22' : '';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;">${a.assetNo||'-'}${a.isCritical?'<span style="color:#c0392b;margin-left:4px;" title="à¸­à¸¸à¸à¸à¸£à¸à¹à¸ªà¸³à¸à¸±à¸">â ï¸</span>':''}</td>
      <td style="font-weight:500;">${a.name}<br><span style="font-size:11px;color:var(--text3);">${a.brand||''} ${a.model||''}</span></td>
      <td><span class="badge" style="background:var(--surface2);color:var(--text2);">${ASSET_CAT_LABEL[a.category]||a.category}</span></td>
      <td style="font-size:12px;">${a.location||'-'}</td>
      <td style="font-size:12px;">${a.lastMaintenanceDate||'-'}</td>
      <td style="font-size:12px;${nmCls}">${a.nextMaintenanceDate||'-'}</td>
      <td style="font-size:12px;${weCls}">${a.warrantyExpiry||'-'}</td>
      <td>${ASSET_STATUS_BADGE[a.status]||a.status}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openAddMaintenanceModal('${a.id}')">ð ï¸</button>
        <button class="btn btn-ghost btn-sm" onclick="editAsset('${a.id}')">âï¸</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteAsset('${a.id}')">ðï¸</button>
      </td>
    </tr>`;
  }).join('');
}

function onAssetCategoryChange(sel) {
  var wrap = document.getElementById('asset-category-custom-wrap');
  if (wrap) wrap.style.display = sel.value === 'other' ? 'block' : 'none';
}

function openAddAssetModal() {
  document.getElementById('editAssetId').value='';
  document.getElementById('addAssetModalTitle').textContent='ð§ à¹à¸à¸´à¹à¸¡à¸à¸£à¸¸à¸ à¸±à¸à¸à¹';
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
  const assetNoEl = document.getElementById('asset-no');
  if (assetNoEl) { assetNoEl.value = 'กำลังสร้าง...'; assetNoEl.readOnly = true; }
  supa.rpc('get_next_doc_no', { p_module: 'asset' }).then(({ data, error }) => {
    if (!error && data && assetNoEl) assetNoEl.value = data;
    else if (assetNoEl) assetNoEl.value = '';
  });
  openModal('modal-addAsset');
}

async function saveAsset() {
  const id   = document.getElementById('editAssetId').value;
  const name = document.getElementById('asset-name').value.trim();
  const loc  = document.getElementById('asset-location').value.trim();
  if (!name||!loc) { toast('à¸à¸£à¸¸à¸à¸²à¸à¸£à¸­à¸à¸à¸·à¹à¸­à¸­à¸¸à¸à¸à¸£à¸à¹à¹à¸¥à¸°à¸à¸³à¹à¸«à¸à¹à¸','error'); return; }

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
    if (error) { toast('à¹à¸à¹à¹à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
    const idx = (db.assets||[]).findIndex(r=>String(r.id)===String(id));
    if (idx>=0) db.assets[idx]=mapAsset(data);
  } else {
    const { data, error } = await supa.from('assets').insert(payload).select().single();
    if (error) { toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error'); return; }
    if (!db.assets) db.assets=[];
    db.assets.unshift(mapAsset(data));
  }
  toast(id?'à¹à¸à¹à¹à¸à¸à¸£à¸¸à¸ à¸±à¸à¸à¹à¹à¸¥à¹à¸§':'à¹à¸à¸´à¹à¸¡à¸à¸£à¸¸à¸ à¸±à¸à¸à¹à¹à¸¥à¹à¸§','success');
  logAudit('assets',id?'edit':'add',id||'new',{name});
  closeModal('modal-addAsset');
  renderAssets();
}

function editAsset(id) {
  const a=(db.assets||[]).find(x=>String(x.id)===String(id)); if(!a) return;
  document.getElementById('editAssetId').value=id;
  document.getElementById('addAssetModalTitle').textContent='âï¸ à¹à¸à¹à¹à¸à¸à¸£à¸¸à¸ à¸±à¸à¸à¹';
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
  const assetNoEdit = document.getElementById('asset-no'); if(assetNoEdit){ assetNoEdit.value=a.assetNo||''; assetNoEdit.readOnly=true; }
  openModal('modal-addAsset');
}

async function deleteAsset(id) {
  const a=(db.assets||[]).find(x=>String(x.id)===String(id)); if(!a) return;
  if(!confirm('à¸¥à¸à¸à¸£à¸¸à¸ à¸±à¸à¸à¹ "'+a.name+'" à¹à¸¥à¸°à¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¹à¸­à¸¡à¸à¸±à¹à¸à¸«à¸¡à¸?')) return;
  const {error}=await supa.from('assets').delete().eq('id',id);
  if(error){toast('à¸¥à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error');return;}
  db.assets=(db.assets||[]).filter(x=>String(x.id)!==String(id));
  db.assetMaintenanceLogs=(db.assetMaintenanceLogs||[]).filter(x=>String(x.assetId)!==String(id));
  toast('à¸¥à¸à¹à¸¥à¹à¸§','success'); renderAssets();
}

function openAddMaintenanceModal(assetId) {
  const a=(db.assets||[]).find(x=>String(x.id)===String(assetId)); if(!a) return;
  document.getElementById('maintAssetId').value=assetId;
  document.getElementById('maint-asset-name-badge').textContent='ð§ '+a.name+' ('+a.assetNo+')';
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
  const assetId = document.getElementById('maintAssetId').value;
  const date    = document.getElementById('maint-date').value;
  const desc    = document.getElementById('maint-desc').value.trim();
  if (!assetId||!date||!desc) { toast('à¸à¸£à¸¸à¸à¸²à¸à¸£à¸­à¸à¸§à¸±à¸à¸à¸µà¹à¹à¸¥à¸°à¸£à¸²à¸¢à¸¥à¸°à¹à¸­à¸µà¸¢à¸','error'); return; }

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
  if (error){toast('à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: '+error.message,'error');return;}
  if(!db.assetMaintenanceLogs) db.assetMaintenanceLogs=[];
  db.assetMaintenanceLogs.unshift(data);

  // à¸­à¸±à¸à¹à¸à¸ local db.assets
  const a=(db.assets||[]).find(x=>String(x.id)===String(assetId));
  if(a){
    a.lastMaintenanceDate=date;
    if(payload.next_maintenance_date) a.nextMaintenanceDate=payload.next_maintenance_date;
    if(payload.is_resolved) a.status='active'; else a.status='under_repair';
  }
  toast('à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸­à¸¡à¹à¸¥à¹à¸§','success');
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
