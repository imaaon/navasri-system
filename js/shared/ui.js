// ===== UI & LINE INTEGRATION =====

// ===== LINE INTEGRATION =====
let lineLog = [];

function saveLineSettings() {
  db.lineSettings = {
    enabled: document.getElementById('lineEnabled')?.checked || false,
    webhookUrl: document.getElementById('webhookUrl')?.value?.trim() || '',
    notifyNewReq: document.getElementById('notifyNewReq')?.checked ?? true,
    notifyForward: document.getElementById('notifyForward')?.checked ?? true,
    notifyApproved: document.getElementById('notifyApproved')?.checked ?? true,
    notifyRejected: document.getElementById('notifyRejected')?.checked ?? true,
    notifyLowStock: document.getElementById('notifyLowStock')?.checked ?? true,
    // features.js extra toggles
    notifyOverdueBills:  document.getElementById('ls-notify-overdue')?.checked ?? false,
    notifyLowStockDaily: document.getElementById('ls-notify-stock')?.checked  ?? false,
  };
  saveDB();
  updateLineStatusDot();
}
function loadLineSettingsUI() {
  const s = db.lineSettings;
  const el = id => document.getElementById(id);
  if (el('lineEnabled')) el('lineEnabled').checked = s.enabled;
  if (el('webhookUrl')) el('webhookUrl').value = s.webhookUrl || '';
  if (el('notifyNewReq')) el('notifyNewReq').checked = s.notifyNewReq;
  if (el('notifyForward')) el('notifyForward').checked = s.notifyForward;
  if (el('notifyApproved')) el('notifyApproved').checked = s.notifyApproved;
  if (el('notifyRejected')) el('notifyRejected').checked = s.notifyRejected;
  if (el('notifyLowStock')) el('notifyLowStock').checked = s.notifyLowStock;
  updateLineBanner();
}

function updateLineStatusDot() {
  try {
    if (typeof db === 'undefined' || !db || !db.lineSettings) return;
    const s = db.lineSettings;
    // Edge Function จัดการทุกอย่าง — ถ้าเปิดใช้งานถือว่าเชื่อมต่อแล้ว
    const emoji = s.enabled ? '🟢' : '⚪';
    const title = s.enabled ? 'Line: เชื่อมต่อแล้ว (Edge Function)' : 'Line: ปิดอยู่';
    const topbar = document.getElementById('line-status-dot');
    if (topbar) { topbar.textContent = emoji; topbar.title = title; }
    const sidebar = document.getElementById('lineStatusDot');
    if (sidebar) { sidebar.title = title; sidebar.style.background = s.enabled ? '#1D9E75' : '#B4B2A9'; }
  } catch(e) { /* ยังไม่พร้อม */ }
}

function updateLineBanner() {
  const banner = document.getElementById('lineBanner');
  if (!banner) return;
  const s = db.lineSettings;
  if (s.enabled) {
    banner.style.display = '';
    banner.innerHTML = `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">✅</span>
      <div><div style="font-weight:700;color:#166534;font-size:13.5px;">Line Notification เปิดใช้งานแล้ว</div>
      <div style="font-size:12px;color:#15803d;margin-top:1px;">ส่งผ่าน Supabase Edge Function — ปลอดภัย ไม่มี CORS</div></div>
    </div>`;
  } else {
    banner.style.display = 'none';
  }
}

async function sendLineNotify(event, messageText, data = {}) {
  // Guard: ต้องมี lineSettings และ enabled
  if (!db?.lineSettings?.enabled) return;
  const s = db.lineSettings;

  const EDGE_URL = 'https://umueucsxowjaurlaubwa.supabase.co/functions/v1/line-notify';

  // เช็ค event-level flag
  const eventMap = {
    new_requisition: 'notifyNewReq',
    forward_requisition: 'notifyForward',
    approved: 'notifyApproved',
    rejected: 'notifyRejected',
    low_stock: 'notifyLowStock',
  };
  if (eventMap[event] && !s[eventMap[event]]) return;

  const payload = { event, message: messageText, data, timestamp: new Date().toISOString() };
  const logEntry = { time: new Date().toLocaleTimeString('th-TH'), event, status: 'กำลังส่ง...', msg: (messageText||'').split('\n')[0] };
  lineLog.unshift(logEntry);
  renderLineLog();

  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json().catch(() => ({}));
      // เช็ค LINE API response จาก Edge Function
      if (result.push_status && result.push_status !== 200) {
        logEntry.status = `⚠️ Edge OK แต่ LINE ตอบ ${result.push_status}: ${result.push_response||''}`;
        console.warn('[LINE] Edge Function OK but LINE API returned:', result);
      } else {
        logEntry.status = '✅ ส่งสำเร็จ';
      }
    } else {
      const errBody = await res.json().catch(() => ({}));
      logEntry.status = `❌ Edge Function ตอบ ${res.status}: ${errBody.error||''}`;
      console.error('[LINE] Edge Function error:', res.status, errBody);
    }
  } catch(e) {
    logEntry.status = '❌ Network error: ' + e.message;
    console.error('[LINE] fetch failed:', e);
  }
  renderLineLog();
}

function renderLineLog() {
  const logEl = document.getElementById('testLog');
  const card = document.getElementById('testLogCard');
  if (!logEl || !card) return;
  if (lineLog.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';
  logEl.innerHTML = lineLog.slice(0, 20).map(l =>
    `<div style="padding:4px 0;border-bottom:1px solid #f0ede6;display:flex;gap:12px;align-items:flex-start;">
      <span style="color:#a09890;flex-shrink:0;">${l.time}</span>
      <span style="color:${l.status.includes('✅')||l.status.includes('⚠️ CORS')?'#2a7a4f':l.status.includes('❌')?'#c0392b':'#d4760a'};flex-shrink:0;">${l.status}</span>
      <span style="color:#706860;font-size:11.5px;">${l.msg}</span>
    </div>`
  ).join('');
}

async function testWebhook() {
  const btn = document.getElementById('testBtn');
  if (btn) { btn.textContent = '⏳ กำลังส่ง...'; btn.disabled = true; }

  const EDGE_URL = 'https://umueucsxowjaurlaubwa.supabase.co/functions/v1/line-notify';
  const testPayload = {
    event: 'test',
    message: '🧪 ทดสอบการเชื่อมต่อ\n🏥 นวศรี เนอร์สซิ่งโฮม\n✅ ระบบเชื่อมต่อ LINE สำเร็จ',
    data: { test: true, timestamp: new Date().toISOString() }
  };

  const logEntry = { time: new Date().toLocaleTimeString('th-TH'), event: 'test', status: 'กำลังส่ง...', msg: 'ทดสอบการเชื่อมต่อ' };
  lineLog.unshift(logEntry);
  renderLineLog();

  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY || '',
      },
      body: JSON.stringify(testPayload),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      logEntry.status = '✅ ส่งสำเร็จ';
      toast('✅ ส่ง LINE สำเร็จ! ตรวจสอบ LINE OA Navasri Nursing Home', 'success');
    } else {
      logEntry.status = `❌ ผิดพลาด (${res.status}): ${JSON.stringify(result)}`;
      toast('❌ ส่งไม่สำเร็จ: ' + JSON.stringify(result), 'warning');
    }
  } catch(e) {
    logEntry.status = '❌ ' + e.message;
    toast('❌ ไม่สามารถเชื่อมต่อ Edge Function: ' + e.message, 'warning');
  }

  renderLineLog();
  if (btn) { btn.textContent = '🧪 ทดสอบ'; btn.disabled = false; }
}

function clearLog() {
  lineLog = [];
  renderLineLog();
}

function showGuideModal() {
  openModal('modal-guide');
}

// Build Line message text for each event
function buildLineMsg(event, data) {
  const now = new Date().toLocaleString('th-TH', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'});
  switch(event) {
    case 'new_requisition':
      return `📋 ใบเบิกใหม่รอตรวจสอบ\n━━━━━━━━━━━━━━\n🔖 ${data.refNo}\n👥 ผู้รับบริการ: ${data.patient}\n📦 ${data.itemCount} รายการ\n👤 เบิกโดย: ${data.staff}\n🕐 ${now}\n\n🔎 กรุณาตรวจสอบในระบบ`;
    case 'forward_requisition':
      return `📤 ใบเบิกรออนุมัติ (ผ่านหัวหน้าแล้ว)\n━━━━━━━━━━━━━━\n🔖 ${data.refNo}\n👥 ผู้รับบริการ: ${data.patient}\n📦 ${data.itemCount} รายการ\n🕐 ${now}\n\n✅ กรุณาตรวจสอบสต็อกและอนุมัติในระบบ`;
    case 'approved':
      return `✅ ใบเบิกได้รับการอนุมัติ\n━━━━━━━━━━━━━━\n🔖 ${data.refNo}\n👥 ผู้รับบริการ: ${data.patient}\n📦 ${data.itemCount} รายการ\n🏪 ตัดสต็อกอัตโนมัติแล้ว\n🕐 ${now}`;
    case 'rejected':
      return `❌ ใบเบิกไม่ได้รับการอนุมัติ\n━━━━━━━━━━━━━━\n🔖 ${data.refNo}\n👥 ผู้รับบริการ: ${data.patient}\n📝 เหตุผล: ${data.reason || 'ไม่ระบุ'}\n🕐 ${now}`;
    case 'low_stock':
      return `⚠️ แจ้งเตือน: สินค้าใกล้หมด\n━━━━━━━━━━━━━━\n📦 ${data.itemName}\n📉 คงเหลือ: ${data.qty} ${data.unit} (จุดแจ้งเตือน: ${data.reorder})\n🕐 ${now}\n\n🛒 กรุณาสั่งซื้อเพิ่ม`;
    default:
      return `[${event}] ${JSON.stringify(data)}`;
  }
}

// ===== TYPEAHEAD HELPER =====
// makeTypeahead(cfg)
// cfg.inputId   — id ของ <input> ที่ user พิมพ์
// cfg.listId    — id ของ <div> dropdown list
// cfg.hiddenId  — id ของ <input type=hidden> ที่เก็บ value จริง
// cfg.dataFn    — function() -> [{id, label, sub}]
// cfg.onSelect  — optional callback(id, label)
// cfg.placeholder — optional
function makeTypeahead(cfg) {
  const inp = document.getElementById(cfg.inputId);
  const list = document.getElementById(cfg.listId);
  const hidden = document.getElementById(cfg.hiddenId);
  if (!inp || !list) return;

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function render(kw) {
    const all = cfg.dataFn();
    const q = (kw||'').trim().toLowerCase();
    const matches = q
      ? all.filter(x => (x.label||'').toLowerCase().includes(q) || (x.sub||'').toLowerCase().includes(q))
      : all;
    if (!matches.length) { list.style.display = 'none'; return; }
    list.innerHTML = matches.slice(0, 40).map(function(x) {
      var hover = "onmouseover=\"this.style.background='var(--surface2)'\" onmouseout=\"this.style.background=''\"";
      return "<div class=\"ta-item\" data-id=\"" + esc(String(x.id)) + "\" data-label=\"" + esc(x.label) + "\" " +
        "style=\"padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;\" " +
        hover + ">" +
        "<span>" + esc(x.label) + "</span>" +
        (x.sub ? "<span style=\"font-size:11px;color:var(--text3);margin-left:8px;\">" + esc(x.sub) + "</span>" : "") +
        "</div>";
    }).join("");
    list.style.display = 'block';
    // bind click
    list.querySelectorAll('.ta-item').forEach(el => {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const id = this.dataset.id;
        const label = this.dataset.label;
        inp.value = label;
        if (hidden) hidden.value = id;
        list.style.display = 'none';
        if (cfg.onSelect) cfg.onSelect(id, label);
      });
    });
  }

  inp.addEventListener('input', () => render(inp.value));
  inp.addEventListener('focus', () => render(inp.value));
  list.addEventListener('mousedown', (e) => e.preventDefault());
  inp.addEventListener('blur',  () => setTimeout(() => { list.style.display = 'none'; }, 150));
  if (cfg.placeholder) inp.placeholder = cfg.placeholder;
}

// ---- data helpers ----
function taPatients(activeOnly) {
  const pts = (db.patients||[]);
  const filtered = activeOnly ? pts.filter(x=>x.status==='active') : pts;
  return filtered.sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    .map(x=>({ id:x.id, label:x.name||'', sub: x.hn ? 'HN '+x.hn : '' }));
}
function taStaff() {
  return (db.staff||[]).sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    .map(x=>({ id:x.id, label:x.name||'', sub: x.position||'' }));
}
function taSuppliers() {
  const list = (db.suppliers||[]).filter(x=>x.status==='active')
    .sort((a,b)=>(a.name||''). localeCompare(b.name||'')).map(x=>({id:x.id,label:x.name||'',sub:x.contact_name||''}));
  return list;
}

// lazy-load suppliers then re-render typeahead
async function ensureSuppliersLoaded(inputId, listId, hiddenId) {
  // fetch เฉพาะเมื่อ db.suppliers ว่าง
  if ((db.suppliers||[]).length === 0) {
    try {
      const {data} = await supa.from('suppliers').select('*').order('supplier_name');
      if (data && data.length > 0) db.suppliers = data.map(r=>({id:r.id, code:r.supplier_code||'', name:r.supplier_name||'', contact_name:r.contact_name||'', status:r.status||'active', phone:r.phone||''}));
    } catch(e) { console.warn('ensureSuppliersLoaded fetch:', e.message); }
  }
  // init typeahead เสมอ ไม่ว่าจะ fetch หรือไม่
  makeTypeahead({inputId, listId, hiddenId, dataFn:()=>taSuppliers()});
  const inp = document.getElementById(inputId);
  if (inp) inp.dispatchEvent(new Event('focus'));
}
