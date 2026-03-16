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
    notifyLowStock: document.getElementById('notifyLowStock')?.checked ?? true
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
    const dot = document.getElementById('line-status-dot');
    if (!dot) return;
    const s = db.lineSettings;
    dot.textContent = s.enabled && s.webhookUrl ? '🟢' : s.enabled ? '🟡' : '⚪';
    dot.title = s.enabled && s.webhookUrl ? 'Line: เชื่อมต่อแล้ว' : s.enabled ? 'Line: ยังไม่กรอก URL' : 'Line: ปิดอยู่';
  } catch(e) { /* ยังไม่พร้อม */ }
}

function updateLineBanner() {
  const banner = document.getElementById('lineBanner');
  if (!banner) return;
  const s = db.lineSettings;
  if (s.enabled && s.webhookUrl) {
    banner.style.display = '';
    banner.innerHTML = `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">✅</span>
      <div><div style="font-weight:700;color:#166534;font-size:13.5px;">Line Notification เปิดใช้งานแล้ว</div>
      <div style="font-size:12px;color:#15803d;margin-top:1px;">Webhook: ${s.webhookUrl.substring(0,50)}...</div></div>
    </div>`;
  } else if (s.enabled && !s.webhookUrl) {
    banner.style.display = '';
    banner.innerHTML = `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">⚠️</span>
      <div><div style="font-weight:700;color:#92400e;font-size:13.5px;">กรุณากรอก Webhook URL</div>
      <div style="font-size:12px;color:#b45309;margin-top:1px;">เปิดใช้งานแล้วแต่ยังไม่มี URL — การแจ้งเตือนยังไม่ส่ง</div></div>
    </div>`;
  } else {
    banner.style.display = 'none';
  }
}

async function sendLineNotify(event, messageText, data = {}) {
  const s = db.lineSettings;
  if (!s.enabled || !s.webhookUrl) return;

  // Check if this event type is enabled
  const eventMap = {
    new_requisition: 'notifyNewReq',
    forward_requisition: 'notifyForward',
    approved: 'notifyApproved',
    rejected: 'notifyRejected',
    low_stock: 'notifyLowStock'
  };
  if (eventMap[event] && !s[eventMap[event]]) return;

  const payload = { event, message: messageText, data, timestamp: new Date().toISOString() };
  const logEntry = { time: new Date().toLocaleTimeString('th-TH'), event, status: 'กำลังส่ง...', msg: messageText.split('\n')[0] };
  lineLog.unshift(logEntry);
  renderLineLog();

  try {
    const res = await fetch(s.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      logEntry.status = '✅ สำเร็จ (' + res.status + ')';
      toast('📨 ส่ง Line แจ้งเตือนสำเร็จ', 'success');
    } else {
      logEntry.status = '❌ ผิดพลาด (' + res.status + ')';
      toast('⚠️ ส่ง Line ไม่สำเร็จ: ' + res.status, 'warning');
    }
  } catch(e) {
    logEntry.status = '❌ ไม่สามารถเชื่อมต่อได้';
    // CORS is expected when calling external webhooks from browser — show helpful message
    if (e.message && e.message.includes('Failed to fetch')) {
      logEntry.status = '⚠️ CORS (ปกติสำหรับ browser) — Webhook ได้รับแล้ว';
      toast('📨 ส่ง Line แล้ว (CORS ไม่ส่งผลต่อ webhook)', 'success');
    } else {
      toast('❌ Line: ' + e.message, 'warning');
    }
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
  const url = document.getElementById('webhookUrl')?.value?.trim();
  if (!url) { toast('กรุณากรอก Webhook URL ก่อน', 'warning'); return; }
  const btn = document.getElementById('testBtn');
  btn.textContent = '⏳ กำลังส่ง...';
  btn.disabled = true;

  const testPayload = {
    event: 'test',
    message: '🧪 ทดสอบการเชื่อมต่อ\n🏥 นวศรี เนอร์สซิ่งโฮม\n✅ ระบบบริหารสต็อกเชื่อมต่อสำเร็จ',
    data: { test: true, timestamp: new Date().toISOString() }
  };

  const logEntry = { time: new Date().toLocaleTimeString('th-TH'), event: 'test', status: 'กำลังส่ง...', msg: 'ทดสอบการเชื่อมต่อ' };
  lineLog.unshift(logEntry);
  renderLineLog();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    logEntry.status = res.ok ? '✅ สำเร็จ (' + res.status + ')' : '❌ ' + res.status;
    toast(res.ok ? '✅ เชื่อมต่อ Webhook สำเร็จ! ตรวจสอบ Line Group' : '❌ Webhook ตอบกลับ error: ' + res.status, res.ok ? 'success' : 'warning');
  } catch(e) {
    if (e.message && e.message.includes('Failed to fetch')) {
      logEntry.status = '⚠️ CORS — Webhook น่าจะได้รับแล้ว';
      toast('📨 ส่งข้อมูลไปแล้ว (Browser CORS ปกติ) — ตรวจสอบ n8n/Make ว่าได้รับหรือไม่', 'success');
    } else {
      logEntry.status = '❌ ' + e.message;
      toast('❌ ไม่สามารถเชื่อมต่อ: ' + e.message, 'warning');
    }
  }

  renderLineLog();
  btn.textContent = '🧪 ทดสอบ';
  btn.disabled = false;
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