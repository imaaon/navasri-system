(function(){
var SCAN_URL='https://umueucsxowjaurlaubwa.supabase.co/functions/v1/scan-invoice';
function _scanFile(btnId,mode,cb){var inp=document.createElement('input');inp.type='file';inp.accept='image/*,application/pdf';inp.onchange=async function(){var file=inp.files[0];if(!file)return;var btn=document.getElementById(btnId);if(btn){btn.innerHTML='⏳ กำลังอ่าน...';btn.disabled=true;}try{var base64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(',')[1]);};r.onerror=function(){rej(new Error('อ่านไฟล์ไม่สำเร็จ'));};r.readAsDataURL(file);});var resp=await fetch(SCAN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:base64,mediaType:file.type||'image/jpeg',mode:mode})});var result=await resp.json();if(!result.ok||!result.data){toast('อ่านไม่สำเร็จ: '+(result.error||'ไม่ทราบสาเหตุ'),'error');return;}cb(result.data);}catch(e){toast('เกิดข้อผด: '+e.message,'error');}finally{if(btn){btn.innerHTML='📷 สแกน';btn.disabled=false;}}};inp.click();}
function _injectScanBtn(modalId,btnId,label,fn){var modal=document.getElementById(modalId);if(!modal)return;if(document.getElementById(btnId))return;var hdr=modal.querySelector('.modal-header');var anchor=hdr?hdr.querySelector('.modal-close'):modal.querySelector('.modal-close');if(!anchor)return;var btn=document.createElement('button');btn.id=btnId;btn.className='btn btn-ghost btn-sm';btn.style.cssText='font-size:13px;display:inline-flex;align-items:center;margin-right:8px;';btn.innerHTML='📷 '+label;btn.onclick=function(){fn();};anchor.parentNode.insertBefore(btn,anchor);}
function _showPickerModal(title,items,renderItem,onConfirm){var ex=document.getElementById('scan-picker-modal');if(ex)ex.remove();var overlay=document.createElement('div');overlay.id='scan-picker-modal';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;';var box=document.createElement('div');box.style.cssText='background:var(--surface,#fff);border-radius:12px;padding:24px;width:520px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;gap:12px;';var hdr=document.createElement('div');hdr.style.cssText='font-size:15px;font-weight:700;';hdr.textContent=title;var list=document.createElement('div');list.style.cssText='overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;';var selected=items.map(function(){return true;});items.forEach(function(item,i){var row=renderItem(item,i,function(val){selected[i]=val;});list.appendChild(row);});var footer=document.createElement('div');footer.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:4px;';var cancelBtn=document.createElement('button');cancelBtn.className='btn btn-ghost';cancelBtn.textContent='ยกเลิก';cancelBtn.onclick=function(){overlay.remove();};var confirmBtn=document.createElement('button');confirmBtn.className='btn btn-primary';confirmBtn.textContent='เพิ่มรายการที่เลือก';confirmBtn.onclick=function(){overlay.remove();onConfirm(items.filter(function(_,i){return selected[i];}));};footer.appendChild(cancelBtn);footer.appendChild(confirmBtn);box.appendChild(hdr);box.appendChild(list);box.appendChild(footer);overlay.appendChild(box);document.body.appendChild(overlay);}
function _fuzzyMatch(str,options){if(!str||!options||!options.length)return null;var s=str.toLowerCase().trim();var found=options.find(function(o){return o.toLowerCase()===s;});if(found)return found;found=options.find(function(o){return o.toLowerCase().includes(s)||s.includes(o.toLowerCase());});return found||null;}
function fixModalFooter(){['modal-addSupplier','modal-addSupInv','modal-addPR'].forEach(function(id){var o=document.getElementById(id);if(!o)return;var m=o.querySelector('.modal'),f=o.querySelector('.modal-footer');if(!m||!f)return;if(!m.contains(f))m.appendChild(f);});}
function fixModalScroll(){['modal-addSupplier','modal-addSupInv','modal-addPR'].forEach(function(id){var o=document.getElementById(id);if(!o)return;var m=o.querySelector('.modal'),b=o.querySelector('.modal-body');if(!m||!b)return;m.style.setProperty('overflow','hidden','important');m.style.setProperty('display','flex','important');m.style.setProperty('flex-direction','column','important');m.style.setProperty('max-height','90vh','important');b.style.setProperty('overflow-y','auto','important');b.style.setProperty('flex','1','important');b.style.setProperty('min-height','0','important');});}
function fixSupplierLayout(){var bankName=document.getElementById('supplier-bank-name'),entityType=document.getElementById('supplier-entity-type');if(!bankName||!entityType)return;var el=bankName,bankSection=null;while(el&&el!==document.body){var s=el.getAttribute('style')||'';if(s.includes('margin-top:14px')||s.includes('margin-top: 14px')){bankSection=el;break;}el=el.parentElement;}el=entityType;var extraSection=null;while(el&&el!==document.body){var s2=el.getAttribute('style')||'';if(s2.includes('margin-top:10px')||s2.includes('margin-top: 10px')){extraSection=el;break;}el=el.parentElement;}if(!bankSection&&!extraSection)return;if(bankSection)bankSection.innerHTML='<b>ข้อมูลธนาคาร</b><div class="form-grid" style="margin-top:8px;"><div class="form-group"><label class="form-label">ธนาคาร</label><input class="form-control" id="supplier-bank-name" type="text"></div><div class="form-group"><label class="form-label">ชื่อบัญชี</label><input class="form-control" id="supplier-bank-account-name" type="text"></div></div><div class="form-group" style="margin-top:8px;"><label class="form-label">เลขบัญชี</label><input class="form-control" id="supplier-bank-account-no" type="text"></div>';if(extraSection)extraSection.innerHTML='<b>ข้อมูลเพิ่มเติม</b><div class="form-grid" style="margin-top:8px;"><div class="form-group"><label class="form-label">ประเภท</label><select class="form-control" id="supplier-entity-type"><option value="นิติบุคคล">นิติบุคคล</option><option value="บุคคลธรรมดา">บุคคลธรรมดา</option></select></div><div class="form-group"><label class="form-label">เครดิต (วัน)</label><input class="form-control" id="supplier-credit-days" type="number" min="0" placeholder="0"></div></div>';}
function fixPRRequester(){var inp=document.getElementById('pr-requester');if(inp&&inp.value==='admin')inp.value='';if(!document.getElementById('pr-requester-custom')){var dl=document.getElementById('pr-requester-list');if(!dl)return;var ci=document.createElement('input');ci.className='form-control';ci.id='pr-requester-custom';ci.type='text';ci.placeholder='หรือพิมพ์ชื่อเอง...';ci.style.marginTop='6px';ci.oninput=function(){if(ci.value.trim())document.getElementById('pr-requester').value=ci.value.trim();};dl.after(ci);}}
setTimeout(function(){fixModalFooter();fixModalScroll();},300);
var _origOpen=window.openModal;if(typeof _origOpen==='function'){window.openModal=function(id){var el=document.getElementById(id);if(el)el.style.display='';_origOpen(id);setTimeout(function(){fixModalFooter();fixModalScroll();if(id==='modal-addSupplier')fixSupplierLayout();if(id==='modal-addPR')fixPRRequester();if(id==='modal-addSupInv')_injectScanBtn('modal-addSupInv','scan-supinv-btn','AI Scan',window.scanSupInv);},80);};}
// [MOVED to requisition.js] openAddPRModal — clear requester + inject custom input
// ✅ Fix 4: canManagePhysio และ canDeletePhysio ลบออกแล้ว — ให้ permissions.js กำหนด
// [MOVED to physio.js] savePhysioSession — delayed re-render after save
console.log('[fix] v87 snippet loaded');
function _statusLabel(s){return({active:'🏠 พักอยู่',hospital:'🏥 อยู่โรงพยาบาล',inactive:'🚶 ออกแล้ว',discharged:'🚶 ออกแล้ว',transferred:'🔄 ย้ายศูนย์',other:'📝 อื่นๆ'})[s]||s;}
function _statusBg(s){return s==='active'?'#27ae60':s==='hospital'?'#f39c12':'#e74c3c';}
window._injectStatusBtn=function(patientId){var p=db.patients.find(function(x){return String(x.id)===String(patientId);});if(!p)return;var profileCard=document.querySelector('#patprofile-content .card');if(!profileCard)return;var oldBadge=profileCard.querySelector('.badge');if(!oldBadge)return;var btn=document.createElement('button');btn.id='status-change-btn';btn.style.cssText='background:'+_statusBg(p.status)+';color:#fff;border:none;border-radius:20px;padding:5px 16px;font-size:13px;font-weight:600;cursor:pointer';btn.textContent=_statusLabel(p.status);btn.onclick=function(){_openStatusModal(p);};oldBadge.replaceWith(btn);}
window._openStatusModal=function(p){var ex=document.getElementById('modal-status-change');if(ex)ex.remove();var actor=(typeof currentUser!=='undefined')?(currentUser.displayName||currentUser.username||''):'';var today=new Date().toISOString().slice(0,10);var modal=document.createElement('div');modal.id='modal-status-change';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';modal.innerHTML='<div style="background:var(--surface,#fff);border-radius:12px;padding:28px 24px;width:440px;max-width:95vw"><div style="font-size:16px;font-weight:700;margin-bottom:16px">🔄 เปลี่ยนสถานะ: '+p.name+'</div><div style="margin-bottom:12px"><label style="font-size:13px;font-weight:600">สถานะใหม่ *</label><select id="sc-status" class="form-control" style="margin-top:4px"><option value="active"'+(p.status==="active"?" selected":"")+'>'+_statusLabel('active')+'</option><option value="hospital"'+(p.status==="hospital"?" selected":"")+'>'+_statusLabel('hospital')+'</option><option value="inactive"'+(p.status==="inactive"?" selected":"")+'>'+_statusLabel('inactive')+'</option><option value="transferred"'+(p.status==="transferred"?" selected":"")+'>'+_statusLabel('transferred')+'</option><option value="other"'+(p.status==="other"?" selected":"")+'>'+_statusLabel('other')+'</option></select></div><div style="margin-bottom:12px"><label style="font-size:13px;font-weight:600">วันที่ *</label><input id="sc-date" type="date" class="form-control" value="'+today+'" style="margin-top:4px"></div><div id="sc-return-wrap" style="margin-bottom:12px;display:none"><label style="font-size:13px;font-weight:600">วันที่กลับ</label><input id="sc-return" type="date" class="form-control" style="margin-top:4px"></div><div style="margin-bottom:20px"><label style="font-size:13px;font-weight:600">หมายเหตุ</label><input id="sc-note" class="form-control" style="margin-top:4px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" id="sc-cancel">ยกเลิก</button><button class="btn btn-primary" id="sc-submit">บันทึก</button></div></div>';document.body.appendChild(modal);var sel=document.getElementById('sc-status'),wrap=document.getElementById('sc-return-wrap');sel.onchange=function(){wrap.style.display=sel.value==='hospital'?'block':'none';};sel.onchange();document.getElementById('sc-cancel').onclick=function(){modal.remove();};document.getElementById('sc-submit').onclick=function(){_saveStatusChange(p,actor);};};
window._saveStatusChange=async function(p,actor){var newStatus=document.getElementById('sc-status').value,statusDate=document.getElementById('sc-date').value,returnDate=document.getElementById('sc-return').value||null,note=document.getElementById('sc-note').value.trim();if(!statusDate){alert('กรุณาระบุวันที่');return;}var res=await supa.rpc('change_patient_status',{p_patient_id:p.id,p_status:newStatus,p_by:actor,p_note:note||null});if(res.error||!res.data?.ok){alert('บันทึกไม่สำเร็จ: '+(res.error?.message||res.data?.error||'unknown'));return;}var r2=await supa.from('patient_status_logs').insert({patient_id:p.id,old_status:p.status,new_status:newStatus,changed_by:actor,status_date:statusDate,return_date:returnDate||null,note:note||null});if(r2.error){console.error('[saveStatusChange] log insert fail:',r2.error.message);}var idx=db.patients.findIndex(function(x){return String(x.id)===String(p.id);});if(idx>=0)db.patients[idx].status=newStatus;document.getElementById('modal-status-change').remove();toast('เปลี่ยนสถานะเรียบร้อย','success');openPatientProfile(p.id);};
window.scanExpense=function(){_scanFile('scan-expense-btn','expense',function(d){if(d.invoice_date)document.getElementById('exp-date').value=d.invoice_date;if(d.supplier_name)document.getElementById('exp-vendor-name').value=d.supplier_name;if(d.supplier_address)document.getElementById('exp-vendor-addr').value=d.supplier_address;if(d.supplier_tax_id)document.getElementById('exp-vendor-taxid').value=d.supplier_tax_id;if(d.job_name)document.getElementById('exp-job').value=d.job_name;if(d.note)document.getElementById('exp-note').value=d.note;if(d.wht_rate!=null)document.getElementById('exp-wht-rate').value=d.wht_rate;if(d.items&&d.items.length>0){document.getElementById('exp-items-data').value=JSON.stringify(d.items.map(function(it){return{name:it.item_name||'',qty:it.qty||1,unit:it.unit||'',price:it.unit_price||0,total:it.total||0};}));if(typeof renderExpenseItems==='function')renderExpenseItems();if(typeof recalcExpense==='function')recalcExpense();}toast('อ่านเรียบร้อย','success');});};
window.scanReceive=function(){_scanFile('scan-receive-btn','receive',function(d){var items=d.items&&d.items.length>0?d.items:[d];var fill=function(item){if(item.qty!=null)document.getElementById('recv-qty').value=item.qty;if(item.cost!=null)document.getElementById('recv-cost').value=item.cost;if(item.lot_number)document.getElementById('recv-lot').value=item.lot_number;if(item.mfg_date)document.getElementById('recv-mfg-date').value=item.mfg_date;if(item.expiry_date)document.getElementById('recv-expiry').value=item.expiry_date;if(d.receive_date||item.receive_date)document.getElementById('recv-date').value=d.receive_date||item.receive_date;if(d.supplier_name||item.supplier_name)document.getElementById('recv-supplier').value=d.supplier_name||item.supplier_name||'';if(d.po_number||item.po_number)document.getElementById('recv-po').value=d.po_number||item.po_number||'';var sel=document.getElementById('recv-item');if(sel&&(item.item_name||d.item_name)){var name=item.item_name||d.item_name;var opts=Array.from(sel.options).map(function(o){return{v:o.value,t:o.text};});var nameLo=name.toLowerCase();var best=opts.find(function(o){return o.t.toLowerCase().includes(nameLo)||nameLo.includes(o.t.toLowerCase().split(' ')[0]);});if(best)sel.value=best.v;}};if(items.length===1){fill(items[0]);toast('อ่านเรียบร้อย','success');}else{_showPickerModal('📦 เลือกรายการ',items,function(item,i,onChange){var row=document.createElement('div');row.style.cssText='display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface2,#f5f5f5);border-radius:8px;';var cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.style.marginTop='3px';cb.onchange=function(){onChange(cb.checked);};var info=document.createElement('div');info.style.flex='1';info.innerHTML='<div style="font-weight:600;">'+(item.item_name||'-')+'</div><div style="font-size:12px;">จำนวน: '+(item.qty||'-')+'</div>'+(item.expiry_date?'<div style="font-size:12px;color:#e67e22;">วนหมด: '+item.expiry_date+'</div>':'');row.appendChild(cb);row.appendChild(info);return row;},function(selected){if(!selected.length)return;fill(selected[0]);toast('เติมเรียบร้อย','success');});}});};
window.scanAppointment=function(){_scanFile('scan-appt-btn','appointment',function(d){if(d.appt_date)document.getElementById('appt-date').value=d.appt_date;if(d.appt_time)document.getElementById('appt-time').value=d.appt_time;if(d.hospital)document.getElementById('appt-hospital').value=d.hospital;if(d.department)document.getElementById('appt-department').value=d.department;if(d.doctor)document.getElementById('appt-doctor').value=d.doctor;if(d.purpose)document.getElementById('appt-purpose').value=d.purpose;if(d.preparation)document.getElementById('appt-preparation').value=d.preparation;if(d.coverage){var cv=document.getElementById('appt-coverage');if(cv)cv.value=d.coverage;}if(d.orders){var od=document.getElementById('appt-orders');if(od)od.value=d.orders;}if(d.note)document.getElementById('appt-note').value=d.note;toast('อ่านใบนัดเรียบร้อย','success');});};
// [MOVED to clinical-appt.js] saveAppt — coverage/orders fields injected directly into row
window.scanMedication=function(){_scanFile('scan-med-btn','medication',function(d){var meds=d.medications&&d.medications.length?d.medications:[];if(!meds.length){toast('ไม่พบยา','warning');return;}var fill=function(m){if(m.name)document.getElementById('med-name').value=m.name;if(m.dose)document.getElementById('med-dose').value=m.dose;if(m.start_date)document.getElementById('med-start').value=m.start_date;if(m.end_date)document.getElementById('med-end').value=m.end_date;if(m.note)document.getElementById('med-note').value=m.note;if(m.unit){var unitSel=document.getElementById('med-unit');if(unitSel){var unitOpts=Array.from(unitSel.options).map(function(o){return o.value;});var matched=_fuzzyMatch(m.unit,unitOpts);if(matched)unitSel.value=matched;}}if(m.route){var routeSel=document.getElementById('med-route');if(routeSel){var routeOpts=Array.from(routeSel.options).map(function(o){return o.value;});var matchedR=_fuzzyMatch(m.route,routeOpts);if(matchedR)routeSel.value=matchedR;}}if(m.timings&&m.timings.length){['เช้า','กลางวัน','เย็น','ก่อนนอน','ก่อนอาหาร','หลังอาหาร','PRN'].forEach(function(t){var cb=document.getElementById('med-timing-'+t);if(cb)cb.checked=m.timings.indexOf(t)>=0;});}};if(meds.length===1){fill(meds[0]);toast('อ่านเรียบร้อย','success');}else{_showPickerModal('💊 เลือกยา',meds,function(med,i,onChange){var row=document.createElement('div');row.style.cssText='display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface2,#f5f5f5);border-radius:8px;';var cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.style.marginTop='3px';cb.onchange=function(){onChange(cb.checked);};var info=document.createElement('div');info.style.flex='1';info.innerHTML='<div style="font-weight:600;">'+(med.name||'-')+'</div><div style="font-size:12px;">'+(med.dose||'')+' '+(med.unit||'')+' | '+(med.route||'')+'</div>';row.appendChild(cb);row.appendChild(info);return row;},function(selected){if(!selected.length)return;fill(selected[0]);toast('อ่านเรียบร้อย','success');});}});};
window.scanLabResult=function(){_scanFile('scan-vital-btn','labresult',function(d){if(d.test_date){var el=document.getElementById('vital-time');if(el)el.value=d.test_date+'T08:00';}toast('เติม Vital Signs แล้ว','info');var patId=document.getElementById('vital-pat-id')?.value||'';if(patId){setTimeout(function(){openAddLabModal(patId);if(d.test_date)document.getElementById('lab-test-date').value=d.test_date;if(d.hospital)document.getElementById('lab-hospital').value=d.hospital;if(d.doctor)document.getElementById('lab-doctor').value=d.doctor;if(d.summary)document.getElementById('lab-summary').value=d.summary;window._labRows=(d.results||[]).map(function(r){return{test_name:r.test_name||'',value:r.value||'',unit:r.unit||'',reference_range:r.reference_range||'',status:r.status||'normal'};});window._renderLabRows();},300);}});};
var _origOpenRecv=window.openReceiveModal;if(typeof _origOpenRecv==='function'){window.openReceiveModal=function(){_origOpenRecv.apply(this,arguments);setTimeout(function(){_injectScanBtn('modal-receive','scan-receive-btn','สแกน',window.scanReceive);},80);};}
var _origOpenAppt=window.openApptModal;if(typeof _origOpenAppt==='function'){window.openApptModal=function(){_origOpenAppt.apply(this,arguments);setTimeout(function(){_injectScanBtn('modal-appt','scan-appt-btn','สแกนนัด',window.scanAppointment);},80);};}
var _origOpenMed=window.openAddMedModal;if(typeof _origOpenMed==='function'){window.openAddMedModal=function(){_origOpenMed.apply(this,arguments);setTimeout(function(){_injectScanBtn('modal-add-medication','scan-med-btn','สแกนยา',window.scanMedication);},80);};}
var _origOpenVital=window.openAddVitalModal;if(typeof _origOpenVital==='function'){window.openAddVitalModal=function(){_origOpenVital.apply(this,arguments);setTimeout(function(){_injectScanBtn('modal-add-vital','scan-vital-btn','สแกนแล็บ',window.scanLabResult);},80);};}
var _origOpenExp=window.openExpenseModal;if(typeof _origOpenExp==='function'){window.openExpenseModal=function(){_origOpenExp();setTimeout(function(){if(document.getElementById('scan-expense-btn'))return;var modal=document.getElementById('modal-expense');if(!modal)return;var closeBtn=modal.querySelector('.modal-close');if(!closeBtn)return;var btn=document.createElement('button');btn.id='scan-expense-btn';btn.className='btn btn-ghost btn-sm';btn.style.cssText='font-size:13px;display:inline-flex;align-items:center;margin-right:8px;';btn.innerHTML='📷 สแกน';btn.onclick=function(){scanExpense();};closeBtn.parentNode.insertBefore(btn,closeBtn);},80);};}
var _origOpenLab=window.openAddLabModal;if(typeof _origOpenLab==='function'){var _origOpenLabOrig=_origOpenLab;window.openAddLabModal=function(patientId){_origOpenLabOrig(patientId);setTimeout(function(){_injectScanBtn('modal-add-lab','scan-lab-btn','สแกนแล็บ',function(){_scanFile('scan-lab-btn','labresult',function(d){if(d.test_date)document.getElementById('lab-test-date').value=d.test_date;if(d.hospital)document.getElementById('lab-hospital').value=d.hospital;if(d.doctor)document.getElementById('lab-doctor').value=d.doctor;if(d.summary)document.getElementById('lab-summary').value=d.summary;window._labRows=(d.results||[]).map(function(r){return{test_name:r.test_name||'',value:r.value||'',unit:r.unit||'',reference_range:r.reference_range||'',status:r.status||'normal'};});window._renderLabRows();toast('อ่านเรียบร้อย','success');});});},80);};}
window.scanSupInv=function(){_scanFile('scan-supinv-btn','invoice',function(d){if(d.invoice_no)document.getElementById('supinv-no').value=d.invoice_no;if(d.invoice_date)document.getElementById('supinv-date').value=d.invoice_date;if(d.due_date)document.getElementById('supinv-due').value=d.due_date;if(d.supplier_name){var manualEl=document.getElementById('supinv-supplier-manual');if(manualEl)manualEl.value=d.supplier_name;var inpEl=document.getElementById('ta-sis-inp');if(inpEl)inpEl.value=d.supplier_name;}if(d.vat_rate!=null)document.getElementById('supinv-vat').value=d.vat_rate;if(d.wht_rate!=null)document.getElementById('supinv-wht-rate').value=d.wht_rate;if(d.items&&d.items.length>0&&typeof addSupInvLine==='function'){var cont=document.getElementById('supinv-lines-container');if(cont)cont.innerHTML='';d.items.forEach(function(it){addSupInvLine({item_name:it.item_name||'',qty:it.qty||1,unit:it.unit||'',unit_price:it.unit_price||0,total:it.total||0,line_type:'service',update_stock:false});});}if(d.subtotal!=null)document.getElementById('supinv-subtotal').value=d.subtotal;if(typeof calcSupInvTotal==='function')calcSupInvTotal();toast('อ่านใบแจ้งหนี้เรียบร้อย','success');});};
// [MOVED to router.js] loadBillingSettings hook on showPage settings
// [MOVED to router.js] loadBillingSettings hook on showPage settings (duplicate removed)
console.log('[fix] v90 snippet loaded');

// ===== FIX: openTubeFeedModal — clear ta-tf-id before open (v92) =====
var _origOpenTubeFeedModal = window.openTubeFeedModal;
if (typeof _origOpenTubeFeedModal === 'function') {
  window.openTubeFeedModal = function(id) {
    // ถ้าไม่ได้ส่ง id = เปิด modal ใหม่ ให้ clear patient fields
    if (!id) {
      var _tfId = document.getElementById('ta-tf-id');
      var _tfInp = document.getElementById('ta-tf-inp');
      if (_tfId) _tfId.value = '';
      if (_tfInp) _tfInp.value = '';
    }
    _origOpenTubeFeedModal.apply(this, arguments);
  };
}
console.log('[fix] v92 snippet loaded');

// ===== FIX: saveWound — map recorder → created_by (v93) =====
var _origSaveWound = window.saveWound;
if (typeof _origSaveWound === 'function') {
  window.saveWound = async function() {
    // patch supa.from('patient_wounds').insert/update ให้ map recorder → created_by
    var _origFrom = supa.from.bind(supa);
    supa.from = function(table) {
      var qb = _origFrom(table);
      if (table === 'patient_wounds') {
        var _origInsert = qb.insert.bind(qb);
        var _origUpdate = qb.update.bind(qb);
        qb.insert = function(data) {
          if (data && data.recorder !== undefined) {
            data.created_by = data.recorder;
            delete data.recorder;
          }
          return _origInsert(data);
        };
        qb.update = function(data) {
          if (data && data.recorder !== undefined) {
            data.created_by = data.recorder;
            delete data.recorder;
          }
          return _origUpdate(data);
        };
      }
      return qb;
    };
    try {
      await _origSaveWound.apply(this, arguments);
    } finally {
      supa.from = _origFrom;
    }
  };
}
console.log('[fix] v93 snippet loaded');

// ===== FIX v94: แก้ 5 bugs (แพ้ยา / อุบัติเหตุ / แผลกดทับ / โภชนาการ) =====

// FIX 1: openEditAllergyModal — params สลับกัน (ปุ่มส่ง allergyId, patientId แต่ fn รับ patId, allergyId)
var _origEditAllergy = window.openEditAllergyModal;
if (typeof _origEditAllergy === 'function') {
  window.openEditAllergyModal = function(first, second) {
    // ตรวจว่า first เป็น allergyId (number/short) หรือ patientId (UUID)
    var isUUID = function(s) { return typeof s === 'string' && s.length > 20; };
    if (isUUID(second) && !isUUID(first)) {
      // first=allergyId, second=patientId — สลับกลับ
      return _origEditAllergy.call(this, second, first);
    }
    return _origEditAllergy.apply(this, arguments);
  };
}

// FIX 2: openIncidentModal — ใช้ db.incidentReports แทน db.incidents
var _origOpenIncidentModal = window.openIncidentModal;
if (typeof _origOpenIncidentModal === 'function') {
  window.openIncidentModal = function(id) {
    // patch db.incidents ชั่วคราวให้ชี้ไปที่ db.incidentReports
    var _origIncidents = db.incidents;
    db.incidents = db.incidentReports || [];
    try {
      _origOpenIncidentModal.call(this, id);
    } finally {
      db.incidents = _origIncidents;
    }
  };
}

// FIX 3: openWoundModal — db.wounds ไม่มี ต้อง fetch จาก Supabase แล้ว populate
var _origOpenWoundModal = window.openWoundModal;
if (typeof _origOpenWoundModal === 'function') {
  window.openWoundModal = async function(id) {
    if (id) {
      // ถ้ามี id ให้ fetch จาก Supabase ก่อน แล้วใส่ใน db.wounds
      var result = await supa.from('patient_wounds').select('*').eq('id', id).single();
      if (!result.error && result.data) {
        if (!db.wounds) db.wounds = [];
        var mapped = mapWound(result.data);
        var idx = db.wounds.findIndex(function(x){ return String(x.id) === String(id); });
        if (idx >= 0) db.wounds[idx] = mapped;
        else db.wounds.unshift(mapped);
      }
    }
    _origOpenWoundModal.call(this, id);
  };
}

// FIX 4+5: openDietModal — db.diets ไม่มี ต้อง fetch จาก Supabase
var _origOpenDietModal = window.openDietModal;
if (typeof _origOpenDietModal === 'function') {
  window.openDietModal = async function(id) {
    if (id) {
      var result = await supa.from('patient_diets').select('*').eq('id', id).single();
      if (!result.error && result.data) {
        if (!db.diets) db.diets = [];
        var mapped = mapDiet(result.data);
        var idx = db.diets.findIndex(function(x){ return String(x.id) === String(id); });
        if (idx >= 0) db.diets[idx] = mapped;
        else db.diets.unshift(mapped);
      }
    }
    _origOpenDietModal.call(this, id);
  };
}

// FIX 5b: renderDietaryPage refresh — patch saveDiet ให้เรียก renderDietaryPage หลัง save เสมอ
// (saveDiet มี renderDietaryPage อยู่แล้ว แต่ถ้า db.diets ว่างอยู่ จะ render ว่าง)
// แก้ด้วยการ reload diet list จาก Supabase ก่อน render
var _origSaveDiet = window.saveDiet;
if (typeof _origSaveDiet === 'function') {
  window.saveDiet = async function() {
    await _origSaveDiet.apply(this, arguments);
    // refresh db.diets จาก Supabase แล้วค่อย render
    try {
      var r2 = await supa.from('patient_diets').select('*').order('created_at', {ascending: false});
      if (!r2.error && r2.data) {
        db.diets = r2.data.map(mapDiet);
        renderDietaryPage();
      }
    } catch(e) {}
  };
}

console.log('[fix] v94 snippet loaded');

// ===== FIX v95 =====

// FIX A: saveWound — แก้ใหม่ทั้งหมด ไม่ใช้ _origSaveWound แต่ intercept ตรง Supabase insert/update
// ปัญหาเดิม: v93 ใช้ _origSaveWound ที่ undefined เพราะ define ก่อน original load
(function() {
  var _patchedSaveWound = window.saveWound;
  // ลบ patch v93 ออก แล้วใส่ใหม่ที่ถูกต้อง
  // intercept supa.from ตรงๆ ทุกครั้งที่ saveWound ถูกเรียก
  window.saveWound = async function() {
    var _origFrom = supa.from.bind(supa);
    supa.from = function(table) {
      var qb = _origFrom(table);
      if (table === 'patient_wounds') {
        var _origInsert = qb.insert.bind(qb);
        var _origUpdate = qb.update.bind(qb);
        qb.insert = function(data) {
          if (data && data.recorder !== undefined) {
            data.created_by = data.recorder;
            delete data.recorder;
          }
          return _origInsert(data);
        };
        qb.update = function(data) {
          if (data && data.recorder !== undefined) {
            data.created_by = data.recorder;
            delete data.recorder;
          }
          return _origUpdate(data);
        };
      }
      return qb;
    };
    try {
      // เรียก original saveWound โดยตรง (ไม่ใช้ _patchedSaveWound)
      // หา original จาก pages.html inline script
      var origFn = window._origSaveWoundV95;
      if (origFn) {
        await origFn.apply(this, arguments);
      } else {
        // fallback: ใช้ _patchedSaveWound แต่ถ้า patch อื่นพัง ให้ทำ manual save
        await _patchedSaveWound.apply(this, arguments);
      }
    } catch(e) {
      toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      supa.from = _origFrom;
    }
    // reload wound data หลัง save
    try {
      var wr = await supa.from('patient_wounds').select('*').order('wound_date', {ascending:false});
      if (!wr.error && wr.data) db.wounds = wr.data.map(mapWound);
    } catch(e2) {}
  };
})();

// FIX B: renderDietaryPage — patch mapTubeFeed ให้ใช้ column ชื่อถูก (volume ไม่ใช่ volume_ml)
var _origRenderDietaryPage = window.renderDietaryPage;
if (typeof _origRenderDietaryPage === 'function') {
  window.renderDietaryPage = async function() {
    // reload tube_feedings ด้วย mapping ที่ถูก
    if (supa) {
      var tr = await supa.from('tube_feedings').select('*').order('date', {ascending: false});
      if (!tr.error && tr.data) {
        db.tubeFeeds = tr.data.map(function(r) {
          return {
            id: r.id, patientId: r.patient_id, patientName: r.patient_name,
            date: r.date, time: r.time, meal: r.meal,
            formula: r.formula,
            volume: r.volume,       // column จริงชื่อ volume ไม่ใช่ volume_ml
            water: r.water,
            residual: r.residual,
            recorder: r.recorder, note: r.note
          };
        });
      }
      // reload diets ด้วย
      var dr = await supa.from('patient_diets').select('*').order('updated_at', {ascending: false});
      if (!dr.error && dr.data) db.diets = dr.data.map(mapDiet);
    }
    await _origRenderDietaryPage.apply(this, arguments);
  };
}

// FIX C: saveTubeFeed — reload หลัง save และ call renderDietaryPage
var _origSaveTubeFeed = window.saveTubeFeed;
if (typeof _origSaveTubeFeed === 'function') {
  window.saveTubeFeed = async function() {
    await _origSaveTubeFeed.apply(this, arguments);
    // reload tube_feedings
    try {
      var tr2 = await supa.from('tube_feedings').select('*').order('date', {ascending: false});
      if (!tr2.error && tr2.data) {
        db.tubeFeeds = tr2.data.map(function(r) {
          return { id:r.id, patientId:r.patient_id, patientName:r.patient_name, date:r.date, time:r.time, meal:r.meal, formula:r.formula, volume:r.volume, water:r.water, residual:r.residual, recorder:r.recorder, note:r.note };
        });
      }
      if (typeof renderTubeFeedTable === 'function') renderTubeFeedTable();
    } catch(e) {}
  };
}

// FIX D: saveIncident — reload incidentReports หลัง save
var _origSaveIncident = window.saveIncident;
if (typeof _origSaveIncident === 'function') {
  window.saveIncident = async function() {
    await _origSaveIncident.apply(this, arguments);
    // sync db.incidentReports กับ db.incidents
    try {
      if (db.incidents) db.incidentReports = db.incidents;
    } catch(e) {}
  };
}

console.log('[fix] v95 snippet loaded');

// ===== FIX v96: แก้ tube_feedings column mapping (volume_ml → volume) =====
// แก้ด้วยการ patch mapTubeFeed ตรงๆ แทนที่จะ wrap renderDietaryPage
// เพราะ _origRenderDietaryPage ยัง overwrite db.tubeFeeds ด้วย volume_ml
var _origMapTubeFeed = window.mapTubeFeed;
if (typeof _origMapTubeFeed === 'function') {
  window.mapTubeFeed = function(r) {
    var result = _origMapTubeFeed.call(this, r);
    // ถ้า volume undefined แต่มี volume_ml หรือ r.volume ให้ fix
    if ((result.volume === undefined || result.volume === null) && r) {
      result.volume = r.volume !== undefined ? r.volume : (r.volume_ml !== undefined ? r.volume_ml : 0);
      result.water = r.water !== undefined ? r.water : (r.water_ml !== undefined ? r.water_ml : 0);
      result.residual = r.residual !== undefined ? r.residual : (r.residual_ml !== undefined ? r.residual_ml : 0);
    }
    return result;
  };
}

// patch renderTubeFeedTable ให้แสดง volume ถูก field
var _origRenderTubeFeedTable = window.renderTubeFeedTable;
if (typeof _origRenderTubeFeedTable === 'function') {
  window.renderTubeFeedTable = function() {
    // fix db.tubeFeeds ก่อน render — เปลี่ยน volumeMl/volume_ml เป็น volume
    if (db.tubeFeeds) {
      db.tubeFeeds = db.tubeFeeds.map(function(x) {
        if (x.volume === undefined || x.volume === null) {
          x.volume = x.volumeMl !== undefined ? x.volumeMl : 0;
        }
        if (x.water === undefined || x.water === null) {
          x.water = x.waterMl !== undefined ? x.waterMl : 0;
        }
        if (x.residual === undefined || x.residual === null) {
          x.residual = x.residualMl !== undefined ? x.residualMl : 0;
        }
        return x;
      });
    }
    return _origRenderTubeFeedTable.apply(this, arguments);
  };
}

// patch renderDietaryPage ให้ after fetch fix volume field ใน db.tubeFeeds
var _origRenderDietaryPageV96 = window.renderDietaryPage;
if (typeof _origRenderDietaryPageV96 === 'function') {
  window.renderDietaryPage = async function() {
    await _origRenderDietaryPageV96.apply(this, arguments);
    // หลัง render เสร็จ fix volume fields ใน db.tubeFeeds แล้ว render table ใหม่
    if (db.tubeFeeds && db.tubeFeeds.length > 0) {
      var needFix = db.tubeFeeds.some(function(x){ return x.volume === undefined || x.volume === null; });
      if (needFix) {
        // reload จาก Supabase ด้วย column ที่ถูก
        try {
          var tr = await supa.from('tube_feedings').select('*').order('date', {ascending: false});
          if (!tr.error && tr.data) {
            db.tubeFeeds = tr.data.map(function(r) {
              return { id:r.id, patientId:r.patient_id, patientName:r.patient_name,
                date:r.date, time:r.time, meal:r.meal, formula:r.formula,
                volume: r.volume, water: r.water, residual: r.residual,
                recorder:r.recorder, note:r.note };
            });
            if (typeof _origRenderTubeFeedTable === 'function') _origRenderTubeFeedTable();
          }
        } catch(e) {}
      }
    }
  };
}

console.log('[fix] v96 snippet loaded');
})();