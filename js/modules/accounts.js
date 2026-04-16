// ===== ACCOUNTS MODULE =====
// v3: Supabase app_users + manage-users Edge Function

var ROLE_LABELS = {
  admin: 'admin',
  manager: 'ผู้บริหาร (Executive)',
  officer: 'ธุรการ (Officer)',
  accounting: 'บัญชี (Accounting)',
  nurse: 'พยาบาล',
  caregiver: 'ผู้ดูแล / บริบาล',
  physical_therapist: 'นักกายภาพบำบัด',
  supervisor: 'หัวหน้า',
  warehouse: 'คลังสินค้า',
};
var ROLE_BADGE = {
  admin:'badge-red', manager:'badge-red', officer:'badge-purple',
  accounting:'badge-orange', nurse:'badge-blue',
  caregiver:'badge-green', physical_therapist:'badge-green',
  supervisor:'badge-purple', warehouse:'badge-orange',
};
var MANAGE_URL = 'https://umueucsxowjaurlaubwa.supabase.co/functions/v1/manage-users';

async function _getToken() {
  var s = await supa.auth.getSession();
  return s.data && s.data.session ? s.data.session.access_token : '';
}

async function loadAccounts() {
  var res = await supa.from('app_users')
    .select('id, username, display_name, name, role, position, active, created_at, last_login')
    .order('created_at', { ascending: true });
  if (res.error) { toast('โหลด Account ไม่สำเร็จ: ' + res.error.message, 'error'); return []; }
  return res.data || [];
}

async function renderAccounts() {
  var accounts = await loadAccounts();
  document.getElementById('accTableTitle').textContent = 'รายการ Account ทั้งหมด (' + accounts.length + ' account)';
  var tb = document.getElementById('accTable');
  var frag = document.createDocumentFragment();
  accounts.forEach(function(a, i) {
    var dname = a.display_name || a.name || a.username;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="number" style="color:var(--text3);">' + (i+1) + '</td>' +
      '<td style="font-weight:700;font-family:monospace;">' + (a.username||'') + '</td>' +
      '<td>' + (dname||'') + '</td>' +
      '<td><span class="badge ' + (ROLE_BADGE[a.role]||'badge-gray') + '">' + (ROLE_LABELS[a.role]||a.role||'-') + '</span></td>' +
      '<td style="font-size:12px;color:var(--text2);">' + (a.position||'-') + '</td>' +
      '<td class="number" style="font-size:12px;color:var(--text2);">' + (a.created_at?a.created_at.slice(0,10):'-') + '</td>' +
      '<td class="number" style="font-size:12px;color:var(--text2);">' + (a.last_login?a.last_login.slice(0,10):'-') + '</td>' +
      '<td style="white-space:nowrap;">' +
        '<button class="btn btn-ghost btn-sm" data-eid="' + a.id + '" data-eun="' + (a.username||'') + '">✏️</button>' +
        '<button class="btn btn-ghost btn-sm" data-did="' + a.id + '" data-dun="' + (a.username||'') + '" style="color:#e74c3c;">🗑️</button>' +
      '</td>';
    tr.querySelector('[data-eid]').addEventListener('click', function() { editAccount(this.dataset.eid, this.dataset.eun); });
    tr.querySelector('[data-did]').addEventListener('click', function() { deleteAccount(this.dataset.did, this.dataset.dun); });
    frag.appendChild(tr);
  });
  tb.innerHTML = '';
  tb.appendChild(frag);
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
  var res = await supa.from('app_users').select('id, username, display_name, name, role, position').eq('id', id).single();
  if (res.error || !res.data) { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); return; }
  var a = res.data;
  document.getElementById('acc-edit-id').value = a.id;
  document.getElementById('acc-edit-username').value = a.username;
  document.getElementById('acc-username').value = a.username;
  document.getElementById('acc-username').disabled = true;
  document.getElementById('acc-displayname').value = a.display_name || a.name || '';
  document.getElementById('acc-role').value = a.role || '';
  document.getElementById('acc-position').value = a.position || '';
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password2').value = '';
  document.getElementById('acc-pass-label').innerHTML = 'Password';
  document.getElementById('acc-pass-hint').style.display = '';
  document.getElementById('acc-confirm-req').style.display = 'none';
  document.getElementById('modal-addAccount-title').textContent = 'แก้ไข Account: ' + a.username;
  openModal('modal-addAccount');
}

async function saveAccount() {
  var editId = document.getElementById('acc-edit-id').value;
  var username = document.getElementById('acc-username').value.trim().toLowerCase().replace(/\s+/g,'');
  var displayName = document.getElementById('acc-displayname').value.trim();
  var role = document.getElementById('acc-role').value;
  var position = document.getElementById('acc-position').value.trim();
  var pass1 = document.getElementById('acc-password').value;
  var pass2 = document.getElementById('acc-password2').value;

  if (!username)    { toast('กรุณาระบุ Username','warning'); return; }
  if (!displayName) { toast('กรุณาระบุชื่อ','warning'); return; }
  if (!role)        { toast('กรุณาเลือก Role','warning'); return; }
  if (!editId && !pass1) { toast('กรุณาตั้ง Password','warning'); return; }
  if (pass1 && pass1 !== pass2) { toast('Password ไม่ตรงกัน','error'); return; }
  if (pass1 && pass1.length < 6) { toast('Password ต้องมีอย่างน้อย 6 ตัวอักษร','warning'); return; }

  var btn = document.querySelector('#modal-addAccount .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

  try {
    var tok = await _getToken();
    if (editId) {
      var upRes = await supa.from('app_users').update({ display_name: displayName, role: role, position: position }).eq('id', editId);
      if (upRes.error) { toast('บันทึกไม่สำเร็จ: ' + upRes.error.message, 'error'); return; }
      if (pass1) {
        var pwRes = await fetch(MANAGE_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok}, body:JSON.stringify({ action:'changePassword', userId:editId, password:pass1 }) });
        var pwData = await pwRes.json();
        if (!pwRes.ok || pwData.error) toast('เปลี่ยน Password ไม่สำเร็จ', 'warning');
      }
      toast('แก้ไข Account เรียบร้อย','success');
    } else {
      var crRes = await fetch(MANAGE_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok}, body:JSON.stringify({ action:'createUser', username:username, displayName:displayName, role:role, position:position, password:pass1 }) });
      var crData = await crRes.json();
      if (!crRes.ok || crData.error) { toast('สร้าง Account ไม่สำเร็จ: '+(crData.error||crRes.status),'error'); return; }
      toast('เพิ่ม Account เรียบร้อย','success');
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
    var tok = await _getToken();
    var res = await fetch(MANAGE_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok}, body:JSON.stringify({ action:'deleteUser', userId:id }) });
    var data = await res.json();
    if (!res.ok || data.error) { toast('ลบไม่สำเร็จ: '+(data.error||res.status),'error'); return; }
    toast('ลบ Account เรียบร้อย','success');
    renderAccounts();
  } catch(e) { toast('ลบไม่สำเร็จ: '+e.message,'error'); }
}

function pickStaffForAccount() { renderPickStaffList(); openModal('modal-pickStaff'); }

function renderPickStaffList() {
  var search = ((document.getElementById('pickStaffSearch')||{}).value||'').toLowerCase();
  var list = db.staff.filter(function(s){ return !search||s.name.toLowerCase().includes(search)||(s.nickname||'').toLowerCase().includes(search); });
  var el = document.getElementById('pickStaffList');
  el.innerHTML = list.map(function(s) {
    return '<div style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;" onmouseover="this.style.background='var(--sage-light)'" onmouseout="this.style.background=''" data-name="' + s.name.replace(/"/g,'&quot;') + '" data-pos="' + (s.position||'').replace(/"/g,'&quot;') + '" onclick="selectStaffForAccount(this)">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:var(--sage-light);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">👤</div>' +
      '<div><div style="font-weight:600;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:var(--text2);">' + (s.nickname?'('+s.nickname+') ':'') + (s.position||'') + '</div></div></div>';
  }).join('') || '<div style="padding:24px;text-align:center;color:var(--text3);">ไม่พบพนักงาน</div>';
}

function selectStaffForAccount(el) {
  document.getElementById('acc-displayname').value = el.dataset.name || '';
  if (!document.getElementById('acc-position').value) document.getElementById('acc-position').value = el.dataset.pos || '';
  closeModal('modal-pickStaff');
}

async function recordLastLogin(username) {
  try { await supa.from('app_users').update({ last_login: new Date().toISOString() }).eq('username', username); } catch(e) {}
}
