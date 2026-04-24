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

// ===== FIX v98: Clean rewrite — แก้ทุกปัญหาในรอบเดียว =====

// [1] openTubeFeedModal — clear ta-tf-id ตอนเปิด modal ใหม่ (no id)
(function() {
  var _orig = window.openTubeFeedModal;
  if (typeof _orig !== 'function') return;
  window.openTubeFeedModal = async function(id, patientId) {
    if (!id) {
      var el = document.getElementById('ta-tf-id');
      var el2 = document.getElementById('ta-tf-inp');
      if (el) el.value = '';
      if (el2) el2.value = '';
    }
    await _orig.call(this, id);
    // ถ้ามี patientId (เรียกจาก patient profile) ให้ pre-fill
    if (patientId && !id) {
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(patientId); });
        if (pat) {
          var idEl = document.getElementById('ta-tf-id');
          var inpEl = document.getElementById('ta-tf-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 150);
    }
  };
})();

// [2] saveWound — map recorder → created_by โดยไม่แตะ supa.from
// แก้ตรงใน row object ก่อนส่ง ด้วยการ patch document.getElementById ชั่วคราวสำหรับ recorder field
(function() {
  var _origSaveWound = window.saveWound;
  if (typeof _origSaveWound !== 'function') return;
  window.saveWound = async function() {
    // intercept เฉพาะ supa.from('patient_wounds') ด้วยวิธีที่ไม่ทำลาย chain
    var _origSupaFrom = supa.from.bind(supa);
    supa.from = function(table) {
      var qb = _origSupaFrom(table);
      if (table === 'patient_wounds') {
        // wrap insert
        var _qbInsert = qb.insert.bind(qb);
        qb.insert = function(data) {
          if (data && data.recorder !== undefined) {
            data = Object.assign({}, data, { created_by: data.recorder });
            delete data.recorder;
          }
          return _qbInsert(data);
        };
        // wrap update
        var _qbUpdate = qb.update.bind(qb);
        qb.update = function(data) {
          if (data && data.recorder !== undefined) {
            data = Object.assign({}, data, { created_by: data.recorder });
            delete data.recorder;
          }
          return _qbUpdate(data);
        };
      }
      return qb;
    };
    try {
      await _origSaveWound.apply(this, arguments);
    } finally {
      supa.from = _origSupaFrom;
    }
    // reload wound data
    try {
      var wr = await _origSupaFrom('patient_wounds').select('*').order('wound_date',{ascending:false});
      if (!wr.error && wr.data) db.wounds = wr.data.map(mapWound);
      // refresh patient profile tab ถ้าเปิดอยู่
      setTimeout(function(){ try { switchPatTab('incident'); } catch(e){} }, 300);
    } catch(e2) {}
  };
})();

// [3] openIncidentModal — detect patient UUID → เปิด add mode + pre-fill
(function() {
  var _orig = window.openIncidentModal;
  if (typeof _orig !== 'function') return;
  window.openIncidentModal = function(id) {
    if (id && (db.patients||[]).some(function(p){ return String(p.id)===String(id); })) {
      _orig.call(this); // เปิด add mode
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(id); });
        if (pat) {
          var idEl = document.getElementById('ta-inc-id');
          var inpEl = document.getElementById('ta-inc-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 100);
      return;
    }
    _orig.apply(this, arguments);
  };
})();

// [4] openWoundModal — detect patient UUID → เปิด add mode + pre-fill + fetch ก่อน edit
(function() {
  var _orig = window.openWoundModal;
  if (typeof _orig !== 'function') return;
  window.openWoundModal = async function(id) {
    if (id && (db.patients||[]).some(function(p){ return String(p.id)===String(id); })) {
      _orig.call(this); // เปิด add mode
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(id); });
        if (pat) {
          var idEl = document.getElementById('ta-wnd-id');
          var inpEl = document.getElementById('ta-wnd-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 100);
      return;
    }
    // edit mode — fetch ข้อมูลจาก Supabase ก่อน
    if (id) {
      try {
        var result = await supa.from('patient_wounds').select('*').eq('id', id).single();
        if (!result.error && result.data) {
          if (!db.wounds) db.wounds = [];
          var mapped = mapWound(result.data);
          var idx = db.wounds.findIndex(function(x){ return String(x.id)===String(id); });
          if (idx >= 0) db.wounds[idx] = mapped; else db.wounds.unshift(mapped);
        }
      } catch(e) {}
    }
    _orig.apply(this, arguments);
  };
})();

// [5] openDietModal — fetch ก่อน edit + รับ patientId
(function() {
  var _orig = window.openDietModal;
  if (typeof _orig !== 'function') return;
  window.openDietModal = async function(id, patientId) {
    if (id) {
      try {
        var result = await supa.from('patient_diets').select('*').eq('id', id).single();
        if (!result.error && result.data) {
          if (!db.diets) db.diets = [];
          var mapped = mapDiet(result.data);
          var idx = db.diets.findIndex(function(x){ return String(x.id)===String(id); });
          if (idx >= 0) db.diets[idx] = mapped; else db.diets.unshift(mapped);
        }
      } catch(e) {}
    }
    _orig.call(this, id);
    if (patientId && !id) {
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(patientId); });
        if (pat) {
          var idEl = document.getElementById('ta-diet-id');
          var inpEl = document.getElementById('ta-diet-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 150);
    }
  };
})();

// [6] _renderPatDietaryTab — patch ปุ่มให้ส่ง patientId
(function() {
  var _orig = window._renderPatDietaryTab;
  if (typeof _orig !== 'function') return;
  window._renderPatDietaryTab = function(pid, listEl) {
    _orig.call(this, pid, listEl);
    setTimeout(function() {
      var wrap = document.getElementById('pat-dietary-btns-'+pid);
      if (!wrap) return;
      var btns = wrap.querySelectorAll('button');
      if (btns[0]) { btns[0].onclick = function(){ openDietModal(null, pid); }; }
      if (btns[1]) { btns[1].onclick = function(){ openTubeFeedModal(null, pid); }; }
    }, 200);
  };
})();

// [7] saveDiet + saveTubeFeed — reload data หลัง save + refresh tab
(function() {
  var _origSaveDiet = window.saveDiet;
  if (typeof _origSaveDiet === 'function') {
    window.saveDiet = async function() {
      await _origSaveDiet.apply(this, arguments);
      try {
        var r = await supa.from('patient_diets').select('*').order('updated_at',{ascending:false});
        if (!r.error && r.data) { db.diets = r.data.map(mapDiet); }
        if (typeof renderDietaryPage === 'function') renderDietaryPage();
        setTimeout(function(){ try { switchPatTab('dietary'); } catch(e){} }, 300);
      } catch(e) {}
    };
  }
  var _origSaveTube = window.saveTubeFeed;
  if (typeof _origSaveTube === 'function') {
    window.saveTubeFeed = async function() {
      await _origSaveTube.apply(this, arguments);
      try {
        var r2 = await supa.from('tube_feedings').select('*').order('date',{ascending:false});
        if (!r2.error && r2.data) {
          db.tubeFeeds = r2.data.map(function(x){
            return { id:x.id, patientId:x.patient_id, patientName:x.patient_name,
              date:x.date, time:x.time, meal:x.meal, formula:x.formula,
              volume:x.volume, water:x.water, residual:x.residual,
              recorder:x.recorder, note:x.note };
          });
        }
        if (typeof renderTubeFeedTable === 'function') renderTubeFeedTable();
        setTimeout(function(){ try { switchPatTab('dietary'); } catch(e){} }, 300);
      } catch(e) {}
    };
  }
})();

// [8] openEditAllergyModal — fix params สลับกัน
(function() {
  var _orig = window.openEditAllergyModal;
  if (typeof _orig !== 'function') return;
  window.openEditAllergyModal = function(first, second) {
    var isUUID = function(s){ return typeof s === 'string' && s.length > 20 && s.includes('-'); };
    if (!isUUID(first) && isUUID(second)) {
      return _orig.call(this, second, first); // สลับกลับ
    }
    return _orig.apply(this, arguments);
  };
})();

// [9] saveIncident — refresh patient tab หลัง save
(function() {
  var _orig = window.saveIncident;
  if (typeof _orig !== 'function') return;
  window.saveIncident = async function() {
    await _orig.apply(this, arguments);
    try {
      db.incidentReports = db.incidents || db.incidentReports || [];
      setTimeout(function(){ try { switchPatTab('incident'); } catch(e){} }, 300);
    } catch(e) {}
  };
})();

console.log('[fix] v98 snippet loaded');


// ===== FIX v99: patient profile tabs — render ข้อมูลครบ + deleteAllergy params fix =====

// [1] deleteAllergy — params สลับ (eid, pid) แต่ fn รับ (patId, allergyId)
(function() {
  var _orig = window.deleteAllergy;
  if (typeof _orig !== 'function') return;
  window.deleteAllergy = function(first, second) {
    var isUUID = function(s){ return typeof s === 'string' && s.length > 20 && s.includes('-'); };
    if (!isUUID(first) && isUUID(second)) {
      return _orig.call(this, second, first); // สลับกลับ: patId, allergyId
    }
    return _orig.apply(this, arguments);
  };
})();

// [2] _renderPatIncidentTab — แสดงข้อมูลครบ (อุบัติเหตุ + แผลกดทับ)
(function() {
  var _orig = window._renderPatIncidentTab;
  if (typeof _orig !== 'function') return;
  window._renderPatIncidentTab = function(pid, listEl) {
    // เพิ่มปุ่มก่อน (เหมือนเดิม)
    if (!document.getElementById('pat-incident-btns-'+pid)) {
      var wrap = document.createElement('div');
      wrap.id = 'pat-incident-btns-'+pid;
      wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
      var b1 = document.createElement('button');
      b1.className = 'btn btn-primary btn-sm';
      b1.innerHTML = '⚠️ + อุบัติเหตุ';
      b1.onclick = function(){ openIncidentModal(pid); };
      var b2 = document.createElement('button');
      b2.className = 'btn btn-secondary btn-sm';
      b2.innerHTML = '🩹 + แผลกดทับ';
      b2.onclick = function(){ openWoundModal(pid); };
      wrap.appendChild(b1); wrap.appendChild(b2);
      listEl.parentNode.insertBefore(wrap, listEl);
    }
    listEl.innerHTML = '<div style="padding:20px;text-align:center">⏳ โหลด...</div>';
    Promise.all([
      supa.from('incident_reports').select('*').eq('patient_id', pid).order('date',{ascending:false}),
      supa.from('patient_wounds').select('*').eq('patient_id', pid).order('wound_date',{ascending:false})
    ]).then(function(rs) {
      var iD = rs[0].data || [], wD = rs[1].data || [];
      if (!iD.length && !wD.length) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</div>';
        return;
      }
      var frag = document.createDocumentFragment();

      // อุบัติเหตุ
      iD.forEach(function(x) {
        var d = document.createElement('div');
        d.className = 'card';
        d.style.cssText = 'margin-bottom:8px;padding:12px;';
        d.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:13px;">⚠️ ' + (x.type||'') + ' <span style="font-size:11px;color:var(--text3);">' + (x.date||'') + ' ' + (x.time||'') + '</span></div>' +
              '<div style="font-size:12px;margin-top:4px;color:var(--text2);">สถานที่: ' + (x.location||'-') + ' | ความรุนแรง: ' + (x.severity||'-') + ' | แจ้ง: ' + (x.notified||'-') + '</div>' +
              '<div style="font-size:13px;margin-top:4px;">' + (x.detail||'') + '</div>' +
              (x.first_aid ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;">การปฐมพยาบาล: ' + x.first_aid + '</div>' : '') +
              '<div style="font-size:11px;color:var(--text3);margin-top:2px;">ผู้บันทึก: ' + (x.recorder||'-') + '</div>' +
              (x.photo_url ? '<div style="margin-top:8px;"><img src="' + x.photo_url + '" style="max-width:160px;max-height:120px;border-radius:6px;object-fit:cover;border:1px solid var(--border);" loading="lazy"></div>' : '') +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">' +
              '<button class="btn btn-ghost btn-sm" data-inc-id="'+x.id+'">✏️</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:#c0392b;" data-inc-del="'+x.id+'">🗑️</button>' +
            '</div>' +
          '</div>';
        d.querySelector('[data-inc-id]').addEventListener('click', function(){ openIncidentModal(this.dataset.incId); });
        d.querySelector('[data-inc-del]').addEventListener('click', function(){
          var id = this.dataset.incDel;
          if (!confirm('ลบรายการนี้?')) return;
          supa.from('incident_reports').delete().eq('id', id).then(function(){
            switchPatTab('incident'); toast('ลบแล้ว','success');
          });
        });
        frag.appendChild(d);
      });

      // แผลกดทับ
      wD.forEach(function(x) {
        var d = document.createElement('div');
        d.className = 'card';
        d.style.cssText = 'margin-bottom:8px;padding:12px;border-left:3px solid #e67e22;';
        d.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:13px;">🩹 ' + (x.location||'') + ' Stage ' + (x.stage||'') + ' <span style="font-size:11px;color:var(--text3);">' + (x.wound_date||'') + '</span></div>' +
              (x.size_cm ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;">ขนาด: ' + x.size_cm + ' cm</div>' : '') +
              (x.appearance ? '<div style="font-size:12px;margin-top:2px;">ลักษณะ: ' + x.appearance + '</div>' : '') +
              (x.dressing ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;">การรักษา: ' + x.dressing + '</div>' : '') +
              '<div style="font-size:11px;color:var(--text3);margin-top:2px;">สถานะ: ' + (x.status||'-') + ' | ผู้บันทึก: ' + (x.created_by||'-') + '</div>' +
              (x.photo_url ? '<div style="margin-top:8px;"><img src="' + x.photo_url + '" style="max-width:160px;max-height:120px;border-radius:6px;object-fit:cover;border:1px solid var(--border);" loading="lazy"></div>' : '') +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">' +
              '<button class="btn btn-ghost btn-sm" data-wnd-id="'+x.id+'">✏️</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:#c0392b;" data-wnd-del="'+x.id+'">🗑️</button>' +
            '</div>' +
          '</div>';
        d.querySelector('[data-wnd-id]').addEventListener('click', function(){ openWoundModal(this.dataset.wndId); });
        d.querySelector('[data-wnd-del]').addEventListener('click', function(){
          var id = this.dataset.wndDel;
          if (!confirm('ลบรายการนี้?')) return;
          supa.from('patient_wounds').delete().eq('id', id).then(function(){
            switchPatTab('incident'); toast('ลบแล้ว','success');
          });
        });
        frag.appendChild(d);
      });

      listEl.innerHTML = ''; listEl.appendChild(frag);
    });
  };
})();

// [3] _renderPatDietaryTab — แสดงข้อมูลครบ (โภชนาการ + สายให้อาหาร)
(function() {
  var _orig = window._renderPatDietaryTab;
  if (typeof _orig !== 'function') return;
  window._renderPatDietaryTab = function(pid, listEl) {
    if (!document.getElementById('pat-dietary-btns-'+pid)) {
      var wrap = document.createElement('div');
      wrap.id = 'pat-dietary-btns-'+pid;
      wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
      var b1 = document.createElement('button');
      b1.className = 'btn btn-primary btn-sm';
      b1.textContent = '🍽️ + กำหนดอาหาร';
      b1.onclick = function(){ openDietModal(null, pid); };
      var b2 = document.createElement('button');
      b2.className = 'btn btn-secondary btn-sm';
      b2.textContent = '🧪 + สายให้อาหาร';
      b2.onclick = function(){ openTubeFeedModal(null, pid); };
      wrap.appendChild(b1); wrap.appendChild(b2);
      listEl.parentNode.insertBefore(wrap, listEl);
    }
    listEl.innerHTML = '<div style="padding:20px;text-align:center">⏳ โหลด...</div>';
    Promise.all([
      supa.from('patient_diets').select('*').eq('patient_id', pid).order('updated_at',{ascending:false}),
      supa.from('tube_feedings').select('*').eq('patient_id', pid).order('created_at',{ascending:false})
    ]).then(function(rs) {
      var dD = rs[0].data || [], tD = rs[1].data || [];
      if (!dD.length && !tD.length) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</div>';
        return;
      }
      var frag = document.createDocumentFragment();

      // โภชนาการ
      dD.forEach(function(x) {
        var restrictions = [];
        try { restrictions = Array.isArray(x.restrictions) ? x.restrictions : JSON.parse(x.restrictions||'[]'); } catch(e){}
        var d = document.createElement('div');
        d.className = 'card';
        d.style.cssText = 'margin-bottom:8px;padding:12px;';
        d.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:13px;">🍽️ ' + (x.diet_type||'') + ' | ' + (x.meals||'3 มื้อ') + '</div>' +
              (restrictions.length ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;">ข้อจำกัด: ' + restrictions.join(', ') + '</div>' : '') +
              (x.calories ? '<div style="font-size:12px;color:var(--text2);margin-top:2px;">แคลอรี: ' + x.calories + ' kcal' + (x.protein ? ' | โปรตีน: ' + x.protein + 'g' : '') + '</div>' : '') +
              (x.note ? '<div style="font-size:12px;margin-top:2px;">หมายเหตุ: ' + x.note + '</div>' : '') +
              '<div style="font-size:11px;color:var(--text3);margin-top:2px;">ผู้บันทึก: ' + (x.recorder||'-') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">' +
              '<button class="btn btn-ghost btn-sm" data-diet-id="'+x.id+'">✏️</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:#c0392b;" data-diet-del="'+x.id+'">🗑️</button>' +
            '</div>' +
          '</div>';
        d.querySelector('[data-diet-id]').addEventListener('click', function(){ openDietModal(this.dataset.dietId); });
        d.querySelector('[data-diet-del]').addEventListener('click', function(){
          var id = this.dataset.dietDel;
          if (!confirm('ลบรายการนี้?')) return;
          supa.from('patient_diets').delete().eq('id', id).then(function(){
            switchPatTab('dietary'); toast('ลบแล้ว','success');
          });
        });
        frag.appendChild(d);
      });

      // สายให้อาหาร
      tD.forEach(function(x) {
        var d = document.createElement('div');
        d.className = 'card';
        d.style.cssText = 'margin-bottom:8px;padding:12px;border-left:3px solid #27ae60;';
        d.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:13px;">🧪 สายให้อาหาร | ' + (x.date||'') + ' ' + (x.time||'') + ' (' + (x.meal||'') + ')</div>' +
              '<div style="font-size:12px;color:var(--text2);margin-top:2px;">สูตร: ' + (x.formula||'-') + ' | ปริมาณ: ' + (x.volume||0) + ' ml | น้ำตาม: ' + (x.water||0) + ' ml | Residual: ' + (x.residual||0) + ' ml</div>' +
              (x.note ? '<div style="font-size:12px;margin-top:2px;">หมายเหตุ: ' + x.note + '</div>' : '') +
              '<div style="font-size:11px;color:var(--text3);margin-top:2px;">ผู้บันทึก: ' + (x.recorder||'-') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">' +
              '<button class="btn btn-ghost btn-sm" data-tube-id="'+x.id+'">✏️</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:#c0392b;" data-tube-del="'+x.id+'">🗑️</button>' +
            '</div>' +
          '</div>';
        d.querySelector('[data-tube-id]').addEventListener('click', function(){ openTubeFeedModal(this.dataset.tubeId); });
        d.querySelector('[data-tube-del]').addEventListener('click', function(){
          var id = this.dataset.tubeDel;
          if (!confirm('ลบรายการนี้?')) return;
          supa.from('tube_feedings').delete().eq('id', id).then(function(){
            switchPatTab('dietary'); toast('ลบแล้ว','success');
          });
        });
        frag.appendChild(d);
      });

      listEl.innerHTML = ''; listEl.appendChild(frag);
    });
  };
})();

console.log('[fix] v99 snippet loaded');


// ===== FIX v100: Clear fields on Add / Populate on Edit — all modals =====

// Utility: clear user-input fields ใน modal (ยกเว้น keepIds)
function _clearModalFields(modalId, keepIds) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  var keep = keepIds || [];
  Array.from(modal.querySelectorAll('input,textarea,select')).forEach(function(el) {
    if (!el.id || keep.indexOf(el.id) >= 0) return;
    if (el.type === 'hidden' || el.type === 'file') return;
    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = false; return; }
    // select — reset to first option
    if (el.tagName === 'SELECT') { if (el.options.length > 0) el.selectedIndex = 0; return; }
    el.value = '';
  });
}

// Utility: set default fields
function _setModalDefaults(fields) {
  var today = new Date().toISOString().split('T')[0];
  var now = new Date().toTimeString().slice(0,5);
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  fields.forEach(function(f) {
    var el = document.getElementById(f.id);
    if (!el) return;
    var val = f.value === '__today__' ? today : f.value === '__now__' ? now : f.value === '__user__' ? user : f.value;
    el.value = val;
  });
}

// ===== INCIDENT =====
(function() {
  var _orig = window.openIncidentModal;
  if (typeof _orig !== 'function') return;
  window.openIncidentModal = function(id) {
    // detect patient UUID = add from profile
    if (id && (db.patients||[]).some(function(p){ return String(p.id)===String(id); })) {
      _orig.call(this); // เปิด add mode (original clear)
      _clearModalFields('modal-incident', ['incident-date','incident-time','incident-recorder']);
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(id); });
        if (pat) {
          var idEl = document.getElementById('ta-inc-id');
          var inpEl = document.getElementById('ta-inc-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 100);
      return;
    }
    // add mode (no id) — clear user fields
    if (!id) {
      _clearModalFields('modal-incident', ['incident-date','incident-time','incident-recorder']);
      _setModalDefaults([
        {id:'incident-date', value:'__today__'},
        {id:'incident-time', value:'__now__'},
        {id:'incident-recorder', value:'__user__'}
      ]);
    }
    _orig.apply(this, arguments);
  };
})();

// ===== WOUND =====
(function() {
  var _orig = window.openWoundModal;
  if (typeof _orig !== 'function') return;
  window.openWoundModal = async function(id) {
    if (id && (db.patients||[]).some(function(p){ return String(p.id)===String(id); })) {
      _orig.call(this);
      _clearModalFields('modal-wound', ['wound-date','wound-recorder']);
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(id); });
        if (pat) {
          var idEl = document.getElementById('ta-wnd-id');
          var inpEl = document.getElementById('ta-wnd-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 100);
      return;
    }
    if (!id) {
      _clearModalFields('modal-wound', ['wound-date','wound-recorder']);
      _setModalDefaults([{id:'wound-date',value:'__today__'},{id:'wound-recorder',value:'__user__'}]);
    }
    if (id) {
      try {
        var result = await supa.from('patient_wounds').select('*').eq('id', id).single();
        if (!result.error && result.data) {
          if (!db.wounds) db.wounds = [];
          var mapped = mapWound(result.data);
          var idx2 = db.wounds.findIndex(function(x){ return String(x.id)===String(id); });
          if (idx2 >= 0) db.wounds[idx2] = mapped; else db.wounds.unshift(mapped);
        }
      } catch(e) {}
    }
    _orig.apply(this, arguments);
  };
})();

// ===== DIET =====
(function() {
  var _orig = window.openDietModal;
  if (typeof _orig !== 'function') return;
  window.openDietModal = async function(id, patientId) {
    if (!id) _clearModalFields('modal-diet', ['diet-type','diet-meals']);
    if (id) {
      try {
        var result = await supa.from('patient_diets').select('*').eq('id', id).single();
        if (!result.error && result.data) {
          if (!db.diets) db.diets = [];
          var mapped = mapDiet(result.data);
          var idx2 = db.diets.findIndex(function(x){ return String(x.id)===String(id); });
          if (idx2 >= 0) db.diets[idx2] = mapped; else db.diets.unshift(mapped);
        }
      } catch(e) {}
    }
    _orig.call(this, id);
    if (patientId && !id) {
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(patientId); });
        if (pat) {
          var idEl = document.getElementById('ta-diet-id');
          var inpEl = document.getElementById('ta-diet-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 150);
    }
  };
})();

// ===== TUBE FEED =====
(function() {
  var _orig = window.openTubeFeedModal;
  if (typeof _orig !== 'function') return;
  window.openTubeFeedModal = async function(id, patientId) {
    if (!id) {
      var el = document.getElementById('ta-tf-id');
      var el2 = document.getElementById('ta-tf-inp');
      if (el) el.value = '';
      if (el2) el2.value = '';
      _clearModalFields('modal-tubefeed', ['tubefeed-date','tubefeed-time','tubefeed-recorder']);
      _setModalDefaults([{id:'tubefeed-date',value:'__today__'},{id:'tubefeed-recorder',value:'__user__'}]);
    }
    await _orig.call(this, id);
    if (patientId && !id) {
      setTimeout(function() {
        var pat = (db.patients||[]).find(function(p){ return String(p.id)===String(patientId); });
        if (pat) {
          var idEl = document.getElementById('ta-tf-id');
          var inpEl = document.getElementById('ta-tf-inp');
          if (idEl) idEl.value = pat.id;
          if (inpEl) inpEl.value = pat.name;
        }
      }, 150);
    }
  };
})();

// ===== APPT =====
(function() {
  var _orig = window.openApptModal;
  if (typeof _orig !== 'function') return;
  window.openApptModal = function(id) {
    if (!id) _clearModalFields('modal-appt', ['appt-date','appt-status']);
    if (!id) _setModalDefaults([{id:'appt-date',value:'__today__'}]);
    _orig.apply(this, arguments);
  };
})();

// ===== ADD VITAL =====
(function() {
  var _orig = window.openAddVitalModal;
  if (typeof _orig !== 'function') return;
  window.openAddVitalModal = function(patientId) {
    _clearModalFields('modal-add-vital', ['vital-time','vital-by']);
    _setModalDefaults([{id:'vital-time',value:'__now__'},{id:'vital-by',value:'__user__'}]);
    _orig.apply(this, arguments);
  };
})();

// ===== ADD MED =====
(function() {
  var _orig = window.openAddMedModal;
  if (typeof _orig !== 'function') return;
  window.openAddMedModal = function(patientId) {
    _clearModalFields('modal-add-medication', ['med-unit','med-route']);
    _orig.apply(this, arguments);
  };
})();

// ===== ADD LAB =====
(function() {
  var _orig = window.openAddLabModal;
  if (typeof _orig !== 'function') return;
  window.openAddLabModal = function(patientId) {
    _clearModalFields('modal-add-lab', ['lab-test-date']);
    _setModalDefaults([{id:'lab-test-date',value:'__today__'}]);
    _orig.apply(this, arguments);
  };
})();

// ===== EXPENSE =====
(function() {
  var _orig = window.openExpenseModal;
  if (typeof _orig !== 'function') return;
  window.openExpenseModal = function(id) {
    if (!id) _clearModalFields('modal-expense', ['exp-date','exp-preparer','exp-wht-rate']);
    if (!id) _setModalDefaults([{id:'exp-date',value:'__today__'},{id:'exp-preparer',value:'__user__'}]);
    _orig.apply(this, arguments);
  };
})();

// ===== ADD ALLERGY =====
(function() {
  var _orig = window.openAddAllergyModal;
  if (typeof _orig !== 'function') return;
  window.openAddAllergyModal = function(patId) {
    _clearModalFields('modal-add-allergy', ['allergy-type','allergy-severity']);
    _orig.apply(this, arguments);
  };
})();

// ===== BELONGING (add only) =====
(function() {
  var _orig = window.openBelongingModal;
  if (typeof _orig !== 'function') return;
  window.openBelongingModal = function(id, patientId) {
    if (!id) {
      _clearModalFields('modal-belonging', ['belonging-condition','belonging-date-in','belonging-received-by']);
      _setModalDefaults([{id:'belonging-date-in',value:'__today__'},{id:'belonging-received-by',value:'__user__'}]);
    }
    _orig.apply(this, arguments);
  };
})();

console.log('[fix] v100 snippet loaded');
})();