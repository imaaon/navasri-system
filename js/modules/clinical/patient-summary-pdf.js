// ═══════════════════════════════════════════════════════════════════
// PHASE 2 · #7 Patient Summary PDF (1-page A4)
// ─────────────────────────────────────────────────────────────────
//   "🖨 สรุป" button → 1-click → PDF download
//   1 หน้า A4 fixed layout
//   ใช้สำหรับ: พาผู้พักไป รพ. / ติดหัวเตียง / ส่งหมอ
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────
  function _escape(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[<>&"']/g, function(c) {
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function _thDate(dateStr) {
    if (!dateStr) return '-';
    const d = String(dateStr).slice(0, 10).split('-');
    if (d.length !== 3) return dateStr;
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return parseInt(d[2]) + ' ' + months[parseInt(d[1]) - 1] + ' ' + (parseInt(d[0]) + 543).toString().slice(2);
  }

  function _thDateFull(dateStr) {
    if (!dateStr) return '-';
    const d = String(dateStr).slice(0, 10).split('-');
    if (d.length !== 3) return dateStr;
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return parseInt(d[2]) + ' ' + months[parseInt(d[1]) - 1] + ' ' + (parseInt(d[0]) + 543);
  }

  function _calcAge(dob) {
    if (!dob) return '-';
    try {
      const birth = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    } catch (e) {
      return '-';
    }
  }

  function _initials(name) {
    if (!name) return '?';
    const parts = String(name).replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|พระ|พ\.|ม\.ร\.ว\.)\s*/, '').trim().split(/\s+/);
    if (parts.length === 0) return '?';
    return (parts[0] || '').slice(0, 2);
  }

  function _genderFromIdcard(idcard, sex) {
    // ใช้ sex ก่อนถ้ามี
    if (sex === 'M' || sex === 'male') return 'ชาย';
    if (sex === 'F' || sex === 'female') return 'หญิง';
    // เดาจาก idcard ตำแหน่งที่ 8 (ไม่ใช่กฎ 100% แต่พอใช้ได้)
    return '-';
  }

  function _severityIcon(sev) {
    if (sev === 'severe' || sev === 'รุนแรง') return '🔴';
    if (sev === 'moderate' || sev === 'ปานกลาง') return '🟠';
    return '🟡';
  }

  function _severityLabel(sev) {
    if (sev === 'severe') return 'รุนแรง';
    if (sev === 'moderate' || sev === 'ปานกลาง') return 'ปานกลาง';
    if (sev === 'mild') return 'เล็กน้อย';
    return sev || '-';
  }

  // ─────────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────────

  async function _fetchSummaryData(patId) {
    if (typeof supa === 'undefined') return { vitals: [], consent: null, doctor: null };
    const pidStr = String(patId);
    const results = await Promise.all([
      // Vital signs 7 days
      supa.from('vital_signs')
        .select('recorded_at,bp_sys,bp_dia,hr,temp,spo2,dtx,rr,weight')
        .eq('patient_id', pidStr)
        .order('recorded_at', { ascending: false })
        .limit(7),
      // DNR / Consent
      supa.from('patient_consents')
        .select('dnr_status,dnr_signed_date,dnr_signed_by,cpr_consent,ventilator_consent,preferred_hospital,advance_directive,note')
        .eq('patient_id', pidStr)
        .maybeSingle(),
      // Next appointment (doctor)
      supa.from('patient_appointments')
        .select('hospital,doctor,appt_date,appt_time')
        .eq('patient_id', pidStr)
        .order('appt_date', { ascending: false })
        .limit(1),
    ]);
    return {
      vitals: (results[0]?.data) || [],
      consent: (results[1]?.data) || null,
      lastAppt: ((results[2]?.data) || [])[0] || null,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BUILD HTML (1-page A4)
  // ─────────────────────────────────────────────────────────────────

  function _buildHTML(p, data) {
    const age = p.dob ? _calcAge(p.dob) : (p.birthYear ? (new Date().getFullYear() - p.birthYear) : '-');
    const initials = _initials(p.name);
    const photoBlock = p.photo
      ? '<img src="' + _escape(p.photo) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #4a7c5e;flex-shrink:0;">'
      : '<div style="width:64px;height:64px;border-radius:50%;background:#dbe5dc;color:#1f4d38;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;flex-shrink:0;">' + _escape(initials) + '</div>';

    // Room / Bed display
    let roomDisplay = '-';
    if (p.currentBedId && typeof db !== 'undefined' && db.beds) {
      const bed = (db.beds || []).find(b => String(b.id) === String(p.currentBedId));
      if (bed) {
        const room = (db.rooms || []).find(r => String(r.id) === String(bed.roomId));
        roomDisplay = (room?.name || '-') + ' · เตียง ' + (bed.bedCode || '-');
      }
    }

    // Status badge
    const statusLabel = p.status === 'active' ? 'พักอยู่' :
                        p.status === 'hospital' ? 'อยู่ รพ.' :
                        p.status === 'discharged' ? 'ออกแล้ว' : (p.status || '-');

    // Admit duration
    let durationLabel = '-';
    if (p.admitDate) {
      try {
        const admit = new Date(p.admitDate);
        const now = new Date();
        const months = (now.getFullYear() - admit.getFullYear()) * 12 + (now.getMonth() - admit.getMonth());
        const years = Math.floor(months / 12);
        const remMonths = months % 12;
        durationLabel = (years > 0 ? years + ' ปี ' : '') + (remMonths > 0 ? remMonths + ' ด.' : (years > 0 ? '' : '< 1 ด.'));
      } catch (e) {}
    }

    // ── SECTION: Allergies (top, red)
    const allergies = (p.allergies || []).filter(function(a) { return a.allergen; });
    const allergyHTML = allergies.length === 0
      ? '<div style="padding:8px 12px;color:#666;font-style:italic;">ไม่มีประวัติแพ้</div>'
      : '<div style="display:flex;flex-direction:column;gap:4px;">' +
        allergies.map(function(a) {
          return '<div style="font-size:12px;line-height:1.4;">' +
            _severityIcon(a.severity) + ' <strong style="color:#a33;">' + _escape(a.allergen) + '</strong>' +
            (a.allergyType ? ' <span style="color:#888;font-size:10px;">(' + _escape(a.allergyType) + ')</span>' : '') +
            (a.reaction ? ' — ' + _escape(a.reaction) : '') +
            ' <span style="color:#888;font-size:10px;">[' + _severityLabel(a.severity) + ']</span>' +
            '</div>';
        }).join('') +
        '</div>';

    // ── SECTION: Medical conditions (from medical_logs.detail or note)
    const medicalLog = (p.medicalLog || []).slice(0, 6);
    const medicalHTML = medicalLog.length === 0
      ? '<div style="color:#888;font-style:italic;font-size:11px;">ไม่มีข้อมูล</div>'
      : '<ul style="margin:0;padding-left:18px;list-style:disc;">' +
        medicalLog.map(function(m) {
          const detail = (m.detail || '').slice(0, 80);
          return '<li style="font-size:11px;line-height:1.5;">' + _escape(detail) + '</li>';
        }).join('') +
        '</ul>' +
        ((p.medicalLog || []).length > 6 ? '<div style="font-size:10px;color:#888;margin-top:2px;">และอีก ' + ((p.medicalLog || []).length - 6) + ' รายการ</div>' : '');

    // ── SECTION: Current meds (from medsLog)
    const medsLog = (p.medsLog || []).slice(0, 6);
    const medsHTML = medsLog.length === 0
      ? '<div style="color:#888;font-style:italic;font-size:11px;">ไม่มีข้อมูล</div>'
      : '<ul style="margin:0;padding-left:18px;list-style:disc;">' +
        medsLog.map(function(m) {
          const detail = (m.detail || '').slice(0, 80);
          return '<li style="font-size:11px;line-height:1.5;">' + _escape(detail) + '</li>';
        }).join('') +
        '</ul>' +
        ((p.medsLog || []).length > 6 ? '<div style="font-size:10px;color:#888;margin-top:2px;">และอีก ' + ((p.medsLog || []).length - 6) + ' รายการ</div>' : '');

    // ── SECTION: Contacts
    const contacts = (p.contacts || []).slice(0, 2);
    const contactsHTML = contacts.length === 0
      ? '<div style="color:#888;font-style:italic;font-size:11px;">ไม่มีข้อมูล</div>'
      : contacts.map(function(c) {
          return '<div style="font-size:11px;line-height:1.4;margin-bottom:4px;">' +
            '<strong>' + _escape(c.name || '-') + '</strong>' +
            (c.relation ? ' <span style="color:#666;">(' + _escape(c.relation) + ')</span>' : '') +
            '<br><span style="font-family:monospace;font-size:11px;">' + _escape(c.phone || '-') + '</span>' +
            '</div>';
        }).join('');

    // ── SECTION: Doctor (from lastAppt)
    const doctorHTML = data.lastAppt && data.lastAppt.doctor
      ? '<div style="font-size:11px;line-height:1.4;">' +
        '<strong>' + _escape(data.lastAppt.doctor) + '</strong>' +
        '<br>' + _escape(data.lastAppt.hospital || '-') +
        '<div style="font-size:10px;color:#888;margin-top:2px;">นัดล่าสุด: ' + _thDate(data.lastAppt.appt_date) + '</div>' +
        '</div>'
      : '<div style="color:#888;font-style:italic;font-size:11px;">ไม่มีข้อมูล</div>';

    // ── SECTION: Vital signs table
    const vitals = (data.vitals || []).slice(0, 7);
    const vitalRows = vitals.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic;padding:10px;">ไม่มีข้อมูล vital ในระบบ</td></tr>'
      : vitals.map(function(v) {
          const bp = (v.bp_sys && v.bp_dia) ? v.bp_sys + '/' + v.bp_dia : '-';
          const ts = v.recorded_at ? v.recorded_at.slice(0, 10) : '';
          return '<tr>' +
            '<td>' + _thDate(ts) + '</td>' +
            '<td style="text-align:center;">' + bp + '</td>' +
            '<td style="text-align:center;">' + (v.hr || '-') + '</td>' +
            '<td style="text-align:center;">' + (v.temp || '-') + '</td>' +
            '<td style="text-align:center;">' + (v.spo2 || '-') + '</td>' +
            '<td style="text-align:center;">' + (v.dtx || '-') + '</td>' +
            '</tr>';
        }).join('');

    // ── SECTION: DNR / Consent
    let dnrHTML = '';
    if (data.consent) {
      const c = data.consent;
      const hasInfo = c.dnr_status || c.cpr_consent || c.ventilator_consent || c.preferred_hospital;
      if (hasInfo) {
        dnrHTML = '<div style="background:#fef9e7;border:1px solid #e8d59e;border-left:3px solid #b88240;border-radius:6px;padding:8px 12px;font-size:11px;line-height:1.5;">' +
          '<strong style="color:#8b6314;">📜 DNR / ความประสงค์ปลายชีวิต</strong>' +
          (c.dnr_status ? '<br>• สถานะ DNR: <strong>' + _escape(c.dnr_status) + '</strong>' + (c.dnr_signed_date ? ' (ลงนาม ' + _thDate(c.dnr_signed_date) + ')' : '') : '') +
          (c.cpr_consent ? '<br>• CPR: ' + _escape(c.cpr_consent) : '') +
          (c.ventilator_consent ? '<br>• เครื่องช่วยหายใจ: ' + _escape(c.ventilator_consent) : '') +
          (c.preferred_hospital ? '<br>• โรงพยาบาลที่ต้องการ: ' + _escape(c.preferred_hospital) : '') +
          '</div>';
      }
    }

    // Get current user for footer
    const printerName = (typeof currentUser !== 'undefined' && currentUser?.displayName)
      ? currentUser.displayName
      : (typeof currentUser !== 'undefined' && currentUser?.username) ? currentUser.username : '-';
    const now = new Date();
    const printedAt = _thDateFull(now.toISOString().slice(0, 10)) + ' ' +
      now.toTimeString().slice(0, 5);

    // ── COMBINE
    return '' +
'<style>' +
'  .ps-doc { font-family: "IBM Plex Sans Thai", "Sarabun", sans-serif; color:#222; font-size:12px; }' +
'  .ps-header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2e6b4f; padding-bottom:8px; margin-bottom:14px; }' +
'  .ps-h1 { font-size:18px; font-weight:700; color:#2e6b4f; margin:0; }' +
'  .ps-h2 { font-size:11px; color:#666; margin:2px 0 0; }' +
'  .ps-section { margin-bottom:10px; }' +
'  .ps-section-title { font-size:12px; font-weight:700; color:#2e6b4f; margin-bottom:4px; }' +
'  .ps-2col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }' +
'  .ps-card { background:#fafaf7; border:1px solid #e5e0d1; border-radius:6px; padding:8px 12px; }' +
'  .ps-allergy-card { background:#fef2f0; border:1px solid #e8c5be; border-left:3px solid #c0392b; border-radius:6px; padding:8px 12px; }' +
'  .ps-allergy-title { font-weight:700; color:#a33; font-size:12px; margin-bottom:4px; }' +
'  table.ps-vital { width:100%; border-collapse:collapse; font-size:11px; }' +
'  table.ps-vital th { background:#2e6b4f; color:#fff; padding:5px 8px; text-align:center; font-weight:600; font-size:10px; }' +
'  table.ps-vital td { padding:4px 8px; border-bottom:1px solid #e5e0d1; }' +
'  table.ps-vital tr:nth-child(even) td { background:#fafaf7; }' +
'  .ps-footer { border-top:1px solid #e5e0d1; padding-top:6px; margin-top:14px; font-size:10px; color:#888; display:flex; justify-content:space-between; }' +
'</style>' +
'<div class="ps-doc">' +

'  <div class="ps-header">' +
'    <div>' +
'      <div class="ps-h1">นวศรี เนอร์สซิ่งโฮม</div>' +
'      <div class="ps-h2">สรุปข้อมูลผู้รับบริการ · Patient Summary</div>' +
'    </div>' +
'    <div style="text-align:right;">' +
'      <div style="font-size:11px;color:#666;">วันที่พิมพ์</div>' +
'      <div style="font-size:13px;font-weight:600;">' + _thDateFull(now.toISOString().slice(0,10)) + '</div>' +
'    </div>' +
'  </div>' +

   // Patient info row
'  <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">' +
     photoBlock +
'    <div style="flex:1;">' +
'      <div style="font-size:17px;font-weight:700;color:#1a221c;line-height:1.2;">' + _escape(p.name || '-') + '</div>' +
'      <div style="font-size:11px;color:#555;margin-top:4px;line-height:1.5;">' +
'        HN: <span style="font-family:monospace;">' + _escape(p.hn || p.id || '-') + '</span> · ' +
         age + ' ปี · ' + _genderFromIdcard(p.idcard, p.sex) +
'      </div>' +
'      <div style="font-size:11px;color:#555;line-height:1.5;">' +
'        ห้อง <strong>' + _escape(roomDisplay) + '</strong> · ' +
'        เข้ามา ' + _thDate(p.admitDate) + ' (' + durationLabel + ') · ' +
'        <span style="background:#dbe5dc;color:#1f4d38;padding:1px 6px;border-radius:3px;font-size:10px;">' + _escape(statusLabel) + '</span>' +
'      </div>' +
'    </div>' +
'  </div>' +

   // Allergy banner (red, top)
'  <div class="ps-section">' +
'    <div class="ps-allergy-card">' +
'      <div class="ps-allergy-title">⚠️ การแพ้ยา / แพ้อาหาร</div>' +
       allergyHTML +
'    </div>' +
'  </div>' +

   // 2-column: medical conditions + meds
'  <div class="ps-2col ps-section">' +
'    <div class="ps-card">' +
'      <div class="ps-section-title">🏥 โรคประจำตัว / ประวัติการรักษา</div>' +
       medicalHTML +
'    </div>' +
'    <div class="ps-card">' +
'      <div class="ps-section-title">💊 ยาประจำตัว</div>' +
       medsHTML +
'    </div>' +
'  </div>' +

   // 2-column: contacts + doctor
'  <div class="ps-2col ps-section">' +
'    <div class="ps-card">' +
'      <div class="ps-section-title">📞 ผู้ติดต่อฉุกเฉิน</div>' +
       contactsHTML +
'    </div>' +
'    <div class="ps-card">' +
'      <div class="ps-section-title">👨‍⚕️ แพทย์ประจำตัว / นัดล่าสุด</div>' +
       doctorHTML +
'    </div>' +
'  </div>' +

   // Vital signs table
'  <div class="ps-section">' +
'    <div class="ps-section-title">📊 Vital Signs · 7 ครั้งล่าสุด</div>' +
'    <table class="ps-vital">' +
'      <thead><tr>' +
'        <th style="text-align:left;">วันที่</th>' +
'        <th>BP (mmHg)</th>' +
'        <th>HR (bpm)</th>' +
'        <th>Temp (°C)</th>' +
'        <th>SpO₂ (%)</th>' +
'        <th>DTX</th>' +
'      </tr></thead>' +
'      <tbody>' + vitalRows + '</tbody>' +
'    </table>' +
'  </div>' +

   // DNR (if any)
   (dnrHTML ? '<div class="ps-section">' + dnrHTML + '</div>' : '') +

   // Footer
'  <div class="ps-footer">' +
'    <div>พิมพ์โดย: <strong>' + _escape(printerName) + '</strong> · ' + _escape(printedAt) + '</div>' +
'    <div>หน้า 1/1 · นวศรี เนอร์สซิ่งโฮม</div>' +
'  </div>' +

'</div>';
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT PDF (reuse _exportDocPDF from billing-print.js)
  // ─────────────────────────────────────────────────────────────────

  async function exportPatientSummaryPDF(patId) {
    if (typeof db === 'undefined' || !db.patients) {
      if (typeof toast === 'function') toast('ระบบยังโหลดไม่เสร็จ', 'error');
      return;
    }
    const p = db.patients.find(function(x) { return String(x.id) === String(patId); });
    if (!p) {
      if (typeof toast === 'function') toast('ไม่พบข้อมูลผู้รับบริการ', 'error');
      return;
    }
    if (typeof toast === 'function') toast('กำลังสร้าง PDF...', 'info');
    try {
      const data = await _fetchSummaryData(patId);
      const html = _buildHTML(p, data);
      const filename = 'สรุปข้อมูล_' + (p.name || patId).replace(/[\\/:*?"<>|]/g, '_') + '_' + new Date().toISOString().slice(0, 10);
      if (typeof _exportDocPDF === 'function') {
        await _exportDocPDF(html, filename);
      } else {
        // Fallback: open print window
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
          win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + filename + '</title>' +
            '<style>@page{size:A4;margin:14mm;}body{margin:0;padding:14mm;}@media print{body{padding:0;}}</style>' +
            '</head><body>' + html + '</body></html>');
          win.document.close();
          setTimeout(function() { try { win.print(); } catch (e) {} }, 500);
        }
      }
    } catch (e) {
      console.error('[patient-summary-pdf] error:', e);
      if (typeof toast === 'function') toast('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  // ── Expose globals ────────────────────────────────────────────────
  window.exportPatientSummaryPDF = exportPatientSummaryPDF;
})();
