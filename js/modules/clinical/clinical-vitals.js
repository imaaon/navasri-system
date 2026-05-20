
// ═══════════════════════════════════════════════════════════════
// VITAL SIGNS — Multi-row chip selector modal (ใหม่)
// ═══════════════════════════════════════════════════════════════
// 5 chips lock: BP, HR, Temp, SpO₂, RR
// 3 chips optional: DTX, น้ำหนัก, ส่วนสูง
// "อาการ/หมายเหตุ" textarea — เอา other_fields ออก
// Multi-row: shared = วันที่ · per-row = เวลา + chips + values + textarea
// ═══════════════════════════════════════════════════════════════

var _VITAL_CHIPS = [
  // [R5-A 14พค69] เพิ่ม normal/warning ranges สำหรับ real-time alert ตาม mockup
  // normal: ค่าปกติ (อ้างอิงสำหรับผู้สูงอายุ)
  // warning: ค่าที่ผิดเกณฑ์เล็กน้อย (สีส้ม)
  // critical: ค่าวิกฤต (สีแดง)
  { key: 'bp',     icon: '🩸', label: 'ความดัน',  color: 'var(--danger)', unit: 'mmHg', double: true, locked: true,  fields: ['bp_sys','bp_dia'],
    ranges: { bp_sys: { normal: [90, 139], warning: [140, 159], critical: [160, 999], low_warning: [80, 89], low_critical: [0, 79] },
              bp_dia: { normal: [60, 89],  warning: [90, 99],   critical: [100, 999], low_warning: [55, 59], low_critical: [0, 54] },
              hint: 'ปกติ 90–139 / 60–89' } },
  { key: 'hr',     icon: '💓', label: 'ชีพจร',    color: 'var(--info)', unit: 'bpm',  locked: true,  fields: ['hr'],
    ranges: { hr: { normal: [60, 100], warning: [101, 120], critical: [121, 999], low_warning: [50, 59], low_critical: [0, 49] }, hint: 'ปกติ 60–100 bpm' } },
  { key: 'temp',   icon: '🌡️', label: 'อุณหภูมิ', color: 'var(--warning)', unit: '°C',   locked: true,  fields: ['temp'], step: '0.1',
    ranges: { temp: { normal: [36.1, 37.2], warning: [37.3, 37.9], critical: [38, 999], low_warning: [35.5, 36.0], low_critical: [0, 35.4] }, hint: 'ปกติ 36.1–37.2°C' } },
  { key: 'spo2',   icon: '🫁', label: 'SpO₂',     color: 'var(--success)', unit: '%',    locked: true,  fields: ['spo2'],
    ranges: { spo2: { normal: [95, 100], warning: [90, 94], critical: [0, 89] }, hint: 'ปกติ ≥ 95%' } },
  { key: 'rr',     icon: '🫀', label: 'RR',       color: 'var(--brand)', unit: '/min', locked: true,  fields: ['rr'],
    ranges: { rr: { normal: [12, 20], warning: [21, 24], critical: [25, 999], low_warning: [10, 11], low_critical: [0, 9] }, hint: 'ปกติ 12–20 /min' } },
  { key: 'dtx',    icon: '🍬', label: 'DTX',      color: 'var(--purple)', unit: 'mg/dL',locked: false, fields: ['dtx'],
    ranges: { dtx: { normal: [70, 140], warning: [141, 180], critical: [181, 999], low_warning: [54, 69], low_critical: [0, 53] }, hint: 'ปกติ 70–140 mg/dL' } },
  { key: 'weight', icon: '⚖️', label: 'น้ำหนัก',  color: '#7f8c8d', unit: 'กก.',  locked: false, fields: ['weight'], step: '0.1' },
  { key: 'height', icon: '📏', label: 'ส่วนสูง',  color: '#7f8c8d', unit: 'ซม.',  locked: false, fields: ['height'], step: '0.1' }
];

// [R5-A 14พค69] Real-time validation function
// Returns: { tone: 'normal'|'warning'|'critical'|'low-warning'|'low-critical', msg: string }
function _vitalCheckRange(field, value, chipConfig) {
  if (!chipConfig || !chipConfig.ranges || !chipConfig.ranges[field]) return null;
  if (value === null || value === undefined || value === '' || isNaN(value)) return null;
  var v = parseFloat(value);
  var r = chipConfig.ranges[field];
  if (r.critical && v >= r.critical[0] && v <= r.critical[1]) return { tone: 'critical', msg: '🚨 ค่าวิกฤต — ต้องแจ้งแพทย์ทันที' };
  if (r.low_critical && v >= r.low_critical[0] && v <= r.low_critical[1]) return { tone: 'critical', msg: '🚨 ค่าต่ำวิกฤต — ต้องแจ้งแพทย์ทันที' };
  if (r.warning && v >= r.warning[0] && v <= r.warning[1]) return { tone: 'warning', msg: '⚠️ ค่าสูงกว่าเกณฑ์ปกติ' };
  if (r.low_warning && v >= r.low_warning[0] && v <= r.low_warning[1]) return { tone: 'warning', msg: '⚠️ ค่าต่ำกว่าเกณฑ์ปกติ' };
  if (r.normal && v >= r.normal[0] && v <= r.normal[1]) return { tone: 'normal', msg: '✓ ปกติ' };
  return null;
}

// [R5-A 14พค69] Update inline alert message for a vital input wrap
function _vitalUpdateAlert(chipConfig, wrap) {
  if (!chipConfig || !wrap || !wrap._alertEl) return;
  var alertEl = wrap._alertEl;
  // ใช้ field สุดสำคัญ (worst tone) จากทุก fields ของ chip นี้
  var worstResult = null;
  var toneRank = { 'normal': 1, 'warning': 2, 'critical': 3 };
  chipConfig.fields.forEach(function(f) {
    var inp = wrap._valueInputs && wrap._valueInputs[f];
    if (!inp) return;
    var result = _vitalCheckRange(f, inp.value, chipConfig);
    if (result && (!worstResult || toneRank[result.tone] > toneRank[worstResult.tone])) {
      worstResult = result;
    }
  });
  if (!worstResult) {
    alertEl.style.display = 'none';
    return;
  }
  // Style by tone
  var palette = {
    normal:   { bg: 'var(--success-bg)', color: 'var(--success-text)' },
    warning:  { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    critical: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' }
  }[worstResult.tone] || { bg: '#f0f0f0', color: '#666' };
  alertEl.style.display = '';
  alertEl.style.background = palette.bg;
  alertEl.style.color = palette.color;
  alertEl.textContent = worstResult.msg;
}

function _openVitalModal(rec, patientId, pid) {
  var isEdit = !!rec;
  var todayStr = new Date().toISOString().slice(0,10);
  var nowStr = new Date().toTimeString().slice(0,5);
  var sharedDate = isEdit && rec.recordedAt ? rec.recordedAt.slice(0,10) : todayStr;
  var initTime = isEdit && rec.recordedAt ? rec.recordedAt.slice(11,16) : nowStr;

  // [R5-A 14พค69] ดึงข้อมูล patient เพื่อแสดง pill ที่หัว modal
  var _patient = (typeof db !== 'undefined' && db.patients) ? db.patients.find(function(x){ return x.id == patientId; }) : null;
  var _patName = _patient ? _patient.name : '';
  var _patHN = _patient ? (_patient.hn || _patient.id || '-') : '';
  var _patAge = (_patient && _patient.dob && typeof calcAge === 'function') ? calcAge(_patient.dob) : '';
  var _patGender = _patient ? (_patient.gender || '') : '';
  var _patBed = '';
  if (_patient && typeof getPatientBed === 'function' && typeof getPatientRoom === 'function') {
    var _b = getPatientBed(_patient); var _r = getPatientRoom(_patient);
    if (_r && _r.name) _patBed = _r.name + (_b && _b.bedCode ? '/' + _b.bedCode : '');
  }
  var _patInitials = _patName ? _patName.trim().split(/\s+/).slice(0,2).map(function(s){ return s.charAt(0); }).join('') : '?';
  var _patStatus = _patient ? (_patient.status === 'active' ? 'อยู่ในศูนย์' : _patient.status === 'hospital' ? '🏥 อยู่ รพ.' : 'ออกแล้ว') : '';

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  var modal = document.createElement('div');
  modal.className = 'modal vital-modal-r5';
  modal.style.cssText = 'background:#fff;border-radius:14px;padding:20px;width:560px;max-width:95vw;max-height:92vh;overflow-y:auto;';

  var h3 = document.createElement('div');
  h3.className = 'vital-modal-title';
  h3.style.cssText = 'font-size:17px;font-weight:700;color:var(--text,#1a1a1a);margin-bottom:6px;display:flex;align-items:center;gap:8px;';
  h3.innerHTML = '<span style="font-size:22px;">📊</span> ' + (isEdit ? 'แก้ไขสัญญาณชีพ' : 'บันทึกสัญญาณชีพ');
  modal.appendChild(h3);

  // [R5-A 14พค69] Subtitle
  var subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size:13px;color:var(--text2,#5e5e5e);margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border,#e8e3d4);';
  subtitle.textContent = 'เลือกค่าที่ต้องการบันทึก แล้วกรอก — ไม่ต้องครบทุกช่อง';
  modal.appendChild(subtitle);

  // [R5-A 14พค69] Patient pill (ตาม mockup)
  if (_patient) {
    var pPill = document.createElement('div');
    pPill.className = 'vital-patient-pill';
    pPill.style.cssText = 'background:var(--sage-50,#f4f8f5);border:1px solid var(--sage-200,#dbe5dc);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;';
    pPill.innerHTML =
      '<div style="width:40px;height:40px;border-radius:50%;background:var(--sage-100,#eaf1eb);color:var(--brand,#2e6b4f);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">' + _patInitials + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;font-size:14px;letter-spacing:-0.2px;">' + _patName + '</div>' +
        '<div style="font-size:11.5px;color:var(--text2,#5e5e5e);margin-top:2px;">HN <span style="font-family:var(--mono,monospace);">' + _patHN + '</span>' +
          (_patBed ? ' · ห้อง ' + _patBed : '') +
          (_patGender || _patAge ? ' · ' + _patGender + (_patAge ? ' ' + _patAge : '') : '') +
        '</div>' +
      '</div>' +
      '<span style="background:var(--brand,#2e6b4f);color:white;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:600;flex-shrink:0;">' + _patStatus + '</span>';
    modal.appendChild(pPill);
  }

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
      wrap.style.cssText = 'background:var(--bg);border-radius:8px;padding:10px;margin-bottom:6px;border-left:3px solid ' + c.color + ';';
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
          fl.style.cssText = 'font-size:10px;color:var(--text3);margin-bottom:3px;font-weight:600;letter-spacing:0.3px;';
          fl.textContent = (idx === 0 ? 'SYS' : 'DIA');
          fwrap.appendChild(fl);
          var iwrap = document.createElement('div');
          iwrap.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center;';
          var inp = document.createElement('input');
          inp.type = 'number';
          inp.setAttribute('inputmode','numeric');
          inp.className = 'form-control vital-value-input';
          // [R5-A] Plex Mono + ใหญ่ 22px ตาม mockup
          inp.style.cssText = 'height:48px;padding:0 12px;font-size:22px;font-weight:700;font-family:var(--mono,monospace);letter-spacing:-0.5px;';
          inp.placeholder = (idx === 0 ? '120' : '80');
          if (initValues[fn] !== undefined) inp.value = initValues[fn];
          var unit = document.createElement('span');
          unit.style.cssText = 'font-size:11px;color:var(--text3);padding-left:2px;font-weight:500;';
          unit.textContent = c.unit;
          iwrap.appendChild(inp);
          iwrap.appendChild(unit);
          fwrap.appendChild(iwrap);
          grid.appendChild(fwrap);
          valueInputs[fn] = inp;
          // [R5-A] Real-time validation message
          inp.addEventListener('input', function() { _vitalUpdateAlert(c, wrap); });
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
        inp2.className = 'form-control vital-value-input';
        // [R5-A] Plex Mono + ใหญ่ 22px ตาม mockup
        inp2.style.cssText = 'height:48px;padding:0 12px;font-size:22px;font-weight:700;font-family:var(--mono,monospace);letter-spacing:-0.5px;';
        if (initValues[c.fields[0]] !== undefined) inp2.value = initValues[c.fields[0]];
        var unit2 = document.createElement('span');
        unit2.style.cssText = 'font-size:11px;color:var(--text3);padding-left:2px;font-weight:500;';
        unit2.textContent = c.unit;
        iwrap2.appendChild(inp2);
        iwrap2.appendChild(unit2);
        wrap.appendChild(iwrap2);
        valueInputs[c.fields[0]] = inp2;
        // [R5-A] Real-time validation message
        inp2.addEventListener('input', function() { _vitalUpdateAlert(c, wrap); });
      }

      // [R5-A 14พค69] Alert message container (เริ่มซ่อน — แสดงเมื่อมีค่าผิดเกณฑ์)
      var alertEl = document.createElement('div');
      alertEl.className = 'vital-alert-msg';
      alertEl.style.cssText = 'display:none;font-size:12px;font-weight:500;margin-top:6px;padding:6px 10px;border-radius:6px;';
      wrap.appendChild(alertEl);

      // [R5-A] Range hint (subtle, gray)
      if (c.ranges && c.ranges.hint) {
        var hintEl = document.createElement('div');
        hintEl.className = 'vital-range-hint';
        hintEl.style.cssText = 'font-size:11px;color:var(--text3,#8a8a8a);margin-top:4px;font-style:italic;';
        hintEl.textContent = 'ปกติ: ' + c.ranges.hint.replace('ปกติ', '').replace('ปกติ ', '').trim();
        wrap.appendChild(hintEl);
      }

      // Store chip config for later validation
      wrap._chipConfig = c;
      wrap._valueInputs = valueInputs;
      wrap._alertEl = alertEl;

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
  if (typeof attachEscClose === 'function') attachEscClose(overlay, close);

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

  const svgBP = vitalsSparkline(chartData.map(v=>v.bp_sys), 'var(--danger)', 120, 180);
  const svgHR = vitalsSparkline(chartData.map(v=>v.hr), 'var(--info)', 50, 100);
  const svgSpo2 = vitalsSparkline(chartData.map(v=>v.spo2), 'var(--success)', 90, 100);

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

  var _vitalsTabResult = `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div class="card-title" style="font-size:13px;">📊 แนวโน้มสัญญาณชีพ (14 ครั้งล่าสุด)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;">
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--danger);margin-bottom:4px;">🩸 ความดันโลหิต (mmHg)</div>
          ${svgBP}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${allVitals[0]?.bp_sys ? allVitals[0].bp_sys+'/'+allVitals[0].bp_dia : '-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--info);margin-bottom:4px;">💓 ชีพจร (bpm)</div>
          ${svgHR}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">ค่าล่าสุด: ${allVitals[0]?.hr||'-'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--success);margin-bottom:4px;">🫁 SpO₂ (%)</div>
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
        <table class="responsive-card-table">
          <thead><tr>
            <th>วัน/เวลา</th>
            <th style="text-align:center;color:var(--danger);">🩸 BP</th>
            <th style="text-align:center;color:var(--info);">💓 HR</th>
            <th style="text-align:center;color:var(--warning);">🌡️ Temp</th>
            <th style="text-align:center;color:var(--success);">🫁 SpO₂</th>
            <th style="text-align:center;color:var(--purple);">🍬 DTX</th>
            <th style="text-align:center;color:var(--brand);">🫀 RR</th>
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
                  ? `<tr><td colspan="13" style="text-align:center;padding:10px;background:var(--warning-bg);color:var(--warning-text);font-size:12px;">⚠️ พบ ${filteredAll.length} รายการ — แสดง ${MAX_ROWS} รายการล่าสุด กรุณาเลือกช่วงให้แคบลง</td></tr>` 
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
                  return `<tr ${anyAlert ? 'style="background:var(--danger-bg);"' : ''}>
                    <td data-label="วัน/เวลา" class="number" style="font-size:12px;white-space:nowrap;">${(v.recordedAt ? new Date(v.recordedAt).toLocaleString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replace(',',' ') : '-')}</td>
                    <td data-label="🩸 BP" style="text-align:center;font-weight:${bpAlert?'700':'400'};color:${bpAlert?'var(--danger)':'inherit'};">${v.bp_sys ? v.bp_sys+'/'+v.bp_dia : '-'}</td>
                    <td data-label="💓 HR" style="text-align:center;font-weight:${hrAlert?'700':'400'};color:${hrAlert?'var(--danger)':'inherit'};">${v.hr||'-'}</td>
                    <td data-label="🌡️ Temp" style="text-align:center;font-weight:${tempAlert?'700':'400'};color:${tempAlert?'var(--danger)':'inherit'};">${v.temp ? v.temp+'°C' : '-'}</td>
                    <td data-label="🫁 SpO₂" style="text-align:center;font-weight:${spo2Alert?'700':'400'};color:${spo2Alert?'var(--danger)':'inherit'};">${v.spo2 ? v.spo2+'%' : '-'}</td>
                    <td data-label="🍬 DTX" style="text-align:center;font-weight:${dtxAlert?'700':'400'};color:${dtxAlert?'var(--danger)':'inherit'};">${v.dtx ? v.dtx+' mg/dL' : '-'}</td>
                    <td data-label="🫀 RR" style="text-align:center;font-weight:${rrAlert?'700':'400'};color:${rrAlert?'var(--danger)':'inherit'};">${v.rr ? v.rr+'/min' : '-'}</td>
                    <td data-label="⚖️ น้ำหนัก" style="text-align:center;font-size:12px;">${v.weight ? v.weight+' kg' : '-'}</td>
                    <td data-label="📏 ส่วนสูง" style="text-align:center;font-size:12px;">${v.height ? v.height+' cm' : '-'}</td>
                    <td data-label="อื่นๆ" style="font-size:12px;color:var(--text2);max-width:120px;">${v.otherFields||'-'}</td>
                    <td data-label="ผู้บันทึก" style="font-size:12px;">${v.recordedBy||'-'}</td>
                    <td data-label="หมายเหตุ" style="font-size:12px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${v.note||''}</td>
                    <td data-label=""><button class="btn btn-ghost btn-sm" onclick="openEditVitalModal('${patientId}','${pid}','${v.id}')" title="แก้ไข">✏️</button><button class="btn btn-ghost btn-sm" onclick="deleteVitalSign('${patientId}','${pid}','${v.id}')" title="ลบ">🗑️</button></td>
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
    </div>

    <!-- ── 📋 สรุปอาการรวมต่อเวร ── -->
    <div class="card" style="margin-top:14px;">
      <div class="card-header" style="border-bottom:1px solid var(--border);padding:12px 16px;">
        <div class="card-title" style="font-size:14px;color:var(--accent2);">📋 สรุปอาการรวมต่อเวร <span style="font-size:11px;color:var(--text3);font-weight:400;">— ใช้ส่งเวร / แจ้งญาติ / ส่งแพทย์</span></div>
      </div>
      <div id="shift-summary-container" style="padding:14px;">
        <div style="text-align:center;color:var(--text3);font-size:13px;">กำลังโหลด...</div>
      </div>
    </div>
  `;
  // Render shift summary section async (หลัง innerHTML ถูก mount)
  setTimeout(function() {
    var container = document.getElementById('shift-summary-container');
    if (container) {
      var f = document.getElementById('vital-filter-from');
      var t = document.getElementById('vital-filter-to');
      _ssRenderSection(container, patientId, pid, f ? f.value : null, t ? t.value : null);
    }
  }, 50);

  return _vitalsTabResult;
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
    <polyline points="${pts}" fill="none" style="stroke:${color};" stroke-width="2" stroke-linejoin="round"/>
    ${data.map((v,i)=>{
      const x = pad + (i/(data.length-1))*(w-pad*2);
      const y = h-pad - ((v-min)/range)*(h-pad*2);
      return `<circle cx="${x}" cy="${y}" r="3" style="fill:${color};"/>`;
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

// ═══════════════════════════════════════════════════════════════
// 📋 SHIFT SUMMARY — สรุปอาการรวมต่อเวร
// ═══════════════════════════════════════════════════════════════
// Workflow:
// 1. Query data: vital_signs + patient_excretions + patient_fluid_records ในช่วง filter
// 2. Group by เวร (วันที่ + เช้า/ดึก)
// 3. แต่ละเวร: ดึง summary_text จาก DB ก่อน (manual override)
//    - ถ้ามี → ใช้ตัวที่บันทึก
//    - ถ้าไม่มี → generate auto-text
// 4. แสดงเป็นกล่องแต่ละเวร เรียงล่าสุดบน
// 5. ปุ่ม: Copy / Print / Edit / Regenerate / PDF

// ── In-memory cache ของ manual summaries ──
window._shiftSummaryCache = window._shiftSummaryCache || {};

// ── Helper: ตรวจว่า hour อยู่เวรไหน ──
function _ssShiftOf(hour) {
  return (hour >= 7 && hour < 19) ? 'เช้า' : 'ดึก';
}

// ── Helper: หา shift_date (วันที่เวร) จาก timestamp ──
// เวรเช้า: shift_date = วันเดียวกัน
// เวรดึก: hour >= 19 → shift_date = วันเดียวกัน, hour < 7 → shift_date = วันก่อนหน้า
function _ssShiftDateOf(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  var hour = d.getHours();
  if (hour < 7) {
    // เวรดึก ของวันก่อนหน้า
    d.setDate(d.getDate() - 1);
  }
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── สร้าง key สำหรับ shift bucket ──
function _ssKey(date, shift) {
  return date + '|' + shift;
}

// ── Group ข้อมูลทั้งหมดเป็น bucket per (date, shift) ──
// [Phase 1 · 20 พ.ค. 69] เพิ่ม 3 data sources: appointments, incidents, nursing handover notes
function _ssGroupByShift(vitals, excretions, fluids, appointments, incidents, nursingNotes, fromDate, toDate) {
  var buckets = {};

  function _add(date, shift, kind, item) {
    if (!date || !shift) return;
    var k = _ssKey(date, shift);
    if (!buckets[k]) {
      buckets[k] = {
        date: date, shift: shift,
        vitals: [], excretions: [], fluids: [],
        appointments: [], incidents: [], nursingNotes: []
      };
    }
    buckets[k][kind].push(item);
  }

  (vitals || []).forEach(function(v) {
    var ts = v.recordedAt || v.recorded_at;
    if (!ts) return;
    var sd = _ssShiftDateOf(ts);
    var hour = new Date(ts).getHours();
    _add(sd, _ssShiftOf(hour), 'vitals', v);
  });

  (excretions || []).forEach(function(r) {
    if (!r.recorded_at || !r.shift) return;
    var sd = _ssShiftDateOf(r.recorded_at);
    _add(sd, r.shift, 'excretions', r);
  });

  (fluids || []).forEach(function(r) {
    if (!r.recorded_at || !r.shift) return;
    var sd = _ssShiftDateOf(r.recorded_at);
    _add(sd, r.shift, 'fluids', r);
  });

  // ── Appointments: group by appt_date + derive shift from appt_time ──
  (appointments || []).forEach(function(a) {
    if (!a.appt_date) return;
    var shift = 'เช้า'; // default morning if no time
    if (a.appt_time) {
      var hour = parseInt(String(a.appt_time).slice(0,2), 10);
      if (!isNaN(hour)) shift = _ssShiftOf(hour);
    }
    _add(a.appt_date, shift, 'appointments', a);
  });

  // ── Incidents: group by created_at (timestamp) ──
  (incidents || []).forEach(function(inc) {
    var ts = inc.created_at;
    if (!ts) return;
    var sd = _ssShiftDateOf(ts);
    var hour = new Date(ts).getHours();
    _add(sd, _ssShiftOf(hour), 'incidents', inc);
  });

  // ── Nursing notes: use date + shift fields directly (already in correct format) ──
  (nursingNotes || []).forEach(function(n) {
    if (!n.date || !n.shift) return;
    // เก็บเฉพาะ note ที่มี handover_note (ไม่ noise ด้วย empty)
    if (!n.handover_note || !String(n.handover_note).trim()) return;
    _add(n.date, n.shift, 'nursingNotes', n);
  });

  // กรองให้อยู่ใน range filter (ใช้ shift_date)
  if (fromDate || toDate) {
    Object.keys(buckets).forEach(function(k) {
      var d = buckets[k].date;
      if (fromDate && d < fromDate) delete buckets[k];
      if (toDate && d > toDate) delete buckets[k];
    });
  }

  return buckets;
}

// ── Generate paragraph text สรุปเวร ──
function _ssGenerateText(bucket) {
  var parts = [];
  var vitals = bucket.vitals || [];
  var excretions = bucket.excretions || [];
  var fluids = bucket.fluids || [];

  // ── Vital Signs ──
  if (vitals.length === 0) {
    parts.push('ไม่มีการวัดสัญญาณชีพในเวรนี้');
  } else if (vitals.length === 1) {
    var v = vitals[0];
    var bits = [];
    if (v.bp_sys && v.bp_dia) bits.push('BP ' + v.bp_sys + '/' + v.bp_dia);
    if (v.hr) bits.push('HR ' + v.hr);
    if (v.temp) bits.push('Temp ' + v.temp + '°C');
    if (v.spo2) bits.push('SpO₂ ' + v.spo2 + '%');
    if (v.rr) bits.push('RR ' + v.rr);
    if (v.dtx) bits.push('DTX ' + v.dtx);
    var tm = v.recordedAt ? new Date(v.recordedAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', hour12:false}) : '';
    parts.push('วัดสัญญาณชีพ ' + (tm ? '(' + tm + ') ' : '') + bits.join(', '));
    if (v.note) parts.push('อาการ: ' + v.note);
  } else {
    // หลายครั้ง — แสดง range
    var bps = vitals.filter(function(v){ return v.bp_sys; });
    var hrs = vitals.filter(function(v){ return v.hr; });
    var temps = vitals.filter(function(v){ return v.temp; });
    var spo2s = vitals.filter(function(v){ return v.spo2; });
    var bits2 = [];
    if (bps.length > 0) {
      var minS = Math.min.apply(null, bps.map(function(v){return v.bp_sys;}));
      var maxS = Math.max.apply(null, bps.map(function(v){return v.bp_sys;}));
      bits2.push('BP ' + (minS === maxS ? minS : minS + '–' + maxS) + ' (SYS)');
    }
    if (hrs.length > 0) {
      var minH = Math.min.apply(null, hrs.map(function(v){return v.hr;}));
      var maxH = Math.max.apply(null, hrs.map(function(v){return v.hr;}));
      bits2.push('HR ' + (minH === maxH ? minH : minH + '–' + maxH));
    }
    if (temps.length > 0) {
      var minT = Math.min.apply(null, temps.map(function(v){return v.temp;}));
      var maxT = Math.max.apply(null, temps.map(function(v){return v.temp;}));
      bits2.push('Temp ' + (minT === maxT ? minT : minT + '–' + maxT) + '°C');
    }
    if (spo2s.length > 0) {
      var minO = Math.min.apply(null, spo2s.map(function(v){return v.spo2;}));
      var maxO = Math.max.apply(null, spo2s.map(function(v){return v.spo2;}));
      bits2.push('SpO₂ ' + (minO === maxO ? minO : minO + '–' + maxO) + '%');
    }
    parts.push('วัดสัญญาณชีพ ' + vitals.length + ' ครั้ง: ' + bits2.join(', '));
    var notes = vitals.filter(function(v){return v.note;}).map(function(v){return v.note;});
    if (notes.length > 0) parts.push('อาการ: ' + notes.join('; '));
  }

  // ── Intake (น้ำเข้า) ──
  var intakes = fluids.filter(function(f){ return f.direction === 'intake'; });
  if (intakes.length > 0) {
    var totalIn = intakes.reduce(function(s, r){ return s + (parseFloat(r.volume_ml) || 0); }, 0);
    var typeBits = intakes.map(function(r) {
      var t = (r.fluid_type || '').replace(/^น้ำดื่ม$|^น้ำเปล่า$/, 'น้ำ');
      return t + (r.volume_ml ? ' ' + r.volume_ml + 'ml' : '');
    });
    parts.push('น้ำเข้า ' + totalIn + 'ml (' + typeBits.join(', ') + ')');
  }

  // ── Output (น้ำออก) ──
  var urines = (excretions || []).filter(function(r){ return r.type === 'urine'; });
  var stools = (excretions || []).filter(function(r){ return r.type === 'stool'; });
  var vomits = fluids.filter(function(f){ return f.direction === 'output' && (f.fluid_type || '').trim() === 'อาเจียน'; });
  var otherOutputs = fluids.filter(function(f){ return f.direction === 'output' && (f.fluid_type || '').trim() !== 'อาเจียน'; });

  if (urines.length > 0) {
    var urineCount = urines.reduce(function(s,r){ return s + (parseInt(r.count) || 1); }, 0);
    var urineVol = urines.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0);
    var urineChars = Array.from(new Set(urines.map(function(r){ return r.characteristics; }).filter(Boolean)));
    var urineStr = 'ปัสสาวะ ' + urineCount + ' ครั้ง';
    if (urineVol > 0) urineStr += ' รวม ' + urineVol + 'ml';
    if (urineChars.length > 0) urineStr += ' (' + urineChars.join(', ') + ')';
    parts.push(urineStr);
  } else {
    parts.push('ไม่ปัสสาวะในเวรนี้');
  }

  if (stools.length > 0) {
    var stoolCount = stools.reduce(function(s,r){ return s + (parseInt(r.count) || 1); }, 0);
    var stoolChars = Array.from(new Set(stools.map(function(r){ return r.characteristics; }).filter(Boolean)));
    var stoolStr = 'อุจจาระ ' + stoolCount + ' ครั้ง';
    if (stoolChars.length > 0) stoolStr += ' (' + stoolChars.join(', ') + ')';
    parts.push(stoolStr);
  }

  if (vomits.length > 0) {
    var vomitVol = vomits.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0);
    parts.push('อาเจียน ' + vomits.length + ' ครั้ง' + (vomitVol > 0 ? ' รวม ' + vomitVol + 'ml' : ''));
  }

  if (otherOutputs.length > 0) {
    otherOutputs.forEach(function(r) {
      var s = (r.fluid_type || 'อื่นๆ') + ' ' + (parseFloat(r.volume_ml) || 0) + 'ml';
      parts.push(s);
    });
  }

  // ── Calculate balance ──
  var totalInMl = intakes.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0);
  var totalOutMl = 
    urines.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0) +
    vomits.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0) +
    otherOutputs.reduce(function(s,r){ return s + (parseFloat(r.volume_ml) || 0); }, 0);
  if (totalInMl > 0 || totalOutMl > 0) {
    var bal = totalInMl - totalOutMl;
    parts.push('Balance ' + (bal >= 0 ? '+' : '') + bal + 'ml');
  }

  // [Phase 1 · 20 พ.ค. 69] ── Appointments / นัดหมายแพทย์ ──
  var appointments = bucket.appointments || [];
  if (appointments.length > 0) {
    var apptStrs = appointments.map(function(a) {
      var t = a.appt_time ? String(a.appt_time).slice(0,5) : '';
      var loc = a.location || a.hospital || '';
      var purpose = a.purpose || a.title || a.appt_type || 'นัดหมาย';
      return '📅 ' + (t ? t + ' ' : '') + purpose + (loc ? ' ' + loc : '');
    });
    parts.push(apptStrs.join(' | '));
  }

  // [Phase 1 · 20 พ.ค. 69] ── Incidents / อุบัติเหตุ ──
  var incidents = bucket.incidents || [];
  if (incidents.length > 0) {
    var incStrs = incidents.map(function(inc) {
      var t = inc.created_at ? new Date(inc.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', hour12:false}) : '';
      var type = inc.type || 'อุบัติเหตุ';
      var detail = (inc.detail || '').slice(0, 60);
      var sev = inc.severity ? ' [' + inc.severity + ']' : '';
      return '🚨 ' + (t ? t + ' ' : '') + type + sev + (detail ? ': ' + detail : '');
    });
    parts.push(incStrs.join(' | '));
  }

  // [Phase 1 · 20 พ.ค. 69] ── Nursing handover notes (from บันทึกพยาบาล) ──
  var nNotes = bucket.nursingNotes || [];
  if (nNotes.length > 0) {
    var noteStrs = nNotes.map(function(n) {
      var by = n.recorded_by || n.created_by || '';
      var txt = String(n.handover_note || '').trim();
      return '📝 บันทึกพยาบาล' + (by ? ' (' + by + ')' : '') + ': ' + txt;
    });
    parts.push(noteStrs.join(' | '));
  }

  // Join เป็น paragraph เดียว
  return parts.join('. ') + '.';
}

// ── ดึง manual summary จาก DB (ทุก patient ที่ render) ──
async function _ssLoadManualSummaries(patientId) {
  try {
    var res = await supa.from('patient_shift_summaries')
      .select('*').eq('patient_id', patientId);
    if (res.error) {
      console.error('[shift-summary] load error', res.error);
      return {};
    }
    var map = {};
    (res.data || []).forEach(function(r) {
      map[_ssKey(r.shift_date, r.shift)] = r;
    });
    window._shiftSummaryCache[patientId] = map;
    return map;
  } catch (e) {
    console.error('[shift-summary] exception', e);
    return {};
  }
}

// ── Permission helpers สำหรับ shift closure ──
// roles ที่เปิดเวรใหม่ได้ตรงๆ (ตามที่อ้นเลือก option B)
function _ssCanReopenDirectly() {
  return typeof hasRole === 'function' && hasRole('admin','manager','nurse','parttime_nurse','doctor');
}
// roles ที่อนุมัติคำขอ reopen ของ caregiver ได้
function _ssCanApproveReopen() {
  return typeof hasRole === 'function' && hasRole('admin','manager','nurse','parttime_nurse');
}
function _ssIsCaregiver() {
  return typeof hasRole === 'function' && hasRole('caregiver');
}
// [Phase 2 · 20 พ.ค. 69] roles ที่ทำ handover operations ได้ (ส่ง/รับเวร)
// admin/manager/officer/nurse/parttime_nurse/physical_therapist/caregiver
// doctor = view only (ไม่เห็นปุ่ม), dietitian/warehouse = ไม่เห็นทั้ง section
function _ssCanOperateHandover() {
  return typeof hasRole === 'function' && hasRole(
    'admin','manager','officer','nurse','parttime_nurse','physical_therapist','caregiver'
  );
}

// ── Save summary (insert หรือ update) ──
// guard: ถ้าเวรปิดแล้ว และผู้ใช้ไม่ใช่ admin/manager/nurse → ห้ามแก้
// [Phase 2 · 20 พ.ค. 69] log edit ถ้า existing.was_reopened === true
async function _ssSaveSummary(patientId, shiftDate, shift, text) {
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  // ── Guard: ห้ามแก้เวรที่ปิดแล้ว ยกเว้น admin/manager/nurse/pt-nurse/doctor ──
  if (existing && existing.is_closed && !_ssCanReopenDirectly()) {
    return { error: { message: 'เวรนี้ถูกปิดแล้ว กรุณาขอเปิดเวรใหม่ก่อน' } };
  }
  var payload = {
    patient_id: patientId,
    shift_date: shiftDate,
    shift: shift,
    summary_text: text,
    recorded_by: user
  };
  if (existing && existing.id) {
    // [Phase 2] ถ้าเวรเคยถูก reopen → log edit history ก่อน update
    if (existing.was_reopened === true && existing.summary_text !== text) {
      await _ssLogEdit(existing.id, existing.summary_text || '', text, 'after_reopen');
    }
    return supa.from('patient_shift_summaries').update(payload).eq('id', existing.id).select().single();
  } else {
    return supa.from('patient_shift_summaries').insert(payload).select().single();
  }
}

// ── Delete (regenerate ใหม่) ──
async function _ssDeleteSummary(patientId, shiftDate, shift) {
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  if (!existing || !existing.id) return { error: null };
  // Guard: ห้ามลบเวรที่ปิดแล้ว
  if (existing.is_closed && !_ssCanReopenDirectly()) {
    return { error: { message: 'เวรนี้ถูกปิดแล้ว ไม่สามารถสร้างใหม่ได้' } };
  }
  return supa.from('patient_shift_summaries').delete().eq('id', existing.id);
}

// ── ปิดเวร (close) ──
// ผู้ใดก็ปิดได้ — เป็นการ "submit" สรุปอย่างเป็นทางการ
async function _ssCloseShift(patientId, shiftDate, shift, finalText) {
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  // [Phase 2] ถ้าเวรเคย reopen + กำลังจะปิดอีก → log edit ตอนปิด (final edit)
  if (existing && existing.id && existing.was_reopened === true && existing.summary_text !== finalText) {
    await _ssLogEdit(existing.id, existing.summary_text || '', finalText, 'close_after_reopen');
  }
  var payload = {
    patient_id: patientId,
    shift_date: shiftDate,
    shift: shift,
    summary_text: finalText,
    recorded_by: user,
    is_closed: true,
    closed_at: new Date().toISOString(),
    closed_by: user,
    reopen_requested: false,  // clear any pending request
    reopen_requested_at: null,
    reopen_requested_by: null,
    reopen_reason: null
  };
  if (existing && existing.id) {
    return supa.from('patient_shift_summaries').update(payload).eq('id', existing.id).select().single();
  } else {
    return supa.from('patient_shift_summaries').insert(payload).select().single();
  }
}

// [Phase 2 · 20 พ.ค. 69] ── Log edit ใน patient_shift_summary_edits ──
// เรียกจาก _ssSaveSummary เมื่อพบว่า existing.was_reopened === true (แก้หลังปิดเวรไป)
async function _ssLogEdit(summaryId, oldText, newText, context) {
  if (!summaryId) return; // ไม่มี id = insert ใหม่ ไม่ต้อง log
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  var role = (typeof currentUser !== 'undefined') ? (currentUser.role || '') : '';
  try {
    await supa.from('patient_shift_summary_edits').insert({
      summary_id: summaryId,
      edited_by: user,
      edited_by_role: role,
      old_text: oldText || '',
      new_text: newText || '',
      edit_context: context || 'after_reopen'
    });
  } catch (e) {
    // ไม่ throw — edit history ล้มเหลวไม่ควรบล็อกการ save
    console.warn('[shift-summary] log edit failed:', e);
  }
}

// ── เปิดเวรใหม่ (reopen) — ใช้ได้กับ admin/manager/nurse/pt-nurse/doctor ──
async function _ssReopenShift(patientId, shiftDate, shift) {
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  if (!existing || !existing.id) return { error: { message: 'ไม่พบสรุปเวรนี้' } };
  return supa.from('patient_shift_summaries').update({
    is_closed: false,
    closed_at: null,
    closed_by: null,
    was_reopened: true,  // [Phase 2] flag เพื่อ trigger edit history
    reopen_requested: false,
    reopen_requested_at: null,
    reopen_requested_by: null,
    reopen_reason: null
  }).eq('id', existing.id).select().single();
}

// [Phase 2 · 20 พ.ค. 69] ── รับเวร (caregiver กะถัดมา) ──
async function _ssReceiveShift(patientId, shiftDate, shift) {
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  var role = (typeof currentUser !== 'undefined') ? (currentUser.role || '') : '';
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  if (!existing || !existing.id) return { error: { message: 'ไม่พบสรุปเวรนี้' } };
  if (!existing.is_closed) return { error: { message: 'ต้องปิดเวรก่อนถึงจะรับเวรได้' } };
  if (existing.received_by) return { error: { message: 'เวรนี้ถูกรับไปแล้วโดย ' + existing.received_by } };
  return supa.from('patient_shift_summaries').update({
    received_at: new Date().toISOString(),
    received_by: user,
    received_by_role: role
  }).eq('id', existing.id).select().single();
}

// ── ขอเปิดเวรใหม่ (caregiver request) ──
async function _ssRequestReopen(patientId, shiftDate, shift, reason) {
  var user = (typeof currentUser !== 'undefined') ? (currentUser.displayName || currentUser.username || '') : '';
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  if (!existing || !existing.id) return { error: { message: 'ไม่พบสรุปเวรนี้' } };
  return supa.from('patient_shift_summaries').update({
    reopen_requested: true,
    reopen_requested_at: new Date().toISOString(),
    reopen_requested_by: user,
    reopen_reason: (reason || '').trim()
  }).eq('id', existing.id).select().single();
}

// ── ปฏิเสธคำขอ reopen ──
async function _ssDenyReopen(patientId, shiftDate, shift) {
  var existing = (window._shiftSummaryCache[patientId] || {})[_ssKey(shiftDate, shift)];
  if (!existing || !existing.id) return { error: { message: 'ไม่พบสรุปเวรนี้' } };
  return supa.from('patient_shift_summaries').update({
    reopen_requested: false,
    reopen_requested_at: null,
    reopen_requested_by: null,
    reopen_reason: null
  }).eq('id', existing.id).select().single();
}

// ── Render summary section (เรียกจาก renderVitalsTab ใต้สุด) ──
async function _ssRenderSection(container, patientId, pid, fromDate, toDate) {
  // Load manual summaries
  var manual = await _ssLoadManualSummaries(patientId);

  // Build query range — รวมเผื่อ 1 วันก่อน-หลัง (เพราะเวรดึกข้ามวัน)
  var fromTs = fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : null;
  var toTs = toDate ? new Date(toDate + 'T23:59:59').toISOString() : null;

  // Load excretions + fluids + appointments + incidents + nursing notes จาก Supabase
  // [Phase 1 · 20 พ.ค. 69] เพิ่ม 3 sources: appointments, incidents, nursing_notes
  var excretions = [];
  var fluids = [];
  var appointments = [];
  var incidents = [];
  var nursingNotes = [];
  try {
    var q1 = supa.from('patient_excretions').select('*').eq('patient_id', patientId);
    if (fromTs) q1 = q1.gte('recorded_at', fromTs);
    if (toTs) q1 = q1.lte('recorded_at', toTs);
    var res1 = await q1.order('recorded_at', { ascending: false });
    if (!res1.error) excretions = res1.data || [];

    var q2 = supa.from('patient_fluid_records').select('*').eq('patient_id', patientId);
    if (fromTs) q2 = q2.gte('recorded_at', fromTs);
    if (toTs) q2 = q2.lte('recorded_at', toTs);
    var res2 = await q2.order('recorded_at', { ascending: false });
    if (!res2.error) fluids = res2.data || [];

    // ── Appointments — filter by appt_date in range ──
    var q3 = supa.from('patient_appointments').select('*').eq('patient_id', patientId);
    if (fromDate) q3 = q3.gte('appt_date', fromDate);
    if (toDate) q3 = q3.lte('appt_date', toDate);
    var res3 = await q3.order('appt_date', { ascending: false });
    if (!res3.error) appointments = res3.data || [];

    // ── Incidents — filter by created_at timestamp ──
    var q4 = supa.from('incident_reports').select('*').eq('patient_id', patientId);
    if (fromTs) q4 = q4.gte('created_at', fromTs);
    if (toTs) q4 = q4.lte('created_at', toTs);
    var res4 = await q4.order('created_at', { ascending: false });
    if (!res4.error) incidents = res4.data || [];

    // ── Nursing notes — filter by date (date + shift fields already shifted) ──
    var q5 = supa.from('nursing_notes').select('*').eq('patient_id', patientId);
    if (fromDate) q5 = q5.gte('date', fromDate);
    if (toDate) q5 = q5.lte('date', toDate);
    var res5 = await q5.order('date', { ascending: false });
    if (!res5.error) nursingNotes = res5.data || [];
  } catch (e) {
    console.error('[shift-summary] data load error', e);
  }

  // Vital signs จาก cache (db.vitalSigns) — กรองตาม range
  var allVitals = db.vitalSigns[pid] || [];
  var vitals = allVitals.filter(function(v) {
    if (!v.recordedAt) return false;
    var d = v.recordedAt.slice(0,10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  // Group by shift — pass all 6 data sources
  var buckets = _ssGroupByShift(vitals, excretions, fluids, appointments, incidents, nursingNotes, fromDate, toDate);
  var keys = Object.keys(buckets).sort(function(a,b){ return b.localeCompare(a); });  // ล่าสุดบน

  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">ไม่มีข้อมูลในช่วงที่เลือก</div>';
    return;
  }

  var html = '';
  // Banner รวมจำนวน reopen pending (ถ้าเป็น approver และมี pending)
  var pendingReopens = [];
  Object.keys(manual).forEach(function(mk) {
    if (manual[mk].reopen_requested) pendingReopens.push(manual[mk]);
  });
  if (pendingReopens.length > 0 && _ssCanApproveReopen()) {
    html += '<div style="background:var(--warning-bg);border-left:4px solid var(--warning-text);border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#8a4d00;">';
    html += '<strong>⚠️ มีคำขอเปิดเวรใหม่ ' + pendingReopens.length + ' รายการ</strong> รออนุมัติ (ดูที่ card สีส้มด้านล่าง)';
    html += '</div>';
  }

  keys.forEach(function(k) {
    var b = buckets[k];
    var override = manual[k];
    var isManual = !!override;
    var isClosed = !!(override && override.is_closed);
    var isReopenPending = !!(override && override.reopen_requested);
    var text = isManual ? override.summary_text : _ssGenerateText(b);

    var dateThai = _formatDateTHFromYMD(b.date);
    var summaryId = 'ss-' + k.replace(/[|\-]/g, '_');

    // ── Card style ตาม state ──
    var cardStyle = 'background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;';
    if (isClosed && !isReopenPending) cardStyle = 'background:#f0f9f4;border:1.5px solid var(--success-text);border-radius:10px;padding:14px;margin-bottom:12px;';
    if (isReopenPending) cardStyle = 'background:var(--warning-bg);border:1.5px solid var(--warning-text);border-radius:10px;padding:14px;margin-bottom:12px;';

    html += '<div class="ss-card" style="' + cardStyle + '">';
    html += '  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap;">';
    html += '    <div style="font-weight:700;color:var(--accent2);font-size:14px;flex:1;">📋 สรุปเวร' + b.shift + ' <span style="color:var(--text2);font-weight:500;">' + dateThai + '</span></div>';

    // ── Badge ──
    // [Phase 2 · 20 พ.ค. 69] เพิ่ม badge "🤝 รับแล้ว" สำหรับเวรที่ปิดแล้ว+มีคนรับแล้ว
    var isReceived = !!(override && override.received_by);
    if (isReopenPending) {
      html += '    <span style="font-size:10px;background:#fff;color:var(--warning-text);border:1.5px solid var(--warning-text);padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">⏳ รออนุมัติเปิดเวร</span>';
    } else if (isClosed && isReceived) {
      var receivedAt = override.received_at ? new Date(override.received_at).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
      html += '    <span style="font-size:10px;background:#1f4d38;color:#fff;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">🤝 รับแล้ว · ' + _escapeHtml(override.received_by || '—') + ' · ' + receivedAt + '</span>';
    } else if (isClosed) {
      var closedAt = override.closed_at ? new Date(override.closed_at).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
      html += '    <span style="font-size:10px;background:var(--success-text);color:#fff;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">🔒 ปิดเวรแล้ว · ' + _escapeHtml(override.closed_by || '—') + ' · ' + closedAt + '</span>';
    } else if (isManual) {
      html += '    <span style="font-size:10px;background:var(--warning-bg);color:var(--warning-text);padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">✏️ แก้ไขแล้ว</span>';
    } else {
      html += '    <span style="font-size:10px;background:var(--success-bg);color:var(--success-text);padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">🤖 สรุปอัตโนมัติ</span>';
    }
    html += '  </div>';

    // ── Reopen request info (ถ้ามี) ──
    if (isReopenPending) {
      var reqAt = override.reopen_requested_at ? new Date(override.reopen_requested_at).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
      html += '  <div style="background:#fff;border-left:4px solid var(--warning-text);padding:10px 12px;margin-bottom:10px;font-size:12px;line-height:1.6;border-radius:4px;">';
      html += '    <div style="font-weight:700;color:var(--warning-text);margin-bottom:4px;">📝 คำขอเปิดเวรจาก ' + (override.reopen_requested_by || '—') + ' · ' + reqAt + '</div>';
      if (override.reopen_reason) {
        html += '    <div style="color:var(--text);">เหตุผล: <em>' + _escapeHtml(override.reopen_reason) + '</em></div>';
      }
      html += '  </div>';
    }

    html += '  <div id="' + summaryId + '-view" style="font-size:13px;line-height:1.65;color:var(--text);white-space:pre-wrap;">' + _escapeHtml(text) + '</div>';
    html += '  <textarea id="' + summaryId + '-edit" style="display:none;width:100%;min-height:160px;padding:10px;font-size:13px;line-height:1.6;border:1.5px solid var(--accent);border-radius:6px;font-family:inherit;resize:vertical;">' + _escapeHtml(text) + '</textarea>';

    // ── Actions ──
    html += '  <div id="' + summaryId + '-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">';
    html += '    <button class="btn btn-ghost btn-sm" onclick="_ssCopy(\'' + summaryId + '\')" style="font-size:11px;">📋 คัดลอก</button>';
    html += '    <button class="btn btn-ghost btn-sm" onclick="_ssPrint(\'' + summaryId + '\', \'' + b.shift + '\', \'' + b.date + '\')" style="font-size:11px;">🖨️ พิมพ์</button>';
    html += '    <button class="btn btn-ghost btn-sm" onclick="_ssExportPDF(\'' + summaryId + '\', \'' + b.shift + '\', \'' + b.date + '\')" style="font-size:11px;">📤 PDF</button>';

    if (!isClosed) {
      // เปิดอยู่ — ให้แก้ + ปิดเวร + regenerate (ถ้า manual)
      html += '    <button class="btn btn-ghost btn-sm" onclick="_ssEdit(\'' + summaryId + '\')" style="font-size:11px;">✏️ แก้ไข</button>';
      if (isManual) {
        html += '    <button class="btn btn-ghost btn-sm" onclick="_ssRegenerate(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;color:var(--orange);">🔄 สร้างใหม่อัตโนมัติ</button>';
      }
      html += '    <button class="btn btn-primary btn-sm" onclick="_ssOpenCloseModal(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\',\'' + summaryId + '\')" style="font-size:11px;font-weight:600;">🔒 ปิดเวร / สรุปส่งเวร</button>';
    } else {
      // ปิดแล้ว — โชว์ปุ่มเปิดเวร / ขออนุมัติ
      // [Phase 2 · 20 พ.ค. 69] เพิ่มปุ่ม "✓ รับเวร" ถ้าปิดแล้วและยังไม่มีคนรับ
      if (isClosed && !isReceived && _ssCanOperateHandover()) {
        html += '    <button class="btn btn-primary btn-sm" onclick="_ssDoReceive(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;font-weight:600;background:#1f4d38;border-color:#1f4d38;">✓ รับเวร</button>';
      }
      if (_ssCanReopenDirectly()) {
        html += '    <button class="btn btn-ghost btn-sm" onclick="_ssDoReopen(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;color:var(--orange);">🔓 เปิดเวรใหม่</button>';
      } else if (_ssIsCaregiver() && !isReopenPending) {
        html += '    <button class="btn btn-ghost btn-sm" onclick="_ssOpenReopenRequest(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;color:var(--orange);">📨 ขอเปิดเวร</button>';
      }

      // Approver — มี request pending → approve / deny
      if (isReopenPending && _ssCanApproveReopen()) {
        html += '    <button class="btn btn-primary btn-sm" onclick="_ssApproveReopen(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;background:var(--success-text);border-color:var(--success-text);">✅ อนุมัติ</button>';
        html += '    <button class="btn btn-ghost btn-sm" onclick="_ssDenyReopenAction(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\')" style="font-size:11px;color:var(--red);">❌ ปฏิเสธ</button>';
      }
    }
    html += '  </div>';

    // Save action group (edit mode)
    html += '  <div id="' + summaryId + '-save-actions" style="display:none;gap:6px;margin-top:10px;">';
    html += '    <button class="btn btn-primary btn-sm" onclick="_ssSaveEdit(\'' + patientId + '\',\'' + pid + '\',\'' + b.date + '\',\'' + b.shift + '\',\'' + summaryId + '\')" style="font-size:12px;">💾 บันทึก</button>';
    html += '    <button class="btn btn-ghost btn-sm" onclick="_ssCancelEdit(\'' + summaryId + '\')" style="font-size:12px;">ยกเลิก</button>';
    html += '  </div>';

    html += '</div>';
  });

  container.innerHTML = html;
}

// ── Helpers ──
function _escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _formatDateTHFromYMD(s) {
  if (!s) return '—';
  var p = s.split('-');
  if (p.length !== 3) return s;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// ── Actions (window-scoped) ──
window._ssCopy = function(summaryId) {
  var el = document.getElementById(summaryId + '-view');
  if (!el) return;
  var text = el.textContent || el.innerText;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      toast('คัดลอกแล้ว', 'success');
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('คัดลอกแล้ว', 'success'); } catch(e) {}
    document.body.removeChild(ta);
  }
};

window._ssPrint = function(summaryId, shift, date) {
  var el = document.getElementById(summaryId + '-view');
  if (!el) return;
  var text = el.textContent || el.innerText;
  var dateThai = _formatDateTHFromYMD(date);
  var w = window.open('', '_blank');
  w.document.write('<html><head><title>สรุปเวร' + shift + ' ' + dateThai + '</title>' +
    '<style>body{font-family:"Sarabun",sans-serif;padding:30px;line-height:1.7;font-size:14px;}' +
    'h2{color:#2e6b4f;border-bottom:2px solid #2e6b4f;padding-bottom:8px;}' +
    '.meta{font-size:11px;color:#888;margin-top:20px;}</style></head><body>' +
    '<h2>📋 สรุปอาการ — เวร' + shift + ' ' + dateThai + '</h2>' +
    '<div>' + _escapeHtml(text).replace(/\n/g,'<br>') + '</div>' +
    '<div class="meta">พิมพ์เมื่อ: ' + new Date().toLocaleString('th-TH') + '</div>' +
    '</body></html>');
  w.document.close();
  setTimeout(function() { w.print(); }, 500);
};

window._ssEdit = function(summaryId) {
  document.getElementById(summaryId + '-view').style.display = 'none';
  document.getElementById(summaryId + '-edit').style.display = 'block';
  document.getElementById(summaryId + '-actions').style.display = 'none';
  document.getElementById(summaryId + '-save-actions').style.display = 'flex';
};

window._ssCancelEdit = function(summaryId) {
  // Reset textarea เป็นค่าที่อยู่ใน view
  var view = document.getElementById(summaryId + '-view');
  var edit = document.getElementById(summaryId + '-edit');
  if (view && edit) edit.value = view.textContent || view.innerText;
  view.style.display = 'block';
  edit.style.display = 'none';
  document.getElementById(summaryId + '-actions').style.display = 'flex';
  document.getElementById(summaryId + '-save-actions').style.display = 'none';
};

window._ssSaveEdit = async function(patientId, pid, date, shift, summaryId) {
  var edit = document.getElementById(summaryId + '-edit');
  if (!edit) return;
  var text = (edit.value || '').trim();
  if (!text) { toast('กรุณากรอกข้อความ', 'warning'); return; }
  var res = await _ssSaveSummary(patientId, date, shift, text);
  if (res.error) { toast('บันทึกไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  // อัปเดต cache
  if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
  window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
  toast('บันทึกแล้ว', 'success');
  // Re-render section
  var container = document.getElementById('shift-summary-container');
  if (container) {
    var f = document.getElementById('vital-filter-from');
    var t = document.getElementById('vital-filter-to');
    await _ssRenderSection(container, patientId, pid, f ? f.value : null, t ? t.value : null);
  }
};

window._ssRegenerate = async function(patientId, pid, date, shift) {
  if (!(await customConfirm('สร้างใหม่อัตโนมัติ? — ข้อความที่แก้ไว้จะหายไป'))) return;
  var res = await _ssDeleteSummary(patientId, date, shift);
  if (res.error) { toast('ไม่สามารถลบ override: ' + res.error.message, 'error'); return; }
  // ล้าง cache
  if (window._shiftSummaryCache[patientId]) delete window._shiftSummaryCache[patientId][_ssKey(date, shift)];
  toast('สร้างใหม่แล้ว', 'success');
  // Re-render
  var container = document.getElementById('shift-summary-container');
  if (container) {
    var f = document.getElementById('vital-filter-from');
    var t = document.getElementById('vital-filter-to');
    await _ssRenderSection(container, patientId, pid, f ? f.value : null, t ? t.value : null);
  }
};

window._ssExportPDF = function(summaryId, shift, date) {
  // ใช้ print แต่แนะนำให้ "Save as PDF" ในกล่อง print dialog
  var el = document.getElementById(summaryId + '-view');
  if (!el) return;
  var text = el.textContent || el.innerText;
  var dateThai = _formatDateTHFromYMD(date);
  var w = window.open('', '_blank');
  w.document.write('<html><head><title>สรุปเวร' + shift + ' ' + dateThai + '</title>' +
    '<style>body{font-family:"Sarabun",sans-serif;padding:30px;line-height:1.7;font-size:14px;}' +
    'h2{color:#2e6b4f;border-bottom:2px solid #2e6b4f;padding-bottom:8px;}' +
    '.meta{font-size:11px;color:#888;margin-top:20px;}' +
    '.hint{background:var(--warning-bg);border-left:4px solid var(--warning-text);padding:10px 14px;margin:14px 0;font-size:12px;}</style></head><body>' +
    '<div class="hint">💡 กด Ctrl+P (หรือ Cmd+P) → เลือก "Save as PDF" เพื่อบันทึกเป็น PDF</div>' +
    '<h2>📋 สรุปอาการ — เวร' + shift + ' ' + dateThai + '</h2>' +
    '<div>' + _escapeHtml(text).replace(/\n/g,'<br>') + '</div>' +
    '<div class="meta">สร้างเมื่อ: ' + new Date().toLocaleString('th-TH') + '</div>' +
    '</body></html>');
  w.document.close();
};

// ═══════════════════════════════════════════════════════════════
// 🔒 Close shift modal + Reopen workflow
// ═══════════════════════════════════════════════════════════════

// Helper: re-render section ปัจจุบัน
async function _ssRerender(patientId, pid) {
  var container = document.getElementById('shift-summary-container');
  if (!container) return;
  var f = document.getElementById('vital-filter-from');
  var t = document.getElementById('vital-filter-to');
  await _ssRenderSection(container, patientId, pid, f ? f.value : null, t ? t.value : null);
}

// เปิด modal ยืนยันปิดเวร
window._ssOpenCloseModal = function(patientId, pid, date, shift, summaryId) {
  // ดึง text ปัจจุบัน (จาก view หรือ textarea)
  var view = document.getElementById(summaryId + '-view');
  var editEl = document.getElementById(summaryId + '-edit');
  // ถ้า edit เปิดอยู่ ใช้ค่าใน textarea
  var inEditMode = editEl && editEl.style.display !== 'none';
  var currentText = inEditMode ? editEl.value : (view ? (view.textContent || view.innerText) : '');
  var dateThai = _formatDateTHFromYMD(date);

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:20px;width:600px;max-width:95vw;max-height:92vh;overflow-y:auto;';

  modal.innerHTML =
    '<div style="font-size:16px;font-weight:700;color:var(--success-text);margin-bottom:6px;">🔒 ปิดเวร / สรุปส่งเวร</div>' +
    '<div style="font-size:13px;color:var(--text2);margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">เวร' + shift + ' · ' + dateThai + '</div>' +
    '<div style="background:var(--warning-bg);border-left:4px solid var(--warning-text);padding:10px 14px;margin-bottom:14px;font-size:12px;color:#8a4d00;line-height:1.6;border-radius:4px;">⚠️ การปิดเวรเป็นการรับรองข้อมูลอย่างเป็นทางการ — หลังปิดแล้วจะแก้ไขไม่ได้ (ยกเว้น admin/manager/nurse)</div>' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;">📋 สรุปสุดท้าย (แก้ไขได้):</div>' +
    '<textarea id="close-shift-text" style="width:100%;min-height:200px;padding:12px;font-size:13px;line-height:1.65;border:1.5px solid var(--accent);border-radius:6px;font-family:inherit;resize:vertical;">' + _escapeHtml(currentText) + '</textarea>' +
    '<div style="margin-top:14px;padding:12px;background:var(--surface-2);border-radius:8px;">' +
    '  <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:13px;line-height:1.5;">' +
    '    <input type="checkbox" id="close-shift-confirm" style="width:18px;height:18px;margin-top:2px;flex-shrink:0;">' +
    '    <span><strong>ฉันตรวจสอบและรับรองข้อมูลแล้ว</strong><br><span style="font-size:11px;color:var(--text3);">ข้อมูลในสรุปนี้ถูกต้องและพร้อมส่งต่อ</span></span>' +
    '  </label>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:16px;">' +
    '  <button class="btn btn-ghost" id="close-shift-cancel" style="flex:1;height:44px;font-size:14px;">ยกเลิก</button>' +
    '  <button class="btn btn-primary" id="close-shift-confirm-btn" disabled style="flex:1;height:44px;font-size:14px;font-weight:600;opacity:0.5;cursor:not-allowed;">✅ ยืนยันปิดเวร</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var chk = modal.querySelector('#close-shift-confirm');
  var btnOk = modal.querySelector('#close-shift-confirm-btn');
  var btnCancel = modal.querySelector('#close-shift-cancel');
  var textEl = modal.querySelector('#close-shift-text');

  chk.addEventListener('change', function() {
    btnOk.disabled = !chk.checked;
    btnOk.style.opacity = chk.checked ? '1' : '0.5';
    btnOk.style.cursor = chk.checked ? 'pointer' : 'not-allowed';
  });

  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  btnOk.addEventListener('click', async function() {
    if (!chk.checked) return;
    var finalText = (textEl.value || '').trim();
    if (!finalText) { toast('กรุณากรอกข้อความสรุป', 'warning'); return; }
    btnOk.disabled = true;
    btnOk.textContent = 'กำลังปิดเวร...';

    var res = await _ssCloseShift(patientId, date, shift, finalText);
    if (res.error) {
      toast('ปิดเวรไม่สำเร็จ: ' + res.error.message, 'error');
      btnOk.disabled = false;
      btnOk.textContent = '✅ ยืนยันปิดเวร';
      return;
    }
    // อัปเดต cache
    if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
    window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
    toast('ปิดเวรแล้ว', 'success');
    close();
    await _ssRerender(patientId, pid);
  });
};

// เปิดเวรโดยตรง (สำหรับ admin/manager/nurse/pt-nurse/doctor)
window._ssDoReopen = async function(patientId, pid, date, shift) {
  if (!(await customConfirm('เปิดเวรนี้ใหม่? — ข้อมูลจะแก้ไขได้อีกครั้ง'))) return;
  var res = await _ssReopenShift(patientId, date, shift);
  if (res.error) { toast('เปิดเวรไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
  window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
  toast('เปิดเวรใหม่แล้ว', 'success');
  await _ssRerender(patientId, pid);
};

// [Phase 2 · 20 พ.ค. 69] รับเวร — caregiver กะถัดมาบันทึกว่ารับช่วงต่อแล้ว
window._ssDoReceive = async function(patientId, pid, date, shift) {
  if (!(await customConfirm('รับเวรนี้? — ระบบจะบันทึกชื่อคุณเป็นผู้รับเวร'))) return;
  var res = await _ssReceiveShift(patientId, date, shift);
  if (res.error) { toast('รับเวรไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
  window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
  toast('✓ รับเวรเรียบร้อย', 'success');
  await _ssRerender(patientId, pid);
};

// caregiver ขอเปิดเวร — modal เด้งให้กรอกเหตุผล
window._ssOpenReopenRequest = function(patientId, pid, date, shift) {
  var dateThai = _formatDateTHFromYMD(date);
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:20px;width:500px;max-width:95vw;';

  modal.innerHTML =
    '<div style="font-size:16px;font-weight:700;color:var(--warning-text);margin-bottom:6px;">📨 ขอเปิดเวรใหม่</div>' +
    '<div style="font-size:13px;color:var(--text2);margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">เวร' + shift + ' · ' + dateThai + '</div>' +
    '<div style="background:var(--warning-bg);border-left:4px solid var(--warning-text);padding:10px 14px;margin-bottom:14px;font-size:12px;color:#8a4d00;line-height:1.6;border-radius:4px;">⚠️ คำขอจะถูกส่งไปยังหัวหน้าเวร (admin/manager/nurse) เพื่อพิจารณาอนุมัติ</div>' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;">เหตุผลที่ต้องการเปิดเวร <span style="color:var(--red);">*</span></div>' +
    '<textarea id="reopen-reason" placeholder="เช่น กรอกค่า BP ผิด, ลืมบันทึกการอาเจียน..." style="width:100%;min-height:100px;padding:10px;font-size:13px;line-height:1.5;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;resize:vertical;"></textarea>' +
    '<div style="display:flex;gap:8px;margin-top:16px;">' +
    '  <button class="btn btn-ghost" id="reopen-cancel" style="flex:1;height:44px;font-size:14px;">ยกเลิก</button>' +
    '  <button class="btn btn-primary" id="reopen-submit" style="flex:1;height:44px;font-size:14px;font-weight:600;background:var(--warning-text);border-color:var(--warning-text);">📨 ส่งคำขอ</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  modal.querySelector('#reopen-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  modal.querySelector('#reopen-submit').addEventListener('click', async function() {
    var reason = (modal.querySelector('#reopen-reason').value || '').trim();
    if (!reason) { toast('กรุณากรอกเหตุผล', 'warning'); return; }
    var res = await _ssRequestReopen(patientId, date, shift, reason);
    if (res.error) { toast('ส่งคำขอไม่สำเร็จ: ' + res.error.message, 'error'); return; }
    if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
    window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
    toast('ส่งคำขอเปิดเวรแล้ว — รออนุมัติ', 'success');
    close();
    await _ssRerender(patientId, pid);
  });
};

// อนุมัติคำขอ reopen
window._ssApproveReopen = async function(patientId, pid, date, shift) {
  if (!(await customConfirm('อนุมัติคำขอเปิดเวรนี้?'))) return;
  var res = await _ssReopenShift(patientId, date, shift);  // re-use reopen logic
  if (res.error) { toast('อนุมัติไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
  window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
  toast('อนุมัติแล้ว — เวรเปิดให้แก้ไขได้', 'success');
  await _ssRerender(patientId, pid);
};

// ปฏิเสธคำขอ reopen
window._ssDenyReopenAction = async function(patientId, pid, date, shift) {
  if (!(await customConfirm('ปฏิเสธคำขอเปิดเวรนี้?'))) return;
  var res = await _ssDenyReopen(patientId, date, shift);
  if (res.error) { toast('ปฏิเสธไม่สำเร็จ: ' + res.error.message, 'error'); return; }
  if (!window._shiftSummaryCache[patientId]) window._shiftSummaryCache[patientId] = {};
  window._shiftSummaryCache[patientId][_ssKey(date, shift)] = res.data;
  toast('ปฏิเสธคำขอแล้ว', 'success');
  await _ssRerender(patientId, pid);
};
