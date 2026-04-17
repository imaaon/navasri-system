// ===== ROOMS MODULE =====

// ===== ROOM & BED MANAGEMENT =====
function renderRooms() {
  const rooms = db.rooms.slice().sort(function(a, b) {
    function roomOrder(name) {
      // Ward-1A = ลำดับ 0 (ขึ้นก่อน)
      if (name === 'Ward-1A') return '0_0_000';
      // แยก ตัวเลข+ตึก เช่น 201A -> floor=201, wing=A
      var m = name.match(/^(\d+)([A-Z]+)$/);
      if (!m) return '9_'+name;
      var num = m[1]; var wing = m[2];
      // A ก่อน B: sort by wing first, then number
      return wing + '_' + num.padStart(6,'0');
    }
    var oa = roomOrder(a.name), ob = roomOrder(b.name);
    return oa < ob ? -1 : oa > ob ? 1 : 0;
  });
  const beds  = db.beds;
  // Summary cards by type
  const types = [...new Set(rooms.map(r => r.roomType))];
  const summaryEl = document.getElementById('room-summary');
  const typeColors = { 'ห้องเดี่ยว':'#2d4a38','ห้องคู่':'#1a5276','ห้องรวม':'#4a235a','ห้อง VIP':'#7d6608','อื่นๆ':'#555' };
  summaryEl.innerHTML = types.map(t => {
    const tRooms = rooms.filter(r => r.roomType === t);
    const tBeds  = beds.filter(b => tRooms.some(r => r.id == b.roomId));
    const activeBeds = tBeds.filter(b => b.status !== 'inactive');
    const occupied = activeBeds.filter(b => b.status === 'occupied').length;
    const available = activeBeds.filter(b => b.status === 'available').length;
    const maintenance = activeBeds.filter(b => b.status === 'maintenance').length;
    const c = typeColors[t] || '#555';
    return `<div style="background:white;border-radius:10px;border:1px solid var(--border);padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${t}</div>
      <div style="font-size:22px;font-weight:800;color:${c};">${tRooms.length} <span style="font-size:12px;font-weight:400;color:var(--text3);">ห้อง</span></div>
      <div style="font-size:12px;margin-top:4px;color:var(--text2);">
        <span style="color:#27ae60;">● ว่าง ${available}</span> · <span style="color:#c0392b;">● มีผู้พัก ${occupied}</span>${maintenance?' · <span style="color:#e67e22;">● ซ่อม '+maintenance+'</span>':''}
      </div>
    </div>`;
  }).join('');

  // Room cards with beds
  const listEl = document.getElementById('rooms-list');
  if (rooms.length === 0) {
    listEl.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:var(--text3);">ยังไม่มีห้องพัก กด "+ เพิ่มห้อง" เพื่อเริ่มต้น</div>';
    return;
  }
  listEl.innerHTML = rooms.map(room => {
    const roomBeds = beds.filter(b => b.roomId == room.id);
    const rateText = [
      room.monthlyRate ? `${room.monthlyRate.toLocaleString('th-TH')} ฿/เดือน` : '',
      room.dailyRate   ? `${room.dailyRate.toLocaleString('th-TH')} ฿/วัน` : '',
    ].filter(Boolean).join(' · ') || 'ไม่ระบุราคา';
    const bedHtml = roomBeds.length === 0
      ? '<div style="font-size:12px;color:var(--text3);padding:8px 0;">ยังไม่มีเตียง</div>'
      : roomBeds.map(b => {
          const occupant = db.patients.find(p => p.currentBedId == b.id);
          if (b.status === 'inactive') return ''; // ซ่อนเตียงที่ปิดใช้งาน
          const statusColor = b.status==='available'?'#27ae60':b.status==='occupied'?'#c0392b':b.status==='maintenance'?'#e67e22':'#95a5a6';
          const statusLabel = b.status==='available'?'ว่าง':b.status==='occupied'?'มีผู้พัก':b.status==='maintenance'?'ซ่อมบำรุง':b.status==='other'?(b.otherNote||'อื่นๆ'):'ปิดใช้งาน';
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:${b.status==='available'?'#f9fff9':b.status==='occupied'?'#fff5f5':b.status==='maintenance'?'#fffbf0':'#f5f5f5'};">
            <span style="font-size:16px;">🛏️</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">เตียง ${b.bedCode}</div>
              ${occupant ? `<div style="font-size:11px;color:#c0392b;font-weight:600;">👤 ${occupant.name}</div>` : ''}
            </div>
            <span style="font-size:11px;font-weight:700;color:${statusColor};">● ${statusLabel}</span>
            ${occupant ? `<button class="btn btn-ghost btn-sm" onclick="openTransferRoomModal('${occupant.id}')" style="padding:3px 7px;font-size:11px;color:#2980b9;">🔄 ย้าย</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="editBed('${b.id}')" style="padding:3px 7px;font-size:11px;">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteBed('${b.id}')" style="padding:3px 7px;font-size:11px;">🗑️</button>
          </div>`;
        }).join('');
    return `<div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div>
          <div class="card-title">${room.name} <span class="badge badge-gray" style="font-size:11px;margin-left:6px;">${room.roomType}</span> ${room.zone ? `<span style="font-size:12px;color:var(--text3);">· ${room.zone}</span>` : ''}</div>
          <div style="font-size:12px;color:var(--accent);margin-top:2px;">💰 ${rateText}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="editRoom('${room.id}')">✏️ แก้ไข</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteRoom('${room.id}')">🗑️</button>
          <button class="btn btn-primary btn-sm" onclick="openAddBedModal('${room.id}')">+ เตียง</button>
        </div>
      </div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
        ${bedHtml}
      </div>
    </div>`;
  }).join('');
}

function openAddRoomModal(editId=null) {
  document.getElementById('room-edit-id').value = editId||'';
  document.getElementById('room-name').value = '';
  document.getElementById('room-type').value = 'ห้องเดี่ยว';
  document.getElementById('room-zone').value = '';
  document.getElementById('room-monthly').value = '';
  document.getElementById('room-daily').value = '';
  document.getElementById('room-note').value = '';
  document.getElementById('modal-room-title').textContent = editId ? '✏️ แก้ไขห้องพัก' : '🏠 เพิ่มห้องพัก';
  if (editId) {
    const r = db.rooms.find(x => x.id == editId);
    if (r) {
      document.getElementById('room-name').value    = r.name;
      document.getElementById('room-type').value    = r.roomType;
      document.getElementById('room-zone').value    = r.zone||'';
      document.getElementById('room-monthly').value = r.monthlyRate||'';
      document.getElementById('room-daily').value   = r.dailyRate||'';
      document.getElementById('room-note').value    = r.note||'';
    }
  }
  openModal('modal-add-room');
}
function editRoom(id) { openAddRoomModal(id); }

async function saveRoom() {
  const name = document.getElementById('room-name').value.trim();
  if (!name) { toast('กรุณาระบุชื่อห้อง','warning'); return; }
  const editId = document.getElementById('room-edit-id').value;
  const data = {
    name, room_type: document.getElementById('room-type').value,
    zone: document.getElementById('room-zone').value.trim(),
    monthly_rate: parseFloat(document.getElementById('room-monthly').value)||0,
    daily_rate:   parseFloat(document.getElementById('room-daily').value)||0,
    note: document.getElementById('room-note').value.trim(),
  };
  if (editId) {
    const { error } = await supa.from('rooms').update(data).eq('id', editId);
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    const r = db.rooms.find(x => x.id == editId);
    if (r) Object.assign(r, { name: data.name, roomType: data.room_type, zone: data.zone, monthlyRate: data.monthly_rate, dailyRate: data.daily_rate, note: data.note });
    toast('แก้ไขห้องเรียบร้อย','success');
  } else {
    const { data: ins, error } = await supa.from('rooms').insert(data).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    db.rooms.push(mapRoom(ins));
    toast('เพิ่มห้องเรียบร้อย','success');
  }
  closeModal('modal-add-room');
  renderRooms();
}

async function deleteRoom(id) {
  const hasBeds = db.beds.some(b => b.roomId == id);
  if (hasBeds && !confirm('ห้องนี้มีเตียงอยู่ ต้องการลบทั้งหมด?')) return;
  if (!hasBeds && !confirm('ต้องการลบห้องนี้?')) return;
  const { error } = await supa.from('rooms').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.rooms = db.rooms.filter(r => r.id != id);
  db.beds  = db.beds.filter(b => b.roomId != id);
  toast('ลบห้องเรียบร้อย'); renderRooms();
}

function openAddBedModal(roomId=null, editId=null) {
  document.getElementById('bed-edit-id').value = editId||'';
  document.getElementById('bed-code').value = '';
  document.getElementById('bed-status').value = 'available';
  document.getElementById('bed-note').value = '';
  const otherEl = document.getElementById('bed-other-note');
  if (otherEl) { otherEl.value = ''; otherEl.style.display = 'none'; }
  const sel = document.getElementById('bed-room-id');
  sel.innerHTML = '<option value="">-- เลือกห้อง --</option>' +
    db.rooms.map(r => `<option value="${r.id}" ${roomId == r.id ? 'selected':''}>${r.name} (${r.roomType})</option>`).join('');
  if (roomId) sel.value = roomId;
  document.getElementById('modal-bed-title').textContent = editId ? '✏️ แก้ไขเตียง' : '🛏️ เพิ่มเตียง';
  if (editId) {
    const b = db.beds.find(x => x.id == editId);
    if (b) {
      sel.value = b.roomId;
      document.getElementById('bed-code').value   = b.bedCode;
      document.getElementById('bed-status').value = b.status;
      document.getElementById('bed-note').value   = b.note||'';
      if (b.status === 'other' && otherEl) {
        otherEl.style.display = '';
        otherEl.value = b.otherNote || '';
      }
    }
  }
  openModal('modal-add-bed');
}
function editBed(id) { openAddBedModal(null, id); }

async function saveBed() {
  const roomId = document.getElementById('bed-room-id').value;
  const code   = document.getElementById('bed-code').value.trim();
  if (!roomId) { toast('กรุณาเลือกห้อง','warning'); return; }
  if (!code)   { toast('กรุณาระบุรหัสเตียง','warning'); return; }
  const editId = document.getElementById('bed-edit-id').value;
  const otherNote = document.getElementById('bed-other-note')?.value?.trim() || '';
  const data = {
    room_id: roomId, bed_code: code,
    status: document.getElementById('bed-status').value,
    note:   document.getElementById('bed-note').value.trim(),
    other_note: otherNote || null,
  };
  if (editId) {
    const { error } = await supa.from('beds').update(data).eq('id', editId);
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    const b = db.beds.find(x => x.id == editId);
    if (b) Object.assign(b, { roomId: roomId, bedCode: code, status: data.status, note: data.note });
    toast('แก้ไขเตียงเรียบร้อย','success');
  } else {
    const { data: ins, error } = await supa.from('beds').insert(data).select().single();
    if (error) { toast('บันทึกไม่สำเร็จ: '+error.message,'error'); return; }
    db.beds.push(mapBed(ins));
    toast('เพิ่มเตียงเรียบร้อย','success');
  }
  closeModal('modal-add-bed');
  renderRooms();
}

async function deleteBed(id) {
  const occupant = db.patients.find(p => p.currentBedId == id);
  if (occupant) { toast(`เตียงนี้มีผู้พักอยู่ (${occupant.name}) ไม่สามารถลบได้`,'warning'); return; }
  if (!confirm('ต้องการลบเตียงนี้?')) return;
  const { error } = await supa.from('beds').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  db.beds = db.beds.filter(b => b.id != id);
  toast('ลบเรียบร้อย'); renderRooms();
}

// ===== ROOM TRANSFER (ย้ายห้อง) =====
function openTransferRoomModal(patientId) {
  const p = db.patients.find(x => x.id == patientId);
  if (!p) return;
  const bed = db.beds.find(b => b.id == p.currentBedId);
  const room = db.rooms.find(r => r.id == (bed?.roomId || p.currentRoomId));

  document.getElementById('transfer-patient-id').value = patientId;
  document.getElementById('transfer-patient-name').textContent = p.name;
  document.getElementById('transfer-current-room').textContent =
    room ? `ห้อง ${room.name} · เตียง ${bed?.bedCode || '-'}` : 'ไม่ระบุห้อง';
  document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('transfer-note').value = '';

  // โหลดห้องทั้งหมด
  const roomSel = document.getElementById('transfer-room-id');
  roomSel.innerHTML = '<option value="">-- เลือกห้อง --</option>' +
    db.rooms.map(r => `<option value="${r.id}">${r.name} (${r.roomType})</option>`).join('');
  document.getElementById('transfer-bed-id').innerHTML = '<option value="">-- เลือกเตียงก่อน --</option>';

  openModal('modal-transfer-room');
}

function updateTransferBeds() {
  const roomId = document.getElementById('transfer-room-id').value;
  const patId = document.getElementById('transfer-patient-id').value;
  const p = db.patients.find(x => x.id == patId);
  const availBeds = db.beds.filter(b =>
    b.roomId == roomId &&
    (b.status === 'available' || b.id == p?.currentBedId)
  );
  const bedSel = document.getElementById('transfer-bed-id');
  bedSel.innerHTML = '<option value="">-- เลือกเตียง --</option>' +
    availBeds.map(b => `<option value="${b.id}">เตียง ${b.bedCode}</option>`).join('');
}

async function saveTransferRoom() {
  const patId    = document.getElementById('transfer-patient-id').value;
  const newRoomId = document.getElementById('transfer-room-id').value;
  const newBedId  = document.getElementById('transfer-bed-id').value;
  const date      = document.getElementById('transfer-date').value;
  const note      = document.getElementById('transfer-note').value.trim();

  if (!newRoomId || !newBedId || !date) {
    toast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return;
  }

  const p = db.patients.find(x => x.id == patId);
  if (!p) return;

  showLoadingOverlay(true);
  try {
    const { data: rpcResult, error: rpcErr } = await supa.rpc('transfer_bed', {
      p_patient_id:    patId,
      p_new_bed_id:    parseInt(newBedId),
      p_new_room_id:   parseInt(newRoomId),
      p_transfer_date: date,
      p_note:          note || '',
      p_created_by:    currentUser?.displayName || currentUser?.username || '',
    });

    if (rpcErr || !rpcResult?.ok) {
      const msg = rpcErr?.message || rpcResult?.error || 'unknown error';
      toast('❌ ย้ายห้องไม่สำเร็จ: ' + msg, 'error');
      console.error('[transfer_bed] RPC error:', msg);
      return;
    }

    // sync local cache หลัง DB สำเร็จ
    const oldBed = db.beds.find(b => b.id == p.currentBedId);
    if (oldBed && p.currentBedId != newBedId) {
      oldBed.status = 'available'; oldBed.patientId = null;
    }
    const newBed = db.beds.find(b => b.id == newBedId);
    if (newBed) { newBed.status = 'occupied'; newBed.patientId = patId; }

    p.currentRoomId = parseInt(newRoomId);
    p.currentBedId  = parseInt(newBedId);

    if (!db.roomHistory) db.roomHistory = [];
    db.roomHistory.unshift({
      patient_id: patId, patient_name: p.name,
      from_bed: rpcResult.from_bed, from_room: rpcResult.from_room,
      to_bed: rpcResult.to_bed, to_room: rpcResult.to_room,
      transfer_date: date, note, id: Date.now()
    });

    toast(`✅ ย้ายห้องเรียบร้อย → ห้อง ${rpcResult.to_room} เตียง ${rpcResult.to_bed}`, 'success');
    closeModal('modal-transfer-room');
    renderRooms();
  } finally {
    showLoadingOverlay(false);
  }
}

function openRoomHistoryModal() {
  document.getElementById('history-search').value = '';
  renderRoomHistory();
  openModal('modal-room-history');
}

function renderRoomHistory() {
  const q = document.getElementById('history-search').value.trim().toLowerCase();
  const list = (db.roomHistory || []).filter(h =>
    !q || h.patient_name?.toLowerCase().includes(q)
  );
  const el = document.getElementById('room-history-list');
  if (!list.length) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);">ยังไม่มีประวัติการย้ายห้อง</div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:var(--bg2);position:sticky;top:0;">
      <th style="padding:10px 12px;text-align:left;font-weight:600;">วันที่</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;">ผู้รับบริการ</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;">จากห้อง</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;">ไปห้อง</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;">หมายเหตุ</th>
    </tr></thead>
    <tbody>${list.map(h => `<tr style="border-top:1px solid var(--border);">
      <td style="padding:9px 12px;">${h.transfer_date||'-'}</td>
      <td style="padding:9px 12px;font-weight:600;">${h.patient_name||'-'}</td>
      <td style="padding:9px 12px;color:var(--text2);">ห้อง ${h.from_room||'-'} เตียง ${h.from_bed||'-'}</td>
      <td style="padding:9px 12px;color:#27ae60;font-weight:600;">ห้อง ${h.to_room||'-'} เตียง ${h.to_bed||'-'}</td>
      <td style="padding:9px 12px;color:var(--text3);">${h.note||'-'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function exportRoomsExcel() {
  const rows = [
    ['#', 'ห้อง', 'ประเภท', 'โซน', 'ค่าห้อง/เดือน', 'ค่าห้อง/วัน', 'ความจุ',
     'เตียง', 'สถานะเตียง', 'ผู้พัก', 'หมายเหตุ']
  ];
  let idx = 1;
  db.rooms.forEach(room => {
    const roomBeds = db.beds.filter(b => b.roomId == room.id);
    if (roomBeds.length === 0) {
      rows.push([idx++, room.name, room.roomType, room.zone || '',
        room.monthlyRate || 0, room.dailyRate || 0, room.capacity || 1,
        '-', '-', '-', room.note || '']);
    } else {
      roomBeds.forEach(bed => {
        const patient = db.patients.find(p => p.currentBedId == bed.id);
        rows.push([idx++, room.name, room.roomType, room.zone || '',
          room.monthlyRate || 0, room.dailyRate || 0, room.capacity || 1,
          bed.bedCode, bed.status === 'available' ? 'ว่าง' : bed.status === 'occupied' ? 'มีผู้พัก' : bed.status,
          patient?.name || '', room.note || '']);
      });
    }
  });
  _xlsxDownload(rows, 'ห้องพัก', 'navasri_rooms_' + new Date().toISOString().slice(0,10));
}

function exportRoomHistoryExcel() {
  const rows = [
    ['#', 'วันที่ย้าย', 'ผู้รับบริการ', 'จากห้อง', 'จากเตียง', 'ไปห้อง', 'ไปเตียง', 'หมายเหตุ']
  ];
  (db.roomHistory || []).forEach((h, i) => {
    rows.push([
      i+1, h.transfer_date || '', h.patient_name || '',
      h.from_room || '', h.from_bed || '',
      h.to_room || '', h.to_bed || '',
      h.note || ''
    ]);
  });
  _xlsxDownload(rows, 'ประวัติย้ายห้อง', 'navasri_room_history_' + new Date().toISOString().slice(0,10));
}
