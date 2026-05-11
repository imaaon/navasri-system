
// ═══════════════════════════════════════════════════════════════
// VITAL SIGNS — Multi-row chip selector modal (ใหม่)
// ═══════════════════════════════════════════════════════════════
// 5 chips lock: BP, HR, Temp, SpO₂, RR
// 3 chips optional: DTX, น้ำหนัก, ส่วนสูง
// "อาการ/หมายเหตุ" textarea — เอา other_fields ออก
// Multi-row: shared = วันที่ · per-row = เวลา + chips + values + textarea
// ═══════════════════════════════════════════════════════════════

var _VITAL_CHIPS = [
  { key: 'bp',     icon: '🩸', label: 'ความดัน',  color: '#e74c3c', unit: 'mmHg', double: true, locked: true,  fields: ['bp_sys','bp_dia'] },
  { key: 'hr',     icon: '💓', label: 'ชีพจร',    color: '#3498db', unit: 'bpm',  locked: true,  fields: ['hr'] },
  { key: 'temp',   icon: '🌡️', label: 'อุณหภูมิ', color: '#e67e22', unit: '°C',   locked: true,  fields: ['temp'], step: '0.1' },
  { key: 'spo2',   icon: '🫁', label: 'SpO₂',     color: '#27ae60', unit: '%',    locked: true,  fields: ['spo2'] },
  { key: 'rr',     icon: '🫀', label: 'RR',       color: '#16a085', unit: '/min', locked: true,  fields: ['rr'] },
  { key: 'dtx',    icon: '🍬', label: 'DTX',      color: '#8e44ad', unit: 'mg/dL',locked: false, fields: ['dtx'] },
  { key: 'weight', icon: '⚖️', label: 'น้ำหนัก',  color: '#7f8c8d', unit: 'กก.',  locked: false, fields: ['weight'], step: '0.1' },
  { key: 'height', icon: '📏', label: 'ส่วนสูง',  color: '#7f8c8d', unit: 'ซม.',  locked: false, fields: ['height'], step: '0.1' }
];

function _openVitalModal(rec, patientId, pid) {
  var isEdit = !!rec;
  var todayStr = new Date().toISOString().slice(0,10);
  var nowStr = new Date().toTimeString().slice(0,5);
  var sharedDate = isEdit && rec.recordedAt ? rec.recordedAt.slice(0,10) : todayStr;
  var initTime = isEdit && rec.recordedAt ? rec.recordedAt.slice(11,16) : nowStr;

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:18px;width:520px;max-width:95vw;max-height:92vh;overflow-y:auto;';

  var h3 = document.createElement('div');
  h3.style.cssText = 'font-size:16px;font-weight:700;color:var(--accent2);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);';
  h3.textContent = isEdit ? '📊 แก้ไขสัญญาณชีพ' : '📊 บันทึกสัญญาณชีพ';
  modal.appendChild(h3);

  // Shared header (วันที่)
  var sharedSec = document.createElement('div');
  sharedSec.className = 'mr-shared';
  var sharedLabel = document.createElement('div');
  sharedLabel.className = 'mr-shared-label';
  sharedLabel.textContent = '📍 วันที่ (ใช้กับทุกรายการ)';
  sharedSec.appendChild(sharedLabel);
  var inpDate = document.createElement('input');
  inpDate.type = 'date'; inpDate.value = sharedDate; inpDate.className = 'form-control';
  inpDate.style.cssText = 'height:44px;font-size:14px;';
  sharedSec.appendChild(inpDate);
  modal.appendChild(sharedSec);

  var rowsContainer = document.createElement('div');
  modal.appendChild(rowsContainer);

  var rows = [];

  function _renumberBadges() {
    rows.forEach(function(r, i) {
      if (r.badgeEl) r.badgeEl.textContent = (r.kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (i + 1);
    });
  }

  function _createRowUI(opts) {
    var kind = opts.kind || 'new';
    var dbRow = opts.dbRow || null;

    // initial activeChips - default 5 lock
    var activeChips = { bp:true, hr:true, temp:true, spo2:true, rr:true };
    var initValues = {};
    var initTimeR = (kind === 'new') ? new Date().toTimeString().slice(0,5) : (initTime || nowStr);
    var initNote = '';

    if (dbRow) {
      // edit mode: chip ติด ✓ ตาม field ที่มีค่า
      activeChips = {};
      _VITAL_CHIPS.forEach(function(c) {
        var has = c.fields.some(function(f) {
          var v = dbRow[f] !== undefined ? dbRow[f] : dbRow[_camel(f)];
          return v !== null && v !== '' && v !== undefined;
        });
        if (has || c.locked) activeChips[c.key] = true;
      });
      _VITAL_CHIPS.forEach(function(c) {
        c.fields.forEach(function(f) {
          var v = dbRow[f] !== undefined ? dbRow[f] : dbRow[_camel(f)];
          if (v !== null && v !== undefined) initValues[f] = v;
        });
      });
      initTimeR = dbRow.recordedAt ? dbRow.recordedAt.slice(11,16) : initTimeR;
      initNote = dbRow.note || '';
    }

    var rowEl = document.createElement('div');
    rowEl.className = 'mr-item' + (kind === 'edit' ? ' editing' : (rows.length > 0 ? ' new-row' : ''));
    rowEl.style.cssText = 'background:#fff;';

    var badge = document.createElement('div');
    badge.className = 'mr-badge' + (kind === 'edit' ? ' editing' : (kind === 'new' && rows.length > 0 ? ' new-row' : ''));
    badge.textContent = (kind === 'edit' ? '📝 แก้ไข ' : 'รายการ ') + (rows.length + 1);
    rowEl.appendChild(badge);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mr-del';
    delBtn.textContent = '✕';
    delBtn.style.display = 'none';
    delBtn.addEventListener('click', function() {
      var idx = rows.indexOf(rowState);
      if (idx >= 0) {
        rows.splice(idx, 1);
        rowEl.parentNode.removeChild(rowEl);
        _renumberBadges();
        _updateDelButtons();
        _updateSaveBtnText();
      }
    });
    rowEl.appendChild(delBtn);

    // Time row
    var timeHeader = document.createElement('div');
    timeHeader.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;margin:8px 0 10px 0;padding-bottom:8px;border-bottom:1px dashed var(--border);';
    var timeLbl = document.createElement('span');
    timeLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap;';
    timeLbl.textContent = '🕐 เวลา';
    var inpTime = document.createElement('input');
    inpTime.type = 'time'; inpTime.value = initTimeR; inpTime.className = 'form-control';
    inpTime.style.cssText = 'height:40px;font-size:14px;';
    var btnNowR = document.createElement('button');
    btnNowR.type = 'button';
    btnNowR.className = 'btn-now';
    btnNowR.style.cssText = 'height:40px;font-size:11px;padding:0 10px;';
    btnNowR.textContent = 'ตอนนี้';
    btnNowR.addEventListener('click', function() {
      inpTime.value = new Date().toTimeString().slice(0,5);
    });
    timeHeader.appendChild(timeLbl);
    timeHeader.appendChild(inpTime);
    timeHeader.appendChild(btnNowR);
    rowEl.appendChild(timeHeader);

    // Vital chips selector
    var chipsLbl = document.createElement('div');
    chipsLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;';
    chipsLbl.innerHTML = 'ค่าที่จะวัด <span style="color:var(--text3);font-weight:400;font-size:10px;">(แตะเพื่อเปิด/ปิด)</span>';
    rowEl.appendChild(chipsLbl);

    var chipsContainer = document.createElement('div');
    chipsContainer.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;';

    var valueFieldsContainer = document.createElement('div');

    var chipEls = {};
    var valueWrappers = {};
    var valueInputs = {};

    _VITAL_CHIPS.forEach(function(c) {
      var chip = document.createElement('div');
      chip.className = 'type-chip' + (activeChips[c.key] ? ' active' : '');
      chip.style.cssText = 'border-radius:8px;';
      chip.innerHTML = '<span class="icon">' + c.icon + '</span><span>' + c.label + '</span>';
      chip.addEventListener('click', function() {
        if (activeChips[c.key]) {
          delete activeChips[c.key];
          chip.classList.remove('active');
        } else {
          activeChips[c.key] = true;
          chip.classList.add('active');
        }
        if (valueWrappers[c.key]) {
          valueWrappers[c.key].style.display = activeChips[c.key] ? '' : 'none';
        }
      });
      chipsContainer.appendChild(chip);
      chipEls[c.key] = chip;
    });
    rowEl.appendChild(chipsContainer);

    // Value field for each chip (showing only active ones)
    _VITAL_CHIPS.forEach(function(c) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'background:#fafbfc;border-radius:8px;padding:10px;margin-bottom:6px;border-left:3px solid ' + c.color + ';';
      wrap.style.display = activeChips[c.key] ? '' : 'none';

      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text);';
      header.innerHTML = '<span style="color:' + c.color + ';">' + c.icon + '</span> ' + c.label;
      wrap.appendChild(header);

      if (c.double) {
        // BP: SYS / DIA
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
        c.fields.forEach(function(fn, idx) {
          var fwrap = document.createElement('div');
          var fl = document.createElement('div');
          fl.style.cssText = 'font-size:10px;color:var(--text3);margin-bottom:3px;';
          fl.textContent = (idx === 0 ? 'SYS' : 'DIA');
          fwrap.appendChild(fl);
          var iwrap = document.createElement('div');
          iwrap.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center;';
          var inp = document.createElement('input');
          inp.type = 'number';
          inp.setAttribute('inputmode','numeric');
          inp.className = 'form-control';
          inp.style.cssText = 'height:44px;padding:0 10px;font-size:16px;font-weight:600;';
          inp.placeholder = (idx === 0 ? '120' : '80');
          if (initValues[fn] !== undefined) inp.value = initValues[fn];
          var unit = document.createElement('span');
          unit.style.cssText = 'font-size:11px;color:var(--text3);padding-left:2px;';
          unit.textContent = c.unit;
          iwrap.appendChild(inp);
          iwrap.appendChild(unit);
          fwrap.appendChild(iwrap);
          grid.appendChild(fwrap);
          valueInputs[fn] = inp;
        });
        wrap.appendChild(grid);
      } else {
        // Single field
        var iwrap2 = document.createElement('div');
        iwrap2.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center;';
        var inp2 = document.createElement('input');
        inp2.type = 'number';
        inp2.setAttribute('inputmode', c.step ? 'decimal' : 'numeric');
        if (c.step) inp2.step = c.step;
        inp2.className = 'form-control';
        inp2.style.cssText = 'height:44px;padding:0 10px;font-size:16px;font-weight:600;';
        if (initValues[c.fields[0]] !== undefined) inp2.value = initValues[c.fields[0]];
        var unit2 = document.createElement('span');
        unit2.style.cssText = 'font-size:11px;color:var(--text3);padding-left:2px;';
        unit2.textContent = c.unit;
        iwrap2.appendChild(inp2);
        iwrap2.appendChild(unit2);
        wrap.appendChild(iwrap2);
        valueInputs[c.fields[0]] = inp2;
      }

      valueFieldsContainer.appendChild(wrap);
      valueWrappers[c.key] = wrap;
    });

    rowEl.appendChild(valueFieldsContainer);

    // อาการ/หมายเหตุ
    var noteWrap = document.createElement('div');
    noteWrap.style.cssText = 'margin-top:10px;';
    var noteLbl = document.createElement('div');
    noteLbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;';
    noteLbl.textContent = '📝 อาการ/หมายเหตุ';
    var inpNote = document.createElement('textarea');
    inpNote.rows = 3;
    inpNote.className = 'form-control';
    inpNote.style.cssText = 'min-height:80px;padding:8px 10px;font-size:14px;font-family:inherit;resize:vertical;';
    inpNote.placeholder = 'อาการที่สังเกต / หมายเหตุพิเศษ';
    inpNote.value = initNote;
    noteWrap.appendChild(noteLbl);
    noteWrap.appendChild(inpNote);
    rowEl.appendChild(noteWrap);

    var rowState = {
      kind: kind,
      dbRow: dbRow,
      container: rowEl,
      badgeEl: badge,
      delBtn: delBtn,
      getValues: function() {
        var data = { recorded_at: null, note: (inpNote.value || '').trim() || null };
        // Field values for active chips only — inactive chips → null
        _VITAL_CHIPS.forEach(function(c) {
          c.fields.forEach(function(f) {
            if (activeChips[c.key] && valueInputs[f]) {
              var v = valueInputs[f].value;
              data[f] = (v === '' || v === null || v === undefined) ? null : parseFloat(v);
            } else {
              data[f] = null;
            }
          });
        });
        // datetime: combine sharedDate + this row's time
        var t = inpTime.value || '00:00';
        if (inpDate.value && t) {
          var d = new Date(inpDate.value + 'T' + t + ':00');
          if (!isNaN(d.getTime())) {
            data.recorded_at = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
          }
        }
        return data;
      }
    };

    return rowState;
  }

  function _addRow(opts) {
    var rs = _createRowUI(opts || {});
    rows.push(rs);
    rowsContainer.appendChild(rs.container);
    _renumberBadges();
    _updateDelButtons();
    _updateSaveBtnText();
    return rs;
  }

  function _updateDelButtons() {
    rows.forEach(function(r) {
      r.delBtn.style.display = (rows.length === 1) ? 'none' : '';
    });
  }

  function _updateSaveBtnText() {
    var editCount = rows.filter(function(r){ return r.kind === 'edit'; }).length;
    var newCount = rows.filter(function(r){ return r.kind === 'new'; }).length;
    var parts = [];
    if (editCount > 0) parts.push(editCount + ' แก้');
    if (newCount > 0) parts.push(newCount + ' ใหม่');
    if (typeof btnSave !== 'undefined' && btnSave) btnSave.textContent = '💾 บันทึก (' + parts.join(' + ') + ')';
  }

  // Initial rows
  if (isEdit) _addRow({ kind:'edit', dbRow: rec });
  else _addRow({ kind:'new' });

  // ปุ่มเพิ่มรายการ
  var btnAddRow = document.createElement('button');
  btnAddRow.type = 'button';
  btnAddRow.className = 'mr-add-row';
  btnAddRow.textContent = '➕ เพิ่มการวัดอีกเวลา';
  btnAddRow.addEventListener('click', function() { _addRow({ kind:'new' }); });
  modal.appendChild(btnAddRow);

  // ปุ่มล่างสุด
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-ghost';
  btnCancel.style.cssText = 'flex:1;height:44px;font-size:14px;';
  btnCancel.textContent = 'ยกเลิก';
  var btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.style.cssText = 'flex:1;height:44px;font-size:14px;font-weight:600;';
  btnSave.textContent = '💾 บันทึก';
  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnSave);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _updateSaveBtnText();

  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  // Save logic
  btnSave.addEventListener('click', async function() {
    if (!inpDate.value) { toast('กรุณาเลือกวันที่','warning'); return; }
    var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';

    var operations = [];
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i].getValues();
      if (!v.recorded_at) {
        toast('รายการ ' + (i+1) + ': กรุณาระบุเวลา', 'warning');
        return;
      }
      var vitalFields = ['bp_sys','bp_dia','hr','temp','spo2','dtx','rr','weight','height'];
      var hasVital = vitalFields.some(function(f) { return v[f] !== null; });
      var hasText = !!v.note;
      if (!hasVital && !hasText) {
        toast('รายการ ' + (i+1) + ': กรุณาระบุค่าสัญญาณชีพอย่างน้อย 1 ค่า หรือบันทึกหมายเหตุ','warning');
        return;
      }
      operations.push({ rowState: rows[i], data: v });
    }

    btnSave.disabled = true;
    btnSave.textContent = 'กำลังบันทึก...';

    var results = await Promise.allSettled(operations.map(function(op) {
      var payload = Object.assign({ patient_id: patientId, recorded_by: user, other_fields: '' }, op.data);
      if (op.rowState.kind === 'edit' && op.rowState.dbRow) {
        return supa.from('vital_signs').update(payload).eq('id', op.rowState.dbRow.id).select().single().then(function(r) {
          if (r.error) throw r.error;
          if (db.vitalSigns[pid]) {
            db.vitalSigns[pid] = db.vitalSigns[pid].map(function(x) {
              return String(x.id) === String(op.rowState.dbRow.id) ? mapVitalSign(r.data) : x;
            });
          }
          return r;
        });
      } else {
        return supa.from('vital_signs').insert(payload).select().single().then(function(r) {
          if (r.error) throw r.error;
          if (!db.vitalSigns[pid]) db.vitalSigns[pid] = [];
          db.vitalSigns[pid].unshift(mapVitalSign(r.data));
          return r;
        });
      }
    }));

    var fails = results.filter(function(r){ return r.status === 'rejected'; });
    if (fails.length > 0) {
      toast('บันทึกไม่สำเร็จ ' + fails.length + ' รายการ: ' + (fails[0].reason.message || fails[0].reason), 'error');
      btnSave.disabled = false;
      _updateSaveBtnText();
      return;
    }

    toast('บันทึกแล้ว ' + results.length + ' รายการ', 'success');
    close();
    var tabEl = document.getElementById('patprofile-tab-vitals');
    if (tabEl) tabEl.innerHTML = renderVitalsTab(pid, patientId);
  });
}

// Helper: snake_case → camelCase (สำหรับ db.vitalSigns ที่ใช้ otherFields แทน other_fields)
function _camel(s) { return s.replace(/_([a-z])/g, function(_, c){ return c.toUpperCase(); }); }

function openAddVitalModal(patientId) {
  // ค้นหา pid (key ใน db.vitalSigns) จาก patientId
  var pid = String(patientId);
  _openVitalModal(null, patientId, pid);
}

async function openEditVitalModal(patientId, pid, vitalId) {
  var vitals = db.vitalSigns[pid] || [];
  var v = vitals.find(function(x) { return x.id == vitalId; });
  if (!v) { toast('ไม่พบรายการที่ต้องการแก้ไข','error'); return; }
  _openVitalModal(v, patientId, pid);
}

// Legacy stub — saveVitalSign ถูกแทนที่ด้วย save logic ใน _openVitalModal
// เก็บไว้ในกรณีมี HTML เก่าเรียกใช้
async function saveVitalSign() {
  console.warn('[vitals] saveVitalSign() is deprecated — use new _openVitalModal');
}

// ===== CLINICAL: VITALS + NURSING NOTES =====

// ===== VITAL SIGNS ========================
// ==========================================
function renderVitalsTab(pid, patientId, overrideFrom, overrideTo) {
  const allVitals = (db.vitalSigns[pid]||[]);  // ใช้สำหรับ chart sparkline ไม่กระทบ filter
  const recent7 = allVitals.slice(0, 14);

  // Mini chart data — last 14 records (ไม่กระทบ filter)
  const chartData = [...recent7].reverse();
  const bpPoints = chartData.map(v => v.bp_sys ? `${v.bp_sys}/${v.bp_dia}` : '-');
  const hrPoints = chartData.map(v => v.hr||'-');
  const spo2Points = chartData.map(v => v.spo2||'-');
  const labels  = chartData.map(v => v.recordedAt ? new Date(new Date(v.recordedAt).getTime() - new Date(v.recordedAt).getTimezoneOffset()*60000).toISOString().slice(5,10) : '');

  const svgBP = vitalsSparkline(chartData.map(v=>v.bp_sys), '#e74c3c', 120, 180);
  const svgHR = vitalsSparkline(chartData.map(v=>v.hr), '#3498db', 50, 100);
  const svgSpo2 = vitalsSparkline(chartData.map(v=>v.spo2), '#27ae60', 90, 100);

  // Date range filter — default = today
  const today = new Date().toISOString().split('T')[0];
  // ถ้ามี override (จาก preset) ใช้ค่าที่ส่งมา; ถ้า re-render จาก onchange อ่านจาก DOM
  let fromDate, toDate;
  if (overrideFrom && overrideTo) {
    fromDate = overrideFrom;
    toDate = overrideTo;
  } else {
    fromDate = document.getElementById('vital-filter-from')?.value || today;
    toDate   = document.getElementById('vital-filter-to')?.value   || today;
    if (fromDate > toDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; }
  }

  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📊 แนวโน้มสัญญาณชีพ (14 ครั้งล่าสุด)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;">
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#e74c3c;margin-bottom:4px;">🩸 ความดันโลหิต (mmHg)</div>
          ${svgBP}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${allVitals[0]?.bp_sys ? allVitals[0].bp_sys+'/'+allVitals[0].bp_dia : '-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#3498db;margin-bottom:4px;">💓 ชีพจร (bpm)</div>
          ${svgHR}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${allVitals[0]?.hr||'-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#27ae60;margin-bottom:4px;">🫁 SpO₂ (%)</div>
          ${svgSpo2}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${allVitals[0]?.spo2 ? allVitals[0].spo2+'%' : '-'}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="openAddVitalModal('${patientId}')">+ บันทึก</button>
          <div class="card-title" style="font-size:13px;margin:0;">📋 บันทึกสัญญาณชีพ</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--text3);">จาก:</span>
          <input type="date" id="vital-filter-from" class="form-control" style="width:140px;font-size:12px;padding:4px 8px;"
            value="${fromDate}" onchange="document.getElementById('patprofile-tab-vitals').innerHTML=renderVitalsTab('${pid}','${patientId}')">
          <span style="font-size:12px;color:var(--text3);">ถึง:</span>
          <input type="date" id="vital-filter-to" class="form-control" style="width:140px;font-size:12px;padding:4px 8px;"
            value="${toDate}" onchange="document.getElementById('patprofile-tab-vitals').innerHTML=renderVitalsTab('${pid}','${patientId}')">
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setVitalDateRange('today','${pid}','${patientId}')">วันนี้</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setVitalDateRange('7days','${pid}','${patientId}')">7 วันล่าสุด</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setVitalDateRange('thisMonth','${pid}','${patientId}')">เดือนนี้</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;" onclick="setVitalDateRange('lastMonth','${pid}','${patientId}')">เดือนที่แล้ว</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>วัน/เวลา</th>
            <th style="text-align:center;color:#e74c3c;">🩸 BP</th>
            <th style="text-align:center;color:#3498db;">💓 HR</th>
            <th style="text-align:center;color:#e67e22;">🌡️ Temp</th>
            <th style="text-align:center;color:#27ae60;">🫁 SpO₂</th>
            <th style="text-align:center;color:#8e44ad;">🍬 DTX</th>
            <th style="text-align:center;color:#16a085;">🫀 RR</th>
            <th style="text-align:center;">⚖️ น้ำหนัก</th>
            <th style="text-align:center;">📏 ส่วนสูง</th>
            <th>อื่นๆ</th>
            <th>ผู้บันทึก</th>
            <th>หมายเหตุ</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${(() => {
              try {
                // ใช้ fromDate/toDate จาก outer scope (อ่าน override หรือ DOM ไปแล้ว)
                // Filter ใช้ recordedAt prefix 10 chars (YYYY-MM-DD)
                const filteredAll = allVitals.filter(v => {
                  const d = v.recordedAt ? String(v.recordedAt).slice(0,10) : '';
                  return d >= fromDate && d <= toDate;
                });
                const MAX_ROWS = 100;
                const tooMany = filteredAll.length > MAX_ROWS;
                const filtered = tooMany ? filteredAll.slice(0, MAX_ROWS) : filteredAll;
                const warning = tooMany 
                  ? `<tr><td colspan="13" style="text-align:center;padding:10px;background:#fef3c7;color:#92400e;font-size:12px;">⚠️ พบ ${filteredAll.length} รายการ — แสดง ${MAX_ROWS} รายการล่าสุด กรุณาเลือกช่วงให้แคบลง</td></tr>` 
                  : '';
                const rangeText = (fromDate === toDate) ? '' : ` (${fromDate} ถึง ${toDate})`;
                if (!filtered.length) return `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--text3);">ไม่มีรายการในช่วงที่เลือก${rangeText}</td></tr>`;
                return warning + filtered.map(v => {
                  const bpAlert = v.bp_sys && (v.bp_sys>=160||v.bp_sys<=90);
                  const spo2Alert = v.spo2 && v.spo2<95;
                  const hrAlert = v.hr && (v.hr>100||v.hr<50);
                  // ── เกณฑ์ใหม่ ตามที่อ้นกำหนด ──
                  const tempAlert = v.temp && (v.temp<35.5 || v.temp>=37.5);
                  const rrAlert = v.rr && (v.rr<14 || v.rr>22);
                  const dtxAlert = v.dtx && (v.dtx<70 || v.dtx>150);
                  const anyAlert = bpAlert||spo2Alert||hrAlert||tempAlert||rrAlert||dtxAlert;
                  return `<tr ${anyAlert ? 'style="background:#fff8f8;"' : ''}>
                    <td class="number" style="font-size:12px;white-space:nowrap;">${(v.recordedAt ? new Date(v.recordedAt).toLocaleString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replace(',',' ') : '-')}</td>
                    <td style="text-align:center;font-weight:${bpAlert?'700':'400'};color:${bpAlert?'#e74c3c':'inherit'};">${v.bp_sys ? v.bp_sys+'/'+v.bp_dia : '-'}</td>
                    <td style="text-align:center;font-weight:${hrAlert?'700':'400'};color:${hrAlert?'#e74c3c':'inherit'};">${v.hr||'-'}</td>
                    <td style="text-align:center;font-weight:${tempAlert?'700':'400'};color:${tempAlert?'#e74c3c':'inherit'};">${v.temp ? v.temp+'°C' : '-'}</td>
                    <td style="text-align:center;font-weight:${spo2Alert?'700':'400'};color:${spo2Alert?'#e74c3c':'inherit'};">${v.spo2 ? v.spo2+'%' : '-'}</td>
                    <td style="text-align:center;font-weight:${dtxAlert?'700':'400'};color:${dtxAlert?'#e74c3c':'inherit'};">${v.dtx ? v.dtx+' mg/dL' : '-'}</td>
                    <td style="text-align:center;font-weight:${rrAlert?'700':'400'};color:${rrAlert?'#e74c3c':'inherit'};">${v.rr ? v.rr+'/min' : '-'}</td>
                    <td style="text-align:center;font-size:12px;">${v.weight ? v.weight+' kg' : '-'}</td>
                    <td style="text-align:center;font-size:12px;">${v.height ? v.height+' cm' : '-'}</td>
                    <td style="font-size:12px;color:var(--text2);max-width:120px;">${v.otherFields||'-'}</td>
                    <td style="font-size:12px;">${v.recordedBy||'-'}</td>
                    <td style="font-size:12px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${v.note||''}</td>
                    <td><button class="btn btn-ghost btn-sm" onclick="openEditVitalModal('${patientId}','${pid}','${v.id}')" title="แก้ไข">✏️</button><button class="btn btn-ghost btn-sm" onclick="deleteVitalSign('${patientId}','${pid}','${v.id}')" title="ลบ">🗑️</button></td>
                  </tr>`;
                }).join('');
              } catch(e) {
                console.error('[vital-filter]', e);
                return `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--text3);">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
              }
            })()}
          </tbody>
        </table>
      </div>
    </div>`;
}

// Helper: ปุ่ม preset date range สำหรับ Vitals
function setVitalDateRange(preset, pid, patientId) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let fromDate = todayStr, toDate = todayStr;
  if (preset === 'today') { fromDate = todayStr; toDate = todayStr; }
  else if (preset === '7days') {
    const past = new Date(today); past.setDate(today.getDate() - 6);
    fromDate = past.toISOString().split('T')[0]; toDate = todayStr;
  } else if (preset === 'thisMonth') {
    fromDate = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-01';
    toDate = todayStr;
  } else if (preset === 'lastMonth') {
    const lastMonth = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    fromDate = lastMonth.toISOString().split('T')[0];
    toDate = lastDayLastMonth.toISOString().split('T')[0];
  }
  const fromEl = document.getElementById('vital-filter-from');
  const toEl = document.getElementById('vital-filter-to');
  if (fromEl) fromEl.value = fromDate;
  if (toEl) toEl.value = toDate;
  // ส่ง fromDate/toDate ตรงๆ ไม่อ่านจาก DOM (เพราะ DOM อาจ flush ไม่ทัน)
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId, fromDate, toDate);
}

function vitalsSparkline(values, color, min, max) {
  const data = values.filter(v=>v!=null&&!isNaN(v));
  if (data.length < 2) return `<div style="height:40px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text3);">ยังไม่มีข้อมูลพอ</div>`;
  const w=200, h=44, pad=4;
  const range = (max-min)||1;
  const pts = data.map((v,i)=>{
    const x = pad + (i/(data.length-1))*(w-pad*2);
    const y = h-pad - ((v-min)/range)*(h-pad*2);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:44px;">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${data.map((v,i)=>{
      const x = pad + (i/(data.length-1))*(w-pad*2);
      const y = h-pad - ((v-min)/range)*(h-pad*2);
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
    }).join('')}
  </svg>`;
}

async function deleteVitalSign(patientId, pid, id) {
  if(!(await customConfirm('ลบรายการนี้?'))) return;
  const { error } = await supa.from('vital_signs').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  db.vitalSigns[pid] = (db.vitalSigns[pid]||[]).filter(v=>v.id!=id);
  toast('ลบแล้ว');
  document.getElementById('patprofile-tab-vitals').innerHTML = renderVitalsTab(pid, patientId);
}

// ==========================================