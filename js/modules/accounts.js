// ===== ACCOUNTS MODULE =====
// v2: ใช้ Supabase app_users table โดยตรง (ไม่ใช้ db.users + saveDB แบบเก่า)

const ROLE_LABELS = {
  admin:             '👑 admin',
  manager:           '🏆 ผู้บริหาร (Executive)',
  officer:           '📋 ธุรการ (Officer)',
  accounting:        '💰 บัญชี (Accounting)',
  nurse:             '🏥 พยาบาล',
  caregiver:         '👤 ผู้ดูแล / บริบาล',
  physical_therapist:'🤸 นักกายภาพบำบัด',
  supervisor:        '📋 หัวหน้า',
  warehouse:         '🏪 คลังสินค้า',
};
const ROLE_BADGE = {
  admin:'badge-red', manager:'badge-red', officer:'badge-purple',
  accounting:'badge-orange', nurse:'badge-blue',
  caregiver:'badge-green', physical_therapist:'badge-green',
  supervisor:'badge-purple', warehouse:'badge-orange',
};

// โหลด accounts จาก app_users table ใน Supabase
async function loadAccounts() {
  const { data, error } = await supa.from('app_users')
    .select('id, username, display_name, name, role, position, active, auth_id, created_at, last_login')
    .order('created_at', { ascending: true });
  if (error) { toast('โหลด Account ไม่สำเร็จ: ' + error.message, 'error'); return []; }
  return data || [];
}

async function renderAccounts() {
  const accounts = await loadAccounts();
  document.getElementById('accTableTitle').textContent = 'รายการ Account ทั้งหมด (' + accounts.length + ' account)';
  const tb = document.getElementById('accTable');
  var fragment = document.createDocumentFragment();
  accounts.forEach(function(a, i) {
    var dname = a.display_name || a.name || a.username;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="number" style="color:var(--text3);">' + (i+1) + '</td>' +
      '<td style="font-weight:700;font-family:monospace;">' + (a.username||'') + '</td>' +
      '<td>' + (dname||'') + '</td>' +
      '<td><span class="badge ' + (ROLE_BADGE[a.role]||'badge-gray') + '">' + (ROLE_LABELS[a.role]||a.role||'-') + '</span></td>' +
      '<td style="font-size:12px;color:var(--text2);">' + (a.position||'-') + '</td>' +
      '<td class="number" style="font-size:12px;color:var(--text2);">' + (a.created_at ? a.created_at.slice(0,10) : '-') + '</td>' +
      '<td class="number" style="font-size:12px;color:var(--text2);">' + (a.last_login ? a.last_login.slice(0,10) : '-') + '</td>' +
      '<td style="white-space:nowrap;">' +
        '<button class="btn btn-ghost btn-sm" data-edit-id="' + a.id + '">✏️</button>' +
        '<button class="btn btn-ghost btn-sm" data-del-id="' + a.id + '" data-del-name="' + (a.username||'') + '" style="color:#e74c3c;">🗑️</button>' +
      '</td>';
    tr.querySelector('[data-edit-id]').addEventListener('click', (function(id, uname){ return function(){ editAccount(id, uname); }; })(a.id, a.username||''));
    tr.querySelector('[data-del-id]').addEventListener('click', (function(id, uname){ return function(){ deleteAccount(id, uname); }; })(a.id, a.username||''));
    fragment.appendChild(tr);
  });
  tb.innerHTML = '';
  tb.appendChild(fragment);
}

function openAddAccountModal() {
  document.getElementById('acc-edit-id').value = '';
  document.getElementById('acc-edit-username').value = '';
  document.getElementById('acc-username').value = '';
  document.getElementById('acc-username').disabled = false;
  document.getElementById('acc-displayname').value = '';
  document.getElementById('acc-role').value = '';
  document.getElementById('acc-position').value = '';
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password2').value = '';
  document.getElementById('acc-pass-label').innerHTML = 'Password <span class="required">*</span>';
  document.getElementById('acc-pass-hint').style.display = 'none';
  document.getElementById('acc-confirm-req').style.display = '';
  document.getElementById('modal-addAccount-title').textContent = 'เพิ่ม Account';
  openModal('modal-addAccount');
}

async function editAccount(id, username) {
  const { data, error } = await supa.from('app_users')
    .select('id, username, display_name, name, role, position, active')
    .eq('id', id).single();
  if (error || !data) { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); return; }

  document.getElementById('acc-edit-id').value = data.id;
  document.getElementById('acc-edit-username').value = data.username;
  document.getElementById('acc-username').value = data.username;
  document.getElementById('acc-username').disabled = true;
  document.getElementById('acc-displayname').value = data.display_name || data.name || '';
  document.getElementById('acc-role').value = data.role || '';
  document.getElementById('acc-position').value = data.position || '';
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password2').value = '';
  document.getElementById('acc-pass-label').innerHTML = 'Password';
  document.getElementById('acc-pass-hint').style.display = '';
  document.getElementById('acc-confirm-req').style.display = 'none';
  document.getElementById('modal-addAccount-title').textContent = 'แก้ไข Account: ' + data.username;
  openModal('modal-addAccount');
}

async function saveAccount() {
  const editId       = document.getElementById('acc-edit-id')?.value || '';
  const editUsername = document.getElementById('acc-edit-username').value;
  const username     = document.getElementById('acc-username').value.trim().toLowerCase().replace(/\s+/g,'');
  const displayName  = document.getElementById('acc-displayname').value.trim();
  const role         = document.getElementById('acc-role').value;
  const position     = document.getElementById('acc-position').value.trim();
  const pass1        = document.getElementById('acc-password').value;
  const pass2        = document.getElementById('acc-password2').value;

  if (!username)    { toast('กรุณาระบุ Username','warning'); return; }
  if (!displayName) { toast('กรุณาระบุชื่อ','warning'); return; }
  if (!role)        { toast('กรุณาเลือก Role','warning'); return; }
  if (!editId && !pass1) { toast('กรุณาตั้ง Password','warning'); return; }
  if (pass1 && pass1 !== pass2) { toast('Password ไม่ตรงกัน','error'); return; }
  if (pass1 && pass1.length < 6) { toast('Password ต้องมีอย่างน้อย 6 ตัวอักษร','warning'); return; }

  const btn = document.querySelector('#modal-addAccount .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

  try {
    if (editId) {
      // === แก้ไข: update profile ใน app_users ===
      const updateData = { display_name: displayName, role, position };
      const { error: upErr } = await supa.from('app_users').update(updateData).eq('id', editId);
      if (upErr) { toast('บันทึกไม่สำเร็จ: ' + upErr.message, 'error'); return; }

      // ถ้ามีการเปลี่ยน password ให้ใช้ Edge Function
      if (pass1) {
        const { data: { session } } = await supa.auth.getSession();
        const res = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/manage-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session?.access_token
          },
          body: JSON.stringify({ action: 'changePassword', userId: editId, password: pass1 })
        });
        if (!res.ok) { toast('เปลี่ยน Password ไม่สำเร็จ — โปรดติดต่อ Admin', 'warning'); }
      }
      toast('แก้ไข Account เรียบร้อย', 'success');

    } else {
      // === เพิ่มใหม่: สร้างผ่าน Edge Function (ต้องการ service_role) ===
      const { data: { session } } = await supa.auth.getSession();
      const res = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/manage-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session?.access_token
        },
        body: JSON.stringify({ action: 'createUser', username, displayName, role, position, password: pass1 })
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        toast('สร้าง Account ไม่สำเร็จ: ' + (result.error || res.status), 'error');
        return;
      }
      toast('เพิ่ม Account เรียบร้อย', 'success');
    }

    closeModal('modal-addAccount');
    renderAccounts();

  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
  }
}

async function deleteAccount(id, username) {
  if (!confirm('ลบ Account "' + username + '" หรือไม่?')) return;
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('https://umueucsxowjaurlaubwa.supabase.co/functions/v1/manage-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session?.access_token
      },
      body: JSON.stringify({ action: 'deleteUser', userId: id })
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      toast('ลบไม่สำเร็จ: ' + (result.error || res.status), 'error');
      return;
    }
    toast('ลบ Account เรียบร้อย', 'success');
    renderAccounts();
  } catch(e) {
    toast('ลบไม่สำเร็จ: ' + e.message, 'error');
  }
}

function pickStaffForAccount() {
  renderPickStaffList();
  openModal('modal-pickStaff');
}

function renderPickStaffList() {
  const search = (document.getElementById('pickStaffSearch')?.value || '').toLowerCase();
  let list = db.staff.filter(function(s){ return !search || s.name.toLowerCase().includes(search) || (s.nickname||'').toLowerCase().includes(search); });
  const el = document.getElementById('pickStaffList');
  el.innerHTML = list.map(function(s) { return '<div style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;" onmouseover="this.style.background='var(--sage-light)'" onmouseout="this.style.background=''" onclick="selectStaffForAccount('' + s.name.replace(/'/g,"\'") + '','' + (s.position||'').replace(/'/g,"\'") + '')">' +
    '<div style="width:32px;height:32px;border-radius:50%;background:var(--sage-light);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">👤</div>' +
    '<div><div style="font-weight:600;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:var(--text2);">' + (s.nickname ? '('+s.nickname+') ' : '') + (s.position||'') + '</div></div></div>';
  }).join('') || '<div style="padding:24px;text-align:center;color:var(--text3);">ไม่พบพนักงาน</div>';
}

function selectStaffForAccount(name, position) {
  document.getElementById('acc-displayname').value = name;
  if (!document.getElementById('acc-position').value) {
    document.getElementById('acc-position').value = position;
  }
  closeModal('modal-pickStaff');
}

// อัพเดต last_login ใน app_users
async function recordLastLogin(username) {
  try {
    await supa.from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('username', username);
  } catch(e) {}
}
