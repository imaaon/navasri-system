// ===== PHYSIO MODULE — กายภาพบำบัด =====

// ── Helpers ──────────────────────────────────────────────────
function getThaiMonths() {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = `${months[d.getMonth()]} ${d.getFullYear()+543}`;
    opts.push({ val, label });
  }
  return opts;
}

function calcPhysioAmount() {
  const dur  = parseInt(document.getElementById('physio-duration')?.value || 60);
  const rate = parseFloat(document.getElementById('physio-rate')?.value || 0);
  const amt  = Math.round((dur / 60) * rate * 100) / 100;
  const el   = document.getElementById('physio-amount');
  if (el) el.value = amt.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  return amt;
}

// ── Open Modal ────────────────────────────────────────────────
function openPhysioSessionModal(patientId, patientName, editId = null) {
  const p = db.patients.find(x => String(x.id) === String(patientId));

  document.getElementById('physio-patient-id').value   = patientId;
  document.getElementById('physio-patient-id').dataset.currentPatient = patientId;
  document.getElementById('physio-patient-name').value = patientName;
  document.getElementById('physio-session-id').value   = editId || '';
  document.getElementById('physio-note').value         = '';
  document.getElementById('physio-amount').value       = '0.00';

  // วันที่ default = วันนี้
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('physio-date').value = today;

  // ราคาจากข้อมูลผู้รับบริการ
  document.getElementById('physio-rate').value = p?.physioRatePerHour || 0;

  // ระยะเวลา default ตาม physioHoursPerDay
  if (p?.physioHoursPerDay) {
    const mins = p.physioHoursPerDay * 60;
    const sel = document.getElementById('physio-duration');
    const match = Array.from(sel.options).find(o => parseInt(o.value) === mins);
    if (match) sel.value = String(mins);
    else sel.value = '60';
  } else {
    document.getElementById('physio-duration').value = '60';
  }

  // โหลดพนักงานที่เป็นนักกายภาพ
  const sel = document.getElementById('physio-therapist-id');
  sel.innerHTML = '<option value="">-- เลือกพนักงาน --</option>' +
    (db.staff || [])
      .filter(s => !s.endDate || s.endDate >= today)
      .map(s => `<option value="${s.id}">${s.name}${s.position ? ' ('+s.position+')' : ''}</option>`)
      .join('');

  // ถ้าเป็น edit โหลดข้อมูลเดิม
  if (editId) {
    document.getElementById('modal-physio-title').textContent = '✏️ แก้ไข Session กายภาพ';
    loadPhysioSessionForEdit(editId);
  } else {
    document.getElementById('modal-physio-title').textContent = '🤸 บันทึกกายภาพบำบัด';
  }

  calcPhysioAmount();
  openModal('modal-physio-session');
}

async function loadPhysioSessionForEdit(sessionId) {
  const { data, error } = await supa.from('physio_sessions').select('*').eq('id', sessionId).single();
  if (error || !data) return;
  document.getElementById('physio-date').value           = data.session_date;
  document.getElementById('physio-duration').value       = String(data.duration_minutes);
  document.getElementById('physio-rate').value           = data.rate_per_hour;
  document.getElementById('physio-note').value           = data.note || '';
  document.getElementById('physio-therapist-id').value   = data.therapist_id || '';
  calcPhysioAmount();
}

// ── Save ──────────────────────────────────────────────────────
async function savePhysioSession() {
  const patientId  = document.getElementById('physio-patient-id').value;
  const sessionId  = document.getElementById('physio-session-id').value;
  const date       = document.getElementById('physio-date').value;
  const duration   = parseInt(document.getElementById('physio-duration').value);
  const rate       = parseFloat(document.getElementById('physio-rate').value) || 0;
  const note       = document.getElementById('physio-note').value.trim();
  const therapistId = document.getElementById('physio-therapist-id').value || null;
  const therapist  = db.staff?.find(s => String(s.id) === String(therapistId));

  if (!date)     { toast('กรุณาเลือกวันที่', 'warning'); return; }
  if (!duration) { toast('กรุณาเลือกระยะเวลา', 'warning'); return; }
  if (!rate)     { toast('กรุณาระบุราคาต่อชั่วโมง', 'warning'); return; }

  const row = {
    patient_id:       patientId,
    therapist_id:     therapistId,
    therapist_name:   therapist?.name || null,
    session_date:     date,
    duration_minutes: duration,
    rate_per_hour:    rate,
    note:             note || null,
    created_by:       currentUser?.username || null,
  };

  let error;
  if (sessionId) {
    ({ error } = await supa.from('physio_sessions').update(row).eq('id', sessionId));
  } else {
    ({ error } = await supa.from('physio_sessions').insert(row));
  }

  if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }

  toast(sessionId ? 'แก้ไข Session เรียบร้อย' : 'บันทึก Session เรียบร้อย', 'success');
  closeModal('modal-physio-session');

  // refresh tab
  renderPhysioTab(patientId);
}

// ── Render Tab ────────────────────────────────────────────────
async function renderPhysioTab(patientId) {
  const summaryEl = document.getElementById(`physio-summary-${patientId}`);
  const listEl    = document.getElementById(`physio-list-${patientId}`);
  if (!summaryEl || !listEl) return;

  // สร้าง month filter ถ้ายังไม่มี
  const filterEl = document.getElementById('physio-month-filter');
  if (filterEl && filterEl.options.length === 0) {
    getThaiMonths().forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = m.val;
      opt.textContent = m.label;
      if (i === 0) opt.selected = true;
      filterEl.appendChild(opt);
    });
    filterEl.onchange = () => renderPhysioTab(patientId);
  }

  const month = filterEl?.value || new Date().toISOString().slice(0,7);
  const [year, mon] = month.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDate   = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0];

  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">⏳ กำลังโหลด...</div>';

  const { data: sessions, error } = await supa
    .from('physio_sessions')
    .select('*')
    .eq('patient_id', patientId)
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date', { ascending: false });

  if (error) { listEl.innerHTML = `<div style="color:red;padding:16px;">Error: ${error.message}</div>`; return; }

  // ── Summary ──
  const totalMins   = (sessions||[]).reduce((s,x) => s + x.duration_minutes, 0);
  const totalAmt    = (sessions||[]).reduce((s,x) => s + parseFloat(x.amount||0), 0);
  const billedAmt   = (sessions||[]).filter(x=>x.billed).reduce((s,x) => s + parseFloat(x.amount||0), 0);
  const unbilledAmt = totalAmt - billedAmt;

  summaryEl.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:2px;">จำนวน Session</div>
      <div style="font-size:20px;font-weight:700;color:var(--accent);">${(sessions||[]).length}</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:2px;">รวมเวลา</div>
      <div style="font-size:20px;font-weight:700;color:var(--accent);">${(totalMins/60).toFixed(1)} ชม.</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:2px;">ยังไม่รวมบิล</div>
      <div style="font-size:20px;font-weight:700;color:#e67e22;">${unbilledAmt.toLocaleString('th-TH',{minimumFractionDigits:0})} ฿</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:2px;">รวมในบิลแล้ว</div>
      <div style="font-size:20px;font-weight:700;color:#27ae60;">${billedAmt.toLocaleString('th-TH',{minimumFractionDigits:0})} ฿</div>
    </div>`;

  // ── List ──
  if (!sessions || sessions.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);">ยังไม่มีบันทึกกายภาพในเดือนนี้</div>';
    return;
  }

  const p = db.patients.find(x => String(x.id) === String(patientId));
  listEl.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ระยะเวลา</th>
            <th>นักกายภาพ</th>
            <th style="text-align:right;">ราคา/ชม.</th>
            <th style="text-align:right;">ยอด (฿)</th>
            <th style="text-align:center;">สถานะบิล</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(s => {
            const hrs  = s.duration_minutes >= 60
              ? `${Math.floor(s.duration_minutes/60)} ชม.${s.duration_minutes%60 ? (s.duration_minutes%60)+' น.' : ''}`
              : `${s.duration_minutes} น.`;
            const amt  = parseFloat(s.amount||0).toLocaleString('th-TH',{minimumFractionDigits:2});
            const rate = parseFloat(s.rate_per_hour||0).toLocaleString('th-TH',{minimumFractionDigits:0});
            const billBadge = s.billed
              ? '<span style="background:#d5f5e3;color:#1e8449;font-size:11px;padding:2px 8px;border-radius:10px;">รวมบิลแล้ว</span>'
              : '<span style="background:#fef9e7;color:#d68910;font-size:11px;padding:2px 8px;border-radius:10px;">ยังไม่รวมบิล</span>';
            const editBtn = !s.billed
              ? `<button class="btn btn-ghost btn-xs" onclick="openPhysioSessionModal('${patientId}','${p?.name||''}','${s.id}')">✏️</button>
                 <button class="btn btn-ghost btn-xs" style="color:#c0392b;" onclick="deletePhysioSession('${s.id}','${patientId}')">🗑️</button>`
              : '<span style="color:var(--text3);font-size:11px;">ล็อค</span>';
            return `<tr>
              <td class="number" style="white-space:nowrap;">${s.session_date}</td>
              <td>${hrs}</td>
              <td style="font-size:13px;">${s.therapist_name||'-'}</td>
              <td class="number" style="text-align:right;">${rate}</td>
              <td class="number" style="text-align:right;font-weight:600;">${amt}</td>
              <td style="text-align:center;">${billBadge}</td>
              <td style="white-space:nowrap;">${editBtn}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Delete ────────────────────────────────────────────────────
async function deletePhysioSession(sessionId, patientId) {
  if (!confirm('ลบบันทึก Session นี้?')) return;
  const { error } = await supa.from('physio_sessions').delete().eq('id', sessionId);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  toast('ลบ Session เรียบร้อย', 'success');
  renderPhysioTab(patientId);
}

// ── เชื่อมกับบิล: ดึง unbilled sessions ──────────────────────
async function loadPhysioUnbilledForInvoice(patientId, yearMonth) {
  const { data, error } = await supa.rpc('get_physio_unbilled', {
    p_patient_id: patientId,
    p_year_month: yearMonth,
  });
  if (error) return null;
  return data;
}

// ── เพิ่มกายภาพลงบิลอัตโนมัติ ────────────────────────────────
async function autoFillPhysioToInvoice() {
  const patientId = document.getElementById('inv-patient')?.value;
  if (!patientId) { toast('กรุณาเลือกผู้รับบริการก่อน', 'warning'); return; }

  // ใช้เดือนปัจจุบัน
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const result = await loadPhysioUnbilledForInvoice(patientId, yearMonth);
  if (!result || !result.total_amount) {
    toast('ไม่มีบันทึกกายภาพที่ยังไม่รวมบิลในเดือนนี้', 'info');
    return;
  }

  // ใส่ค่ากายภาพลงใน inv-pt fields
  document.getElementById('inv-pt-enabled').checked = true;
  document.getElementById('inv-pt-type').value       = 'monthly';
  document.getElementById('inv-pt-qty').value        = (result.total_hours || 0).toFixed(2);
  document.getElementById('inv-pt-rate').value       = result.total_amount && result.total_hours
    ? Math.round(result.total_amount / result.total_hours)
    : 0;
  recalcInvoice();

  // เก็บ session IDs ไว้เพื่อ mark billed ทีหลัง
  const sessions = result.sessions || [];
  document.getElementById('inv-pt-enabled').dataset.physioSessionIds =
    JSON.stringify(sessions.map(s => s.id));

  toast(`ดึงกายภาพ ${result.total_sessions} session รวม ${(result.total_hours||0).toFixed(1)} ชม. = ${(result.total_amount||0).toLocaleString('th-TH')} บาท`, 'success');
}


async function exportPhysioExcel() {
  // ดึง sessions ทั้งหมด
  const { data, error } = await supa.from('physio_sessions')
    .select('*, patients(name)')
    .order('session_date', {ascending: false})
    .limit(1000);
  if (error) { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); return; }

  const rows = [
    ['#', 'วันที่', 'ผู้รับบริการ', 'นักกายภาพ', 'ระยะเวลา (นาที)', 'อัตรา/ชม.', 'ยอด (บาท)', 'เรียกเก็บแล้ว', 'หมายเหตุ']
  ];
  (data || []).forEach((s, i) => {
    rows.push([
      i+1,
      s.session_date || '',
      s.patients?.name || s.patient_name || '',
      s.therapist_name || '',
      s.duration_minutes || 0,
      s.rate_per_hour || 0,
      s.amount || 0,
      s.billed ? 'แล้ว' : 'ยังไม่',
      s.note || ''
    ]);
  });
  _xlsxDownload(rows, 'กายภาพบำบัด', 'navasri_physio_' + new Date().toISOString().slice(0,10));
}
