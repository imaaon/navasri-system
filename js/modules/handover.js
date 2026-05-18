// ═══════════════════════════════════════════════════════════════════
// PHASE 2 · #4 Shift Handover
// ─────────────────────────────────────────────────────────────────
//   หน้ารายงาน "ส่งเวร" — รวมข้อมูลสำคัญของกะที่จบลงเพื่อส่งต่อกะใหม่
//
//   2 กะ:  เช้า 7:00-19:00, ดึก 19:00-7:00
//
//   8 Sections:
//     1. Shift selector (auto + override)
//     2. Recorder/ACK info
//     3. Stats strip
//     4. 🚨 เร่งด่วน (vital out-of-range + new incident)
//     5. 🩹 ต้องติดตาม > 24 ชม. (incident infection/bleeding/wound)
//     6. 💊 ยาสำคัญ (ใหม่/ฉีด/PRN/ปรับเปลี่ยน)
//     7. 📅 นัดหมาย 24 ชม.ข้างหน้า + preparation
//     8. 📝 หมายเหตุพิเศษ (handover_note from nursing_notes — editable)
//   + ปุ่ม ✓ รับเวร (ลง audit trail ใน shift_handover_acks)
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  let _currentShift = null;        // 'morning' | 'night'
  let _currentDate = null;         // YYYY-MM-DD
  let _aggregatedData = null;      // cached result
  let _isLoading = false;

  // ── Helpers ──────────────────────────────────────────────────────
  function _escape(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[<>&"']/g, function(c) {
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function _todayYMD() {
    return new Date().toISOString().slice(0, 10);
  }

  function _yesterdayYMD() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function _tomorrowYMD() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function _thDate(dateStr) {
    if (!dateStr) return '-';
    const d = String(dateStr).slice(0, 10).split('-');
    if (d.length !== 3) return dateStr;
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return parseInt(d[2]) + ' ' + months[parseInt(d[1])-1] + ' ' + (parseInt(d[0])+543).toString().slice(2);
  }

  function _thDateTime(ts) {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return _thDate(d.toISOString().slice(0,10)) + ' ' + d.toTimeString().slice(0,5);
    } catch (e) { return ts; }
  }

  function _patientLookup(id) {
    if (typeof db === 'undefined' || !db.patients) return null;
    return db.patients.find(function(p) { return String(p.id) === String(id); });
  }

  function _getCurrentUser() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
    } catch (e) {}
    return null;
  }

  // ── Auto-detect shift ─────────────────────────────────────────────
  function _detectShift() {
    const now = new Date();
    const hour = now.getHours();
    const today = _todayYMD();
    const yesterday = _yesterdayYMD();

    // 6:30-12:00 = กำลังจะรับเวรเช้า → ดูเวรดึกที่ผ่านมา (เริ่มเมื่อ 19:00 เมื่อวาน)
    if (hour >= 6 && hour < 12) {
      return { shift: 'night', date: yesterday, label: 'เวรดึก (จาก ' + _thDate(yesterday) + ')' };
    }
    // 12:00-18:30 = อยู่กลางเวรเช้า → ดูเวรเช้าวันนี้
    if (hour >= 12 && hour < 19) {
      return { shift: 'morning', date: today, label: 'เวรเช้าวันนี้' };
    }
    // 19:00-06:00 = อยู่ในเวรดึก → ดูเวรเช้าที่ผ่านมา
    if (hour >= 19) {
      return { shift: 'morning', date: today, label: 'เวรเช้าวันนี้ (จบไปแล้ว)' };
    }
    // 0:00-6:30 = อยู่ในเวรดึก ดูเวรดึกที่กำลังจะจบ
    return { shift: 'night', date: yesterday, label: 'เวรดึก (กำลังจะจบ)' };
  }

  // ── Shift Time Range ─────────────────────────────────────────────
  function _getShiftTimeRange(date, shift) {
    // morning: date 07:00 → date 19:00
    // night:   date 19:00 → next day 07:00
    if (shift === 'morning') {
      return {
        start: date + 'T07:00:00+07:00',
        end:   date + 'T19:00:00+07:00'
      };
    } else {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const nextYMD = next.toISOString().slice(0, 10);
      return {
        start: date + 'T19:00:00+07:00',
        end:   nextYMD + 'T07:00:00+07:00'
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // VITAL OUT-OF-RANGE CHECK
  // ─────────────────────────────────────────────────────────────────
  function _checkVitalAbnormal(v) {
    const issues = [];
    if (v.bp_sys !== null && v.bp_sys !== undefined) {
      const sys = Number(v.bp_sys);
      if (sys >= 160) issues.push({ type: 'BP สูง', value: sys + '/' + (v.bp_dia||'-'), severity: 'high' });
      else if (sys <= 90) issues.push({ type: 'BP ต่ำ', value: sys + '/' + (v.bp_dia||'-'), severity: 'high' });
    }
    if (v.bp_dia !== null && v.bp_dia !== undefined) {
      const dia = Number(v.bp_dia);
      if (dia >= 100) issues.push({ type: 'BP สูง (Dia)', value: (v.bp_sys||'-') + '/' + dia, severity: 'medium' });
      else if (dia <= 50) issues.push({ type: 'BP ต่ำ (Dia)', value: (v.bp_sys||'-') + '/' + dia, severity: 'medium' });
    }
    if (v.temp !== null && v.temp !== undefined) {
      const temp = Number(v.temp);
      if (temp >= 38) issues.push({ type: 'ไข้สูง', value: temp + '°C', severity: temp >= 39 ? 'high' : 'medium' });
      else if (temp <= 35) issues.push({ type: 'อุณหภูมิต่ำ', value: temp + '°C', severity: 'high' });
    }
    if (v.spo2 !== null && v.spo2 !== undefined) {
      const spo2 = Number(v.spo2);
      if (spo2 <= 92) issues.push({ type: 'SpO₂ ต่ำ', value: spo2 + '%', severity: spo2 <= 88 ? 'high' : 'medium' });
    }
    if (v.hr !== null && v.hr !== undefined) {
      const hr = Number(v.hr);
      if (hr >= 120) issues.push({ type: 'HR เร็ว', value: hr + ' bpm', severity: 'medium' });
      else if (hr <= 50) issues.push({ type: 'HR ช้า', value: hr + ' bpm', severity: 'high' });
    }
    if (v.dtx !== null && v.dtx !== undefined) {
      const dtx = Number(v.dtx);
      if (dtx >= 250) issues.push({ type: 'DTX สูง', value: dtx + ' mg/dL', severity: 'high' });
      else if (dtx <= 70) issues.push({ type: 'DTX ต่ำ', value: dtx + ' mg/dL', severity: 'high' });
    }
    return issues;
  }

  // ─────────────────────────────────────────────────────────────────
  // ยาสำคัญ — Filter
  // ─────────────────────────────────────────────────────────────────
  function _isImportantMed(m, shiftDate) {
    if (!m.is_active) return null;
    // 🆕 ใหม่ (start_date ภายใน 7 วัน)
    if (m.start_date) {
      const start = new Date(m.start_date);
      const target = new Date(shiftDate);
      const diff = Math.floor((target - start) / (1000*60*60*24));
      if (diff >= 0 && diff <= 7) return 'new';
    }
    // 💉 ฉีด
    const route = String(m.route || '').toLowerCase();
    if (route.includes('iv') || route.includes('im') || route.includes('sc') ||
        route.includes('inj') || route.includes('ฉีด')) return 'injection';
    // PRN / ครั้งคราว (มีใน note หรือ timings)
    const note = String(m.note || '').toLowerCase();
    if (note.includes('prn') || note.includes('ครั้งคราว') || note.includes('เมื่อมีอาการ') ||
        note.includes('as needed')) return 'prn';
    // ปรับเปลี่ยน (มี note อัพเดท note ที่บ่งบอก)
    if (note.includes('ปรับ') || note.includes('เปลี่ยน') || note.includes('adjust') ||
        note.includes('change') || note.includes('เพิ่ม') || note.includes('ลด')) return 'changed';
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // EXCRETION / FLUID ABNORMAL CHECK (เพิ่ม 18 พ.ค. 2569)
  // ─────────────────────────────────────────────────────────────────
  // type: 'urine' | 'stool' | 'vomit'
  // characteristics: string (อาจมีหลายค่าคั่นด้วย comma เช่น "ใส, มีเลือดปน")
  // คืน null ถ้าไม่ผิดปกติ หรือ object { type, value, severity }
  function _checkExcretionUrgent(type, characteristics) {
    if (!characteristics) return null;
    var chars = String(characteristics);
    // เลือดปน — ทุกประเภท = high
    if (chars.indexOf('เลือด') >= 0) {
      var bloodLabel = type === 'urine' ? '🩸 ปัสสาวะมีเลือด'
                     : type === 'stool' ? '🩸 อุจจาระมีเลือด'
                     : '🩸 อาเจียนมีเลือด';
      return { type: bloodLabel, value: chars, severity: 'high' };
    }
    if (type === 'urine') {
      if (chars.indexOf('เหลืองเข้ม') >= 0) return { type: '💛 ปัสสาวะเหลืองเข้ม', value: chars, severity: 'medium' };
      if (chars.indexOf('น้ำตาล') >= 0)     return { type: '💛 ปัสสาวะสีน้ำตาล', value: chars, severity: 'medium' };
      if (chars.indexOf('ขุ่น') >= 0)        return { type: '💛 ปัสสาวะขุ่น/มีตะกอน', value: chars, severity: 'medium' };
    } else if (type === 'stool') {
      if (chars.indexOf('เหลวเป็นน้ำ') >= 0) return { type: '💩 ท้องเสียรุนแรง (เหลวเป็นน้ำ)', value: chars, severity: 'high' };
      if (chars.indexOf('เหลว') >= 0)        return { type: '💩 อุจจาระเหลว', value: chars, severity: 'medium' };
    } else if (type === 'vomit') {
      if (chars.indexOf('น้ำดี') >= 0) return { type: '🤢 อาเจียนมีน้ำดี', value: chars, severity: 'medium' };
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────────
  async function _fetchAllData(date, shift) {
    if (typeof supa === 'undefined') return null;
    const range = _getShiftTimeRange(date, shift);
    const tomorrow = _tomorrowYMD();
    const today = _todayYMD();

    try {
      const results = await Promise.all([
        // [1] Vital signs ในกะนี้
        supa.from('vital_signs')
          .select('*')
          .gte('recorded_at', range.start)
          .lte('recorded_at', range.end)
          .order('recorded_at', { ascending: false })
          .limit(200),
        // [2] Incident reports ในกะนี้ — [BUG FIX 18 พ.ค. 2569] เปลี่ยนจาก date filter เป็น time range
        //     เพื่อให้ consistent กับ vital_signs/patient_excretions/patient_fluid_records
        //     เดิม: filter ด้วย date 18 พ.ค. → 19 พ.ค. → incident กะเช้าเด้งไปกะดึก
        //     ใหม่: filter ด้วย created_at อยู่ในช่วงเวลาของกะ → incident หายเมื่อเปลี่ยนกะ
        supa.from('incident_reports')
          .select('*')
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .order('created_at', { ascending: false })
          .limit(50),
        // [3] Incident ที่ต้องติดตาม > 24 ชม. (last 7 days)
        supa.from('incident_reports')
          .select('*')
          .gte('date', _yesterdayYMD())
          .order('date', { ascending: false })
          .limit(50),
        // [4] Wounds active
        supa.from('patient_wounds')
          .select('*')
          .order('wound_date', { ascending: false })
          .limit(30),
        // [5] Active medications (สำหรับ filter ยาสำคัญ)
        supa.from('patient_medications')
          .select('*')
          .eq('is_active', true)
          .limit(500),
        // [6] นัดหมาย 24 ชม.ข้างหน้า
        supa.from('patient_appointments')
          .select('*')
          .gte('appt_date', today)
          .lte('appt_date', tomorrow)
          .order('appt_date', { ascending: true })
          .order('appt_time', { ascending: true })
          .limit(50),
        // [7] Nursing notes ของกะนี้ (handover_note)
        supa.from('nursing_notes')
          .select('*')
          .eq('date', date)
          .eq('shift', shift)
          .order('created_at', { ascending: false }),
        // [8] Existing ACKs สำหรับกะนี้
        supa.from('shift_handover_acks')
          .select('*')
          .eq('shift_date', date)
          .eq('shift', shift)
          .order('acked_at', { ascending: true }),
        // [9] Patient excretions (อุจจาระ/ปัสสาวะ) — ในช่วงเวลาของกะ (เพิ่ม 18 พ.ค. 2569)
        supa.from('patient_excretions')
          .select('*')
          .gte('recorded_at', range.start)
          .lte('recorded_at', range.end)
          .order('recorded_at', { ascending: false })
          .limit(200),
        // [10] Patient fluid records (อาเจียน/อื่นๆ) — ในช่วงเวลาของกะ (เพิ่ม 18 พ.ค. 2569)
        supa.from('patient_fluid_records')
          .select('*')
          .gte('recorded_at', range.start)
          .lte('recorded_at', range.end)
          .order('recorded_at', { ascending: false })
          .limit(200),
      ]);

      return {
        vitals: results[0]?.data || [],
        incidentsInShift: results[1]?.data || [],
        incidentsRecent: results[2]?.data || [],
        wounds: results[3]?.data || [],
        meds: results[4]?.data || [],
        appointments: results[5]?.data || [],
        nursingNotes: results[6]?.data || [],
        acks: results[7]?.data || [],
        excretions: results[8]?.data || [],
        fluidRecords: results[9]?.data || [],
      };
    } catch (e) {
      console.error('[handover] fetch error:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  function _renderShiftHeader() {
    const detected = _detectShift();
    if (!_currentShift) _currentShift = detected.shift;
    if (!_currentDate) _currentDate = detected.date;

    const shiftLabel = _currentShift === 'morning' ? '🌞 เวรเช้า (7:00 - 19:00)' : '🌙 เวรดึก (19:00 - 7:00)';
    const dateLabel = _thDate(_currentDate);
    const autoLabel = detected.shift === _currentShift && detected.date === _currentDate
      ? '<span class="ho-auto-pill">⚡ Auto</span>' : '';

    return '' +
      '<div class="ho-header">' +
        '<div class="ho-title-block">' +
          '<h1 class="ho-title">📋 ส่งเวร</h1>' +
          '<div class="ho-subtitle">' + shiftLabel + ' · ' + dateLabel + ' ' + autoLabel + '</div>' +
        '</div>' +
        '<div class="ho-actions">' +
          '<select id="ho-shift-select" class="ho-select" onchange="_handoverChangeShift()">' +
            '<option value="morning" ' + (_currentShift === 'morning' ? 'selected' : '') + '>🌞 เวรเช้า</option>' +
            '<option value="night" ' + (_currentShift === 'night' ? 'selected' : '') + '>🌙 เวรดึก</option>' +
          '</select>' +
          '<input type="date" id="ho-date-input" class="ho-date-input" value="' + _currentDate + '" max="' + _todayYMD() + '" onchange="_handoverChangeDate()">' +
          '<button class="btn btn-ghost btn-sm" onclick="_handoverPrint()">🖨 พิมพ์</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="_handoverReload()">🔄</button>' +
        '</div>' +
      '</div>';
  }

  function _renderACKBar(data) {
    const acks = data.acks || [];
    if (acks.length === 0) {
      return '<div class="ho-ack-bar ho-ack-bar-empty">' +
        '<span>⏳ ยังไม่มีผู้รับเวรนี้</span>' +
        '<button class="btn btn-primary btn-sm" onclick="_handoverAck()">✓ รับเวร</button>' +
        '</div>';
    }
    const u = _getCurrentUser();
    const currentUserName = u?.username || u?.displayName || '';
    const alreadyAcked = acks.some(function(a) { return a.acked_by === currentUserName; });

    const ackList = acks.map(function(a) {
      return '<div class="ho-ack-item">' +
        '<span class="ho-ack-check">✓</span> ' +
        '<strong>' + _escape(a.acked_by) + '</strong>' +
        (a.acked_by_role ? ' (' + _escape(a.acked_by_role) + ')' : '') +
        ' · <span style="color:#888;">' + _thDateTime(a.acked_at) + '</span>' +
        '</div>';
    }).join('');

    return '<div class="ho-ack-bar ho-ack-bar-filled">' +
      '<div class="ho-ack-list">' +
        '<div class="ho-ack-title">📝 รับเวรแล้ว · ' + acks.length + ' คน</div>' +
        ackList +
      '</div>' +
      (alreadyAcked
        ? '<span class="ho-ack-you">✓ คุณรับเวรแล้ว</span>'
        : '<button class="btn btn-primary btn-sm" onclick="_handoverAck()">✓ รับเวร</button>') +
      '</div>';
  }

  function _renderStats(data) {
    // Count abnormal vital
    let abnormalCount = 0;
    data.vitals.forEach(function(v) {
      if (_checkVitalAbnormal(v).length > 0) abnormalCount++;
    });

    // Important meds
    let importantMedCount = 0;
    data.meds.forEach(function(m) {
      if (_isImportantMed(m, _currentDate)) importantMedCount++;
    });

    // Appointments tomorrow
    const tomorrow = _tomorrowYMD();
    const apptTomorrow = data.appointments.filter(function(a) { return a.appt_date === tomorrow; }).length;

    return '<div class="ho-stats-grid">' +
      '<div class="ho-stat-card"><div class="ho-stat-icon">🩺</div><div class="ho-stat-num">' + data.vitals.length + '</div><div class="ho-stat-label">vital บันทึก</div></div>' +
      '<div class="ho-stat-card ' + (abnormalCount > 0 ? 'ho-stat-warn' : '') + '"><div class="ho-stat-icon">⚠️</div><div class="ho-stat-num">' + abnormalCount + '</div><div class="ho-stat-label">vital ผิดเกณฑ์</div></div>' +
      '<div class="ho-stat-card ' + (data.incidentsInShift.length > 0 ? 'ho-stat-warn' : '') + '"><div class="ho-stat-icon">🚨</div><div class="ho-stat-num">' + data.incidentsInShift.length + '</div><div class="ho-stat-label">incident ในกะ</div></div>' +
      '<div class="ho-stat-card"><div class="ho-stat-icon">💊</div><div class="ho-stat-num">' + importantMedCount + '</div><div class="ho-stat-label">ยาสำคัญ</div></div>' +
      '<div class="ho-stat-card"><div class="ho-stat-icon">📅</div><div class="ho-stat-num">' + apptTomorrow + '</div><div class="ho-stat-label">นัดพรุ่งนี้</div></div>' +
      '</div>';
  }

  function _renderUrgent(data) {
    const items = [];

    // Abnormal vitals
    data.vitals.forEach(function(v) {
      const issues = _checkVitalAbnormal(v);
      if (issues.length === 0) return;
      const p = _patientLookup(v.patient_id);
      issues.forEach(function(iss) {
        items.push({
          time: v.recorded_at,
          patient: p ? p.name : ('ID ' + v.patient_id),
          patId: v.patient_id,
          type: iss.type,
          detail: iss.value,
          severity: iss.severity,
          icon: '🩺'
        });
      });
    });

    // New incidents in shift
    data.incidentsInShift.forEach(function(inc) {
      items.push({
        time: inc.created_at,
        patient: inc.patient_name || (_patientLookup(inc.patient_id)?.name || '-'),
        patId: inc.patient_id,
        type: inc.type || 'incident',
        detail: (inc.detail || '').slice(0, 80),
        severity: inc.severity === 'รุนแรง' || inc.severity === 'severe' ? 'high' : 'medium',
        icon: '🚨'
      });
    });

    // [เพิ่ม 18 พ.ค. 2569] Abnormal excretions (urine + stool)
    (data.excretions || []).forEach(function(ex) {
      var issue = _checkExcretionUrgent(ex.type, ex.characteristics);
      if (!issue) return;
      var p = _patientLookup(ex.patient_id);
      items.push({
        time: ex.recorded_at,
        patient: p ? p.name : ('ID ' + ex.patient_id),
        patId: ex.patient_id,
        type: issue.type,
        detail: issue.value + (ex.note ? ' · ' + ex.note : ''),
        severity: issue.severity,
        icon: ''  // icon รวมอยู่ใน type label แล้ว
      });
    });

    // [เพิ่ม 18 พ.ค. 2569] Abnormal fluid records (vomit) — characteristics เก็บใน note ในรูปแบบ '[ลักษณะ: xxx]'
    (data.fluidRecords || []).forEach(function(fr) {
      if (fr.fluid_type !== 'vomit') return;  // เอาแค่ vomit เพื่อตรวจเลือด/น้ำดี
      // Extract characteristics จาก note: '[ลักษณะ: มีเลือดปน] ...'
      var noteStr = String(fr.note || '');
      var charMatch = noteStr.match(/\[ลักษณะ:\s*([^\]]+)\]/);
      var chars = charMatch ? charMatch[1].trim() : '';
      if (!chars) return;
      var issue = _checkExcretionUrgent('vomit', chars);
      if (!issue) return;
      var p = _patientLookup(fr.patient_id);
      // ลบส่วน [ลักษณะ: ...] ออกจาก note ที่จะแสดง
      var displayNote = noteStr.replace(/\[ลักษณะ:[^\]]+\]\s*/, '').trim();
      items.push({
        time: fr.recorded_at,
        patient: p ? p.name : ('ID ' + fr.patient_id),
        patId: fr.patient_id,
        type: issue.type,
        detail: issue.value + (displayNote ? ' · ' + displayNote : ''),
        severity: issue.severity,
        icon: ''
      });
    });

    // Sort by time desc
    items.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });

    if (items.length === 0) {
      return _section('🚨 เร่งด่วน · ต้องเฝ้าระวัง', '<div class="ho-empty">ไม่พบเหตุการณ์ผิดเกณฑ์ในกะนี้</div>');
    }

    const html = items.slice(0, 20).map(function(it) {
      const sevClass = it.severity === 'high' ? 'ho-sev-high' : 'ho-sev-med';
      const iconStr = it.icon ? it.icon + ' ' : '';  // [ปรับ 18 พ.ค. 2569] รองรับ icon ว่าง (กรณี excretion ที่ icon รวมใน type label แล้ว)
      return '<div class="ho-urgent-item ' + sevClass + '">' +
        '<div class="ho-urgent-time">' + _thDateTime(it.time).split(' ').pop() + '</div>' +
        '<div class="ho-urgent-body">' +
          '<div class="ho-urgent-patient" onclick="openPatientProfile(\'' + it.patId + '\')">' + iconStr + _escape(it.patient) + '</div>' +
          '<div class="ho-urgent-detail"><strong>' + _escape(it.type) + '</strong>: ' + _escape(it.detail) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return _section('🚨 เร่งด่วน · ต้องเฝ้าระวัง · ' + items.length, html);
  }

  function _renderFollowUp(data) {
    const items = [];

    // Incidents older than 24h but recent
    const followUpTypes = ['ติดเชื้อ','เลือดออก','แผล','อุบัติเหตุ','พลัดตกหกล้ม','กดทับ','บาดเจ็บ','สำลัก'];
    data.incidentsRecent.forEach(function(inc) {
      const incDate = inc.date;
      if (incDate === _currentDate) return; // already in urgent
      const type = String(inc.type || '');
      const isFollowUp = followUpTypes.some(function(t) { return type.includes(t); });
      if (!isFollowUp) return;
      const p = _patientLookup(inc.patient_id);
      items.push({
        type: 'incident',
        date: inc.date,
        patient: inc.patient_name || (p?.name || '-'),
        patId: inc.patient_id,
        title: inc.type,
        detail: (inc.detail || '').slice(0, 80),
        ageDays: Math.floor((Date.now() - new Date(inc.date).getTime()) / 86400000)
      });
    });

    // Active wounds
    data.wounds.forEach(function(w) {
      const status = String(w.status || '').toLowerCase();
      if (status === 'หาย' || status === 'closed' || status === 'healed') return;
      const p = _patientLookup(w.patient_id);
      items.push({
        type: 'wound',
        date: w.wound_date,
        patient: w.patient_name || (p?.name || '-'),
        patId: w.patient_id,
        title: 'แผล ' + (w.location || ''),
        detail: 'Stage: ' + (w.stage || '-') + ' · ' + (w.appearance || ''),
        ageDays: w.wound_date ? Math.floor((Date.now() - new Date(w.wound_date).getTime()) / 86400000) : 0
      });
    });

    items.sort(function(a, b) { return (a.ageDays || 0) - (b.ageDays || 0); });

    if (items.length === 0) {
      return _section('🩹 ต้องติดตาม · 24 ชม.ขึ้นไป', '<div class="ho-empty">ไม่พบเคสที่ต้องติดตามต่อเนื่อง</div>');
    }

    const html = items.slice(0, 15).map(function(it) {
      const icon = it.type === 'wound' ? '🩹' : '🟠';
      return '<div class="ho-followup-item">' +
        '<div class="ho-followup-icon">' + icon + '</div>' +
        '<div class="ho-followup-body">' +
          '<div class="ho-followup-patient" onclick="openPatientProfile(\'' + it.patId + '\')">' + _escape(it.patient) + '</div>' +
          '<div class="ho-followup-title"><strong>' + _escape(it.title) + '</strong> · ' + it.ageDays + ' วัน</div>' +
          (it.detail ? '<div class="ho-followup-detail">' + _escape(it.detail) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    return _section('🩹 ต้องติดตาม · 24 ชม.ขึ้นไป · ' + items.length, html);
  }

  function _renderImportantMeds(data) {
    const grouped = { new: [], injection: [], prn: [], changed: [] };
    data.meds.forEach(function(m) {
      const cat = _isImportantMed(m, _currentDate);
      if (cat) {
        const p = _patientLookup(m.patient_id);
        m._patient = p ? p.name : ('ID ' + m.patient_id);
        grouped[cat].push(m);
      }
    });

    const totalCount = grouped.new.length + grouped.injection.length + grouped.prn.length + grouped.changed.length;

    if (totalCount === 0) {
      return _section('💊 ยาสำคัญ', '<div class="ho-empty">ไม่พบยาที่จัดเป็นสำคัญในเวรนี้</div>');
    }

    function renderGroup(label, icon, items) {
      if (items.length === 0) return '';
      const rows = items.map(function(m) {
        return '<div class="ho-med-item">' +
          '<span class="ho-med-patient" onclick="openPatientProfile(\'' + m.patient_id + '\')">' + _escape(m._patient) + '</span> · ' +
          '<strong>' + _escape(m.name) + '</strong>' +
          (m.dose ? ' ' + _escape(m.dose) + (m.unit ? ' ' + _escape(m.unit) : '') : '') +
          (m.route ? ' · ' + _escape(m.route) : '') +
          (m.note ? '<div class="ho-med-note">📝 ' + _escape(m.note) + '</div>' : '') +
        '</div>';
      }).join('');
      return '<div class="ho-med-group">' +
        '<div class="ho-med-group-title">' + icon + ' ' + label + ' · ' + items.length + '</div>' +
        rows +
      '</div>';
    }

    const html =
      renderGroup('ใหม่ (≤7 วัน)', '🆕', grouped.new) +
      renderGroup('ยาฉีด', '💉', grouped.injection) +
      renderGroup('PRN / ครั้งคราว', '⏱', grouped.prn) +
      renderGroup('ปรับเปลี่ยน', '🔄', grouped.changed);

    return _section('💊 ยาสำคัญ · ' + totalCount, html);
  }

  function _renderAppointments(data) {
    if (data.appointments.length === 0) {
      return _section('📅 นัดหมาย 24 ชม.ข้างหน้า', '<div class="ho-empty">ไม่มีนัดหมายในช่วงนี้</div>');
    }

    const html = data.appointments.slice(0, 20).map(function(a) {
      const p = _patientLookup(a.patient_id);
      const patName = a.patient_name || (p ? p.name : '-');
      const apptDate = _thDate(a.appt_date);
      const apptTime = a.appt_time ? String(a.appt_time).slice(0,5) : '-';
      const isTomorrow = a.appt_date === _tomorrowYMD();

      // Preparation details
      let prepHTML = '';
      if (a.preparations && Array.isArray(a.preparations) && a.preparations.length > 0) {
        prepHTML = a.preparations.map(function(p) { return '<li>' + _escape(p) + '</li>'; }).join('');
      } else if (a.preparation) {
        prepHTML = '<li>' + _escape(a.preparation) + '</li>';
      }

      return '<div class="ho-appt-item ' + (isTomorrow ? 'ho-appt-tomorrow' : '') + '">' +
        '<div class="ho-appt-time">' +
          '<div class="ho-appt-date">' + apptDate + '</div>' +
          '<div class="ho-appt-hour">' + apptTime + '</div>' +
        '</div>' +
        '<div class="ho-appt-body">' +
          '<div class="ho-appt-patient" onclick="openPatientProfile(\'' + a.patient_id + '\')"><strong>' + _escape(patName) + '</strong></div>' +
          '<div class="ho-appt-meta">' +
            (a.hospital ? '🏥 ' + _escape(a.hospital) : '') +
            (a.doctor ? ' · 👨‍⚕️ ' + _escape(a.doctor) : '') +
            (a.department ? ' · ' + _escape(a.department) : '') +
          '</div>' +
          (a.purpose ? '<div class="ho-appt-purpose">📝 ' + _escape(a.purpose) + '</div>' : '') +
          (prepHTML ? '<div class="ho-appt-prep"><div class="ho-appt-prep-title">⚠️ การเตรียม:</div><ul>' + prepHTML + '</ul></div>' : '') +
          (a.depart_time || a.transport || a.companion
            ? '<div class="ho-appt-transport">' +
              (a.depart_time ? '⏰ ออก ' + _escape(a.depart_time) : '') +
              (a.transport ? ' · 🚗 ' + _escape(a.transport) : '') +
              (a.companion ? ' · 👥 ' + _escape(a.companion) : '') +
            '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    return _section('📅 นัดหมาย 24 ชม.ข้างหน้า · ' + data.appointments.length, html);
  }

  function _renderHandoverNote(data) {
    const notes = data.nursingNotes || [];
    if (notes.length === 0) {
      return _section('📝 หมายเหตุพิเศษจากกะนี้',
        '<div class="ho-empty">ยังไม่มีบันทึกพยาบาลของเวรนี้</div>' +
        '<div class="ho-hint">บันทึก handover_note ได้ในหน้า patient profile → tab บันทึกพยาบาล</div>'
      );
    }
    const noteHTML = notes
      .filter(function(n) { return n.handover_note && n.handover_note.trim(); })
      .map(function(n) {
        const p = _patientLookup(n.patient_id);
        return '<div class="ho-note-item">' +
          '<div class="ho-note-patient" onclick="openPatientProfile(\'' + n.patient_id + '\')">' +
            '<strong>' + _escape(p?.name || 'ผู้พัก') + '</strong>' +
            ' · <span style="color:#888;font-size:11px;">โดย ' + _escape(n.recorded_by || '-') + '</span>' +
            '<button class="ho-note-edit-btn" onclick="event.stopPropagation();_handoverEditNote(' + n.id + ')" title="แก้ไข">✏️</button>' +
          '</div>' +
          '<div class="ho-note-text">' + _escape(n.handover_note) + '</div>' +
        '</div>';
      }).join('');

    if (!noteHTML) {
      return _section('📝 หมายเหตุพิเศษจากกะนี้',
        '<div class="ho-empty">ยังไม่มีหมายเหตุพิเศษ</div>'
      );
    }
    return _section('📝 หมายเหตุพิเศษ · ' + notes.length, noteHTML);
  }

  function _section(title, contentHTML) {
    return '<div class="ho-section">' +
      '<div class="ho-section-title">' + title + '</div>' +
      '<div class="ho-section-body">' + contentHTML + '</div>' +
    '</div>';
  }

  // ─────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────
  async function render() {
    const container = document.getElementById('page-handover');
    if (!container) return;

    if (_isLoading) return;
    _isLoading = true;

    // Set initial state
    if (!_currentShift || !_currentDate) {
      const det = _detectShift();
      _currentShift = det.shift;
      _currentDate = det.date;
    }

    // Show loading
    container.innerHTML =
      _renderShiftHeader() +
      '<div class="ho-loading">⏳ กำลังโหลดข้อมูล...</div>';

    try {
      _aggregatedData = await _fetchAllData(_currentDate, _currentShift);
    } catch (e) {
      container.innerHTML =
        _renderShiftHeader() +
        '<div class="ho-error">❌ โหลดข้อมูลไม่สำเร็จ: ' + _escape(e.message || e) + '</div>';
      _isLoading = false;
      return;
    }

    container.innerHTML =
      _renderShiftHeader() +
      _renderACKBar(_aggregatedData) +
      _renderStats(_aggregatedData) +
      '<div class="ho-grid">' +
        '<div class="ho-col">' +
          _renderUrgent(_aggregatedData) +
          _renderImportantMeds(_aggregatedData) +
        '</div>' +
        '<div class="ho-col">' +
          _renderFollowUp(_aggregatedData) +
          _renderAppointments(_aggregatedData) +
        '</div>' +
      '</div>' +
      _renderHandoverNote(_aggregatedData) +
      '<div class="ho-disclaimer">⚠️ ข้อมูลจากระบบเท่านั้น โปรดตรวจสอบเอกสารและพูดคุยกับพยาบาลกะที่ผ่านมาเพิ่มเติม</div>';

    _isLoading = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────
  async function _ack() {
    const u = _getCurrentUser();
    if (!u || !u.username) {
      if (typeof toast === 'function') toast('กรุณา login ใหม่', 'error');
      return;
    }
    try {
      const { error } = await supa.from('shift_handover_acks').insert({
        shift_date: _currentDate,
        shift: _currentShift,
        acked_by: u.username,
        acked_by_role: u.role || u.position || null,
      });
      if (error) {
        if (String(error.message || '').includes('duplicate')) {
          if (typeof toast === 'function') toast('คุณรับเวรนี้แล้ว', 'info');
        } else {
          throw error;
        }
      } else {
        if (typeof toast === 'function') toast('✓ รับเวรเรียบร้อย', 'success');
      }
      await render();
    } catch (e) {
      console.error('[handover] ack error:', e);
      if (typeof toast === 'function') toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  function _changeShift() {
    const sel = document.getElementById('ho-shift-select');
    if (sel) _currentShift = sel.value;
    render();
  }

  function _changeDate() {
    const inp = document.getElementById('ho-date-input');
    if (inp && inp.value) _currentDate = inp.value;
    render();
  }

  function _reload() {
    render();
  }

  function _print() {
    window.print();
  }

  async function _editNote(noteId) {
    if (!noteId) return;
    const note = (_aggregatedData?.nursingNotes || []).find(function(n) { return String(n.id) === String(noteId); });
    if (!note) {
      if (typeof toast === 'function') toast('ไม่พบบันทึก', 'error');
      return;
    }
    const newText = prompt('แก้ไขหมายเหตุส่งเวร:', note.handover_note || '');
    if (newText === null) return; // cancel
    try {
      const { error } = await supa.from('nursing_notes')
        .update({ handover_note: newText })
        .eq('id', noteId);
      if (error) throw error;
      if (typeof toast === 'function') toast('แก้ไขแล้ว', 'success');
      await render();
    } catch (e) {
      console.error('[handover] edit error:', e);
      if (typeof toast === 'function') toast('แก้ไขไม่สำเร็จ', 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────
  window.renderHandover = render;
  window._handoverAck = _ack;
  window._handoverChangeShift = _changeShift;
  window._handoverChangeDate = _changeDate;
  window._handoverReload = _reload;
  window._handoverPrint = _print;
  window._handoverEditNote = _editNote;
})();
