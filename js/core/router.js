// ===== ROUTER =====

// ===== PAGES =====
let currentPage = 'dashboard';
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function showPage(page) {
  // R6-005 fix: close read-only modals (log/history/view/preview/detail) before navigating
  // เพื่อกัน modal ค้างบน page ใหม่. ไม่ปิด modal ที่อาจมีข้อมูลที่ user กำลังกรอก (form modals)
  const READONLY_MODAL_IDS = [
    'modal-invoice-reset-log', 'modal-doc-preview', 'modal-lot-detail',
    'modal-maintenance-history', 'modal-room-history',
    'modal-view-pr', 'modal-view-supinv', 'modal-view-supplier'
  ];
  READONLY_MODAL_IDS.forEach(id => {
    const m = document.getElementById(id);
    if (m && m.classList.contains('open') && typeof closeModal === 'function') closeModal(id);
  });

  document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.style.display = '';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${page}'`)) n.classList.add('active');
  });
  // For billing-settings, highlight billing nav
  if (page === 'billing-settings') {
    const nb = document.getElementById('nav-billing');
    if (nb) nb.classList.add('active');
  }
  currentPage = page;
  // R6-006 + R8-001/003/005 fix: เพิ่ม title ที่ขาด/ไม่ตรง sidebar
  const titles = { dashboard:'Dashboard', stock:'คลังสต็อก', requisition:'เบิกสินค้า', history:'ประวัติการเบิก', report:'📈 สรุปวิเคราะห์การเบิก', patients:'ผู้รับบริการ', rooms:'🛏️ ห้องพักและเตียง', staff:'พนักงาน', items:'รายการสินค้า', settings:'💬 Line & ตั้งค่า', reqform:'ใบเบิกสินค้า', patprofile:'ข้อมูลผู้รับบริการ', staffprofile:'ข้อมูลพนักงาน', accounts:'🔑 จัดการ Account', healthreport:'📋 รายงานสุขภาพ', purchasehistory:'📋 ประวัติการสั่งซื้อ', billing:'💰 ระบบบัญชี', 'billing-settings':'⚙️ ตั้งค่าบัญชี', expenses:'💸 ค่าใช้จ่าย', assets:'🔧 ครุภัณฑ์ & ซ่อมบำรุง', incident:'⚠️ อุบัติเหตุ & แผลกดทับ', dietary:'🍽️ โภชนาการ & สายให้อาหาร', deposits:'🏦 มัดจำ & เงินประกัน', bi:'🔍 BI & วิเคราะห์กำไร', suppliers:'🏭 ผู้จำหน่าย', supplierinvoices:'🧾 ใบแจ้งหนี้ผู้จำหน่าย', purchaserequests:'📋 คำขอซื้อ', stockreport:'📊 รายงานสต็อก', audit:'🔍 Audit Trail' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  closeSidebar();
  renderPage(page);
  if (typeof renderPageExtra === 'function') renderPageExtra(page);
}

function renderPage(page) {
  // ✅ หน้าที่ใช้ข้อมูลจาก loadDBSecondary() ต้องรอให้ secondary โหลดเสร็จก่อน render
  // ป้องกัน race: user สร้าง record → secondary fetch overwrite → record ใหม่หาย
  // หรือ open menu ก่อน secondary โหลดเสร็จ → ตารางว่าง
  const SECONDARY_PAGES = new Set([
    'billing','expenses','suppliers','supplierinvoices','purchaserequests',
    'assets','healthreport','bi','deposits','incident','audit','report','history','stockreport'
  ]);
  if (SECONDARY_PAGES.has(page) && typeof ensureSecondaryDB === 'function') {
    ensureSecondaryDB().then(() => _renderPageInner(page));
    return;
  }
  _renderPageInner(page);
  // R9-001 fix: Dashboard ใช้ทั้ง primary (patients,items,staff) + secondary (stockMovements,assets)
  // → render ทันทีด้วย primary, แล้ว re-render หลัง secondary load เสร็จเพื่อ refresh stat ที่ใช้ secondary
  if (page === 'dashboard' && typeof ensureSecondaryDB === 'function') {
    ensureSecondaryDB().then(() => { if (currentPage === 'dashboard') renderDashboard(); });
  }
}

function _renderPageInner(page) {
  if (page === 'dashboard') renderDashboard();
  else if (page === 'stock') renderStock();
  else if (page === 'history') { renderHistory(); updateApprovalBadge(); }
  else if (page === 'report') renderReport();
  else if (page === 'rooms') renderRooms();
  else if (page === 'patients') renderPatients();
  else if (page === 'staff') renderStaff();
else if (page === 'settings') { loadLineSettingsUI(); renderLineLog(); if(typeof window.loadBillingSettings==='function') window.loadBillingSettings(); }
  else if (page === 'requisition') initReq();
  // reqform is populated by openReqForm() before showPage('reqform') is called
  // profiles are populated before showPage() is called
  else if (page === 'accounts') renderAccounts();
  else if (page === 'billing') renderBilling();
  else if (page === 'healthreport') {
    const hrMonth = document.getElementById('hr-month');
    if (!hrMonth.value) hrMonth.value = new Date().toISOString().slice(0,7);
    renderHealthReport();
  }
  else if (page === 'bi') {
    const biMonth = document.getElementById('bi-month');
    if (biMonth && !biMonth.value) biMonth.value = new Date().toISOString().slice(0,7);
    renderBIPage();
  }
  else if (page === 'suppliers') renderSuppliers();
  else if (page === 'supplierinvoices') { renderSupplierInvoices(); populateSupInvFilters(); }
  else if (page === 'purchaserequests') renderPurchaseRequests();
  else if (page === 'stockreport') {
    const srMonth = document.getElementById('sr-month');
    if (srMonth && !srMonth.value) srMonth.value = new Date().toISOString().slice(0,7);
    switchStockReportTab('lowstock');
  }
  else if (page === 'expenses') renderExpenses();
  else if (page === 'assets') { renderAssets(); }
  else if (page === 'audit') { window._auditPage=1; renderAuditPage(); }
}
